#!/bin/bash

echo "🚀 MONITORING SSL RECOVERY - EdSteward"
echo "====================================="
echo ""
echo "✅ Hard reset completed successfully!"
echo "🔄 Service is restarting with SSL configuration"
echo "⏳ Waiting for new tasks to become healthy..."
echo ""

# Function to test and categorize response
test_service_status() {
    response=$(curl -s -w "HTTP_STATUS:%{http_code}" https://edsteward.ai/api/login \
      -H "Content-Type: application/json" \
      -d '{"username":"test","password":"test"}' 2>/dev/null)
    
    http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    echo "   Status: $http_status"
    
    if [ "$http_status" = "503" ]; then
        echo "   ⏳ Service still starting..."
        return 1
    elif [ "$http_status" = "500" ] && echo "$body" | grep -q "no encryption"; then
        echo "   ❌ Still no SSL - deployment issue"
        return 2
    elif [ "$http_status" = "500" ] && echo "$body" | grep -q "User not found\|Invalid credentials"; then
        echo "   🎉 SSL IS WORKING! Database connection successful!"
        return 0
    elif [ "$http_status" = "200" ] || [ "$http_status" = "400" ]; then
        echo "   🎉 Service is responding normally!"
        return 0
    else
        echo "   ❓ Unexpected response: $http_status"
        echo "   Body: $body"
        return 3
    fi
}

# Monitor recovery for up to 5 minutes
for i in {1..15}; do
    echo "Recovery Check $i/15 - $(date '+%H:%M:%S')"
    
    if test_service_status; then
        echo ""
        echo "🎉 SUCCESS! SERVICE RECOVERED WITH SSL!"
        echo "======================================="
        echo ""
        echo "✅ Database SSL connection is now working"
        echo "✅ Service is healthy and responding"
        echo ""
        echo "🚀 NEXT STEPS:"
        echo "1. Go to: https://edsteward.ai/register"
        echo "2. Create your production user account"
        echo "3. Login with your new credentials"
        echo ""
        echo "🔍 Test login manually:"
        echo "   node test-login.js"
        echo ""
        exit 0
    else
        status_code=$?
        if [ $status_code -eq 2 ]; then
            echo "   ⚠️  SSL still not working after hard reset"
            break
        fi
    fi
    
    if [ $i -lt 15 ]; then
        echo "   Waiting 20 seconds..."
        sleep 20
    fi
done

echo ""
echo "⚠️  Need manual intervention"
echo "Options:"
echo "1. Check ECS task status: aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1"
echo "2. View task logs: aws logs tail /aws/ecs/edsteward --follow --region us-east-1"
echo "3. Test manually: node test-login.js" 