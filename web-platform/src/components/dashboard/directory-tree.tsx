'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  Image,
  Download,
  Eye,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  Grid,
  List,
  Clock,
  CheckCircle,
  Loader2,
  AlertCircle,
  Trash2,
  Copy,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TreeNode {
  id: string
  name: string
  type: 'file' | 'directory'
  path: string
  fileId?: string // Directory ID for preview API
  size?: number
  mimeType?: string
  createdAt: Date
  modifiedAt: Date
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  children?: TreeNode[]
  isExpanded?: boolean
  metadata?: {
    pageCount?: number
    ocrConfidence?: number
    language?: string
    processingDuration?: number
    isTemporary?: boolean
  }
}

interface DirectoryTreeProps {
  jobId: string
  rootPath?: string
  showFiles?: boolean
  showMetadata?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  onFileSelect?: (file: TreeNode) => void
  onFilePreview?: (file: TreeNode) => void
  onFileDownload?: (file: TreeNode) => void
  className?: string
}

const FILE_ICONS = {
  'application/pdf': File,
  'image/png': Image,
  'image/jpeg': Image,
  'image/jpg': Image,
  'text/plain': FileText,
  'default': File
}

const STATUS_COLORS = {
  pending: 'text-amber-600',
  processing: 'text-slate-600',
  completed: 'text-green-600',
  failed: 'text-red-600'
}

export function DirectoryTree({
  jobId,
  rootPath = `processed/${jobId}`,
  showFiles = true,
  showMetadata = true,
  autoRefresh = false,
  refreshInterval = 5000,
  onFileSelect,
  onFilePreview,
  onFileDownload,
  className
}: DirectoryTreeProps) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree')
  const [filterType, setFilterType] = useState<'all' | 'images' | 'text' | 'pdf'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Fetch real directory structure from API
  const fetchRealTree = useCallback(async (): Promise<TreeNode[]> => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/files`)
      if (response.ok) {
        const data = await response.json()
        return data.tree || []
      } else {
        console.error('Failed to fetch job files:', response.statusText)
        return []
      }
    } catch (error) {
      console.error('Error fetching job files:', error)
      return []
    }
  }, [jobId])


  // Fetch tree with real API data
  const fetchTree = useCallback(async (preserveSelection = false) => {
    const currentSelection = preserveSelection ? selectedFile : null
    setIsLoading(true)
    
    try {
      // Try to fetch real data first
      const realTree = await fetchRealTree()
      
      if (realTree.length > 0) {
        setTree(realTree)
      } else {
        // No real data available
        setTree([])
      }
      
      setLastRefresh(new Date())
      
      // Restore selection if preserving
      if (currentSelection) {
        setSelectedFile(currentSelection)
      }
    } catch (error) {
      console.error('Error fetching tree:', error)
      // Show empty tree on error
      setTree([])
    } finally {
      setIsLoading(false)
    }
  }, [fetchRealTree, selectedFile])

  // Initial fetch
  useEffect(() => {
    fetchTree()

    // Optional auto-refresh (disabled by default now)
    if (autoRefresh) {
      const interval = setInterval(() => fetchTree(true), refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchTree, autoRefresh, refreshInterval])

  const toggleExpanded = (nodeId: string) => {
    const updateNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, isExpanded: !node.isExpanded }
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) }
        }
        return node
      })
    }
    setTree(updateNode(tree))
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)

    if (diffSecs < 30) return 'just now'
    if (diffSecs < 60) return `${diffSecs}s ago`
    if (diffMins < 60) return `${diffMins}m ago`
    return date.toLocaleTimeString()
  }

  const getFileIcon = (node: TreeNode) => {
    if (node.type === 'directory') {
      return node.isExpanded ? FolderOpen : Folder
    }
    const IconComponent = FILE_ICONS[node.mimeType as keyof typeof FILE_ICONS] || FILE_ICONS.default
    return IconComponent
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-600" />
      case 'processing':
        return <Loader2 className="h-3 w-3 text-slate-600 animate-spin" />
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-600" />
      case 'pending':
        return <Clock className="h-3 w-3 text-amber-600" />
      default:
        return null
    }
  }

  const handleFileAction = (action: 'select' | 'preview' | 'download', file: TreeNode) => {
    switch (action) {
      case 'select':
        setSelectedFile(file)
        onFileSelect?.(file)
        break
      case 'preview':
        onFilePreview?.(file)
        break
      case 'download':
        onFileDownload?.(file)
        break
    }
  }

  const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.filter(node => {
      // Search filter
      if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      // Type filter
      if (filterType !== 'all') {
        if (node.type === 'directory') return true
        switch (filterType) {
          case 'images':
            return node.mimeType?.startsWith('image/')
          case 'text':
            return node.mimeType?.startsWith('text/')
          case 'pdf':
            return node.mimeType === 'application/pdf'
        }
      }

      return true
    }).map(node => ({
      ...node,
      children: node.children ? filterNodes(node.children) : undefined
    }))
  }

  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const IconComponent = getFileIcon(node)
    const hasChildren = node.children && node.children.length > 0
    const isFile = node.type === 'file'

    return (
      <div key={node.id} className="select-none">
        <div
          className={cn(
            "flex items-center space-x-2 p-2 hover:bg-slate-50 rounded cursor-pointer group transition-colors duration-200",
            selectedFile?.id === node.id && "bg-slate-100 border border-slate-300",
            depth > 0 && "ml-4"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleExpanded(node.id)
            } else {
              handleFileAction('select', node)
            }
          }}
        >
          {/* Expand/Collapse Button */}
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpanded(node.id)
              }}
            >
              {node.isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}

          {/* Icon */}
          <IconComponent className={cn(
            "h-4 w-4 flex-shrink-0",
            node.type === 'directory' ? "text-slate-600" : "text-slate-500"
          )} />

          {/* File/Directory Name */}
          <span className="text-sm font-semibold flex-1 truncate text-slate-900">{node.name}</span>

          {/* Status */}
          {isFile && node.status && getStatusIcon(node.status)}

          {/* File Size */}
          {isFile && node.size && (
            <span className="text-xs text-slate-500 font-medium">{formatFileSize(node.size)}</span>
          )}

          {/* Metadata Badge */}
          {isFile && showMetadata && node.metadata?.ocrConfidence && (
            <Badge variant="outline" className="text-xs">
              {node.metadata.ocrConfidence}%
            </Badge>
          )}

          {/* Actions */}
          {isFile && (
            <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  handleFileAction('preview', node)
                }}
              >
                <Eye className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  handleFileAction('download', node)
                }}
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Children */}
        {hasChildren && node.isExpanded && (
          <div className="mt-1">
            {node.children!.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderListView = () => {
    const flattenNodes = (nodes: TreeNode[]): TreeNode[] => {
      const result: TreeNode[] = []
      nodes.forEach(node => {
        if (node.type === 'file') {
          result.push(node)
        }
        if (node.children) {
          result.push(...flattenNodes(node.children))
        }
      })
      return result
    }

    const files = flattenNodes(filterNodes(tree))

    return (
      <div className="space-y-2">
        {files.map(file => (
          <div
            key={file.id}
            className={cn(
              "flex items-center justify-between p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors duration-200",
              selectedFile?.id === file.id && "bg-slate-100 border-slate-300"
            )}
            onClick={() => handleFileAction('select', file)}
          >
            <div className="flex items-center space-x-3 flex-1">
              {React.createElement(getFileIcon(file), { className: "h-4 w-4 text-slate-500" })}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-slate-900">{file.name}</p>
                <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
                  <span>{formatFileSize(file.size || 0)}</span>
                  <span>•</span>
                  <span>{formatRelativeTime(file.modifiedAt)}</span>
                  {showMetadata && file.metadata?.ocrConfidence && (
                    <>
                      <span>•</span>
                      <span>{file.metadata.ocrConfidence}% confidence</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {file.status && getStatusIcon(file.status)}
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFileAction('preview', file)
                  }}
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFileAction('download', file)
                  }}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const filteredTree = filterNodes(tree)

  return (
    <div className={cn("bg-white rounded-2xl shadow-sm border border-slate-200 transition-all duration-200 hover:shadow-md hover:scale-[1.02]", className)}>
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Folder className="h-4 w-4" />
            <span>File Explorer</span>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-slate-600" />}
          </h3>

          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 pr-3 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 w-32 bg-white"
              />
            </div>

            {/* Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-500 bg-white font-medium"
            >
              <option value="all">All Types</option>
              <option value="images">Images</option>
              <option value="text">Text</option>
              <option value="pdf">PDF</option>
            </select>

            {/* View Mode */}
            <Button
              size="sm"
              variant={viewMode === 'tree' ? 'default' : 'outline'}
              onClick={() => setViewMode('tree')}
              className="h-7 w-7 p-0"
            >
              <List className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
              className="h-7 w-7 p-0"
            >
              <Grid className="h-3 w-3" />
            </Button>

            {/* Refresh */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fetchTree(true)}
              className="h-7 w-7 p-0"
              title="Refresh files"
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>
            {filteredTree.reduce((count, node) => {
              const countFiles = (n: TreeNode): number => {
                let fileCount = n.type === 'file' ? 1 : 0
                if (n.children) {
                  fileCount += n.children.reduce((sum, child) => sum + countFiles(child), 0)
                }
                return fileCount
              }
              return count + countFiles(node)
            }, 0)} files
          </span>
          <span>Last updated: {formatRelativeTime(lastRefresh)}</span>
        </div>
      </div>

      <div className="p-0">
        <div className="max-h-96 overflow-y-auto p-4">
          {filteredTree.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Folder className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="font-medium">No files found</p>
            </div>
          ) : viewMode === 'tree' ? (
            <div className="space-y-1">
              {filteredTree.map(node => renderTreeNode(node))}
            </div>
          ) : (
            renderListView()
          )}
        </div>
      </div>
    </div>
  )
}