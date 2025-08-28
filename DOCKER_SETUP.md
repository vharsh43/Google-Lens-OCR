# 🐳 Docker Setup Guide - Google Lens OCR Pipeline

This guide will help you run the complete Google Lens OCR Pipeline using Docker on any operating system (macOS, Windows, Linux).

## ✅ Prerequisites

The only requirement is **Docker Desktop** installed on your system:

- **Windows**: Download from [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
- **macOS**: Download from [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
- **Linux**: Install Docker Engine and Docker Compose

## 🚀 Quick Start

### 1. Clone or Download the Project
```bash
git clone <your-repo-url>
cd Google-Lens-OCR
```

### 2. Build and Start Everything
```bash
# Build and start all services
docker-compose up --build

# Or run in background (detached mode)
docker-compose up --build -d
```

### 3. Access the Application
- **Dashboard**: http://localhost:3333
- **API**: http://localhost:3003/api
- **Health Check**: http://localhost:3003/api/health

## 🔧 Available Commands

### Start Services
```bash
# Start with build (recommended for first run)
docker-compose up --build

# Start without rebuilding
docker-compose up

# Start in background
docker-compose up -d
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clears all data)
docker-compose down -v
```

### View Logs
```bash
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View logs for specific service
docker-compose logs google-lens-ocr
```

### Rebuild After Code Changes
```bash
# Rebuild and restart
docker-compose up --build

# Force rebuild (no cache)
docker-compose build --no-cache
docker-compose up
```

## 📁 Data Persistence

Your processing directories are automatically mounted and persist between container restarts:

- `1_New_File_Process_PDF_2_PNG/` - Input PDF files
- `2_Converted_PNGs/` - Converted PNG images
- `3_OCR_TXT_Files/` - OCR text output
- `logs/` - Application logs
- `server/uploads/` - Uploaded files

## 🎯 What's Included

The Docker setup automatically installs and configures:

### Python Environment
- ✅ Python 3.11
- ✅ PyMuPDF (PDF processing)
- ✅ tqdm (progress bars)
- ✅ Pillow (image processing)

### Node.js Environment  
- ✅ Node.js 18
- ✅ All npm dependencies
- ✅ Chrome/Chromium for OCR
- ✅ Built React dashboard

### System Dependencies
- ✅ Chrome browser (for Google Lens OCR)
- ✅ Image processing libraries
- ✅ Font packages
- ✅ SSL certificates

## 🔍 Troubleshooting

### Port Conflicts
If ports 3003 or 3333 are in use:
1. Stop other applications using these ports
2. Or modify `docker-compose.yml` to use different ports:
```yaml
ports:
  - "3004:3003"  # Use port 3004 instead of 3003
  - "3334:3333"  # Use port 3334 instead of 3333
```

### Memory Issues
If you experience memory issues:
1. Increase Docker memory limit in Docker Desktop settings
2. Recommended: 4GB+ RAM for smooth operation

### Permission Issues (Linux)
```bash
# Fix file permissions
sudo chown -R $USER:$USER ./1_New_File_Process_PDF_2_PNG
sudo chown -R $USER:$USER ./2_Converted_PNGs  
sudo chown -R $USER:$USER ./3_OCR_TXT_Files
sudo chown -R $USER:$USER ./logs
```

### Container Won't Start
```bash
# Check logs for errors
docker-compose logs

# Rebuild without cache
docker-compose build --no-cache
docker-compose up
```

### Dashboard Not Loading
1. Wait 30-60 seconds for full startup
2. Check health endpoint: http://localhost:3003/api/health
3. View logs: `docker-compose logs`

## 🔧 Development Mode

For development with live reloading:
```bash
# Stop Docker services first
docker-compose down

# Use npm for development
npm run dashboard:dev
```

## 🧪 Testing the Setup

1. **Start the services**:
   ```bash
   docker-compose up --build
   ```

2. **Verify health**:
   ```bash
   curl http://localhost:3003/api/health
   ```

3. **Open dashboard**: http://localhost:3333

4. **Upload a PDF** through the dashboard to test the complete pipeline

## 📊 Monitoring

### Check Service Status
```bash
# View running containers
docker-compose ps

# Check resource usage
docker stats
```

### Access Container Shell
```bash
# Access the main container
docker-compose exec google-lens-ocr bash

# View Python packages
docker-compose exec google-lens-ocr pip list

# View Node packages
docker-compose exec google-lens-ocr npm list
```

## 🚫 Stopping Everything

```bash
# Stop services but keep data
docker-compose down

# Stop services and remove all data
docker-compose down -v

# Remove Docker images (frees disk space)
docker rmi $(docker images google-lens-ocr* -q)
```

## 💡 Tips

- **First run** takes 5-10 minutes to build everything
- **Subsequent starts** are much faster (1-2 minutes)
- **Data persists** between container restarts
- **Cross-platform**: Same commands work on Windows, macOS, and Linux
- **Isolated**: No conflicts with your local Python/Node installations

## 🆘 Getting Help

If you encounter issues:

1. **Check the logs**: `docker-compose logs -f`
2. **Verify health**: http://localhost:3003/api/health
3. **Try rebuilding**: `docker-compose build --no-cache`
4. **Check Docker Desktop** is running and has sufficient resources

---

🎉 **You're all set!** The Google Lens OCR Pipeline should now be running smoothly in Docker across any operating system.