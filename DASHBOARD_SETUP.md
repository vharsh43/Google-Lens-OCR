# 🚀 PDF OCR Dashboard Setup Guide

This guide will help you set up and run the React dashboard for your PDF OCR pipeline.

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js 16+** installed
- **Python 3.6+** with PyMuPDF installed (`pip install PyMuPDF tqdm`)
- **Internet connection** for Google Lens OCR API
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

## 🔧 Installation

### Step 1: Install Main Dependencies
```bash
npm install
```

### Step 2: Install Dashboard Dependencies
```bash
cd dashboard
npm install
cd ..
```

### Step 3: Install Server Dependencies
```bash
cd server
npm install
cd ..
```

## 🚀 Quick Start

### Option 1: Single Command (Recommended)
```bash
npm run dashboard:dev
```

This will start both the backend server and frontend dashboard simultaneously.

### Option 2: Manual Start
```bash
# Terminal 1: Start the backend server
cd server
npm start

# Terminal 2: Start the frontend dashboard  
cd dashboard
npm run dev
```

## 🌐 Access the Dashboard

Once both services are running:

- **Dashboard**: http://localhost:3333
- **API Server**: http://localhost:3001
- **API Health Check**: http://localhost:3001/api/health

## 📱 How to Use the Dashboard

### 1. **Select Input Folder**
- Click "Browse Folder" in the "Select Input Folder" card
- Choose a folder containing your PDF files
- The dashboard will count and display the number of PDF files found

### 2. **Step 1: PDF to PNG Conversion**
- Once PDFs are detected, click "Start Conversion" in Step 1
- Monitor real-time progress as PDFs are converted to high-resolution PNG images
- Progress updates show current file being processed and completion percentage

### 3. **Step 2: Google Lens OCR Processing**
- After PNG conversion is complete, click "Start OCR" in Step 2
- Watch as PNG images are processed through Google Lens OCR
- Rate limiting is automatically handled with progress indicators

### 4. **File Management**
- **View Results**: Click "Output Text Files" to open the results folder
- **Check Intermediate Files**: Click "Converted PNGs" to view generated images
- **Clear Files**: Use "Clear All Files" to remove processed files
- **Reset Pipeline**: Use "Reset Pipeline" to clear the processing state

## 📊 Dashboard Features

### 🎛️ **Control Panel**
- Folder selection with native browser dialog
- Two-step processing pipeline with clear indicators
- Real-time progress bars and status updates

### 📈 **Statistics Dashboard**
- Live file counts for PDFs, PNGs, and text files
- Success rate calculation and visualization
- Processing flow indicators

### 🗂️ **File Management**
- Quick access to all processing folders
- Cross-platform folder opening (macOS/Windows/Linux)
- One-click file cleanup and system reset

### 🔄 **Real-time Updates**
- WebSocket-based live progress updates
- Connection status indicators
- Automatic error handling and recovery

## 🛠️ Development

### Project Structure
```
├── dashboard/          # React frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── api/        # API client
│   │   └── lib/        # Utilities
├── server/             # Express backend
│   ├── routes/         # API routes
│   └── services/       # Processing services
└── start-dashboard.js  # Startup script
```

### Available Commands
```bash
# Development (both frontend and backend)
npm run dashboard:dev

# Backend only
npm run server:dev

# Frontend only  
npm run frontend:dev

# Production build
cd dashboard && npm run build
```

## 🔧 Troubleshooting

### Common Issues

1. **"Failed to connect" error**
   - Ensure the backend server is running on port 3001
   - Check if any other services are using port 3001

2. **"Python not found" error**
   - Install Python 3.6+ and ensure it's in your PATH
   - Try `py`, `python`, or `python3` commands in terminal

3. **"PyMuPDF not found" error**
   - Install PyMuPDF: `pip install PyMuPDF tqdm`

4. **Rate limiting during OCR**
   - This is normal - the system automatically handles rate limits
   - Wait for the processing to continue automatically

5. **Folder selection not working**
   - Use a modern browser that supports the File API
   - Ensure you're selecting a folder, not individual files

### Debugging

1. **Check server logs**: Look at the terminal running the backend server
2. **Check browser console**: Open DevTools (F12) and check for errors
3. **API health check**: Visit http://localhost:3001/api/health
4. **File permissions**: Ensure read/write access to project directories

## 📁 Directory Structure

The dashboard works with your existing directory structure:

- `1_New_File_Process_PDF_2_PNG/` - Input PDF files (copied from selected folder)
- `2_Converted_PNGs/` - Generated PNG images at 300 DPI
- `3_OCR_TXT_Files/` - Extracted text files and merged OCR files
- `logs/` - Processing logs and reports

## 🎯 Next Steps

1. **Process your PDFs**: Select a folder and run the pipeline
2. **Review results**: Check the generated text files
3. **Customize settings**: Modify `src/config.js` for OCR parameters
4. **Scale processing**: Adjust batch sizes and rate limiting in config

## 💡 Tips

- **Large batches**: For many files, monitor the rate limiting indicators
- **Quality check**: Review a few output files to ensure OCR accuracy
- **Backup originals**: Keep original PDFs safe before processing
- **Network stability**: Ensure stable internet for Google Lens OCR

---

🎉 **You're all set!** Start processing your PDFs with the new dashboard interface.