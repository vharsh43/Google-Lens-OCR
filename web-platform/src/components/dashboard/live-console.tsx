'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
// Card components no longer needed - using modern div structure
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Terminal,
  Play,
  Pause,
  Trash2,
  Download,
  Search,
  Filter,
  Maximize2,
  Minimize2,
  Copy,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Bug
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWebSocket } from '@/hooks/use-websocket'

interface LogEntry {
  id: string
  timestamp: Date
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  stage?: string
  message: string
  metadata?: any
}

interface LiveConsoleProps {
  jobId: string
  isActive?: boolean
  maxLines?: number
  autoScroll?: boolean
  showTimestamps?: boolean
  showStages?: boolean
  className?: string
}

const LOG_LEVELS = {
  DEBUG: { 
    icon: Bug, 
    color: 'text-slate-500', 
    bgColor: 'bg-slate-50', 
    borderColor: 'border-slate-200',
    label: 'DEBUG'
  },
  INFO: { 
    icon: Info, 
    color: 'text-slate-600', 
    bgColor: 'bg-slate-50', 
    borderColor: 'border-slate-200',
    label: 'INFO'
  },
  WARNING: { 
    icon: AlertTriangle, 
    color: 'text-amber-600', 
    bgColor: 'bg-amber-50', 
    borderColor: 'border-amber-200',
    label: 'WARN'
  },
  ERROR: { 
    icon: XCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-50', 
    borderColor: 'border-red-200',
    label: 'ERROR'
  },
  CRITICAL: { 
    icon: XCircle, 
    color: 'text-red-700', 
    bgColor: 'bg-red-100', 
    borderColor: 'border-red-300',
    label: 'CRIT'
  }
}

export function LiveConsole({
  jobId,
  isActive = true,
  maxLines = 1000,
  autoScroll = true,
  showTimestamps = true,
  showStages = true,
  className
}: LiveConsoleProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLevel, setFilterLevel] = useState<string>('ALL')
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const consoleRef = useRef<HTMLDivElement>(null)

  // WebSocket integration for real-time logs
  const { onLogMessage, connected, joinJobRoom, leaveJobRoom } = useWebSocket()

  // Fetch initial logs and join job room for real-time updates
  useEffect(() => {
    const fetchInitialLogs = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}/logs?limit=${maxLines}`)
        if (response.ok) {
          const data = await response.json()
          const formattedLogs: LogEntry[] = data.logs.map((log: any) => ({
            id: log.id,
            timestamp: new Date(log.timestamp),
            level: log.level.toUpperCase() as 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL',
            stage: log.stage,
            message: log.message,
            metadata: log.metadata
          }))
          setLogs(formattedLogs)
        }
      } catch (error) {
        console.error('Failed to fetch initial logs:', error)
      }
    }

    if (jobId) {
      fetchInitialLogs()
    }

    if (jobId && connected) {
      joinJobRoom(jobId)
      return () => leaveJobRoom(jobId)
    }
  }, [jobId, connected, maxLines])

  // Listen for real-time log messages
  useEffect(() => {
    if (!isActive || isPaused) return

    const unsubscribe = onLogMessage((logData) => {
      if (logData.jobId === jobId) {
        const newLog: LogEntry = {
          id: `${logData.jobId}-${Date.now()}`,
          timestamp: new Date(logData.timestamp),
          level: logData.level.toUpperCase() as 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL',
          message: logData.message,
          metadata: { jobId: logData.jobId }
        }

        setLogs(prevLogs => {
          const newLogs = [...prevLogs, newLog]
          return newLogs.slice(-maxLines) // Keep only the last maxLines entries
        })
      }
    })

    return unsubscribe
  }, [isActive, isPaused, maxLines, jobId, onLogMessage])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && isAtBottom && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [logs, autoScroll, isAtBottom])

  const handleScroll = useCallback(() => {
    if (!scrollAreaRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50
    setIsAtBottom(isNearBottom)
  }, [])

  const clearLogs = () => {
    setLogs([])
  }

  const downloadLogs = () => {
    const logText = filteredLogs
      .map(log => 
        `[${formatTimestamp(log.timestamp)}] [${log.level}] ${log.stage ? `[${log.stage}] ` : ''}${log.message}`
      )
      .join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-${jobId}-logs.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyLogEntry = async (log: LogEntry) => {
    const logText = `[${formatTimestamp(log.timestamp)}] [${log.level}] ${log.stage ? `[${log.stage}] ` : ''}${log.message}`
    await navigator.clipboard.writeText(logText)
    setCopiedId(log.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.stage?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel
    
    return matchesSearch && matchesLevel
  })

  const logCounts = logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className={cn("font-mono bg-white rounded-2xl shadow-sm border border-slate-200 transition-all duration-200 hover:shadow-md hover:scale-[1.02]", className)}>
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="h-5 w-5" />
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Live Console</h3>
            <div className="flex space-x-1">
              {Object.entries(logCounts).map(([level, count]) => (
                <Badge 
                  key={level}
                  variant="outline" 
                  className={cn("text-xs", LOG_LEVELS[level as keyof typeof LOG_LEVELS]?.color)}
                >
                  {level}: {count}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 pr-3 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"
              />
            </div>

            {/* Filter */}
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Levels</option>
              {Object.keys(LOG_LEVELS).map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>

            {/* Controls */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsPaused(!isPaused)}
              className="h-7 w-7 p-0"
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={clearLogs}
              className="h-7 w-7 p-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={downloadLogs}
              className="h-7 w-7 p-0"
            >
              <Download className="h-3 w-3" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 w-7 p-0"
            >
              {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-0">
        <div
          ref={scrollAreaRef}
          onScroll={handleScroll}
          className={cn(
            "bg-gray-950 text-green-400 p-4 overflow-auto transition-all duration-300",
            isExpanded ? "h-96" : "h-64"
          )}
        >
          <div ref={consoleRef} className="space-y-1">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-8">
                {isPaused ? (
                  <span className="font-medium">Console paused - click play to resume</span>
                ) : !connected ? (
                  <div className="space-y-2">
                    <div className="font-medium">Connecting to real-time logs...</div>
                    <div className="text-xs font-medium">Components are ready and will display live data once WebSocket connects</div>
                  </div>
                ) : (
                  <span className="font-medium">Waiting for log entries...</span>
                )}
              </div>
            ) : (
              filteredLogs.map((log) => {
                const levelInfo = LOG_LEVELS[log.level]
                const LogIcon = levelInfo.icon

                return (
                  <div
                    key={log.id}
                    className={cn(
                      "group relative flex items-start space-x-2 p-2 rounded text-xs hover:bg-gray-800 cursor-pointer border border-transparent",
                      levelInfo.borderColor.replace('border-', 'hover:border-')
                    )}
                    onClick={() => copyLogEntry(log)}
                  >
                    {/* Level Icon */}
                    <LogIcon className={cn("h-3 w-3 mt-0.5 flex-shrink-0", levelInfo.color)} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        {showTimestamps && (
                          <span className="text-gray-500 font-mono">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        )}

                        <Badge 
                          variant="outline" 
                          className={cn("text-xs px-1 py-0", levelInfo.color)}
                        >
                          {levelInfo.label}
                        </Badge>

                        {showStages && log.stage && (
                          <Badge variant="outline" className="text-xs px-1 py-0 text-slate-600">
                            {log.stage}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1 text-slate-300 break-words font-medium">
                        {log.message}
                      </div>
                    </div>

                    {/* Copy Button */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {copiedId === log.id ? (
                        <CheckCircle className="h-3 w-3 text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Auto-scroll indicator */}
          {!isAtBottom && (
            <div className="fixed bottom-4 right-4">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setIsAtBottom(true)
                  if (scrollAreaRef.current) {
                    scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
                  }
                }}
                className="shadow-lg"
              >
                ↓ Scroll to bottom
              </Button>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="bg-gray-800 text-gray-300 px-4 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span>{filteredLogs.length} / {logs.length} entries</span>
            {isPaused && <span className="text-yellow-400">PAUSED</span>}
            {!isAtBottom && <span className="text-blue-400">SCROLLED</span>}
          </div>
          <div className="flex items-center space-x-2">
            <span>Job: {jobId}</span>
          </div>
        </div>
      </div>
    </div>
  )
}