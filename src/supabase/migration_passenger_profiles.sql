-- Enhanced Database Migration: Passenger Profiles System
-- Run this in your Supabase SQL Editor after the main schema
-- This migration adds passenger profile deduplication and cost tracking

-- Create passenger_profiles table for deduplication
CREATE TABLE IF NOT EXISTS passenger_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  passenger_key VARCHAR(150) UNIQUE NOT NULL, -- "NAME_AGE" format
  name VARCHAR(100) NOT NULL,
  age INTEGER CHECK (age >= 0 AND age <= 120),
  gender VARCHAR(10),
  travel_count INTEGER DEFAULT 1,
  total_spent NUMERIC DEFAULT 0,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add passenger_profile_id to existing passengers table
ALTER TABLE passengers 
ADD COLUMN IF NOT EXISTS passenger_profile_id UUID REFERENCES passenger_profiles(id),
ADD COLUMN IF NOT EXISTS allocated_cost JSONB;

-- Create indexes for passenger profiles
CREATE INDEX IF NOT EXISTS idx_passenger_profiles_key ON passenger_profiles(passenger_key);
CREATE INDEX IF NOT EXISTS idx_passenger_profiles_name ON passenger_profiles(name);
CREATE INDEX IF NOT EXISTS idx_passenger_profiles_travel_count ON passenger_profiles(travel_count DESC);
CREATE INDEX IF NOT EXISTS idx_passengers_profile_id ON passengers(passenger_profile_id);

-- Add updated_at trigger for passenger_profiles
CREATE TRIGGER update_passenger_profiles_updated_at BEFORE UPDATE ON passenger_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for passenger_profiles
ALTER TABLE passenger_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for passenger_profiles
CREATE POLICY "Allow public read access on passenger_profiles" ON passenger_profiles
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert on passenger_profiles" ON passenger_profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on passenger_profiles" ON passenger_profiles
    FOR UPDATE USING (true) WITH CHECK (true);

-- Enhanced ticket_details view with passenger profiles
CREATE OR REPLACE VIEW enhanced_ticket_details AS
SELECT 
  t.id,
  t.pnr,
  t.transaction_id,
  t.ticket_print_time,
  t.payment,
  t.processing_info,
  t.source_file,
  t.created_at,
  jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'age', p.age,
      'gender', p.gender,
      'booking_status', p.booking_status,
      'current_status', p.current_status,
      'allocated_cost', p.allocated_cost,
      'profile_id', p.passenger_profile_id,
      'travel_history', pp.travel_count,
      'total_spent', pp.total_spent
    )
  ) FILTER (WHERE p.id IS NOT NULL) AS passengers,
  jsonb_agg(
    jsonb_build_object(
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
  ) FILTER (WHERE j.id IS NOT NULL) AS journeys
FROM tickets t
LEFT JOIN passengers p ON t.id = p.ticket_id
LEFT JOIN passenger_profiles pp ON p.passenger_profile_id = pp.id
LEFT JOIN journeys j ON t.id = j.ticket_id
GROUP BY t.id, t.pnr, t.transaction_id, t.ticket_print_time, t.payment, 
         t.processing_info, t.source_file, t.created_at;

-- Function to get passenger travel history
CREATE OR REPLACE FUNCTION get_passenger_travel_history(search_passenger_key VARCHAR(150))
RETURNS TABLE (
  profile JSONB,
  travel_history JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jsonb_build_object(
      'id', pp.id,
      'name', pp.name,
      'age', pp.age,
      'gender', pp.gender,
      'travel_count', pp.travel_count,
      'total_spent', pp.total_spent,
      'first_seen', pp.first_seen,
      'last_seen', pp.last_seen
    ) as profile,
    jsonb_agg(
      jsonb_build_object(
        'pnr', t.pnr,
        'ticket_date', t.ticket_print_time,
        'journey_count', journey_data.journey_count,
        'total_fare', (t.payment->>'total')::NUMERIC,
        'allocated_cost', p.allocated_cost,
        'journeys', journey_data.journeys
      ) ORDER BY t.ticket_print_time DESC
    ) as travel_history
  FROM passenger_profiles pp
  JOIN passengers p ON pp.id = p.passenger_profile_id
  JOIN tickets t ON p.ticket_id = t.id
  LEFT JOIN (
    SELECT 
      j.ticket_id,
      COUNT(*) as journey_count,
      jsonb_agg(
        jsonb_build_object(
          'train_number', j.train_number,
          'train_name', j.train_name,
          'from', j.boarding_station,
          'to', j.destination_station,
          'date', j.boarding_datetime
        ) ORDER BY j.sequence
      ) as journeys
    FROM journeys j
    GROUP BY j.ticket_id
  ) journey_data ON t.id = journey_data.ticket_id
  WHERE pp.passenger_key = search_passenger_key
  GROUP BY pp.id, pp.name, pp.age, pp.gender, pp.travel_count, 
           pp.total_spent, pp.first_seen, pp.last_seen;
END;
$$ LANGUAGE plpgsql;

-- Function to find potential duplicate passenger profiles
CREATE OR REPLACE FUNCTION find_duplicate_passenger_profiles()
RETURNS TABLE (
  primary_profile_id UUID,
  primary_name VARCHAR(100),
  primary_age INTEGER,
  duplicate_profiles JSONB,
  total_duplicates INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH duplicate_groups AS (
    SELECT 
      name,
      age,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'passenger_key', passenger_key,
          'travel_count', travel_count,
          'created_at', created_at
        ) ORDER BY travel_count DESC, created_at ASC
      ) as profiles
    FROM passenger_profiles
    GROUP BY name, age
    HAVING COUNT(*) > 1
  )
  SELECT 
    (profiles->0->>'id')::UUID as primary_profile_id,
    name as primary_name,
    age as primary_age,
    (profiles - 0) as duplicate_profiles,
    (jsonb_array_length(profiles) - 1) as total_duplicates
  FROM duplicate_groups;
END;
$$ LANGUAGE plpgsql;

-- Enhanced database stats function
CREATE OR REPLACE FUNCTION get_enhanced_database_stats()
RETURNS TABLE (
  total_tickets BIGINT,
  total_passengers BIGINT,
  total_journeys BIGINT,
  unique_passenger_profiles BIGINT,
  frequent_travelers BIGINT,
  average_passengers_per_ticket NUMERIC,
  total_revenue NUMERIC,
  average_cost_per_passenger NUMERIC,
  duplicate_profiles_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM tickets) as total_tickets,
    (SELECT COUNT(*) FROM passengers) as total_passengers,
    (SELECT COUNT(*) FROM journeys) as total_journeys,
    (SELECT COUNT(*) FROM passenger_profiles) as unique_passenger_profiles,
    (SELECT COUNT(*) FROM passenger_profiles WHERE travel_count >= 2) as frequent_travelers,
    (SELECT ROUND(AVG(passenger_count), 2) FROM (
      SELECT COUNT(p.id) as passenger_count 
      FROM tickets t 
      LEFT JOIN passengers p ON t.id = p.ticket_id 
      GROUP BY t.id
    ) as subq) as average_passengers_per_ticket,
    (SELECT ROUND(SUM(COALESCE((payment->>'total')::NUMERIC, 0)), 2) 
     FROM tickets WHERE payment IS NOT NULL) as total_revenue,
    (SELECT ROUND(AVG(COALESCE((payment->>'total')::NUMERIC, 0) / 
                      GREATEST(passenger_count, 1)), 2) FROM (
      SELECT t.payment, COUNT(p.id) as passenger_count 
      FROM tickets t 
      LEFT JOIN passengers p ON t.id = p.ticket_id 
      WHERE t.payment IS NOT NULL
      GROUP BY t.id, t.payment
    ) as subq) as average_cost_per_passenger,
    (SELECT COUNT(*) FROM (
      SELECT name, age FROM passenger_profiles 
      GROUP BY name, age HAVING COUNT(*) > 1
    ) as duplicates) as duplicate_profiles_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup duplicate passenger profiles automatically
CREATE OR REPLACE FUNCTION cleanup_duplicate_passenger_profiles()
RETURNS TABLE (
  merged_groups INTEGER,
  profiles_merged INTEGER,
  profiles_deleted INTEGER
) AS $$
DECLARE
  duplicate_group RECORD;
  primary_id UUID;
  duplicate_ids UUID[];
  total_groups INTEGER := 0;
  total_merged INTEGER := 0;
  total_deleted INTEGER := 0;
BEGIN
  -- Process each group of duplicates
  FOR duplicate_group IN 
    SELECT 
      name, age,
      array_agg(id ORDER BY travel_count DESC, created_at ASC) as profile_ids
    FROM passenger_profiles
    GROUP BY name, age
    HAVING COUNT(*) > 1
  LOOP
    primary_id := duplicate_group.profile_ids[1];
    duplicate_ids := duplicate_group.profile_ids[2:];
    
    -- Update all passenger records to point to primary profile
    UPDATE passengers 
    SET passenger_profile_id = primary_id 
    WHERE passenger_profile_id = ANY(duplicate_ids);
    
    -- Update primary profile with combined travel count and total spent
    UPDATE passenger_profiles 
    SET 
      travel_count = (
        SELECT SUM(travel_count) 
        FROM passenger_profiles 
        WHERE id = ANY(duplicate_group.profile_ids)
      ),
      total_spent = (
        SELECT SUM(total_spent) 
        FROM passenger_profiles 
        WHERE id = ANY(duplicate_group.profile_ids)
      ),
      updated_at = NOW()
    WHERE id = primary_id;
    
    -- Delete duplicate profiles
    DELETE FROM passenger_profiles WHERE id = ANY(duplicate_ids);
    
    total_groups := total_groups + 1;
    total_merged := total_merged + array_length(duplicate_group.profile_ids, 1);
    total_deleted := total_deleted + array_length(duplicate_ids, 1);
  END LOOP;
  
  RETURN QUERY SELECT total_groups, total_merged, total_deleted;
END;
$$ LANGUAGE plpgsql;

-- Comments for new schema
COMMENT ON TABLE passenger_profiles IS 'Deduplicated passenger profiles with travel history';
COMMENT ON COLUMN passenger_profiles.passenger_key IS 'Unique key: NAME_AGE format for deduplication';
COMMENT ON COLUMN passenger_profiles.travel_count IS 'Total number of trips across all tickets';
COMMENT ON COLUMN passengers.passenger_profile_id IS 'Links to deduplicated passenger profile';
COMMENT ON COLUMN passengers.allocated_cost IS 'Cost breakdown allocated to this passenger';
COMMENT ON VIEW enhanced_ticket_details IS 'Complete ticket view with passenger profiles and cost allocation';
COMMENT ON FUNCTION get_passenger_travel_history IS 'Complete travel history for a passenger profile';
COMMENT ON FUNCTION find_duplicate_passenger_profiles IS 'Identify potential duplicate passenger profiles';
COMMENT ON FUNCTION get_enhanced_database_stats IS 'Enhanced statistics including passenger profiles';
COMMENT ON FUNCTION cleanup_duplicate_passenger_profiles IS 'Automatically merge duplicate passenger profiles';