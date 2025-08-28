# Google Lens OCR Pipeline

Convert PDFs to text using high-quality PNG conversion (300 DPI) and Google Lens OCR with a modern web dashboard.

## 🚀 Quick Start (Docker - Recommended)

**The easiest way to run this project is using Docker - works on any operating system!**

### Prerequisites
- **Docker Desktop** (only requirement!)
- **Internet connection** (for Google Lens OCR)

### One-Command Setup

**For macOS/Linux:**
```bash
# Clone the repository
git clone https://github.com/vharsh43/Google-Lens-OCR
cd Google-Lens-OCR

# Start everything with Docker
docker-compose up --build
```

**For Windows:**
```powershell
# Clone the repository
git clone https://github.com/vharsh43/Google-Lens-OCR
cd Google-Lens-OCR

# Start with Windows-optimized build
docker-compose -f docker-compose.windows.yml up --build
```

**That's it!** The system will:
- ✅ Install all dependencies automatically
- ✅ Start the server on port 3003
- ✅ Start the dashboard on port 3333
- ✅ Work on Windows, macOS, and Linux identically

### Access the Application
- **🎨 Dashboard**: http://localhost:3333
- **🔗 API**: http://localhost:3003/api
- **💚 Health Check**: http://localhost:3003/api/health

---

## 🛠️ Manual Setup (Alternative)

If you prefer running without Docker:

### Prerequisites
- **Node.js 16+**
- **Python 3.6+** 
- **Internet connection** (for Google Lens OCR)

### Installation
```bash
# Install Node dependencies
npm install
cd server && npm install
cd ../dashboard && npm install
cd ..

# Install Python dependencies
pip install PyMuPDF tqdm
```

### Start Services
```bash
# Start the dashboard (runs both server and frontend)
npm run dashboard:dev
```

---

## 📖 Usage

### With Docker (Web Dashboard)
1. Start the application: `docker-compose up --build`
2. Open the dashboard: http://localhost:3333
3. Use the web interface to:
   - Upload PDFs or select a folder
   - Start PDF to PNG conversion
   - Run OCR processing
   - View progress and download results

### Manual Processing (Command Line)
```bash
#### Full Pipeline (PDF → PNG → Text)
1. Place PDF files in `1_New_File_Process_PDF_2_PNG/`
2. Run: `npm run pipeline`
3. Find text files in `3_OCR_TXT_Files/`

#### Individual Steps
- **PDF to PNG only:** `npm run pdf2png`
- **OCR only:** `npm start` (processes PNGs in `2_Converted_PNGs/`)
```

### Folder Structure
```
Google-Lens-OCR/
├── 1_New_File_Process_PDF_2_PNG/    # Input PDFs
├── 2_Converted_PNGs/                # Generated PNGs (300 DPI)
├── 3_OCR_TXT_Files/                 # Extracted text with merged files
├── dashboard/                       # React web dashboard
│   ├── src/                        # Dashboard source code
│   └── dist/                       # Built dashboard (production)
├── server/                          # Express API server
│   ├── routes/                     # API endpoints
│   └── services/                   # Business logic
├── src/                             # Core OCR processing
├── logs/                           # Application logs
├── PDF_2_PNG.py                    # PDF to PNG converter
├── pipeline.js                     # Main pipeline script
├── Dockerfile                      # Docker configuration
├── docker-compose.yml              # Docker orchestration
└── package.json                    # Node.js dependencies
```

## 🐳 Docker Commands

### Basic Usage
```bash
# Start everything
docker-compose up --build

# Run in background
docker-compose up -d --build

# Stop services
docker-compose down

# View logs
docker-compose logs -f
```

### Development
```bash
# Rebuild after code changes
docker-compose up --build

# Force rebuild (no cache)
docker-compose build --no-cache

# Access container shell
docker-compose exec google-lens-ocr bash
```

### Scripts (Manual Setup)
| Command | Description |
|---------|-------------|
| `npm run dashboard:dev` | Start web dashboard + server |
| `npm run pipeline` | Complete PDF to text conversion |
| `npm run pdf2png` | Convert PDFs to PNGs only |
| `npm start` | Run OCR on existing PNGs |

### Configuration
Edit `src/config.js` to adjust:
- Batch size and processing delays
- OCR retry settings and timeouts
- Output file options
- Rate limiting parameters

## ✨ Features

### Core Pipeline
- **🎯 High Quality:** 300 DPI PNG conversion using PyMuPDF
- **🧠 Smart Processing:** Automatic rate limiting and retry logic
- **📁 Structure Preservation:** Maintains original PDF folder organization
- **📝 Merged Files:** Generates consolidated `_OCR.txt` files per folder
- **📊 Progress Tracking:** Real-time progress bars and detailed logging
- **🛡️ Error Handling:** Robust error recovery with exponential backoff

### Web Dashboard
- **🎨 Modern UI:** Clean, responsive React dashboard
- **📤 File Upload:** Drag-and-drop or folder selection
- **⚡ Real-time Updates:** Live progress tracking via WebSocket
- **🔧 Easy Management:** Clear files, view statistics, manage pipeline
- **📱 Cross-platform:** Works on any device with a web browser

### Docker Integration
- **🐳 One-Command Setup:** Complete environment with `docker-compose up`
- **🔄 Cross-platform:** Identical experience on Windows/macOS/Linux
- **📦 Zero Dependencies:** Only Docker Desktop required
- **💾 Data Persistence:** Processing directories preserved between runs

## 🔧 Troubleshooting

### Docker Issues

**General Docker Problems:**
```bash
# Check if Docker is running
docker --version
docker-compose --version

# View detailed logs
docker-compose logs -f

# Restart with fresh build
docker-compose down
docker-compose up --build --no-cache
```

**Windows-Specific Issues:**

If you encounter network/download errors on Windows:
```powershell
# Use the Windows-optimized version
docker-compose -f docker-compose.windows.yml up --build

# If still having issues, try with different network settings
docker-compose -f docker-compose.windows.yml down
docker-compose -f docker-compose.windows.yml up --build --force-recreate
```

Common Windows fixes:
- **WSL2 Backend**: Ensure Docker Desktop is using WSL2 backend
- **Firewall**: Temporarily disable Windows Firewall during build
- **Antivirus**: Add Docker Desktop to antivirus exclusions
- **Network**: If on corporate network, configure proxy settings in Docker Desktop

### Manual Setup Issues
**Python Issues:**
```bash
# Check Python installation
python3 --version
pip install PyMuPDF tqdm
```

**Port Conflicts:**
- Default ports: 3003 (server), 3333 (dashboard)
- Change ports in `docker-compose.yml` if needed

**Rate Limiting:**
- The system automatically handles Google API rate limits
- Adjust delays in `src/config.js` if needed

**No Output Files:**
- Verify internet connection for Google Lens OCR
- Check PDF files are in correct input folder
- Review dashboard logs or console output

### Performance Tips
- Process large batches during off-peak hours
- Adjust `maxConcurrency` in config for your system
- Monitor rate limiting messages and adjust delays accordingly
- Use Docker for consistent performance across environments

## 📚 Additional Resources

- **[Docker Setup Guide](DOCKER_SETUP.md)** - Detailed Docker usage and troubleshooting
- **[Pipeline Guide](PIPELINE_GUIDE.md)** - Detailed workflow information
- **[Dashboard Setup](DASHBOARD_SETUP.md)** - Web dashboard configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes
4. Test with Docker: `docker-compose up --build`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

🚀 **Ready to get started?** Just run `docker-compose up --build` and open http://localhost:3333!