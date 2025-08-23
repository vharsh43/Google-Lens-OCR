import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { promises as fs } from 'fs'
import { join } from 'path'

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { table, confirm } = body
    
    // Safety check - require confirmation token
    if (confirm !== 'DELETE_TABLE_DATA') {
      return NextResponse.json(
        { error: 'Invalid confirmation token required for table cleanup' },
        { status: 400 }
      )
    }

    if (!table) {
      return NextResponse.json(
        { error: 'Table name is required' },
        { status: 400 }
      )
    }

    console.log(`🧹 Starting cleanup for table: ${table}`)

    let deletedCount = 0
    let message = ''

    switch (table) {
      case 'jobs':
        // Delete jobs will cascade to related records
        deletedCount = await prisma.job.count()
        await prisma.job.deleteMany({})
        message = `Deleted ${deletedCount} job records (with cascading deletes)`
        break

      case 'files':
        deletedCount = await prisma.file.count()
        await prisma.file.deleteMany({})
        message = `Deleted ${deletedCount} file records`
        break

      case 'processingResults':
        deletedCount = await prisma.processingResult.count()
        await prisma.processingResult.deleteMany({})
        message = `Deleted ${deletedCount} processing result records`
        break

      case 'jobStages':
        deletedCount = await prisma.jobStage.count()
        await prisma.jobStage.deleteMany({})
        message = `Deleted ${deletedCount} job stage records`
        break

      case 'processingLogs':
        deletedCount = await prisma.processingLog.count()
        await prisma.processingLog.deleteMany({})
        message = `Deleted ${deletedCount} processing log records`
        break

      case 'processedFiles':
        // Clean up processed files directory
        const processedDir = join(process.cwd(), 'processed')
        deletedCount = 0
        
        try {
          await fs.access(processedDir)
          const jobDirs = await fs.readdir(processedDir, { withFileTypes: true })
          
          for (const jobDir of jobDirs) {
            if (jobDir.isDirectory()) {
              const jobPath = join(processedDir, jobDir.name)
              try {
                await fs.rm(jobPath, { recursive: true, force: true })
                deletedCount++
                console.log(`🗑️ Removed job directory: ${jobDir.name}`)
              } catch (error) {
                console.warn(`⚠️ Failed to remove job directory ${jobDir.name}:`, error)
              }
            }
          }
          message = `Deleted ${deletedCount} processed file directories`
        } catch (error) {
          message = 'No processed files found to delete'
        }
        break

      case 'uploadFiles':
        // Clean up uploads directory
        const uploadsDir = join(process.cwd(), 'uploads')
        deletedCount = 0
        
        try {
          await fs.access(uploadsDir)
          const uploadFiles = await fs.readdir(uploadsDir)
          
          for (const file of uploadFiles) {
            const filePath = join(uploadsDir, file)
            try {
              const stat = await fs.stat(filePath)
              if (stat.isFile()) {
                await fs.unlink(filePath)
                deletedCount++
                console.log(`🗑️ Removed upload file: ${file}`)
              } else if (stat.isDirectory()) {
                await fs.rm(filePath, { recursive: true, force: true })
                deletedCount++
                console.log(`🗑️ Removed upload directory: ${file}`)
              }
            } catch (error) {
              console.warn(`⚠️ Failed to remove upload item ${file}:`, error)
            }
          }
          message = `Deleted ${deletedCount} upload files`
        } catch (error) {
          message = 'No upload files found to delete'
        }
        break

      default:
        return NextResponse.json(
          { error: `Unknown table: ${table}` },
          { status: 400 }
        )
    }

    console.log(`✅ ${table} cleanup completed: ${message}`)

    return NextResponse.json({
      success: true,
      message,
      deletedCount,
      table,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Table cleanup failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Table cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}