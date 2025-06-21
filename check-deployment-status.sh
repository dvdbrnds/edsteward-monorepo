#!/bin/zsh

echo "🔍 Checking Context7 Session Fix Deployment Status..."

# Test if session cookies are being set
echo "🧪 Testing session cookie behavior..."
curl -s -I http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/health | grep -i "set-cookie"

if [ $? -eq 0 ]; then
    echo "✅ Session cookies are being set - Context7 fix is working!"
else
    echo "❌ No session cookies found - deployment may still be in progress"
    echo "📋 Checking if service is responding..."
    
    # Check if service is healthy
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/health)
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "✅ Service is healthy (HTTP $HTTP_STATUS)"
        echo "⏱️  Deployment may still be in progress. Try again in a few minutes."
    else
        echo "❌ Service issue detected (HTTP $HTTP_STATUS)"
    fi
fi

echo "🌐 Test URL: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/health" 