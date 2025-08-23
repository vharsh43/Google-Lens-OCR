'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  AlertCircle,
  Play,
  ChevronRight,
  Timer,
  BarChart,
  ZoomIn
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWebSocket } from '@/hooks/use-websocket'

interface Stage {
  id: string
  type: string
  name: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
  startedAt?: Date
  completedAt?: Date
  progress: number
  totalSteps: number
  currentStep: number
  duration?: number
  details?: any
  logs?: string[]
  errorMessage?: string
}

interface ProcessingTimelineProps {
  jobId: string
  stages?: Stage[]
  currentStage?: string
  showDetails?: boolean
  compact?: boolean
  showGanttChart?: boolean
  className?: string
}

const STAGE_CONFIG = {
  INITIALIZATION: {
    name: 'Initialization',
    description: 'Setting up processing environment',
    color: 'blue',
    icon: Play,
    estimatedDuration: 2
  },
  FILE_VALIDATION: {
    name: 'File Validation',
    description: 'Validating uploaded files',
    color: 'yellow',
    icon: CheckCircle,
    estimatedDuration: 5
  },
  PDF_CONVERSION: {
    name: 'PDF Conversion',
    description: 'Converting PDF pages to images',
    color: 'purple',
    icon: Loader2,
    estimatedDuration: 30
  },
  OCR_PROCESSING: {
    name: 'OCR Processing',
    description: 'Extracting text from images',
    color: 'blue',
    icon: BarChart,
    estimatedDuration: 60
  },
  TEXT_EXTRACTION: {
    name: 'Text Extraction',
    description: 'Processing extracted text',
    color: 'green',
    icon: CheckCircle,
    estimatedDuration: 10
  },
  QUALITY_ANALYSIS: {
    name: 'Quality Analysis',
    description: 'Analyzing text quality',
    color: 'orange',
    icon: BarChart,
    estimatedDuration: 15
  },
  FILE_ORGANIZATION: {
    name: 'File Organization',
    description: 'Organizing output files',
    color: 'indigo',
    icon: CheckCircle,
    estimatedDuration: 8
  },
  FINALIZATION: {
    name: 'Finalization',
    description: 'Completing job processing',
    color: 'teal',
    icon: CheckCircle,
    estimatedDuration: 5
  }
}

export function ProcessingTimeline({
  jobId,
  stages = [],
  currentStage,
  showDetails = false,
  compact = false,
  showGanttChart = false,
  className
}: ProcessingTimelineProps) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'timeline' | 'gantt'>('timeline')
  const [realStages, setRealStages] = useState<Stage[]>(stages)
  const [loading, setLoading] = useState(false)

  // Fetch real stages from API
  const fetchStages = useCallback(async () => {
    if (!jobId) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}/stages`)
      if (response.ok) {
        const data = await response.json()
        setRealStages(data.stages || [])
      } else {
        console.error('Failed to fetch stages:', response.statusText)
      }
    } catch (error) {
      console.error('Error fetching stages:', error)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  // Fetch stages on mount and when jobId changes
  useEffect(() => {
    fetchStages()
  }, [fetchStages])

  // Refetch stages periodically when job is active
  useEffect(() => {
    if (!jobId || realStages.length === 0) return

    const hasActiveStages = realStages.some(s => s.status === 'RUNNING' || s.status === 'PENDING')
    if (!hasActiveStages) return

    const interval = setInterval(fetchStages, 2000)
    return () => clearInterval(interval)
  }, [fetchStages, jobId, realStages])

  // WebSocket connection for real-time updates
  const { socket } = useWebSocket()

  // Listen for real-time stage updates
  useEffect(() => {
    if (!socket || !jobId) return

    // Join the job room for real-time updates
    socket.emit('joinJobRoom', jobId)

    // Listen for stage updates
    const handleStageUpdate = (data: any) => {
      if (data.jobId === jobId) {
        fetchStages() // Refresh stages when we get an update
      }
    }

    const handleJobProgress = (data: any) => {
      if (data.jobId === jobId) {
        fetchStages() // Refresh stages on progress updates
      }
    }

    socket.on('stageUpdate', handleStageUpdate)
    socket.on('jobProgress', handleJobProgress)

    return () => {
      socket.off('stageUpdate', handleStageUpdate)
      socket.off('jobProgress', handleJobProgress)
      socket.emit('leaveJobRoom', jobId)
    }
  }, [socket, jobId, fetchStages])

  // Use real stages if available, otherwise fallback to props or empty
  const displayStages = realStages.length > 0 ? realStages : stages

  const getStageStatus = (stage: Stage) => {
    switch (stage.status) {
      case 'COMPLETED':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' }
      case 'RUNNING':
        return { icon: Loader2, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' }
      case 'FAILED':
        return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' }
      case 'PENDING':
        return { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-100', border: 'border-slate-200' }
      case 'SKIPPED':
        return { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' }
      default:
        return { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-100', border: 'border-slate-200' }
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const safeDate = (dateValue: any): Date | null => {
    if (!dateValue) return null
    
    try {
      const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
      return isNaN(date.getTime()) ? null : date
    } catch (error) {
      console.warn('Invalid date value:', dateValue, error)
      return null
    }
  }

  const getElapsedTime = (stage: Stage) => {
    const startTime = safeDate(stage.startedAt)
    if (!startTime) return null
    
    const endTime = safeDate(stage.completedAt) || new Date()
    
    return Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
  }

  const getStageProgress = (stage: Stage) => {
    if (stage.status === 'COMPLETED') return 100
    if (stage.status === 'FAILED' || stage.status === 'SKIPPED') return 0
    if (stage.totalSteps > 0) {
      return Math.round((stage.currentStep / stage.totalSteps) * 100)
    }
    return stage.progress
  }

  const renderTimelineView = () => (
    <div className="space-y-4">
      {displayStages.map((stage, index) => {
        const statusInfo = getStageStatus(stage)
        const config = STAGE_CONFIG[stage.type as keyof typeof STAGE_CONFIG]
        const StatusIcon = statusInfo.icon
        const progress = getStageProgress(stage)
        const elapsedTime = getElapsedTime(stage)
        const isExpanded = expandedStage === stage.id

        return (
          <div key={stage.id} className="relative">
            {/* Timeline connector */}
            {index < displayStages.length - 1 && (
              <div className="absolute left-6 top-12 w-0.5 h-8 bg-slate-200" />
            )}

            <div
              className={cn(
                "flex items-start space-x-4 p-4 rounded-xl border transition-all duration-200",
                statusInfo.bg,
                statusInfo.border,
                stage.status === 'RUNNING' && "shadow-md ring-2 ring-slate-200",
                !compact && "hover:shadow-lg cursor-pointer"
              )}
              onClick={() => !compact && setExpandedStage(isExpanded ? null : stage.id)}
            >
              {/* Status Icon */}
              <div className={cn(
                "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center",
                statusInfo.bg,
                statusInfo.border,
                "border-2"
              )}>
                <StatusIcon className={cn(
                  "h-6 w-6",
                  statusInfo.color,
                  stage.status === 'RUNNING' && "animate-spin"
                )} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 tracking-tight">
                      {config?.name || stage.name}
                    </h3>
                    <p className="text-sm text-slate-600 font-medium">
                      {config?.description || `Stage ${index + 1}`}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Badge variant={stage.status === 'RUNNING' ? 'default' : 'secondary'}>
                      {stage.status}
                    </Badge>
                    {elapsedTime && (
                      <Badge variant="outline" className="text-xs">
                        <Timer className="h-3 w-3 mr-1" />
                        {formatDuration(elapsedTime)}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Progress */}
                {stage.status === 'RUNNING' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">
                        Step {stage.currentStep} of {stage.totalSteps}
                      </span>
                      <span className="text-gray-600">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {/* Expanded Details */}
                {isExpanded && !compact && (
                  <div className="mt-4 space-y-3 border-t pt-3">
                    {/* Timing Information */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Started:</span>
                        <span className="ml-2 text-gray-600">
                          {safeDate(stage.startedAt)?.toLocaleTimeString() || 'Not started'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Completed:</span>
                        <span className="ml-2 text-gray-600">
                          {safeDate(stage.completedAt)?.toLocaleTimeString() || 'In progress'}
                        </span>
                      </div>
                    </div>

                    {/* Error Message */}
                    {stage.errorMessage && (
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <div className="flex items-center space-x-2 text-red-700">
                          <XCircle className="h-4 w-4" />
                          <span className="font-medium">Error:</span>
                        </div>
                        <p className="mt-1 text-red-600 text-sm">{stage.errorMessage}</p>
                      </div>
                    )}

                    {/* Recent Logs */}
                    {stage.logs && stage.logs.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Recent Activity:</h4>
                        <div className="bg-gray-900 text-green-400 rounded p-3 text-xs font-mono max-h-32 overflow-y-auto">
                          {stage.logs.slice(-5).map((log, logIndex) => (
                            <div key={logIndex} className="mb-1">{log}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stage Details */}
                    {stage.details && Object.keys(stage.details).length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Details:</h4>
                        <div className="bg-gray-50 rounded p-3 text-sm">
                          <pre className="whitespace-pre-wrap text-gray-600">
                            {JSON.stringify(stage.details, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Expand indicator */}
              {!compact && (
                <ChevronRight className={cn(
                  "h-4 w-4 text-gray-400 transition-transform",
                  isExpanded && "rotate-90"
                )} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  const getOverallProgress = () => {
    if (displayStages.length === 0) return 0
    const completedStages = displayStages.filter(s => s.status === 'COMPLETED').length
    return Math.round((completedStages / displayStages.length) * 100)
  }

  return (
    <div className={cn("bg-white rounded-2xl shadow-sm border border-slate-200 transition-all duration-200 hover:shadow-md hover:scale-[1.02]", className)}>
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Processing Timeline</h3>
            <Badge variant="outline" className="bg-slate-50 text-slate-700 font-medium">
              {getOverallProgress()}% Complete
            </Badge>
          </div>

          {showGanttChart && (
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant={viewMode === 'timeline' ? 'default' : 'outline'}
                onClick={() => setViewMode('timeline')}
                className="h-8"
              >
                Timeline
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'gantt' ? 'default' : 'outline'}
                onClick={() => setViewMode('gantt')}
                className="h-8"
              >
                Gantt
              </Button>
            </div>
          )}
          
          {!compact && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpandedStage(expandedStage ? null : displayStages[0]?.id)}
              className="h-8"
              title="Toggle details"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Overall Progress */}
        <div className="mt-4">
          <Progress value={getOverallProgress()} className="h-2" />
          <div className="flex justify-between text-xs text-slate-500 mt-1 font-medium">
            <span>
              {displayStages.filter(s => s.status === 'COMPLETED').length} of {displayStages.length} stages completed
            </span>
            <span>
              {displayStages.find(s => s.status === 'RUNNING')?.type?.replace('_', ' ').toLowerCase() || 
               (displayStages.every(s => s.status === 'COMPLETED') ? 'All stages complete' : 'Ready to start')}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
              <span className="text-sm text-slate-500 font-medium">Loading stages...</span>
            </div>
          </div>
        ) : displayStages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 font-medium">Waiting to start</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Processing stages will appear here once the job begins</p>
          </div>
        ) : (
          renderTimelineView()
        )}
      </div>
    </div>
  )
}