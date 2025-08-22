'use client'

import { Loader2, FileText, Upload, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  )
}

interface PageLoadingProps {
  title?: string
  description?: string
}

export function PageLoading({ title = 'Loading...', description }: PageLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" className="mx-auto text-primary" />
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
      </div>
    </div>
  )
}

export function CardLoading({ className = '' }: { className?: string }) {
  return (
    <Card className={`animate-pulse ${className}`}>
      <CardHeader>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          <div className="h-3 bg-gray-200 rounded w-4/6"></div>
        </div>
      </CardContent>
    </Card>
  )
}

export function TableRowLoading({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-6 py-4">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </td>
      ))}
    </tr>
  )
}

interface ProcessingStatusProps {
  status: 'uploading' | 'processing' | 'analyzing' | 'completing'
  progress?: number
}

export function ProcessingStatus({ status, progress }: ProcessingStatusProps) {
  const statusConfig = {
    uploading: {
      icon: Upload,
      title: 'Uploading Files',
      description: 'Transferring your documents to our servers...'
    },
    processing: {
      icon: FileText,
      title: 'Processing Documents',
      description: 'Converting PDFs and running OCR analysis...'
    },
    analyzing: {
      icon: BarChart3,
      title: 'Analyzing Results',
      description: 'Extracting text and generating insights...'
    },
    completing: {
      icon: Loader2,
      title: 'Finalizing',
      description: 'Preparing your results for download...'
    }
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className="text-center space-y-4 p-8">
      <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-primary/10">
        <Icon className={`w-8 h-8 text-primary ${status === 'completing' ? 'animate-spin' : ''}`} />
      </div>
      <div>
        <h3 className="text-lg font-semibold">{config.title}</h3>
        <p className="text-muted-foreground">{config.description}</p>
      </div>
      {progress !== undefined && (
        <div className="w-full max-w-md mx-auto">
          <div className="flex justify-between text-sm mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function SkeletonGrid({ 
  columns = 3, 
  rows = 3, 
  className = '' 
}: { 
  columns?: number
  rows?: number 
  className?: string 
}) {
  return (
    <div className={`grid gap-4 ${className}`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: rows * columns }).map((_, index) => (
        <CardLoading key={index} />
      ))}
    </div>
  )
}

interface LoadingStateProps {
  type: 'page' | 'card' | 'inline' | 'processing'
  title?: string
  description?: string
  progress?: number
  className?: string
}

export function LoadingState({ 
  type, 
  title, 
  description, 
  progress, 
  className = '' 
}: LoadingStateProps) {
  switch (type) {
    case 'page':
      return <PageLoading title={title} description={description} />
    case 'card':
      return <CardLoading className={className} />
    case 'processing':
      return <ProcessingStatus status="processing" progress={progress} />
    case 'inline':
    default:
      return (
        <div className={`flex items-center space-x-2 ${className}`}>
          <LoadingSpinner size="sm" />
          {title && <span>{title}</span>}
        </div>
      )
  }
}

// Hook for managing loading states
export function useLoadingState(initialState = false) {
  const [isLoading, setIsLoading] = React.useState(initialState)
  const [error, setError] = React.useState<string | null>(null)

  const withLoading = async <T,>(asyncFn: () => Promise<T>): Promise<T | null> => {
    try {
      setIsLoading(true)
      setError(null)
      const result = await asyncFn()
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { isLoading, error, setIsLoading, setError, withLoading }
}

import React from 'react'