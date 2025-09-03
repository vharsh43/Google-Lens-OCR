-- Enhanced Supabase Schema for Multi-Ticket Train System
-- Supports passenger linking, journey connections, and timeline tracking
-- Run this in your Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Drop existing tables if they exist (for fresh setup)
DROP TABLE IF EXISTS journey_connections CASCADE;
DROP TABLE IF EXISTS ticket_groups CASCADE;
DROP TABLE IF EXISTS passenger_profiles CASCADE;
DROP VIEW IF EXISTS ticket_details CASCADE;

-- =============================================
-- ENHANCED PASSENGERS TABLE WITH PROFILES
-- =============================================

-- Create passenger profiles for unique identification
CREATE TABLE IF NOT EXISTS passenger_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  age INTEGER CHECK (age >= 0 AND age <= 120),
  gender VARCHAR(15) CHECK (gender IN ('Male', 'Female', 'Transgender')),
  -- Composite unique constraint for name + age combination
  CONSTRAINT unique_passenger_profile UNIQUE (name, age),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update passengers table to reference profiles
ALTER TABLE passengers 
ADD COLUMN IF NOT EXISTS passenger_profile_id UUID REFERENCES passenger_profiles(id);

-- =============================================
-- TICKET GROUPS FOR CONNECTED JOURNEYS
-- =============================================

-- Create ticket groups to link multiple tickets for same journey
CREATE TABLE IF NOT EXISTS ticket_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_name VARCHAR(200), -- e.g., "Delhi to Mumbai via Jhansi"
  total_tickets INTEGER DEFAULT 1,
  total_passengers INTEGER DEFAULT 1,
  journey_start_station VARCHAR(10),
  journey_end_station VARCHAR(10),
  journey_start_time TIMESTAMPTZ,
  journey_end_time TIMESTAMPTZ,
  total_distance_km INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add group reference to tickets
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS ticket_group_id UUID REFERENCES ticket_groups(id),
ADD COLUMN IF NOT EXISTS sequence_in_group INTEGER DEFAULT 1;

-- =============================================
-- JOURNEY CONNECTIONS FOR MULTI-TRAIN TRIPS
-- =============================================

-- Create journey connections to link connecting trains
CREATE TABLE IF NOT EXISTS journey_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  from_journey_id UUID REFERENCES journeys(id) ON DELETE CASCADE,
  to_journey_id UUID REFERENCES journeys(id) ON DELETE CASCADE,
  connection_station VARCHAR(10), -- Where the connection happens
  layover_minutes INTEGER, -- Time between trains
  connection_type VARCHAR(20) DEFAULT 'direct' CHECK (connection_type IN ('direct', 'transfer', 'overnight')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ENHANCED INDEXES FOR PERFORMANCE
-- =============================================

-- Passenger profile indexes
CREATE INDEX IF NOT EXISTS idx_passenger_profiles_name ON passenger_profiles(name);
CREATE INDEX IF NOT EXISTS idx_passenger_profiles_name_age ON passenger_profiles(name, age);
CREATE INDEX IF NOT EXISTS idx_passengers_profile_id ON passengers(passenger_profile_id);

-- Ticket group indexes
CREATE INDEX IF NOT EXISTS idx_tickets_group_id ON tickets(ticket_group_id);
CREATE INDEX IF NOT EXISTS idx_ticket_groups_journey_stations ON ticket_groups(journey_start_station, journey_end_station);
CREATE INDEX IF NOT EXISTS idx_ticket_groups_start_time ON ticket_groups(journey_start_time);

-- Journey connection indexes
CREATE INDEX IF NOT EXISTS idx_journey_connections_from ON journey_connections(from_journey_id);
CREATE INDEX IF NOT EXISTS idx_journey_connections_to ON journey_connections(to_journey_id);
CREATE INDEX IF NOT EXISTS idx_journey_connections_station ON journey_connections(connection_station);

-- Enhanced journey indexes
CREATE INDEX IF NOT EXISTS idx_journeys_stations ON journeys(boarding_station, destination_station);
CREATE INDEX IF NOT EXISTS idx_journeys_datetime_range ON journeys(boarding_datetime, destination_datetime);

-- =============================================
-- STORED PROCEDURES FOR PASSENGER LINKING
-- =============================================

-- Function to get or create passenger profile
CREATE OR REPLACE FUNCTION get_or_create_passenger_profile(
  p_name VARCHAR(100),
  p_age INTEGER,
  p_gender VARCHAR(15) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  profile_id UUID;
BEGIN
  -- Try to find existing profile
  SELECT id INTO profile_id 
  FROM passenger_profiles 
  WHERE name = p_name AND age = p_age;
  
  -- If not found, create new profile
  IF profile_id IS NULL THEN
    INSERT INTO passenger_profiles (name, age, gender)
    VALUES (p_name, p_age, p_gender)
    RETURNING id INTO profile_id;
  ELSE
    -- Update gender if provided and currently NULL
    IF p_gender IS NOT NULL THEN
      UPDATE passenger_profiles 
      SET gender = COALESCE(gender, p_gender), updated_at = NOW()
      WHERE id = profile_id;
    END IF;
  END IF;
  
  RETURN profile_id;
END;
$$ LANGUAGE plpgsql;

-- Function to link passengers to profiles automatically
CREATE OR REPLACE FUNCTION link_passenger_to_profile() RETURNS TRIGGER AS $$
BEGIN
  -- Get or create passenger profile
  NEW.passenger_profile_id = get_or_create_passenger_profile(
    NEW.name, 
    NEW.age, 
    NEW.gender
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically link passengers to profiles
DROP TRIGGER IF EXISTS passenger_profile_trigger ON passengers;
CREATE TRIGGER passenger_profile_trigger
  BEFORE INSERT OR UPDATE ON passengers
  FOR EACH ROW
  EXECUTE FUNCTION link_passenger_to_profile();

-- =============================================
-- JOURNEY GROUPING AND CONNECTION FUNCTIONS
-- =============================================

-- Function to detect and create ticket groups for connected journeys
CREATE OR REPLACE FUNCTION create_ticket_groups() RETURNS VOID AS $$
DECLARE
  ticket_record RECORD;
  group_id UUID;
BEGIN
  -- Find tickets that should be grouped (same passengers, connected journeys)
  FOR ticket_record IN
    SELECT DISTINCT t1.id as ticket1_id, t2.id as ticket2_id,
           t1.pnr as pnr1, t2.pnr as pnr2
    FROM tickets t1
    JOIN tickets t2 ON t1.id < t2.id
    JOIN passengers p1 ON p1.ticket_id = t1.id
    JOIN passengers p2 ON p2.ticket_id = t2.id
    JOIN journeys j1 ON j1.ticket_id = t1.id
    JOIN journeys j2 ON j2.ticket_id = t2.id
    WHERE p1.passenger_profile_id = p2.passenger_profile_id
    AND j1.destination_station = j2.boarding_station
    AND j2.boarding_datetime > j1.destination_datetime
    AND j2.boarding_datetime - j1.destination_datetime <= INTERVAL '24 hours'
    AND t1.ticket_group_id IS NULL AND t2.ticket_group_id IS NULL
  LOOP
    -- Create new ticket group
    INSERT INTO ticket_groups (group_name, total_tickets, total_passengers)
    VALUES (ticket_record.pnr1 || ' + ' || ticket_record.pnr2, 2, 1)
    RETURNING id INTO group_id;
    
    -- Link tickets to group
    UPDATE tickets 
    SET ticket_group_id = group_id, sequence_in_group = 1
    WHERE id = ticket_record.ticket1_id;
    
    UPDATE tickets 
    SET ticket_group_id = group_id, sequence_in_group = 2
    WHERE id = ticket_record.ticket2_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ENHANCED VIEWS FOR EASY QUERYING
-- =============================================

-- Enhanced view with passenger profiles and journey connections
CREATE OR REPLACE VIEW enhanced_ticket_details AS
SELECT 
  t.id,
  t.pnr,
  t.transaction_id,
  t.ticket_print_time,
  t.payment,
  t.created_at,
  t.updated_at,
  
  -- Ticket group information
  tg.id as group_id,
  tg.group_name,
  tg.total_tickets,
  t.sequence_in_group,
  
  -- Passenger information with profiles
  json_agg(DISTINCT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'age', p.age,
    'gender', p.gender,
    'booking_status', p.booking_status,
    'current_status', p.current_status,
    'profile_id', pp.id,
    'total_journeys_by_passenger', (
      SELECT COUNT(DISTINCT t2.id) 
      FROM tickets t2 
      JOIN passengers p2 ON p2.ticket_id = t2.id 
      WHERE p2.passenger_profile_id = pp.id
    )
  )) as passengers,
  
  -- Journey information with connections
  json_agg(DISTINCT jsonb_build_object(
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
    'sequence', j.sequence,
    'has_next_connection', EXISTS(
      SELECT 1 FROM journey_connections jc WHERE jc.from_journey_id = j.id
    ),
    'has_prev_connection', EXISTS(
      SELECT 1 FROM journey_connections jc WHERE jc.to_journey_id = j.id
    )
  )) as journeys

FROM tickets t
LEFT JOIN ticket_groups tg ON t.ticket_group_id = tg.id
LEFT JOIN passengers p ON p.ticket_id = t.id
LEFT JOIN passenger_profiles pp ON p.passenger_profile_id = pp.id
LEFT JOIN journeys j ON j.ticket_id = t.id
GROUP BY t.id, t.pnr, t.transaction_id, t.ticket_print_time, t.payment, 
         t.created_at, t.updated_at, tg.id, tg.group_name, tg.total_tickets, t.sequence_in_group;

-- View for passenger journey history
CREATE OR REPLACE VIEW passenger_journey_history AS
SELECT 
  pp.id as passenger_profile_id,
  pp.name,
  pp.age,
  pp.gender,
  COUNT(DISTINCT t.id) as total_tickets,
  COUNT(DISTINCT j.id) as total_journeys,
  MIN(j.boarding_datetime) as first_journey_date,
  MAX(j.destination_datetime) as last_journey_date,
  array_agg(DISTINCT j.boarding_station ORDER BY j.boarding_datetime) as stations_visited,
  array_agg(DISTINCT t.pnr ORDER BY t.created_at) as pnr_list
FROM passenger_profiles pp
JOIN passengers p ON p.passenger_profile_id = pp.id
JOIN tickets t ON p.ticket_id = t.id
JOIN journeys j ON j.ticket_id = t.id
GROUP BY pp.id, pp.name, pp.age, pp.gender;

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on new tables
ALTER TABLE passenger_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_connections ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public access on passenger_profiles" ON passenger_profiles FOR ALL USING (true);
CREATE POLICY "Allow public access on ticket_groups" ON ticket_groups FOR ALL USING (true);
CREATE POLICY "Allow public access on journey_connections" ON journey_connections FOR ALL USING (true);

-- =============================================
-- UPDATE EXISTING DATA
-- =============================================

-- Migrate existing passengers to use profiles
INSERT INTO passenger_profiles (name, age, gender)
SELECT DISTINCT name, age, gender 
FROM passengers p
WHERE NOT EXISTS (
  SELECT 1 FROM passenger_profiles pp 
  WHERE pp.name = p.name AND pp.age = p.age
)
ON CONFLICT (name, age) DO NOTHING;

-- Link existing passengers to profiles
UPDATE passengers p
SET passenger_profile_id = pp.id
FROM passenger_profiles pp
WHERE p.name = pp.name AND p.age = pp.age
AND p.passenger_profile_id IS NULL;

-- Create ticket groups for existing connected journeys
SELECT create_ticket_groups();

-- =============================================
-- UTILITY FUNCTIONS FOR APPLICATION
-- =============================================

-- Function to get passenger statistics
CREATE OR REPLACE FUNCTION get_passenger_stats(profile_id UUID)
RETURNS json AS $$
SELECT json_build_object(
  'total_tickets', COUNT(DISTINCT t.id),
  'total_journeys', COUNT(DISTINCT j.id),
  'total_distance', SUM(j.distance_km),
  'unique_trains', COUNT(DISTINCT j.train_number),
  'unique_stations', array_length(array_agg(DISTINCT j.boarding_station || ',' || j.destination_station), 1),
  'first_journey', MIN(j.boarding_datetime),
  'last_journey', MAX(j.destination_datetime)
)
FROM passenger_profiles pp
JOIN passengers p ON p.passenger_profile_id = pp.id
JOIN tickets t ON p.ticket_id = t.id
JOIN journeys j ON j.ticket_id = t.id
WHERE pp.id = profile_id;
$$ LANGUAGE sql;

-- Function to find journey connections
CREATE OR REPLACE FUNCTION find_journey_connections(ticket_id UUID)
RETURNS json AS $$
SELECT json_agg(
  json_build_object(
    'connection_type', jc.connection_type,
    'connection_station', jc.connection_station,
    'layover_minutes', jc.layover_minutes,
    'next_journey', json_build_object(
      'train_number', j.train_number,
      'train_name', j.train_name,
      'boarding_datetime', j.boarding_datetime,
      'destination_station', j.destination_station
    )
  )
)
FROM journey_connections jc
JOIN journeys j1 ON jc.from_journey_id = j1.id
JOIN journeys j ON jc.to_journey_id = j.id
WHERE j1.ticket_id = ticket_id;
$$ LANGUAGE sql;

COMMENT ON TABLE passenger_profiles IS 'Unique passenger identification by name + age combination';
COMMENT ON TABLE ticket_groups IS 'Groups of connected tickets for multi-segment journeys';
COMMENT ON TABLE journey_connections IS 'Direct connections between different train journeys';
COMMENT ON VIEW enhanced_ticket_details IS 'Complete ticket information with passenger profiles and connections';
COMMENT ON VIEW passenger_journey_history IS 'Historical journey data for each unique passenger';