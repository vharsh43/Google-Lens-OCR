# Bulk OCR Processor

A powerful Node.js application that processes JPG/PNG images in bulk using Google Lens OCR technology. Perfect for extracting text from images containing multiple languages including Hindi, Gujarati, Sanskrit, and other Indian languages.

## ✨ Features

- 🔍 **Bulk Processing**: Process hundreds of images automatically
- 📁 **Folder Structure Preservation**: Maintains exact folder hierarchy in output
- 🌐 **Multi-Language Support**: Supports 100+ languages including Hindi, Gujarati, Sanskrit
- 🚀 **Optimized Speed**: 3-5x faster processing with intelligent rate management
- 🧠 **Dynamic Rate Adjustment**: Automatically optimizes processing speed based on performance
- ⚡ **Concurrent Processing**: Processes multiple files simultaneously while respecting rate limits
- 📊 **Progress Tracking**: Real-time progress bars and detailed reports
- 🔄 **Smart Error Recovery**: Automatic retry mechanism with exponential backoff
- 📝 **Smart Text Assembly**: Preserves paragraph structure and text flow
- 🎯 **Clean Output**: Text-only files without metadata headers

## 📋 Requirements

- **Node.js**: Version 14 or higher ([Download Node.js](https://nodejs.org/))
- **Internet Connection**: Required for Google Lens API access
- **Operating System**: Windows, macOS, or Linux

## 🚀 Quick Start

### 1. Download & Setup

**For Windows Users:**
```powershell
# Clone or download this repository
git clone https://github.com/vharsh43/Google-Lens-OCR
cd Google-Lens-OCR

# Install dependencies (Windows-specific fix)
npm install --include=optional sharp
npm install
```

**For macOS/Linux Users:**
```bash
# Clone or download this repository
git clone https://github.com/vharsh43/Google-Lens-OCR
cd Google-Lens-OCR

# Install dependencies
npm install
```

### 2. Add Your Images
Place your JPG/JPEG/PNG files in the `JPG2TXT` folder with any structure you want:
```
JPG2TXT/
├── documents/
│   ├── hindi-document.jpg
│   └── gujarati-text.jpg
├── books/
│   ├── chapter1/
│   │   └── page001.jpg
│   └── chapter2/
│       └── page001.jpg
└── receipts/
    └── receipt1.jpg
```

### 3. Run OCR Processing
```bash
# Process all images
npm start

# Test with first 3 files only
npm run test
```

### 4. Get Results
Find extracted text in `TXT_Files/` with the same folder structure:
```
TXT_Files/
├── documents/
│   ├── hindi-document.txt
│   └── gujarati-text.txt
├── books/
│   ├── chapter1/
│   │   └── page001.txt
│   └── chapter2/
│       └── page001.txt
└── receipts/
    └── receipt1.txt
```

## 📖 Detailed Usage

### Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Process all images in JPG2TXT folder |
| `npm run test` | Test mode - process only first 3 files |
| `npm run process` | Alternative command for processing |

### Supported File Types
- `.jpg` and `.jpeg` files
- `.png` files
- Any folder depth (unlimited nesting supported)

### Output Format
- **Clean text files**: Only extracted text, no metadata
- **Preserved formatting**: Maintains paragraph structure
- **Same folder structure**: Exact replica of input organization
- **UTF-8 encoding**: Supports all international characters

## ⚙️ Configuration

### 🧠 Intelligent Processing (Default - Recommended)

The system automatically optimizes processing speed:
- **Starts with**: 10 files per batch, 3-second delays
- **Scales up**: When success rate > 95% (faster processing)
- **Scales down**: When success rate < 80% (more reliable)
- **Learns**: Finds optimal settings for your system and internet speed

### 🔧 Manual Configuration

You can customize the behavior by editing `src/config.js`:

```javascript
export const config = {
  processing: {
    // Base settings (automatically optimized)
    batchSize: 10,             // Files per batch (dynamic)
    batchDelay: 3000,          // Delay between batches (dynamic)
    maxConcurrency: 3,         // Simultaneous file processing
    
    // Dynamic rate adjustment
    dynamicRateAdjustment: {
      enabled: true,           // Enable intelligent optimization
      maxBatchSize: 20,        // Maximum batch size allowed
      minBatchSize: 3,         // Minimum batch size allowed
      scaleUpThreshold: 0.95,  // Scale up when 95%+ success
      scaleDownThreshold: 0.80 // Scale down when <80% success
    },
    
    // Error handling
    maxRetries: 3,             // Retry failed files 3 times
    timeout: 45000             // 45 second timeout per file
  },
  
  output: {
    includeMetadata: false,    // Clean text only (no headers)
    encoding: 'utf8'           // Support all languages
  }
};
```

### 📈 Performance Modes

**Default Mode (Recommended)**:
```bash
npm start  # Automatic optimization enabled
```

**Conservative Mode**: Disable auto-optimization in config.js
```javascript
dynamicRateAdjustment: { enabled: false }
```

## 🌍 Language Support

**Confirmed Working Languages:**
- **Hindi** (हिंदी)
- **Gujarati** (ગુજરાતી) 
- **Sanskrit** (संस्कृत)
- **English**
- **Many others** (100+ languages supported by Google Lens)

**Auto-Detection**: The system automatically detects the language in each image.

## 📊 Sample Output

**Input Image**: `document.jpg` containing Gujarati text

**Output**: `TXT_Files/document.txt`
```
અ. ૧]
શ્રીમદ્ભાગવત-માહાત્મ્ય 3
મેનિરે ભગવદ્રૂપં શાસ્ત્ર ભાગવતં કલી !
પઠનાચ્છવણાત્સઘો વૈકુણ્ડફલદાયકમ્ ॥ ૨૦l સપ્તાહેન શ્રુતિં ચિતત્સર્વથા મુક્તિદાયકમ્
સનકાઃ પુરા પ્રોક્ત નારદાય દયાપરૈઃ ॥ ૨૧॥
```

*Notice how the text flows naturally, preserving paragraph structure.*

## 🧠 How Dynamic Optimization Works

The system includes an intelligent rate adjustment feature that maximizes processing speed while avoiding rate limits:

### 📊 Monitoring Phase
- **Tracks success rate** for every batch of files processed
- **Measures performance** over rolling windows (last 3 batches)
- **Detects rate limiting** automatically from API responses

### ⚡ Scaling Up (Better Performance)
When success rate > 95%:
- **Increases batch size** (more files per batch)
- **Reduces delays** (faster processing)
- **Maintains safety limits** (max 20 files per batch)

### 🛡️ Scaling Down (Better Reliability)  
When success rate < 80%:
- **Decreases batch size** (fewer files per batch)
- **Increases delays** (more conservative timing)
- **Prevents failures** from rate limiting

### 🎯 Console Output
Watch for these messages:
```bash
🧠 Dynamic rate adjustment enabled - will optimize processing speed automatically
🔄 Dynamic adjustment 1: Scaling UP (high success rate)
   Batch size: 10 → 15
   Batch delay: 3000ms → 2000ms
   Recent success rate: 98%
```

## 🔧 Troubleshooting

### ❌ "No files found to process"
**Solution**: 
- Place JPG/JPEG/PNG files in the `JPG2TXT` folder
- Check file extensions are supported (`.jpg`, `.jpeg`, `.png`)
- Ensure files aren't in hidden folders

### ❌ OCR Processing Fails
**Solution**:
- **Check internet connection** (Google Lens API requires internet)
- **Verify image quality** (blurry images may fail)
- **Check file size** (very large files may timeout)
- **Review error log**: Check `failed-files.log` for details

### ❌ Permission Errors
**Solution**:
- Run terminal/command prompt as administrator
- Check folder permissions for `TXT_Files` directory
- Ensure Node.js has write access to the project folder

### ❌ "npm install" fails
**Solution**:
- Update Node.js to version 14 or higher
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`, then retry `npm install`

### ❌ Windows: "Could not load the sharp module" Error
**Solution**:
```powershell
# Try these commands in order:
npm install --include=optional sharp
npm install --os=win32 --cpu=x64 sharp

# If still failing, clean reinstall:
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

**Alternative for Windows:**
- Install Visual Studio Build Tools
- Run PowerShell as Administrator
- Use `npm install --global windows-build-tools`

## 🖥️ System Requirements

| Component | Requirement |
|-----------|-------------|
| **Node.js** | Version 14.0+ |
| **RAM** | 512MB minimum |
| **Storage** | 100MB for program + space for output files |
| **Internet** | Required (Google Lens API) |
| **OS** | Windows 10+, macOS 10.14+, Ubuntu 18.04+ |

## 📋 Processing Statistics

After processing, you'll see a comprehensive summary:
```
📊 Processing Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Files: 50
Successful: 49
Failed: 1
Success Rate: 98%
Total Duration: 125.7s
Avg Time/File: 2.5s

🧠 Dynamic Rate Adjustment Stats:
Adjustments Made: 3
Final Batch Size: 15
Final Batch Delay: 2.0s
Throughput Improvement: +240% (estimated)

Output directory: /path/to/TXT_Files
```

### 🚀 Performance Improvements

**Before Optimization**: ~12 files/minute
**After Optimization**: ~75 files/minute (theoretical maximum)
**Typical Real-World**: 25-40 files/minute depending on:
- Image complexity
- Internet speed  
- System performance
- API response times

## 🎯 Best Practices

### 📸 Image Quality
1. **Clear Images**: Use high-contrast, well-lit images for best results
2. **Resolution**: 300+ DPI recommended, but system handles various sizes
3. **File Size**: Large files (>10MB) may process slower but are supported

### 🚀 Performance Optimization
4. **Let It Learn**: Allow the system to run for 15-20 files to optimize settings
5. **Monitor Output**: Watch for dynamic adjustment messages in console
6. **Internet Speed**: Stable internet improves processing consistency

### 📁 Organization & Workflow  
7. **Folder Structure**: Organize files logically before processing - output mirrors input
8. **Backup Originals**: Keep source images safe as processing is one-way
9. **Batch Processing**: System automatically handles large batches (100+ files)
10. **Review Results**: Verify text accuracy, especially for handwritten content

### ⚡ Troubleshooting Performance
- **Slow processing**: Check internet connection and let dynamic adjustment optimize
- **High failure rate**: System will automatically slow down and become more reliable
- **Inconsistent speed**: Normal - system adapts to current conditions

## 🤝 Contributing & Support

- **Issues**: Report bugs or request features
- **Code**: Fork and submit pull requests
- **Documentation**: Help improve this README

## 📄 License

MIT License - Use freely for personal and commercial projects.

---

**Made with ❤️ for multilingual OCR processing**