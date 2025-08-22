#!/bin/bash

# OCR Platform - Docker Deployment Script
# Complete one-click deployment for the OCR web platform
# This script handles everything from environment setup to running services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo "=================================================="
    echo "  🚀 OCR Platform - Docker Deployment"
    echo "=================================================="
    echo ""
}

# Check if Docker is installed and running
check_docker() {
    print_status "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker Desktop first."
        echo "Visit: https://www.docker.com/products/docker-desktop/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are ready"
}

# Check if we're in the right directory
check_directory() {
    print_status "Checking project directory..."
    
    if [[ ! -f "docker-compose.yml" ]]; then
        print_error "docker-compose.yml not found. Please run this script from the web-platform directory."
        exit 1
    fi
    
    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found. This doesn't appear to be the correct directory."
        exit 1
    fi
    
    print_success "Project directory verified"
}

# Setup environment variables
setup_environment() {
    print_status "Setting up environment variables..."
    
    if [[ ! -f ".env" ]]; then
        print_warning ".env file not found. Using default configuration."
        
        # Create basic .env file
        cat > .env << EOF
# OCR Platform - Docker Environment Configuration
POSTGRES_PASSWORD=secure_dev_password_123
DATABASE_URL=postgresql://ocr_user:secure_dev_password_123@postgres:5432/ocr_platform
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
WORKER_CONCURRENCY=2
ENCRYPTION_SECRET=dev-encryption-secret-change-in-production-minimum-32-chars
REDIS_COMMANDER_USER=admin
REDIS_COMMANDER_PASSWORD=admin123
EOF
        print_success "Created default .env file"
    else
        print_success "Environment file found"
    fi
}

# Clean up any existing containers
cleanup_existing() {
    print_status "Cleaning up any existing containers..."
    
    # Stop and remove existing containers
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Remove dangling images
    docker image prune -f &>/dev/null || true
    
    print_success "Cleanup completed"
}

# Prepare worker scripts
prepare_scripts() {
    print_status "Preparing worker scripts..."
    
    if [[ -f "scripts/prepare-worker-scripts.sh" ]]; then
        if bash scripts/prepare-worker-scripts.sh; then
            print_success "Worker scripts prepared"
        else
            print_error "Failed to prepare worker scripts"
            exit 1
        fi
    else
        print_warning "Worker script preparation not found, skipping..."
    fi
}

# Build Docker images
build_images() {
    print_status "Building Docker images..."
    print_warning "This may take several minutes on first run..."
    
    # Build with no cache to ensure fresh build
    if docker-compose build --no-cache; then
        print_success "Docker images built successfully"
    else
        print_error "Failed to build Docker images"
        exit 1
    fi
}

# Start services
start_services() {
    print_status "Starting all services..."
    
    # Start services with dependency order
    if docker-compose up -d; then
        print_success "All services started successfully"
    else
        print_error "Failed to start services"
        docker-compose logs
        exit 1
    fi
}

# Wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    local max_wait=300  # 5 minutes
    local wait_time=0
    local check_interval=10
    
    while [[ $wait_time -lt $max_wait ]]; do
        print_status "Checking service health... (${wait_time}s/${max_wait}s)"
        
        # Check PostgreSQL
        if docker-compose exec -T postgres pg_isready -U ocr_user -d ocr_platform &>/dev/null; then
            print_success "PostgreSQL is ready"
            
            # Check Redis
            if docker-compose exec -T redis redis-cli ping &>/dev/null; then
                print_success "Redis is ready"
                
                # Check Web Application
                if curl -f http://localhost:3000/api/health &>/dev/null; then
                    print_success "Web application is ready"
                    break
                else
                    print_status "Web application not ready yet..."
                fi
            else
                print_status "Redis not ready yet..."
            fi
        else
            print_status "PostgreSQL not ready yet..."
        fi
        
        sleep $check_interval
        wait_time=$((wait_time + check_interval))
    done
    
    if [[ $wait_time -ge $max_wait ]]; then
        print_error "Services did not start within the expected time"
        print_status "Showing service logs for debugging:"
        docker-compose logs --tail=50
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Wait a bit more for the database to be fully ready
    sleep 5
    
    if docker-compose exec -T web npx prisma db push --skip-generate; then
        print_success "Database migrations completed"
    else
        print_warning "Database migrations may have failed, but this might be expected for first run"
        # Don't exit here as the app might still work
    fi
}

# Display final status and URLs
show_status() {
    print_header
    print_success "🎉 OCR Platform is now running!"
    echo ""
    echo "📍 Service URLs:"
    echo "   • Web Application: http://localhost:3000"
    echo "   • Redis Commander: http://localhost:8081 (admin/admin123)"
    echo "   • PostgreSQL: localhost:5432 (ocr_user/secure_dev_password_123)"
    echo ""
    echo "🔧 Service Status:"
    docker-compose ps
    echo ""
    echo "📖 Useful Commands:"
    echo "   • View logs: docker-compose logs -f"
    echo "   • Stop services: docker-compose down"
    echo "   • Restart: docker-compose restart"
    echo "   • Access database: docker-compose exec postgres psql -U ocr_user -d ocr_platform"
    echo ""
    print_status "The platform is ready for OCR processing!"
    print_status "Upload your PDF files at: http://localhost:3000"
}

# Handle script termination
cleanup_on_exit() {
    print_warning "Script interrupted. Cleaning up..."
    docker-compose down --remove-orphans 2>/dev/null || true
    exit 1
}

# Set trap for cleanup on exit
trap cleanup_on_exit INT TERM

# Main execution
main() {
    print_header
    
    # Parse command line arguments
    SKIP_BUILD=false
    MONITORING=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --with-monitoring)
                MONITORING=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --skip-build        Skip Docker image building"
                echo "  --with-monitoring   Enable Redis Commander monitoring"
                echo "  --help             Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Step-by-step deployment
    check_docker
    check_directory
    setup_environment
    cleanup_existing
    
    if [[ "$SKIP_BUILD" == "false" ]]; then
        prepare_scripts
        build_images
    else
        print_status "Skipping build step as requested"
    fi
    
    # Start with or without monitoring
    if [[ "$MONITORING" == "true" ]]; then
        print_status "Starting with Redis Commander monitoring..."
        docker-compose --profile monitoring up -d
    else
        start_services
    fi
    
    wait_for_services
    run_migrations
    show_status
    
    print_status "🚀 Deployment complete! Press Ctrl+C to stop all services."
    
    # Keep the script running and show logs
    docker-compose logs -f
}

# Run main function with all arguments
main "$@"