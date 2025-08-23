#!/bin/bash

# Google Lens OCR Platform - Docker Startup Script
# One command to start the entire application with all services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[OCR Platform]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    print_status "Checking Docker availability..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker Desktop."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    print_status "Docker is available and running ✓"
}

# Function to clean up existing containers
cleanup_containers() {
    print_status "Cleaning up existing containers..."
    docker compose down --remove-orphans 2>/dev/null || true
    docker compose -f web-platform/docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
    print_status "Cleanup complete ✓"
}

# Function to create necessary directories
setup_directories() {
    print_status "Setting up directories..."
    mkdir -p logs
    mkdir -p uploads
    mkdir -p processed
    mkdir -p web-platform/uploads
    mkdir -p web-platform/logs
    mkdir -p web-platform/processed
    print_status "Directories created ✓"
}

# Function to copy environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f "web-platform/.env.local" ]; then
        if [ -f ".env.docker" ]; then
            cp .env.docker web-platform/.env.local
            print_status "Environment file copied from .env.docker ✓"
        elif [ -f "web-platform/.env.example" ]; then
            cp web-platform/.env.example web-platform/.env.local
            print_warning "Using .env.example as base - you may need to update database settings"
        else
            print_error "No environment file found. Please create .env.local in web-platform directory"
            exit 1
        fi
    else
        print_status "Environment file already exists ✓"
    fi
}

# Function to build and start services
start_services() {
    print_status "Starting OCR Platform services..."
    print_info "This may take a few minutes on first run while Docker builds images..."
    
    # Start core services first
    print_status "Starting database and Redis..."
    docker compose up -d postgres redis
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 10
    
    # Check database health
    max_attempts=30
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if docker compose exec postgres pg_isready -U ocr_user -d ocr_platform &> /dev/null; then
            print_status "Database is ready ✓"
            break
        fi
        print_info "Waiting for database... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_error "Database failed to start within timeout"
        docker compose logs postgres
        exit 1
    fi
    
    # Start web application and worker
    print_status "Starting web application and worker..."
    docker compose up -d web worker
    
    print_status "All services started successfully! ✓"
}

# Function to show service status and URLs
show_status() {
    echo
    print_status "=== OCR Platform Status ==="
    docker compose ps
    
    echo
    print_status "=== Service URLs ==="
    print_info "🌐 Web Application: http://localhost:3333"
    print_info "🗄️  Database Admin: http://localhost:8080 (admin@ocr-platform.local / admin123)"
    print_info "🔧 Redis Commander: http://localhost:8081 (admin / admin123)"
    
    echo
    print_status "=== Useful Commands ==="
    print_info "View logs:           docker compose logs -f"
    print_info "Stop services:       docker compose down"
    print_info "Restart services:    docker compose restart"
    print_info "Monitor services:    docker compose --profile monitoring up -d"
    print_info "Health check:        docker compose --profile healthcheck up"
    
    echo
}

# Function to monitor logs
monitor_logs() {
    print_status "Monitoring application logs (Ctrl+C to exit)..."
    docker compose logs -f web worker
}

# Parse command line arguments
MONITORING=false
LOGS=false
CLEANUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --monitoring|-m)
            MONITORING=true
            shift
            ;;
        --logs|-l)
            LOGS=true
            shift
            ;;
        --cleanup|-c)
            CLEANUP=true
            shift
            ;;
        --help|-h)
            echo "Google Lens OCR Platform - Docker Startup Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --monitoring, -m    Start with monitoring services (PgAdmin, Redis Commander)"
            echo "  --logs, -l         Show logs after startup"
            echo "  --cleanup, -c      Clean up containers before starting"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                 # Start basic services"
            echo "  $0 -m              # Start with monitoring"
            echo "  $0 -m -l           # Start with monitoring and show logs"
            echo "  $0 -c -m           # Cleanup, then start with monitoring"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            print_info "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo
    print_status "🚀 Starting Google Lens OCR Platform"
    echo
    
    # Perform pre-flight checks
    check_docker
    
    # Clean up if requested
    if [ "$CLEANUP" = true ]; then
        cleanup_containers
    fi
    
    # Setup environment
    setup_directories
    setup_environment
    
    # Start services
    start_services
    
    # Start monitoring services if requested
    if [ "$MONITORING" = true ]; then
        print_status "Starting monitoring services..."
        docker compose --profile monitoring up -d pgadmin redis-commander
    fi
    
    # Show status
    show_status
    
    # Monitor logs if requested
    if [ "$LOGS" = true ]; then
        sleep 3
        monitor_logs
    fi
}

# Trap Ctrl+C
trap 'echo -e "\n${YELLOW}Shutting down...${NC}"; docker compose down; exit 0' INT

# Run main function
main "$@"