#!/bin/bash

# =============================================================================
# OCR Web Platform - Docker Startup Script
# =============================================================================
# 
# Complete containerized platform startup with zero local dependencies
# 
# Requirements: Docker and Docker Compose only
# 
# Usage: ./docker-start.sh [options]
# 
# Options:
#   --dev, -d     Start in development mode with hot reload
#   --build, -b   Force rebuild all containers
#   --monitoring  Include monitoring services (Redis Commander)
#   --cleanup     Clean up all containers and volumes
#   --help, -h    Show this help message
# 
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
PROJECT_NAME="ocr-platform"
COMPOSE_FILE="docker-compose.yml"
DEV_COMPOSE_FILE="docker-compose.dev.yml"
ENV_FILE=".env"
DOCKER_ENV_FILE=".env.docker"

# Default options
DEVELOPMENT_MODE=false
FORCE_BUILD=false
INCLUDE_MONITORING=false
CLEANUP_MODE=false

# =============================================================================
# Utility Functions
# =============================================================================

print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║                🐋 OCR Web Platform - Docker                 ║"
    echo "║                                                              ║"
    echo "║              Complete Containerized Setup                    ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${PURPLE}🔄 $1${NC}"
}

# =============================================================================
# Validation Functions
# =============================================================================

check_docker() {
    log_step "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        log_info "Please install Docker from: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        log_info "Please start Docker Desktop or Docker service"
        exit 1
    fi
    
    log_success "Docker is available and running"
}

check_docker_compose() {
    log_step "Checking Docker Compose..."
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available"
        log_info "Please install Docker Compose"
        exit 1
    fi
    
    # Determine compose command
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    log_success "Docker Compose is available"
}

check_system_resources() {
    log_step "Checking system resources..."
    
    # Check available memory (basic check)
    if command -v free &> /dev/null; then
        available_mem=$(free -m | awk '/^Mem:/{print $7}')
        if [ "$available_mem" -lt 2048 ]; then
            log_warning "Low available memory detected (${available_mem}MB). Recommend 2GB+ for optimal performance."
        fi
    fi
    
    # Check disk space
    available_space=$(df . | tail -1 | awk '{print $4}')
    if [ "$available_space" -lt 5000000 ]; then
        log_warning "Low disk space detected. Recommend 5GB+ free space."
    fi
    
    log_success "System resources checked"
}

validate_environment() {
    log_step "Validating environment configuration..."
    
    # Check if .env exists, if not copy from template
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$DOCKER_ENV_FILE" ]; then
            log_info "Creating $ENV_FILE from $DOCKER_ENV_FILE template..."
            cp "$DOCKER_ENV_FILE" "$ENV_FILE"
            log_warning "Please edit $ENV_FILE with your specific configuration (Google OAuth, etc.)"
        else
            log_error "No environment file found. Please create $ENV_FILE"
            exit 1
        fi
    fi
    
    # Validate critical environment variables
    source "$ENV_FILE"
    
    local missing_vars=()
    
    if [ -z "$POSTGRES_PASSWORD" ]; then
        missing_vars+=("POSTGRES_PASSWORD")
    fi
    
    if [ -z "$NEXTAUTH_SECRET" ] || [ "$NEXTAUTH_SECRET" = "dev-secret-key-change-in-production-very-long-and-secure" ]; then
        log_warning "Using default NEXTAUTH_SECRET. Please update for production use."
    fi
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        log_info "Please configure these in $ENV_FILE"
        exit 1
    fi
    
    log_success "Environment configuration validated"
}

# =============================================================================
# Docker Operations
# =============================================================================

build_containers() {
    log_step "Building Docker containers..."
    
    local build_args=""
    if [ "$FORCE_BUILD" = true ]; then
        build_args="--no-cache"
    fi
    
    $COMPOSE_CMD build $build_args
    
    log_success "Containers built successfully"
}

start_services() {
    log_step "Starting OCR Platform services..."
    
    local compose_files="-f $COMPOSE_FILE"
    local profiles=""
    
    if [ "$DEVELOPMENT_MODE" = true ]; then
        if [ -f "$DEV_COMPOSE_FILE" ]; then
            compose_files="$compose_files -f $DEV_COMPOSE_FILE"
        fi
    fi
    
    if [ "$INCLUDE_MONITORING" = true ]; then
        profiles="--profile monitoring"
    fi
    
    # Start services with health checks
    $COMPOSE_CMD $compose_files up -d $profiles
    
    log_success "Services started successfully"
}

wait_for_services() {
    log_step "Waiting for services to be healthy..."
    
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if $COMPOSE_CMD ps | grep -q "unhealthy"; then
            attempt=$((attempt + 1))
            echo -n "."
            sleep 2
        else
            echo ""
            break
        fi
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Services failed to become healthy within timeout"
        log_info "Check service logs: $COMPOSE_CMD logs"
        exit 1
    fi
    
    log_success "All services are healthy"
}

run_database_migrations() {
    log_step "Running database migrations..."
    
    # Wait a bit more for database to be fully ready
    sleep 5
    
    # Run Prisma migrations in the web container
    $COMPOSE_CMD exec web npx prisma migrate deploy
    
    log_success "Database migrations completed"
}

display_service_info() {
    echo ""
    log_success "🎉 OCR Web Platform is running!"
    echo ""
    echo -e "${CYAN}📱 Access Points:${NC}"
    echo -e "   🌐 Web Application:    ${GREEN}http://localhost:3000${NC}"
    echo -e "   💾 Database:          ${GREEN}localhost:5432${NC}"
    echo -e "   🔄 Redis:             ${GREEN}localhost:6379${NC}"
    
    if [ "$INCLUDE_MONITORING" = true ]; then
        echo -e "   📊 Redis Commander:   ${GREEN}http://localhost:8081${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}🛠️  Management Commands:${NC}"
    echo -e "   📊 View logs:         ${YELLOW}$COMPOSE_CMD logs -f${NC}"
    echo -e "   🔄 Restart services:  ${YELLOW}$COMPOSE_CMD restart${NC}"
    echo -e "   🛑 Stop platform:     ${YELLOW}$COMPOSE_CMD down${NC}"
    echo -e "   🗑️  Full cleanup:      ${YELLOW}./docker-start.sh --cleanup${NC}"
    
    echo ""
    echo -e "${PURPLE}💡 Tips:${NC}"
    echo -e "   • Upload files at: ${GREEN}http://localhost:3000/upload${NC}"
    echo -e "   • Check job status at: ${GREEN}http://localhost:3000/jobs${NC}"
    echo -e "   • All data persists in Docker volumes"
    echo -e "   • Press Ctrl+C to view logs, then run 'docker-compose down' to stop"
    echo ""
}

cleanup_all() {
    log_step "Cleaning up all containers and volumes..."
    
    $COMPOSE_CMD down -v --remove-orphans
    
    # Remove images if they exist
    if docker images | grep -q "$PROJECT_NAME"; then
        docker images | grep "$PROJECT_NAME" | awk '{print $3}' | xargs -r docker rmi -f
    fi
    
    log_success "Cleanup completed"
}

# =============================================================================
# Main Execution
# =============================================================================

show_help() {
    print_banner
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --dev, -d       Start in development mode with hot reload"
    echo "  --build, -b     Force rebuild all containers"
    echo "  --monitoring    Include monitoring services (Redis Commander)"
    echo "  --cleanup       Clean up all containers and volumes"
    echo "  --help, -h      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Start production mode"
    echo "  $0 --dev             # Start development mode"
    echo "  $0 --build           # Force rebuild and start"
    echo "  $0 --monitoring      # Start with Redis Commander"
    echo "  $0 --cleanup         # Clean up everything"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dev|-d)
            DEVELOPMENT_MODE=true
            shift
            ;;
        --build|-b)
            FORCE_BUILD=true
            shift
            ;;
        --monitoring)
            INCLUDE_MONITORING=true
            shift
            ;;
        --cleanup)
            CLEANUP_MODE=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution flow
main() {
    print_banner
    
    if [ "$CLEANUP_MODE" = true ]; then
        cleanup_all
        exit 0
    fi
    
    # Pre-flight checks
    check_docker
    check_docker_compose
    check_system_resources
    validate_environment
    
    # Build and start
    if [ "$FORCE_BUILD" = true ] || [ ! "$(docker images -q ${PROJECT_NAME})" ]; then
        build_containers
    fi
    
    start_services
    wait_for_services
    run_database_migrations
    
    # Success!
    display_service_info
    
    # Follow logs
    log_info "Following service logs... (Press Ctrl+C to exit)"
    trap "echo ''; log_info 'Logs interrupted. Services are still running.'; exit 0" INT
    $COMPOSE_CMD logs -f
}

# Run main function
main