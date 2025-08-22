import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createReadStream, createWriteStream } from 'fs';
import { readdir, stat, access } from 'fs/promises';
import { join, basename, extname } from 'path';
import archiver from 'archiver';
import { pipeline } from 'stream/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'zip'; // zip, individual
    const type = searchParams.get('type') || 'all'; // all, text, images

    // Get job with files and results
    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
      },
      include: {
        files: {
          include: {
            processingResults: true,
          },
          where: {
            status: 'COMPLETED',
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Job not completed yet' },
        { status: 400 }
      );
    }

    if (job.files.length === 0) {
      return NextResponse.json(
        { error: 'No completed files found' },
        { status: 404 }
      );
    }

    // Log download (simplified without audit table)
    console.log(`Download started for job ${jobId}: format=${format}, type=${type}, files=${job.files.length}`);

    if (format === 'zip') {
      return await createZipDownload(job, type);
    } else if (format === 'individual') {
      const fileId = searchParams.get('fileId');
      if (!fileId) {
        return NextResponse.json(
          { error: 'File ID required for individual download' },
          { status: 400 }
        );
      }
      return await createIndividualFileDownload(job, fileId, type);
    } else {
      return NextResponse.json(
        { error: 'Invalid format. Use "zip" or "individual"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Download error:', error);
    
    return NextResponse.json(
      { 
        error: 'Download failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function createZipDownload(job: any, type: string) {
  return new Promise<NextResponse>((resolve, reject) => {
    try {
      // Create a readable stream for the zip
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      const chunks: Buffer[] = [];
      
      archive.on('data', (chunk) => {
        chunks.push(chunk);
      });

      archive.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const filename = `${job.name.replace(/[^a-zA-Z0-9-_]/g, '_')}_results.zip`;
        
        resolve(new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length.toString(),
          },
        }));
      });

      archive.on('error', (error) => {
        console.error('Archive error:', error);
        reject(error);
      });

      // Add files to archive
      addFilesToArchive(archive, job.files, type).then(() => {
        archive.finalize();
      }).catch(reject);

    } catch (error) {
      reject(error);
    }
  });
}

async function addFilesToArchive(archive: archiver.Archiver, files: any[], type: string) {
  for (const file of files) {
    const result = file.processingResults?.[0];
    if (!result) continue;

    try {
      const baseFolder = `${file.originalName.replace(extname(file.originalName), '')}/`;

      // Add text files
      if (type === 'all' || type === 'text') {
        if (result.textOutputPath) {
          await addDirectoryToArchive(
            archive, 
            result.textOutputPath, 
            `${baseFolder}text/`
          );
        }
      }

      // Add PNG images
      if (type === 'all' || type === 'images') {
        if (result.pngOutputPath) {
          await addDirectoryToArchive(
            archive, 
            result.pngOutputPath, 
            `${baseFolder}images/`
          );
        }
      }

      // Add metadata file
      if (type === 'all') {
        const metadata = {
          originalFile: file.originalName,
          processedAt: result.createdAt,
          pngCount: result.pngCount,
          pageCount: result.pageCount,
          ocrConfidence: result.ocrConfidence,
          detectedLanguages: result.detectedLanguages,
          processingDuration: result.processingDuration,
          metadata: result.metadata,
        };

        archive.append(
          JSON.stringify(metadata, null, 2),
          { name: `${baseFolder}metadata.json` }
        );
      }

    } catch (error) {
      console.warn(`Failed to add files for ${file.originalName}:`, error);
    }
  }
}

async function addDirectoryToArchive(
  archive: archiver.Archiver, 
  sourcePath: string, 
  archivePath: string
) {
  try {
    // Check if directory exists
    await access(sourcePath);
    
    // Read directory contents
    const files = await readdir(sourcePath);
    
    for (const file of files) {
      const filePath = join(sourcePath, file);
      const stats = await stat(filePath);
      
      if (stats.isFile()) {
        archive.file(filePath, { name: archivePath + file });
      } else if (stats.isDirectory()) {
        // Recursively add subdirectories
        await addDirectoryToArchive(
          archive,
          filePath,
          archivePath + file + '/'
        );
      }
    }
  } catch (error) {
    console.warn(`Failed to add directory ${sourcePath}:`, error);
  }
}

async function createIndividualFileDownload(job: any, fileId: string, type: string) {
  try {
    // Find the specific file
    const file = job.files.find((f: any) => f.id === fileId);
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const result = file.processingResults?.[0];
    if (!result) {
      return NextResponse.json(
        { error: 'No processing results found for this file' },
        { status: 404 }
      );
    }

    // For individual file download, create a smaller zip with just this file's results
    return new Promise<NextResponse>((resolve, reject) => {
      try {
        const archive = archiver('zip', {
          zlib: { level: 9 }
        });

        const chunks: Buffer[] = [];
        
        archive.on('data', (chunk) => {
          chunks.push(chunk);
        });

        archive.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const filename = `${file.originalName.replace(/[^a-zA-Z0-9-_]/g, '_')}_results.zip`;
          
          resolve(new NextResponse(buffer, {
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Content-Length': buffer.length.toString(),
            },
          }));
        });

        archive.on('error', (error) => {
          console.error('Archive error:', error);
          reject(error);
        });

        // Add files to archive based on type
        addSingleFileToArchive(archive, file, result, type).then(() => {
          archive.finalize();
        }).catch(reject);

      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Individual file download failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function addSingleFileToArchive(
  archive: archiver.Archiver, 
  file: any, 
  result: any, 
  type: string
) {
  try {
    const baseFolder = `${file.originalName.replace(extname(file.originalName), '')}/`;

    // Add text files
    if (type === 'all' || type === 'text') {
      if (result.textOutputPath) {
        await addDirectoryToArchive(
          archive, 
          result.textOutputPath, 
          `${baseFolder}text/`
        );
      }
    }

    // Add PNG images
    if (type === 'all' || type === 'images') {
      if (result.pngOutputPath) {
        await addDirectoryToArchive(
          archive, 
          result.pngOutputPath, 
          `${baseFolder}images/`
        );
      }
    }

    // Add metadata file
    if (type === 'all') {
      const metadata = {
        originalFile: file.originalName,
        processedAt: result.createdAt,
        pngCount: result.pngCount,
        pageCount: result.pageCount,
        ocrConfidence: result.ocrConfidence,
        detectedLanguages: result.detectedLanguages,
        processingDuration: result.processingDuration,
        metadata: result.metadata,
      };

      archive.append(
        JSON.stringify(metadata, null, 2),
        { name: `${baseFolder}metadata.json` }
      );
    }
  } catch (error) {
    console.warn(`Failed to add files for ${file.originalName}:`, error);
  }
}