# OCR Platform - Docker Deployment Guide

🚀 **One-Click Docker Deployment** for the OCR Web Platform

## Quick Start

Run the entire OCR platform with a single command:

```bash
./start-docker.sh
```

That's it! The script handles everything automatically:
- ✅ Environment setup
- ✅ Docker image building
- ✅ Service orchestration
- ✅ Health checks
- ✅ Database migrations

## What Gets Started

The platform includes these services:

| Service | Port | Description |
|---------|------|-------------|
| **Web App** | 3000 | Main OCR web interface |
| **PostgreSQL** | 5432 | Database for jobs and files |
| **Redis** | 6379 | Queue and caching |
| **Worker** | - | Background OCR processing |
| **Redis Commander** | 8081 | Queue monitoring (optional) |

## Access Your Platform

Once started, access your OCR platform at:
- **Main Application**: http://localhost:3000
- **Queue Monitor**: http://localhost:8081 (admin/admin123)

## Script Options

```bash
# Basic startup
./start-docker.sh

# Skip image building (faster restart)
./start-docker.sh --skip-build

# Start with Redis monitoring
./start-docker.sh --with-monitoring

# Get help
./start-docker.sh --help
```

## Managing the Platform

### Stop All Services
```bash
docker-compose down
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f web
docker-compose logs -f worker
```

### Restart Services
```bash
docker-compose restart
```

### Access Database
```bash
docker-compose exec postgres psql -U ocr_user -d ocr_platform
```

## File Storage

All uploaded files and processing results are stored in Docker volumes:
- `ocr-uploads-data` - User uploaded files
- `ocr-logs-data` - Processing logs
- `ocr-postgres-data` - Database data
- `ocr-redis-data` - Queue data

## Environment Configuration

The platform uses these key settings (see `.env` file):

```bash
# Database
POSTGRES_PASSWORD=secure_dev_password_123

# Worker Performance  
WORKER_CONCURRENCY=2

# Security
ENCRYPTION_SECRET=dev-encryption-secret-change-in-production
```

## Troubleshooting

### Services Won't Start
```bash
# Check Docker is running
docker info

# View detailed logs
docker-compose logs

# Rebuild everything
./start-docker.sh --no-cache
```

### Performance Issues
- Increase `WORKER_CONCURRENCY` in `.env`
- Allocate more memory to Docker Desktop
- Check disk space for volumes

### Database Issues
```bash
# Reset database (⚠️ destroys data)
docker-compose down -v
./start-docker.sh
```

## Production Deployment

For production:

1. **Update passwords** in `.env`:
   ```bash
   POSTGRES_PASSWORD=your-secure-password
   ENCRYPTION_SECRET=your-32-char-secret
   ```

2. **Use proper domain**:
   - Update any hardcoded localhost URLs
   - Set up reverse proxy (nginx/traefik)
   - Enable HTTPS

3. **Backup strategy**:
   ```bash
   # Backup volumes
   docker run --rm -v ocr-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
   ```

## Architecture Overview

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────┐
│   Web Browser   │───▶│   Web App    │───▶│ PostgreSQL  │
│   (port 3000)   │    │  (Next.js)   │    │  Database   │
└─────────────────┘    └──────────────┘    └─────────────┘
                              │
                              ▼
                       ┌──────────────┐    ┌─────────────┐
                       │    Redis     │───▶│   Worker    │
                       │    Queue     │    │ (OCR Proc.) │
                       └──────────────┘    └─────────────┘
```

## Support

- **Logs**: `docker-compose logs -f`
- **Health**: Check http://localhost:3000/api/health
- **Queue**: Monitor at http://localhost:8081

---

🎉 **Your OCR platform is ready!** Upload PDFs and get high-quality text extraction.