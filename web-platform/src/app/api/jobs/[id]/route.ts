import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.id;

    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
      },
      include: {
        files: {
          include: {
            processingResults: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Calculate progress and statistics
    const stats = {
      totalSize: job.files.reduce((sum, file) => sum + Number(file.fileSize), 0),
      completedFiles: job.files.filter(f => f.status === 'COMPLETED').length,
      failedFiles: job.files.filter(f => f.status === 'FAILED').length,
      processingFiles: job.files.filter(f => f.status === 'PROCESSING').length,
      pendingFiles: job.files.filter(f => f.status === 'PENDING').length,
    };

    const processingTimes = job.files
      .map(f => f.processingResults?.processingDuration)
      .filter((time): time is number => typeof time === 'number');
    
    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : null;

    // Convert BigInt values to strings for JSON serialization
    const serializedJob = {
      ...job,
      files: job.files.map(file => ({
        ...file,
        fileSize: file.fileSize.toString(), // Convert BigInt to string
      })),
      stats,
      avgProcessingTime,
    };

    return NextResponse.json(serializedJob);

  } catch (error) {
    console.error('Get job error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch job' },
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

    // Don't allow deletion of processing jobs
    if (job.status === 'PROCESSING' || job.status === 'QUEUED') {
      return NextResponse.json(
        { error: 'Cannot delete job that is currently processing' },
        { status: 400 }
      );
    }

    // Delete job and related files (cascade delete)
    await prisma.job.delete({
      where: { id: jobId },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete job error:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.id;
    const { name, description, priority } = await request.json();

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

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
    });

    return NextResponse.json(updatedJob);

  } catch (error) {
    console.error('Update job error:', error);
    
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    );
  }
}