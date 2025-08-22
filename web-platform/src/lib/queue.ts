import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { prisma } from './prisma';
import { JobStatus, FileStatus } from '@prisma/client';

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

// Progress callback interface
interface ProgressCallback {
  (progress: {
    jobId: string;
    progress: number;
    processedFiles: number;
    currentFile?: string;
    status: string;
  }): void;
}

// OCR Processing Worker
export const ocrWorker = new Worker<OCRJobData>(
  'ocr-processing',
  async (job: Job<OCRJobData>) => {
    const { jobId, files, configuration } = job.data;
    
    console.log(`Starting OCR job ${jobId}`);

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

      // Process each file
      for (const file of files) {
        try {
          // Update file status
          await prisma.file.update({
            where: { id: file.id },
            data: { 
              status: FileStatus.PROCESSING,
              processingStartedAt: new Date()
            }
          });

          // Update job progress
          const progressPercent = Math.round((processedCount / files.length) * 100);
          await job.updateProgress(progressPercent);
          
          await prisma.job.update({
            where: { id: jobId },
            data: { 
              progress: progressPercent,
              processedFiles: processedCount
            }
          });

          // Process the file using existing Python pipeline
          const result = await processFile(file, configuration);

          if (result.success) {
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
                outputPath: result.outputPath,
                pngOutputPath: result.pngOutputPath,
                textOutputPath: result.textOutputPath,
                pngCount: result.pngCount || 0,
                pageCount: result.pageCount || 0,
                ocrConfidence: result.ocrConfidence,
                detectedLanguages: result.detectedLanguages || [],
                processingDuration: result.processingDuration,
                metadata: result.metadata || {}
              }
            });

            successfulCount++;
          } else {
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
                errorDetails: result.error,
                metadata: { error: true, ...result.metadata }
              }
            });

            failedCount++;
          }

          processedCount++;

        } catch (fileError) {
          console.error(`Error processing file ${file.id}:`, fileError);
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
        }
      }

      // Update final job status
      const finalStatus = failedCount === 0 ? JobStatus.COMPLETED : 
                         successfulCount > 0 ? JobStatus.COMPLETED : JobStatus.FAILED;

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

      console.log(`OCR job ${jobId} completed: ${successfulCount}/${files.length} successful`);

      return {
        jobId,
        totalFiles: files.length,
        processedFiles: processedCount,
        successfulFiles: successfulCount,
        failedFiles: failedCount,
        status: finalStatus
      };

    } catch (error) {
      console.error(`OCR job ${jobId} failed:`, error);

      // Update job as failed
      await prisma.job.update({
        where: { id: jobId },
        data: { 
          status: JobStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date()
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

// Process individual file function
async function processFile(
  file: { id: string; originalName: string; filePath: string; fileSize: number },
  configuration: Record<string, any>
): Promise<{
  success: boolean;
  outputPath?: string;
  pngOutputPath?: string;
  textOutputPath?: string;
  pngCount?: number;
  pageCount?: number;
  ocrConfidence?: number;
  detectedLanguages?: string[];
  processingDuration?: number;
  metadata?: Record<string, any>;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Here we'll integrate with the existing Python pipeline
    // For now, this is a placeholder that simulates processing
    
    // Import the existing OCR processor
    const { spawn } = await import('child_process');
    const path = await import('path');
    
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const scriptPath = path.resolve(process.cwd(), '../PDF_2_PNG.py');
    
    return new Promise((resolve) => {
      // Simulate processing for now
      // In real implementation, this would call the Python script
      setTimeout(() => {
        const processingDuration = Date.now() - startTime;
        
        // Simulate successful processing
        resolve({
          success: true,
          outputPath: `/processed/${file.id}`,
          pngOutputPath: `/processed/${file.id}/pngs`,
          textOutputPath: `/processed/${file.id}/text`,
          pngCount: Math.floor(Math.random() * 10) + 1,
          pageCount: Math.floor(Math.random() * 10) + 1,
          ocrConfidence: 0.85 + Math.random() * 0.15,
          detectedLanguages: ['en'],
          processingDuration,
          metadata: {
            originalSize: file.fileSize,
            timestamp: new Date().toISOString()
          }
        });
      }, 2000 + Math.random() * 3000); // Simulate 2-5 second processing
    });

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      metadata: { processingDuration: Date.now() - startTime }
    };
  }
}

// Queue management functions
export const queueManager = {
  // Add job to queue
  async addJob(jobData: OCRJobData) {
    const job = await ocrQueue.add('process-ocr', jobData, {
      priority: jobData.configuration.priority || 0,
      delay: jobData.configuration.delay || 0,
    });
    
    console.log(`Added job ${jobData.jobId} to queue with ID ${job.id}`);
    return job;
  },

  // Get job status
  async getJobStatus(jobId: string) {
    const jobs = await ocrQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
    return jobs.find(job => job.data?.jobId === jobId);
  },

  // Get queue statistics
  async getQueueStats() {
    const waiting = await ocrQueue.getWaiting();
    const active = await ocrQueue.getActive();
    const completed = await ocrQueue.getCompleted();
    const failed = await ocrQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    };
  },

  // Cancel job
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
      
      return true;
    }
    
    return false;
  },

  // Retry failed job
  async retryJob(jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { files: true }
    });

    if (!job || job.status !== JobStatus.FAILED) {
      throw new Error('Job not found or not in failed state');
    }

    // Reset job status
    await prisma.job.update({
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
    });

    // Reset file statuses
    await prisma.file.updateMany({
      where: { jobId },
      data: {
        status: FileStatus.PENDING,
        processingStartedAt: null,
        processingCompletedAt: null
      }
    });

    // Add back to queue
    return this.addJob({
      jobId: job.id,
      files: job.files.map(f => ({
        id: f.id,
        originalName: f.originalName,
        filePath: f.filePath,
        fileSize: Number(f.fileSize)
      })),
      configuration: job.configuration as Record<string, any>
    });
  }
};

// Queue events for monitoring
export const queueEvents = new QueueEvents('ocr-processing', {
  connection: redisConfig,
});

// Set up event listeners
queueEvents.on('completed', ({ jobId }) => {
  console.log(`Job ${jobId} completed successfully`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed: ${failedReason}`);
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`Job ${jobId} progress: ${data}%`);
});

// Export types
export type { OCRJobData, ProgressCallback };