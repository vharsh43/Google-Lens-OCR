#!/bin/bash
# Production Deployment Script for Train Ticket OCR System
# Usage: ./scripts/deploy.sh [backend|frontend|all]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_SERVICE="railway"  # or "render"
FRONTEND_SERVICE="vercel"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if required tools are installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        log_error "git is not installed"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        log_error "This script must be run from the project root directory"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Validate environment
validate_environment() {
    log_info "Validating environment configuration..."
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        log_error ".env file not found. Copy .env.example and configure it."
        exit 1
    fi
    
    # Run environment validation
    if npm run env-check &> /dev/null; then
        log_success "Environment validation passed"
    else
        log_error "Environment validation failed. Run 'npm run env-check' for details."
        exit 1
    fi
}

# Deploy backend
deploy_backend() {
    log_info "Deploying backend to $BACKEND_SERVICE..."
    
    case $BACKEND_SERVICE in
        "railway")
            if ! command -v railway &> /dev/null; then
                log_info "Installing Railway CLI..."
                npm install -g @railway/cli
            fi
            
            log_info "Deploying to Railway..."
            railway up
            ;;
        "render")
            log_info "For Render deployment, push to your connected GitHub repository"
            log_info "Render will automatically deploy when you push to main branch"
            ;;
        *)
            log_error "Unsupported backend service: $BACKEND_SERVICE"
            exit 1
            ;;
    esac
    
    log_success "Backend deployment initiated"
}

# Deploy frontend
deploy_frontend() {
    log_info "Deploying frontend to $FRONTEND_SERVICE..."
    
    # Navigate to frontend directory
    cd frontend
    
    # Check frontend environment
    if [ ! -f ".env.local" ]; then
        log_warning ".env.local not found in frontend directory"
        log_info "Make sure to configure environment variables in your hosting platform"
    fi
    
    case $FRONTEND_SERVICE in
        "vercel")
            if ! command -v vercel &> /dev/null; then
                log_info "Installing Vercel CLI..."
                npm install -g vercel
            fi
            
            log_info "Building and deploying to Vercel..."
            # Build the project first to catch any errors
            npm run build
            
            # Deploy to production
            vercel --prod
            ;;
        *)
            log_error "Unsupported frontend service: $FRONTEND_SERVICE"
            exit 1
            ;;
    esac
    
    # Go back to project root
    cd ..
    
    log_success "Frontend deployment completed"
}

# Test deployment
test_deployment() {
    log_info "Running post-deployment tests..."
    
    # Test Supabase connection
    if npm run db-test &> /dev/null; then
        log_success "Database connection test passed"
    else
        log_warning "Database connection test failed"
    fi
    
    log_info "Deployment testing completed"
}

# Main deployment function
deploy_all() {
    log_info "Starting complete system deployment..."
    
    check_prerequisites
    validate_environment
    
    # Commit and push changes
    log_info "Ensuring all changes are committed..."
    if [ -n "$(git status --porcelain)" ]; then
        log_warning "You have uncommitted changes. Committing them now..."
        git add .
        git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
    fi
    
    git push origin main
    log_success "Code pushed to repository"
    
    # Deploy backend
    deploy_backend
    
    # Deploy frontend
    deploy_frontend
    
    # Test deployment
    test_deployment
    
    log_success "🎉 Complete deployment finished!"
    
    # Display useful information
    echo ""
    log_info "📋 Deployment Summary:"
    echo "Backend: Deployed to $BACKEND_SERVICE"
    echo "Frontend: Deployed to $FRONTEND_SERVICE"
    echo "Database: Supabase (already configured)"
    echo ""
    log_info "🔗 Useful Links:"
    if [ "$BACKEND_SERVICE" = "railway" ]; then
        echo "Railway Dashboard: https://railway.app/dashboard"
    fi
    if [ "$FRONTEND_SERVICE" = "vercel" ]; then
        echo "Vercel Dashboard: https://vercel.com/dashboard"
    fi
    echo "Supabase Dashboard: https://supabase.com/dashboard"
}

# Parse command line arguments
case ${1:-all} in
    "backend")
        check_prerequisites
        validate_environment
        deploy_backend
        ;;
    "frontend")
        check_prerequisites
        deploy_frontend
        ;;
    "all")
        deploy_all
        ;;
    "test")
        test_deployment
        ;;
    *)
        echo "Usage: $0 [backend|frontend|all|test]"
        echo ""
        echo "Commands:"
        echo "  backend   - Deploy only the backend (OCR system)"
        echo "  frontend  - Deploy only the frontend (Next.js app)"
        echo "  all       - Deploy both backend and frontend (default)"
        echo "  test      - Run post-deployment tests"
        exit 1
        ;;
esac