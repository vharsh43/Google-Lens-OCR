-- OCR Platform Database Initialization
-- Creates necessary extensions and initial setup

-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'UTC';

-- Configure PostgreSQL settings for better performance
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Set session parameters
SET statement_timeout = '30s';
SET lock_timeout = '10s';

-- Create custom functions for better UUID generation
CREATE OR REPLACE FUNCTION generate_cuid() RETURNS text AS $$
BEGIN
    RETURN 'c' || encode(gen_random_bytes(12), 'base64')::text;
END;
$$ LANGUAGE plpgsql;

-- Create indexes on commonly queried columns (will be recreated by Prisma migrations)
-- These are pre-emptive optimizations

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'OCR Platform Database Initialization Complete';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Extensions: uuid-ossp, pgcrypto';
    RAISE NOTICE 'Performance settings configured';
    RAISE NOTICE 'Custom functions created';
    RAISE NOTICE 'Ready for Prisma migrations';
    RAISE NOTICE '=================================================';
END $$;