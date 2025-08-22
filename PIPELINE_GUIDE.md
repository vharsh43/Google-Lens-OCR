# PDF to Text Pipeline Guide

## Complete Workflow Overview

This integrated pipeline converts PDFs to text files through a 3-stage process:

```
📄 PDFs → 🖼️ PNGs (300 DPI) → 📄 Text Files → 📋 Merged Files
```

## Quick Start - Complete Pipeline

### 1. Add Your PDFs
Place PDF files in the `1_New_File_Process_PDF_2_PNG/` folder:
```
1_New_File_Process_PDF_2_PNG/
├── document1.pdf
├── folder1/
│   └── document2.pdf
└── folder2/
    └── document3.pdf
```

### 2. Run Complete Pipeline
```bash
# Run the complete pipeline (PDF → PNG → OCR → Merged Text)
npm run pipeline
```

This single command will:
1. ✅ Check all dependencies (Python, PyMuPDF, Node.js packages)
2. ✅ Convert all PDFs to 300 DPI PNG images
3. ✅ Extract text using Google Lens OCR with smart error handling
4. ✅ Generate individual text files
5. ✅ Create merged `_OCR.txt` files for each folder
6. ✅ Provide detailed success metrics and reports
7. ✅ Show actionable next steps based on results

## Individual Commands

If you want to run stages separately:

```bash
# Step 1: Convert PDFs to PNGs only
npm run pdf2png

# Step 2: Run OCR processing only (after PDFs are converted)
npm start

# Step 3: Test with first 3 files only
npm run test
```

## Folder Structure

### Input
- `1_New_File_Process_PDF_2_PNG/` - Place your PDF files here

### Intermediate
- `2_Converted_PNGs/` - PNG images generated from PDFs (300 DPI)

### Output
- `3_OCR_TXT_Files/` - Final text files and merged files

### Example Complete Structure:
```
1_New_File_Process_PDF_2_PNG/
├── book1.pdf
└── documents/
    └── report.pdf

        ↓ (Pipeline Processing)

2_Converted_PNGs/
├── book1/
│   ├── book1_0001.png
│   └── book1_0002.png
└── documents/
    └── report/
        └── report_0001.png

        ↓ (OCR Processing)

3_OCR_TXT_Files/
├── book1/
│   ├── book1_0001.txt
│   ├── book1_0002.txt
│   └── book1_OCR.txt        ← Merged file
└── documents/
    └── report/
        ├── report_0001.txt
        └── report_OCR.txt    ← Merged file
```

## Features

### 🎯 **Fixed 300 DPI Output**
All images are exported at exactly 300 DPI for optimal OCR accuracy.

### 📋 **Automatic Merged Files** 
Each folder gets a `foldername_OCR.txt` file containing all text combined.

### 📊 **Progress Tracking**
Real-time progress bars and detailed completion reports.

### 🔄 **Smart Error Recovery**
Automatic retries with rate limiting for Google Lens API.

### 📁 **Structure Preservation**
Maintains exact folder hierarchy throughout the entire pipeline.

## Requirements

- **Node.js** 14+ 
- **Python 3** with PyMuPDF (`pip install PyMuPDF tqdm`)
- **Internet connection** for Google Lens OCR

## Enhanced Features

### 🔍 **Smart Dependency Checking**
Automatically verifies:
- Python 3.6+ installation
- PyMuPDF library availability  
- Required Node.js packages
- Provides specific installation guidance

### 📊 **Advanced Progress Tracking**
- Real-time conversion progress
- File count verification at each stage
- Success rate calculations
- Performance metrics

### 🛠️ **Intelligent Error Handling**
- Specific error messages with solutions
- Rate limiting detection and guidance
- Network connectivity checks
- Retry mechanisms with exponential backoff

### 📋 **Comprehensive Reporting**
- Success rates for each stage
- Detailed file breakdowns
- Performance analysis
- Actionable next steps

## Logs and Reports

The pipeline generates comprehensive log files:
- `logs/PipelineLog.txt` - Complete pipeline execution log with timestamps
- `PipelineSummary.txt` - Detailed summary with success metrics
- `logs/ConversionLog.txt` - PDF to PNG conversion details
- `logs/report.txt` - OCR verification report with merged file info
- `pdf_conversion_complete.flag` - Stage completion indicator

## Troubleshooting

### PDFs Not Converting
- Check if PDFs exist in `1_New_File_Process_PDF_2_PNG/`
- Ensure Python 3 and PyMuPDF are installed

### OCR Processing Issues
- Verify PNG files were created in `2_Converted_PNGs/`
- Check internet connection for Google Lens API
- Review rate limiting settings in `src/config.js`

### No Merged Files Generated
- Ensure `generateMergedFiles: true` in `src/config.js`
- Check that individual text files were created successfully