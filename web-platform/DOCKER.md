# 🐋 OCR Web Platform - Docker Setup

Complete containerized deployment with **zero local dependencies**. Only Docker is required on the host system.

## 🚀 Quick Start

### Prerequisites
- **Docker** (20.10+)
- **Docker Compose** (v2.0+)

### One-Command Startup

```bash
# Clone and start the platform
git clone <repository-url>
cd web-platform
./docker-start.sh
```

**That's it!** The platform will be running at **http://localhost:3000**

## 📋 Available Commands

### Docker Commands

```bash
# Production startup (recommended)
npm run docker:start
# or directly: ./docker-start.sh

# Development mode with hot reload
npm run docker:dev
# or: ./docker-start.sh --dev

# Force rebuild all containers
npm run docker:build
# or: ./docker-start.sh --build

# Include monitoring services
npm run docker:monitoring
# or: ./docker-start.sh --monitoring

# Validate Docker environment
npm run docker:validate

# View logs
npm run docker:logs

# Stop all services
npm run docker:stop

# Restart services
npm run docker:restart

# Complete cleanup (removes containers and volumes)
npm run docker:cleanup
# or: ./docker-start.sh --cleanup
```

### Script Options

```bash
./docker-start.sh [options]

Options:
  --dev, -d       Start in development mode with hot reload
  --build, -b     Force rebuild all containers
  --monitoring    Include monitoring services (Redis Commander)
  --cleanup       Clean up all containers and volumes
  --help, -h      Show help message
```

## 🏗️ Architecture

### Container Services

1. **Web Application** (`ocr-web`)
   - Next.js 15 with React 19
   - Production-optimized build
   - Runs on port 3000

2. **Queue Worker** (`ocr-worker`)
   - Python 3.8+ with PyMuPDF
   - Node.js for queue processing
   - Background OCR processing

3. **PostgreSQL Database** (`ocr-postgres`)
   - PostgreSQL 15 Alpine
   - Persistent data volumes
   - Runs on port 5432

4. **Redis Cache** (`ocr-redis`)
   - Redis 7 Alpine
   - Job queue management
   - Runs on port 6379

5. **Redis Commander** (`ocr-redis-commander`) *[Optional]*
   - Queue monitoring interface
   - Runs on port 8081
   - Enable with `--monitoring` flag

### Networking

All services communicate through a dedicated Docker network (`ocr-platform-network`) with internal DNS resolution:

- `web` → `postgres:5432` (database)
- `web` → `redis:6379` (cache/queue)
- `worker` → `postgres:5432` (database)
- `worker` → `redis:6379` (queue)

## 🔧 Configuration

### Environment Setup

The platform automatically creates `.env` from `.env.docker` template on first run.

Key configurations:

```bash
# Database (container networking)
DATABASE_URL=postgresql://ocr_user:secure_password@postgres:5432/ocr_platform

# Redis (container networking) 
REDIS_HOST=redis
REDIS_PORT=6379

# Authentication (customize these!)
NEXTAUTH_SECRET=your-super-secure-secret-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Update `.env` with your credentials

### Volume Persistence

Data persists across container restarts:

- `ocr-postgres-data`: Database files
- `ocr-redis-data`: Cache and queue data
- `ocr-uploads-data`: Uploaded files
- `ocr-logs-data`: Application logs

## 🔍 Monitoring & Debugging

### Health Checks

All services include health checks:

```bash
# Check service status
docker compose ps

# View detailed health
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f web
docker compose logs -f worker
docker compose logs -f postgres
docker compose logs -f redis
```

### Redis Monitoring

Start with monitoring to access Redis Commander:

```bash
./docker-start.sh --monitoring
# Access at: http://localhost:8081
# Username: admin, Password: admin123
```

### Database Access

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U ocr_user -d ocr_platform

# Prisma Studio (if needed)
docker compose exec web npx prisma studio
```

## 🛠️ Development Mode

Development mode provides:

- Hot reload for code changes
- Development environment variables
- Additional debugging capabilities

```bash
# Start development mode
./docker-start.sh --dev

# Or with monitoring
./docker-start.sh --dev --monitoring
```

## 🚀 Production Deployment

### Security Checklist

Before production deployment:

1. **Update Secrets**
   ```bash
   # Generate secure secrets
   NEXTAUTH_SECRET=$(openssl rand -base64 32)
   POSTGRES_PASSWORD=$(openssl rand -base64 32)
   ENCRYPTION_SECRET=$(openssl rand -base64 32)
   ```

2. **Configure OAuth**
   - Update redirect URIs for your domain
   - Use production Google OAuth credentials

3. **Environment Variables**
   ```bash
   NEXTAUTH_URL=https://yourdomain.com
   NODE_ENV=production
   ```

### Scaling

Scale worker containers for high load:

```bash
# Scale workers to 3 instances
docker compose up -d --scale worker=3
```

### Reverse Proxy

For production, use nginx or similar:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔧 Troubleshooting

### Common Issues

#### Container Build Failures

```bash
# Clear Docker cache and rebuild
docker system prune -a
./docker-start.sh --build
```

#### Port Conflicts

```bash
# Check what's using ports
lsof -i :3000
lsof -i :5432
lsof -i :6379

# Stop conflicting services or change ports in docker-compose.yml
```

#### Database Connection Issues

```bash
# Reset database
docker compose down -v
./docker-start.sh --build

# Check database logs
docker compose logs postgres
```

#### Worker Processing Issues

```bash
# Check worker logs
docker compose logs worker

# Restart worker only
docker compose restart worker

# Check Python dependencies
docker compose exec worker python3 -c "import fitz; print('PyMuPDF OK')"
```

### Resource Requirements

**Minimum:**
- 4GB RAM
- 5GB disk space
- 2 CPU cores

**Recommended:**
- 8GB RAM
- 20GB disk space
- 4 CPU cores

### Cleanup

```bash
# Stop and remove containers
docker compose down

# Remove containers and volumes (deletes all data!)
docker compose down -v

# Complete cleanup including images
./docker-start.sh --cleanup
```

## 🎯 Access Points

When running, access the platform at:

- **🌐 Web App**: http://localhost:3000
- **📊 Monitoring**: http://localhost:8081 (with `--monitoring`)
- **💾 Database**: localhost:5432
- **🔄 Redis**: localhost:6379

## 📈 Performance Tuning

### Worker Scaling

Adjust worker concurrency in `.env`:

```bash
WORKER_CONCURRENCY=4  # Adjust based on CPU cores
```

### Memory Allocation

Modify docker-compose.yml for resource limits:

```yaml
deploy:
  resources:
    limits:
      memory: 4G
      cpus: "2.0"
```

### Database Optimization

For high-load scenarios, consider:

- Connection pooling
- Read replicas
- Database tuning parameters

---

**🎉 You now have a completely containerized OCR platform that runs anywhere Docker is available!**