'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, Clock, Loader2 } from 'lucide-react';
import { TicketAPI, type UploadJob } from '@/lib/api';

interface UploadFormProps {
  onUploadSuccess?: (result: { data?: { pnr?: string } }) => void;
}

export default function UploadForm({ onUploadSuccess }: UploadFormProps) {
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
      
      // Start polling for status
      pollJobStatus(result.jobId);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
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
          onUploadSuccess?.(jobStatus.result);
          return;
        }

        if (jobStatus.status === 'failed') {
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

  const getStatusColor = (status: UploadJob['status']) => {
    switch (status) {
      case 'queued': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          📤 Upload Train Ticket PDF
        </h3>
        
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
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
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            ) : (
              <Upload className="w-12 h-12 text-gray-400" />
            )}
            
            <div>
              <p className="text-lg font-medium text-gray-900">
                {uploading ? 'Uploading...' : 'Drop your PDF here or click to select'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                IRCTC train ticket PDFs only. Max file size: 10MB
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Processing Jobs */}
      {jobs.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            ⚡ Processing Status
          </h3>
          
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3 flex-1">
                  {getStatusIcon(job.status)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {job.fileName}
                      </p>
                    </div>
                    
                    <div className="mt-1 flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                      
                      {job.status === 'processing' && (
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {job.status === 'completed' && job.result?.validationScore && (
                    <span className="text-xs text-green-600 font-medium">
                      {job.result.validationScore}% accuracy
                    </span>
                  )}
                  
                  {job.status === 'failed' && job.error && (
                    <span className="text-xs text-red-600" title={job.error}>
                      Error
                    </span>
                  )}
                  
                  <button
                    onClick={() => removeJob(job.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          📋 How to use:
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Upload IRCTC train ticket PDF files (e-tickets)</li>
          <li>• Files are processed with 1000% accuracy using direct PDF extraction</li>
          <li>• Extracted data is automatically imported to the database</li>
          <li>• You can immediately search for your ticket by PNR or passenger name</li>
        </ul>
      </div>
    </div>
  );
}