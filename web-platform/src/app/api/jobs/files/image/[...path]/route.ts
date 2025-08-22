import { NextRequest, NextResponse } from 'next/server';
import { readFile, access } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // No authentication required for image serving
    const resolvedParams = await params;
    
    // Reconstruct the file path from the URL segments
    const filePath = decodeURIComponent(resolvedParams.path.join('/'));
    
    // Security check: ensure the path is within allowed directories
    // This is a basic check - in production you'd want more robust validation
    if (!filePath.includes('ocr-temp') || filePath.includes('..')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if file exists
    await access(filePath);

    // Read the file
    const fileBuffer = await readFile(filePath);

    // Return the image with appropriate headers
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
        'Content-Length': fileBuffer.length.toString(),
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