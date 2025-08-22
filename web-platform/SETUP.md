# OCR Web Platform Setup Guide

## Overview

This is a modern web application for processing PDF files using OCR (Optical Character Recognition) technology. The platform provides a user-friendly interface for uploading PDF documents, processing them through an advanced OCR pipeline, and downloading the extracted text and images.

## Architecture

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS v4, and ShadCN UI
- **Backend**: Next.js API routes with Prisma ORM
- **Database**: PostgreSQL for data persistence
- **Queue System**: Redis + BullMQ for job processing
- **Authentication**: NextAuth.js with Google OAuth
- **OCR Processing**: Integration with existing Python pipeline

## Prerequisites

Before setting up the application, ensure you have the following installed:

- Node.js 18.17.0 or higher
- PostgreSQL 13+ database
- Redis server
- Python 3.8+ with PyMuPDF (for PDF processing)
- Git

## Quick Start

### 🚀 One-Command Startup (Recommended)

For the fastest setup, use our comprehensive startup script:

```bash
git clone <repository-url>
cd web-platform
npm run start-platform
```

This single command will:
- 📋 Copy `.env.example` to `.env.local` (if needed)
- 🔍 Validate your entire environment setup
- 🗄️ Setup the database automatically
- 🎯 Start all required services (web app + queue worker)

**First-time setup:** The script will create `.env.local` for you, but you'll need to edit it with your actual configuration values (database URL, secrets, etc.) before the platform can start successfully.

### 📚 Manual Setup (Alternative)

If you prefer step-by-step setup:

#### 1. Clone and Install

```bash
git clone <repository-url>
cd web-platform
npm install
```

#### 2. Environment Configuration

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration values. See the Environment Variables section below for details.

#### 3. Validate Setup

```bash
# Run environment validation
npm run validate
```

This will check:
- Python installation and version
- OCR script file locations  
- Environment variable configuration
- Required directories

Fix any errors before proceeding.

#### 4. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# (Optional) Open Prisma Studio to view your database
npm run db:studio
```

#### 5. Start Development Servers

Open 3 terminal windows and run:

```bash
# Terminal 1: Start the web application
npm run dev

# Terminal 2: Start the queue worker
npm run queue:dev

# Terminal 3: Start Redis (if not running as a service)
redis-server
```

The application will be available at `http://localhost:3000`

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/ocr_db` |
| `NEXTAUTH_SECRET` | Secret for NextAuth.js sessions | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Application URL | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | From Google Cloud Console |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `UPLOAD_DIR` | File upload directory | `./uploads` |
| `MAX_FILE_SIZE` | Maximum file size in bytes (optional) | No limit |
| `WORKER_CONCURRENCY` | Concurrent OCR jobs | `2` |
| `PYTHON_PATH` | Python executable path | Auto-detected |
| `PDF_SCRIPT_PATH` | Path to PDF_2_PNG.py script | `../PDF_2_PNG.py` |
| `OCR_SCRIPT_PATH` | Path to batch-process.js script | `../src/batch-process.js` |
| `OCR_LOGS_DIR` | OCR processing logs directory | `../logs` |

## Python Setup and Requirements

### Automatic Python Detection

The application automatically detects your Python installation by trying these commands in order:
1. `python3` (preferred)
2. `python`
3. `py` (Windows)

**Requirements:**
- Python 3.8 or higher
- PyMuPDF (fitz) library for PDF processing

**Installation:**
```bash
# Install Python dependencies
pip install PyMuPDF

# Or if using python3 specifically:
pip3 install PyMuPDF
```

**Manual Python Path (Optional):**
If auto-detection fails, set the `PYTHON_PATH` environment variable:
```bash
# For specific Python installation
PYTHON_PATH="/usr/bin/python3"

# For Windows with py launcher
PYTHON_PATH="py"

# For conda environment
PYTHON_PATH="/path/to/conda/envs/myenv/bin/python"
```

### File Processing Capabilities

**File Size Limits:**
- **No default size limit** - the application can process files of any size
- Set `MAX_FILE_SIZE` environment variable to impose limits if needed
- Large files (>1GB) will show warnings but are not blocked
- Processing time scales with file size and page count

**Supported Formats:**
- PDF files only (validated by MIME type)
- Multi-page PDFs fully supported
- High-resolution output (300 DPI default)

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
7. Copy the Client ID and Client Secret to your `.env.local`

## Database Schema

The application uses the following main entities:

- **Users**: User accounts and authentication
- **Organizations**: Multi-tenant organization support
- **Jobs**: OCR processing jobs
- **Files**: Individual files within jobs
- **ProcessingResults**: OCR results and metadata
- **AuditLogs**: Activity tracking for compliance

## API Endpoints

### Upload API
- `POST /api/upload` - Upload files and create job
- `GET /api/upload` - List jobs with pagination

### Job Management
- `GET /api/jobs/[id]` - Get job details
- `POST /api/jobs/[id]/process` - Start job processing
- `DELETE /api/jobs/[id]/process` - Cancel job
- `POST /api/jobs/[id]/retry` - Retry failed job

### Downloads
- `GET /api/jobs/[id]/download` - Download results (ZIP or individual)
- `GET /api/jobs/[id]/files/[fileId]/preview` - Preview file results

### Real-time Updates
- `GET /api/sse/jobs/[id]` - Server-Sent Events for live progress

## Features

### ✅ Completed Features

- **File Upload**: Drag-and-drop PDF upload with validation
- **Job Management**: Create, monitor, cancel, and retry processing jobs
- **Real-time Progress**: Live updates during processing using SSE
- **Download System**: Bulk and individual file downloads in ZIP format
- **File Preview**: Text and image preview before download
- **User Authentication**: Google OAuth integration
- **Responsive UI**: Mobile-friendly interface with ShadCN components
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Queue System**: Redis-based job queue with retry logic
- **Audit Logging**: Complete activity tracking

### 🔄 OCR Processing Pipeline

1. **File Upload**: PDFs uploaded and validated
2. **Queue Processing**: Jobs queued in Redis with BullMQ
3. **PDF to PNG**: Convert PDF pages to high-quality images (300 DPI)
4. **OCR Extraction**: Extract text using Google Lens technology
5. **Results Processing**: Organize text and images in structured format
6. **Download**: Provide ZIP downloads with metadata

## Development

### Project Structure

```
web-platform/
├── src/
│   ├── app/                 # Next.js app router pages
│   ├── components/          # Reusable UI components
│   ├── lib/                 # Utility libraries and configurations
│   └── workers/            # Background job workers
├── prisma/                 # Database schema and migrations
├── public/                 # Static assets
└── scripts/               # Setup and utility scripts
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes to database
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio
npm run queue:dev    # Start queue worker in development
```

### Code Quality

The project includes:
- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Comprehensive error boundaries
- Toast notifications for user feedback
- Loading states and skeleton screens

## Production Deployment

### Environment Considerations

1. **Database**: Use a managed PostgreSQL service
2. **Redis**: Use a managed Redis service
3. **File Storage**: Consider cloud storage for uploads
4. **Security**: Generate strong secrets and enable HTTPS
5. **Monitoring**: Set up error tracking and performance monitoring

### Build and Deploy

```bash
# Build the application
npm run build

# Start production server
npm start

# Start queue worker in production
NODE_ENV=production npm run queue:dev
```

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure PostgreSQL is running and credentials are correct
2. **Redis Connection**: Verify Redis server is accessible
3. **File Permissions**: Check upload directory permissions
4. **OCR Processing**: Ensure Python dependencies are installed
5. **Google OAuth**: Verify redirect URIs match exactly

### Python and Path Issues

**Python Not Found:**
```bash
# Check if Python is available
python3 --version
python --version
py --version

# Install Python if missing (Ubuntu/Debian)
sudo apt update && sudo apt install python3 python3-pip

# Install Python if missing (macOS with Homebrew)
brew install python

# Install Python dependencies
pip3 install PyMuPDF
```

**Script Files Not Found:**
The application looks for OCR scripts in the parent directory. Ensure these files exist:
- `../PDF_2_PNG.py` (relative to web-platform directory)
- `../src/batch-process.js`
- `../logs/` (directory will be created automatically)

If files are in different locations, update environment variables:
```bash
PDF_SCRIPT_PATH="/absolute/path/to/PDF_2_PNG.py"
OCR_SCRIPT_PATH="/absolute/path/to/batch-process.js"
OCR_LOGS_DIR="/absolute/path/to/logs"
```

**Large File Processing:**
- Ensure sufficient disk space for temporary files
- Consider memory usage for very large PDFs
- Monitor processing progress in application logs
- Large files may take significant time to process

**Cross-Platform Compatibility:**
- Windows: Use forward slashes in paths or double backslashes
- macOS/Linux: Standard Unix paths work
- Docker: Ensure volume mounts include OCR scripts

### Logs and Debugging

- Application logs: Check console output
- Database logs: Use Prisma Studio or database logs
- Queue logs: Monitor Redis and worker output
- Error tracking: Implement Sentry for production

## Support

For issues and questions:
1. Check this documentation
2. Review error logs and console output
3. Verify environment configuration
4. Test with sample PDF files

## License

[Add your license information here]