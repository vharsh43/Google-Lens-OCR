import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { prisma } from './prisma';
import { ocrProcessor } from './ocr-integration';
import { JobStatus, FileStatus } from '@prisma/client';
import { join } from 'path';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
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

// Create OCR Worker factory function
function createOCRWorker(): Worker<OCRJobData> {
  return new Worker<OCRJobData>(
    'ocr-processing',
    async (job: Job<OCRJobData>) => {
      const { jobId, files, configuration } = job.data;
    
    console.log(`🚀 Starting OCR job ${jobId} with ${files.length} files`);

    try {
      // Update job status to processing
      await prisma.job.update({
        where: { id: jobId },
        data: { 
          status: JobStatus.PROCESSING, 
          startedAt: new Date() 
        }
      });

      let processedCount = 0;
      let successfulCount = 0;
      let failedCount = 0;
      const totalFiles = files.length;

      // Process each file
      for (const file of files) {
        try {
          console.log(`📄 Processing file: ${file.originalName} (${processedCount + 1}/${totalFiles})`);

          // Update file status
          await prisma.file.update({
            where: { id: file.id },
            data: { 
              status: FileStatus.PROCESSING,
              processingStartedAt: new Date()
            }
          });

          // Update job progress
          const progressPercent = Math.round((processedCount / totalFiles) * 100);
          await job.updateProgress(progressPercent);
          
          await prisma.job.update({
            where: { id: jobId },
            data: { 
              progress: progressPercent,
              processedFiles: processedCount
            }
          });

          // Create output directory for this file
          const outputDir = join(process.env.UPLOAD_DIR || './uploads', jobId, 'processed', file.id);

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

            // Update file as completed
            await prisma.file.update({
              where: { id: file.id },
              data: { 
                status: FileStatus.COMPLETED,
                processingCompletedAt: new Date()
              }
            });

            // Save processing results
            await prisma.processingResult.create({
              data: {
                fileId: file.id,
                outputPath: result.outputPath || '',
                pngOutputPath: result.pngOutputPath || '',
                textOutputPath: result.textOutputPath || '',
                pngCount: result.pngCount || 0,
                pageCount: result.pageCount || 0,
                ocrConfidence: result.ocrConfidence || 0,
                detectedLanguages: result.detectedLanguages || [],
                processingDuration: result.processingDuration || 0,
                metadata: result.metadata || {}
              }
            });

            successfulCount++;

            // Send progress update notification (could be WebSocket, email, etc.)
            await notifyProgress(jobId, {
              type: 'file_completed',
              fileName: file.originalName,
              progress: Math.round(((processedCount + 1) / totalFiles) * 100),
              result: {
                pngCount: result.pngCount,
                pageCount: result.pageCount,
                confidence: result.ocrConfidence,
                languages: result.detectedLanguages
              }
            });

          } else {
            console.error(`❌ Failed to process ${file.originalName}: ${result.error}`);

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

            // Send error notification
            await notifyProgress(jobId, {
              type: 'file_failed',
              fileName: file.originalName,
              error: result.error,
              progress: Math.round(((processedCount + 1) / totalFiles) * 100)
            });
          }

          processedCount++;

        } catch (fileError) {
          console.error(`💥 Error processing file ${file.id}:`, fileError);
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

      // Calculate final statistics
      const successRate = totalFiles > 0 ? (successfulCount / totalFiles) * 100 : 0;
      const finalStatus = failedCount === 0 ? JobStatus.COMPLETED : 
                         successfulCount > 0 ? JobStatus.COMPLETED : JobStatus.FAILED;

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

      // Log completion
      console.log(`🎉 OCR job ${jobId} completed: ${successfulCount}/${totalFiles} successful (${successRate.toFixed(1)}% success rate)`);

      // Send final notification
      await notifyProgress(jobId, {
        type: 'job_completed',
        status: finalStatus,
        totalFiles,
        successfulFiles: successfulCount,
        failedFiles: failedCount,
        successRate
      });

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

    if (!job || job.status !== JobStatus.FAILED) {
      throw new Error('Job not found or not in failed state');
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