@echo off
REM OCR Platform Docker Startup Script for Windows
REM This script starts the entire OCR platform with all required services

title OCR Platform Docker Startup

echo.
echo =====================================================
echo   OCR Platform - Docker Startup Script (Windows)
echo =====================================================
echo.

REM Change to the script directory
cd /d "%~dp0"

echo [INFO] Starting OCR Platform Docker services...
echo [INFO] Working directory: %cd%
echo.

REM Check if Docker is running
echo [STEP 1/6] Checking Docker availability...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not running
    echo [ERROR] Please install Docker Desktop and ensure it's running
    pause
    exit /b 1
)
echo [SUCCESS] Docker is available
echo.

REM Check if docker-compose is available
echo [STEP 2/6] Checking Docker Compose availability...
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Compose is not available
    echo [ERROR] Please ensure Docker Desktop includes Docker Compose
    pause
    exit /b 1
)
echo [SUCCESS] Docker Compose is available
echo.

REM Stop any existing containers
echo [STEP 3/6] Stopping existing containers...
docker-compose down --remove-orphans
echo [SUCCESS] Existing containers stopped
echo.

REM Build the web service with latest changes
echo [STEP 4/6] Building web service...
echo [INFO] This may take a few minutes on first run...
docker-compose build web
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build web service
    echo [ERROR] Check the output above for details
    pause
    exit /b 1
)
echo [SUCCESS] Web service built successfully
echo.

REM Start all services
echo [STEP 5/6] Starting all services...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start services
    echo [ERROR] Check the output above for details
    pause
    exit /b 1
)
echo [SUCCESS] All services started
echo.

REM Wait for services to be ready
echo [STEP 6/6] Waiting for services to be ready...
timeout /t 10 /nobreak >nul
echo [INFO] Services should be initializing...
echo.

REM Check service status
echo =====================================================
echo   Service Status Check
echo =====================================================
docker-compose ps
echo.

REM Health check
echo [INFO] Performing health check...
timeout /t 5 /nobreak >nul

REM Try to reach the web application
echo [INFO] Testing web application availability...
curl -s http://localhost:3333/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Web application is responding
) else (
    echo [WARNING] Web application may still be starting up
    echo [INFO] This is normal - services may take 30-60 seconds to fully initialize
)
echo.

REM Display final status
echo =====================================================
echo   OCR Platform Started Successfully!
echo =====================================================
echo.
echo Services running:
echo   - Web Application:  http://localhost:3333
echo   - API Health:       http://localhost:3333/api/health  
echo   - Database:         PostgreSQL on localhost:5432
echo   - Queue System:     Redis on localhost:6379
echo   - Worker Process:   Processing OCR jobs
echo.
echo Commands:
echo   - View logs:        docker-compose logs -f
echo   - Stop services:    docker-compose down
echo   - Restart:          docker-compose restart
echo   - Rebuild:          docker-compose build
echo.
echo [INFO] If services are still starting up, wait 1-2 minutes
echo [INFO] Check logs with: docker-compose logs -f web
echo.

REM Keep window open
echo Press any key to open the web application...
pause >nul
start http://localhost:3333

REM Option to view logs
echo.
choice /c YN /m "Do you want to view live logs"
if %errorlevel% equ 1 (
    echo [INFO] Starting live logs... Press Ctrl+C to exit logs
    docker-compose logs -f
)

echo.
echo Script completed. OCR Platform is running!
pause