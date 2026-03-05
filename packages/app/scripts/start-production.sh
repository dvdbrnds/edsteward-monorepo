#!/bin/bash

echo "🚀 Starting EdSteward production server..."

# Set working directory
cd /app

# Run the password migration (skip if it fails)
echo "Running password migration..."
node scripts/production-migrate-passwords.js || echo "Password migration failed or not needed"

# Start the production server
echo "Starting production server..."
exec npm start 