#!/bin/zsh

# EdSteward Docker Development Startup Script
# This script starts the EdSteward development environment using Docker

echo "🚀 Starting EdSteward Docker Development Environment..."

# Kill any existing processes on port 3000
echo "🔄 Cleaning up any existing processes on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start colima if not running
if ! colima status >/dev/null 2>&1; then
    echo "🐳 Starting colima Docker environment..."
    colima start
else
    echo "✅ Colima is already running"
fi

# Stop any existing containers and remove stale volumes
echo "🛑 Stopping any existing EdSteward containers..."
docker-compose -f docker-compose.dev.yml down -v 2>/dev/null || true

# Start the development environment
echo "🏗️  Starting EdSteward development containers..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for the service to be ready
echo "⏳ Waiting for EdSteward to start..."
sleep 10

# Check if the service is healthy
if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "✅ EdSteward is running successfully!"
    echo "🌐 Access your application at: http://localhost:3000"
    echo "📊 Health check: http://localhost:3000/api/health"
    echo ""
    echo "📝 To view logs: docker logs edsteward-app-1"
    echo "🛑 To stop: docker-compose -f docker-compose.dev.yml down"
else
    echo "❌ EdSteward failed to start properly"
    echo "📋 Check logs with: docker logs edsteward-app-1"
    exit 1
fi
