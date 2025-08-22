#!/bin/bash

set -e  # Exit on any error

echo "🚀 OCR Web Platform Setup Script"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
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

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_step "Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version $NODE_VERSION is too old. Please install Node.js 18+ and try again."
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi

if ! command_exists docker; then
    print_warning "Docker is not installed. You'll need to set up PostgreSQL and Redis manually."
    USE_DOCKER=false
else
    USE_DOCKER=true
fi

print_success "Prerequisites check complete"

# Install dependencies
print_step "Installing Node.js dependencies..."
npm install
print_success "Dependencies installed"

# Setup environment file
print_step "Setting up environment configuration..."
if [ ! -f .env ]; then
    cp .env.example .env
    print_success "Created .env file from template"
    
    # Generate a random secret for NextAuth
    if command_exists openssl; then
        NEXTAUTH_SECRET=$(openssl rand -base64 32)
        sed -i.bak "s/your-secret-key-here/$NEXTAUTH_SECRET/" .env
        rm .env.bak 2>/dev/null || true
        print_success "Generated NextAuth secret"
    else
        print_warning "OpenSSL not found. Please manually set NEXTAUTH_SECRET in .env"
    fi
else
    print_warning ".env file already exists, skipping creation"
fi

# Setup databases with Docker
if [ "$USE_DOCKER" = true ]; then
    print_step "Starting databases with Docker..."
    
    # Check if containers are already running
    if docker ps --format "table {{.Names}}" | grep -q "ocr-postgres"; then
        print_warning "PostgreSQL container already running"
    else
        docker-compose -f docker-compose.dev.yml up -d postgres
        print_success "PostgreSQL started"
        
        # Wait for PostgreSQL to be ready
        print_step "Waiting for PostgreSQL to be ready..."
        sleep 5
        
        MAX_ATTEMPTS=30
        ATTEMPT=1
        while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
            if docker exec ocr-postgres pg_isready -U ocr_user > /dev/null 2>&1; then
                break
            fi
            sleep 1
            ATTEMPT=$((ATTEMPT + 1))
        done
        
        if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
            print_error "PostgreSQL did not start within expected time"
            exit 1
        fi
        
        print_success "PostgreSQL is ready"
    fi
    
    if docker ps --format "table {{.Names}}" | grep -q "ocr-redis"; then
        print_warning "Redis container already running"
    else
        docker-compose -f docker-compose.dev.yml up -d redis
        print_success "Redis started"
    fi
    
    # Update .env with Docker database URLs
    sed -i.bak 's|DATABASE_URL=.*|DATABASE_URL="postgresql://ocr_user:dev_password@localhost:5432/ocr_platform"|' .env
    sed -i.bak 's|REDIS_HOST=.*|REDIS_HOST="localhost"|' .env
    sed -i.bak 's|REDIS_PORT=.*|REDIS_PORT="6379"|' .env
    rm .env.bak 2>/dev/null || true
    
else
    print_warning "Docker not available. Please ensure PostgreSQL and Redis are running and update .env accordingly."
fi

# Setup database schema
print_step "Setting up database schema..."
npm run db:generate
print_success "Prisma client generated"

npm run db:push
print_success "Database schema created"

# Create upload directory
print_step "Creating upload directory..."
mkdir -p uploads
chmod 755 uploads
print_success "Upload directory created"

# Create logs directory
print_step "Creating logs directory..."
mkdir -p logs
print_success "Logs directory created"

# Setup complete
echo ""
print_success "Setup complete! 🎉"
echo ""
echo "Next steps:"
echo "1. Configure OAuth providers in .env (optional)"
echo "2. Start the development server:"
echo "   npm run dev"
echo "3. Start the queue worker (in another terminal):"
echo "   npm run queue:dev"
echo "4. Visit http://localhost:3000"
echo ""

if [ "$USE_DOCKER" = true ]; then
    echo "Database management:"
    echo "• PostgreSQL: localhost:5432 (user: ocr_user, password: dev_password)"
    echo "• Redis: localhost:6379"
    echo "• Redis Commander: http://localhost:8081 (for queue monitoring)"
    echo "• Prisma Studio: npm run db:studio"
fi

echo ""
echo "For production deployment, see README.md"