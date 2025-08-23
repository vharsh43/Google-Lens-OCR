# OCR Platform - Network Issues Fix Script for Windows
# This script helps resolve common network connectivity issues during Docker build

param(
    [switch]$ViewLogs,
    [switch]$Quiet
)

# Set console title
$Host.UI.RawUI.WindowTitle = "OCR Platform - Network Fix"

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
    Write-Host "   OCR Platform - Network Issues Fix (Windows)" -ForegroundColor Blue  
    Write-Host "=====================================================" -ForegroundColor Blue
    Write-Host ""
    Write-Info "This script helps resolve network connectivity issues during Docker builds"
    Write-Host ""
}

# Change to script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

try {
    Write-Step "1/8" "Diagnosing network connectivity..."
    
    # Test basic connectivity
    $testSites = @{
        "Google DNS" = "8.8.8.8"
        "Registry NPM" = "registry.npmjs.org"
        "PyPI" = "pypi.org"
        "Python Files" = "files.pythonhosted.org"
        "Docker Hub" = "registry-1.docker.io"
    }
    
    foreach ($site in $testSites.GetEnumerator()) {
        try {
            if ($site.Value -match '^\d+\.\d+\.\d+\.\d+$') {
                # IP address - use ping
                $result = Test-Connection -ComputerName $site.Value -Count 1 -Quiet -ErrorAction SilentlyContinue
                if ($result) {
                    Write-Success "✅ $($site.Key): $($site.Value) - OK"
                } else {
                    Write-Warning "⚠️ $($site.Key): $($site.Value) - No response"
                }
            } else {
                # Domain name - use web request
                $response = Invoke-WebRequest -Uri "https://$($site.Value)" -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
                Write-Success "✅ $($site.Key): $($site.Value) - OK (Status: $($response.StatusCode))"
            }
        } catch {
            Write-Warning "⚠️ $($site.Key): $($site.Value) - Failed ($($_.Exception.Message))"
        }
    }
    Write-Host ""

    Write-Step "2/8" "Checking Docker network settings..."
    
    # Get Docker info
    $dockerInfo = docker info 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker is running"
        
        # Check if we can pull a simple image
        Write-Info "Testing Docker Hub connectivity..."
        try {
            docker pull hello-world:latest 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "✅ Docker Hub connectivity: OK"
            } else {
                Write-Warning "⚠️ Docker Hub connectivity: Failed"
            }
        } catch {
            Write-Warning "⚠️ Docker Hub connectivity: Failed"
        }
    } else {
        Write-Error "Docker is not running. Please start Docker Desktop."
        exit 1
    }
    Write-Host ""

    Write-Step "3/8" "Configuring Docker network settings..."
    
    # Create or update daemon.json with network settings
    $dockerDataPath = "$env:USERPROFILE\.docker\daemon.json"
    $dockerSettings = @{
        "dns" = @("8.8.8.8", "8.8.4.4")
        "registry-mirrors" = @()
        "insecure-registries" = @()
        "experimental" = $false
        "default-address-pools" = @(
            @{
                "base" = "172.17.0.0/12"
                "size" = 20
            }
        )
    }
    
    try {
        $dockerSettings | ConvertTo-Json -Depth 3 | Set-Content -Path $dockerDataPath
        Write-Success "Updated Docker daemon settings with DNS configuration"
        Write-Warning "You may need to restart Docker Desktop for changes to take effect"
    } catch {
        Write-Warning "Could not update Docker daemon.json - you may need to do this manually"
    }
    Write-Host ""

    Write-Step "4/8" "Setting up npm configuration for network issues..."
    
    # Configure npm settings for better network handling
    $npmCommands = @(
        "npm config set registry https://registry.npmjs.org/",
        "npm config set fetch-timeout 300000",
        "npm config set fetch-retry-mintimeout 20000",
        "npm config set fetch-retry-maxtimeout 120000",
        "npm config set fetch-retries 5"
    )
    
    foreach ($cmd in $npmCommands) {
        try {
            Invoke-Expression $cmd
            Write-Success "✅ $cmd"
        } catch {
            Write-Warning "⚠️ Failed: $cmd"
        }
    }
    Write-Host ""

    Write-Step "5/8" "Cleaning Docker cache..."
    
    # Clean Docker system
    Write-Info "Pruning Docker system to free up space and clear cache..."
    docker system prune -f 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Docker system cleaned"
    } else {
        Write-Warning "Could not clean Docker system"
    }
    Write-Host ""

    Write-Step "6/8" "Testing Windows-specific configuration..."
    
    # Check if Windows Docker compose file exists
    if (Test-Path "docker-compose.windows.yml") {
        Write-Success "Windows-specific Docker compose file found"
        
        # Test build with Windows config
        Write-Info "Testing build with Windows configuration..."
        $testBuild = docker-compose -f docker-compose.windows.yml config 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Windows Docker configuration is valid"
        } else {
            Write-Warning "Windows Docker configuration has issues"
            Write-Host $testBuild -ForegroundColor Yellow
        }
    } else {
        Write-Warning "Windows-specific Docker compose file not found"
        Write-Info "This is normal - using default configuration"
    }
    Write-Host ""

    Write-Step "7/8" "Creating network-optimized environment..."
    
    # Create network-specific environment variables
    $networkEnv = @"
# Network optimization for Windows Docker builds
npm_config_registry=https://registry.npmjs.org/
npm_config_fetch_timeout=300000
npm_config_fetch_retry_mintimeout=20000
npm_config_fetch_retry_maxtimeout=120000
npm_config_fetch_retries=5

# Python package settings
PIP_INDEX_URL=https://pypi.org/simple/
PIP_TRUSTED_HOST=pypi.org,pypi.python.org,files.pythonhosted.org
PIP_TIMEOUT=300
PIP_RETRIES=5

# Docker build settings
DOCKER_BUILDKIT=1
COMPOSE_DOCKER_CLI_BUILD=1
"@

    $envFile = ".\.env.network"
    $networkEnv | Set-Content -Path $envFile
    Write-Success "Created network optimization environment file: $envFile"
    Write-Info "You can source this file before running Docker commands"
    Write-Host ""

    Write-Step "8/8" "Starting OCR Platform with network optimizations..."
    
    # Choose the best configuration
    $composeFile = "docker-compose.yml"
    if (Test-Path "docker-compose.windows.yml") {
        $composeFile = "docker-compose.windows.yml"
        Write-Info "Using Windows-optimized configuration"
    }

    # Stop existing containers
    Write-Info "Stopping existing containers..."
    docker-compose -f $composeFile down --remove-orphans 2>$null | Out-Null

    # Try to build with network optimizations
    Write-Info "Building with network optimizations..."
    $env:npm_config_registry = "https://registry.npmjs.org/"
    $env:PIP_INDEX_URL = "https://pypi.org/simple/"
    $env:PIP_TRUSTED_HOST = "pypi.org,pypi.python.org,files.pythonhosted.org"
    
    $buildResult = docker-compose -f $composeFile build web 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✅ Build successful with network optimizations!"
        
        # Start services
        Write-Info "Starting all services..."
        docker-compose -f $composeFile up -d
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✅ All services started successfully!"
            
            # Final status
            Write-Host ""
            Write-Host "=====================================================" -ForegroundColor Green
            Write-Host "   Network Issues Fixed - Platform Running!" -ForegroundColor Green
            Write-Host "=====================================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Services:" -ForegroundColor White
            Write-Host "  - Web Application: http://localhost:3333" -ForegroundColor Cyan
            Write-Host "  - Health Check:    http://localhost:3333/api/health" -ForegroundColor Cyan
            Write-Host ""
            
            # Check service status
            docker-compose -f $composeFile ps
        } else {
            Write-Error "Failed to start services despite successful build"
        }
    } else {
        Write-Error "Build failed even with network optimizations"
        Write-Host ""
        Write-Host "Build output:" -ForegroundColor Red
        Write-Host $buildResult -ForegroundColor Red
        
        Write-Host ""
        Write-Host "Additional troubleshooting steps:" -ForegroundColor Yellow
        Write-Host "1. Restart Docker Desktop" -ForegroundColor White
        Write-Host "2. Check corporate firewall/proxy settings" -ForegroundColor White
        Write-Host "3. Try using a VPN or different network" -ForegroundColor White
        Write-Host "4. Contact your IT department about Docker Hub access" -ForegroundColor White
        exit 1
    }

    # Auto-view logs if requested
    if ($ViewLogs -and $LASTEXITCODE -eq 0) {
        Write-Info "Starting live logs... Press Ctrl+C to exit"
        docker-compose -f $composeFile logs -f
    }

} catch {
    Write-Error "An unexpected error occurred: $($_.Exception.Message)"
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}