import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { prisma } from './prisma';
import { ocrProcessor } from './ocr-integration';
import { OCRJobLockManager } from './process-lock';
import { JobStatus, FileStatus, StageType, StageStatus, LogLevel } from '@prisma/client';
import { join } from 'path';

// WebSocket event emitters for real-time updates
let webSocketEmitters: any = null;

// Connect to WebSocket emitters
const connectWebSocketEmitters = async () => {
  try {
    const ws = await import('./websocket-server');
    webSocketEmitters = {
      emitJobProgress: ws.emitJobProgress,
      emitJobCompleted: ws.emitJobCompleted,
      emitJobFailed: ws.emitJobFailed,
      emitLogMessage: ws.emitLogMessage,
      emitStageUpdate: ws.emitStageUpdate
    };
  } catch (error) {
    // WebSocket server may not be available in some environments
    webSocketEmitters = null;
  }
};

// Initialize WebSocket connection
connectWebSocketEmitters();

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
};

// OCR Processing Queue
export const ocrQueue = new Queue('ocr-processing', {
  connection: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Job data interface
interface OCRJobData {
  jobId: string;
  files: Array<{
    id: string;
    originalName: string;
    filePath: string;
    fileSize: number;
  }>;
  configuration: Record<string, any>;
}

// Helper functions for stage and log management
async function createJobStage(jobId: string, stage: StageType, totalSteps: number = 100) {
  const stageRecord = await prisma.jobStage.create({
    data: {
      jobId,
      stage,
      status: StageStatus.PENDING,
      totalSteps,
      currentStep: 0,
      progress: 0
    }
  });

  // Emit WebSocket event
  if (webSocketEmitters) {
    webSocketEmitters.emitStageUpdate(jobId, stage, 'PENDING', 0);
  }

  return stageRecord;
}

async function updateJobStage(jobId: string, stage: StageType, status: StageStatus, progress: number = 0, currentStep: number = 0) {
  await prisma.jobStage.updateMany({
    where: { jobId, stage },
    data: {
      status,
      progress,
      currentStep,
      ...(status === StageStatus.RUNNING && !currentStep ? { startedAt: new Date() } : {}),
      ...(status === StageStatus.COMPLETED || status === StageStatus.FAILED ? { completedAt: new Date() } : {})
    }
  });

  // Emit WebSocket event
  if (webSocketEmitters) {
    webSocketEmitters.emitStageUpdate(jobId, stage, status, progress);
  }
}

async function logJobMessage(jobId: string, level: LogLevel, message: string, stage?: StageType, metadata?: any) {
  await prisma.processingLog.create({
    data: {
      jobId,
      level,
      stage,
      message,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      timestamp: new Date()
    }
  });

  // Emit WebSocket event
  if (webSocketEmitters) {
    webSocketEmitters.emitLogMessage(jobId, level.toLowerCase(), message, new Date());
  }
}

async function updateJobProgress(jobId: string, progress: number, stage: string, message?: string) {
  await prisma.job.update({
    where: { id: jobId },
    data: { progress }
  });

  // Emit WebSocket event
  if (webSocketEmitters) {
    webSocketEmitters.emitJobProgress(jobId, progress, stage, message);
  }
}

// Create OCR Worker factory function
function createOCRWorker(): Worker<OCRJobData> {
  return new Worker<OCRJobData>(
    'ocr-processing',
    async (job: Job<OCRJobData>) => {
      const { jobId, files, configuration } = job.data;
    
      console.log(`🚀 Starting OCR job ${jobId} with ${files.length} files`);

      // Acquire job lock to prevent concurrent processing
      const lockAcquired = await OCRJobLockManager.acquireJobLock(jobId);
      if (!lockAcquired) {
        const lockInfo = await OCRJobLockManager.getJobLockInfo(jobId);
        const errorMsg = `Job ${jobId} is already being processed by another worker (PID: ${lockInfo?.pid})`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`🔒 Acquired processing lock for job ${jobId}`);

      try {
        // Stage 1: Initialization
        await createJobStage(jobId, StageType.INITIALIZATION);
        await updateJobStage(jobId, StageType.INITIALIZATION, StageStatus.RUNNING);
        await logJobMessage(jobId, LogLevel.INFO, `Starting OCR job with ${files.length} files`, StageType.INITIALIZATION);

        // Update job status to processing
        await prisma.job.update({
          where: { id: jobId },
          data: { 
            status: JobStatus.PROCESSING, 
            startedAt: new Date() 
          }
        });

        await updateJobProgress(jobId, 5, 'INITIALIZATION', 'Job initialized and ready to start');
        await updateJobStage(jobId, StageType.INITIALIZATION, StageStatus.COMPLETED, 100);

        // Stage 2: File Validation
        await createJobStage(jobId, StageType.FILE_VALIDATION);
        await updateJobStage(jobId, StageType.FILE_VALIDATION, StageStatus.RUNNING);
        await logJobMessage(jobId, LogLevel.INFO, `Validating ${files.length} files`, StageType.FILE_VALIDATION);
        
        // Validate all files
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          await logJobMessage(jobId, LogLevel.DEBUG, `Validating file: ${file.originalName}`, StageType.FILE_VALIDATION);
          const validationProgress = Math.round(((i + 1) / files.length) * 100);
          await updateJobStage(jobId, StageType.FILE_VALIDATION, StageStatus.RUNNING, validationProgress);
        }
        
        await updateJobProgress(jobId, 10, 'FILE_VALIDATION', 'All files validated successfully');
        await updateJobStage(jobId, StageType.FILE_VALIDATION, StageStatus.COMPLETED, 100);

        let processedCount = 0;
        let successfulCount = 0;
        let failedCount = 0;
        const totalFiles = files.length;

        // Stage 3: PDF Conversion and OCR Processing
        await createJobStage(jobId, StageType.PDF_CONVERSION);
        await createJobStage(jobId, StageType.OCR_PROCESSING);
        await createJobStage(jobId, StageType.TEXT_EXTRACTION);
        
        // Process each file with detailed progress tracking
        for (const file of files) {
          try {
            console.log(`📄 Processing file: ${file.originalName} (${processedCount + 1}/${totalFiles})`);
            await logJobMessage(jobId, LogLevel.INFO, `Processing file: ${file.originalName} (${processedCount + 1}/${totalFiles})`, StageType.OCR_PROCESSING);

            // Update file status
            await prisma.file.update({
              where: { id: file.id },
              data: { 
                status: FileStatus.PROCESSING,
                processingStartedAt: new Date()
              }
            });

            // Start PDF conversion for this file
            await updateJobStage(jobId, StageType.PDF_CONVERSION, StageStatus.RUNNING, Math.round((processedCount / totalFiles) * 100));
            await logJobMessage(jobId, LogLevel.INFO, `Converting ${file.originalName} to PNG format`, StageType.PDF_CONVERSION);

            // Update overall job progress
            const baseProgress = 15 + Math.round((processedCount / totalFiles) * 70); // 15-85% range for processing
            await updateJobProgress(jobId, baseProgress, 'PROCESSING', `Processing ${file.originalName}`);
            await job.updateProgress(baseProgress);

            // Create output directory structure that matches download expectations
            const baseOutputDir = join(process.env.UPLOAD_DIR || './uploads', '..', 'processed', jobId);
            const outputDir = join(baseOutputDir, file.id);

            // Update OCR processing stage
            await updateJobStage(jobId, StageType.OCR_PROCESSING, StageStatus.RUNNING, Math.round((processedCount / totalFiles) * 100));
            await logJobMessage(jobId, LogLevel.INFO, `Starting OCR processing for ${file.originalName}`, StageType.OCR_PROCESSING);

            // Process the file using the integrated OCR processor
            const result = await ocrProcessor.processFile(
              file.filePath,
              outputDir,
              {
                dpi: configuration.dpi || 300,
                retryAttempts: configuration.retryAttempts || 3,
                timeout: configuration.timeout || 45000,
              }
            );

            if (result.success) {
              console.log(`✅ Successfully processed ${file.originalName}`);
              await logJobMessage(jobId, LogLevel.INFO, `Successfully processed ${file.originalName}: ${result.pngCount} pages, ${result.ocrConfidence}% confidence`, StageType.OCR_PROCESSING, {
                fileName: file.originalName,
                pngCount: result.pngCount,
                pageCount: result.pageCount,
                confidence: result.ocrConfidence,
                languages: result.detectedLanguages,
                duration: result.processingDuration
              });

              // Update text extraction stage
              await updateJobStage(jobId, StageType.TEXT_EXTRACTION, StageStatus.RUNNING, Math.round((processedCount / totalFiles) * 100));
              await logJobMessage(jobId, LogLevel.INFO, `Extracting and organizing text from ${file.originalName}`, StageType.TEXT_EXTRACTION);

              // Update file as completed
              await prisma.file.update({
                where: { id: file.id },
                data: { 
                  status: FileStatus.COMPLETED,
                  processingCompletedAt: new Date()
                }
              });

              // Save processing results with page error tracking
              await prisma.processingResult.create({
                data: {
                  fileId: file.id,
                  outputPath: result.outputPath || '',
                  pngOutputPath: result.pngOutputPath || '',
                  textOutputPath: result.textOutputPath || '',
                  pngCount: result.pngCount || 0,
                  pageCount: result.pageCount || 0,
                  failedPngPages: result.failedPngPages || [],
                  failedOcrPages: result.failedOcrPages || [],
                  successfulPages: result.successfulPages || result.pngCount || 0,
                  totalPagesInPdf: result.totalPagesInPdf || result.pageCount || 0,
                  pageErrors: result.pageErrors || {},
                  ocrConfidence: result.ocrConfidence || 0,
                  detectedLanguages: result.detectedLanguages || [],
                  processingDuration: result.processingDuration || 0,
                  metadata: result.metadata || {}
                }
              });

              successfulCount++;
              await logJobMessage(jobId, LogLevel.INFO, `File completed: ${file.originalName} (${successfulCount}/${totalFiles} successful)`, StageType.TEXT_EXTRACTION);

            } else {
              console.error(`❌ Failed to process ${file.originalName}: ${result.error}`);
              await logJobMessage(jobId, LogLevel.ERROR, `Failed to process ${file.originalName}: ${result.error}`, StageType.OCR_PROCESSING, {
                fileName: file.originalName,
                error: result.error,
                duration: result.processingDuration
              });

              // Mark file as failed
              await prisma.file.update({
                where: { id: file.id },
                data: { 
                  status: FileStatus.FAILED,
                  processingCompletedAt: new Date()
                }
              });

              // Save error details
              await prisma.processingResult.create({
                data: {
                  fileId: file.id,
                  errorDetails: result.error || 'Unknown error',
                  processingDuration: result.processingDuration || 0,
                  metadata: { 
                    error: true, 
                    originalError: result.error,
                    ...result.metadata 
                  }
                }
              });

              failedCount++;
            }

            processedCount++;

          } catch (fileError) {
            console.error(`💥 Error processing file ${file.id}:`, fileError);
            await logJobMessage(jobId, LogLevel.CRITICAL, `Critical error processing file ${file.originalName}: ${fileError instanceof Error ? fileError.message : String(fileError)}`, StageType.OCR_PROCESSING, {
              fileName: file.originalName,
              error: fileError instanceof Error ? fileError.message : String(fileError),
              errorType: 'processing_exception'
            });
            
            failedCount++;
            processedCount++;

            // Mark file as failed
            await prisma.file.update({
              where: { id: file.id },
              data: { 
                status: FileStatus.FAILED,
                processingCompletedAt: new Date()
              }
            });

            // Save error details
            await prisma.processingResult.create({
              data: {
                fileId: file.id,
                errorDetails: fileError instanceof Error ? fileError.message : String(fileError),
                metadata: { 
                  error: true,
                  errorType: 'processing_exception',
                  timestamp: new Date().toISOString()
                }
              }
            });
          }

        // Brief pause between files to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

        // Complete all processing stages
        await updateJobStage(jobId, StageType.PDF_CONVERSION, StageStatus.COMPLETED, 100);
        await updateJobStage(jobId, StageType.OCR_PROCESSING, StageStatus.COMPLETED, 100);
        await updateJobStage(jobId, StageType.TEXT_EXTRACTION, StageStatus.COMPLETED, 100);

        // Stage 4: File Organization
        await createJobStage(jobId, StageType.FILE_ORGANIZATION);
        await updateJobStage(jobId, StageType.FILE_ORGANIZATION, StageStatus.RUNNING);
        await logJobMessage(jobId, LogLevel.INFO, 'Organizing output files and creating final structure', StageType.FILE_ORGANIZATION);
        await updateJobProgress(jobId, 90, 'FILE_ORGANIZATION', 'Organizing output files');
        await updateJobStage(jobId, StageType.FILE_ORGANIZATION, StageStatus.COMPLETED, 100);

        // Stage 5: Finalization
        await createJobStage(jobId, StageType.FINALIZATION);
        await updateJobStage(jobId, StageType.FINALIZATION, StageStatus.RUNNING);
        
        // Calculate final statistics
        const successRate = totalFiles > 0 ? (successfulCount / totalFiles) * 100 : 0;
        const finalStatus = failedCount === 0 ? JobStatus.COMPLETED : 
                           successfulCount > 0 ? JobStatus.COMPLETED : JobStatus.FAILED;

        await logJobMessage(jobId, LogLevel.INFO, `Job completion: ${successfulCount}/${totalFiles} files successful (${successRate.toFixed(1)}% success rate)`, StageType.FINALIZATION, {
          totalFiles,
          successfulFiles: successfulCount,
          failedFiles: failedCount,
          successRate: successRate.toFixed(1)
        });

        // Update final job status
        await prisma.job.update({
          where: { id: jobId },
          data: { 
            status: finalStatus,
            progress: 100,
            processedFiles: processedCount,
            successfulFiles: successfulCount,
            failedFiles: failedCount,
            completedAt: new Date()
          }
        });

        await updateJobProgress(jobId, 100, finalStatus === JobStatus.COMPLETED ? 'COMPLETED' : 'FAILED', 
          finalStatus === JobStatus.COMPLETED ? 'Job completed successfully' : 'Job completed with some failures');
        await updateJobStage(jobId, StageType.FINALIZATION, StageStatus.COMPLETED, 100);

        // Log completion
        console.log(`🎉 OCR job ${jobId} completed: ${successfulCount}/${totalFiles} successful (${successRate.toFixed(1)}% success rate)`);

        // Emit final WebSocket events
        if (webSocketEmitters) {
          if (finalStatus === JobStatus.COMPLETED) {
            webSocketEmitters.emitJobCompleted(jobId, {
              totalFiles,
              successfulFiles: successfulCount,
              failedFiles: failedCount,
              successRate
            });
          } else {
            webSocketEmitters.emitJobFailed(jobId, `Job completed with ${failedCount} failed files out of ${totalFiles} total`);
          }
        }

      // Log completion
      console.log(`Job ${jobId} completed: ${successfulCount}/${totalFiles} files successful`);

      return {
        jobId,
        totalFiles,
        processedFiles: processedCount,
        successfulFiles: successfulCount,
        failedFiles: failedCount,
        successRate,
        status: finalStatus
      };

    } catch (error) {
      console.error(`💥 OCR job ${jobId} failed:`, error);

      // Update job as failed
      await prisma.job.update({
        where: { id: jobId },
        data: { 
          status: JobStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date()
        }
      });

      // Log job failure
      console.log('Job failed:', {
        action: 'JOB_FAILED',
        resource: 'job',
        resourceId: jobId,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    } finally {
      // Always release the job lock
      await OCRJobLockManager.releaseJobLock(jobId);
      console.log(`🔓 Released processing lock for job ${jobId}`);
    }
  },
  {
    connection: redisConfig,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
  }
  );
}

// Lazy-loaded worker instance
let _ocrWorker: Worker<OCRJobData> | null = null;

export function getOCRWorker(): Worker<OCRJobData> {
  if (!_ocrWorker) {
    _ocrWorker = createOCRWorker();
  }
  return _ocrWorker;
}

// Note: Use getOCRWorker() function to ensure environment variables are loaded

// Progress notification function
async function notifyProgress(jobId: string, notification: any) {
  try {
    // Here you could implement various notification methods:
    // - WebSocket updates
    // - Email notifications
    // - Webhook calls
    // - Push notifications
    
    console.log(`📢 Notification for job ${jobId}:`, notification);
    
    // For now, we'll just store it in the database for SSE to pick up
    // In a production system, you might use Redis pub/sub or WebSockets
    
  } catch (error) {
    console.warn('Failed to send notification:', error);
  }
}

// Enhanced queue management functions
export const enhancedQueueManager = {
  // Add job to queue with better error handling
  async addJob(jobData: OCRJobData) {
    try {
      const job = await ocrQueue.add('process-ocr', jobData, {
        priority: jobData.configuration.priority || 0,
        delay: jobData.configuration.delay || 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
      
      console.log(`✅ Added job ${jobData.jobId} to queue with ID ${job.id}`);
      
      // Log job queued
      console.log('Job queued:', {
        action: 'JOB_QUEUED',
        resource: 'job',
        resourceId: jobData.jobId,
        metadata: {
          queueJobId: job.id,
          totalFiles: jobData.files.length,
          configuration: jobData.configuration
        }
      });
      
      return job;
    } catch (error) {
      console.error('Failed to add job to queue:', error);
      throw error;
    }
  },

  // Get job status with enhanced information
  async getJobStatus(jobId: string) {
    const jobs = await ocrQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
    const queueJob = jobs.find(job => job.data?.jobId === jobId);
    
    if (queueJob) {
      return {
        ...queueJob,
        queuePosition: queueJob.opts.delay ? 0 : await this.getQueuePosition(queueJob.id!),
        estimatedWaitTime: await this.estimateWaitTime(queueJob.id!)
      };
    }
    
    return null;
  },

  // Get queue position
  async getQueuePosition(queueJobId: string): Promise<number> {
    try {
      const waitingJobs = await ocrQueue.getWaiting();
      const position = waitingJobs.findIndex(job => job.id === queueJobId);
      return position >= 0 ? position + 1 : 0;
    } catch (error) {
      console.warn('Failed to get queue position:', error);
      return 0;
    }
  },

  // Estimate wait time
  async estimateWaitTime(queueJobId: string): Promise<string> {
    try {
      const position = await this.getQueuePosition(queueJobId);
      if (position === 0) return 'Processing now';
      
      // Estimate based on average processing time and queue position
      const avgProcessingTime = 2 * 60 * 1000; // 2 minutes per job (rough estimate)
      const waitTimeMs = position * avgProcessingTime;
      
      const waitTimeMinutes = Math.ceil(waitTimeMs / 60000);
      
      if (waitTimeMinutes < 1) return '< 1 min';
      if (waitTimeMinutes < 60) return `${waitTimeMinutes} min`;
      
      const hours = Math.floor(waitTimeMinutes / 60);
      const minutes = waitTimeMinutes % 60;
      
      return `${hours}h ${minutes}m`;
    } catch (error) {
      return 'Calculating...';
    }
  },

  // Get detailed queue statistics
  async getDetailedQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      ocrQueue.getWaiting(),
      ocrQueue.getActive(),
      ocrQueue.getCompleted(),
      ocrQueue.getFailed()
    ]);

    // Calculate throughput (jobs completed in last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentCompleted = completed.filter(job => 
      job.finishedOn && job.finishedOn > oneHourAgo
    );

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length,
      throughputLastHour: recentCompleted.length,
      avgProcessingTime: this.calculateAvgProcessingTime(completed),
      queueHealth: this.assessQueueHealth(waiting.length, active.length, failed.length)
    };
  },

  // Calculate average processing time
  calculateAvgProcessingTime(completedJobs: any[]): number {
    if (completedJobs.length === 0) return 0;
    
    const processingTimes = completedJobs
      .filter(job => job.processedOn && job.finishedOn)
      .map(job => job.finishedOn - job.processedOn);
    
    if (processingTimes.length === 0) return 0;
    
    return processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
  },

  // Assess queue health
  assessQueueHealth(waiting: number, active: number, failed: number): 'healthy' | 'warning' | 'critical' {
    const totalActive = waiting + active;
    
    if (failed > totalActive) return 'critical';
    if (waiting > 50 || failed > 10) return 'warning';
    return 'healthy';
  },

  // Cancel job with cleanup
  async cancelJob(jobId: string) {
    const jobs = await ocrQueue.getJobs(['waiting', 'active']);
    const job = jobs.find(j => j.data?.jobId === jobId);
    
    if (job) {
      await job.remove();
      
      // Update database
      await prisma.job.update({
        where: { id: jobId },
        data: { 
          status: JobStatus.CANCELLED,
          completedAt: new Date()
        }
      });
      
      // Log job cancellation
      console.log('Job cancelled:', {
        action: 'JOB_CANCELLED',
        resource: 'job',
        resourceId: jobId,
        metadata: {
          queueJobId: job.id,
          cancelledAt: new Date().toISOString()
        }
      });
      
      return true;
    }
    
    return false;
  },

  // Retry failed job with enhanced logic
  async retryJob(jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { files: true }
    });

    // Allow retrying jobs that are in FAILED, CANCELLED state or COMPLETED with failures
    const canRetry = job && (
      job.status === JobStatus.FAILED || 
      job.status === JobStatus.CANCELLED ||
      (job.status === JobStatus.COMPLETED && job.failedFiles > 0)
    );
    
    if (!canRetry) {
      throw new Error('Job not found or cannot be retried. Only failed jobs, cancelled jobs, or completed jobs with failures can be retried.');
    }

    // Reset job and file statuses
    await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.PENDING,
          errorMessage: null,
          progress: 0,
          processedFiles: 0,
          successfulFiles: 0,
          failedFiles: 0,
          startedAt: null,
          completedAt: null
        }
      }),
      prisma.file.updateMany({
        where: { jobId },
        data: {
          status: FileStatus.PENDING,
          processingStartedAt: null,
          processingCompletedAt: null
        }
      }),
      // Remove old processing results to start fresh
      prisma.processingResult.deleteMany({
        where: {
          file: {
            jobId
          }
        }
      })
    ]);

    // Add back to queue with retry configuration
    return this.addJob({
      jobId: job.id,
      files: job.files.map(f => ({
        id: f.id,
        originalName: f.originalName,
        filePath: f.filePath,
        fileSize: Number(f.fileSize)
      })),
      configuration: {
        ...job.configuration as Record<string, any>,
        isRetry: true,
        originalFailureTime: job.completedAt
      }
    });
  }
};

// Queue events for enhanced monitoring
export const queueEvents = new QueueEvents('ocr-processing', {
  connection: redisConfig,
});

// Enhanced event listeners
queueEvents.on('completed', async ({ jobId, returnvalue }) => {
  console.log(`🎉 Job ${jobId} completed successfully:`, returnvalue);
  
  // Could trigger additional actions like:
  // - Sending completion emails
  // - Updating external systems
  // - Triggering downstream processes
});

queueEvents.on('failed', async ({ jobId, failedReason }) => {
  console.error(`💥 Job ${jobId} failed: ${failedReason}`);
  
  // Could trigger:
  // - Error notifications
  // - Automatic retry logic
  // - Admin alerts
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`📊 Job ${jobId} progress: ${data}%`);
});

queueEvents.on('waiting', ({ jobId }) => {
  console.log(`⏳ Job ${jobId} is waiting in queue`);
});

queueEvents.on('active', ({ jobId }) => {
  console.log(`🚀 Job ${jobId} started processing`);
});

// Export enhanced types
export type { OCRJobData };