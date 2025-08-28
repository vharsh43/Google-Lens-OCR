# PDF OCR Dashboard

A React-based dashboard for managing PDF to text conversion using Google Lens OCR.

## Features

- 📁 **Folder Selection**: Browse and select input folders containing PDF files
- 🔄 **Two-Step Processing**: PDF → PNG → Text conversion pipeline
- 📊 **Real-time Progress**: Live updates during processing
- 📈 **File Statistics**: Track conversion success rates
- 🗂️ **File Management**: Open output folders in OS, clear processed files
- 🎛️ **Pipeline Control**: Start, stop, and reset processing pipeline

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Development Server**:
   ```bash
   npm run dev
   ```

3. **Start the Backend Server** (in a separate terminal):
   ```bash
   cd ../server
   npm install
   npm start
   ```

The dashboard will be available at `http://localhost:3333`

## Usage

1. **Select Folder**: Click "Browse Folder" to select a folder containing PDF files
2. **Step 1**: Click "Start Conversion" to convert PDFs to PNG images
3. **Step 2**: Click "Start OCR" to extract text from PNG images using Google Lens
4. **Manage Files**: Use the action buttons to open output folders or clear files

## Requirements

- Node.js 16+
- Python 3.6+ with PyMuPDF
- Internet connection for Google Lens OCR
- Modern web browser

## Directory Structure

- `1_New_File_Process_PDF_2_PNG/` - Input PDF files
- `2_Converted_PNGs/` - Generated PNG images
- `3_OCR_TXT_Files/` - Extracted text files
- `logs/` - Processing logs