import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    
    if (!resolvedParams.path || resolvedParams.path.length === 0) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Reconstruct the file path from the URL segments
    const pathSegments = resolvedParams.path;
    const filePath = pathSegments.join('/');
    const fullPath = join(process.cwd(), 'processed', filePath);
    
    // Security check: ensure the path is within the processed directory
    const processedDir = join(process.cwd(), 'processed');
    if (!fullPath.startsWith(processedDir) || filePath.includes('..')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if file exists and get stats
    const stats = await stat(fullPath);
    
    if (!stats.isFile()) {
      return NextResponse.json(
        { error: 'Not a file' },
        { status: 400 }
      );
    }

    // Read the file
    const fileBuffer = await readFile(fullPath);
    const ext = extname(fullPath).toLowerCase();
    
    // Determine content type
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.txt':
        contentType = 'text/plain; charset=utf-8';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
    }

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': stats.size.toString(),
      },
    });

  } catch (error) {
    console.error('Image serve error:', error);
    
    if (error instanceof Error && error.message.includes('ENOENT')) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to serve image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}