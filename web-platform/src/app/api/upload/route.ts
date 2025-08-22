import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { JobStatus, FileStatus } from '@prisma/client';

// Allow large files by default - set MAX_FILE_SIZE environment variable to limit
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE 
  ? parseInt(process.env.MAX_FILE_SIZE) 
  : Number.MAX_SAFE_INTEGER; // No limit by default
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const jobName = (formData.get('jobName') as string) || `OCR Job - ${new Date().toLocaleString()}`;
    const description = formData.get('description') as string || '';
    const priority = parseInt((formData.get('priority') as string) || '0');

    // Validate files
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Check file types and sizes
    const validFiles = [];
    const errors = [];

    for (const file of files) {
      // Enhanced PDF MIME type detection
      const validPdfMimeTypes = [
        'application/pdf',
        'application/x-pdf',
        'application/acrobat',
        'applications/vnd.pdf',
        'text/pdf',
        'text/x-pdf'
      ];
      
      const isPdfMimeType = validPdfMimeTypes.includes(file.type);
      const isPdfExtension = file.name.toLowerCase().endsWith('.pdf');
      
      if (!isPdfMimeType && !isPdfExtension) {
        errors.push(`${file.name}: Only PDF files are supported. File type: ${file.type}`);
        continue;
      } else if (!isPdfMimeType && isPdfExtension) {
        console.warn(`File "${file.name}" has .pdf extension but unexpected MIME type "${file.type}". Allowing upload.`);
      }

      if (file.size > MAX_FILE_SIZE) {
        const maxSizeMB = MAX_FILE_SIZE === Number.MAX_SAFE_INTEGER 
          ? 'unlimited' 
          : `${MAX_FILE_SIZE / 1024 / 1024}MB`;
        errors.push(`${file.name}: File too large (max ${maxSizeMB})`);
        continue;
      }

      if (file.size === 0) {
        errors.push(`${file.name}: Empty file`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      return NextResponse.json(
        { error: 'No valid files found', details: errors },
        { status: 400 }
      );
    }

    // Create job
    const job = await prisma.job.create({
      data: {
        name: jobName,
        description,
        priority,
        totalFiles: validFiles.length,
        status: JobStatus.PENDING,
        configuration: {
          uploadedAt: new Date().toISOString(),
          userAgent: request.headers.get('user-agent'),
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        },
      },
    });

    // Create upload directory
    const jobUploadDir = join(UPLOAD_DIR, job.id);
    await mkdir(jobUploadDir, { recursive: true });

    // Process and save files
    const fileRecords = [];
    let uploadErrors = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      
      try {
        // Generate unique filename
        const fileExtension = '.pdf';
        const timestamp = Date.now();
        const fileName = `${timestamp}_${i}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = join(jobUploadDir, fileName);

        // Calculate checksum
        const buffer = Buffer.from(await file.arrayBuffer());
        const checksum = createHash('sha256').update(buffer).digest('hex');

        // Check for duplicates (globally)
        const existingFile = await prisma.file.findFirst({
          where: {
            checksum,
          },
          include: {
            job: true,
          },
        });

        if (existingFile) {
          uploadErrors.push(`${file.name}: Duplicate file (already processed in job "${existingFile.job.name}")`);
          continue;
        }

        // Write file to disk
        await writeFile(filePath, buffer);

        // Create file record
        const fileRecord = await prisma.file.create({
          data: {
            jobId: job.id,
            originalName: file.name,
            fileName,
            filePath,
            fileSize: BigInt(file.size),
            mimeType: file.type,
            checksum,
            status: FileStatus.PENDING,
          },
        });

        fileRecords.push(fileRecord);

      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        uploadErrors.push(`${file.name}: Upload failed`);
      }
    }

    // Update job with actual file count
    await prisma.job.update({
      where: { id: job.id },
      data: {
        totalFiles: fileRecords.length,
        status: fileRecords.length > 0 ? JobStatus.READY : JobStatus.FAILED,
        errorMessage: uploadErrors.length > 0 ? uploadErrors.join('; ') : null,
      },
    });

    // Return response
    return NextResponse.json({
      success: true,
      jobId: job.id,
      filesUploaded: fileRecords.length,
      totalFiles: validFiles.length,
      errors: uploadErrors.length > 0 ? uploadErrors : undefined,
      job: {
        id: job.id,
        name: job.name,
        status: job.status,
        totalFiles: job.totalFiles,
        createdAt: job.createdAt,
      },
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    return NextResponse.json(
      { 
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    const where: any = {};

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          _count: {
            select: {
              files: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    return NextResponse.json({
      jobs: jobs.map(job => ({
        ...job,
        fileCount: job._count.files,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}