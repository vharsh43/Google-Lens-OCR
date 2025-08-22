'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Play, 
  Pause, 
  Download, 
  RefreshCw, 
  Eye, 
  Trash2, 
  Clock,
  File,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  RotateCcw
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { formatBytes, formatRelativeTime, getStatusColor } from '@/lib/utils'
import FilePreviewModal from '@/components/file-preview-modal'

interface JobData {
  id: string
  name: string
  status: string
  progress: number
  totalFiles: number
  processedFiles: number
  successfulFiles: number
  failedFiles: number
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  stats: {
    totalSize: number
    completedFiles: number
    failedFiles: number
    processingFiles: number
    pendingFiles: number
  }
  eta: string
  queueStatus?: {
    progress: number
    attemptsMade: number
  }
  files?: Array<{
    id: string
    originalName: string
    fileName: string
    fileSize: number
    status: string
    processingStartedAt?: string
    processingCompletedAt?: string
    result?: {
      pngCount: number
      pageCount: number
      ocrConfidence: number
      detectedLanguages: string[]
      processingDuration: number
      errorDetails?: string
    }
  }>
}

export default function JobDetailsPage() {
  const params = useParams()
  const jobId = params.id as string
  
  const [job, setJob] = useState<JobData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [previewFile, setPreviewFile] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Fetch initial job data
  useEffect(() => {
    const fetchJob = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch job')
        }
        const jobData = await response.json()
        setJob(jobData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchJob()
  }, [jobId])

  // Setup Server-Sent Events for real-time updates
  useEffect(() => {
    if (!job) return

    const es = new EventSource(`/api/sse/jobs/${jobId}`)
    setEventSource(es)

    es.onopen = () => {
      setConnectionStatus('connected')
    }

    es.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (data.type) {
        case 'job_update':
          setJob(prevJob => ({
            ...prevJob!,
            ...data.job
          }))
          break
        
        case 'job_completed':
          setJob(prevJob => ({
            ...prevJob!,
            status: data.status,
            stats: data.finalStats
          }))
          break
        
        case 'error':
          console.error('SSE Error:', data.message)
          break
      }
    }

    es.onerror = () => {
      setConnectionStatus('disconnected')
    }

    return () => {
      es.close()
    }
  }, [job?.id, jobId])

  const handleStartProcessing = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configuration: { dpi: 300 } })
      })
      
      if (!response.ok) {
        throw new Error('Failed to start processing')
      }
      
      const result = await response.json()
      setJob(prev => prev ? { ...prev, status: 'QUEUED' } : null)
    } catch (err) {
      alert(`Failed to start processing: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleCancelJob = async () => {
    if (!confirm('Are you sure you want to cancel this job?')) return
    
    try {
      const response = await fetch(`/api/jobs/${jobId}/process`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to cancel job')
      }
      
      setJob(prev => prev ? { ...prev, status: 'CANCELLED' } : null)
    } catch (err) {
      alert(`Failed to cancel job: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleDownload = async (type: 'all' | 'text' | 'images') => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/download?format=zip&type=${type}`)
      
      if (!response.ok) {
        throw new Error('Failed to download job results')
      }
      
      // Create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${job?.name.replace(/[^a-zA-Z0-9-_]/g, '_')}_${type}_results.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Failed to download: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleDownloadIndividualFile = async (fileId: string, fileName: string, type: 'all' | 'text' | 'images' = 'all') => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/download?format=individual&fileId=${fileId}&type=${type}`)
      
      if (!response.ok) {
        throw new Error('Failed to download file')
      }
      
      // Create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fileName.replace(/[^a-zA-Z0-9-_]/g, '_')}_results.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Failed to download file: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handlePreviewFile = (file: any) => {
    setPreviewFile(file)
    setShowPreview(true)
  }

  const handleClosePreview = () => {
    setShowPreview(false)
    setPreviewFile(null)
  }

  const handleRetryJob = async () => {
    if (!confirm('Are you sure you want to retry this job? This will restart the processing from the beginning.')) return
    
    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Failed to retry job')
      }
      
      const result = await response.json()
      setJob(prev => prev ? { ...prev, status: 'QUEUED' } : null)
      
      alert(`Job queued for retry. Estimated wait time: ${result.estimatedWaitTime}`)
    } catch (err) {
      alert(`Failed to retry job: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case 'queued':
        return <Clock className="h-5 w-5 text-yellow-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading job details...</span>
        </div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="text-center py-8">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Job Not Found</h2>
            <p className="text-muted-foreground">{error || 'The requested job could not be found.'}</p>
            <Button className="mt-4" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Prepare chart data
  const progressData = job.files?.map((file, index) => ({
    name: `File ${index + 1}`,
    status: file.status === 'COMPLETED' ? 100 : file.status === 'PROCESSING' ? 50 : 0,
    confidence: file.result?.ocrConfidence || 0
  })) || []

  const statusDistribution = [
    { name: 'Completed', value: job.stats.completedFiles, color: '#10b981' },
    { name: 'Processing', value: job.stats.processingFiles, color: '#3b82f6' },
    { name: 'Pending', value: job.stats.pendingFiles, color: '#f59e0b' },
    { name: 'Failed', value: job.stats.failedFiles, color: '#ef4444' },
  ].filter(item => item.value > 0)

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            {getStatusIcon(job.status)}
            <h1 className="text-3xl font-bold">{job.name}</h1>
            <Badge variant={job.status === 'COMPLETED' ? 'success' : job.status === 'FAILED' ? 'destructive' : 'default'}>
              {job.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Created {formatRelativeTime(job.startedAt || new Date())}
          </p>
          {connectionStatus !== 'connected' && (
            <div className="flex items-center gap-2 mt-2">
              <div className="h-2 w-2 bg-red-500 rounded-full"></div>
              <span className="text-sm text-red-600">Real-time updates disconnected</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {job.status === 'READY' && (
            <Button onClick={handleStartProcessing}>
              <Play className="mr-2 h-4 w-4" />
              Start Processing
            </Button>
          )}
          
          {(job.status === 'QUEUED' || job.status === 'PROCESSING') && (
            <Button variant="outline" onClick={handleCancelJob}>
              <Pause className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}

          {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
            <Button variant="outline" onClick={handleRetryJob}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry Job
            </Button>
          )}
          
          {job.status === 'COMPLETED' && (
            <div className="flex gap-2">
              <Button onClick={() => handleDownload('all')}>
                <Download className="mr-2 h-4 w-4" />
                Download All
              </Button>
              <Button variant="outline" onClick={() => handleDownload('text')}>
                Download Text Only
              </Button>
              <Button variant="outline" onClick={() => handleDownload('images')}>
                Download Images Only
              </Button>
            </div>
          )}
          
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{job.totalFiles}</div>
            <p className="text-xs text-muted-foreground">
              {formatBytes(job.stats.totalSize)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{job.progress}%</div>
            <Progress value={job.progress} className="mt-2" />
            {job.eta && job.eta !== 'N/A' && (
              <p className="text-xs text-muted-foreground mt-1">ETA: {job.eta}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{job.successfulFiles}</div>
            <p className="text-xs text-muted-foreground">
              {job.totalFiles > 0 ? Math.round((job.successfulFiles / job.totalFiles) * 100) : 0}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{job.failedFiles}</div>
            <p className="text-xs text-muted-foreground">
              {job.totalFiles > 0 ? Math.round((job.failedFiles / job.totalFiles) * 100) : 0}% failure rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>File Processing Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="status" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* File List */}
      {job.files && job.files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Files ({job.files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {job.files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3 flex-1">
                    <File className="h-5 w-5 text-red-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.originalName}</p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>{formatBytes(file.fileSize)}</span>
                        {file.result && (
                          <>
                            <span>{file.result.pageCount} pages</span>
                            <span>{file.result.pngCount} PNGs</span>
                            <span>{Math.round(file.result.ocrConfidence * 100)}% confidence</span>
                            {file.result.detectedLanguages.length > 0 && (
                              <span>Languages: {file.result.detectedLanguages.join(', ')}</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant={file.status === 'COMPLETED' ? 'success' : file.status === 'FAILED' ? 'destructive' : 'default'}>
                      {file.status}
                    </Badge>
                    {file.status === 'COMPLETED' && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handlePreviewFile(file)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadIndividualFile(file.id, file.originalName, 'all')}>
                              Download All Results
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadIndividualFile(file.id, file.originalName, 'text')}>
                              Download Text Only
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadIndividualFile(file.id, file.originalName, 'images')}>
                              Download Images Only
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {job.errorMessage && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{job.errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          open={showPreview}
          onClose={handleClosePreview}
          file={previewFile}
          jobId={jobId}
          onDownload={handleDownloadIndividualFile}
        />
      )}
    </div>
  )
}