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
  Briefcase,
  Server,
  Settings,
  Activity
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

interface TableCleanupItem {
  id: string
  name: string
  displayName: string
  icon: React.ElementType
  description: string
  count: number
  isFileSystem?: boolean
}

export function DatabaseCleanup() {
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCleanupLoading, setIsCleanupLoading] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showBulkConfirmDialog, setShowBulkConfirmDialog] = useState(false)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
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

  const handleTableCleanup = async (tableName: string) => {
    setIsCleanupLoading(tableName)
    try {
      const response = await fetch(`/api/admin/cleanup/table`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          table: tableName,
          confirm: 'DELETE_TABLE_DATA'
        })
      })

      const result = await response.json()

      if (response.ok) {
        success(`${tableName} cleanup completed successfully`)
        setShowConfirmDialog(false)
        setSelectedTable(null)
        await fetchStats() // Refresh stats
      } else {
        throw new Error(result.details || result.error || 'Cleanup failed')
      }
    } catch (error) {
      showError(`${tableName} cleanup failed: ` + (error instanceof Error ? error.message : 'Unknown error'))
      console.error('Cleanup error:', error)
    } finally {
      setIsCleanupLoading(null)
    }
  }

  const handleBulkCleanup = async () => {
    setIsCleanupLoading('bulk')
    try {
      const response = await fetch('/api/admin/cleanup?confirm=DELETE_ALL_DATA', {
        method: 'DELETE'
      })

      const result = await response.json()

      if (response.ok) {
        success('Complete database cleanup completed successfully')
        setShowBulkConfirmDialog(false)
        await fetchStats() // Refresh stats
      } else {
        throw new Error(result.details || result.error || 'Cleanup failed')
      }
    } catch (error) {
      showError('Database cleanup failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
      console.error('Cleanup error:', error)
    } finally {
      setIsCleanupLoading(null)
    }
  }

  const getCleanupItems = (): TableCleanupItem[] => {
    if (!stats) return []

    return [
      {
        id: 'jobs',
        name: 'jobs',
        displayName: 'Jobs',
        icon: Briefcase,
        description: 'Processing jobs and their metadata',
        count: stats.database.jobs
      },
      {
        id: 'files',
        name: 'files',
        displayName: 'Files',
        icon: FileText,
        description: 'Uploaded files and their information',
        count: stats.database.files
      },
      {
        id: 'processingResults',
        name: 'processingResults',
        displayName: 'Processing Results',
        icon: CheckCircle,
        description: 'OCR results and processing outcomes',
        count: stats.database.processingResults
      },
      {
        id: 'jobStages',
        name: 'jobStages',
        displayName: 'Job Stages',
        icon: Activity,
        description: 'Processing stage information',
        count: stats.database.jobStages
      },
      {
        id: 'processingLogs',
        name: 'processingLogs',
        displayName: 'Processing Logs',
        icon: Server,
        description: 'System and processing logs',
        count: stats.database.processingLogs
      },
      {
        id: 'processedFiles',
        name: 'processedFiles',
        displayName: 'Processed Files',
        icon: Folder,
        description: 'Job output folders and files',
        count: stats.files.processedJobDirectories,
        isFileSystem: true
      },
      {
        id: 'uploadFiles',
        name: 'uploadFiles',
        displayName: 'Upload Files',
        icon: FileText,
        description: 'Temporary upload files',
        count: stats.files.uploadFiles,
        isFileSystem: true
      }
    ]
  }

  const TableCard = ({ item }: { item: TableCleanupItem }) => (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <item.icon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{item.displayName}</h3>
            <p className="text-sm text-gray-600">{item.description}</p>
            {item.isFileSystem && (
              <Badge variant="secondary" className="mt-1 text-xs">File System</Badge>
            )}
          </div>
        </div>
        <Badge variant="outline" className="font-mono text-lg px-3 py-1">
          {item.count.toLocaleString()}
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">Warning</p>
          </div>
          <p className="text-xs text-amber-700 mt-1">
            This will permanently delete all {item.displayName.toLowerCase()} records. This action cannot be undone.
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedTable(item.name)
            setShowConfirmDialog(true)
          }}
          variant="destructive"
          disabled={isCleanupLoading !== null || item.count === 0}
          className="w-full"
        >
          {isCleanupLoading === item.name ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Clean {item.displayName}
          {item.count === 0 && ' (Empty)'}
        </Button>
      </div>
    </Card>
  )

  const cleanupItems = getCleanupItems()

  return (
    <div className="space-y-8">
      {/* Header with overall stats */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <Database className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Database Overview</h2>
              <p className="text-sm text-gray-600">Current database and file system statistics</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStats}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">Total Records</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalRecords.toLocaleString()}</p>
                </div>
                <Database className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Database Tables</p>
                  <p className="text-2xl font-bold text-green-900">5</p>
                </div>
                <Server className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800">File Directories</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.files.processedJobDirectories}</p>
                </div>
                <Folder className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800">Upload Files</p>
                  <p className="text-2xl font-bold text-orange-900">{stats.files.uploadFiles}</p>
                </div>
                <FileText className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </div>
        )}

        {/* Bulk cleanup section */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Complete Database Cleanup</h3>
              <p className="text-sm text-gray-600 mt-1">
                Delete all database records and files at once
              </p>
            </div>
            <Button
              onClick={() => setShowBulkConfirmDialog(true)}
              variant="destructive"
              disabled={isCleanupLoading !== null || !stats || stats.totalRecords === 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCleanupLoading === 'bulk' ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Clean Everything
            </Button>
          </div>
        </div>
      </Card>

      {/* Individual table cleanup cards */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Individual Table Cleanup</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cleanupItems.map((item) => (
            <TableCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Individual table confirmation dialog */}
      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false)
          setSelectedTable(null)
        }}
        onConfirm={() => selectedTable && handleTableCleanup(selectedTable)}
        title={`Confirm ${selectedTable ? cleanupItems.find(i => i.name === selectedTable)?.displayName : ''} Cleanup`}
        description={`This will permanently delete all ${selectedTable ? cleanupItems.find(i => i.name === selectedTable)?.displayName.toLowerCase() : ''} records from the database. This action cannot be undone.`}
        confirmationText="DELETE"
        confirmButtonText={`Clean ${selectedTable ? cleanupItems.find(i => i.name === selectedTable)?.displayName : ''}`}
        isDestructive={true}
        isLoading={isCleanupLoading === selectedTable}
      />

      {/* Bulk cleanup confirmation dialog */}
      <ConfirmationDialog
        isOpen={showBulkConfirmDialog}
        onClose={() => setShowBulkConfirmDialog(false)}
        onConfirm={handleBulkCleanup}
        title="Confirm Complete Database Cleanup"
        description="This will permanently delete ALL database records including jobs, files, processing results, job stages, processing logs, and all processed files from the file system. This action cannot be undone and will reset the system to a clean state."
        confirmationText="DELETE"
        confirmButtonText="Clean Everything"
        isDestructive={true}
        isLoading={isCleanupLoading === 'bulk'}
      />
    </div>
  )
}