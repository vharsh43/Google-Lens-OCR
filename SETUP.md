# 🚂 Train Ticket OCR System - Setup Guide

Complete setup guide for the enhanced train ticket processing system with Supabase integration.

## 📋 Prerequisites

- **Node.js 16+** (Download from [nodejs.org](https://nodejs.org))
- **Python 3.6+** (Download from [python.org](https://python.org))
- **Internet connection** (Required for Google Lens OCR)
- **Supabase account** (Free at [supabase.com](https://supabase.com))

## 🚀 Quick Setup (10 minutes)

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd Google-Lens-OCR

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install PyMuPDF tqdm
```

### Step 2: Supabase Cloud Setup

1. **Create Supabase Account**
   - Visit [supabase.com](https://supabase.com)
   - Sign up for free (no credit card required)
   - Click "New Project"

2. **Create Project**
   - Choose organization (or create one)
   - Enter project name: `train-ticket-ocr`
   - Enter database password (save this!)
   - Select region closest to you
   - Click "Create new project" (takes ~2 minutes)

3. **Get Connection Details**
   - Go to Project → Settings → API
   - Copy the **Project URL** and **anon/public key**

### Step 3: Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env file and add your Supabase details:
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 4: Database Schema Setup

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Click "SQL Editor" in the sidebar

2. **Run Schema**
   - Copy contents of `src/supabase/schema.sql`
   - Paste into SQL Editor
   - Click "Run" to create tables and functions

### Step 5: Test Connection

```bash
# Test Supabase connection
npm run db-test

# Should show: ✅ Supabase connection successful!
```

## 📁 Folder Structure

```
Google-Lens-OCR/
├── 1_Ticket_PDF/           # Place your train ticket PDFs here
├── 2_Converted_PNGs/       # Generated PNG files (300 DPI)  
├── 3_OCR_TXT_Files/        # OCR text and structured JSON files
├── src/
│   ├── supabase/           # Supabase integration
│   │   ├── client.js       # Connection client
│   │   ├── operations.js   # Database operations
│   │   └── schema.sql      # Database schema
│   ├── ticket-parser.js    # IRCTC ticket parser
│   └── ...                 # Other processing files
├── reports/                # Generated reports
├── logs/                   # Processing logs
└── .env                    # Your configuration
```

## 🎯 Usage

### Basic Processing

1. **Add Tickets**
   ```bash
   # Place PDF files in:
   1_Ticket_PDF/
   ```

2. **Run Complete Pipeline**
   ```bash
   # Process everything: PDF → PNG → OCR → Parse → Supabase
   npm run pipeline
   ```

3. **View Results**
   ```bash
   # Check database statistics
   npm run db-stats
   
   # Search for specific ticket
   npm run db-search 2341068596
   
   # Search with passenger details
   npm run db-search 2341068596 HITESH 43
   ```

### Advanced Commands

```bash
# Individual stages
npm run pdf2png              # PDF to PNG only
npm run train-tickets        # OCR + parsing + Supabase import
npm run train-tickets-test   # Test with first 3 files

# Database operations
npm run db-import            # Import existing JSON files
npm run db-timeline <PNR>    # View journey timeline
npm run supabase             # Show all available commands

# Testing and debugging
npm run db-test              # Test connection
npm test                     # Process 3 files only
```

## 📊 Understanding Output

### File Types Generated

- `*.txt` - Raw OCR text from Google Lens
- `*_structured.json` - Parsed ticket data (PRD schema compliant)
- `*_debug.json` - Failed parsing attempts with error details

### Supabase Dashboard

- **Tables**: View all tickets, passengers, journeys
- **SQL Editor**: Run custom queries
- **API Docs**: Auto-generated REST API documentation
- **Auth**: User management (for future frontend)

### Sample JSON Structure

```json
{
  "pnr": "2341068596",
  "transaction_id": "100006011771896",
  "ticket_print_time": "2025-08-28T08:16:00",
  "journeys": [
    {
      "train_number": "20958",
      "train_name": "INDORE EXPRESS",
      "boarding": {
        "station": "NDLS",
        "datetime": "2025-10-27T19:15:00"
      },
      "destination": {
        "station": "RTM", 
        "datetime": "2025-10-28T04:10:00"
      }
    }
  ],
  "passengers": [
    {
      "name": "HITESH",
      "age": 43,
      "gender": "Male",
      "current_status": "CNF/S4/1/LOWER"
    }
  ],
  "payment": {
    "total": 2676.68,
    "ticket_fare": 2610.00
  }
}
```

## 🔧 Troubleshooting

### Common Issues

**1. "SUPABASE_URL not found"**
```bash
# Solution: Check .env file exists and has correct values
cp .env.example .env
# Edit .env with your Supabase project details
```

**2. "PyMuPDF not found"**
```bash
# Solution: Install Python dependencies
pip install PyMuPDF tqdm
```

**3. "No PDF files found"**
```bash
# Solution: Check PDF location
ls 1_Ticket_PDF/
# Make sure PDFs are directly in this folder
```

**4. "Parsing failed"**
- Check if PDFs are IRCTC train tickets
- Ensure good image quality (not scanned/photographed)
- Review `*_debug.json` files for specific errors

**5. "Rate limit exceeded"**
- Google Lens has rate limits
- System automatically adjusts processing speed
- For large batches, processing may take longer

### Performance Tips

- **Start small**: Use `npm run train-tickets-test` for first run
- **Check logs**: Review `logs/PipelineLog.txt` for detailed info
- **Monitor progress**: Pipeline shows real-time progress updates
- **Batch processing**: System automatically handles rate limiting

## 🌐 API Usage

Once data is imported to Supabase, REST APIs are automatically available:

### Direct API Calls

```bash
# Get all tickets
curl "https://your-project.supabase.co/rest/v1/tickets" \
  -H "apikey: your-anon-key"

# Search by PNR
curl "https://your-project.supabase.co/rest/v1/tickets?pnr=eq.2341068596" \
  -H "apikey: your-anon-key"

# Get passengers for a ticket
curl "https://your-project.supabase.co/rest/v1/passengers?ticket_id=eq.TICKET_ID" \
  -H "apikey: your-anon-key"
```

### JavaScript/TypeScript Usage

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
)

// Search tickets
const { data: tickets } = await supabase
  .from('tickets')
  .select(`
    *,
    passengers(*),
    journeys(*)
  `)
  .eq('pnr', '2341068596')
```

## 🎉 Next Steps

After successful setup:

1. **Process some tickets** to test the system
2. **Explore Supabase dashboard** to see your data
3. **Build frontend application** using the REST APIs
4. **Set up authentication** for passenger access
5. **Deploy to production** using the generated APIs

## 📞 Support

For issues:
1. Check logs in `logs/` directory
2. Review generated reports in `reports/` directory
3. Test connection with `npm run db-test`
4. Check Supabase project status in dashboard

The system is designed to be robust and handle various edge cases, but if you encounter issues, the extensive logging will help identify the problem.