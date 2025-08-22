import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { queueManager } from '@/lib/queue';
import { JobStatus } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.id;
  
  try {
    // Get job with files
    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
      },
      include: {
        files: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if job is in a valid state to start processing
    if (job.status !== JobStatus.READY && job.status !== JobStatus.FAILED) {
      return NextResponse.json(
        { 
          error: 'Job cannot be processed',
          details: `Job is in ${job.status} state. Only READY or FAILED jobs can be processed.`
        },
        { status: 400 }
      );
    }

    if (job.files.length === 0) {
      return NextResponse.json(
        { error: 'No files to process' },
        { status: 400 }
      );
    }

    // Parse optional configuration from request body
    const body = await request.json().catch(() => ({}));
    const configuration = {
      dpi: 300, // Fixed DPI setting
      retryAttempts: 3,
      timeout: 45000,
      ...body.configuration,
    };

    // Update job status to queued
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.QUEUED,
        configuration,
        errorMessage: null, // Clear any previous error
      },
    });

    // Add job to processing queue
    const queueJob = await queueManager.addJob({
      jobId: job.id,
      files: job.files.map(file => ({
        id: file.id,
        originalName: file.originalName,
        filePath: file.filePath,
        fileSize: Number(file.fileSize),
      })),
      configuration,
    });

    // Log processing start
    console.log(`Processing started for job ${jobId}: ${job.files.length} files, queue job ID: ${queueJob.id}`);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      queueJobId: queueJob.id,
      status: JobStatus.QUEUED,
      message: 'Job added to processing queue',
      estimatedWaitTime: await getEstimatedWaitTime(),
    });

  } catch (error) {
    console.error('Start processing error:', error);
    
    // Revert job status if queue addition failed
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.READY,
          errorMessage: `Failed to start processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });
    } catch (revertError) {
      console.error('Failed to revert job status:', revertError);
    }

    return NextResponse.json(
      { 
        error: 'Failed to start processing',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.id;

    // Get job
    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if job can be cancelled
    if (job.status !== JobStatus.QUEUED && job.status !== JobStatus.PROCESSING) {
      return NextResponse.json(
        { 
          error: 'Job cannot be cancelled',
          details: `Job is in ${job.status} state. Only QUEUED or PROCESSING jobs can be cancelled.`
        },
        { status: 400 }
      );
    }

    // Try to cancel in queue
    const cancelled = await queueManager.cancelJob(jobId);

    if (cancelled) {
      // Log cancellation
      console.log(`Job ${jobId} cancelled successfully, previous status: ${job.status}`);

      return NextResponse.json({
        success: true,
        message: 'Job cancelled successfully',
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to cancel job. It may have already started processing.' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Cancel job error:', error);
    
    return NextResponse.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    );
  }
}

async function getEstimatedWaitTime(): Promise<string> {
  try {
    const queueStats = await queueManager.getQueueStats();
    
    // Simple estimation: assume 2 minutes per job in queue
    const estimatedMinutes = queueStats.waiting * 2;
    
    if (estimatedMinutes < 1) return 'Starting immediately';
    if (estimatedMinutes < 60) return `~${estimatedMinutes} minutes`;
    
    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;
    
    return `~${hours}h ${minutes}m`;
  } catch (error) {
    return 'Calculating...';
  }
}