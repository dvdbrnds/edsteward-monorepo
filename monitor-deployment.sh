#!/bin/bash

echo "🔍 MONITORING SSL DEPLOYMENT - EdSteward"
echo "========================================"
echo ""

# Function to test login and return result
test_ssl() {
    echo "Testing SSL connection..."
    result=$(node test-login.js 2>&1)
    if echo "$result" | grep -q "no encryption"; then
        return 1  # Still no SSL
    elif echo "$result" | grep -q "User not found\|Invalid credentials"; then
        return 0  # SSL working!
    else
        return 2  # Other error
    fi
}

# Check deployment status
echo "📊 Current Deployment Status:"
aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --region us-east-1 \
  --query 'services[0].deployments[*].{Status:status,TaskDef:taskDefinition,CreatedAt:createdAt,RunningCount:runningCount,DesiredCount:desiredCount}' \
  --output json 2>/dev/null || echo "Unable to fetch deployment status"

echo ""
echo "⏰ Monitoring deployment progress (checking every 30 seconds)..."
echo "Press Ctrl+C to stop monitoring"
echo ""

# Monitor for up to 10 minutes (20 checks * 30 seconds)
for i in {1..20}; do
    echo "Check $i/20 - $(date)"
    
    # Test SSL
    if test_ssl; then
        echo ""
        echo "🎉 SUCCESS! SSL IS WORKING!"
        echo "============================================"
        echo ""
        echo "✅ Database SSL connection is now active"
        echo "❗ Your local user account doesn't exist in production"
        echo ""
        echo "🚀 NEXT STEPS:"
        echo "1. Go to: https://edsteward.ai/register"
        echo "2. Create your account in the production database"
        echo "3. Login with your new production credentials"
        echo ""
        echo "🔄 Or migrate your local data:"
        echo "   pg_dump your local Neon database and import to production"
        echo ""
        exit 0
    else
        ssl_status=$?
        if [ $ssl_status -eq 1 ]; then
            echo "   ⏳ Still waiting for SSL... (deployment in progress)"
        else
            echo "   ❓ Different error detected - check manually"
        fi
    fi
    
    # Wait 30 seconds before next check
    if [ $i -lt 20 ]; then
        echo "   Waiting 30 seconds..."
        sleep 30
    fi
done

echo ""
echo "⚠️  TIMEOUT: Deployment taking longer than expected"
echo "Manual steps:"
echo "1. Check deployment status: aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1"
echo "2. View logs: aws logs tail /aws/ecs/edsteward --follow --region us-east-1"
echo "3. Test manually: node test-login.js" 