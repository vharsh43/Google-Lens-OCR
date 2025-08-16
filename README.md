# Bulk OCR Processor

A powerful Node.js application that processes JPG/PNG images in bulk using Google Lens OCR technology. Perfect for extracting text from images containing multiple languages including Hindi, Gujarati, Sanskrit, and other Indian languages.

## ✨ Features

- 🔍 **Bulk Processing**: Process hundreds of images automatically
- 📁 **Folder Structure Preservation**: Maintains exact folder hierarchy in output
- 🌐 **Multi-Language Support**: Supports 100+ languages including Hindi, Gujarati, Sanskrit
- 🚀 **Fast Processing**: Uses Google Lens API without headless browsers
- 📊 **Progress Tracking**: Real-time progress bars and detailed reports
- 🔄 **Error Recovery**: Automatic retry mechanism for failed operations
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

You can customize the behavior by editing `src/config.js`:

```javascript
export const config = {
  processing: {
    maxConcurrency: 3,        // Process 3 files simultaneously
    maxRetries: 2,           // Retry failed files 2 times
    timeout: 30000           // 30 second timeout per file
  },
  
  output: {
    includeMetadata: false,  // Clean text only (no headers)
    encoding: 'utf8'         // Support all languages
  }
};
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

After processing, you'll see a summary like:
```
📊 Processing Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Files: 25
Successful: 24
Failed: 1
Success Rate: 96%
Total Duration: 45.2s
Avg Time/File: 1.8s
```

## 🎯 Best Practices

1. **Image Quality**: Use clear, high-contrast images
2. **File Organization**: Organize files in logical folders before processing
3. **Batch Size**: For 100+ files, consider processing in smaller batches
4. **Backup**: Keep original images as backup
5. **Review**: Check output files for accuracy, especially for handwritten text

## 🤝 Contributing & Support

- **Issues**: Report bugs or request features
- **Code**: Fork and submit pull requests
- **Documentation**: Help improve this README

## 📄 License

MIT License - Use freely for personal and commercial projects.

---

**Made with ❤️ for multilingual OCR processing**