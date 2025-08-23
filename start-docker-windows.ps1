# OCR Platform Docker Startup Script for Windows PowerShell
# This script starts the entire OCR platform with all required services

param(
    [switch]$SkipBuild,
    [switch]$ViewLogs,
    [switch]$Quiet
)

# Set console title
$Host.UI.RawUI.WindowTitle = "OCR Platform Docker Startup"

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success($message) { Write-ColorOutput Green "[SUCCESS] $message" }
function Write-Info($message) { Write-ColorOutput Cyan "[INFO] $message" }
function Write-Warning($message) { Write-ColorOutput Yellow "[WARNING] $message" }
function Write-Error($message) { Write-ColorOutput Red "[ERROR] $message" }
function Write-Step($step, $message) { Write-ColorOutput Magenta "[STEP $step] $message" }

# Header
if (-not $Quiet) {
    Write-Host ""
    Write-Host "=====================================================" -ForegroundColor Blue
    Write-Host "   OCR Platform - Docker Startup Script (PowerShell)" -ForegroundColor Blue  
    Write-Host "=====================================================" -ForegroundColor Blue
    Write-Host ""
}

# Change to script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath
Write-Info "Working directory: $(Get-Location)"
Write-Host ""

try {
    # Check Docker availability
    Write-Step "1/6" "Checking Docker availability..."
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker is not installed or not running"
        Write-Error "Please install Docker Desktop and ensure it's running"
        exit 1
    }
    Write-Success "Docker is available: $dockerVersion"
    Write-Host ""

    # Check Docker Compose availability
    Write-Step "2/6" "Checking Docker Compose availability..."
    $composeVersion = docker-compose --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker Compose is not available"
        Write-Error "Please ensure Docker Desktop includes Docker Compose"
        exit 1
    }
    Write-Success "Docker Compose is available: $composeVersion"
    Write-Host ""

    # Stop existing containers
    Write-Step "3/6" "Stopping existing containers..."
    docker-compose down --remove-orphans | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Existing containers stopped"
    } else {
        Write-Warning "No existing containers to stop"
    }
    Write-Host ""

    # Build web service (unless skipped)
    if (-not $SkipBuild) {
        Write-Step "4/6" "Building web service..."
        Write-Info "This may take a few minutes on first run..."
        
        $buildOutput = docker-compose build web 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to build web service"
            Write-Host $buildOutput -ForegroundColor Red
            exit 1
        }
        Write-Success "Web service built successfully"
    } else {
        Write-Step "4/6" "Skipping build (--SkipBuild flag used)"
    }
    Write-Host ""

    # Start all services
    Write-Step "5/6" "Starting all services..."
    $startOutput = docker-compose up -d 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start services"
        Write-Host $startOutput -ForegroundColor Red
        exit 1
    }
    Write-Success "All services started"
    Write-Host ""

    # Wait for services to initialize
    Write-Step "6/6" "Waiting for services to initialize..."
    Start-Sleep -Seconds 10
    Write-Info "Services should be initializing..."
    Write-Host ""

    # Service Status Check
    Write-Host "=====================================================" -ForegroundColor Blue
    Write-Host "   Service Status Check" -ForegroundColor Blue
    Write-Host "=====================================================" -ForegroundColor Blue
    docker-compose ps
    Write-Host ""

    # Health check
    Write-Info "Performing health check..."
    Start-Sleep -Seconds 5

    # Test web application
    Write-Info "Testing web application availability..."
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3333/api/health" -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Success "Web application is responding"
        } else {
            Write-Warning "Web application returned status: $($response.StatusCode)"
        }
    } catch {
        Write-Warning "Web application may still be starting up"
        Write-Info "This is normal - services may take 30-60 seconds to fully initialize"
    }
    Write-Host ""

    # Final status
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host "   OCR Platform Started Successfully!" -ForegroundColor Green
    Write-Host "=====================================================" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Services running:" -ForegroundColor White
    Write-Host "  - Web Application:  http://localhost:3333" -ForegroundColor Cyan
    Write-Host "  - API Health:       http://localhost:3333/api/health" -ForegroundColor Cyan
    Write-Host "  - Database:         PostgreSQL on localhost:5432" -ForegroundColor Cyan
    Write-Host "  - Queue System:     Redis on localhost:6379" -ForegroundColor Cyan
    Write-Host "  - Worker Process:   Processing OCR jobs" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Useful commands:" -ForegroundColor White
    Write-Host "  - View logs:        docker-compose logs -f" -ForegroundColor Gray
    Write-Host "  - Stop services:    docker-compose down" -ForegroundColor Gray
    Write-Host "  - Restart:          docker-compose restart" -ForegroundColor Gray
    Write-Host "  - Rebuild:          docker-compose build" -ForegroundColor Gray
    Write-Host ""

    if (-not $Quiet) {
        Write-Info "If services are still starting up, wait 1-2 minutes"
        Write-Info "Check logs with: docker-compose logs -f web"
        Write-Host ""
    }

    # Interactive options (only if not quiet)
    if (-not $Quiet -and -not $ViewLogs) {
        $openBrowser = Read-Host "Do you want to open the web application in your browser? (y/n)"
        if ($openBrowser -eq "y" -or $openBrowser -eq "Y") {
            Start-Process "http://localhost:3333"
        }

        $showLogs = Read-Host "Do you want to view live logs? (y/n)"
        if ($showLogs -eq "y" -or $showLogs -eq "Y") {
            Write-Info "Starting live logs... Press Ctrl+C to exit logs"
            docker-compose logs -f
        }
    }

    # Auto-view logs if flag is set
    if ($ViewLogs) {
        Write-Info "Starting live logs... Press Ctrl+C to exit logs"
        docker-compose logs -f
    }

    Write-Host ""
    Write-Success "Script completed. OCR Platform is running!"

} catch {
    Write-Error "An unexpected error occurred: $($_.Exception.Message)"
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}