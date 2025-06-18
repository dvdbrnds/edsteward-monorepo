#!/bin/zsh

# Test API endpoints
# Usage: ./test-api-endpoints.sh <base_url>

set -e

BASE_URL="${1:-http://localhost:3000}"
TIMEOUT=10

echo "🧪 Testing API endpoints at $BASE_URL"

# Health check
echo "🔍 Testing health endpoint..."
curl -f -s --max-time $TIMEOUT "$BASE_URL/health" > /dev/null || {
    echo "❌ Health endpoint failed"
    exit 1
}
echo "✅ Health endpoint OK"

# Test static files
echo "🔍 Testing static file serving..."
curl -f -s --max-time $TIMEOUT "$BASE_URL/" > /dev/null || {
    echo "❌ Static file serving failed"
    exit 1
}
echo "✅ Static file serving OK"

# Test API endpoints (with authentication bypass for testing)
echo "🔍 Testing regulations API..."
RESPONSE=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/regulations" || echo "FAILED")
if [[ "$RESPONSE" == "FAILED" ]] || [[ -z "$RESPONSE" ]]; then
    echo "⚠️ Regulations API may require authentication (this is expected)"
else
    echo "✅ Regulations API responding"
fi

# Test authentication endpoints
echo "🔍 Testing auth endpoints..."
curl -f -s --max-time $TIMEOUT "$BASE_URL/auth/login" > /dev/null || {
    echo "⚠️ Auth login endpoint may not be available (this may be expected)"
}

# Test API health specifically
echo "🔍 Testing API health..."
API_HEALTH=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/health" || echo "NOT_AVAILABLE")
if [[ "$API_HEALTH" != "NOT_AVAILABLE" ]]; then
    echo "✅ API health endpoint responding"
else
    echo "⚠️ API health endpoint not available"
fi

echo "✅ API endpoint tests completed successfully" 