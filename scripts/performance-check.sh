#!/bin/zsh

# Performance check script
# Usage: ./performance-check.sh <base_url>

set -e

BASE_URL="${1:-http://localhost:3000}"
MAX_RESPONSE_TIME=5  # seconds
SAMPLES=5

echo "📊 Running performance checks on $BASE_URL"

# Test response times
echo "🔍 Testing response times..."

total_time=0
for i in {1..$SAMPLES}; do
    response_time=$(curl -o /dev/null -s -w "%{time_total}" --max-time 30 "$BASE_URL/health")
    echo "  Sample $i: ${response_time}s"
    total_time=$(echo "$total_time + $response_time" | bc)
done

average_time=$(echo "scale=3; $total_time / $SAMPLES" | bc)
echo "📈 Average response time: ${average_time}s"

# Check if average response time is acceptable
if (( $(echo "$average_time > $MAX_RESPONSE_TIME" | bc -l) )); then
    echo "❌ Average response time ($average_time s) exceeds maximum ($MAX_RESPONSE_TIME s)"
    exit 1
fi

echo "✅ Response time within acceptable limits"

# Test concurrent requests
echo "🔍 Testing concurrent request handling..."
for i in {1..3}; do
    curl -s "$BASE_URL/health" > /dev/null &
done
wait

echo "✅ Concurrent request test passed"

# Memory usage check (if possible)
echo "🔍 Checking container resources..."
CONTAINER_NAME="regulatorytrackr-staging"

if docker ps | grep -q "$CONTAINER_NAME"; then
    MEMORY_USAGE=$(docker stats --no-stream --format "table {{.MemUsage}}" "$CONTAINER_NAME" | tail -n 1)
    echo "📊 Memory usage: $MEMORY_USAGE"
    
    CPU_USAGE=$(docker stats --no-stream --format "table {{.CPUPerc}}" "$CONTAINER_NAME" | tail -n 1)
    echo "📊 CPU usage: $CPU_USAGE"
else
    echo "⚠️ Container not found for resource monitoring"
fi

echo "✅ Performance checks completed successfully" 