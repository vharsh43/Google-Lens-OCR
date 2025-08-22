# 🚀 OCR Platform - Quick Start

**One-command deployment for the complete OCR web platform!**

## Instant Setup

Run this single command to start everything:

```bash
./start-docker.sh
```

## What You Get

✅ **Complete OCR Platform** running on your machine  
✅ **No authentication required** - direct access  
✅ **All services containerized** - no local dependencies  
✅ **Real-time processing** with queue management  
✅ **Multi-language OCR** with Google Lens technology  

## Access Your Platform

After the script completes:

- **🌐 OCR Platform**: http://localhost:3000
- **📊 Queue Monitor**: http://localhost:8081 (admin/admin123)

## Usage Flow

1. **Start the platform**: `./start-docker.sh`
2. **Open your browser**: Go to http://localhost:3000
3. **Upload PDFs**: Drag & drop your files
4. **Monitor progress**: Real-time processing updates
5. **Download results**: Get your OCR text files

## Quick Commands

```bash
# Start everything
./start-docker.sh

# Start with queue monitoring
./start-docker.sh --with-monitoring

# Quick restart (skip rebuild)
./start-docker.sh --skip-build

# Stop all services
docker-compose down

# View logs
docker-compose logs -f
```

## Features

- 📄 **PDF to Text**: High-accuracy OCR conversion
- 🌍 **Multi-language**: Hindi, Gujarati, English, and more
- ⚡ **High DPI**: 300 DPI processing for quality
- 📊 **Real-time**: Live progress tracking
- 🔄 **Queue Management**: Background processing
- 💾 **Persistent Storage**: Jobs saved in database

## System Requirements

- Docker Desktop installed and running
- 4GB+ RAM recommended
- 2GB+ disk space for images

---

**That's it!** Your OCR platform is ready to process documents.