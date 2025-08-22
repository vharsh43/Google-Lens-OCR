#!/bin/bash

# Prepare worker scripts for Docker deployment
# This script copies the required Python scripts into the container build context

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PARENT_DIR="$(cd "${PROJECT_ROOT}/.." && pwd)"

echo "Preparing worker scripts for Docker build..."

# Create scripts directory in the web-platform folder
mkdir -p "${PROJECT_ROOT}/docker-scripts/src"

# Copy Python PDF conversion script
if [[ -f "${PARENT_DIR}/PDF_2_PNG.py" ]]; then
    cp "${PARENT_DIR}/PDF_2_PNG.py" "${PROJECT_ROOT}/docker-scripts/"
    echo "✓ Copied PDF_2_PNG.py"
else
    echo "❌ PDF_2_PNG.py not found in parent directory"
    exit 1
fi

# Copy Node.js OCR processing scripts
if [[ -d "${PARENT_DIR}/src" ]]; then
    cp -r "${PARENT_DIR}/src/"* "${PROJECT_ROOT}/docker-scripts/src/"
    echo "✓ Copied OCR processing scripts"
else
    echo "❌ OCR src directory not found in parent directory"
    exit 1
fi

echo "✅ Worker scripts prepared for Docker build"