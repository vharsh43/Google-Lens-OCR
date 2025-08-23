import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get jobs with related data
    const [jobs, totalCount] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          files: {
            select: {
              id: true,
              originalName: true,
              fileSize: true,
              status: true,
              processingResults: {
                select: {
                  ocrConfidence: true,
                  processingDuration: true
                }
              }
            }
          },
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      
      prisma.job.count({ where })
    ]);

    // Transform jobs data to include computed fields
    const transformedJobs = jobs.map(job => ({
      ...job,
      fileSize: job.files.reduce((sum, file) => sum + Number(file.fileSize), 0).toString(),
      files: job.files.map(file => ({
        ...file,
        fileSize: file.fileSize.toString() // Convert BigInt to string
      })),
      
      // Calculate averages from processing results
      avgConfidence: job.files.length > 0 
        ? (() => {
            const confidences = job.files
              .map(f => f.processingResults?.ocrConfidence)
              .filter((conf): conf is number => typeof conf === 'number');
            return confidences.length > 0 
              ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length
              : null;
          })()
        : null,
        
      avgProcessingTime: job.files.length > 0
        ? (() => {
            const durations = job.files
              .map(f => f.processingResults?.processingDuration)
              .filter((duration): duration is number => typeof duration === 'number');
            return durations.length > 0 
              ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
              : null;
          })()
        : null,
    }));

    return NextResponse.json({
      jobs: transformedJobs,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, priority = 'NORMAL' } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Job name is required' },
        { status: 400 }
      );
    }

    // Create new job
    const job = await prisma.job.create({
      data: {
        name,
        description,
        priority: priority.toUpperCase(),
        status: 'PENDING',
        progress: 0,
        totalFiles: 0,
        processedFiles: 0,
        successfulFiles: 0,
        failedFiles: 0,
      },
      include: {
        files: true
      }
    });

    return NextResponse.json(job, { status: 201 });

  } catch (error) {
    console.error('Create job error:', error);
    
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}