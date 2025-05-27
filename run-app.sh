#!/bin/bash

# Run the application with environment variables set directly
# This avoids having to use a .env file

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting application with environment variables...${NC}"

# Kill any process using port 3000
./kill-port.sh 3000

# Create logs directory if it doesn't exist
mkdir -p logs

# Set environment variables for testing
export NODE_ENV=development
export PORT=3000
export APP_VERSION=1.0.0
export LOG_LEVEL=info

# Security
export JWT_SECRET=dev-secret-key
export BYPASS_AUTH=true

# Database Configuration
export PG_HOST=localhost
export PG_PORT=5432
export PG_USER=app_user
export PG_PASSWORD=app_password
export PG_DATABASE=regulations

# Redis Configuration
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=

# Kafka and CDC Configuration
export ENABLE_CDC=false
export KAFKA_BROKER=localhost:9092
export KAFKA_CONNECT_URL=http://localhost:8083
export KAFKA_TOPIC_PREFIX=postgres-db-server

# Job Queue Configuration
export ENABLE_WORKER=false

# CORS Configuration
export ALLOWED_ORIGINS=http://localhost:3050,http://127.0.0.1:3050

# Feature Flags
export ENABLE_METRICS=false
export ENABLE_TELEMETRY=false

# Rate Limiting (disabled for testing)
export ENABLE_RATE_LIMIT=false

# Run the application with detailed stack traces
echo -e "${YELLOW}Running application with detailed error reporting on port ${PORT}...${NC}"
NODE_OPTIONS=--trace-warnings node src/start-app.js 