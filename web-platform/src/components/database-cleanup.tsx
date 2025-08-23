'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { useToast } from '@/components/toast-provider'
import { 
  Trash2, 
  Database, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Folder,
  FileText,
  Briefcase
} from 'lucide-react'

interface DatabaseStats {
  database: {
    jobs: number
    files: number
    processingResults: number
    jobStages: number
    processingLogs: number
  }
  files: {
    processedJobDirectories: number
    uploadFiles: number
  }
  totalRecords: number
}

export function DatabaseCleanup() {
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCleanupLoading, setIsCleanupLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const { success, error: showError, info } = useToast()

  const fetchStats = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/cleanup')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        throw new Error('Failed to fetch database statistics')
      }
    } catch (error) {
      showError('Failed to load database statistics')
      console.error('Error fetching stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handleCleanup = async () => {
    setIsCleanupLoading(true)
    try {
      const response = await fetch('/api/admin/cleanup?confirm=DELETE_ALL_DATA', {
        method: 'DELETE'
      })

      const result = await response.json()

      if (response.ok) {
        success('Database cleanup completed successfully')
        setShowConfirmDialog(false)
        await fetchStats() // Refresh stats
      } else {
        throw new Error(result.details || result.error || 'Cleanup failed')
      }
    } catch (error) {
      showError('Database cleanup failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
      console.error('Cleanup error:', error)
    } finally {
      setIsCleanupLoading(false)
    }
  }

  const StatCard = ({ 
    title, 
    count, 
    icon: Icon, 
    description 
  }: { 
    title: string
    count: number
    icon: React.ElementType
    description: string
  }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-white rounded-lg border">
          <Icon className="h-4 w-4 text-gray-600" />
        </div>
        <div>
          <p className="font-medium text-sm text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <Badge variant="secondary" className="font-mono">
        {count.toLocaleString()}
      </Badge>
    </div>
  )

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Database className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Database Cleanup</h3>
              <p className="text-sm text-gray-600">Clean up all database records and files</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStats}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {stats && (
          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-1 gap-2">
              <StatCard
                title="Jobs"
                count={stats.database.jobs}
                icon={Briefcase}
                description="Processing jobs"
              />
              <StatCard
                title="Files"
                count={stats.database.files}
                icon={FileText}
                description="Uploaded files"
              />
              <StatCard
                title="Processing Results"
                count={stats.database.processingResults}
                icon={CheckCircle}
                description="OCR results"
              />
              <StatCard
                title="Job Stages"
                count={stats.database.jobStages}
                icon={RefreshCw}
                description="Processing stages"
              />
              <StatCard
                title="Processing Logs"
                count={stats.database.processingLogs}
                icon={FileText}
                description="Processing logs"
              />
              <StatCard
                title="Processed Directories"
                count={stats.files.processedJobDirectories}
                icon={Folder}
                description="Job output folders"
              />
              <StatCard
                title="Upload Files"
                count={stats.files.uploadFiles}
                icon={FileText}
                description="Temporary uploads"
              />
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">Total Database Records</span>
                <Badge variant="outline" className="font-mono text-base px-3 py-1">
                  {stats.totalRecords.toLocaleString()}
                </Badge>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-800">Warning</p>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              This will permanently delete ALL database records and processed files. This action cannot be undone.
            </p>
          </div>

          <Button
            onClick={() => setShowConfirmDialog(true)}
            variant="destructive"
            disabled={isLoading || (stats?.totalRecords === 0)}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clean Up All Data
          </Button>
        </div>
      </Card>

      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleCleanup}
        title="Confirm Database Cleanup"
        description="This will permanently delete all database records including jobs, files, processing results, job stages, audit logs, and all processed files from the file system. This action cannot be undone and will reset the system to a clean state."
        confirmationText="DELETE"
        confirmButtonText="Clean Up Database"
        isDestructive={true}
        isLoading={isCleanupLoading}
      />
    </div>
  )
}