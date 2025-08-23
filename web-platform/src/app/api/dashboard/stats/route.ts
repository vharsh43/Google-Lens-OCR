import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get job statistics from the database
    const [
      totalJobs,
      processingJobs,
      completedJobs,
      failedJobs,
      queuedJobs,
      fileStats
    ] = await Promise.all([
      // Total jobs count
      prisma.job.count(),
      
      // Processing jobs count
      prisma.job.count({
        where: { status: 'PROCESSING' }
      }),
      
      // Completed jobs count  
      prisma.job.count({
        where: { status: 'COMPLETED' }
      }),
      
      // Failed jobs count
      prisma.job.count({
        where: { status: 'FAILED' }
      }),
      
      // Queued jobs count
      prisma.job.count({
        where: { status: 'QUEUED' }
      }),
      
      // File statistics
      prisma.job.aggregate({
        _sum: {
          totalFiles: true,
          processedFiles: true,
          successfulFiles: true,
          failedFiles: true
        }
      })
    ]);

    // Calculate derived statistics
    const totalFiles = fileStats._sum.totalFiles || 0;
    const successfulFiles = fileStats._sum.successfulFiles || 0;
    const successRate = totalFiles > 0 ? Math.round((successfulFiles / totalFiles) * 100) : 0;

    // Get recent processing activity (last 24 hours)
    const recentActivity = await prisma.job.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      select: {
        status: true,
        progress: true,
        totalFiles: true,
        processedFiles: true
      }
    });

    // Calculate processing velocity (files per hour in last 24h)
    const recentProcessedFiles = recentActivity.reduce(
      (sum, job) => sum + (job.processedFiles || 0), 
      0
    );
    const processingVelocity = Math.round(recentProcessedFiles / 24);

    const stats = {
      totalJobs,
      processingJobs: processingJobs + queuedJobs, // Include queued as "processing"
      completedJobs,
      failedJobs,
      totalFiles,
      processedFiles: fileStats._sum.processedFiles || 0,
      successfulFiles: fileStats._sum.successfulFiles || 0,
      failedFilesCount: fileStats._sum.failedFiles || 0,
      successRate,
      processingVelocity,
      
      // Additional metrics for dashboard
      queuedJobs,
      averageProgress: recentActivity.length > 0 
        ? Math.round(recentActivity.reduce((sum, job) => sum + (job.progress || 0), 0) / recentActivity.length)
        : 0,
      
      // Status distribution
      statusDistribution: {
        processing: processingJobs,
        queued: queuedJobs,
        completed: completedJobs,
        failed: failedJobs,
        pending: totalJobs - (processingJobs + queuedJobs + completedJobs + failedJobs)
      }
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Dashboard stats error:', error);
    
    // Return default stats on error so dashboard still works
    return NextResponse.json({
      totalJobs: 0,
      processingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      totalFiles: 0,
      processedFiles: 0,
      successfulFiles: 0,
      failedFilesCount: 0,
      successRate: 0,
      processingVelocity: 0,
      queuedJobs: 0,
      averageProgress: 0,
      statusDistribution: {
        processing: 0,
        queued: 0,
        completed: 0,
        failed: 0,
        pending: 0
      }
    });
  }
}