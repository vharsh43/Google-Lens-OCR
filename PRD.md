Project: Train Ticket OCR → MongoDB Atlas → Passenger Info Web-App
1. Overview

We want to build an end-to-end system where train ticket PDFs are uploaded, processed with OCR, and all structured information is extracted into MongoDB Atlas. A passenger-facing web-app will allow passengers to enter their PNR and name/age to look up their journey details (including multiple connecting trains if present).

2. Objectives

Automate OCR extraction from IRCTC e-tickets (PDF format).

Parse and normalize ticket data into a standard JSON schema.

Store ticket data into MongoDB Atlas.

Provide a web-app for passengers to retrieve their train information using PNR + Name/Age.

Support journeys with single trains and multiple connecting trains.

3. Functional Requirements
3.1 OCR & Parsing

Convert PDF pages → images (using pdf2image or similar).

Process images via Google Lens OCR (or Google Vision API).

Extract key fields:

PNR Number

Train Number & Train Name

Boarding Station (Code, Name, Date-Time)

Destination Station (Code, Name, Date-Time)

Class, Quota, Distance (KM)

Ticket Printing Time

Transaction ID

Passenger Details (Name, Age, Gender, Booking Status, Current Status, Berth Info)

Payment Details (Fare, IRCTC Fee, Insurance, Agent Fee, PG Charges, Total Fare)

3.2 Data Normalization

Clean OCR results with regex and rule-based mapping.

Convert all times to ISO8601 (YYYY-MM-DDTHH:mm:ss) format.

Store passenger data as array of objects.

If multiple connecting trains exist, store under a journeys[] array.

3.3 MongoDB Atlas Schema
{
  "pnr": "2341068596",
  "transaction_id": "100006011771896",
  "ticket_print_time": "2025-08-28T08:16:00",
  "journeys": [
    {
      "train_number": "20958",
      "train_name": "INDORE EXPRESS",
      "class": "SL",
      "quota": "GN",
      "distance_km": 731,
      "boarding": { "station": "NDLS", "datetime": "2025-10-27T19:15:00" },
      "destination": { "station": "RTM", "datetime": "2025-10-28T04:10:00" }
    }
  ],
  "passengers": [
    { "name": "HITESH", "age": 43, "gender": "Male", "booking_status": "CNF/S4/1/LOWER", "current_status": "CNF/S4/1/LOWER" },
    { "name": "HARSHA", "age": 42, "gender": "Female", "booking_status": "CNF/S4/4/LOWER", "current_status": "CNF/S4/4/LOWER" },
    { "name": "PAL", "age": 14, "gender": "Male", "booking_status": "CNF/S4/2/MIDDLE", "current_status": "CNF/S4/2/MIDDLE" }
  ],
  "payment": {
    "ticket_fare": 2610.00,
    "irctc_fee": 17.70,
    "insurance": 2.70,
    "agent_fee": 20.00,
    "pg_charges": 26.28,
    "total": 2676.68
  }
}

4. API Requirements
4.1 Endpoints

POST /uploadTicket → Upload PDF, run OCR, store into MongoDB.

GET /getTicket?pnr=xxxx&name=xxxx → Retrieve ticket details by PNR + passenger name/age.

GET /getJourneyTimeline?pnr=xxxx → Get journey timeline (all trains in sequence).

5. Web-App Requirements

Frontend: Next.js (React) or Flask template.

Search Page:

Input: PNR + Passenger Name or Age.

Output: Passenger details + Train details + Journey timeline.

UI Features:

Multiple train segments displayed in order.

Highlight passenger’s berth/class allocation.

Fare breakdown displayed.

6. Tech Stack

OCR: Google Lens OCR / Google Cloud Vision API.

Backend: Python (FastAPI or Flask).

Database: MongoDB Atlas.

Frontend: Next.js (React) or Flask-React Hybrid.

Deployment:

Backend on Render/Heroku.

Frontend on Vercel.

MongoDB Atlas for data persistence.

7. Edge Cases

Multiple connecting trains in one journey.

PNR shared by multiple passengers.

OCR misreads (fallback: manual correction UI for admin).

Cancelled tickets (status should be stored as CANCELLED).

8. Deliverables

Python OCR + Parser service → Upload PDF → Extract JSON → Save in MongoDB.

API service → Fetch passenger/train details by PNR + Name/Age.

Web-App → Passenger-facing search UI.

Deployment setup → CI/CD pipeline with MongoDB Atlas.