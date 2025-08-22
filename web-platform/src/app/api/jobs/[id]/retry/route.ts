import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { queueManager } from '@/lib/queue';
import { JobStatus } from '@prisma/client';

export async function POST(
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

    // Check if job is in a valid state to retry
    if (job.status !== JobStatus.FAILED && job.status !== JobStatus.CANCELLED) {
      return NextResponse.json(
        { 
          error: 'Job cannot be retried',
          details: `Job is in ${job.status} state. Only FAILED or CANCELLED jobs can be retried.`
        },
        { status: 400 }
      );
    }

    if (job.files.length === 0) {
      return NextResponse.json(
        { error: 'No files to retry' },
        { status: 400 }
      );
    }

    // Use the enhanced queue manager retry functionality
    const queueJob = await queueManager.retryJob(jobId);

    // Update job status to queued
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.QUEUED,
      },
    });

    // Log retry
    console.log(`Job ${jobId} retried successfully: previous status ${job.status}, queue job ID: ${queueJob.id}`);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      queueJobId: queueJob.id,
      status: JobStatus.QUEUED,
      message: 'Job added to retry queue',
      estimatedWaitTime: await getEstimatedWaitTime(),
    });

  } catch (error) {
    console.error('Retry job error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retry job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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