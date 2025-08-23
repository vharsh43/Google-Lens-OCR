'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Loader2, Download, FileText, Image, AlertCircle, Eye, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  fileId: string
  fileName: string
}

interface TextPreviewData {
  content: string[]
  totalFiles: number
  previewedFiles: number
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface ImagePreviewData {
  urls: string[]
  totalFiles: number
  previewedFiles: number
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export function FilePreviewModal({ isOpen, onClose, jobId, fileId, fileName }: FilePreviewModalProps) {
  const [textPreview, setTextPreview] = useState<TextPreviewData | null>(null)
  const [imagePreview, setImagePreview] = useState<ImagePreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('text')
  
  // Pagination states
  const [textPage, setTextPage] = useState(1)
  const [imagePage, setImagePage] = useState(1)
  const [textPageSize, setTextPageSize] = useState(10)
  const [imagePageSize, setImagePageSize] = useState(10)
  
  const pageSizeOptions = [5, 10, 25, 50, 100, 125, 150]

  useEffect(() => {
    if (isOpen && jobId && fileId) {
      fetchPreviewData()
    }
  }, [isOpen, jobId, fileId, textPage, imagePage, textPageSize, imagePageSize])
  
  // Reset pagination when modal opens
  useEffect(() => {
    if (isOpen) {
      setTextPage(1)
      setImagePage(1)
    }
  }, [isOpen])

  const fetchPreviewData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Calculate offset for pagination
      const textOffset = (textPage - 1) * textPageSize
      const imageOffset = (imagePage - 1) * imagePageSize
      
      // Fetch text preview with pagination
      const textResponse = await fetch(`/api/jobs/${jobId}/files/${fileId}/preview?type=text&limit=${textPageSize}&offset=${textOffset}`)
      if (textResponse.ok) {
        const textData = await textResponse.json()
        setTextPreview(textData)
      }

      // Fetch image preview with pagination
      const imageResponse = await fetch(`/api/jobs/${jobId}/files/${fileId}/preview?type=images&limit=${imagePageSize}&offset=${imageOffset}`)
      if (imageResponse.ok) {
        const imageData = await imageResponse.json()
        setImagePreview(imageData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/download`)
      if (!response.ok) throw new Error('Download failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${fileName || 'file'}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Failed to download file')
    }
  }

  const renderTextPreview = () => {
    if (!textPreview) return null

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">
              Showing {textPreview.previewedFiles} of {textPreview.totalFiles} text files
            </span>
            <Badge variant="secondary" className="text-xs">
              Page {textPreview.currentPage} of {textPreview.totalPages}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">Files per page:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-16 h-8">
                  {textPageSize}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {pageSizeOptions.map(size => (
                  <DropdownMenuItem
                    key={size}
                    onClick={() => {
                      setTextPageSize(size)
                      setTextPage(1)
                    }}
                  >
                    {size}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTextPage(prev => Math.max(1, prev - 1))}
              disabled={!textPreview.hasPrevPage || loading}
            >
              <ChevronLeft className="h-3 w-3" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTextPage(prev => prev + 1)}
              disabled={!textPreview.hasNextPage || loading}
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-xs text-gray-500">
            Files {((textPage - 1) * textPageSize) + 1}-{Math.min(textPage * textPageSize, textPreview.totalFiles)} of {textPreview.totalFiles}
          </div>
        </div>
        
        <div className="space-y-3 max-h-[400px] overflow-y-auto">

        {textPreview.content.length === 0 ? (
          <Card className="p-6 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">No text content available</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {textPreview.content.map((content, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary" className="text-xs">
                    File {((textPage - 1) * textPageSize) + index + 1}
                  </Badge>
                </div>
                <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                  {content || '[Empty file]'}
                </pre>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>
    )
  }

  const renderImagePreview = () => {
    if (!imagePreview) return null

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image className="h-4 w-4" />
            <span className="text-sm font-medium">
              Showing {imagePreview.previewedFiles} of {imagePreview.totalFiles} images
            </span>
            <Badge variant="secondary" className="text-xs">
              Page {imagePreview.currentPage} of {imagePreview.totalPages}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">Images per page:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-16 h-8">
                  {imagePageSize}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {pageSizeOptions.map(size => (
                  <DropdownMenuItem
                    key={size}
                    onClick={() => {
                      setImagePageSize(size)
                      setImagePage(1)
                    }}
                  >
                    {size}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImagePage(prev => Math.max(1, prev - 1))}
              disabled={!imagePreview.hasPrevPage || loading}
            >
              <ChevronLeft className="h-3 w-3" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImagePage(prev => prev + 1)}
              disabled={!imagePreview.hasNextPage || loading}
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-xs text-gray-500">
            Images {((imagePage - 1) * imagePageSize) + 1}-{Math.min(imagePage * imagePageSize, imagePreview.totalFiles)} of {imagePreview.totalFiles}
          </div>
        </div>
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto">

        {imagePreview.urls.length === 0 ? (
          <Card className="p-6 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">No images available</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {imagePreview.urls.map((url, index) => (
              <Card key={index} className="p-2">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary" className="text-xs">
                    Page {((imagePage - 1) * imagePageSize) + index + 1}
                  </Badge>
                </div>
                <div className="aspect-[3/4] bg-gray-100 rounded overflow-hidden">
                  <img
                    src={url}
                    alt={`Page ${((imagePage - 1) * imagePageSize) + index + 1}`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                  <div className="hidden flex items-center justify-center h-full">
                    <AlertCircle className="h-8 w-8 text-gray-400" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Eye className="h-4 w-4" />
            <span>File Preview</span>
          </DialogTitle>
          <DialogDescription>
            Previewing: {fileName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading preview...</span>
          </div>
        ) : error ? (
          <Card className="p-6 text-center border-red-200 bg-red-50">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" onClick={fetchPreviewData} className="mt-2">
              Try Again
            </Button>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" className="flex items-center space-x-2">
                <FileText className="h-3 w-3" />
                <span>Text Content</span>
              </TabsTrigger>
              <TabsTrigger value="images" className="flex items-center space-x-2">
                <Image className="h-3 w-3" />
                <span>Images</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4">
              {renderTextPreview()}
            </TabsContent>

            <TabsContent value="images" className="mt-4">
              {renderImagePreview()}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <FileText className="h-3 w-3" />
            <span>Job ID: {jobId}</span>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="h-3 w-3 mr-1" />
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}