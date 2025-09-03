-- Migration to fix missing columns in existing Supabase tables
-- Run this in your Supabase SQL Editor

-- Add missing columns to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS processing_info JSONB;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source_file VARCHAR(255);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to journeys table (if they don't exist)
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS class VARCHAR(5);
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS quota VARCHAR(5);
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS distance_km INTEGER;
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS boarding_station VARCHAR(10);
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS boarding_datetime TIMESTAMPTZ;
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS destination_station VARCHAR(10);
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS destination_datetime TIMESTAMPTZ;
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS sequence INTEGER DEFAULT 1;

-- Add missing columns to passengers table (if they don't exist)
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age >= 0 AND age <= 120);
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS booking_status VARCHAR(50);
ALTER TABLE passengers ADD COLUMN IF NOT EXISTS current_status VARCHAR(50);

-- Create indexes that were missing
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passengers_name ON passengers(name);
CREATE INDEX IF NOT EXISTS idx_passengers_ticket_id ON passengers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_passengers_name_ticket ON passengers(ticket_id, name);
CREATE INDEX IF NOT EXISTS idx_journeys_ticket_id ON journeys(ticket_id);
CREATE INDEX IF NOT EXISTS idx_journeys_train_number ON journeys(train_number);
CREATE INDEX IF NOT EXISTS idx_journeys_sequence ON journeys(ticket_id, sequence);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
SELECT 'Migration completed successfully! All missing columns and indexes have been added.' as result;