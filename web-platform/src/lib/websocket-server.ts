import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { prisma } from '@/lib/prisma'
import { ocrQueue } from '@/lib/queue-enhanced'

export interface ServerToClientEvents {
  jobProgress: (data: { jobId: string; progress: number; stage: string; message?: string }) => void
  jobCompleted: (data: { jobId: string; results: any }) => void
  jobFailed: (data: { jobId: string; error: string }) => void
  logMessage: (data: { jobId: string; level: string; message: string; timestamp: Date }) => void
  stageUpdate: (data: { jobId: string; stage: string; status: string; progress?: number }) => void
}

export interface ClientToServerEvents {
  joinJobRoom: (jobId: string) => void
  leaveJobRoom: (jobId: string) => void
  requestJobStatus: (jobId: string) => void
  pauseJob: (jobId: string) => void
  cancelJob: (jobId: string) => void
}

export interface InterServerEvents {
  ping: () => void
}

export interface SocketData {
  userId?: string
  jobIds: Set<string>
}

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

// Global singleton for accessing WebSocket across processes
declare global {
  var __websocket_server__: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | undefined
}

export const initializeWebSocket = (httpServer: HTTPServer) => {
  if (global.__websocket_server__) {
    io = global.__websocket_server__
    console.log('♻️  Using existing global WebSocket server instance')
    return io
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.NEXTAUTH_URL 
        : ['http://localhost:3333'],
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  })

  // Store in global for cross-process access
  global.__websocket_server__ = io
  console.log('🚀 Created new global WebSocket server instance')

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
    console.log('WebSocket client connected:', socket.id)
    
    socket.data.jobIds = new Set()

    socket.on('joinJobRoom', async (jobId: string) => {
      try {
        const job = await prisma.job.findUnique({
          where: { id: jobId },
          select: { id: true, status: true, progress: true }
        })

        if (job) {
          socket.join(`job:${jobId}`)
          socket.data.jobIds.add(jobId)
          
          socket.emit('jobProgress', {
            jobId: job.id,
            progress: job.progress || 0,
            stage: job.status || 'PENDING'
          })
          
          console.log(`Client ${socket.id} joined job room: ${jobId}`)
        }
      } catch (error) {
        console.error('Error joining job room:', error)
      }
    })

    socket.on('leaveJobRoom', (jobId: string) => {
      socket.leave(`job:${jobId}`)
      socket.data.jobIds.delete(jobId)
      console.log(`Client ${socket.id} left job room: ${jobId}`)
    })

    socket.on('requestJobStatus', async (jobId: string) => {
      try {
        const job = await prisma.job.findUnique({
          where: { id: jobId },
          include: {
            files: {
              include: {
                processingResults: true
              }
            },
            stages: {
              orderBy: { createdAt: 'asc' }
            },
            logs: {
              orderBy: { createdAt: 'desc' },
              take: 10
            }
          }
        })

        if (job) {
          socket.emit('jobProgress', {
            jobId: job.id,
            progress: job.progress || 0,
            stage: job.status || 'PENDING'
          })

          job.stages.forEach(stage => {
            socket.emit('stageUpdate', {
              jobId: job.id,
              stage: stage.stage,
              status: stage.status,
              progress: stage.progress || 0
            })
          })

          job.logs.forEach(log => {
            socket.emit('logMessage', {
              jobId: job.id,
              level: log.level,
              message: log.message,
              timestamp: log.createdAt
            })
          })
        }
      } catch (error) {
        console.error('Error fetching job status:', error)
      }
    })

    socket.on('pauseJob', async (jobId: string) => {
      try {
        const queue = ocrQueue
        const job = await queue.getJob(jobId)
        
        if (job) {
          await job.pause()
          
          // Note: PAUSED status not in schema, job is paused in queue but DB status unchanged
          // await prisma.job.update({
          //   where: { id: jobId },
          //   data: { status: 'PAUSED' }
          // })

          io.to(`job:${jobId}`).emit('jobProgress', {
            jobId,
            progress: job.progress || 0,
            stage: 'PAUSED',
            message: 'Job paused by user'
          })
        }
      } catch (error) {
        console.error('Error pausing job:', error)
      }
    })

    socket.on('cancelJob', async (jobId: string) => {
      try {
        const queue = ocrQueue
        const job = await queue.getJob(jobId)
        
        if (job) {
          await job.remove()
          
          await prisma.job.update({
            where: { id: jobId },
            data: { status: 'CANCELLED' }
          })

          io.to(`job:${jobId}`).emit('jobFailed', {
            jobId,
            error: 'Job cancelled by user'
          })
        }
      } catch (error) {
        console.error('Error cancelling job:', error)
      }
    })

    socket.on('disconnect', () => {
      console.log('WebSocket client disconnected:', socket.id)
      
      socket.data.jobIds.forEach(jobId => {
        socket.leave(`job:${jobId}`)
      })
    })
  })

  return io
}

export const getWebSocketServer = () => {
  if (!io && global.__websocket_server__) {
    io = global.__websocket_server__
    console.log('🔄 Retrieved WebSocket server from global instance')
  }
  
  if (!io) {
    throw new Error('WebSocket server not initialized. Call initializeWebSocket first.')
  }
  return io
}

export const emitJobProgress = (jobId: string, progress: number, stage: string, message?: string) => {
  if (!io && global.__websocket_server__) {
    io = global.__websocket_server__
  }
  
  if (io) {
    console.log(`📡 Emitting jobProgress to job:${jobId} - ${progress}% ${stage}`)
    io.to(`job:${jobId}`).emit('jobProgress', { jobId, progress, stage, message })
  } else {
    console.warn('⚠️ WebSocket server not initialized - cannot emit jobProgress')
  }
}

export const emitJobCompleted = (jobId: string, results: any) => {
  if (!io && global.__websocket_server__) {
    io = global.__websocket_server__
  }
  
  if (io) {
    console.log(`✅ Emitting jobCompleted to job:${jobId}`)
    io.to(`job:${jobId}`).emit('jobCompleted', { jobId, results })
  } else {
    console.warn('⚠️ WebSocket server not initialized - cannot emit jobCompleted')
  }
}

export const emitJobFailed = (jobId: string, error: string) => {
  if (!io && global.__websocket_server__) {
    io = global.__websocket_server__
  }
  
  if (io) {
    console.log(`❌ Emitting jobFailed to job:${jobId}`)
    io.to(`job:${jobId}`).emit('jobFailed', { jobId, error })
  } else {
    console.warn('⚠️ WebSocket server not initialized - cannot emit jobFailed')
  }
}

export const emitLogMessage = (jobId: string, level: string, message: string, timestamp = new Date()) => {
  if (!io && global.__websocket_server__) {
    io = global.__websocket_server__
  }
  
  if (io) {
    console.log(`📝 Emitting logMessage to job:${jobId} - ${level}: ${message}`)
    io.to(`job:${jobId}`).emit('logMessage', { jobId, level, message, timestamp })
  } else {
    console.warn('⚠️ WebSocket server not initialized - cannot emit logMessage')
  }
}

export const emitStageUpdate = (jobId: string, stage: string, status: string, progress?: number) => {
  if (!io && global.__websocket_server__) {
    io = global.__websocket_server__
  }
  
  if (io) {
    console.log(`🔄 Emitting stageUpdate to job:${jobId} - ${stage}: ${status} ${progress}%`)
    io.to(`job:${jobId}`).emit('stageUpdate', { jobId, stage, status, progress })
  } else {
    console.warn('⚠️ WebSocket server not initialized - cannot emit stageUpdate')
  }
}