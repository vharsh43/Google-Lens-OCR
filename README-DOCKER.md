# 🐳 Docker Setup - Google Lens OCR Platform

This guide will help you run the complete OCR platform with all services using Docker with **just one command**.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- At least 4GB RAM available for containers
- Ports 3000, 5432, 6379, 8080, 8081 available

### One Command Setup

```bash
./start-docker.sh
```

That's it! This single command will:
- ✅ Check Docker availability
- ✅ Set up all necessary directories
- ✅ Configure environment variables
- ✅ Start PostgreSQL database with optimized settings
- ✅ Start Redis for job queue management
- ✅ Build and start the web application
- ✅ Start the background OCR worker
- ✅ Show you all the URLs to access the services

## 🎛️ Advanced Options

### Start with Monitoring Services
```bash
./start-docker.sh --monitoring
```
Includes PgAdmin (database management) and Redis Commander (queue monitoring)

### Start with Logs
```bash
./start-docker.sh --logs
```
Shows live logs after startup

### Clean Start
```bash
./start-docker.sh --cleanup --monitoring --logs
```
Cleans up old containers, starts with monitoring, and shows logs

### Get Help
```bash
./start-docker.sh --help
```

## 🌐 Service URLs

Once started, you can access:

| Service | URL | Credentials |
|---------|-----|------------|
| **Web Application** | http://localhost:3333 | - |
| **Database Admin (PgAdmin)** | http://localhost:8080 | admin@ocr-platform.local / admin123 |
| **Redis Commander** | http://localhost:8081 | admin / admin123 |

## 📊 What's Running

The Docker setup includes:

### Core Services
- **Web Application** (`ocr-web`) - Next.js web interface on port 3333
- **Queue Worker** (`ocr-worker`) - Background OCR processing
- **PostgreSQL** (`ocr-postgres`) - Database with optimized settings
- **Redis** (`ocr-redis`) - Job queue and caching

### Optional Monitoring Services
- **PgAdmin** (`ocr-pgadmin`) - Database management interface
- **Redis Commander** (`ocr-redis-commander`) - Queue monitoring

## 🔧 Common Commands

### View Service Status
```bash
docker compose ps
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f web
docker compose logs -f worker
```

### Restart Services
```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart web
```

### Stop Everything
```bash
docker compose down
```

### Update and Rebuild
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 📁 Volume Mounts

The setup creates persistent volumes for:

- **postgres_data** - Database files (persistent across restarts)
- **redis_data** - Redis data and job queue
- **uploads_data** - Uploaded files
- **logs_data** - Application logs
- **processed_data** - OCR results and intermediate files

## 🛠️ Development

### File Changes
The web application container mounts the local `web-platform` directory, so changes to code are automatically reflected.

### Database Changes
```bash
# Run migrations
docker compose exec web npm run db:migrate

# Access database
docker compose exec postgres psql -U ocr_user -d ocr_platform

# Or use PgAdmin at http://localhost:8080
```

### Worker Debugging
```bash
# View worker logs
docker compose logs -f worker

# Restart worker only
docker compose restart worker
```

## 🔍 Troubleshooting

### Services Won't Start
```bash
# Check Docker is running
docker info

# Check port conflicts
lsof -i :3333
lsof -i :5432
lsof -i :6379

# View detailed logs
docker compose logs
```

### Database Issues
```bash
# Reset database
docker compose down
docker volume rm ocr_postgres_data
docker compose up -d postgres
```

### Permission Issues
```bash
# Fix file permissions
sudo chown -R $USER:$USER uploads/ logs/ processed/
```

### Out of Memory
```bash
# Check Docker resource limits
docker system df
docker system prune
```

## 🔒 Security Notes

### Development vs Production
- This setup is optimized for development
- Uses default passwords (change for production)
- Exposes database ports (remove for production)
- Includes debugging tools (disable for production)

### Production Checklist
- [ ] Change all default passwords
- [ ] Use environment-specific secrets
- [ ] Remove exposed database ports
- [ ] Enable HTTPS
- [ ] Configure proper backup strategy
- [ ] Set up monitoring and alerting

## 🚀 Performance Tips

### Resource Allocation
- **Minimum**: 4GB RAM, 2 CPU cores
- **Recommended**: 8GB RAM, 4 CPU cores
- **Optimal**: 16GB RAM, 8 CPU cores

### Docker Desktop Settings
1. Go to Docker Desktop → Settings → Resources
2. Set Memory to at least 4GB
3. Set CPU to at least 2 cores
4. Enable "Use virtualization framework" on macOS

### Database Performance
The PostgreSQL container is pre-configured with optimized settings:
- `shared_buffers = 256MB`
- `effective_cache_size = 1GB`
- `work_mem = 4MB`
- `maintenance_work_mem = 64MB`

## 📝 Environment Variables

The setup uses optimized environment variables. Key ones include:

```bash
# Database
DATABASE_URL=postgresql://ocr_user:ocr_secure_password_2024@postgres:5432/ocr_platform

# Processing
WORKER_CONCURRENCY=2
PYTHON_PATH=/usr/bin/python3
PDF_SCRIPT_PATH=/app/scripts/PDF_2_PNG.py

# Files
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10737418240  # 10GB
```

## 🔧 Customization

### Change Database Password
1. Edit `docker-compose.yml`
2. Update `POSTGRES_PASSWORD` and `DATABASE_URL`
3. Rebuild: `docker compose down && docker compose up --build`

### Adjust Worker Concurrency
1. Edit `WORKER_CONCURRENCY` in `docker-compose.yml`
2. Restart: `docker compose restart worker`

### Add Custom Environment Variables
1. Edit `.env.docker`
2. Restart services: `docker compose restart`

## 📞 Support

### Logs and Debugging
```bash
# Full system status
./start-docker.sh --monitoring
docker compose ps
docker compose logs --tail=50

# Health checks
curl http://localhost:3333/api/health
```

### Clean Slate Reset
```bash
docker compose down --volumes --remove-orphans
docker system prune -a
./start-docker.sh --cleanup --monitoring
```

### Get Help
- Check the main project README
- View service logs for specific errors
- Ensure Docker has sufficient resources
- Verify no port conflicts exist

---

## 🎉 That's It!

You now have a fully functional OCR platform running in Docker with:
- Web interface for file uploads
- Real-time processing with progress tracking
- Database and queue management
- Monitoring tools
- All accessible through your browser

Just run `./start-docker.sh` and start processing your documents! 🚀