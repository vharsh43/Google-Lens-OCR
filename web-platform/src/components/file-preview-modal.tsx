'use client'

import { useState, useEffect } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Download, 
  FileText, 
  Image, 
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface FilePreviewModalProps {
  open: boolean
  onClose: () => void
  file: {
    id: string
    originalName: string
    fileName: string
    fileSize: number
    status: string
    result?: {
      pngCount: number
      pageCount: number
      ocrConfidence: number
      detectedLanguages: string[]
      processingDuration: number
      textOutputPath?: string
      pngOutputPath?: string
    }
  }
  jobId: string
  onDownload: (fileId: string, fileName: string, type: 'all' | 'text' | 'images') => void
}

export default function FilePreviewModal({ 
  open, 
  onClose, 
  file, 
  jobId,
  onDownload 
}: FilePreviewModalProps) {
  const [textContent, setTextContent] = useState<string[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    if (open && file.status === 'COMPLETED') {
      fetchPreviewData()
    }
  }, [open, file.id])

  const fetchPreviewData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Fetch text content preview
      const textResponse = await fetch(`/api/jobs/${jobId}/files/${file.id}/preview?type=text`)
      if (textResponse.ok) {
        const textData = await textResponse.json()
        setTextContent(textData.content || [])
      }

      // Fetch image URLs preview
      const imageResponse = await fetch(`/api/jobs/${jobId}/files/${file.id}/preview?type=images`)
      if (imageResponse.ok) {
        const imageData = await imageResponse.json()
        setImageUrls(imageData.urls || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % imageUrls.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate">{file.originalName}</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant={file.status === 'COMPLETED' ? 'success' : 'default'}>
                {file.status}
              </Badge>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p>Loading preview...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
            <Button className="mt-2" onClick={fetchPreviewData}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Pages:</span> {file.result?.pageCount || 0}
              </div>
              <div>
                <span className="font-medium">Images:</span> {file.result?.pngCount || 0}
              </div>
              <div>
                <span className="font-medium">Confidence:</span> {Math.round((file.result?.ocrConfidence || 0) * 100)}%
              </div>
              <div>
                <span className="font-medium">Languages:</span> {file.result?.detectedLanguages?.join(', ') || 'Unknown'}
              </div>
            </div>

            {/* Download Options */}
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={() => onDownload(file.id, file.originalName, 'all')}
              >
                <Download className="mr-2 h-4 w-4" />
                Download All
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onDownload(file.id, file.originalName, 'text')}
              >
                <FileText className="mr-2 h-4 w-4" />
                Text Only
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onDownload(file.id, file.originalName, 'images')}
              >
                <Image className="mr-2 h-4 w-4" />
                Images Only
              </Button>
            </div>

            {/* Preview Tabs */}
            <Tabs defaultValue="text" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">Text Content</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
              </TabsList>
              
              <TabsContent value="text" className="mt-4">
                <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                  {textContent.length > 0 ? (
                    <div className="space-y-4">
                      {textContent.map((content, index) => (
                        <div key={index} className="border-b pb-2">
                          <div className="text-xs text-gray-500 mb-1">Page {index + 1}</div>
                          <div className="text-sm whitespace-pre-wrap">{content}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      No text content available
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="images" className="mt-4">
                <div className="border rounded-lg p-4">
                  {imageUrls.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          Image {currentImageIndex + 1} of {imageUrls.length}
                        </span>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={prevImage}
                            disabled={imageUrls.length <= 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={nextImage}
                            disabled={imageUrls.length <= 1}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <img 
                          src={imageUrls[currentImageIndex]} 
                          alt={`Page ${currentImageIndex + 1}`}
                          className="max-w-full max-h-80 object-contain border rounded"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      No images available
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}