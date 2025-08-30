#!/bin/zsh

# EdSteward Docker Production Startup Script
# This script starts the EdSteward production environment using Docker

echo "🚀 Starting EdSteward Docker Production Environment..."

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

# Stop any existing containers
echo "🛑 Stopping any existing EdSteward containers..."
docker stop $(docker ps -q --filter "ancestor=edsteward-selfcontained:latest") 2>/dev/null || true

# Start the production container
echo "🏗️  Starting EdSteward production container..."
docker run -d \
    --name edsteward-production \
    --platform linux/amd64 \
    -p 3000:3000 \
    -e NODE_ENV=production \
    -e DATABASE_URL="${DATABASE_URL:-postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require}" \
    -e SESSION_SECRET="${SESSION_SECRET:-production-secret-key-change-in-production}" \
    --restart unless-stopped \
    edsteward-selfcontained:latest

# Wait for the service to be ready
echo "⏳ Waiting for EdSteward to start..."
sleep 15

# Check if the service is healthy
if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "✅ EdSteward Production is running successfully!"
    echo "🌐 Access your application at: http://localhost:3000"
    echo "📊 Health check: http://localhost:3000/api/health"
    echo ""
    echo "📝 To view logs: docker logs edsteward-production"
    echo "🛑 To stop: docker stop edsteward-production && docker rm edsteward-production"
else
    echo "❌ EdSteward failed to start properly"
    echo "📋 Check logs with: docker logs edsteward-production"
    exit 1
fi
