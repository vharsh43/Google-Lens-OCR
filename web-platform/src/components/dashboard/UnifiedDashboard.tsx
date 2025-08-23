'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  File, 
  X, 
  CheckCircle, 
  AlertCircle, 
  PlayCircle,
  PauseCircle,
  BarChart3,
  FileText,
  Download,
  Eye,
  Trash2,
  Plus,
  Zap,
  Clock,
  Target,
  Activity,
  Brain,
  Rocket,
  RefreshCw,
  RotateCcw
} from 'lucide-react'
import { formatBytes, formatRelativeTime } from '@/lib/utils'
import { useToast } from '@/components/toast-provider'
import { ApiErrorHandler, validateFile } from '@/lib/api-error-handler'
import { MetricsCards } from './metrics-cards'
import { ProcessingTimeline } from './processing-timeline'
import { LiveConsole } from './live-console'
import { DirectoryTree } from './directory-tree'
import { FilePreviewModal } from './file-preview-modal'
import { useJobProgress } from '@/hooks/use-websocket'
import { cn } from '@/lib/utils'

interface UploadFile {
  id: string
  name: string
  size: number
  type: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  progress?: number
  originalFile: File
}

interface Job {
  id: string
  name: string
  status: string
  progress: number
  totalFiles: number
  processedFiles: number
  successfulFiles: number
  failedFiles: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  fileSize?: string
}

type DashboardView = 'overview' | 'upload' | 'processing' | 'results'

export function UnifiedDashboard() {
  // Upload state
  const [files, setFiles] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [jobName, setJobName] = useState('')
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Toast notifications
  const { success: showToast, info: showInfo, error: showError } = useToast()
  
  // Job management state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [recentJobs, setRecentJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [activeView, setActiveView] = useState<DashboardView>('overview')
  
  // Preview state
  const [previewFile, setPreviewFile] = useState<{jobId: string, fileId: string, fileName: string} | null>(null)
  
  const toast = useToast()
  const jobProgress = useJobProgress(currentJobId)

  // Load recent jobs on mount
  useEffect(() => {
    loadRecentJobs()
  }, [])

  // Auto-refresh jobs when there are active processing jobs
  useEffect(() => {
    const hasActiveJobs = recentJobs.some(job => 
      job.status === 'PROCESSING' || job.status === 'QUEUED' || job.status === 'RUNNING'
    )
    
    if (!hasActiveJobs) return

    const interval = setInterval(() => {
      loadRecentJobs()
    }, 3000) // Refresh every 3 seconds when jobs are active

    return () => clearInterval(interval)
  }, [recentJobs])

  // Auto-switch to processing view when upload completes
  useEffect(() => {
    if (uploadResult?.jobId) {
      // Always switch to the new job, regardless of current selection
      setCurrentJobId(uploadResult.jobId)
      setActiveView('processing')
      
      // Find and select the new job from the recent jobs list
      const newJob = recentJobs.find(job => job.id === uploadResult.jobId)
      if (newJob) {
        setSelectedJob(newJob)
      }
    }
  }, [uploadResult, recentJobs])

  const loadRecentJobs = async () => {
    try {
      const response = await fetch('/api/jobs?limit=10')
      if (response.ok) {
        const data = await response.json()
        setRecentJobs(data.jobs || [])
        
        // Set first job as selected if none selected
        if (!selectedJob && data.jobs?.length > 0) {
          setSelectedJob(data.jobs[0])
          setCurrentJobId(data.jobs[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load recent jobs:', error)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadError(null)
    setActiveView('upload')
    
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending' as const,
      progress: 0,
      name: file.name,
      size: file.size,
      type: file.type,
      originalFile: file
    }))

    const validFiles: UploadFile[] = []
    const rejectedFiles: string[] = []
    const duplicateFiles: string[] = []
    
    newFiles.forEach(file => {
      const errors = validateFile(file.originalFile)
      if (errors.length > 0) {
        rejectedFiles.push(`${file.name}: ${errors.join(', ')}`)
      } else {
        validFiles.push(file)
      }
    })

    // Filter out duplicate files (by name and size)
    let uniqueNewFiles: UploadFile[] = []
    
    setFiles(prevFiles => {
      const existingFiles = new Set(prevFiles.map(f => `${f.name}-${f.size}`))
      uniqueNewFiles = validFiles.filter(file => {
        const fileKey = `${file.name}-${file.size}`
        if (existingFiles.has(fileKey)) {
          duplicateFiles.push(file.name)
          return false
        }
        return true
      })

      return [...prevFiles, ...uniqueNewFiles]
    })

    // Show feedback messages after state update
    if (rejectedFiles.length > 0) {
      setUploadError(`Invalid files: ${rejectedFiles.join('; ')}`)
    } else if (duplicateFiles.length > 0) {
      showInfo(`Skipped duplicate files: ${duplicateFiles.join(', ')}`)
    }

    if (uniqueNewFiles.length > 0) {
      showToast(`Added ${uniqueNewFiles.length} file(s) to queue`)
    }
  }, [files])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    maxFiles: 20,
    maxSize: 50 * 1024 * 1024 // 50MB
  })

  const generateJobName = () => {
    const now = new Date()
    const timestamp = now.toISOString().slice(0, 19).replace('T', ' ')
    return `OCR Job - ${timestamp}`
  }

  const startUpload = async () => {
    if (files.length === 0) {
      setUploadError('Please select files to upload')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setUploadError(null)

    try {
      const finalJobName = jobName.trim() || generateJobName()
      const formData = new FormData()
      formData.append('jobName', finalJobName)
      files.forEach(file => formData.append('files', file.originalFile))

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()
      setUploadResult(result)
      setFiles([])
      setJobName('')
      
      // Immediately refresh job list to show the new job
      await loadRecentJobs()
      
      toast.success(`Upload successful! Processing ${result.totalFiles} files`)
      
    } catch (error) {
      const errorMessage = ApiErrorHandler.handle(error).message
      setUploadError(errorMessage)
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const selectJob = (job: Job) => {
    setSelectedJob(job)
    setCurrentJobId(job.id)
    setActiveView(job.status === 'COMPLETED' ? 'results' : 'processing')
  }

  const processJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start processing')
      }

      const result = await response.json()
      toast.success('Processing started successfully!')
      
      // Update job status and refresh job list
      await loadRecentJobs()
      
      // If this is the current job, switch to processing view
      if (jobId === currentJobId) {
        setActiveView('processing')
      }
      
    } catch (error) {
      const errorMessage = ApiErrorHandler.handle(error).message
      toast.error(`Failed to start processing: ${errorMessage}`)
    }
  }

  const fixJobStatus = async (jobId: string) => {
    try {
      showToast('Checking job status...', 'info')
      
      const response = await fetch(`/api/jobs/${jobId}/fix-status`, {
        method: 'POST'
      })

      const result = await response.json()
      
      if (response.ok) {
        showToast(`Job status fixed: ${result.message}`, 'success')
        // Refresh the jobs list to show updated status
        await loadRecentJobs()
      } else {
        throw new Error(result.error || 'Failed to fix job status')
      }
    } catch (error) {
      showToast(`Failed to fix job status: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }
  }

  const retryJob = async (jobId: string) => {
    try {
      showInfo('Retrying job...', 'Please wait while we restart the processing for this job.')
      
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST'
      })

      const result = await response.json()
      
      if (response.ok) {
        showToast(`Job retry successful! ${result.message}`, 'success')
        // Refresh the jobs list to show updated status
        await loadRecentJobs()
      } else {
        throw new Error(result.error || 'Failed to retry job')
      }
    } catch (error) {
      showError(`Failed to retry job: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const getJobStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-600'
      case 'processing': case 'running': return 'bg-slate-600'
      case 'failed': case 'error': return 'bg-red-600'
      case 'queued': case 'pending': return 'bg-amber-600'
      default: return 'bg-slate-400'
    }
  }

  const renderUploadZone = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Upload Documents</h1>
        <p className="text-slate-600">Upload PDF files or images to start OCR processing</p>
      </div>

      {/* Quick Upload Card */}
      <div className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl transition-all duration-300 bg-slate-50 hover:bg-slate-100">
        <div className="p-8 lg:p-12">
          <div
            {...getRootProps()}
            className={cn(
              "cursor-pointer transition-all duration-200",
              isDragActive ? "scale-105" : ""
            )}
          >
            <input {...getInputProps()} />
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center transition-all duration-200 hover:from-slate-200 hover:to-slate-300">
                <Upload className="h-8 w-8 text-slate-700" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {isDragActive ? 'Drop files here' : 'Drop files or click to browse'}
                </h3>
                <p className="text-slate-600 mb-2">
                  Supports PDF files and images
                </p>
                <p className="text-sm text-slate-500">
                  Maximum 50MB per file, up to 20 files
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Configuration */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-slate-100 rounded-lg">
                  <FileText className="h-4 w-4 text-slate-700" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Configure Upload</h3>
              </div>
              <span className="text-sm text-slate-500">{files.length} files selected</span>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Job Name <span className="text-slate-500 text-xs">(optional)</span>
              </label>
              <Input
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="Leave empty to auto-generate with timestamp"
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-900 mb-3">
                Selected Files
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50">
                {files.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="p-1.5 bg-slate-100 rounded-md">
                        <File className="h-3.5 w-3.5 text-slate-600" />
                      </div>
                      <span className="text-sm font-medium text-slate-900 truncate">{file.name}</span>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md whitespace-nowrap">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                    <button
                      onClick={() => setFiles(files.filter(f => f.id !== file.id))}
                      className="p-1.5 hover:bg-slate-100 rounded-md transition-colors duration-200 ml-2 flex-shrink-0"
                    >
                      <X className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {uploadError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-700">{uploadError}</div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={startUpload}
                disabled={uploading || files.length === 0}
                className="flex-1 bg-slate-900 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {uploading ? (
                  <>
                    <Activity className="h-4 w-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Start Upload</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setFiles([])}
                disabled={uploading}
                className="px-6 py-3 border border-slate-200 text-slate-700 rounded-lg font-medium transition-all duration-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear All
              </button>
            </div>

            {uploading && (
              <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Activity className="h-4 w-4 text-blue-600 animate-spin" />
                  <span className="text-sm font-medium text-blue-800">Processing Upload</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-blue-600">
                  Uploading files and initializing OCR processing...
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  const renderJobsList = () => (
    <div className="space-y-4">
      {recentJobs.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No jobs yet</h3>
          <p className="text-slate-500 mb-4">Start by uploading some documents to process</p>
          <button
            onClick={() => setActiveView('upload')}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Upload Files
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-600">{recentJobs.length} jobs total</span>
            <button
              onClick={loadRecentJobs}
              className="border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2"
            >
              <Activity className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
      
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {recentJobs.map(job => (
              <div
                key={job.id}
                className={cn(
                  "cursor-pointer transition-all duration-200 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm",
                  selectedJob?.id === job.id ? "ring-2 ring-slate-300 bg-slate-50" : ""
                )}
                onClick={() => selectJob(job)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", getJobStatusColor(job.status))} />
                        <h4 className="font-medium text-sm text-slate-900 truncate">{job.name}</h4>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {job.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-slate-500">
                        <span className="flex items-center space-x-1">
                          <FileText className="h-3 w-3" />
                          <span>{job.processedFiles}/{job.totalFiles}</span>
                        </span>
                        <span>{formatRelativeTime(new Date(job.createdAt))}</span>
                        {job.fileSize && <span>{formatBytes(parseInt(job.fileSize))}</span>}
                      </div>
                      {job.status === 'PROCESSING' && (
                        <div className="mt-2">
                          <Progress value={job.progress} className="h-1.5" />
                          <span className="text-xs text-slate-500 mt-1">{job.progress}% complete</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 ml-3">
                      {job.status === 'COMPLETED' && (
                        <div className="flex items-center space-x-1">
                          <button 
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveView('results')
                              setSelectedJob(job)
                            }}
                            title="View processing results"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {job.failedFiles > 0 && (
                            <button 
                              className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600 hover:text-blue-700"
                              onClick={(e) => {
                                e.stopPropagation()
                                retryJob(job.id)
                              }}
                              title={`Retry ${job.failedFiles} failed files`}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                      {job.status === 'PROCESSING' && (
                        <div className="p-2">
                          <Activity className="h-4 w-4 text-blue-500 animate-spin" />
                        </div>
                      )}
                      {job.status === 'FAILED' && (
                        <div className="flex items-center space-x-1">
                          <button 
                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600 hover:text-blue-700"
                            onClick={(e) => {
                              e.stopPropagation()
                              retryJob(job.id)
                            }}
                            title="Retry processing - restart the job from the beginning"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          <button 
                            className="p-2 hover:bg-orange-100 rounded-lg transition-colors text-orange-500 hover:text-orange-700"
                            onClick={(e) => {
                              e.stopPropagation()
                              fixJobStatus(job.id)
                            }}
                            title="Fix job status - check if processing was actually successful"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )

  const renderMainContent = () => {
    switch (activeView) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Dashboard Overview</h1>
              <p className="text-slate-600">Monitor your OCR processing jobs and system performance</p>
            </div>

            {/* Quick Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 mb-1">Total Jobs</p>
                    <p className="text-2xl font-bold text-slate-900">{recentJobs.length}</p>
                  </div>
                  <div className="p-2 bg-slate-200 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-slate-700" />
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700 mb-1">Completed</p>
                    <p className="text-2xl font-bold text-green-900">
                      {recentJobs.filter(j => j.status === 'COMPLETED').length}
                    </p>
                  </div>
                  <div className="p-2 bg-green-200 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-700" />
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700 mb-1">Processing</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {recentJobs.filter(j => j.status === 'PROCESSING').length}
                    </p>
                  </div>
                  <div className="p-2 bg-blue-200 rounded-lg">
                    <Activity className="h-5 w-5 text-blue-700" />
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700 mb-1">Total Files</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {recentJobs.reduce((sum, job) => sum + job.totalFiles, 0)}
                    </p>
                  </div>
                  <div className="p-2 bg-purple-200 rounded-lg">
                    <FileText className="h-5 w-5 text-purple-700" />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Recent Jobs</h3>
                  <button
                    onClick={() => setActiveView('upload')}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>New Job</span>
                  </button>
                </div>
              </div>
              <div className="p-6">
                {renderJobsList()}
              </div>
            </div>
          </div>
        )

      case 'upload':
        return renderUploadZone()

      case 'processing':
        return currentJobId ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Job Processing</h1>
              <p className="text-slate-600">Monitor real-time progress and processing stages</p>
            </div>

            {/* Job Header */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={cn("w-3 h-3 rounded-full", getJobStatusColor(selectedJob?.status || 'PENDING'))} />
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{selectedJob?.name || 'Processing Job'}</h3>
                      <p className="text-sm text-slate-500">Job ID: {currentJobId.slice(-8)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "font-medium",
                        selectedJob?.status === 'COMPLETED' && "border-green-200 text-green-700",
                        selectedJob?.status === 'PROCESSING' && "border-blue-200 text-blue-700",
                        selectedJob?.status === 'READY' && "border-green-200 text-green-700",
                        selectedJob?.status === 'FAILED' && "border-red-200 text-red-700"
                      )}
                    >
                      {selectedJob?.status || 'UNKNOWN'}
                    </Badge>
                    {selectedJob?.status === 'READY' && (
                      <button
                        onClick={() => processJob(selectedJob.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm flex items-center space-x-2"
                      >
                        <PlayCircle className="h-4 w-4" />
                        <span>Start Processing</span>
                      </button>
                    )}
                    {selectedJob?.status === 'COMPLETED' && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setActiveView('results')}
                          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm flex items-center space-x-2"
                        >
                          <Eye className="h-4 w-4" />
                          <span>View Results</span>
                        </button>
                        {selectedJob.failedFiles > 0 && (
                          <button
                            onClick={() => retryJob(selectedJob.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm flex items-center space-x-2"
                          >
                            <RotateCcw className="h-4 w-4" />
                            <span>Retry Failed Files</span>
                          </button>
                        )}
                      </div>
                    )}
                    {selectedJob?.status === 'FAILED' && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => retryJob(selectedJob.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm flex items-center space-x-2"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span>Retry Processing</span>
                        </button>
                        <button
                          onClick={() => fixJobStatus(selectedJob.id)}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm flex items-center space-x-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span>Fix Status</span>
                        </button>
                      </div>
                    )}
                    {selectedJob?.status === 'QUEUED' && (
                      <div className="flex items-center space-x-2 text-sm text-slate-600">
                        <Clock className="h-4 w-4" />
                        <span>In Queue</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Status-based Instructions */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl">
              <div className="p-4">
                {selectedJob?.status === 'READY' && (
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <PlayCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-green-800">Ready to Process</h4>
                      <p className="text-sm text-green-600">
                        Your files have been uploaded successfully. Click "Start Processing" to begin OCR processing.
                      </p>
                    </div>
                  </div>
                )}
                {selectedJob?.status === 'QUEUED' && (
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-yellow-100 rounded-full">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-yellow-800">In Queue</h4>
                      <p className="text-sm text-yellow-600">
                        Your job is queued for processing. It will start automatically when resources are available.
                      </p>
                    </div>
                  </div>
                )}
                {(selectedJob?.status === 'PROCESSING' || selectedJob?.status === 'RUNNING') && (
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Activity className="h-5 w-5 text-blue-600 animate-spin" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-blue-800">Processing in Progress</h4>
                      <p className="text-sm text-blue-600">
                        OCR processing is currently running. Monitor progress in real-time below.
                      </p>
                    </div>
                  </div>
                )}
                {selectedJob?.status === 'COMPLETED' && (
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-green-800">Processing Complete</h4>
                      <p className="text-sm text-green-600">
                        All files have been processed successfully. View results or download your extracted text.
                      </p>
                    </div>
                  </div>
                )}
                {selectedJob?.status === 'FAILED' && (
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-red-100 rounded-full">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-red-800">Processing Failed</h4>
                      <p className="text-sm text-red-600">
                        An error occurred during processing. Check the console logs for details and try reprocessing.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Real-time Metrics */}
            <MetricsCards jobId={currentJobId} />

            {/* Processing Timeline */}
            <ProcessingTimeline jobId={currentJobId} />

            {/* Live Console */}
            <LiveConsole jobId={currentJobId} />
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="mx-auto w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                <Brain className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Active Job</h3>
              <p className="text-slate-500 mb-6">Upload documents to start OCR processing and monitor progress here</p>
              <button
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 mx-auto"
                onClick={() => setActiveView('upload')}
              >
                <Upload className="h-4 w-4" />
                <span>Upload Documents</span>
              </button>
            </div>
          </div>
        )

      case 'results':
        return currentJobId ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Processing Results</h1>
              <p className="text-slate-600">Download and review your processed documents</p>
            </div>

            {/* Results Header */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{selectedJob?.name || 'Job Results'}</h3>
                      <p className="text-sm text-slate-500">Processing completed successfully</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm flex items-center space-x-2">
                      <Download className="h-4 w-4" />
                      <span>Download All</span>
                    </button>
                    <button
                      onClick={() => setActiveView('processing')}
                      className="border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm flex items-center space-x-2"
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span>View Processing</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Metrics */}
            <MetricsCards jobId={currentJobId} />

            {/* File Tree */}
            <DirectoryTree 
              jobId={currentJobId} 
              onFileSelect={(file) => setPreviewFile({
                jobId: currentJobId || '',
                fileId: file.fileId || file.id || '',
                fileName: file.name
              })} 
              onFilePreview={(file) => setPreviewFile({
                jobId: currentJobId || '',
                fileId: file.fileId || file.id || '',
                fileName: file.name
              })}
            />
          </div>
        ) : null

      default:
        return null
    }
  }

  return (
    <div className="h-[calc(100vh-80px)] transition-all duration-300">
      {/* Global Upload Drop Zone */}
      <div 
        {...getRootProps({ onClick: (e) => e.stopPropagation() })}
        className={cn(
          "fixed inset-0 z-50 pointer-events-none transition-all duration-300",
          isDragActive ? "bg-slate-900/20 backdrop-blur-sm pointer-events-auto" : ""
        )}
      >
        {isDragActive && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8 bg-white rounded-xl shadow-2xl border-2 border-slate-300 border-dashed max-w-md mx-4">
              <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Upload className="h-8 w-8 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Drop files to upload
              </h2>
              <p className="text-slate-600">Release to start OCR processing</p>
            </div>
          </div>
        )}
      </div>

      <div className="h-full">
        <div className="flex h-full">
          {/* Sidebar - 15-20% width */}
          <div className="w-1/5 min-w-[280px] bg-gray-50 border-r border-slate-200 p-6 overflow-y-auto">
            {/* Navigation */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="p-4">
                <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wider mb-3">Navigation</h2>
                <div className="space-y-1">
                  <button
                    onClick={() => setActiveView('overview')}
                    className={`
                      w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                      ${activeView === 'overview'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }
                    `}
                  >
                    <BarChart3 className="h-4 w-4 mr-3" />
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveView('upload')}
                    className={`
                      w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                      ${activeView === 'upload'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }
                    `}
                  >
                    <Upload className="h-4 w-4 mr-3" />
                    Upload
                  </button>
                  {currentJobId && (
                    <>
                      <button
                        onClick={() => setActiveView('processing')}
                        className={`
                          w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                          ${activeView === 'processing'
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }
                        `}
                      >
                        <Activity className="h-4 w-4 mr-3" />
                        Processing
                      </button>
                      {selectedJob?.status === 'COMPLETED' && (
                        <button
                          onClick={() => setActiveView('results')}
                          className={`
                            w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                            ${activeView === 'results'
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }
                          `}
                        >
                          <Eye className="h-4 w-4 mr-3" />
                          Results
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Jobs in Sidebar */}
            {recentJobs.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-4 py-3 border-b border-slate-200">
                  <h3 className="text-sm font-medium text-slate-600 uppercase tracking-wider">Recent Jobs</h3>
                </div>
                <div className="p-4">
                  <div className="space-y-1">
                    {recentJobs.slice(0, 5).map(job => (
                      <button
                        key={job.id}
                        onClick={() => selectJob(job)}
                        className={`
                          w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200
                          ${selectedJob?.id === job.id
                            ? 'bg-slate-100 border border-slate-200'
                            : 'hover:bg-slate-50'
                          }
                        `}
                      >
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", getJobStatusColor(job.status))} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{job.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {job.processedFiles}/{job.totalFiles} files
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content - 80-85% width */}
          <div className="flex-1 bg-white p-6 overflow-y-auto">
            <div className="h-full">
              {renderMainContent()}
            </div>
          </div>
        </div>
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          isOpen={true}
          jobId={previewFile.jobId}
          fileId={previewFile.fileId}
          fileName={previewFile.fileName}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  )
}