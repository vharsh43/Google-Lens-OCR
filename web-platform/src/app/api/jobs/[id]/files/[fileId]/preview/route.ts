import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
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
    const limit = parseInt(searchParams.get('limit') || '10'); // Limit preview items
    const offset = parseInt(searchParams.get('offset') || '0'); // Offset for pagination
    
    console.log(`📄 Preview API called - JobId: ${jobId}, FileId: ${fileId}, Type: ${type}, Limit: ${limit}, Offset: ${offset}`);

    if (type === 'text') {
      return await getTextPreview(jobId, fileId, limit, offset);
    } else if (type === 'images') {
      return await getImagePreview(jobId, fileId, limit, offset);
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

async function getTextPreview(jobId: string, fileId: string, limit: number, offset: number = 0) {
  try {
    const textDir = join(process.cwd(), 'processed', jobId, fileId, 'text');
    
    try {
      await stat(textDir);
    } catch {
      // No text files exist yet
      return NextResponse.json({ 
        content: [],
        totalFiles: 0,
        previewedFiles: 0,
        message: "No processed text files available yet"
      });
    }

    // Get text files from the directory
    const files = await readdir(textDir);
    const allTextFiles = files.filter(f => extname(f).toLowerCase() === '.txt').sort();
    const textFiles = allTextFiles.slice(offset, offset + limit);
    
    if (textFiles.length === 0) {
      return NextResponse.json({ 
        content: [],
        totalFiles: 0,
        previewedFiles: 0,
        message: "No text files found"
      });
    }

    const content: string[] = [];
    
    for (const file of textFiles) {
      try {
        const filePath = join(textDir, file);
        const textContent = await readFile(filePath, 'utf-8');
        content.push(`📄 ${file}\n\n${textContent}`);
      } catch (error) {
        console.error(`Error reading ${file}:`, error);
        content.push(`📄 ${file}\n\n⚠️ Error reading file content`);
      }
    }
    
    return NextResponse.json({ 
      content,
      totalFiles: allTextFiles.length,
      previewedFiles: content.length,
      currentPage: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(allTextFiles.length / limit),
      hasNextPage: offset + limit < allTextFiles.length,
      hasPrevPage: offset > 0
    });

  } catch (error) {
    console.error('Text preview error:', error);
    return NextResponse.json(
      { error: 'Failed to load text preview', content: [], totalFiles: 0, previewedFiles: 0, currentPage: 1, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      { status: 500 }
    );
  }
}

async function getImagePreview(jobId: string, fileId: string, limit: number, offset: number = 0) {
  try {
    const pngsDir = join(process.cwd(), 'processed', jobId, fileId, 'pngs');
    
    try {
      await stat(pngsDir);
    } catch {
      // No PNG files exist yet
      return NextResponse.json({ 
        urls: [],
        totalFiles: 0,
        previewedFiles: 0,
        message: "No processed images available yet"
      });
    }

    // Get image files from the directory
    const files = await readdir(pngsDir);
    const allImageFiles = files
      .filter(f => {
        const ext = extname(f).toLowerCase();
        return ['.png', '.jpg', '.jpeg'].includes(ext);
      })
      .sort(); // Sort to maintain page order
    const imageFiles = allImageFiles.slice(offset, offset + limit);
    
    if (imageFiles.length === 0) {
      return NextResponse.json({ 
        urls: [],
        totalFiles: 0,
        previewedFiles: 0,
        message: "No image files found"
      });
    }

    // Generate URLs for the actual images
    const urls = imageFiles.map(file => {
      // Create URL that points to our file serving endpoint
      const encodedPath = encodeURIComponent(`${jobId}/${fileId}/pngs/${file}`);
      return `/api/jobs/files/image/${encodedPath}`;
    });
    
    return NextResponse.json({ 
      urls,
      totalFiles: allImageFiles.length,
      previewedFiles: urls.length,
      currentPage: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(allImageFiles.length / limit),
      hasNextPage: offset + limit < allImageFiles.length,
      hasPrevPage: offset > 0
    });

  } catch (error) {
    console.error('Image preview error:', error);
    return NextResponse.json(
      { error: 'Failed to load image preview', urls: [], totalFiles: 0, previewedFiles: 0, currentPage: 1, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      { status: 500 }
    );
  }
}
