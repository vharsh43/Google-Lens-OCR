#!/usr/bin/env node

/**
 * OCR Queue Worker
 * 
 * This worker process handles the OCR job queue processing.
 * Run this as a separate process: npm run queue:dev
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

// Debug environment variables
console.log('🔧 Debug: WORKER_CONCURRENCY =', process.env.WORKER_CONCURRENCY);
console.log('🔧 Debug: NODE_ENV =', process.env.NODE_ENV);

import { getOCRWorker, queueEvents } from '../lib/queue-enhanced';

console.log('🚀 Starting OCR Queue Worker...');

// Get the worker instance (this will load environment variables)
const ocrWorker = getOCRWorker();

// WebSocket event emission via HTTP calls
const emitWebSocketEvent = async (type: string, data: any) => {
  try {
    const response = await fetch(`http://localhost:${process.env.PORT || '3333'}/api/websocket/emit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, data }),
    });
    
    if (!response.ok) {
      console.warn(`Failed to emit ${type} event:`, response.statusText);
    }
  } catch (error) {
    console.warn(`Failed to emit ${type} event:`, error);
  }
};

const webSocketEmitters = {
  emitJobProgress: (jobId: string, progress: number, stage: string, message?: string) => 
    emitWebSocketEvent('jobProgress', { jobId, progress, stage, message }),
  emitJobCompleted: (jobId: string, results: any) => 
    emitWebSocketEvent('jobCompleted', { jobId, results }),
  emitJobFailed: (jobId: string, error: string) => 
    emitWebSocketEvent('jobFailed', { jobId, error }),
  emitLogMessage: (jobId: string, level: string, message: string, timestamp = new Date()) => 
    emitWebSocketEvent('logMessage', { jobId, level, message, timestamp }),
  emitStageUpdate: (jobId: string, stage: string, status: string, progress?: number) => 
    emitWebSocketEvent('stageUpdate', { jobId, stage, status, progress })
};

// Enhanced worker event handlers with WebSocket integration
ocrWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
  
  // Always try to emit WebSocket events
  const result = job.returnvalue || {};
  const stats = `${result.successfulFiles || 0}/${result.totalFiles || 0} files processed successfully`;
  
  webSocketEmitters.emitJobCompleted(job.id || '', result);
  webSocketEmitters.emitJobProgress(job.id || '', 100, 'COMPLETED', 'Job completed successfully');
  webSocketEmitters.emitLogMessage(job.id || '', 'info', `🎉 Job completed successfully: ${stats}`, new Date());
  webSocketEmitters.emitStageUpdate(job.id || '', 'FINALIZATION', 'COMPLETED', 100);
});

ocrWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
  
  if (job) {
    webSocketEmitters.emitJobFailed(job.id || '', err.message);
    webSocketEmitters.emitJobProgress(job.id || '', 0, 'FAILED', `Job failed: ${err.message}`);
    webSocketEmitters.emitLogMessage(job.id || '', 'error', `💥 Job failed: ${err.message}`, new Date());
    
    // Mark all stages as failed
    const stages = ['INITIALIZATION', 'FILE_VALIDATION', 'PDF_CONVERSION', 'OCR_PROCESSING', 'TEXT_EXTRACTION', 'FILE_ORGANIZATION', 'FINALIZATION'];
    stages.forEach(stage => {
      webSocketEmitters.emitStageUpdate(job.id || '', stage, 'FAILED', 0);
    });
  }
});

ocrWorker.on('progress', (job, progress) => {
  console.log(`⏳ Job ${job.id} progress: ${progress}%`);
  
  // Always try to emit WebSocket events
    let currentStage = 'PROCESSING';
    const progressNum = typeof progress === 'number' ? progress : 0;
    let message = `Processing... ${progressNum}% complete`;
    
    // Determine current stage based on progress
    if (progressNum <= 10) {
      currentStage = 'FILE_VALIDATION';
      message = `Validating files... ${progressNum}% complete`;
    } else if (progressNum <= 40) {
      currentStage = 'PDF_CONVERSION';
      message = `Converting PDFs to images... ${progressNum}% complete`;
    } else if (progressNum <= 85) {
      currentStage = 'OCR_PROCESSING';
      message = `Extracting text with OCR... ${progressNum}% complete`;
    } else if (progressNum <= 95) {
      currentStage = 'TEXT_EXTRACTION';
      message = `Processing extracted text... ${progressNum}% complete`;
    } else {
      currentStage = 'FINALIZATION';
      message = `Finalizing results... ${progressNum}% complete`;
    }
    
    webSocketEmitters.emitJobProgress(job.id || '', progressNum, currentStage, message);
    webSocketEmitters.emitLogMessage(job.id || '', 'info', message, new Date());
});

ocrWorker.on('active', (job) => {
  console.log(`🔄 Job ${job.id} started processing`);
  
  // Always try to emit WebSocket events
  webSocketEmitters.emitJobProgress(job.id || '', 1, 'INITIALIZATION', 'Job started processing');
  webSocketEmitters.emitStageUpdate(job.id || '', 'INITIALIZATION', 'RUNNING', 0);
  webSocketEmitters.emitLogMessage(job.id || '', 'info', `🚀 Job ${job.id || 'unknown'} started processing`, new Date());
});

// Enhanced queue event handlers with detailed stage tracking
queueEvents.on('waiting', ({ jobId }) => {
  console.log(`⏱️  Job ${jobId} is waiting`);
  
  // Always try to emit WebSocket events
  webSocketEmitters.emitJobProgress(jobId, 0, 'QUEUED', 'Job is waiting in queue');
  webSocketEmitters.emitStageUpdate(jobId, 'INITIALIZATION', 'PENDING', 0);
  webSocketEmitters.emitLogMessage(jobId, 'info', `Job ${jobId} added to queue`);
});

queueEvents.on('active', ({ jobId }) => {
  console.log(`🔄 Job ${jobId} is now active`);
  
  // Always try to emit WebSocket events
  webSocketEmitters.emitJobProgress(jobId, 5, 'PROCESSING', 'Job is now active');
  webSocketEmitters.emitStageUpdate(jobId, 'INITIALIZATION', 'RUNNING', 50);
  webSocketEmitters.emitLogMessage(jobId, 'info', `Job ${jobId} is now active`);
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`✅ Job ${jobId} completed:`, returnvalue);
  
  // Always try to emit WebSocket events
  webSocketEmitters.emitStageUpdate(jobId, 'OCR_PROCESSING', 'COMPLETED', 100);
  webSocketEmitters.emitStageUpdate(jobId, 'FINALIZATION', 'COMPLETED', 100);
  webSocketEmitters.emitLogMessage(jobId, 'success', `Job ${jobId} completed successfully`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Job ${jobId} failed:`, failedReason);
  
  // Always try to emit WebSocket events
  webSocketEmitters.emitStageUpdate(jobId, 'OCR_PROCESSING', 'FAILED', 0);
  webSocketEmitters.emitLogMessage(jobId, 'error', `Job ${jobId} failed: ${failedReason}`);
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`📊 Job ${jobId} progress: ${data}%`);
  
  // Always try to emit WebSocket events
  // More granular stage mapping based on progress
  let stage = 'INITIALIZATION';
  let message = '';
  const dataNum = typeof data === 'number' ? data : 0;
  
  if (dataNum <= 5) {
    stage = 'INITIALIZATION';
    message = 'Initializing job and preparing resources';
  } else if (dataNum <= 10) {
    stage = 'FILE_VALIDATION';
    message = 'Validating uploaded files';
  } else if (dataNum <= 40) {
    stage = 'PDF_CONVERSION';
    message = 'Converting PDF pages to high-resolution images';
  } else if (dataNum <= 85) {
    stage = 'OCR_PROCESSING';
    message = 'Extracting text using Google Lens OCR';
  } else if (dataNum <= 90) {
    stage = 'TEXT_EXTRACTION';
    message = 'Processing and organizing extracted text';
  } else if (dataNum <= 95) {
    stage = 'FILE_ORGANIZATION';
    message = 'Organizing output files and creating archive';
  } else {
    stage = 'FINALIZATION';
    message = 'Finalizing job and preparing results';
  }
  
  webSocketEmitters.emitStageUpdate(jobId, stage, 'RUNNING', typeof data === 'number' ? data : 0);
  webSocketEmitters.emitLogMessage(jobId, 'info', `${message} - ${data}% complete`, new Date());
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📦 Gracefully shutting down worker...');
  await ocrWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📦 Gracefully shutting down worker...');
  await ocrWorker.close();
  process.exit(0);
});

console.log('✅ OCR Queue Worker is ready and waiting for jobs...');
console.log('Press Ctrl+C to stop the worker');

// Keep the process alive
process.stdin.resume();