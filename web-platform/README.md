# OCR Web Platform

A modern, enterprise-grade web application for PDF to text conversion using advanced OCR technology.

## 🚀 Features

- **High-Quality OCR**: 300 DPI PDF conversion with Google Lens technology
- **Real-time Processing**: Live progress tracking with WebSocket updates
- **Enterprise Ready**: Multi-user organizations, role-based access, audit logging
- **Modern UI**: Built with Next.js 15, TypeScript, Tailwind CSS v4, and ShadCN UI
- **Scalable Architecture**: Redis job queues, PostgreSQL database, containerized workers
- **Advanced Analytics**: Processing statistics, success rates, performance metrics

## 🛠️ Technology Stack

### Frontend
- **Next.js 15** with App Router and Server Components
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- **ShadCN UI** for components
- **Recharts** for analytics visualization

### Backend
- **Next.js API Routes** for backend services
- **PostgreSQL** with Prisma ORM
- **Redis** with BullMQ for job queues
- **NextAuth.js** for authentication

### Processing
- **Existing Python Pipeline** (containerized)
- **Node.js Workers** for orchestration
- **File Storage** (local/S3 compatible)

## 📋 Prerequisites

- **Node.js 18+**
- **PostgreSQL 14+**
- **Redis 6+**
- **Python 3.8+** (for OCR processing)

## ⚡ Quick Start

> 🐋 **Docker Setup (Recommended)**: Zero local dependencies - only Docker required!

### 1. Docker Setup (Recommended)

```bash
git clone <repository-url>
cd ocr-web-platform
./docker-start.sh
```

**🎉 That's it!** Platform runs at **http://localhost:3000**

**Docker automatically handles:**
- ✅ **Zero Dependencies**: No Node.js, Python, PostgreSQL, or Redis installation needed
- 🐋 **Complete Isolation**: All services run in containers
- 🔄 **Auto-Setup**: Database, Redis, web app, and workers all configured
- 📦 **Cross-Platform**: Works on any machine with Docker
- 🔧 **Production Ready**: Enterprise-grade containerization

[📖 **Complete Docker Guide →**](./DOCKER.md)

### 2. Local Development Setup (Alternative)

If you prefer local development without Docker:

```bash
git clone <repository-url>
cd ocr-web-platform
npm install
npm run start-platform
```

**This command automatically:**
- ✅ Validates system requirements (Node.js 18+, Python 3.8+, dependencies)
- 📁 Creates `.env.local` from `.env.example` if needed
- 🔌 Checks port availability (3000, 5432, 6379)
- 🗄️ Sets up database with auto-retry logic
- 🏥 Performs service health checks
- 🎯 Starts web app and queue worker with monitoring
- 🔄 Enables auto-recovery and graceful shutdown

**Platform will be running at [http://localhost:3000](http://localhost:3000)**

### Alternative: Manual Setup

If you prefer manual setup or need to troubleshoot:

#### 2a. Database Setup (if needed)

```bash
# Start PostgreSQL (example with Docker)
docker run --name postgres-ocr \
  -e POSTGRES_DB=ocr_platform \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:15

# Start Redis (optional - for queue processing)
docker run --name redis-ocr \
  -p 6379:6379 \
  -d redis:7-alpine
```

#### 2b. Environment Configuration

```bash
cp .env.example .env.local  # Note: .env.local (not .env)
```

Edit `.env.local` with your configuration:

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ocr_platform"

# NextAuth.js Configuration
NEXTAUTH_SECRET="your-super-secret-nextauth-key-for-development-only-change-in-production"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (for authentication)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Redis Configuration (for job queue)
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""  # Leave empty if no password

# OCR Processing Configuration
PYTHON_PATH=""  # Auto-detected (python3, python, py)
PDF_SCRIPT_PATH="../PDF_2_PNG.py"
OCR_SCRIPT_PATH="../src/batch-process.js"
OCR_LOGS_DIR="../logs"

# Worker Configuration
WORKER_CONCURRENCY=2

# File Upload Configuration
UPLOAD_DIR="./uploads"
# No file size limit by default - configure as needed
```

#### 2c. Manual Database Setup

```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
# OR for migrations: npm run db:migrate
```

#### 2d. Manual Service Start

```bash
# Terminal 1: Next.js app
npm run dev

# Terminal 2: Queue worker
npm run queue:dev
```

### Environment Validation

```bash
# Validate your entire setup
npm run validate
```

This checks:
- ✅ Node.js and npm versions
- ✅ Python availability and version
- ✅ Database connection
- ✅ Redis connection (if configured)
- ✅ Environment variables
- ✅ File permissions and paths

## 🔧 Development Commands

```bash
# Platform Management (Recommended)
npm run start-platform   # 🚀 Complete platform startup with validation
npm run validate         # 🔍 Validate entire environment setup

# Development
npm run dev              # Start Next.js dev server
npm run queue:dev        # Start queue worker
npm run lint             # Run ESLint

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run db:migrate       # Create migration
npm run db:studio        # Open Prisma Studio

# Production
npm run build            # Build for production
npm run start            # Start production server
```

### Enhanced Startup Script Features

The `npm run start-platform` command includes:

- **🔍 Pre-flight Checks**: System requirements validation
- **🔄 Auto-retry Logic**: Resilient database and service setup
- **📊 Progress Indicators**: Visual feedback during operations
- **🏥 Health Monitoring**: Continuous service health checks
- **🛡️ Error Recovery**: Detailed troubleshooting guidance
- **🔄 Auto-restart**: Services restart automatically on failure
- **🛑 Graceful Shutdown**: Clean cleanup on Ctrl+C

## 📁 Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── api/            # API routes
│   ├── upload/         # File upload page
│   ├── jobs/           # Job management
│   └── dashboard/      # Main dashboard
├── components/
│   ├── ui/             # ShadCN UI components
│   └── custom/         # Custom components
├── lib/
│   ├── auth.ts         # Authentication logic
│   ├── prisma.ts       # Database client
│   ├── queue.ts        # Job queue management
│   └── utils.ts        # Utility functions
├── workers/
│   └── queue-worker.ts # Background job processor
└── middleware.ts       # Auth & rate limiting

prisma/
└── schema.prisma       # Database schema

uploads/                # File storage directory
logs/                   # Application logs
```

## 🔐 Authentication Setup

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Secret to `.env`

## 📊 API Endpoints

### File Upload
```http
POST /api/upload
Content-Type: multipart/form-data

# Response
{
  "success": true,
  "jobId": "job_123",
  "filesUploaded": 5,
  "job": { ... }
}
```

### Job Management
```http
GET /api/jobs/{id}           # Get job details
POST /api/jobs/{id}/process  # Start processing
GET /api/jobs/{id}/status    # Get real-time status
DELETE /api/jobs/{id}        # Delete job
```

### Job Status Response
```json
{
  "id": "job_123",
  "status": "PROCESSING",
  "progress": 45,
  "totalFiles": 10,
  "processedFiles": 4,
  "stats": {
    "totalSize": 50000000,
    "avgProcessingTime": 3500,
    "avgConfidence": 0.95
  },
  "eta": "5 min",
  "files": [ ... ]
}
```

## 🔄 Job Processing Pipeline

1. **Upload**: Files uploaded and validated
2. **Queue**: Job added to Redis queue
3. **Processing**: Worker picks up job
4. **PDF→PNG**: Convert to 300 DPI images
5. **OCR**: Extract text using Google Lens
6. **Results**: Store in database
7. **Notification**: Update job status

## 📈 Monitoring & Analytics

### Queue Statistics
```bash
# Check queue status
redis-cli
HGETALL bull:ocr-processing:meta
```

### Database Queries
```sql
-- Job success rate
SELECT 
  status, 
  COUNT(*) as count,
  AVG(processed_files::float / total_files) as avg_success_rate
FROM jobs 
GROUP BY status;

-- Processing performance
SELECT 
  AVG(processing_duration) as avg_time,
  AVG(ocr_confidence) as avg_confidence
FROM processing_results 
WHERE created_at > NOW() - INTERVAL '24 hours';
```

## 🚀 Production Deployment

### Docker Deployment

```bash
# Build image
docker build -t ocr-platform .

# Run with environment
docker run -d \
  --name ocr-platform \
  -p 3000:3000 \
  --env-file .env.production \
  ocr-platform
```

### Environment Variables (Production)

```env
NODE_ENV=production
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
NEXTAUTH_URL="https://yourdomain.com"

# File storage
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="ocr-files"

# Monitoring
LOG_LEVEL="info"
ENABLE_AUDIT_LOGS="true"
```

## 🔒 Security Considerations

### Authentication
- JWT-based sessions with NextAuth.js
- OAuth integration (Google, Microsoft)
- Role-based access control (RBAC)

### Data Protection
- File upload validation and scanning
- Rate limiting on API endpoints
- Audit logging for all actions
- Encrypted file storage

### Compliance
- GDPR-compliant data handling
- SOC2 compliance features
- Data retention policies
- Right to erasure support

## 🐛 Troubleshooting

### First Line of Defense

```bash
# Comprehensive environment validation (always run this first)
npm run validate
```

This will identify most common issues automatically and provide specific solutions.

### Enhanced Startup Script Troubleshooting

If `npm run start-platform` fails, it provides detailed error messages and solutions:

- **Pre-flight Failures**: Missing Node.js, Python, or dependencies
- **Port Conflicts**: Services already running on required ports  
- **Database Issues**: Connection problems with automatic retry suggestions
- **Environment Problems**: Missing or incorrect configuration values
- **Service Health**: Problems with PostgreSQL or Redis connections

### Common Issues & Solutions

#### **Environment Variables Not Loading**
```bash
# Ensure .env.local exists with correct format
cp .env.example .env.local

# Check for common issues:
# - No quotes around simple values
# - WORKER_CONCURRENCY=2 (not "2")
# - Proper file paths without extra spaces
```

#### **Database Connection Error**
```bash
# Check PostgreSQL status
docker ps | grep postgres
docker logs postgres-ocr

# Auto-fix with startup script (recommended)
npm run start-platform  # Includes auto-retry logic

# Manual reset
npm run db:push  # Force schema sync
npm run db:studio  # Test connection
```

#### **Queue Worker Not Processing**
```bash
# Check Redis connection
redis-cli ping  # Should return PONG

# Check worker configuration
echo $WORKER_CONCURRENCY  # Should be a number (2)

# Worker includes auto-restart - check logs for specific errors
npm run queue:dev
```

#### **BullMQ Concurrency Error**
```bash
# Common error: "concurrency must be a finite number greater than 0"
# Fix: Ensure WORKER_CONCURRENCY=2 in .env.local (no quotes)

# Verify environment loading
npm run validate
```

#### **Python Path Issues**
```bash
# Auto-detection failed
python3 --version  # Should show Python 3.8+
python --version   # Alternative
py --version       # Windows

# Manual override in .env.local
PYTHON_PATH="python3"  # or full path
```

#### **Port Already in Use**
```bash
# The startup script checks this automatically
# Manual check:
lsof -ti:3000 | xargs kill -9  # Kill process on port 3000
```

#### **File Upload/Processing Errors**
```bash
# Check file permissions
ls -la uploads/
mkdir -p uploads && chmod 755 uploads/

# Check Python dependencies
pip3 install PyMuPDF  # For PDF processing

# Check disk space
df -h
```

### Advanced Troubleshooting

#### **Service Monitoring**
The enhanced startup script includes built-in monitoring:
- ✅ Health checks every 30 seconds
- 🔄 Auto-restart on service failures  
- 📊 Detailed error reporting with stack traces
- 🛡️ Graceful shutdown handling

#### **Logs & Debugging**
```bash
# Application logs (with enhanced error details)
npm run start-platform  # Includes comprehensive logging

# Database debugging
npm run db:studio

# Queue debugging
redis-cli
HGETALL bull:ocr-processing:meta
```

#### **Manual Recovery Steps**
```bash
# If all else fails, complete reset:
1. rm -rf node_modules && npm install
2. rm .env.local && cp .env.example .env.local
3. npm run db:push
4. npm run validate
5. npm run start-platform
```

### Error Code Reference

The startup script provides specific error codes and solutions:

- **ENV_001**: Environment file missing → Auto-created from template
- **DB_001**: Database connection failed → Retry with auto-recovery
- **PORT_001**: Port conflicts → Detailed port usage report
- **PY_001**: Python not found → Installation instructions
- **DEPS_001**: Dependencies missing → Auto-install suggestions

### Getting Help

1. **Validation**: `npm run validate` (checks everything)
2. **Startup Script**: `npm run start-platform` (auto-diagnosis)
3. **Logs**: Check console output for detailed error messages
4. **Documentation**: See `CLAUDE.md` for technical details

## 📚 API Documentation

Full API documentation is available at `/api/docs` when running in development mode.

Interactive API explorer: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.ocrplatform.com](https://docs.ocrplatform.com)
- **Issues**: [GitHub Issues](https://github.com/yourorg/ocr-platform/issues)
- **Email**: support@ocrplatform.com
- **Slack**: [Join our community](https://slack.ocrplatform.com)