import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { queueManager } from '@/lib/queue';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.id;

    // Get job from database
    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
      },
      include: {
        files: {
          include: {
            processingResults: true,
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

    // Get real-time queue status if job is in queue
    let queueStatus = null;
    if (job.status === 'QUEUED' || job.status === 'PROCESSING') {
      try {
        const queueJob = await queueManager.getJobStatus(jobId);
        if (queueJob) {
          queueStatus = {
            id: queueJob.id,
            progress: queueJob.progress || 0,
            processedOn: queueJob.processedOn,
            finishedOn: queueJob.finishedOn,
            failedReason: queueJob.failedReason,
            attemptsMade: queueJob.attemptsMade,
            data: queueJob.data,
          };
        }
      } catch (queueError) {
        console.warn('Failed to get queue status:', queueError);
      }
    }

    // Calculate detailed statistics
    const stats = calculateJobStats(job);

    // Estimate completion time
    const eta = calculateETA(job, stats);

    return NextResponse.json({
      id: job.id,
      name: job.name,
      description: job.description,
      status: job.status,
      priority: job.priority,
      progress: job.progress,
      totalFiles: job.totalFiles,
      processedFiles: job.processedFiles,
      successfulFiles: job.successfulFiles,
      failedFiles: job.failedFiles,
      configuration: job.configuration,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      
      // Enhanced statistics
      stats,
      eta,
      queueStatus,
      
      // File details with processing results
      files: job.files.map(file => ({
        id: file.id,
        originalName: file.originalName,
        fileName: file.fileName,
        fileSize: Number(file.fileSize),
        status: file.status,
        processingStartedAt: file.processingStartedAt,
        processingCompletedAt: file.processingCompletedAt,
        createdAt: file.createdAt,
        
        // Processing results
        result: file.processingResults?.[0] ? {
          pngCount: file.processingResults[0].pngCount,
          pageCount: file.processingResults[0].pageCount,
          ocrConfidence: file.processingResults[0].ocrConfidence,
          detectedLanguages: file.processingResults[0].detectedLanguages,
          processingDuration: file.processingResults[0].processingDuration,
          errorDetails: file.processingResults[0].errorDetails,
        } : null,
      })),
    });

  } catch (error) {
    console.error('Get job status error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}

function calculateJobStats(job: any) {
  const files = job.files || [];
  
  const stats = {
    totalSize: files.reduce((sum: number, file: any) => sum + Number(file.fileSize), 0),
    
    // File status counts
    pendingFiles: files.filter((f: any) => f.status === 'PENDING').length,
    processingFiles: files.filter((f: any) => f.status === 'PROCESSING').length,
    completedFiles: files.filter((f: any) => f.status === 'COMPLETED').length,
    failedFiles: files.filter((f: any) => f.status === 'FAILED').length,
    
    // Processing times
    processingTimes: [] as number[],
    avgProcessingTime: 0,
    totalProcessingTime: 0,
    
    // OCR confidence
    avgConfidence: 0,
    confidenceRange: { min: 0, max: 0 },
    
    // Languages detected
    detectedLanguages: [] as string[],
    languageDistribution: {} as Record<string, number>,
    
    // Pages and PNGs
    totalPages: 0,
    totalPngs: 0,
    avgPagesPerFile: 0,
  };

  // Calculate processing statistics
  const resultsWithTimes = files
    .map((f: any) => f.processingResults?.[0])
    .filter(Boolean);

  if (resultsWithTimes.length > 0) {
    stats.processingTimes = resultsWithTimes
      .map((r: any) => r.processingDuration)
      .filter(Boolean);
    
    stats.totalProcessingTime = stats.processingTimes.reduce((sum, time) => sum + time, 0);
    stats.avgProcessingTime = stats.totalProcessingTime / stats.processingTimes.length;

    // Confidence statistics
    const confidences = resultsWithTimes
      .map((r: any) => r.ocrConfidence)
      .filter((c: any) => c !== null && c !== undefined);
    
    if (confidences.length > 0) {
      stats.avgConfidence = confidences.reduce((sum: number, conf: number) => sum + conf, 0) / confidences.length;
      stats.confidenceRange.min = Math.min(...confidences);
      stats.confidenceRange.max = Math.max(...confidences);
    }

    // Language statistics
    const allLanguages = resultsWithTimes
      .flatMap((r: any) => (r.detectedLanguages || []) as string[])
      .filter((lang: any): lang is string => typeof lang === 'string');
    
    stats.detectedLanguages = Array.from(new Set(allLanguages));
    stats.languageDistribution = allLanguages.reduce((dist: any, lang: string) => {
      dist[lang] = (dist[lang] || 0) + 1;
      return dist;
    }, {});

    // Page and PNG statistics
    stats.totalPages = resultsWithTimes.reduce((sum: number, r: any) => sum + (r.pageCount || 0), 0);
    stats.totalPngs = resultsWithTimes.reduce((sum: number, r: any) => sum + (r.pngCount || 0), 0);
    stats.avgPagesPerFile = stats.totalPages / resultsWithTimes.length;
  }

  return stats;
}

function calculateETA(job: any, stats: any): string {
  if (job.status === 'COMPLETED' || job.status === 'FAILED') {
    return 'N/A';
  }

  if (!job.startedAt) {
    return 'Waiting to start';
  }

  const remainingFiles = job.totalFiles - job.processedFiles;
  
  if (remainingFiles <= 0) {
    return 'Finalizing...';
  }

  if (stats.avgProcessingTime > 0) {
    const etaMs = remainingFiles * stats.avgProcessingTime;
    const etaMinutes = Math.ceil(etaMs / 60000);
    
    if (etaMinutes < 1) return '< 1 min';
    if (etaMinutes < 60) return `${etaMinutes} min`;
    
    const hours = Math.floor(etaMinutes / 60);
    const minutes = etaMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  }

  // Fallback estimation based on elapsed time
  const elapsed = Date.now() - new Date(job.startedAt).getTime();
  const processedFiles = job.processedFiles;
  
  if (processedFiles > 0) {
    const avgTimePerFile = elapsed / processedFiles;
    const etaMs = remainingFiles * avgTimePerFile;
    const etaMinutes = Math.ceil(etaMs / 60000);
    
    if (etaMinutes < 1) return '< 1 min';
    if (etaMinutes < 60) return `${etaMinutes} min`;
    
    const hours = Math.floor(etaMinutes / 60);
    const minutes = etaMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  }

  return 'Calculating...';
}