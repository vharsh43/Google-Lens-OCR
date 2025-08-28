# Universal Docker build for Google Lens OCR Pipeline
# Works on Windows, macOS, and Linux with a single Dockerfile

# Stage 1: Python Builder - Install Python dependencies
FROM python:3.11-slim AS python-builder

# Install Python packages (no system dependencies needed for most cases)
RUN pip install --no-cache-dir --retries 5 --timeout 120 \
    PyMuPDF==1.23.26 \
    tqdm==4.66.1 \
    Pillow==10.1.0

# Stage 2: Dashboard Builder - Build React application
FROM node:18-slim AS dashboard-builder

WORKDIR /app/dashboard

# Copy dashboard package files and install dependencies
COPY dashboard/package*.json ./
RUN npm install

# Copy dashboard source and build by directly invoking vite
COPY dashboard/ .
RUN node node_modules/vite/bin/vite.js build

# Stage 3: Server Dependencies - Install server dependencies
FROM node:18-slim AS server-deps

WORKDIR /app

# Copy all package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install root and server dependencies
RUN npm install --only=production

WORKDIR /app/server
RUN npm install --only=production

# Stage 4: Final Runtime - Combine everything
FROM python:3.11-slim AS runtime

# Install essential system dependencies only
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=python-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-builder /usr/local/bin /usr/local/bin

# Set working directory
WORKDIR /app

# Copy application code
COPY . .

# Copy Node.js dependencies from server-deps stage
COPY --from=server-deps /app/node_modules ./node_modules
COPY --from=server-deps /app/server/node_modules ./server/node_modules

# Copy built dashboard from dashboard-builder stage
COPY --from=dashboard-builder /app/dashboard/dist ./dashboard/dist

# Create necessary directories
RUN mkdir -p /app/1_New_File_Process_PDF_2_PNG \
    /app/2_Converted_PNGs \
    /app/3_OCR_TXT_Files \
    /app/logs \
    /app/server/uploads

# Configure Puppeteer to download its own Chromium (most reliable across platforms)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Copy and set up entrypoint script first (as root)
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create non-root user for security
RUN useradd -r -s /bin/false ocruser && \
    mkdir -p /app/.cache/puppeteer && \
    chown -R ocruser:ocruser /app

# Expose ports
EXPOSE 3003 3333

# Health check with extended timeout for Puppeteer setup
HEALTHCHECK --interval=60s --timeout=30s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:3003/api/health || exit 1

# Start the application
ENTRYPOINT ["/docker-entrypoint.sh"]