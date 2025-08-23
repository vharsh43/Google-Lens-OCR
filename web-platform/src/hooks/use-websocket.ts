'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@/lib/websocket-server'

type WebSocketSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface JobProgress {
  jobId: string
  progress: number
  stage: string
  message?: string
}

interface LogMessage {
  jobId: string
  level: string
  message: string
  timestamp: Date
}

interface StageUpdate {
  jobId: string
  stage: string
  status: string
  progress?: number
}

interface UseWebSocketReturn {
  socket: WebSocketSocket | null
  connected: boolean
  joinJobRoom: (jobId: string) => void
  leaveJobRoom: (jobId: string) => void
  requestJobStatus: (jobId: string) => void
  pauseJob: (jobId: string) => void
  cancelJob: (jobId: string) => void
  onJobProgress: (callback: (data: JobProgress) => void) => () => void
  onJobCompleted: (callback: (data: { jobId: string; results: any }) => void) => () => void
  onJobFailed: (callback: (data: { jobId: string; error: string }) => void) => () => void
  onLogMessage: (callback: (data: LogMessage) => void) => () => void
  onStageUpdate: (callback: (data: StageUpdate) => void) => () => void
}

export function useWebSocket(): UseWebSocketReturn {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<WebSocketSocket | null>(null)

  useEffect(() => {
    const socketUrl = process.env.NODE_ENV === 'production' 
      ? process.env.NEXT_PUBLIC_WEBSOCKET_URL || window.location.origin
      : 'http://localhost:3333'

    console.log('🔗 Attempting to connect to WebSocket:', socketUrl)

    const newSocket: WebSocketSocket = io(socketUrl, {
      transports: ['polling', 'websocket'], // Try polling first, then websocket
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: true, // Force a new connection
      autoConnect: true,
    })

    socketRef.current = newSocket

    newSocket.on('connect', () => {
      console.log('WebSocket connected:', newSocket.id)
      setConnected(true)
    })

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      setConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.warn('⚠️ WebSocket connection error (components will use polling fallback):', error.message)
      setConnected(false)
    })

    // Additional error handling
    newSocket.on('connect_error' as any, (error: any) => {
      console.warn('⚠️ WebSocket error:', error)
    })

    // Monitor connection attempts
    newSocket.on('connecting' as any, () => {
      console.log('🔄 WebSocket connecting...')
    })

    newSocket.on('reconnect' as any, (attemptNumber: any) => {
      console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts')
      setConnected(true)
    })

    newSocket.on('reconnect_error' as any, (error: any) => {
      console.warn('⚠️ WebSocket reconnect error:', error?.message || error)
    })

    return () => {
      newSocket.close()
    }
  }, [])

  const joinJobRoom = (jobId: string) => {
    socketRef.current?.emit('joinJobRoom', jobId)
  }

  const leaveJobRoom = (jobId: string) => {
    socketRef.current?.emit('leaveJobRoom', jobId)
  }

  const requestJobStatus = (jobId: string) => {
    socketRef.current?.emit('requestJobStatus', jobId)
  }

  const pauseJob = (jobId: string) => {
    socketRef.current?.emit('pauseJob', jobId)
  }

  const cancelJob = (jobId: string) => {
    socketRef.current?.emit('cancelJob', jobId)
  }

  const onJobProgress = (callback: (data: JobProgress) => void) => {
    socketRef.current?.on('jobProgress', callback)
    return () => socketRef.current?.off('jobProgress', callback)
  }

  const onJobCompleted = (callback: (data: { jobId: string; results: any }) => void) => {
    socketRef.current?.on('jobCompleted', callback)
    return () => socketRef.current?.off('jobCompleted', callback)
  }

  const onJobFailed = (callback: (data: { jobId: string; error: string }) => void) => {
    socketRef.current?.on('jobFailed', callback)
    return () => socketRef.current?.off('jobFailed', callback)
  }

  const onLogMessage = (callback: (data: LogMessage) => void) => {
    socketRef.current?.on('logMessage', callback)
    return () => socketRef.current?.off('logMessage', callback)
  }

  const onStageUpdate = (callback: (data: StageUpdate) => void) => {
    socketRef.current?.on('stageUpdate', callback)
    return () => socketRef.current?.off('stageUpdate', callback)
  }

  return {
    socket: socketRef.current,
    connected,
    joinJobRoom,
    leaveJobRoom,
    requestJobStatus,
    pauseJob,
    cancelJob,
    onJobProgress,
    onJobCompleted,
    onJobFailed,
    onLogMessage,
    onStageUpdate,
  }
}

export function useJobProgress(jobId: string | null) {
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [logs, setLogs] = useState<LogMessage[]>([])
  const [stages, setStages] = useState<StageUpdate[]>([])
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    joinJobRoom,
    leaveJobRoom,
    requestJobStatus,
    onJobProgress,
    onJobCompleted,
    onJobFailed,
    onLogMessage,
    onStageUpdate,
    connected
  } = useWebSocket()

  useEffect(() => {
    if (!jobId || !connected) return

    joinJobRoom(jobId)
    requestJobStatus(jobId)

    const unsubscribeProgress = onJobProgress((data) => {
      if (data.jobId === jobId) {
        setProgress(data)
      }
    })

    const unsubscribeCompleted = onJobCompleted((data) => {
      if (data.jobId === jobId) {
        setCompleted(true)
        setProgress(prev => prev ? { ...prev, progress: 100, stage: 'COMPLETED' } : null)
      }
    })

    const unsubscribeFailed = onJobFailed((data) => {
      if (data.jobId === jobId) {
        setError(data.error)
        setProgress(prev => prev ? { ...prev, stage: 'FAILED' } : null)
      }
    })

    const unsubscribeLogs = onLogMessage((data) => {
      if (data.jobId === jobId) {
        setLogs(prev => [data, ...prev].slice(0, 100))
      }
    })

    const unsubscribeStages = onStageUpdate((data) => {
      if (data.jobId === jobId) {
        setStages(prev => {
          const existing = prev.find(s => s.stage === data.stage)
          if (existing) {
            return prev.map(s => s.stage === data.stage ? data : s)
          }
          return [...prev, data]
        })
      }
    })

    return () => {
      leaveJobRoom(jobId)
      unsubscribeProgress()
      unsubscribeCompleted()
      unsubscribeFailed()
      unsubscribeLogs()
      unsubscribeStages()
    }
  }, [jobId, connected])

  return {
    progress,
    logs,
    stages,
    completed,
    error,
    connected
  }
}