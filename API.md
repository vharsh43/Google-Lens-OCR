# 🔌 Train Ticket OCR API Documentation

Complete API reference for the Train Ticket OCR system powered by Supabase.

## Overview

The system uses **Supabase's auto-generated REST API** (PostgREST) instead of a custom Express server. This provides:
- Automatic CRUD operations
- Advanced filtering and search
- Real-time subscriptions
- Built-in authentication and authorization
- Type-safe API with automatic OpenAPI documentation

## Base URL

```
https://your-project-id.supabase.co/rest/v1/
```

## Authentication

All requests require the `apikey` header:

```bash
curl -H "apikey: your-anon-key-here" \
     -H "Content-Type: application/json" \
     "https://your-project.supabase.co/rest/v1/tickets"
```

## Database Schema

### Tables Structure
```
tickets
├── id (uuid, primary key)
├── pnr (text, unique)
├── transaction_id (text)
├── ticket_print_time (timestamptz)
├── class (text)
├── payment (jsonb)
├── metadata (jsonb)
├── created_at (timestamptz)
└── updated_at (timestamptz)

passengers
├── id (uuid, primary key)
├── ticket_id (uuid, foreign key)
├── name (text)
├── age (integer)
├── gender (text)
├── current_status (text)
├── booking_status (text)
└── created_at (timestamptz)

journeys
├── id (uuid, primary key)
├── ticket_id (uuid, foreign key)
├── train_number (text)
├── train_name (text)
├── boarding_station (text)
├── boarding_datetime (timestamptz)
├── destination_station (text)
├── destination_datetime (timestamptz)
├── distance (integer)
├── duration_minutes (integer)
└── created_at (timestamptz)
```

---

## 📋 Core API Endpoints

### 1. Get All Tickets

```bash
GET /rest/v1/tickets
```

**Parameters:**
- `select` - Choose columns to return
- `limit` - Limit number of results
- `offset` - Pagination offset
- `order` - Sort results

**Example:**
```bash
curl "https://your-project.supabase.co/rest/v1/tickets?select=*&limit=10" \
  -H "apikey: your-anon-key"
```

**Response:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "pnr": "2341068596",
    "transaction_id": "100006011771896",
    "ticket_print_time": "2025-08-28T08:16:00+00:00",
    "class": "SL",
    "payment": {
      "total": 2676.68,
      "ticket_fare": 2610.00
    },
    "created_at": "2025-09-02T10:30:00+00:00"
  }
]
```

### 2. Search by PNR

```bash
GET /rest/v1/tickets?pnr=eq.{pnr_number}
```

**Example:**
```bash
curl "https://your-project.supabase.co/rest/v1/tickets?pnr=eq.2341068596&select=*,passengers(*),journeys(*)" \
  -H "apikey: your-anon-key"
```

### 3. Search by Passenger Name

```bash
GET /rest/v1/tickets?passengers.name=ilike.%{name}%
```

**Example:**
```bash
curl "https://your-project.supabase.co/rest/v1/tickets?passengers.name=ilike.%HITESH%&select=*,passengers(*),journeys(*)" \
  -H "apikey: your-anon-key"
```

### 4. Get Passengers for a Ticket

```bash
GET /rest/v1/passengers?ticket_id=eq.{ticket_id}
```

**Example:**
```bash
curl "https://your-project.supabase.co/rest/v1/passengers?ticket_id=eq.123e4567-e89b-12d3-a456-426614174000" \
  -H "apikey: your-anon-key"
```

### 5. Get Journeys for a Ticket

```bash
GET /rest/v1/journeys?ticket_id=eq.{ticket_id}
```

**Example:**
```bash
curl "https://your-project.supabase.co/rest/v1/journeys?ticket_id=eq.123e4567-e89b-12d3-a456-426614174000&order=boarding_datetime.asc" \
  -H "apikey: your-anon-key"
```

---

## 🔍 Advanced Search Operations

### Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `pnr=eq.2341068596` |
| `neq` | Not equals | `class=neq.SL` |
| `gt` | Greater than | `passengers.age=gt.18` |
| `lt` | Less than | `passengers.age=lt.60` |
| `gte` | Greater than or equal | `created_at=gte.2025-01-01` |
| `lte` | Less than or equal | `created_at=lte.2025-12-31` |
| `like` | Pattern match (case sensitive) | `passengers.name=like.%KUMAR%` |
| `ilike` | Pattern match (case insensitive) | `passengers.name=ilike.%kumar%` |
| `in` | In array | `class=in.(SL,3A,2A)` |
| `is` | Null check | `transaction_id=is.null` |

### Complex Queries

**Search by Date Range:**
```bash
GET /rest/v1/tickets?ticket_print_time=gte.2025-08-01&ticket_print_time=lte.2025-08-31
```

**Search by Train Number:**
```bash
GET /rest/v1/tickets?journeys.train_number=eq.20958&select=*,passengers(*),journeys(*)
```

**Search by Station:**
```bash
GET /rest/v1/tickets?journeys.boarding_station=eq.NDLS&select=*,passengers(*),journeys(*)
```

**Multi-criteria Search:**
```bash
GET /rest/v1/tickets?passengers.name=ilike.%HITESH%&journeys.train_number=eq.20958&class=eq.SL
```

---

## 📊 Custom Functions

### Get Ticket Statistics

```bash
GET /rest/v1/rpc/get_ticket_statistics
```

**Example:**
```bash
curl "https://your-project.supabase.co/rest/v1/rpc/get_ticket_statistics" \
  -H "apikey: your-anon-key"
```

**Response:**
```json
{
  "total_tickets": 150,
  "total_passengers": 420,
  "total_journeys": 180,
  "unique_trains": 45,
  "date_range": {
    "earliest_ticket": "2025-01-15T10:30:00Z",
    "latest_ticket": "2025-08-28T08:16:00Z"
  }
}
```

### Search Tickets with Passenger Details

```bash
POST /rest/v1/rpc/search_tickets_by_passenger
```

**Body:**
```json
{
  "search_pnr": "2341068596",
  "passenger_name": "HITESH",
  "passenger_age": 43
}
```

**Example:**
```bash
curl -X POST "https://your-project.supabase.co/rest/v1/rpc/search_tickets_by_passenger" \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"search_pnr": "2341068596", "passenger_name": "HITESH"}'
```

---

## 📝 Data Manipulation

### Insert New Ticket

```bash
POST /rest/v1/tickets
```

**Body:**
```json
{
  "pnr": "2341068596",
  "transaction_id": "100006011771896",
  "ticket_print_time": "2025-08-28T08:16:00Z",
  "class": "SL",
  "payment": {
    "total": 2676.68,
    "ticket_fare": 2610.00,
    "irctc_fee": 17.70
  }
}
```

**Example:**
```bash
curl -X POST "https://your-project.supabase.co/rest/v1/tickets" \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"pnr": "1234567890", "class": "3A"}'
```

### Insert Passenger

```bash
POST /rest/v1/passengers
```

**Body:**
```json
{
  "ticket_id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "JOHN DOE",
  "age": 35,
  "gender": "Male",
  "current_status": "CNF/B1/25/LOWER"
}
```

### Insert Journey

```bash
POST /rest/v1/journeys
```

**Body:**
```json
{
  "ticket_id": "123e4567-e89b-12d3-a456-426614174000",
  "train_number": "12345",
  "train_name": "EXAMPLE EXPRESS",
  "boarding_station": "DEL",
  "boarding_datetime": "2025-09-15T14:30:00Z",
  "destination_station": "MUM",
  "destination_datetime": "2025-09-16T08:15:00Z"
}
```

---

## 🔄 Batch Operations

### Bulk Insert (Upsert)

```bash
POST /rest/v1/tickets
```

**Headers:**
```
Prefer: resolution=merge-duplicates
```

**Body:** (Array of objects)
```json
[
  {
    "pnr": "1234567890",
    "class": "3A"
  },
  {
    "pnr": "0987654321", 
    "class": "2A"
  }
]
```

---

## 📱 Frontend Integration Examples

### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
)

// Search by PNR
const { data: tickets } = await supabase
  .from('tickets')
  .select(`
    *,
    passengers(*),
    journeys(*)
  `)
  .eq('pnr', '2341068596')

// Search by passenger name
const { data: results } = await supabase
  .from('tickets')
  .select(`
    *,
    passengers!inner(*),
    journeys(*)
  `)
  .ilike('passengers.name', '%HITESH%')

// Get statistics
const { data: stats } = await supabase
  .rpc('get_ticket_statistics')
```

### Python

```python
import requests

headers = {
    'apikey': 'your-anon-key',
    'Content-Type': 'application/json'
}

# Search by PNR
response = requests.get(
    'https://your-project.supabase.co/rest/v1/tickets',
    headers=headers,
    params={
        'pnr': 'eq.2341068596',
        'select': '*,passengers(*),journeys(*)'
    }
)

tickets = response.json()
```

### cURL Examples

**Get tickets with embedded relations:**
```bash
curl "https://your-project.supabase.co/rest/v1/tickets?select=*,passengers(*),journeys(*)&limit=5" \
  -H "apikey: your-anon-key"
```

**Count total tickets:**
```bash
curl "https://your-project.supabase.co/rest/v1/tickets?select=count" \
  -H "apikey: your-anon-key" \
  -H "Prefer: count=exact"
```

---

## 🚦 Rate Limiting

Supabase includes built-in rate limiting:
- **Free tier**: 500 requests per second
- **Pro tier**: 1000 requests per second
- **Enterprise**: Custom limits

Rate limit headers are returned in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1630000000
```

---

## 🔐 Security

### Row Level Security (RLS)

All tables have RLS enabled with policies that allow:
- Public read access to ticket data
- Restricted write access (service role only)

### API Key Types

1. **Anon Key**: Public, read-only access
2. **Service Role Key**: Full access, server-side only

---

## 📚 Additional Resources

- **Supabase Docs**: https://supabase.com/docs/guides/api
- **PostgREST API**: https://postgrest.org/en/stable/api.html
- **OpenAPI Spec**: `https://your-project.supabase.co/rest/v1/`
- **Real-time**: `wss://your-project.supabase.co/realtime/v1/websocket`

## 🔍 Interactive API Explorer

Visit your Supabase dashboard for an interactive API explorer:
```
https://your-project.supabase.co → API Docs
```

This provides a complete interface to test all endpoints with real data.