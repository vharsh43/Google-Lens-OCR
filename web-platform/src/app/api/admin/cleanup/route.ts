import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { promises as fs } from 'fs'
import { join } from 'path'

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const confirmToken = searchParams.get('confirm')
    
    // Safety check - require confirmation token
    if (confirmToken !== 'DELETE_ALL_DATA') {
      return NextResponse.json(
        { error: 'Invalid confirmation token required for data cleanup' },
        { status: 400 }
      )
    }

    console.log('🧹 Starting database cleanup...')

    // Get count of records before deletion
    const beforeCounts = {
      jobs: await prisma.job.count(),
      files: await prisma.file.count(),
      processingResults: await prisma.processingResult.count(),
      jobStages: await prisma.jobStage.count(),
      processingLogs: await prisma.processingLog.count()
    }

    console.log('📊 Records before cleanup:', beforeCounts)

    // Delete in correct order to avoid foreign key constraints
    console.log('🗑️ Deleting processing logs...')
    await prisma.processingLog.deleteMany({})

    console.log('🗑️ Deleting processing results...')
    await prisma.processingResult.deleteMany({})

    console.log('🗑️ Deleting job stages...')
    await prisma.jobStage.deleteMany({})

    console.log('🗑️ Deleting files...')
    await prisma.file.deleteMany({})

    console.log('🗑️ Deleting jobs...')
    await prisma.job.deleteMany({})

    // Clean up processed files directory
    const processedDir = join(process.cwd(), 'processed')
    console.log('🗑️ Cleaning processed files directory...')
    
    try {
      // Check if processed directory exists
      await fs.access(processedDir)
      
      // Read all job directories
      const jobDirs = await fs.readdir(processedDir, { withFileTypes: true })
      
      for (const jobDir of jobDirs) {
        if (jobDir.isDirectory()) {
          const jobPath = join(processedDir, jobDir.name)
          try {
            await fs.rm(jobPath, { recursive: true, force: true })
            console.log(`🗑️ Removed job directory: ${jobDir.name}`)
          } catch (error) {
            console.warn(`⚠️ Failed to remove job directory ${jobDir.name}:`, error)
          }
        }
      }
    } catch (error) {
      console.log('ℹ️ Processed directory does not exist or is empty')
    }

    // Clean up uploads directory
    const uploadsDir = join(process.cwd(), 'uploads')
    console.log('🗑️ Cleaning uploads directory...')
    
    try {
      await fs.access(uploadsDir)
      const uploadFiles = await fs.readdir(uploadsDir)
      
      for (const file of uploadFiles) {
        const filePath = join(uploadsDir, file)
        try {
          const stat = await fs.stat(filePath)
          if (stat.isFile()) {
            await fs.unlink(filePath)
            console.log(`🗑️ Removed upload file: ${file}`)
          } else if (stat.isDirectory()) {
            await fs.rm(filePath, { recursive: true, force: true })
            console.log(`🗑️ Removed upload directory: ${file}`)
          }
        } catch (error) {
          console.warn(`⚠️ Failed to remove upload item ${file}:`, error)
        }
      }
    } catch (error) {
      console.log('ℹ️ Uploads directory does not exist or is empty')
    }

    const afterCounts = {
      jobs: await prisma.job.count(),
      files: await prisma.file.count(),
      processingResults: await prisma.processingResult.count(),
      jobStages: await prisma.jobStage.count(),
      processingLogs: await prisma.processingLog.count()
    }

    console.log('✅ Database cleanup completed successfully')
    console.log('📊 Records after cleanup:', afterCounts)

    return NextResponse.json({
      success: true,
      message: 'Database and file system cleanup completed successfully',
      deletedCounts: beforeCounts,
      remainingCounts: afterCounts,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Database cleanup failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Database cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get current database statistics
    const stats = {
      jobs: await prisma.job.count(),
      files: await prisma.file.count(),
      processingResults: await prisma.processingResult.count(),
      jobStages: await prisma.jobStage.count(),
      processingLogs: await prisma.processingLog.count()
    }

    // Get file system statistics
    let processedFilesCount = 0
    let uploadFilesCount = 0

    try {
      const processedDir = join(process.cwd(), 'processed')
      const jobDirs = await fs.readdir(processedDir, { withFileTypes: true })
      processedFilesCount = jobDirs.filter(dir => dir.isDirectory()).length
    } catch (error) {
      // Directory doesn't exist
    }

    try {
      const uploadsDir = join(process.cwd(), 'uploads')
      const uploadFiles = await fs.readdir(uploadsDir)
      uploadFilesCount = uploadFiles.length
    } catch (error) {
      // Directory doesn't exist
    }

    return NextResponse.json({
      database: stats,
      files: {
        processedJobDirectories: processedFilesCount,
        uploadFiles: uploadFilesCount
      },
      totalRecords: Object.values(stats).reduce((sum, count) => sum + count, 0) + processedFilesCount + uploadFilesCount
    })

  } catch (error) {
    console.error('❌ Failed to get cleanup statistics:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve cleanup statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}