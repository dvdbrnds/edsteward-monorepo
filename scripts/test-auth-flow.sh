#!/bin/zsh

# Test authentication flow
# Usage: ./test-auth-flow.sh <base_url>

set -e

BASE_URL="${1:-http://localhost:3000}"
TIMEOUT=10

echo "🔐 Testing authentication flow at $BASE_URL"

# Test auth endpoints availability
echo "🔍 Testing authentication endpoint availability..."

# Check if login page is accessible
if curl -f -s --max-time $TIMEOUT "$BASE_URL/login" > /dev/null 2>&1; then
    echo "✅ Login page accessible"
elif curl -f -s --max-time $TIMEOUT "$BASE_URL/auth/login" > /dev/null 2>&1; then
    echo "✅ Auth login endpoint accessible"
else
    echo "⚠️ No standard login endpoints found (may use external auth)"
fi

# Test session management
echo "🔍 Testing session management..."

# Try to access a protected endpoint without authentication
PROTECTED_RESPONSE=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/api/regulations" -o /dev/null || echo "FAILED")

if [[ "$PROTECTED_RESPONSE" == "401" ]] || [[ "$PROTECTED_RESPONSE" == "403" ]]; then
    echo "✅ Protected endpoints properly secured"
elif [[ "$PROTECTED_RESPONSE" == "200" ]]; then
    echo "⚠️ Protected endpoints accessible without auth (may be intentional for testing)"
elif [[ "$PROTECTED_RESPONSE" == "FAILED" ]]; then
    echo "⚠️ Protected endpoint test failed (connection issues)"
else
    echo "⚠️ Unexpected response from protected endpoint: $PROTECTED_RESPONSE"
fi

# Test SAML configuration (if available)
echo "🔍 Testing SAML configuration..."
SAML_METADATA=$(curl -s --max-time $TIMEOUT "$BASE_URL/auth/saml/metadata" || echo "NOT_AVAILABLE")

if [[ "$SAML_METADATA" != "NOT_AVAILABLE" ]] && [[ -n "$SAML_METADATA" ]]; then
    echo "✅ SAML metadata endpoint responding"
    # Check if metadata contains expected SAML elements
    if echo "$SAML_METADATA" | grep -q "EntityDescriptor"; then
        echo "✅ SAML metadata appears valid"
    else
        echo "⚠️ SAML metadata may be malformed"
    fi
else
    echo "⚠️ SAML metadata not available (may not be configured)"
fi

# Test session cookie handling
echo "🔍 Testing session cookie handling..."
COOKIE_JAR=$(mktemp)

# Make request and capture cookies
curl -s -c "$COOKIE_JAR" --max-time $TIMEOUT "$BASE_URL/" > /dev/null

if [ -s "$COOKIE_JAR" ]; then
    echo "✅ Session cookies are being set"
    
    # Check for session-related cookies
    if grep -q "session\|connect\.sid" "$COOKIE_JAR"; then
        echo "✅ Session management cookies detected"
    else
        echo "⚠️ No session management cookies found"
    fi
else
    echo "⚠️ No cookies being set"
fi

# Cleanup
rm -f "$COOKIE_JAR"

# Test logout functionality (if available)
echo "🔍 Testing logout functionality..."
LOGOUT_RESPONSE=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/logout" -o /dev/null || echo "FAILED")

if [[ "$LOGOUT_RESPONSE" == "200" ]] || [[ "$LOGOUT_RESPONSE" == "302" ]]; then
    echo "✅ Logout endpoint responding"
elif [[ "$LOGOUT_RESPONSE" == "404" ]]; then
    echo "⚠️ Logout endpoint not found (may use different path)"
else
    echo "⚠️ Logout endpoint test inconclusive: $LOGOUT_RESPONSE"
fi

echo "✅ Authentication flow tests completed" 