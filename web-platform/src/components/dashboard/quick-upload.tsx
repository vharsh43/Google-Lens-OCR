'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Upload, 
  FileText,
  Plus,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/toast-provider'
import { validateFile } from '@/lib/api-error-handler'
import { useRouter } from 'next/navigation'

export function QuickUpload() {
  const [dragActive, setDragActive] = useState(false)
  const toast = useToast()
  const router = useRouter()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    // Validate files
    const validFiles: File[] = []
    const rejectedFiles: string[] = []
    
    acceptedFiles.forEach(file => {
      const errors = validateFile(file)
      if (errors.length > 0) {
        rejectedFiles.push(`${file.name}: ${errors.join(', ')}`)
      } else {
        validFiles.push(file)
      }
    })
    
    if (rejectedFiles.length > 0) {
      toast.error('Some files were rejected', rejectedFiles.join('\n'))
    }
    
    if (validFiles.length > 0) {
      toast.success(`Selected ${validFiles.length} file(s)`, `Redirecting to upload page...`)
      // Store files in sessionStorage to pass to upload page
      const fileData = validFiles.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      }))
      sessionStorage.setItem('quickUploadFiles', JSON.stringify(fileData))
      
      // Navigate to upload page
      router.push('/upload?from=dashboard')
    }
  }, [toast, router])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/x-pdf': ['.pdf'],
      'application/acrobat': ['.pdf'],
      'applications/vnd.pdf': ['.pdf'],
      'text/pdf': ['.pdf'],
      'text/x-pdf': ['.pdf']
    },
    multiple: true,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false)
  })

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Upload className="h-5 w-5 mr-2" />
          Quick Upload
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
            ${isDragActive || dragActive
              ? 'border-primary bg-primary/5 scale-105' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }
          `}
        >
          <input {...getInputProps()} />
          
          <div className="space-y-4">
            {isDragActive ? (
              <>
                <Upload className="h-12 w-12 text-primary mx-auto animate-bounce" />
                <div>
                  <h3 className="text-lg font-medium text-primary">Drop files here</h3>
                  <p className="text-sm text-gray-600">Release to select files for upload</p>
                </div>
              </>
            ) : (
              <>
                <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Drop PDF files here</h3>
                  <p className="text-sm text-gray-600">
                    Or click to browse and select files from your computer
                  </p>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-amber-600">Only PDF files are supported</span>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Maximum file size: Unlimited • Multiple files supported
          </div>
          <Link href="/upload">
            <Button variant="outline" size="sm">
              <Plus className="h-3 w-3 mr-1" />
              Advanced Upload
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}