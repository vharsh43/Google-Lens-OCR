# Google Lens OCR Pipeline

Convert PDFs to text using high-quality PNG conversion (300 DPI) and Google Lens OCR.

## Quick Start

### Prerequisites
- **Node.js 16+**
- **Python 3.6+** 
- **Internet connection** (for Google Lens OCR)

### Installation
```bash
# Install Node dependencies
npm install

# Install Python dependencies
pip install PyMuPDF tqdm
```

### Usage

#### Full Pipeline (PDF → PNG → Text)
1. Place PDF files in `1_New_File_Process_PDF_2_PNG/`
2. Run: `npm run pipeline`
3. Find text files in `3_OCR_TXT_Files/`

#### Individual Steps
- **PDF to PNG only:** `npm run pdf2png`
- **OCR only:** `npm start` (processes PNGs in `2_Converted_PNGs/`)

### Folder Structure
```
Google-Lens-OCR/
├── 1_New_File_Process_PDF_2_PNG/    # Input PDFs
├── 2_Converted_PNGs/                # Generated PNGs (300 DPI)
├── 3_OCR_TXT_Files/                 # Extracted text with merged files
├── src/                             # Source code
├── PDF_2_PNG.py                     # PDF to PNG converter
├── pipeline.js                      # Main pipeline script
└── package.json
```

### Scripts
| Command | Description |
|---------|-------------|
| `npm run pipeline` | Complete PDF to text conversion |
| `npm run pdf2png` | Convert PDFs to PNGs only |
| `npm start` | Run OCR on existing PNGs |

### Configuration
Edit `src/config.js` to adjust:
- Batch size and processing delays
- OCR retry settings and timeouts
- Output file options
- Rate limiting parameters

### Features
- **High Quality:** 300 DPI PNG conversion
- **Smart Processing:** Automatic rate limiting and retry logic
- **Folder Structure Preservation:** Maintains original PDF organization
- **Merged Files:** Generates consolidated `_OCR.txt` files per folder
- **Progress Tracking:** Real-time progress bars and detailed logging
- **Error Handling:** Robust error recovery with exponential backoff

### Troubleshooting

**Python Issues:**
```bash
# Check Python installation
python3 --version
pip install PyMuPDF tqdm
```

**Rate Limiting:**
- The system automatically handles Google API rate limits
- Adjust delays in `src/config.js` if needed

**No Output Files:**
- Verify internet connection
- Check PDF files are in correct input folder
- Review console output for specific errors

### Performance Tips
- Process large batches during off-peak hours
- Adjust `maxConcurrency` in config for your system
- Monitor rate limiting messages and adjust delays accordingly

---

For detailed workflow information, see `PIPELINE_GUIDE.md`