# Multi-stage Docker build for Google Lens OCR Pipeline
# Works on macOS, Windows, and Linux

# Stage 1: Python Builder - Install Python dependencies
FROM python:3.11-slim AS python-builder

# Install system dependencies for PyMuPDF
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    zlib1g-dev \
    libjpeg-dev \
    libfreetype6-dev \
    liblcms2-dev \
    libopenjp2-7-dev \
    libtiff5-dev \
    tk-dev \
    tcl-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip install --no-cache-dir \
    PyMuPDF==1.23.26 \
    tqdm==4.66.1 \
    Pillow==10.1.0

# Stage 2: Node.js Base - Install Node.js and dependencies
FROM node:18-alpine AS node-base

# Install system dependencies needed for Chrome and OCR
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    py3-pip \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Tell Puppeteer to skip installing Chromium (use system-installed)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set working directory
WORKDIR /app

# Copy package files for root, server, and dashboard
COPY package*.json ./
COPY server/package*.json ./server/
COPY dashboard/package*.json ./dashboard/

# Install root dependencies
RUN npm ci --only=production

# Install server dependencies
WORKDIR /app/server
RUN npm ci --only=production

# Install dashboard dependencies
WORKDIR /app/dashboard
RUN npm ci

# Stage 3: Dashboard Builder - Build React dashboard
FROM node-base AS dashboard-builder

WORKDIR /app/dashboard

# Copy dashboard source code
COPY dashboard/ .

# Build the dashboard
RUN npm run build

# Stage 4: Final Runtime - Combine everything
FROM python:3.11-slim AS runtime

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    gpg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libgtk-3-0 \
    && mkdir -p /etc/apt/keyrings \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install Chromium (easier installation than Chrome)
RUN apt-get update \
    && apt-get install -y chromium chromium-driver \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=python-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-builder /usr/local/bin /usr/local/bin

# Set working directory
WORKDIR /app

# Copy application code
COPY . .

# Copy built Node.js dependencies from node-base stage
COPY --from=node-base /app/node_modules ./node_modules
COPY --from=node-base /app/server/node_modules ./server/node_modules

# Copy built dashboard from dashboard-builder stage
COPY --from=dashboard-builder /app/dashboard/dist ./dashboard/dist
COPY --from=dashboard-builder /app/dashboard/node_modules ./dashboard/node_modules

# Create necessary directories
RUN mkdir -p /app/1_New_File_Process_PDF_2_PNG \
    /app/2_Converted_PNGs \
    /app/3_OCR_TXT_Files \
    /app/logs \
    /app/server/uploads

# Set Chromium executable path for puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user for security
RUN useradd -r -s /bin/false ocruser && \
    chown -R ocruser:ocruser /app
USER ocruser

# Expose ports
EXPOSE 3003 3333

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
USER root
RUN chmod +x /docker-entrypoint.sh
USER ocruser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3003/api/health || exit 1

# Start the application
ENTRYPOINT ["/docker-entrypoint.sh"]