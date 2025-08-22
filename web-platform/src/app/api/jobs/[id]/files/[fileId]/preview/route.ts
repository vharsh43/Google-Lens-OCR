import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.id;
    const fileId = resolvedParams.fileId;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'text'; // text, images
    const limit = parseInt(searchParams.get('limit') || '5'); // Limit preview items

    // Get job and file with processing results
    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
      },
      include: {
        files: {
          where: {
            id: fileId,
            status: 'COMPLETED',
          },
          include: {
            processingResults: true,
          },
        },
      },
    });

    if (!job || job.files.length === 0) {
      return NextResponse.json(
        { error: 'File not found or not completed' },
        { status: 404 }
      );
    }

    const file = job.files[0];
    const result = file.processingResults?.[0];

    if (!result) {
      return NextResponse.json(
        { error: 'No processing results found' },
        { status: 404 }
      );
    }

    if (type === 'text') {
      return await getTextPreview(result.textOutputPath, limit);
    } else if (type === 'images') {
      return await getImagePreview(result.pngOutputPath, limit);
    } else {
      return NextResponse.json(
        { error: 'Invalid preview type. Use "text" or "images"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Preview error:', error);
    
    return NextResponse.json(
      { 
        error: 'Preview failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function getTextPreview(textOutputPath: string | null, limit: number) {
  try {
    if (!textOutputPath) {
      return NextResponse.json({ content: [] });
    }

    // Read text files from the output directory
    const files = await readdir(textOutputPath);
    const textFiles = files
      .filter(f => f.toLowerCase().endsWith('.txt'))
      .sort()
      .slice(0, limit);

    const content: string[] = [];

    for (const textFile of textFiles) {
      try {
        const filePath = join(textOutputPath, textFile);
        const fileContent = await readFile(filePath, 'utf-8');
        
        // Limit content length to prevent large responses
        const truncatedContent = fileContent.length > 2000 
          ? fileContent.substring(0, 2000) + '...\n\n[Content truncated - download full file to see complete text]'
          : fileContent;
        
        content.push(truncatedContent);
      } catch (error) {
        console.warn(`Failed to read text file ${textFile}:`, error);
        content.push(`[Error reading file: ${textFile}]`);
      }
    }

    return NextResponse.json({ 
      content,
      totalFiles: files.filter(f => f.toLowerCase().endsWith('.txt')).length,
      previewedFiles: textFiles.length
    });

  } catch (error) {
    console.error('Text preview error:', error);
    return NextResponse.json({ 
      error: 'Failed to load text preview',
      content: [] 
    });
  }
}

async function getImagePreview(pngOutputPath: string | null, limit: number) {
  try {
    if (!pngOutputPath) {
      return NextResponse.json({ urls: [] });
    }

    // Read PNG files from the output directory
    const files = await readdir(pngOutputPath);
    const imageFiles = files
      .filter(f => f.toLowerCase().endsWith('.png'))
      .sort()
      .slice(0, limit);

    // For now, we'll return file paths that can be served statically
    // In a production environment, you'd want to serve these through a secure endpoint
    // or upload them to a CDN/cloud storage with signed URLs
    
    const urls = imageFiles.map(file => {
      // Create a secure URL pattern for serving the images
      // This would need to be implemented as a separate API endpoint
      return `/api/jobs/files/image/${encodeURIComponent(join(pngOutputPath, file))}`;
    });

    return NextResponse.json({ 
      urls,
      totalFiles: files.filter(f => f.toLowerCase().endsWith('.png')).length,
      previewedFiles: imageFiles.length
    });

  } catch (error) {
    console.error('Image preview error:', error);
    return NextResponse.json({ 
      error: 'Failed to load image preview',
      urls: [] 
    });
  }
}