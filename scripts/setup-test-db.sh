#!/bin/bash

# Test database setup script
echo "Setting up test database environment..."

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "PostgreSQL is not running. Starting PostgreSQL..."
    # Try to start PostgreSQL (adapt based on system)
    if command -v brew &> /dev/null; then
        brew services start postgresql
    else
        echo "Please start PostgreSQL manually"
        exit 1
    fi
fi

# Run database setup
echo "Creating database and setting permissions..."
psql -U postgres < scripts/setup-database.sql

# Run Prisma migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

echo "Database setup complete!"