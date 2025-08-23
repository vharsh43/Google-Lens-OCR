# OCR Platform Docker Startup Script for Windows PowerShell
# This script starts the entire OCR platform with all required services

param(
    [switch]$SkipBuild,
    [switch]$ViewLogs,
    [switch]$Quiet,
    [switch]$UseWindowsConfig,
    [switch]$OfflineMode
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
    # Determine which Docker configuration to use
    $composeFile = "docker-compose.yml"
    if ($UseWindowsConfig) {
        $composeFile = "docker-compose.windows.yml"
        Write-Info "Using Windows-optimized configuration"
    }

    # Check Docker availability
    Write-Step "1/7" "Checking Docker availability..."
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker is not installed or not running"
        Write-Error "Please install Docker Desktop and ensure it's running"
        exit 1
    }
    Write-Success "Docker is available: $dockerVersion"
    Write-Host ""

    # Check Docker Compose availability
    Write-Step "2/7" "Checking Docker Compose availability..."
    $composeVersion = docker-compose --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker Compose is not available"
        Write-Error "Please ensure Docker Desktop includes Docker Compose"
        exit 1
    }
    Write-Success "Docker Compose is available: $composeVersion"
    Write-Host ""

    # Network connectivity test (unless offline mode)
    if (-not $OfflineMode) {
        Write-Step "3/7" "Testing network connectivity..."
        try {
            $testUrls = @(
                "https://registry.npmjs.org",
                "https://pypi.org",
                "https://files.pythonhosted.org"
            )
            
            foreach ($url in $testUrls) {
                try {
                    $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
                    Write-Info "✅ Can reach $url"
                } catch {
                    Write-Warning "⚠️ Cannot reach $url - this may cause build issues"
                }
            }
        } catch {
            Write-Warning "Network connectivity test failed - continuing anyway"
        }
        Write-Host ""
    } else {
        Write-Step "3/7" "Skipping network test (offline mode)"
        Write-Host ""
    }

    # Stop existing containers
    Write-Step "4/7" "Stopping existing containers..."
    docker-compose -f $composeFile down --remove-orphans | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Existing containers stopped"
    } else {
        Write-Warning "No existing containers to stop"
    }
    Write-Host ""

    # Build web service (unless skipped)
    if (-not $SkipBuild) {
        Write-Step "5/7" "Building web service..."
        Write-Info "This may take a few minutes on first run..."
        if ($UseWindowsConfig) {
            Write-Info "Using Windows-optimized Dockerfile with network retry logic..."
        }
        
        $buildOutput = docker-compose -f $composeFile build web 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to build web service"
            Write-Warning "This is often due to network connectivity issues."
            Write-Info "Try running with: .\start-docker-windows.ps1 -UseWindowsConfig"
            Write-Info "Or check your internet connection and firewall settings."
            Write-Host $buildOutput -ForegroundColor Red
            
            # Suggest solutions
            Write-Host ""
            Write-Host "Possible solutions:" -ForegroundColor Yellow
            Write-Host "1. Check internet connection" -ForegroundColor White
            Write-Host "2. Try: .\start-docker-windows.ps1 -UseWindowsConfig" -ForegroundColor White
            Write-Host "3. Check corporate firewall/proxy settings" -ForegroundColor White
            Write-Host "4. Restart Docker Desktop" -ForegroundColor White
            exit 1
        }
        Write-Success "Web service built successfully"
    } else {
        Write-Step "5/7" "Skipping build (--SkipBuild flag used)"
    }
    Write-Host ""

    # Start all services
    Write-Step "6/7" "Starting all services..."
    $startOutput = docker-compose -f $composeFile up -d 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start services"
        Write-Host $startOutput -ForegroundColor Red
        exit 1
    }
    Write-Success "All services started"
    Write-Host ""

    # Wait for services to initialize
    Write-Step "7/7" "Waiting for services to initialize..."
    Start-Sleep -Seconds 10
    Write-Info "Services should be initializing..."
    Write-Host ""

    # Service Status Check
    Write-Host "=====================================================" -ForegroundColor Blue
    Write-Host "   Service Status Check" -ForegroundColor Blue
    Write-Host "=====================================================" -ForegroundColor Blue
    docker-compose -f $composeFile ps
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
            docker-compose -f $composeFile logs -f
        }
    }

    # Auto-view logs if flag is set
    if ($ViewLogs) {
        Write-Info "Starting live logs... Press Ctrl+C to exit logs"
        docker-compose -f $composeFile logs -f
    }

    Write-Host ""
    Write-Success "Script completed. OCR Platform is running!"

} catch {
    Write-Error "An unexpected error occurred: $($_.Exception.Message)"
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}