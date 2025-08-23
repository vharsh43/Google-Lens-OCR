# OCR Platform - Windows Setup Guide

This guide helps you set up and run the OCR Platform on Windows using Docker.

## Prerequisites

1. **Install Docker Desktop for Windows**
   - Download from: https://docs.docker.com/desktop/install/windows-install/
   - Ensure Docker Desktop is running before proceeding
   - Verify installation: Open Command Prompt and run `docker --version`

2. **Ensure Windows Features**
   - Windows 10/11 with WSL2 enabled (Docker Desktop will help with this)
   - PowerShell 5.1 or higher (usually pre-installed)

## Quick Start (Recommended)

### Option 1: Network Issues Fix (If having connectivity problems)
```powershell
# If you're getting network/DNS errors during build
.\start-docker-network-fix.ps1
```

**This script automatically:**
- ✅ Diagnoses network connectivity issues
- ✅ Configures Docker DNS settings
- ✅ Sets up npm and pip with retry logic
- ✅ Uses Windows-optimized build configuration
- ✅ Provides detailed troubleshooting information

### Option 2: PowerShell Script (Most Features)
```powershell
# Run in PowerShell (Right-click "Run as Administrator" recommended)
.\start-docker-windows.ps1
```

**PowerShell Script Features:**
- ✅ Comprehensive error checking and health validation
- ✅ Colored output for better readability
- ✅ Interactive options for browser opening and log viewing
- ✅ Automatic service health verification
- ✅ Support for command-line flags

**PowerShell Script Options:**
```powershell
# Skip building (faster if no changes)
.\start-docker-windows.ps1 -SkipBuild

# Use Windows-optimized configuration
.\start-docker-windows.ps1 -UseWindowsConfig

# Auto-view logs after startup
.\start-docker-windows.ps1 -ViewLogs

# Quiet mode (minimal output)
.\start-docker-windows.ps1 -Quiet

# Combined options for network issues
.\start-docker-windows.ps1 -UseWindowsConfig -ViewLogs
```

### Option 2: Batch Script (Traditional)
```cmd
# Double-click or run in Command Prompt
start-docker-windows.bat
```

### Option 3: Super Quick (One-liner)
```cmd
# For experienced users - minimal output
start-quick-windows.bat
```

## Manual Commands

If you prefer manual control:

```cmd
# Stop any existing containers
docker-compose down --remove-orphans

# Build the web service
docker-compose build web

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

## Service URLs

Once started, access these services:

- **🌐 Web Application**: http://localhost:3333
- **💚 Health Check**: http://localhost:3333/api/health
- **🗄️ Database**: PostgreSQL on localhost:5432
- **🔄 Queue System**: Redis on localhost:6379

## Troubleshooting

### Network Issues (Most Common)

1. **"Name does not resolve" or "Max retries exceeded"**
   ```powershell
   # Use the network fix script (recommended)
   .\start-docker-network-fix.ps1
   
   # OR try Windows-optimized config
   .\start-docker-windows.ps1 -UseWindowsConfig
   ```

2. **Corporate Network/Firewall Issues**
   ```
   Solutions:
   1. Contact IT about Docker Hub and PyPI access
   2. Configure proxy settings in Docker Desktop
   3. Try different network (mobile hotspot)
   4. Use VPN if company allows
   ```

3. **DNS Resolution Problems**
   ```powershell
   # Test DNS resolution
   nslookup registry.npmjs.org
   nslookup pypi.org
   
   # If DNS fails, update Docker daemon.json manually:
   # Add "dns": ["8.8.8.8", "8.8.4.4"] to daemon.json
   ```

### Docker Issues

1. **"Docker is not running"**
   ```
   Solution: Start Docker Desktop from Start Menu
   ```

2. **"Port already in use"**
   ```cmd
   # Find what's using port 3333
   netstat -ano | findstr 3333
   
   # Kill the process (replace PID)
   taskkill /PID <PID> /F
   ```

3. **"Cannot connect to Docker daemon"**
   ```
   Solution: 
   1. Restart Docker Desktop
   2. Check if Hyper-V/WSL2 is properly configured
   3. Run PowerShell/Command Prompt as Administrator
   ```

### Build Issues

1. **"Build failed" or Python issues**
   ```cmd
   # Clean rebuild
   docker-compose down --volumes --remove-orphans
   docker system prune -a
   docker-compose build --no-cache web
   docker-compose up -d
   ```

2. **"Out of disk space"**
   ```cmd
   # Clean Docker images and containers
   docker system prune -a --volumes
   ```

### Application Issues

1. **Web app not responding**
   ```cmd
   # Check if services are running
   docker-compose ps
   
   # View logs for errors
   docker-compose logs web
   docker-compose logs worker
   ```

2. **Database connection issues**
   ```cmd
   # Restart database service
   docker-compose restart postgres
   
   # Check database logs
   docker-compose logs postgres
   ```

## Performance Tips

### For Better Performance:
1. **Allocate more resources to Docker Desktop**:
   - Open Docker Desktop → Settings → Resources
   - Increase Memory to 4GB+ 
   - Increase CPUs to 2+

2. **Use SSD storage** for Docker containers when possible

3. **Close unnecessary applications** during initial build

### For Development:
```powershell
# Skip build if no changes made
.\start-docker-windows.ps1 -SkipBuild

# Use quiet mode for faster startup
.\start-docker-windows.ps1 -Quiet
```

## Stopping the Platform

```cmd
# Stop all services
docker-compose down

# Stop and remove volumes (full cleanup)
docker-compose down --volumes --remove-orphans
```

## Development Mode

For development with hot reloading:

```cmd
# Start in development mode (auto-rebuilds)
docker-compose -f docker-compose.dev.yml up -d

# View development logs
docker-compose -f docker-compose.dev.yml logs -f web
```

## File Locations

- **Configuration**: `docker-compose.yml`
- **Environment**: `web-platform/.env.local`
- **Logs**: Docker containers (view with `docker-compose logs`)
- **Data**: Docker volumes (persistent)

## Support

If you encounter issues:

1. **Check logs**: `docker-compose logs -f`
2. **Restart services**: `docker-compose restart`
3. **Full reset**: `docker-compose down --volumes && docker-compose up -d`
4. **Clean rebuild**: `docker system prune -a` then rebuild

## Windows-Specific Notes

- **File Paths**: Uses Windows-style paths in batch files, Unix-style in containers
- **Line Endings**: Docker handles CRLF/LF conversion automatically
- **Performance**: WSL2 provides better performance than Hyper-V
- **Firewall**: Windows Defender may prompt for Docker network access - allow it
- **Antivirus**: Some antivirus software may slow down Docker builds

---

**Need Help?** 
- Check the main project documentation
- View logs: `docker-compose logs -f`
- Restart everything: `docker-compose restart`