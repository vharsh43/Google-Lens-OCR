# 🚂 Train Ticket Search Frontend

A Next.js frontend application for searching and viewing train tickets processed through the Google Lens OCR system.

## Features

- **PNR Search**: Look up tickets by 10-digit PNR numbers
- **Passenger Search**: Find all tickets for a specific passenger
- **Advanced Search**: Filter by train numbers, dates, and multiple criteria
- **Real-time Statistics**: View system statistics and data insights
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Modern UI**: Clean, professional interface with Tailwind CSS

## Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Access to the Supabase project (from main OCR system)

### 2. Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Configure environment variables
# Edit .env.local with your Supabase credentials
```

### 3. Environment Configuration

Update `.env.local` with your Supabase project details:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Usage Examples

### PNR Search
```typescript
// Search for a specific PNR
const tickets = await TicketAPI.searchByPNR('2341068596');
```

### Passenger Search
```typescript
// Find all tickets for a passenger
const tickets = await TicketAPI.searchByPassengerName('HITESH');
```

### Advanced Search
```typescript
// Search with multiple criteria
const tickets = await TicketAPI.searchTickets({
  passengerName: 'HITESH',
  trainNumber: '20958',
  fromDate: '2025-08-01',
  toDate: '2025-08-31'
});
```

## Integration with OCR System

This frontend connects to your Supabase database using the same schema as the OCR processing system:

1. **Data Flow**: OCR system processes PDFs → Supabase → Frontend displays
2. **Real-time Updates**: New tickets appear immediately after processing
3. **Search Index**: Leverages PostgreSQL's full-text search capabilities

The frontend provides a complete interface for accessing and searching train ticket data processed by the OCR system.