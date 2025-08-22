# OCR Web Platform - Claude Development Guide

This document provides comprehensive information for Claude to understand and work with the OCR Web Platform project effectively.

## Project Overview

**OCR Web Platform** is a modern, enterprise-ready web application that transforms CLI-based OCR operations into a user-friendly web interface. Built with Next.js 15, TypeScript, and enterprise-grade architecture.

### Key Features
- 📤 **File Upload**: Drag-and-drop interface with support for PDFs, images, and documents
- 🔄 **Real-time Processing**: Live progress tracking with SSE (Server-Sent Events)
- 📊 **Analytics Dashboard**: Charts, statistics, and processing insights
- 👤 **Authentication**: Google OAuth with NextAuth.js
- 🗃️ **Database**: PostgreSQL with Prisma ORM
- 🔄 **Job Queue**: Redis + BullMQ for background processing
- 📱 **Responsive UI**: Tailwind CSS v4 + ShadCN UI components

## Quick Start Commands

### Primary Commands
```bash
# Start the entire platform (recommended)
npm run start-platform

# Development mode (manual)
npm run dev              # Start Next.js development server
npm run queue:dev        # Start queue worker separately

# Database operations
npm run db:generate      # Generate Prisma client
npm run db:push         # Push schema to database
npm run db:migrate      # Run database migrations
npm run db:studio       # Open Prisma Studio

# Validation and setup
npm run validate        # Validate entire environment setup
npm run build          # Build for production
npm run lint           # Run ESLint
```

### Single Command Startup
```bash
npm run start-platform
```
This command performs:
1. ✅ Pre-flight system checks (Node.js, Python, dependencies)
2. 📁 Environment file setup (.env.example → .env.local)
3. 🔌 Port availability checks
4. 🔍 Environment validation
5. 🗄️ Database setup with auto-recovery
6. 🏥 Service health checks
7. 🎯 Start all services with monitoring

## Project Structure

```
web-platform/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   ├── dashboard/         # Dashboard pages
│   │   ├── auth/             # Authentication pages
│   │   └── layout.tsx        # Root layout
│   ├── components/            # React components
│   │   ├── ui/               # ShadCN UI components
│   │   ├── charts/           # Chart components (Recharts)
│   │   ├── file-upload/      # Upload components
│   │   └── forms/            # Form components
│   ├── lib/                  # Utilities and configurations
│   │   ├── auth.ts          # NextAuth configuration
│   │   ├── db.ts            # Prisma client
│   │   ├── queue-enhanced.ts # BullMQ configuration
│   │   └── utils.ts         # Utility functions
│   ├── workers/              # Background workers
│   │   └── queue-worker.ts  # OCR processing worker
│   └── types/               # TypeScript type definitions
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Database migrations
├── scripts/
│   ├── start-platform.js    # Bulletproof startup script
│   └── validate-setup.js    # Environment validation
├── dependency-resolution/    # Dependency management docs
├── .env.local              # Environment variables
├── package.json            # Dependencies and scripts
└── next.config.js          # Next.js configuration
```

## Technology Stack

### Core Framework
- **Next.js 15.1.0**: React framework with App Router
- **React 19.1.1**: UI library (stable version)
- **TypeScript 5.6.3**: Type safety

### Styling & UI
- **Tailwind CSS 4.1.12**: Utility-first CSS framework
- **ShadCN UI**: High-quality component library
- **Lucide React**: Icon library
- **Recharts**: Chart library

### Database & Backend
- **PostgreSQL**: Primary database
- **Prisma 6.14.0**: ORM and database toolkit
- **Redis**: Job queue and caching
- **BullMQ 5.58.0**: Job queue management

### Authentication & Security
- **NextAuth.js 4.24.11**: Authentication framework
- **Google OAuth**: Social authentication

### Development Tools
- **ESLint**: Code linting
- **Concurrently**: Run multiple processes
- **TSX**: TypeScript execution

## Environment Configuration

### Required Environment Variables
```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ocr_platform"

# Authentication
NEXTAUTH_SECRET="your-super-secret-nextauth-key"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Redis (Job Queue)
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# OCR Processing
PYTHON_PATH=""  # Auto-detected
PDF_SCRIPT_PATH="../PDF_2_PNG.py"
OCR_SCRIPT_PATH="../src/batch-process.js"
OCR_LOGS_DIR="../logs"

# Worker Configuration
WORKER_CONCURRENCY=2
NODE_ENV=development

# Security
ENCRYPTION_SECRET="your-encryption-secret"
```

## Database Schema

### Key Models
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  organizationId String?
  organization  Organization? @relation(fields: [organizationId], references: [id])
  jobs          Job[]
  createdAt     DateTime  @default(now())
}

model Job {
  id          String      @id @default(cuid())
  status      JobStatus   @default(PENDING)
  progress    Int         @default(0)
  totalFiles  Int         @default(0)
  userId      String
  user        User        @relation(fields: [userId], references: [id])
  files       File[]
  results     ProcessingResult[]
  createdAt   DateTime    @default(now())
  completedAt DateTime?
}

model File {
  id          String    @id @default(cuid())
  filename    String
  originalName String
  mimeType    String
  size        Int
  path        String
  jobId       String
  job         Job       @relation(fields: [jobId], references: [id])
  uploadedAt  DateTime  @default(now())
}
```

## Common Development Tasks

### Adding New Features
1. **API Routes**: Create in `src/app/api/`
2. **Components**: Add to `src/components/`
3. **Pages**: Create in `src/app/`
4. **Database Changes**: Update `prisma/schema.prisma` and migrate

### Working with the Queue System
```typescript
// Add job to queue
import { getOCRQueue } from '@/lib/queue-enhanced';

const queue = getOCRQueue();
await queue.add('process-ocr', {
  jobId: 'job_123',
  files: ['/path/to/file.pdf']
});
```

### Database Operations
```bash
# After schema changes
npm run db:generate    # Generate Prisma client
npm run db:push       # Push to database
npm run db:migrate    # Create migration

# Reset database (development)
npx prisma migrate reset
```

## Troubleshooting Guide

### Common Issues & Solutions

#### 1. BullMQ Concurrency Error
**Error**: "concurrency must be a finite number greater than 0"
**Solution**: Check `WORKER_CONCURRENCY=2` in `.env.local` (no quotes)

#### 2. Environment Variables Not Loading
**Problem**: Variables not accessible in worker processes
**Solution**: Ensure `dotenv` is loaded before imports in worker files

#### 3. Database Connection Issues
**Error**: Database connection fails
**Solutions**:
```bash
# Check PostgreSQL is running
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Ubuntu

# Test connection
npm run db:studio

# Reset and migrate
npm run db:push
```

#### 4. Port Already in Use
**Error**: Port 3000 already in use
**Solutions**:
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

#### 5. Python Path Issues
**Error**: Python not found or wrong version
**Solution**: Set `PYTHON_PATH` in `.env.local` or ensure Python 3.8+ is in PATH

### Development Best Practices

#### Code Style
- Use TypeScript strictly - no `any` types
- Follow existing component patterns
- Use ShadCN UI components when available
- Follow existing naming conventions

#### Component Development
```typescript
// Preferred component structure
interface ComponentProps {
  // Define props with TypeScript
}

export function Component({ prop }: ComponentProps) {
  // Implementation
}
```

#### API Route Development
```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Implementation
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

#### Database Queries
```typescript
// Use Prisma client
import { db } from '@/lib/db';

const jobs = await db.job.findMany({
  where: { userId },
  include: { files: true, results: true }
});
```

## Testing & Quality Assurance

### Manual Testing Checklist
- [ ] Upload files (PDF, images) works
- [ ] Real-time progress updates display
- [ ] Job queue processing functions
- [ ] Authentication flow works
- [ ] Dashboard charts render
- [ ] File download/preview works
- [ ] Error handling displays correctly

### Performance Considerations
- **File Upload**: Supports large files (configurable limit)
- **Queue Processing**: Concurrent job processing
- **Database**: Indexed queries for performance
- **Frontend**: React 19 with concurrent features

## Deployment Notes

### Production Readiness
- Environment variables properly configured
- Database migrations applied
- Redis instance configured
- File storage configured
- Security secrets generated
- HTTPS enabled
- Error monitoring setup (optional)

### Environment Setup
1. Copy `.env.example` to `.env.local`
2. Configure all required variables
3. Run `npm run validate` to verify setup
4. Use `npm run start-platform` for complete startup

## Recent Changes & Updates

### Latest Critical CSS/UI Fix (v0.1.2) - 2025-08-22
- 🚨 **CRITICAL FIX**: Resolved Tailwind CSS compilation and styling system failure
- ✅ Fixed Tailwind CSS v4 incompatibility by downgrading to stable v3.4.17
- ✅ Created proper PostCSS configuration with tailwindcss and autoprefixer plugins
- ✅ Corrected Tailwind content paths for proper class detection
- ✅ Complete professional UI now renders with full design system functionality
- ✅ Resolved "basic UI with plain buttons" user experience issue

### Previous Critical UI Fix (v0.1.1) - 2025-08-22
- 🚨 **CRITICAL FIX**: Resolved missing AppLayout wrapper in jobs page loading state
- ✅ Jobs page now shows complete UI (navigation, layout, branding) during loading
- ✅ Fixed user experience issue where page appeared "broken" or "basic"
- ✅ Ensured consistent layout across all page states (loading, error, content)
- ✅ Implemented proper AppLayout component architecture patterns

### Latest Dependency Resolution (v0.1.0)
- ✅ Updated all packages to latest stable versions
- ✅ Removed non-existent packages (@radix-ui/react-button, @radix-ui/react-badge)
- ✅ Fixed React 19 compatibility with Next.js 15.1.0
- ✅ Resolved BullMQ configuration issues
- ✅ Enhanced startup script with bulletproof error handling
- ✅ Added comprehensive validation and health checks

### Architecture Decisions
- **App Router**: Using Next.js 15 App Router for modern React features
- **Server Components**: Leveraging React Server Components for performance
- **Queue System**: BullMQ for reliable background processing
- **Database**: PostgreSQL for ACID compliance and scalability
- **Authentication**: NextAuth.js for secure, extensible auth

### Component Architecture Patterns
- **AppLayout Consistency**: ALL page states must use AppLayout wrapper
- **Loading States**: Must maintain complete UI structure, not just spinner
- **Error Boundaries**: Consistent error handling with proper layout
- **Navigation**: Shared Navigation component provides unified UX

### CSS/Styling System
- **Tailwind CSS v3.4.17**: Stable version for reliable compilation
- **PostCSS Configuration**: Required for proper Tailwind processing
- **Content Path Configuration**: Critical for class detection and tree-shaking
- **Design System**: CSS custom properties for consistent theming
- **Responsive Design**: Mobile-first approach with breakpoint system

### Critical CSS Troubleshooting

#### Issue: "Basic UI with plain buttons" or unstyled appearance
**Symptoms**: Website appears unstyled, plain HTML buttons, no design system
**Cause**: Tailwind CSS not compiling properly
**Solution**:
```bash
# 1. Verify Tailwind CSS version compatibility
npm list tailwindcss  # Should be v3.x.x, not v4.x.x

# 2. Check PostCSS configuration exists
ls postcss.config.js  # Must exist with tailwindcss plugin

# 3. Verify content paths in tailwind.config.js
# Must include: './src/**/*.{js,ts,jsx,tsx,mdx}'

# 4. Rebuild after changes
docker-compose build web && docker-compose restart web
```

#### Issue: Raw @tailwind directives visible in CSS
**Symptoms**: CSS file contains "@tailwind base; @tailwind components; @tailwind utilities;"
**Diagnosis**: Tailwind processing pipeline issue
**Note**: If classes work despite visible directives, functionality is not impacted

## Support & Resources

### Documentation Links
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [BullMQ Documentation](https://docs.bullmq.io)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [ShadCN UI Documentation](https://ui.shadcn.com)

### Quick Commands Reference
```bash
npm run start-platform  # 🚀 Start everything
npm run validate        # 🔍 Validate setup
npm run dev            # 🛠️ Development mode
npm run build          # 🏗️ Build production
npm run db:studio      # 🗄️ Database GUI
```

---

**Last Updated**: January 2025
**Platform Version**: 0.1.0
**Dependency Status**: ✅ All packages updated to latest stable versions