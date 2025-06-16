#!/bin/zsh

# Wait for application health check
# Usage: ./wait-for-health.sh <url> <timeout_seconds>

set -e

URL="${1:-http://localhost:3000/health}"
TIMEOUT="${2:-120}"
INTERVAL=5

echo "⏳ Waiting for health check at $URL (timeout: ${TIMEOUT}s)..."

end_time=$(($(date +%s) + TIMEOUT))

while [ $(date +%s) -lt $end_time ]; do
    if curl -f -s "$URL" >/dev/null 2>&1; then
        echo "✅ Health check passed!"
        exit 0
    fi
    
    echo "⏳ Waiting for health check... ($(date))"
    sleep $INTERVAL
done

echo "❌ Health check timeout after ${TIMEOUT} seconds"
echo "🔍 Last response:"
curl -v "$URL" || true
exit 1 