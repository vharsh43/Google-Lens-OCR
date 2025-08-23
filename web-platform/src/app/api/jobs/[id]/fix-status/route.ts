import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { promises as fs } from 'fs'
import { join } from 'path'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const jobId = resolvedParams.id

    console.log(`🔧 Attempting to fix job status for: ${jobId}`)

    // Get the current job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { files: true }
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    console.log(`📋 Current job status: ${job.status}, files: ${job.files.length}`)

    // Check if processed files exist
    const processedPath = join(process.cwd(), 'processed', jobId)
    
    try {
      await fs.access(processedPath)
      
      // Count processed files by scanning directories
      const jobDirs = await fs.readdir(processedPath, { withFileTypes: true })
      
      let totalProcessedFiles = 0
      let successfulFiles = 0
      let totalTextFiles = 0
      let totalPngFiles = 0

      for (const jobDir of jobDirs) {
        if (jobDir.isDirectory()) {
          const fileJobPath = join(processedPath, jobDir.name)
          
          // Check for text directory
          try {
            const textPath = join(fileJobPath, 'text')
            await fs.access(textPath)
            const textFiles = await fs.readdir(textPath)
            totalTextFiles += textFiles.filter(f => f.endsWith('.txt')).length
          } catch (error) {
            // No text directory
          }
          
          // Check for pngs directory  
          try {
            const pngsPath = join(fileJobPath, 'pngs')
            await fs.access(pngsPath)
            const pngFiles = await fs.readdir(pngsPath)
            totalPngFiles += pngFiles.filter(f => f.endsWith('.png')).length
          } catch (error) {
            // No pngs directory
          }
          
          totalProcessedFiles++
          if (totalTextFiles > 0 || totalPngFiles > 0) {
            successfulFiles++
          }
        }
      }

      console.log(`📊 Found: ${totalProcessedFiles} processed files, ${successfulFiles} successful, ${totalTextFiles} text files, ${totalPngFiles} png files`)

      // Update job status based on what we found
      let newStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
      let progress = 0

      if (successfulFiles > 0 && totalProcessedFiles >= job.totalFiles) {
        newStatus = 'COMPLETED'
        progress = 100
      } else if (successfulFiles > 0) {
        newStatus = 'PROCESSING'
        progress = Math.round((successfulFiles / job.totalFiles) * 100)
      } else {
        newStatus = 'FAILED'
        progress = 0
      }

      // Update the job in the database
      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          status: newStatus,
          progress: progress,
          processedFiles: totalProcessedFiles,
          successfulFiles: successfulFiles,
          failedFiles: Math.max(0, job.totalFiles - successfulFiles),
          ...(newStatus === 'COMPLETED' && {
            completedAt: new Date()
          })
        },
        include: { files: true }
      })

      console.log(`✅ Job status updated: ${job.status} → ${newStatus} (${progress}%)`)

      return NextResponse.json({
        success: true,
        message: `Job status fixed: ${job.status} → ${newStatus}`,
        job: {
          id: updatedJob.id,
          status: updatedJob.status,
          progress: updatedJob.progress,
          processedFiles: updatedJob.processedFiles,
          successfulFiles: updatedJob.successfulFiles,
          failedFiles: updatedJob.failedFiles,
          totalFiles: updatedJob.totalFiles
        },
        processingResults: {
          totalTextFiles,
          totalPngFiles,
          processedDirectories: totalProcessedFiles
        }
      })

    } catch (error) {
      console.log(`❌ No processed files found for job ${jobId}`)
      return NextResponse.json(
        { 
          error: 'No processed files found for this job',
          jobStatus: job.status
        },
        { status: 404 }
      )
    }

  } catch (error) {
    console.error('Fix status error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fix job status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}