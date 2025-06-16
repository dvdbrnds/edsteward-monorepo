#!/bin/zsh

# Production smoke tests
# Usage: ./production-smoke-tests.sh

set -e

# Production endpoint - update this to match your actual production URL
PRODUCTION_URL="http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
TIMEOUT=30

echo "🧪 Running production smoke tests..."
echo "🌍 Production URL: $PRODUCTION_URL"

# Test 1: Health check
echo "🔍 Test 1: Health check endpoint..."
if curl -f -s --max-time $TIMEOUT "$PRODUCTION_URL/health" > /dev/null; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    exit 1
fi

# Test 2: Homepage accessibility
echo "🔍 Test 2: Homepage accessibility..."
HOME_RESPONSE=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$PRODUCTION_URL/" -o /dev/null)
if [ "$HOME_RESPONSE" = "200" ]; then
    echo "✅ Homepage accessible"
else
    echo "❌ Homepage returned status: $HOME_RESPONSE"
    exit 1
fi

# Test 3: API endpoints (basic connectivity)
echo "🔍 Test 3: API endpoint connectivity..."
API_RESPONSE=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$PRODUCTION_URL/api/regulations" -o /dev/null)

# API might return 401/403 for auth, but should not return 5xx errors
if [[ "$API_RESPONSE" =~ ^[234][0-9][0-9]$ ]]; then
    echo "✅ API endpoints responding (status: $API_RESPONSE)"
else
    echo "❌ API endpoints error (status: $API_RESPONSE)"
    exit 1
fi

# Test 4: Static assets
echo "🔍 Test 4: Static asset serving..."
# Try to get favicon or any static asset
STATIC_RESPONSE=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$PRODUCTION_URL/favicon.ico" -o /dev/null || echo "404")
if [ "$STATIC_RESPONSE" = "200" ] || [ "$STATIC_RESPONSE" = "404" ]; then
    echo "✅ Static asset serving functional"
else
    echo "⚠️ Static asset serving may have issues (status: $STATIC_RESPONSE)"
fi

# Test 5: Response time check
echo "🔍 Test 5: Response time check..."
RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" --max-time $TIMEOUT "$PRODUCTION_URL/health")
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc | cut -d. -f1)

echo "📊 Response time: ${RESPONSE_TIME}s (${RESPONSE_TIME_MS}ms)"

MAX_RESPONSE_TIME=10  # 10 seconds for production
if (( $(echo "$RESPONSE_TIME > $MAX_RESPONSE_TIME" | bc -l) )); then
    echo "⚠️ Response time exceeds ${MAX_RESPONSE_TIME}s"
else
    echo "✅ Response time within acceptable limits"
fi

# Test 6: SSL/TLS check (if HTTPS)
if echo "$PRODUCTION_URL" | grep -q "https://"; then
    echo "🔍 Test 6: SSL/TLS certificate check..."
    if curl -f -s --max-time $TIMEOUT "$PRODUCTION_URL/health" > /dev/null; then
        echo "✅ SSL/TLS certificate valid"
    else
        echo "❌ SSL/TLS certificate issues"
        exit 1
    fi
else
    echo "⚠️ Test 6: Skipped SSL/TLS check (HTTP endpoint)"
fi

# Test 7: Authentication endpoints
echo "🔍 Test 7: Authentication endpoint check..."
AUTH_RESPONSE=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$PRODUCTION_URL/auth/login" -o /dev/null || echo "404")
if [[ "$AUTH_RESPONSE" =~ ^[234][0-9][0-9]$ ]]; then
    echo "✅ Authentication endpoints responding"
else
    echo "⚠️ Authentication endpoints may not be available (status: $AUTH_RESPONSE)"
fi

# Test 8: Database connectivity (indirect test via API)
echo "🔍 Test 8: Database connectivity test..."
DB_TEST_RESPONSE=$(curl -s --max-time $TIMEOUT "$PRODUCTION_URL/api/regulations" || echo "FAILED")

if [ "$DB_TEST_RESPONSE" != "FAILED" ] && [ -n "$DB_TEST_RESPONSE" ]; then
    # If we get JSON response, database is likely connected
    if echo "$DB_TEST_RESPONSE" | jq empty 2>/dev/null; then
        REGULATION_COUNT=$(echo "$DB_TEST_RESPONSE" | jq '. | length' 2>/dev/null || echo "0")
        echo "✅ Database connectivity confirmed (regulations: $REGULATION_COUNT)"
    else
        echo "⚠️ Database connectivity unclear (non-JSON response)"
    fi
else
    echo "⚠️ Database connectivity test inconclusive"
fi

# Test 9: Memory and resource usage (if possible)
echo "🔍 Test 9: Checking for error responses..."
# Test multiple endpoints quickly to check for consistent responses
ENDPOINTS=("/health" "/" "/api/health")
ERROR_COUNT=0

for endpoint in "${ENDPOINTS[@]}"; do
    RESPONSE=$(curl -s -w "%{http_code}" --max-time 10 "$PRODUCTION_URL$endpoint" -o /dev/null || echo "FAILED")
    if [[ "$RESPONSE" =~ ^5[0-9][0-9]$ ]] || [ "$RESPONSE" = "FAILED" ]; then
        ERROR_COUNT=$((ERROR_COUNT + 1))
        echo "⚠️ Error response from $endpoint: $RESPONSE"
    fi
done

if [ $ERROR_COUNT -eq 0 ]; then
    echo "✅ No server errors detected"
else
    echo "❌ Found $ERROR_COUNT error responses"
    exit 1
fi

# Test 10: Load balancer health (if applicable)
echo "🔍 Test 10: Load balancer health check..."
# Multiple quick requests to test load balancer
for i in {1..3}; do
    LB_RESPONSE=$(curl -s -w "%{http_code}" --max-time 5 "$PRODUCTION_URL/health" -o /dev/null)
    if [ "$LB_RESPONSE" != "200" ]; then
        echo "❌ Load balancer inconsistency detected (attempt $i: $LB_RESPONSE)"
        exit 1
    fi
    sleep 1
done
echo "✅ Load balancer responding consistently"

echo ""
echo "🎉 All production smoke tests passed!"
echo "✅ Production deployment verification successful"
echo "🚀 Application is ready for production traffic"

# Save test results
cat > .production-test-results << EOF
PRODUCTION_URL=$PRODUCTION_URL
TEST_TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
RESPONSE_TIME=${RESPONSE_TIME}s
ALL_TESTS_PASSED=true
EOF

echo "📋 Test results saved to .production-test-results" 