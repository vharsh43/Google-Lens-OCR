# OCR Web Platform - Complete Implementation Plan

## 🎯 Mission Overview
Transform the existing CLI-based PDF-to-Text OCR pipeline into a modern, enterprise-grade web application with real-time processing, advanced analytics, and scalable architecture.

## 📋 Core Requirements Analysis

### Primary User Stories
1. **File Upload**: Drag-and-drop interface for PDF files with batch upload support
2. **Real-time Processing**: Live progress tracking with visual indicators and ETA
3. **Job Management**: Queue system with priority, scheduling, and retry capabilities
4. **Results Management**: Download, preview, and search processed documents
5. **Analytics Dashboard**: Processing statistics, success rates, and usage metrics
6. **Enterprise Features**: Multi-user, role-based access, audit logging
7. **API Integration**: RESTful APIs for third-party integrations

### Missing Enterprise Features Identified
- **User Management**: Organizations, teams, role-based permissions
- **Advanced Analytics**: OCR confidence scoring, language detection analytics
- **Notification System**: Email/webhook notifications for job completion
- **Document Management**: Tagging, categorization, advanced search
- **Quality Assurance**: Manual review workflows, confidence thresholds
- **Integration Hub**: Cloud storage connectors (Google Drive, Dropbox, OneDrive)
- **Automation**: Scheduled processing, template-based workflows
- **Compliance**: GDPR/SOC2 compliance, data retention policies
- **Performance Optimization**: Caching, CDN integration, edge processing
- **Monitoring**: Health checks, performance metrics, error tracking

## 🏗️ System Architecture

### Technology Stack
```
Frontend Layer:
├── Next.js 15 (App Router) + TypeScript
├── Tailwind CSS v4 + ShadCN UI
├── Recharts for analytics
├── React Query for state management
└── WebSocket/SSE for real-time updates

Backend Layer:
├── Next.js API Routes
├── PostgreSQL + Prisma ORM
├── Redis + BullMQ for job queues
├── NextAuth.js for authentication
└── Node.js workers for processing

Processing Layer:
├── Existing Python pipeline (containerized)
├── Node.js orchestration layer
├── File storage (local/S3)
└── Monitoring & logging
```

### Database Schema (PostgreSQL)
```sql
-- Users and Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) DEFAULT 'free',
  limits JSONB DEFAULT '{"monthly_files": 1000}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  role VARCHAR(50) DEFAULT 'user',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Job Management
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  configuration JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id),
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE processing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id),
  output_path VARCHAR(500),
  png_count INTEGER DEFAULT 0,
  ocr_confidence FLOAT,
  detected_languages TEXT[],
  processing_duration INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit and Analytics
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 Implementation Phases

### Phase 1: Foundation & Core Backend (Week 1-2)
```typescript
// prisma/schema.prisma - Database models
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  plan      String   @default("free")
  limits    Json     @default("{\"monthly_files\": 1000}")
  users     User[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model User {
  id             String       @id @default(cuid())
  email          String       @unique
  name           String
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id])
  role           String       @default("user")
  jobs           Job[]
  auditLogs      AuditLog[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

model Job {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  name            String
  status          String    @default("pending")
  priority        Int       @default(0)
  progress        Int       @default(0)
  totalFiles      Int       @default(0)
  processedFiles  Int       @default(0)
  configuration   Json      @default("{}")
  errorMessage    String?
  files           File[]
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

```typescript
// lib/queue.ts - Job Queue System
import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { processOCRJob } from '@/lib/ocr-processor';

export const ocrQueue = new Queue('ocr-processing', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export const ocrWorker = new Worker(
  'ocr-processing',
  async (job: Job) => {
    const { jobId, files } = job.data;
    
    // Update job status
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'processing', startedAt: new Date() }
    });

    try {
      const results = await processOCRJob(jobId, files, (progress) => {
        job.updateProgress(progress);
      });

      await prisma.job.update({
        where: { id: jobId },
        data: { 
          status: 'completed', 
          completedAt: new Date(),
          processedFiles: results.successCount 
        }
      });

      return results;
    } catch (error) {
      await prisma.job.update({
        where: { id: jobId },
        data: { 
          status: 'failed', 
          errorMessage: error.message,
          completedAt: new Date()
        }
      });
      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  }
);
```

### Phase 2: API Layer (Week 2-3)
```typescript
// app/api/upload/route.ts - File Upload API
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const jobName = formData.get('jobName') as string || 'New OCR Job';

    // Create job
    const job = await prisma.job.create({
      data: {
        userId: session.user.id,
        name: jobName,
        totalFiles: files.length,
        status: 'uploading'
      }
    });

    // Process each file
    const uploadDir = join(process.cwd(), 'uploads', job.id);
    await mkdir(uploadDir, { recursive: true });

    const fileRecords = await Promise.all(
      files.map(async (file, index) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${index}_${file.name}`;
        const filepath = join(uploadDir, filename);
        
        await writeFile(filepath, buffer);

        return prisma.file.create({
          data: {
            jobId: job.id,
            originalName: file.name,
            filePath: filepath,
            fileSize: file.size,
            mimeType: file.type
          }
        });
      })
    );

    // Update job status
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'ready' }
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      filesUploaded: fileRecords.length
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Upload failed', details: error.message },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/jobs/[id]/process/route.ts - Start Processing
import { NextRequest, NextResponse } from 'next/server';
import { ocrQueue } from '@/lib/queue';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: { files: true }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Add to processing queue
    await ocrQueue.add('process-job', {
      jobId: job.id,
      files: job.files
    });

    await prisma.job.update({
      where: { id: params.id },
      data: { status: 'queued' }
    });

    return NextResponse.json({ success: true, status: 'queued' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/jobs/[id]/status/route.ts - Real-time Status
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      include: {
        files: {
          include: {
            processingResults: true
          }
        }
      }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      name: job.name,
      status: job.status,
      progress: job.progress,
      totalFiles: job.totalFiles,
      processedFiles: job.processedFiles,
      files: job.files,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}
```

### Phase 3: Frontend Components (Week 3-4)
```tsx
// app/upload/page.tsx - Upload Interface
'use client'

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, File, X } from 'lucide-react';
import { toast } from 'sonner';

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter(file => file.type === 'application/pdf');
    if (pdfFiles.length !== acceptedFiles.length) {
      toast.error('Only PDF files are supported');
    }
    setFiles(prev => [...prev, ...pdfFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('jobName', `OCR Job - ${new Date().toLocaleString()}`);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Uploaded ${result.filesUploaded} files successfully`);
        // Redirect to job page
        window.location.href = `/jobs/${result.jobId}`;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Upload PDF Files</h1>
        <p className="text-muted-foreground">
          Drag and drop your PDF files or click to browse
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            {isDragActive ? (
              <p>Drop the PDF files here...</p>
            ) : (
              <div className="space-y-2">
                <p>Drag PDF files here, or click to select</p>
                <p className="text-sm text-muted-foreground">
                  Supports multiple PDF files up to 10MB each
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Selected Files ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div className="flex items-center space-x-2">
                    <File className="h-4 w-4" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <Button 
                onClick={handleUpload} 
                disabled={uploading}
                className="w-full"
                size="lg"
              >
                {uploading ? 'Uploading...' : `Upload ${files.length} Files`}
              </Button>
              {uploading && (
                <Progress value={uploadProgress} className="mt-2" />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

```tsx
// components/job-dashboard.tsx - Job Processing Dashboard
'use client'

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Play, Download, RefreshCw, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

interface JobDashboardProps {
  jobId: string;
}

export default function JobDashboard({ jobId }: JobDashboardProps) {
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchJobStatus = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}/status`);
        const data = await response.json();
        setJob(data);
        
        // Setup polling for active jobs
        if (['processing', 'queued'].includes(data.status)) {
          interval = setInterval(fetchJobStatus, 2000);
        }
      } catch (error) {
        toast.error('Failed to load job status');
      } finally {
        setLoading(false);
      }
    };

    fetchJobStatus();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId]);

  const startProcessing = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/process`, {
        method: 'POST'
      });
      
      if (response.ok) {
        toast.success('Processing started');
        setJob(prev => ({ ...prev, status: 'queued' }));
      }
    } catch (error) {
      toast.error('Failed to start processing');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!job) return <div>Job not found</div>;

  const statusColor = {
    pending: 'secondary',
    ready: 'default',
    queued: 'warning',
    processing: 'info',
    completed: 'success',
    failed: 'destructive'
  };

  const progressData = job.files?.map((file: any, index: number) => ({
    name: `File ${index + 1}`,
    status: file.processingResults?.length > 0 ? 100 : 0
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{job.name}</h1>
          <p className="text-muted-foreground">Created: {new Date(job.createdAt).toLocaleString()}</p>
        </div>
        <Badge variant={statusColor[job.status]}>{job.status.toUpperCase()}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{job.totalFiles}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{job.processedFiles}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{job.progress}%</div>
            <Progress value={job.progress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {job.completedAt 
                ? Math.round((new Date(job.completedAt) - new Date(job.startedAt)) / 1000 / 60)
                : job.startedAt 
                ? Math.round((new Date() - new Date(job.startedAt)) / 1000 / 60)
                : 0}m
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Processing Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="status" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {job.status === 'ready' && (
              <Button onClick={startProcessing} className="w-full">
                <Play className="mr-2 h-4 w-4" />
                Start Processing
              </Button>
            )}

            {job.status === 'completed' && (
              <Button variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Results
              </Button>
            )}

            <Button variant="outline" className="w-full">
              <Eye className="mr-2 h-4 w-4" />
              View Logs
            </Button>

            <Button variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Status
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### Phase 4: Advanced Enterprise Features (Week 4-5)
```tsx
// components/analytics-dashboard.tsx - Enterprise Analytics
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export default function AnalyticsDashboard() {
  // Analytics data would come from API
  const processingTrends = [
    { date: '2024-01', files: 1200, success: 1150 },
    { date: '2024-02', files: 1500, success: 1480 },
    { date: '2024-03', files: 1800, success: 1750 },
  ];

  const languageDistribution = [
    { language: 'English', count: 450, color: '#8884d8' },
    { language: 'Hindi', count: 320, color: '#82ca9d' },
    { language: 'Gujarati', count: 180, color: '#ffc658' },
    { language: 'Mixed', count: 50, color: '#ff7300' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,486</div>
            <p className="text-xs text-green-600">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">97.2%</div>
            <p className="text-xs text-green-600">+0.8% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4s</div>
            <p className="text-xs text-red-600">+0.2s from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-blue-600">In processing queue</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Processing Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={processingTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="files" stroke="#8884d8" name="Total Files" />
                <Line type="monotone" dataKey="success" stroke="#82ca9d" name="Successful" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Language Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={languageDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ language, percent }) => `${language} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {languageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

## 🔐 Security & Compliance Implementation

### Authentication & Authorization
```typescript
// lib/auth.ts - NextAuth Configuration
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session: async ({ session, user }) => {
      if (session?.user) {
        session.user.id = user.id;
        // Add organization and role data
        const userData = await prisma.user.findUnique({
          where: { id: user.id },
          include: { organization: true }
        });
        session.user.role = userData?.role;
        session.user.organization = userData?.organization;
      }
      return session;
    },
  },
});
```

### Rate Limiting & API Security
```typescript
// middleware.ts - Security Middleware
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 h'),
});

export async function middleware(request: NextRequest) {
  // Apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.ip ?? '127.0.0.1';
    const { success, pending, limit, reset, remaining } = await ratelimit.limit(ip);

    if (!success) {
      return new NextResponse('Rate limit exceeded', { status: 429 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
```

## 📦 Deployment Strategy

### Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Python dependencies
FROM python:3.9-slim AS python-deps
RUN pip install PyMuPDF tqdm

# Final image
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=python-deps /usr/local/lib/python3.9 /usr/local/lib/python3.9
COPY --from=python-deps /usr/local/bin/python3 /usr/local/bin/python3

COPY . .
RUN npm run build

USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
```

### Infrastructure as Code (Terraform)
```hcl
# infrastructure/main.tf
provider "aws" {
  region = var.aws_region
}

# ECS Cluster
resource "aws_ecs_cluster" "ocr_platform" {
  name = "ocr-platform"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier = "ocr-platform-db"
  engine     = "postgres"
  engine_version = "15"
  instance_class = "db.t3.micro"
  allocated_storage = 20
  
  db_name  = "ocrplatform"
  username = var.db_username
  password = var.db_password
  
  skip_final_snapshot = true
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "ocr-platform-redis"
  engine               = "redis"
  node_type           = "cache.t3.micro"
  num_cache_nodes     = 1
  parameter_group_name = "default.redis6.x"
  port                = 6379
}
```

## 📊 Missing Enterprise Features Implementation

### 1. Advanced Document Management
```typescript
// lib/document-classifier.ts
export class DocumentClassifier {
  async classifyDocument(content: string, metadata: any) {
    // AI-powered document classification
    const categories = await this.analyzeContent(content);
    return {
      category: categories.primary,
      confidence: categories.confidence,
      suggestedTags: categories.tags,
      extractedEntities: await this.extractEntities(content)
    };
  }
}
```

### 2. Quality Assurance Workflow
```typescript
// components/qa-review.tsx
export default function QAReview({ documentId }: { documentId: string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Quality Assurance Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3>Original Document</h3>
              <DocumentViewer documentId={documentId} />
            </div>
            <div>
              <h3>OCR Result</h3>
              <TextEditor 
                content={ocrResult}
                onChange={handleOCREdit}
              />
            </div>
          </div>
          <div className="mt-4 space-x-2">
            <Button onClick={approveDocument}>Approve</Button>
            <Button variant="outline" onClick={rejectDocument}>
              Request Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 3. Integration Hub
```typescript
// lib/integrations/google-drive.ts
export class GoogleDriveIntegration {
  async importFromDrive(folderId: string, userId: string) {
    // Import files from Google Drive
    const files = await this.listDriveFiles(folderId);
    return this.createBatchJob(files, userId);
  }

  async exportToDrive(jobId: string, folderId: string) {
    // Export results back to Google Drive
    const results = await this.getJobResults(jobId);
    return this.uploadToDrive(results, folderId);
  }
}
```

## 🎯 Success Metrics & KPIs

### Performance Targets
- **Upload Speed**: < 2 seconds for 10MB files
- **Processing Speed**: < 5 seconds per PDF page
- **UI Responsiveness**: < 100ms for all interactions
- **Uptime**: 99.9% availability
- **Success Rate**: > 98% OCR accuracy

### Business Metrics
- **User Adoption**: 500+ active users in first 3 months
- **Processing Volume**: 50,000+ documents processed monthly
- **Customer Satisfaction**: > 4.5/5 rating
- **API Usage**: 10,000+ API calls daily

This comprehensive plan transforms your CLI tool into a modern, scalable, enterprise-ready web platform with advanced features, real-time processing, and robust analytics. The implementation follows industry best practices and provides a solid foundation for future enhancements.