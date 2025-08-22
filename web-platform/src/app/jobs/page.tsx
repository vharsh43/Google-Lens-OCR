'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Plus, 
  Search, 
  Eye, 
  Trash2, 
  Play, 
  Pause,
  Download,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  RotateCcw
} from 'lucide-react'
import { formatBytes, formatRelativeTime, getStatusColor } from '@/lib/utils'
import { useToast } from '@/components/toast-provider'
import { ApiErrorHandler } from '@/lib/api-error-handler'
import { LoadingState, CardLoading } from '@/components/loading-states'
import { AppLayout } from '@/components/app-layout'

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
  fileCount: number
}

interface JobsResponse {
  jobs: Job[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<JobsResponse['pagination'] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const toast = useToast()

  const fetchJobs = async (page = 1, search = '', status = 'all') => {
    try {
      setRefreshing(true)
      setError(null)
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(status !== 'all' && { status }),
        ...(search && { search })
      })

      const url = `/api/upload?${params}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data: JobsResponse = await response.json()
      
      setJobs(data.jobs)
      setPagination(data.pagination)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load jobs'
      setError(errorMessage)
      toast.error('Failed to fetch jobs', errorMessage)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    
    const loadJobs = async () => {
      try {
        console.log('fetchJobs called:', { currentPage, searchTerm, statusFilter, loading })
        setRefreshing(true)
        setError(null)
        
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: '10',
          ...(statusFilter !== 'all' && { status: statusFilter }),
          ...(searchTerm && { search: searchTerm })
        })

        const url = `/api/upload?${params}`
        console.log('Fetching URL:', url)
        
        // Use native fetch with timeout as fallback
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        clearTimeout(timeoutId)
        console.log('Response received:', response.status, response.ok)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data: JobsResponse = await response.json()
        console.log('Data parsed:', data)
        
        if (isMounted) {
          setJobs(data.jobs)
          setPagination(data.pagination)
          console.log('State updated successfully')
        }
      } catch (err) {
        console.error('fetchJobs error:', err)
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load jobs'
          setError(errorMessage)
          toast.error('Failed to fetch jobs', errorMessage)
        }
      } finally {
        if (isMounted) {
          console.log('Setting loading to false')
          setLoading(false)
          setRefreshing(false)
        }
      }
    }
    
    // Fallback timeout to prevent infinite loading
    const fallbackTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('Fallback: Setting loading to false after timeout')
        setLoading(false)
        if (jobs.length === 0) {
          setError('Unable to load jobs. Please refresh the page.')
        }
      }
    }, 5000) // 5 second timeout
    
    loadJobs()
    
    return () => {
      isMounted = false
      clearTimeout(fallbackTimeout)
    }
  }, [currentPage, searchTerm, statusFilter])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    setCurrentPage(1)
  }

  const handleStartProcessing = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configuration: { dpi: 300 } })
      })
      
      if (!response.ok) {
        throw new Error('Failed to start processing')
      }
      
      // Refresh jobs list
      fetchJobs(currentPage, searchTerm, statusFilter)
    } catch (err) {
      alert(`Failed to start processing: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleDeleteJob = async (jobId: string, jobName: string) => {
    if (!confirm(`Are you sure you want to delete "${jobName}"? This action cannot be undone.`)) {
      return
    }
    
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete job')
      }
      
      // Refresh jobs list
      fetchJobs(currentPage, searchTerm, statusFilter)
    } catch (err) {
      alert(`Failed to delete job: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleDownloadJob = async (jobId: string, jobName: string) => {
    try {
      toast.info('Starting download...', 'Preparing your files for download')
      
      const response = await ApiErrorHandler.safeFetch(`/api/jobs/${jobId}/download?format=zip&type=all`)
      
      // Create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${jobName.replace(/[^a-zA-Z0-9-_]/g, '_')}_results.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Download started', 'Your files are being downloaded')
    } catch (err) {
      const apiError = ApiErrorHandler.handle(err)
      toast.error('Download failed', apiError.message)
    }
  }

  const handleRetryJob = async (jobId: string, jobName: string) => {
    if (!confirm(`Are you sure you want to retry "${jobName}"? This will restart the processing from the beginning.`)) {
      return
    }
    
    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Failed to retry job')
      }
      
      const result = await response.json()
      
      // Refresh jobs list
      fetchJobs(currentPage, searchTerm, statusFilter)
      
      alert(`Job "${jobName}" queued for retry. Estimated wait time: ${result.estimatedWaitTime}`)
    } catch (err) {
      alert(`Failed to retry job: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'completed':
        return <div className="h-2 w-2 bg-green-500 rounded-full" />
      case 'failed':
        return <div className="h-2 w-2 bg-red-500 rounded-full" />
      case 'queued':
        return <div className="h-2 w-2 bg-yellow-500 rounded-full" />
      default:
        return <div className="h-2 w-2 bg-gray-500 rounded-full" />
    }
  }

  if (loading && !refreshing) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <LoadingState 
            type="page" 
            title="Loading jobs..." 
            description="Fetching your OCR processing jobs"
          />
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <div className="text-center space-y-4">
            <div className="text-red-500 text-lg font-semibold">Error Loading Jobs</div>
            <p className="text-gray-600">{error}</p>
            <button 
              onClick={() => {
                setError(null)
                setLoading(true)
                fetchJobs(currentPage, searchTerm, statusFilter)
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-muted-foreground">
            Manage your OCR processing jobs
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={() => fetchJobs(currentPage, searchTerm, statusFilter)} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/upload">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Job
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'processing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilter('processing')}
              >
                Processing
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilter('completed')}
              >
                Completed
              </Button>
              <Button
                variant={statusFilter === 'failed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilter('failed')}
              >
                Failed
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      {error ? (
        <Card>
          <CardContent className="text-center py-8">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Jobs</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchJobs(currentPage, searchTerm, statusFilter)}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-xl font-semibold mb-2">No Jobs Found</h2>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'No jobs match your current filters.' 
                : 'You haven\'t created any jobs yet.'}
            </p>
            <Link href="/upload">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Job
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      {getStatusIcon(job.status)}
                      <h3 className="text-lg font-semibold truncate">{job.name}</h3>
                      <Badge 
                        variant={
                          job.status === 'COMPLETED' ? 'success' : 
                          job.status === 'FAILED' ? 'destructive' : 
                          'default'
                        }
                      >
                        {job.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Files:</span> {job.totalFiles}
                      </div>
                      <div>
                        <span className="font-medium">Progress:</span> {job.progress}%
                      </div>
                      <div>
                        <span className="font-medium">Successful:</span> {job.successfulFiles}
                      </div>
                      <div>
                        <span className="font-medium">Created:</span> {formatRelativeTime(job.createdAt)}
                      </div>
                    </div>

                    {job.status === 'PROCESSING' && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Processing...</span>
                          <span>{job.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Link href={`/jobs/${job.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>

                    {job.status === 'READY' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleStartProcessing(job.id)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}

                    {job.status === 'COMPLETED' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDownloadJob(job.id, job.name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}

                    {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRetryJob(job.id, job.name)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}

                    {['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status) && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteJob(job.id, job.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} jobs
          </p>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              Previous
            </Button>
            
            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
              const page = i + 1
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              )
            })}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= pagination.pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      </div>
    </AppLayout>
  )
}