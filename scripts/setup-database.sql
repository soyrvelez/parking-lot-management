-- Database setup script for Parking Lot Management System
-- Run this as PostgreSQL superuser to set up proper permissions

-- Create database if not exists
CREATE DATABASE parking_lot;

-- Connect to the parking_lot database
\c parking_lot;

-- Create user if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_user
      WHERE  usename = 'parking_user') THEN
      CREATE USER parking_user WITH PASSWORD 'parking_pass';
   END IF;
END
$do$;

-- Grant all privileges on database
GRANT ALL PRIVILEGES ON DATABASE parking_lot TO parking_user;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO parking_user;
GRANT CREATE ON SCHEMA public TO parking_user;

-- Grant table permissions (for existing tables)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO parking_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO parking_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO parking_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO parking_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO parking_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO parking_user;

-- Make parking_user owner of public schema
ALTER SCHEMA public OWNER TO parking_user;

-- Verify permissions
\du parking_user