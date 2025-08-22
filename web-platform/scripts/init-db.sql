-- OCR Platform Database Initialization
-- Creates necessary extensions and initial setup

-- Create UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create database if not exists (handled by POSTGRES_DB env var)
-- This file runs after database creation

-- Set timezone
SET timezone = 'UTC';

-- Create initial roles if needed
-- (Prisma will handle table creation via migrations)

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'OCR Platform database initialized successfully';
END $$;