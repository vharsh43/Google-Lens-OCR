1) Convert PDFs to PNGs only
npm run pdf2png

2) Run OCR on existing PNGs
npm start

3) Merge txt files into `_OCR.txt` files
npm run merge

# Google Lens OCR Pipeline

Convert PDFs to text using Google Lens OCR.

## Quick Start

### Prerequisites
- **Node.js 16+**
- **Python 3.6+** 
- **Internet connection**

### Installation
```bash
npm install
pip install PyMuPDF tqdm
```

### Usage

1. Place PDF files in `1_New_File_Process_PDF_2_PNG/`
2. Run: `npm run pipeline`
3. Find text files in `3_OCR_TXT_Files/`

### Commands
| Command | Description |
|---------|-------------|
| `npm run pipeline` | Complete PDF to text conversion |
| `npm run pdf2png` | Convert PDFs to PNGs only |
| `npm start` | Run OCR on existing PNGs |
| `npm run merge` | Merge txt files into `_OCR.txt` files |

### Folder Structure
```
1_New_File_Process_PDF_2_PNG/    # Input PDFs
2_Converted_PNGs/                # Generated PNGs (300 DPI)
3_OCR_TXT_Files/                 # Extracted text files
```

### New Workflow (Separate Merging)

**Before:**
- `npm start` → OCR + automatic merging

**Now:**
- `npm start` → OCR only
- Manually delete unwanted txt files
- `npm run merge` → Create merged `_OCR.txt` files

This allows you to clean up individual txt files before merging.