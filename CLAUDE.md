# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a streamlined Train Ticket PDF processing system that converts IRCTC e-ticket PDFs to searchable cloud data through direct extraction:
1. **PDF → Direct Text Extraction** (100% accuracy using Python/PyMuPDF)
2. **Text → Structured JSON parsing** (train ticket specific field extraction with enhanced validation)
3. **Auto-import to Supabase Cloud** (PostgreSQL with auto-generated REST APIs)
4. **Professional Web Interface** (Next.js frontend with passenger linking and journey timelines)

## Core Architecture

### Streamlined Pipeline Flow
- **Input**: PDFs in `1_Ticket_PDF/`
- **Processing**: Direct PDF text extraction (no PNG conversion needed)
- **Output**: Structured JSON in `4_Processed_JSON/`
- **Database**: Auto-import to Supabase
- **Frontend**: Professional Next.js web interface

### Key Components
- `src/pdf-extractor.py`: **PRIMARY** - Enhanced PDF direct text extraction with 100% accuracy
- `src/pdf-pipeline.js`: **PRIMARY** - Complete pipeline orchestrator with Supabase integration
- `src/supabase-import.js`: CLI utility for database management and operations
- `src/api/server.js`: Backend API server for PDF upload and processing
- `frontend/`: **PRIMARY** - Professional Next.js web interface with ShadCN UI
- `src/supabase/`: Database schema, operations, and enhanced passenger linking
- `src/config.js`: Central configuration for processing parameters
- `src/env-validator.js`: Environment validation and connection testing
- `src/utils.js`: Utility functions and helper methods

### Technology Stack
- **Node.js**: ES6 modules, main processing logic and API server
- **Python 3**: PyMuPDF for direct PDF text extraction (100% accuracy)
- **Next.js 15**: Professional frontend with TypeScript and ShadCN UI
- **Supabase**: Cloud PostgreSQL database with auto-generated REST APIs
- **Dependencies**: @supabase/supabase-js, fs-extra, glob, chalk, express, multer

## Development Commands

```bash
# Complete streamlined pipeline (RECOMMENDED)
npm run pipeline              # PDF → Direct Extract → Parse → JSON → Supabase

# Frontend development
npm run server                # Start backend API server
npm run server:dev            # Start backend in development mode

# Database operations (Supabase)
npm run db-test              # Test Supabase connection
npm run db-import            # Import JSON files to Supabase
npm run db-stats             # View database statistics
npm run db-search <PNR>      # Search for specific ticket
npm run db-timeline <PNR>    # View journey timeline

# Environment validation
npm run env-check            # Validate environment configuration
npm run env-test             # Test database connections
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
- **Train ticket parsing**: Extracts PNR, passenger details, journey info, payment data
- **Structured JSON output**: Creates machine-readable ticket data files
- **Separate merging workflow**: Users can clean up txt files before merging

## Train Ticket Data Extraction

The enhanced pipeline extracts structured data from IRCTC e-tickets:

### Extracted Fields
- **Core Info**: PNR, Transaction ID, Ticket Print Time
- **Journey Details**: Train number/name, class, quota, distance, stations, times
- **Passenger Info**: Name, age, gender, booking status, current status
- **Payment Data**: Fare breakdown, fees, charges, total amount

### Output Files
- `*_structured.json`: Structured ticket data in JSON format
- `*_debug.json`: Debugging information for failed parsing
- `*.txt`: Raw OCR text files (traditional output)

### Data Schema
Follows PRD specification for MongoDB Atlas integration.

## Enhanced Train Ticket Workflow with Supabase

### Quick Setup (5 minutes)
1. **Create Supabase Project**: Visit [supabase.com](https://supabase.com) and create a free project
2. **Configure Environment**: Copy `.env.example` to `.env` and add:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. **Setup Database**: Run `src/supabase/schema.sql` in your Supabase SQL Editor
4. **Test Connection**: `npm run db-test`

### Complete Workflow
1. **Place train ticket PDFs** in `1_Ticket_PDF/` folder
2. **Run enhanced pipeline**: `npm run pipeline` 
   - Converts PDFs to 300 DPI PNGs
   - Extracts text via Google Lens OCR
   - **Parses structured train ticket data to JSON**
   - **Auto-imports to Supabase cloud database**
3. **Review results**:
   - `*_structured.json`: Structured ticket data
   - `*.txt`: Raw OCR text files  
   - `*_debug.json`: Failed parsing attempts (for debugging)
   - **Supabase Dashboard**: Live data with auto-generated APIs
4. **Query and search**:
   - `npm run db-stats`: View database statistics
   - `npm run db-search <PNR>`: Search for tickets
   - `npm run db-timeline <PNR>`: View journey timeline
   - **REST API**: Direct access via Supabase endpoints

## Supabase Integration

The system uses Supabase cloud database with powerful features:

### Database Features
- **PostgreSQL**: Robust relational database with JSONB support
- **Auto-generated APIs**: REST endpoints created automatically
- **Real-time subscriptions**: Live data updates
- **Row Level Security**: Built-in data protection
- **Global CDN**: Fast access worldwide

### Available APIs (Auto-generated)
```bash
# REST endpoints available after data import
GET  https://your-project.supabase.co/rest/v1/tickets
GET  https://your-project.supabase.co/rest/v1/passengers
GET  https://your-project.supabase.co/rest/v1/journeys

# Search examples
GET  /tickets?pnr=eq.2341068596
GET  /passengers?name=ilike.*HITESH*
GET  /journeys?train_number=eq.20958
```

### Database Commands
```bash
npm run db-test              # Test Supabase connection
npm run db-import            # Import JSON files to Supabase  
npm run db-stats             # Show database statistics
npm run db-search <PNR>      # Search by PNR
npm run db-search <PNR> <NAME> <AGE>  # Search with passenger details
npm run db-timeline <PNR>    # Get journey timeline
```

## Prerequisites
- **Node.js 16+**
- **Python 3.6+** with PyMuPDF and tqdm packages  
- **Internet connection** for Google Lens OCR API
- **Supabase account** (free tier available at supabase.com)

## Logs and Output
- `logs/PipelineLog.txt`: Complete pipeline execution log
- `PipelineSummary.txt`: Success metrics and file breakdowns
- `logs/ConversionLog.txt`: PDF conversion details
- `logs/report.txt`: OCR verification report