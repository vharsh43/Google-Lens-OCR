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

// Worker event handlers
ocrWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

ocrWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

ocrWorker.on('progress', (job, progress) => {
  console.log(`⏳ Job ${job.id} progress: ${progress}%`);
});

ocrWorker.on('active', (job) => {
  console.log(`🔄 Job ${job.id} started processing`);
});

// Queue event handlers
queueEvents.on('waiting', ({ jobId }) => {
  console.log(`⏱️  Job ${jobId} is waiting`);
});

queueEvents.on('active', ({ jobId }) => {
  console.log(`🔄 Job ${jobId} is now active`);
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`✅ Job ${jobId} completed:`, returnvalue);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Job ${jobId} failed:`, failedReason);
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`📊 Job ${jobId} progress: ${data}%`);
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