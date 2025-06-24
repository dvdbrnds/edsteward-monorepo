#!/bin/zsh

# Start Self-Contained EdSteward
# This script starts the complete application with PostgreSQL and Redis containers

echo "🚀 Starting EdSteward Self-Contained Environment..."

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed. Please install Docker first."
        exit 1
    fi
    echo "❌ docker-compose is not available. Using 'docker compose' instead..."
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Stop any running containers
echo "🛑 Stopping any existing containers..."
$COMPOSE_CMD -f docker-compose.production.yml down

# Remove old volumes if requested
if [[ "$1" == "--fresh" ]]; then
    echo "🗑️  Removing old data volumes for fresh start..."
    docker volume rm edsteward_postgres_data 2>/dev/null || true
    docker volume rm edsteward_redis_data 2>/dev/null || true
fi

# Build and start containers
echo "🔨 Building and starting containers..."
$COMPOSE_CMD -f docker-compose.production.yml up --build -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Service Status:"
$COMPOSE_CMD -f docker-compose.production.yml ps

# Check logs for any errors
echo "📝 Recent logs:"
$COMPOSE_CMD -f docker-compose.production.yml logs --tail=20

echo ""
echo "✅ EdSteward Self-Contained Environment Started!"
echo "🌐 Application: http://localhost:3000"
echo "🐘 PostgreSQL: localhost:5432"
echo "🔴 Redis: localhost:6379"
echo ""
echo "Commands:"
echo "  View logs:    $COMPOSE_CMD -f docker-compose.production.yml logs -f"
echo "  Stop:         $COMPOSE_CMD -f docker-compose.production.yml down"
echo "  Fresh start:  ./start-selfcontained.sh --fresh" 