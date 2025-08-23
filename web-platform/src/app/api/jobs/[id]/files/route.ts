import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join, relative, basename, extname, dirname } from 'path'
import { prisma } from '@/lib/prisma'

interface FileNode {
  id: string
  name: string
  type: 'file' | 'directory'
  path: string
  fileId?: string // Directory ID for preview API
  size?: number
  mimeType?: string
  createdAt: Date
  modifiedAt: Date
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  children?: FileNode[]
  isExpanded?: boolean
  metadata?: {
    pageCount?: number
    ocrConfidence?: number
    language?: string
    processingDuration?: number
    isTemporary?: boolean
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const jobId = resolvedParams.id

    // Get job info
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true }
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' }, 
        { status: 404 }
      )
    }

    // Build path to processed files
    const processedBasePath = join(process.cwd(), 'processed', jobId)
    
    try {
      await fs.access(processedBasePath)
    } catch {
      // If processed directory doesn't exist, return empty tree
      return NextResponse.json({
        tree: [],
        totalFiles: 0,
        message: 'No processed files found yet'
      })
    }

    // Scan the directory structure
    const tree = await buildFileTree(processedBasePath, jobId)
    const totalFiles = countFiles(tree)

    return NextResponse.json({
      tree,
      totalFiles,
      processedPath: processedBasePath,
      jobStatus: job.status
    })

  } catch (error) {
    console.error('Error fetching job files:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job files' },
      { status: 500 }
    )
  }
}

async function buildFileTree(dirPath: string, jobId: string, parentFileId?: string): Promise<FileNode[]> {
  const tree: FileNode[] = []
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      const relativePath = relative(join(process.cwd(), 'processed', jobId), fullPath)
      const stats = await fs.stat(fullPath)
      
      // For files, use the parent directory's fileId; for directories, use their own name as fileId
      let fileId: string
      if (entry.isDirectory()) {
        // If this is a top-level directory (direct child of jobId), it's a fileId
        const pathParts = relativePath.split(/[\/\\]/)
        fileId = pathParts.length === 1 ? entry.name : (parentFileId || entry.name)
      } else {
        // For files, use the parent fileId
        fileId = parentFileId || 'unknown'
      }
      
      const node: FileNode = {
        id: relativePath.replace(/[\/\\]/g, '_') || entry.name,
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: relativePath,
        fileId: fileId, // Add fileId for preview
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isExpanded: false
      }

      if (entry.isDirectory()) {
        // Recursively build children for directories
        node.children = await buildFileTree(fullPath, jobId, fileId)
        node.isExpanded = node.name === 'pngs' || node.name === 'text' // Auto-expand common dirs
      } else {
        // File-specific properties
        node.size = stats.size
        node.mimeType = getMimeType(entry.name)
        node.status = getFileStatus(entry.name, node.mimeType)
        
        // Add metadata based on file type
        if (node.mimeType?.startsWith('image/')) {
          node.metadata = {
            isTemporary: false
          }
        } else if (node.mimeType === 'text/plain') {
          node.metadata = {
            language: 'English', // Could be detected from content
            isTemporary: false,
ocrConfidence: null
          }
        }
      }

      tree.push(node)
    }

    // Sort: directories first, then files, alphabetically
    tree.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

  } catch (error) {
    console.error('Error reading directory:', dirPath, error)
  }

  return tree
}

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  const mimeTypes: { [key: string]: string } = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.txt': 'text/plain',
    '.json': 'application/json'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

function getFileStatus(filename: string, mimeType?: string): 'pending' | 'processing' | 'completed' | 'failed' {
  // Logic to determine file status based on filename patterns or file age
  if (filename.includes('_error') || filename.includes('failed')) {
    return 'failed'
  }
  
  // If file exists and is readable, assume completed
  // In a real implementation, you might check processing logs or database status
  return 'completed'
}

function countFiles(tree: FileNode[]): number {
  let count = 0
  for (const node of tree) {
    if (node.type === 'file') {
      count++
    } else if (node.children) {
      count += countFiles(node.children)
    }
  }
  return count
}