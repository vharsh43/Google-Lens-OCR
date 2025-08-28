#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Google Lens OCR Pipeline...${NC}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_attempts=$3
    local attempt=1
    
    echo -e "${YELLOW}⏳ Waiting for ${service_name} to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ ${service_name} is ready!${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}   Attempt ${attempt}/${max_attempts} - ${service_name} not ready yet...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ ${service_name} failed to start after ${max_attempts} attempts${NC}"
    return 1
}

# Create necessary directories
echo -e "${BLUE}📁 Creating necessary directories...${NC}"
mkdir -p /app/1_New_File_Process_PDF_2_PNG
mkdir -p /app/2_Converted_PNGs
mkdir -p /app/3_OCR_TXT_Files
mkdir -p /app/logs
mkdir -p /app/server/uploads

# Set proper permissions
chmod 755 /app/1_New_File_Process_PDF_2_PNG
chmod 755 /app/2_Converted_PNGs
chmod 755 /app/3_OCR_TXT_Files
chmod 755 /app/logs
chmod 755 /app/server/uploads

# Verify Python dependencies
echo -e "${BLUE}🐍 Verifying Python dependencies...${NC}"
if ! python3 -c "import fitz; print('✅ PyMuPDF imported successfully')" 2>/dev/null; then
    echo -e "${RED}❌ PyMuPDF import failed${NC}"
    exit 1
fi

if ! python3 -c "import tqdm; print('✅ tqdm imported successfully')" 2>/dev/null; then
    echo -e "${RED}❌ tqdm import failed${NC}"
    exit 1
fi

# Verify Node.js dependencies
echo -e "${BLUE}📦 Verifying Node.js environment...${NC}"
if ! command_exists node; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) and npm $(npm --version) are ready${NC}"

# Detect available Chromium installation
echo -e "${BLUE}🔍 Detecting Chromium installation...${NC}"
if command -v chromium >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"
    echo -e "${GREEN}✅ Found Chromium at /usr/bin/chromium${NC}"
elif command -v chromium-browser >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
    echo -e "${GREEN}✅ Found Chromium at /usr/bin/chromium-browser${NC}"
elif command -v google-chrome >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome"
    echo -e "${GREEN}✅ Found Chrome at /usr/bin/google-chrome${NC}"
else
    echo -e "${YELLOW}⚠️  No system Chromium found, Puppeteer will download its own${NC}"
    unset PUPPETEER_EXECUTABLE_PATH
    export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
fi

# Start the server in background
echo -e "${BLUE}🖥️  Starting server on port 3003...${NC}"
cd /app/server
nohup node server.js > /app/logs/server.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
if wait_for_service "Server" "http://localhost:3003/api/health" 15; then
    echo -e "${GREEN}✅ Server started successfully (PID: $SERVER_PID)${NC}"
else
    echo -e "${RED}❌ Server failed to start${NC}"
    exit 1
fi

# Start the dashboard
echo -e "${BLUE}🎨 Starting dashboard on port 3333...${NC}"

# Check if dashboard dist exists
if [ ! -d "/app/dashboard/dist" ]; then
    echo -e "${RED}❌ Dashboard dist directory not found at /app/dashboard/dist${NC}"
    echo -e "${YELLOW}📁 Available dashboard files:${NC}"
    ls -la /app/dashboard/ || echo "Dashboard directory not accessible"
    echo -e "${YELLOW}💡 Building dashboard now...${NC}"
    cd /app/dashboard
    npm run build || echo -e "${RED}❌ Dashboard build failed${NC}"
    cd /app
fi

# Serve the built dashboard using the server's Express installation (ES modules)
cd /app/server
cat > dashboard-server.js << 'EOF'
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3333;

// Serve static files from dist directory (absolute path)
const distPath = '/app/dashboard/dist';
app.use(express.static(distPath));

// Handle client-side routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`📊 Dashboard serving on http://localhost:${PORT}`);
}).on('error', (err) => {
    console.error('❌ Dashboard server error:', err);
    process.exit(1);
});
EOF

echo -e "${YELLOW}🔧 Starting dashboard server from server directory...${NC}"
nohup node dashboard-server.js > /app/logs/dashboard.log 2>&1 &
DASHBOARD_PID=$!
echo -e "${BLUE}📊 Dashboard PID: $DASHBOARD_PID${NC}"

# Give the dashboard a moment to start
sleep 2

# Wait for dashboard to be ready
if wait_for_service "Dashboard" "http://localhost:3333" 10; then
    echo -e "${GREEN}✅ Dashboard started successfully (PID: $DASHBOARD_PID)${NC}"
else
    echo -e "${RED}❌ Dashboard failed to start${NC}"
    echo -e "${YELLOW}📋 Dashboard logs:${NC}"
    cat /app/logs/dashboard.log 2>/dev/null || echo "No dashboard logs available"
    echo -e "${YELLOW}🔍 Dashboard process status:${NC}"
    ps aux | grep dashboard-server || echo "No dashboard process found"
    exit 1
fi

# Final status
echo -e "${GREEN}🎉 Google Lens OCR Pipeline is ready!${NC}"
echo -e "${BLUE}📊 Dashboard: http://localhost:3333${NC}"
echo -e "${BLUE}🔗 API: http://localhost:3003/api${NC}"
echo -e "${YELLOW}💡 Upload PDFs to get started with OCR processing${NC}"

# Function to handle graceful shutdown
cleanup() {
    echo -e "${YELLOW}🛑 Shutting down gracefully...${NC}"
    
    # Kill dashboard
    if [ -n "$DASHBOARD_PID" ]; then
        kill $DASHBOARD_PID 2>/dev/null || true
        echo -e "${GREEN}✅ Dashboard stopped${NC}"
    fi
    
    # Kill server
    if [ -n "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
        echo -e "${GREEN}✅ Server stopped${NC}"
    fi
    
    echo -e "${GREEN}👋 Goodbye!${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Keep the script running
echo -e "${BLUE}🔄 Keeping services alive... Press Ctrl+C to stop${NC}"
while true; do
    # Check if processes are still running
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo -e "${RED}❌ Server process died unexpectedly${NC}"
        exit 1
    fi
    
    if ! kill -0 $DASHBOARD_PID 2>/dev/null; then
        echo -e "${RED}❌ Dashboard process died unexpectedly${NC}"
        exit 1
    fi
    
    sleep 5
done