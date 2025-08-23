'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Wifi,
  WifiOff,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface JobStatusBarProps {
  job: {
    id: string
    name: string
    status: string
    progress: number
    currentOperation?: string
    stage?: string
    connectionStatus: 'connected' | 'disconnected' | 'connecting'
  }
  onStart?: () => void
  onPause?: () => void
  onStop?: () => void
  onRetry?: () => void
  onRefresh?: () => void
}

interface StageInfo {
  name: string
  icon: React.ElementType
  color: string
  description: string
}

const STAGES: Record<string, StageInfo> = {
  INITIALIZATION: {
    name: 'Initializing',
    icon: Activity,
    color: 'text-blue-500',
    description: 'Setting up processing environment'
  },
  FILE_VALIDATION: {
    name: 'Validating',
    icon: CheckCircle,
    color: 'text-yellow-500',
    description: 'Validating uploaded files'
  },
  PDF_CONVERSION: {
    name: 'Converting',
    icon: Loader2,
    color: 'text-purple-500',
    description: 'Converting PDF pages to images'
  },
  OCR_PROCESSING: {
    name: 'OCR Processing',
    icon: Activity,
    color: 'text-blue-500',
    description: 'Extracting text from images'
  },
  TEXT_EXTRACTION: {
    name: 'Extracting',
    icon: Activity,
    color: 'text-green-500',
    description: 'Processing extracted text'
  },
  QUALITY_ANALYSIS: {
    name: 'Analyzing',
    icon: Activity,
    color: 'text-orange-500',
    description: 'Analyzing text quality'
  },
  FILE_ORGANIZATION: {
    name: 'Organizing',
    icon: Activity,
    color: 'text-indigo-500',
    description: 'Organizing output files'
  },
  FINALIZATION: {
    name: 'Finalizing',
    icon: Activity,
    color: 'text-teal-500',
    description: 'Completing job processing'
  }
}

export function JobStatusBar({
  job,
  onStart,
  onPause,
  onStop,
  onRetry,
  onRefresh
}: JobStatusBarProps) {
  const [pulseAnimation, setPulseAnimation] = useState(false)

  useEffect(() => {
    if (job.status === 'PROCESSING' || job.status === 'QUEUED') {
      setPulseAnimation(true)
      const interval = setInterval(() => {
        setPulseAnimation(prev => !prev)
      }, 1000)
      return () => clearInterval(interval)
    }
    setPulseAnimation(false)
  }, [job.status])

  const getStatusIcon = () => {
    switch (job.status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case 'queued':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'cancelled':
        return <Square className="h-5 w-5 text-gray-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    switch (job.status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500'
      case 'failed':
        return 'bg-red-500'
      case 'processing':
        return 'bg-blue-500'
      case 'queued':
        return 'bg-yellow-500'
      case 'cancelled':
        return 'bg-gray-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getCurrentStageInfo = () => {
    if (job.stage && STAGES[job.stage]) {
      return STAGES[job.stage]
    }
    return null
  }

  const getConnectionIcon = () => {
    switch (job.connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-red-500" />
      case 'connecting':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
    }
  }

  const stageInfo = getCurrentStageInfo()

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between">
        {/* Left side - Status and Progress */}
        <div className="flex items-center space-x-4 flex-1">
          {/* Status Indicator */}
          <div className="flex items-center space-x-3">
            <div
              className={cn(
                "relative w-3 h-3 rounded-full",
                getStatusColor(),
                pulseAnimation && "animate-pulse"
              )}
            >
              {job.status === 'PROCESSING' && (
                <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-75"></div>
              )}
            </div>
            {getStatusIcon()}
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-lg">{job.name}</h3>
                <Badge 
                  variant={
                    job.status === 'COMPLETED' ? 'default' : 
                    job.status === 'FAILED' ? 'destructive' : 
                    'secondary'
                  }
                  className={cn(
                    job.status === 'PROCESSING' && "animate-pulse"
                  )}
                >
                  {job.status}
                </Badge>
              </div>
              
              {/* Current Operation */}
              <div className="flex items-center space-x-2 mt-1">
                {stageInfo && (
                  <>
                    <stageInfo.icon className={cn("h-4 w-4", stageInfo.color)} />
                    <span className="text-sm text-gray-600">{stageInfo.description}</span>
                  </>
                )}
                {job.currentOperation && (
                  <span className="text-sm text-gray-500">• {job.currentOperation}</span>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {(job.status === 'PROCESSING' || job.status === 'QUEUED') && (
            <div className="flex-1 max-w-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-sm text-gray-500">{job.progress}%</span>
              </div>
              <Progress value={job.progress} className="h-2" />
            </div>
          )}
        </div>

        {/* Right side - Actions and Connection Status */}
        <div className="flex items-center space-x-3">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {getConnectionIcon()}
            <span className="text-xs text-gray-500 capitalize">
              {job.connectionStatus}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            {job.status === 'READY' && onStart && (
              <Button size="sm" onClick={onStart} className="h-8">
                <Play className="h-3 w-3 mr-1" />
                Start
              </Button>
            )}

            {(job.status === 'PROCESSING' || job.status === 'QUEUED') && (
              <>
                {onPause && (
                  <Button size="sm" variant="outline" onClick={onPause} className="h-8">
                    <Pause className="h-3 w-3 mr-1" />
                    Pause
                  </Button>
                )}
                {onStop && (
                  <Button size="sm" variant="outline" onClick={onStop} className="h-8">
                    <Square className="h-3 w-3 mr-1" />
                    Stop
                  </Button>
                )}
              </>
            )}

            {(job.status === 'FAILED' || job.status === 'CANCELLED') && onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry} className="h-8">
                <RotateCcw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}

            {onRefresh && (
              <Button size="sm" variant="ghost" onClick={onRefresh} className="h-8">
                <Activity className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stage Progress Indicators */}
      {job.status === 'PROCESSING' && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            {Object.entries(STAGES).map(([key, stage], index) => {
              const isActive = job.stage === key
              const isPast = Object.keys(STAGES).indexOf(job.stage || '') > index
              const isFuture = !isActive && !isPast

              return (
                <div key={key} className="flex items-center">
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full transition-all duration-300",
                      isActive && "bg-blue-500 ring-2 ring-blue-200 animate-pulse",
                      isPast && "bg-green-500",
                      isFuture && "bg-gray-200"
                    )}
                  />
                  <span
                    className={cn(
                      "ml-2 text-xs transition-all duration-300",
                      isActive && "text-blue-600 font-medium",
                      isPast && "text-green-600",
                      isFuture && "text-gray-400"
                    )}
                  >
                    {stage.name}
                  </span>
                  {index < Object.keys(STAGES).length - 1 && (
                    <div
                      className={cn(
                        "mx-3 h-px w-8 transition-all duration-300",
                        isPast ? "bg-green-500" : "bg-gray-200"
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}