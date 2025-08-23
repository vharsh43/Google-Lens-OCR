import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enhancedQueueManager } from '@/lib/queue-enhanced';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.id;

    // Verify job exists
    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) {
      return new Response('Job not found', { status: 404 });
    }

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        let isControllerClosed = false;
        let pollInterval: NodeJS.Timeout | null = null;
        
        // Send initial connection message
        const send = (data: any) => {
          if (isControllerClosed) return;
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );
          } catch (error) {
            console.warn('SSE send error (controller may be closed):', error);
            isControllerClosed = true;
          }
        };
        
        const closeController = () => {
          if (isControllerClosed) return;
          isControllerClosed = true;
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          try {
            controller.close();
          } catch (error) {
            console.warn('SSE close error (already closed):', error);
          }
        };

        send({ type: 'connected', jobId, timestamp: new Date().toISOString() });

        // Poll for job updates
        pollInterval = setInterval(async () => {
          if (isControllerClosed) {
            if (pollInterval) clearInterval(pollInterval);
            return;
          }
          
          try {
            const updatedJob = await prisma.job.findUnique({
              where: { id: jobId },
              include: {
                files: {
                  include: {
                    processingResults: true,
                  },
                },
              },
            });

            if (!updatedJob) {
              send({ type: 'error', message: 'Job not found' });
              return;
            }

            // Get queue status if job is processing
            let queueStatus = null;
            if (updatedJob.status === 'QUEUED' || updatedJob.status === 'PROCESSING') {
              try {
                const queueJob = await enhancedQueueManager.getJobStatus(jobId);
                if (queueJob) {
                  queueStatus = {
                    progress: queueJob.progress || 0,
                    attemptsMade: queueJob.attemptsMade,
                    processedOn: queueJob.processedOn,
                  };
                }
              } catch (queueError) {
                console.warn('Failed to get queue status:', queueError);
              }
            }

            // Calculate statistics
            const stats = {
              totalSize: updatedJob.files.reduce((sum, file) => sum + Number(file.fileSize), 0),
              completedFiles: updatedJob.files.filter(f => f.status === 'COMPLETED').length,
              failedFiles: updatedJob.files.filter(f => f.status === 'FAILED').length,
              processingFiles: updatedJob.files.filter(f => f.status === 'PROCESSING').length,
              pendingFiles: updatedJob.files.filter(f => f.status === 'PENDING').length,
            };

            // Calculate ETA
            let eta = 'N/A';
            if (updatedJob.status === 'PROCESSING' && updatedJob.startedAt) {
              const elapsed = Date.now() - new Date(updatedJob.startedAt).getTime();
              const remainingFiles = updatedJob.totalFiles - updatedJob.processedFiles;
              
              if (remainingFiles > 0 && updatedJob.processedFiles > 0) {
                const avgTimePerFile = elapsed / updatedJob.processedFiles;
                const etaMs = remainingFiles * avgTimePerFile;
                const etaMinutes = Math.ceil(etaMs / 60000);
                
                if (etaMinutes < 1) eta = '< 1 min';
                else if (etaMinutes < 60) eta = `${etaMinutes} min`;
                else {
                  const hours = Math.floor(etaMinutes / 60);
                  const minutes = etaMinutes % 60;
                  eta = `${hours}h ${minutes}m`;
                }
              }
            }

            // Send job update
            send({
              type: 'job_update',
              job: {
                id: updatedJob.id,
                name: updatedJob.name,
                status: updatedJob.status,
                progress: updatedJob.progress,
                totalFiles: updatedJob.totalFiles,
                processedFiles: updatedJob.processedFiles,
                successfulFiles: updatedJob.successfulFiles,
                failedFiles: updatedJob.failedFiles,
                startedAt: updatedJob.startedAt,
                completedAt: updatedJob.completedAt,
                errorMessage: updatedJob.errorMessage,
                stats,
                eta,
                queueStatus,
              },
              timestamp: new Date().toISOString(),
            });

            // If job is completed or failed, send final update and close
            if (updatedJob.status === 'COMPLETED' || updatedJob.status === 'FAILED') {
              send({
                type: 'job_completed',
                status: updatedJob.status,
                finalStats: stats,
                timestamp: new Date().toISOString(),
              });
              
              setTimeout(() => {
                closeController();
              }, 3000); // Keep connection open for 3 seconds after completion
            }

          } catch (error) {
            console.error('SSE polling error:', error);
            send({
              type: 'error',
              message: 'Failed to fetch job updates',
              timestamp: new Date().toISOString(),
            });
          }
        }, 2000); // Poll every 2 seconds

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          closeController();
        });

        // Auto-cleanup after 30 minutes
        setTimeout(() => {
          send({
            type: 'timeout',
            message: 'Connection timed out',
            timestamp: new Date().toISOString(),
          });
          closeController();
        }, 30 * 60 * 1000);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    console.error('SSE connection error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}