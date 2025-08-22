'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react'
import { formatBytes } from '@/lib/utils'
import { useToast } from '@/components/toast-provider'
import { ApiErrorHandler, validateFile, validateJobName } from '@/lib/api-error-handler'
import { LoadingState } from '@/components/loading-states'
import { AppLayout } from '@/components/app-layout'

interface UploadFile extends File {
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [jobName, setJobName] = useState('')
  const [uploadResult, setUploadResult] = useState<any>(null)
  const toast = useToast()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      ...file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending' as const
    }))

    // Validate PDF files with improved detection
    const validFiles: UploadFile[] = []
    const rejectedFiles: string[] = []
    
    newFiles.forEach(file => {
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
      toast.success(`Added ${validFiles.length} file(s)`, `Successfully added ${validFiles.length} PDF file(s) to upload queue`)
      setFiles(prev => [...prev, ...validFiles])
    }
  }, [toast])

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
    disabled: uploading,
    noClick: false,
    noKeyboard: false
  })

  const removeFile = (id: string) => {
    setFiles(files.filter(file => file.id !== id))
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('No files selected', 'Please select at least one PDF file to upload')
      return
    }

    // Validate job name
    const jobNameErrors = validateJobName(jobName)
    if (jobNameErrors.length > 0) {
      toast.error('Invalid job name', jobNameErrors[0])
      return
    }

    // Validate files
    const fileErrors: string[] = []
    files.forEach(file => {
      const errors = validateFile(file)
      fileErrors.push(...errors)
    })

    if (fileErrors.length > 0) {
      toast.error('Invalid files', fileErrors[0])
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('jobName', jobName || `OCR Job - ${new Date().toLocaleString()}`)

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + Math.random() * 10
        })
      }, 500)

      const response = await ApiErrorHandler.safeFetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const result = await response.json()

      if (result.success) {
        setUploadResult(result)
        setFiles([]) // Clear files after successful upload
        toast.success('Upload successful', `${result.filesUploaded} files uploaded successfully`)
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (error) {
      const apiError = ApiErrorHandler.handle(error)
      toast.error('Upload failed', apiError.message)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  if (uploadResult) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <Card className="text-center">
          <CardHeader>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl text-green-700">Upload Successful!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">Job Created</h3>
              <p className="text-green-700">
                <strong>{uploadResult.job.name}</strong>
              </p>
              <p className="text-sm text-green-600 mt-1">
                {uploadResult.filesUploaded} files uploaded successfully
              </p>
            </div>

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-2">Warnings:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {uploadResult.errors.map((error: string, index: number) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                onClick={() => window.location.href = `/jobs/${uploadResult.jobId}`}
                className="flex-1"
              >
                View Job Details
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setUploadResult(null)
                  setJobName('')
                }}
                className="flex-1"
              >
                Upload More Files
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Upload PDF Files</h1>
        <p className="text-muted-foreground">
          Drag and drop your PDF files or click to browse. All files will be converted to high-quality text using advanced OCR.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Job Name Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Job Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <label htmlFor="jobName" className="text-sm font-medium">
                Job Name (optional)
              </label>
              <Input
                id="jobName"
                placeholder="Enter a name for this processing job..."
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                disabled={uploading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Upload Area */}
        <Card>
          <CardContent className="p-6">
            <div
              {...getRootProps()}
              className={`upload-area ${isDragActive ? 'active' : ''} ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              {isDragActive ? (
                <p className="text-lg">Drop the PDF files here...</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg">Drag PDF files here, or click to select</p>
                  <p className="text-sm text-muted-foreground">
                    Supports multiple PDF files up to 50MB each
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* File List */}
        {files.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Selected Files ({files.length})</CardTitle>
                <Badge variant="secondary">
                  {formatBytes(files.reduce((sum, file) => sum + file.size, 0))}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3 flex-1">
                      <File className="h-5 w-5 text-red-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {file.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t">
                {uploading && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Uploading files...</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}
                
                <Button 
                  onClick={handleUpload} 
                  disabled={uploading || files.length === 0}
                  className="w-full"
                  size="lg"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload {files.length} File{files.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Processing Information</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Files are converted to high-quality PNGs at 300 DPI</li>
              <li>• OCR uses Google Lens technology for maximum accuracy</li>
              <li>• Supports multiple languages including Hindi, Gujarati, and English</li>
              <li>• Processing time: ~5 seconds per PDF page</li>
              <li>• All files are processed securely and can be deleted after completion</li>
            </ul>
          </CardContent>
        </Card>
      </div>
      </div>
    </AppLayout>
  )
}