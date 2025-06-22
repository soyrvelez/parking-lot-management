#!/bin/bash

# Parking Lot Management - Test Environment Startup Script
# This script prepares and starts the complete testing environment

echo "🚀 Starting Parking Lot Management Test Environment"
echo "=================================================="

# Check PostgreSQL
echo "📊 Checking PostgreSQL connection..."
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    echo "   On macOS: brew services start postgresql"
    echo "   On Linux: sudo systemctl start postgresql"
    exit 1
fi

# Check database exists
echo "🗄️  Checking database..."
if psql -h localhost -p 5432 -U velez -lqt | cut -d \| -f 1 | grep -qw parking_lot; then
    echo "✅ Database 'parking_lot' exists"
else
    echo "⚠️  Database 'parking_lot' not found. Creating..."
    createdb -h localhost -p 5432 -U velez parking_lot
    echo "✅ Database created"
fi

# Sync database schema
echo "🔄 Syncing database schema..."
npx prisma db push --skip-generate

# Seed database
echo "🌱 Seeding database with test data..."
npx prisma db seed

# Start servers
echo ""
echo "🚀 Starting servers..."
echo "=================================================="
echo "Backend API: http://localhost:4000"
echo "Frontend UI: http://localhost:3000"
echo "=================================================="
echo ""
echo "📋 Quick Test Guide:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Use test barcode: PARK123456"
echo "3. Test keyboard shortcuts: F1-F12"
echo "4. Check hardware status in bottom bar"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start both servers
npm run dev