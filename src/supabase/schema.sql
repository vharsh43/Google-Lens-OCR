-- Supabase Schema for Train Ticket System
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pnr VARCHAR(10) UNIQUE NOT NULL,
  transaction_id VARCHAR(20),
  ticket_print_time TIMESTAMPTZ,
  payment JSONB,
  processing_info JSONB,
  source_file VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create journeys table
CREATE TABLE IF NOT EXISTS journeys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  train_number VARCHAR(10),
  train_name VARCHAR(100),
  class VARCHAR(5),
  quota VARCHAR(5),
  distance_km INTEGER,
  boarding_station VARCHAR(10),
  boarding_datetime TIMESTAMPTZ,
  destination_station VARCHAR(10),
  destination_datetime TIMESTAMPTZ,
  sequence INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create passengers table
CREATE TABLE IF NOT EXISTS passengers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  name VARCHAR(100),
  age INTEGER CHECK (age >= 0 AND age <= 120),
  gender VARCHAR(10),
  booking_status VARCHAR(50),
  current_status VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_pnr ON tickets(pnr);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passengers_name ON passengers(name);
CREATE INDEX IF NOT EXISTS idx_passengers_ticket_id ON passengers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_passengers_name_ticket ON passengers(ticket_id, name);
CREATE INDEX IF NOT EXISTS idx_journeys_ticket_id ON journeys(ticket_id);
CREATE INDEX IF NOT EXISTS idx_journeys_train_number ON journeys(train_number);
CREATE INDEX IF NOT EXISTS idx_journeys_sequence ON journeys(ticket_id, sequence);

-- Create composite indexes for search functionality
-- Note: Removed subquery-based index as PostgreSQL doesn't support subqueries in index predicates

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

-- Enable Row Level Security (RLS)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for your security requirements)
CREATE POLICY "Allow public read access on tickets" ON tickets
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert on tickets" ON tickets
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access on passengers" ON passengers
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert on passengers" ON passengers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access on journeys" ON journeys
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert on journeys" ON journeys
    FOR INSERT WITH CHECK (true);

-- Create a view for easy ticket lookup with passenger and journey info
CREATE OR REPLACE VIEW ticket_details AS
SELECT 
  t.id,
  t.pnr,
  t.transaction_id,
  t.ticket_print_time,
  t.payment,
  t.processing_info,
  t.source_file,
  t.created_at,
  json_agg(DISTINCT 
    json_build_object(
      'id', p.id,
      'name', p.name,
      'age', p.age,
      'gender', p.gender,
      'booking_status', p.booking_status,
      'current_status', p.current_status
    )
  ) AS passengers,
  json_agg(DISTINCT 
    json_build_object(
      'id', j.id,
      'train_number', j.train_number,
      'train_name', j.train_name,
      'class', j.class,
      'quota', j.quota,
      'distance_km', j.distance_km,
      'boarding_station', j.boarding_station,
      'boarding_datetime', j.boarding_datetime,
      'destination_station', j.destination_station,
      'destination_datetime', j.destination_datetime,
      'sequence', j.sequence
    ) ORDER BY j.sequence
  ) AS journeys
FROM tickets t
LEFT JOIN passengers p ON t.id = p.ticket_id
LEFT JOIN journeys j ON t.id = j.ticket_id
GROUP BY t.id, t.pnr, t.transaction_id, t.ticket_print_time, t.payment, 
         t.processing_info, t.source_file, t.created_at;

-- Create a function for searching tickets by PNR and passenger details
CREATE OR REPLACE FUNCTION search_tickets(
  search_pnr VARCHAR(10) DEFAULT NULL,
  search_passenger_name VARCHAR(100) DEFAULT NULL,
  search_passenger_age INTEGER DEFAULT NULL,
  age_tolerance INTEGER DEFAULT 2
)
RETURNS TABLE (
  ticket_id UUID,
  pnr VARCHAR(10),
  transaction_id VARCHAR(20),
  ticket_print_time TIMESTAMPTZ,
  payment JSONB,
  passengers JSONB,
  journeys JSONB,
  matched_passenger JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    td.id,
    td.pnr,
    td.transaction_id,
    td.ticket_print_time,
    td.payment,
    td.passengers,
    td.journeys,
    CASE 
      WHEN search_passenger_name IS NOT NULL THEN
        (SELECT json_build_object(
          'name', p.name,
          'age', p.age,
          'gender', p.gender,
          'booking_status', p.booking_status,
          'current_status', p.current_status
        ) FROM passengers p 
         WHERE p.ticket_id = td.id 
           AND p.name ILIKE '%' || search_passenger_name || '%'
           AND (search_passenger_age IS NULL OR 
                ABS(p.age - search_passenger_age) <= age_tolerance)
         LIMIT 1)
      ELSE NULL
    END as matched_passenger
  FROM ticket_details td
  WHERE 
    (search_pnr IS NULL OR td.pnr = search_pnr)
    AND (
      search_passenger_name IS NULL OR
      EXISTS (
        SELECT 1 FROM passengers p 
        WHERE p.ticket_id = td.id 
          AND p.name ILIKE '%' || search_passenger_name || '%'
          AND (search_passenger_age IS NULL OR 
               ABS(p.age - search_passenger_age) <= age_tolerance)
      )
    );
END;
$$ LANGUAGE plpgsql;

-- Create a function to get journey timeline for a PNR
CREATE OR REPLACE FUNCTION get_journey_timeline(search_pnr VARCHAR(10))
RETURNS TABLE (
  pnr VARCHAR(10),
  total_journeys INTEGER,
  timeline JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.pnr,
    COUNT(j.id)::INTEGER as total_journeys,
    json_agg(
      json_build_object(
        'sequence', j.sequence,
        'train_number', j.train_number,
        'train_name', j.train_name,
        'class', j.class,
        'quota', j.quota,
        'distance_km', j.distance_km,
        'boarding_station', j.boarding_station,
        'boarding_datetime', j.boarding_datetime,
        'destination_station', j.destination_station,
        'destination_datetime', j.destination_datetime
      ) ORDER BY j.sequence
    ) as timeline
  FROM tickets t
  JOIN journeys j ON t.id = j.ticket_id
  WHERE t.pnr = search_pnr
  GROUP BY t.pnr;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get database statistics
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE (
  total_tickets BIGINT,
  total_passengers BIGINT,
  total_journeys BIGINT,
  average_passengers_per_ticket NUMERIC,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM tickets) as total_tickets,
    (SELECT COUNT(*) FROM passengers) as total_passengers,
    (SELECT COUNT(*) FROM journeys) as total_journeys,
    (SELECT ROUND(AVG(passenger_count), 2) FROM (
      SELECT COUNT(p.id) as passenger_count 
      FROM tickets t 
      LEFT JOIN passengers p ON t.id = p.ticket_id 
      GROUP BY t.id
    ) as subq) as average_passengers_per_ticket,
    (SELECT ROUND(SUM(COALESCE((payment->>'total')::NUMERIC, 0)), 2) 
     FROM tickets WHERE payment IS NOT NULL) as total_revenue;
END;
$$ LANGUAGE plpgsql;

-- Sample data insertion (remove after testing)
-- INSERT INTO tickets (pnr, transaction_id, ticket_print_time, payment) VALUES
-- ('2341068596', '100006011771896', '2025-08-28 08:16:00+00', '{"total": 2676.68, "ticket_fare": 2610.00, "irctc_fee": 17.70}');

COMMENT ON TABLE tickets IS 'Main table storing train ticket information';
COMMENT ON TABLE passengers IS 'Passenger details for each ticket';
COMMENT ON TABLE journeys IS 'Journey segments for each ticket (supports multi-train trips)';
COMMENT ON VIEW ticket_details IS 'Complete ticket information with passengers and journeys';
COMMENT ON FUNCTION search_tickets IS 'Search tickets by PNR and passenger details with fuzzy matching';
COMMENT ON FUNCTION get_journey_timeline IS 'Get complete journey timeline for a PNR';
COMMENT ON FUNCTION get_database_stats IS 'Get aggregate statistics about the database';