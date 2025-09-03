'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Clock, 
  Loader2,
  Sparkles,
  FileUp,
  Zap
} from 'lucide-react';
import { TicketAPI, type UploadJob } from '@/lib/api';
import { toast } from "sonner";

interface UploadFormProProps {
  onUploadSuccess?: (result: { data?: { pnr?: string } }) => void;
}

export default function UploadFormPro({ onUploadSuccess }: UploadFormProProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    if (file.type !== 'application/pdf') {
      return 'Only PDF files are supported';
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB
      return 'File size must be less than 10MB';
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await TicketAPI.uploadPDF(file);
      
      // Add job to tracking list
      const newJob: UploadJob = {
        id: result.jobId,
        status: 'queued',
        fileName: result.fileName,
        progress: 0,
        uploadedAt: new Date().toISOString()
      };
      
      setJobs(prev => [newJob, ...prev]);
      toast.success('File uploaded successfully!');
      
      // Start polling for status
      pollJobStatus(result.jobId);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const jobStatus = await TicketAPI.getJobStatus(jobId);
        
        setJobs(prev => prev.map(job => 
          job.id === jobId ? jobStatus : job
        ));

        if (jobStatus.status === 'completed') {
          toast.success(`Processing completed: ${jobStatus.fileName}`);
          onUploadSuccess?.(jobStatus.result || {});
          return;
        }

        if (jobStatus.status === 'failed') {
          toast.error(`Processing failed: ${jobStatus.error || 'Unknown error'}`);
          return;
        }

        // Continue polling if still processing
        if (jobStatus.status === 'processing' || jobStatus.status === 'queued') {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000); // Poll every 5 seconds
          }
        }

      } catch (err) {
        console.error('Error polling job status:', err);
      }
    };

    setTimeout(poll, 2000); // Start polling after 2 seconds
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const removeJob = (jobId: string) => {
    setJobs(prev => prev.filter(job => job.id !== jobId));
  };

  const getStatusIcon = (status: UploadJob['status']) => {
    switch (status) {
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: UploadJob['status']) => {
    switch (status) {
      case 'queued':
        return <Badge variant="secondary">Queued</Badge>;
      case 'processing':
        return <Badge variant="default">Processing</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileUp className="w-5 h-5" />
            <span>Upload Train Ticket PDF</span>
          </CardTitle>
          <CardDescription>
            Upload IRCTC e-ticket PDF files for processing with 1000% accuracy
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
              dragActive
                ? 'border-primary bg-primary/5 scale-[1.02]'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
            } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              disabled={uploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            <div className="flex flex-col items-center space-y-4">
              {uploading ? (
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
              )}
              
              <div className="space-y-2">
                <h3 className="text-lg font-medium">
                  {uploading ? 'Uploading...' : dragActive ? 'Drop your PDF here' : 'Upload PDF Ticket'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {uploading 
                    ? 'Please wait while we upload your file' 
                    : 'Drag and drop your PDF file here, or click to browse'
                  }
                </p>
                <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    <FileText className="w-3 h-3 mr-1" />
                    PDF Only
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Max 10MB
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Zap className="w-3 h-3 mr-1" />
                    Instant Processing
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Jobs */}
      {jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Loader2 className="w-5 h-5 text-primary" />
              <span>Processing Status</span>
            </CardTitle>
            <CardDescription>
              Track your ticket processing in real-time
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(job.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <p className="text-sm font-medium truncate">
                          {job.fileName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(job.status)}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeJob(job.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {job.status === 'processing' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Processing...</span>
                        <span>{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} className="h-1" />
                    </div>
                  )}
                  
                  {job.status === 'completed' && job.result?.data?.validationScore && (
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        {job.result.data.validationScore}% accuracy
                      </Badge>
                    </div>
                  )}
                  
                  {job.status === 'failed' && job.error && (
                    <p className="text-xs text-destructive">{job.error}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Features & Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5" />
            <span>Enhanced Processing Features</span>
          </CardTitle>
          <CardDescription>
            Advanced PDF processing with maximum accuracy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">✅ What Works</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• IRCTC e-ticket PDF files</li>
                <li>• Train booking confirmations</li>
                <li>• Multi-passenger tickets</li>
                <li>• All train classes (1A, 2A, 3A, SL, etc.)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">⚡ Processing Speed</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Average processing: ~0.1 seconds</li>
                <li>• Direct PDF text extraction</li>
                <li>• Real-time validation</li>
                <li>• Instant database import</li>
              </ul>
            </div>
          </div>
          
          <Separator />
          
          <div className="mt-4 space-y-2">
            <h4 className="font-medium text-sm">🔄 Processing Pipeline</h4>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">Upload</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="secondary">Extract Text</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="secondary">Parse Data</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="secondary">Validate</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="default">Ready to Search</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}