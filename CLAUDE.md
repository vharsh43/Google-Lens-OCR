# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Google Lens OCR pipeline that converts PDF documents to text through a multi-stage process:
1. PDF → PNG conversion (300 DPI using Python/PyMuPDF)  
2. PNG → Text extraction (Google Lens OCR via Node.js)
3. **Optional**: Text file merging (now separate workflow)

## Core Architecture

### Pipeline Flow
- **Input**: PDFs in `1_New_File_Process_PDF_2_PNG/`
- **Intermediate**: 300 DPI PNGs in `2_Converted_PNGs/`
- **Output**: Text files in `3_OCR_TXT_Files/`
- **Merged files**: Created separately with `npm run merge`

### Key Components
- `pipeline.js`: Main orchestrator that runs the complete pipeline
- `PDF_2_PNG.py`: Python script for high-quality PDF to PNG conversion
- `src/batch-process.js`: OCR processing coordinator with error handling
- `src/ocr-processor.js`: Google Lens OCR implementation
- `src/merge-txt-files.js`: **NEW** - Standalone script for merging txt files
- `src/config.js`: Central configuration for processing parameters
- `src/utils.js`: Utility functions including queue management

### Technology Stack
- **Node.js**: ES6 modules, main processing logic
- **Python 3**: PyMuPDF for PDF conversion with progress tracking
- **Google Lens**: OCR via chrome-lens-ocr package
- **Dependencies**: fs-extra, glob, chalk for enhanced functionality

## Development Commands

```bash
# Complete pipeline (PDF → PNG → Text, NO auto-merging)
npm run pipeline

# Individual stages
npm run pdf2png    # PDF to PNG conversion only
npm start          # OCR processing only (NO merging)
npm run process    # Alias for npm start
npm run test       # Test mode (processes first 3 files only)

# NEW: Separate merging workflow
npm run merge      # Merge txt files into _OCR.txt files
```

## Configuration & Rate Limiting

All processing parameters are centralized in `src/config.js`:
- **Rate limiting**: Batch size, delays, concurrent processing limits
- **Dynamic rate adjustment**: Automatic scaling based on success rates
- **Retry logic**: Exponential backoff for API failures
- **Output options**: `generateMergedFiles: false` by default (use separate merge command)

The system implements sophisticated rate limiting for Google Lens API with automatic adjustment based on success rates.

## Key Features
- **Smart dependency checking**: Validates Python, PyMuPDF, and Node packages
- **Progress tracking**: Real-time progress bars and detailed logging
- **Error recovery**: Robust retry mechanisms with exponential backoff
- **Structure preservation**: Maintains original folder hierarchy
- **Separate merging workflow**: Users can clean up txt files before merging

## New Workflow (Updated)
1. `npm run pipeline` → PDF to PNG to individual txt files
2. User manually reviews/deletes unwanted txt files
3. `npm run merge` → Creates consolidated `_OCR.txt` files per folder

## Prerequisites
- Node.js 16+
- Python 3.6+ with PyMuPDF and tqdm packages
- Internet connection for Google Lens OCR API

## Logs and Output
- `logs/PipelineLog.txt`: Complete pipeline execution log
- `PipelineSummary.txt`: Success metrics and file breakdowns
- `logs/ConversionLog.txt`: PDF conversion details
- `logs/report.txt`: OCR verification report