#!/bin/bash

echo "🧪 Testing EdSteward Authentication Fix..."

# Test 1: Check if site is responding
echo "1️⃣ Testing site connectivity..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://moravian.edsteward.ai)
if [ "$STATUS" = "200" ]; then
    echo "✅ Site is responding (HTTP $STATUS)"
else
    echo "❌ Site is not responding (HTTP $STATUS)"
    echo "   Waiting 30 seconds for deployment to complete..."
    sleep 30
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://moravian.edsteward.ai)
    if [ "$STATUS" = "200" ]; then
        echo "✅ Site is now responding (HTTP $STATUS)"
    else
        echo "❌ Site still not responding (HTTP $STATUS)"
        exit 1
    fi
fi

# Test 2: Check if login endpoint is accessible
echo "2️⃣ Testing login endpoint..."
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://moravian.edsteward.ai/api/login)
if [ "$LOGIN_STATUS" = "400" ] || [ "$LOGIN_STATUS" = "401" ]; then
    echo "✅ Login endpoint is accessible (HTTP $LOGIN_STATUS)"
else
    echo "❌ Login endpoint issue (HTTP $LOGIN_STATUS)"
fi

# Test 3: Test actual authentication
echo "3️⃣ Testing authentication with dvdbrnds..."
AUTH_RESPONSE=$(curl -s -X POST https://moravian.edsteward.ai/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dvdbrnds","password":"gabadh"}')

if echo "$AUTH_RESPONSE" | grep -q "success"; then
    echo "✅ Authentication successful for dvdbrnds!"
    echo "   Response: $AUTH_RESPONSE"
else
    echo "❌ Authentication failed for dvdbrnds"
    echo "   Response: $AUTH_RESPONSE"
fi

echo "🎉 Authentication test completed!" 