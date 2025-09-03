#!/bin/bash
# Health Check Script for Train Ticket OCR System
# Usage: ./scripts/health-check.sh [local|production]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TIMEOUT=30

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
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

# Check HTTP endpoint
check_http() {
    local url=$1
    local name=$2
    local expected_code=${3:-200}
    
    log_info "Checking $name..."
    
    if command -v curl &> /dev/null; then
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url")
        
        if [ "$response_code" = "$expected_code" ]; then
            log_success "$name is healthy (HTTP $response_code)"
            return 0
        else
            log_error "$name returned HTTP $response_code (expected $expected_code)"
            return 1
        fi
    else
        log_warning "curl not found, skipping HTTP check for $name"
        return 0
    fi
}

# Check Supabase connection
check_supabase() {
    log_info "Checking Supabase connection..."
    
    # Load environment variables
    if [ -f ".env" ]; then
        source .env
    fi
    
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
        log_error "Supabase credentials not found in environment"
        return 1
    fi
    
    local health_url="$SUPABASE_URL/rest/v1/"
    
    if command -v curl &> /dev/null; then
        local response=$(curl -s --max-time $TIMEOUT \
            -H "apikey: $SUPABASE_ANON_KEY" \
            -H "Content-Type: application/json" \
            "$health_url")
        
        if [ $? -eq 0 ]; then
            log_success "Supabase connection is healthy"
            return 0
        else
            log_error "Supabase connection failed"
            return 1
        fi
    else
        log_warning "curl not found, skipping Supabase check"
        return 0
    fi
}

# Check database schema
check_database_schema() {
    log_info "Checking database schema..."
    
    if [ -f ".env" ]; then
        source .env
    fi
    
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
        log_warning "Supabase credentials not found, skipping schema check"
        return 0
    fi
    
    # Check if main tables exist
    local tables=("tickets" "passengers" "journeys")
    local all_tables_exist=true
    
    for table in "${tables[@]}"; do
        local response=$(curl -s --max-time $TIMEOUT \
            -H "apikey: $SUPABASE_ANON_KEY" \
            -H "Content-Type: application/json" \
            "$SUPABASE_URL/rest/v1/$table?limit=1" 2>/dev/null)
        
        if [ $? -eq 0 ] && [[ "$response" != *"error"* ]]; then
            log_success "Table '$table' exists and is accessible"
        else
            log_error "Table '$table' is not accessible"
            all_tables_exist=false
        fi
    done
    
    if $all_tables_exist; then
        return 0
    else
        return 1
    fi
}

# Check local environment
check_local() {
    log_info "🏠 Running local health checks..."
    
    local healthy=true
    
    # Check Node.js
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        log_success "Node.js is installed ($node_version)"
    else
        log_error "Node.js is not installed"
        healthy=false
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        log_success "npm is installed ($npm_version)"
    else
        log_error "npm is not installed"
        healthy=false
    fi
    
    # Check Python
    if command -v python3 &> /dev/null; then
        local python_version=$(python3 --version)
        log_success "Python 3 is installed ($python_version)"
    else
        log_warning "Python 3 is not installed (required for PDF conversion)"
    fi
    
    # Check environment file
    if [ -f ".env" ]; then
        log_success ".env file exists"
    else
        log_error ".env file not found"
        healthy=false
    fi
    
    # Check Supabase connection
    if ! check_supabase; then
        healthy=false
    fi
    
    # Check database schema
    if ! check_database_schema; then
        healthy=false
    fi
    
    # Check required folders
    local folders=("1_Ticket_PDF" "3_OCR_TXT_Files" "logs")
    for folder in "${folders[@]}"; do
        if [ -d "$folder" ]; then
            log_success "Folder '$folder' exists"
        else
            log_warning "Folder '$folder' does not exist (will be created automatically)"
        fi
    done
    
    # Check dependencies
    if [ -f "package.json" ]; then
        if [ -d "node_modules" ]; then
            log_success "Node.js dependencies are installed"
        else
            log_warning "Node.js dependencies not installed (run: npm install)"
        fi
    fi
    
    # Check frontend
    if [ -d "frontend" ]; then
        log_info "Checking frontend..."
        cd frontend
        
        if [ -f ".env.local" ]; then
            log_success "Frontend environment file exists"
        else
            log_warning "Frontend .env.local file not found"
        fi
        
        if [ -d "node_modules" ]; then
            log_success "Frontend dependencies are installed"
        else
            log_warning "Frontend dependencies not installed (run: cd frontend && npm install)"
        fi
        
        cd ..
    fi
    
    echo ""
    if $healthy; then
        log_success "🎉 Local environment is healthy!"
        return 0
    else
        log_error "❌ Local environment has issues that need to be resolved"
        return 1
    fi
}

# Check production environment
check_production() {
    log_info "🌐 Running production health checks..."
    
    local healthy=true
    
    # These would be your actual production URLs
    # Update these with your deployed application URLs
    local backend_url="https://your-backend.railway.app"
    local frontend_url="https://your-frontend.vercel.app"
    
    log_warning "Update this script with your actual production URLs:"
    echo "  Backend URL: $backend_url"
    echo "  Frontend URL: $frontend_url"
    
    # Check Supabase (same as local)
    if ! check_supabase; then
        healthy=false
    fi
    
    # Check database schema (same as local)
    if ! check_database_schema; then
        healthy=false
    fi
    
    # Note: Uncomment and update these when you have actual production URLs
    # if ! check_http "$backend_url/health" "Backend API"; then
    #     healthy=false
    # fi
    
    # if ! check_http "$frontend_url" "Frontend Application"; then
    #     healthy=false
    # fi
    
    echo ""
    if $healthy; then
        log_success "🎉 Production environment is healthy!"
        return 0
    else
        log_error "❌ Production environment has issues"
        return 1
    fi
}

# Main function
main() {
    echo "🔍 Train Ticket OCR System Health Check"
    echo "========================================"
    echo ""
    
    case ${1:-local} in
        "local")
            check_local
            ;;
        "production")
            check_production
            ;;
        "supabase")
            check_supabase && check_database_schema
            ;;
        *)
            echo "Usage: $0 [local|production|supabase]"
            echo ""
            echo "Commands:"
            echo "  local      - Check local development environment (default)"
            echo "  production - Check production deployment"
            echo "  supabase   - Check only Supabase connection and schema"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"