#!/bin/bash

echo "🔍 CHECKING DEPLOYMENT STATUS - BYPASSING SHELL ISSUES"
echo "====================================================="
echo ""

echo "📅 Current time:"
date
echo ""

echo "🏗️ ECS Service Status:"
echo "Cluster: edsteward-cluster"
echo "Service: edsteward-service"
echo ""

# Use simple commands without pipes to avoid shell alias issues
echo "📋 Getting service info..."
aws ecs describe-services \
    --cluster edsteward-cluster \
    --services edsteward-service \
    --output json > service-status.json 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Service info retrieved successfully"
    
    # Extract key information manually
    echo ""
    echo "🔄 Current Task Definition:"
    cat service-status.json | grep -o '"taskDefinition":"[^"]*"' | head -1
    
    echo ""
    echo "📊 Running/Pending Tasks:"
    cat service-status.json | grep -o '"runningCount":[0-9]*'
    cat service-status.json | grep -o '"pendingCount":[0-9]*'
    
    echo ""
    echo "🚀 Deployment Status:"
    cat service-status.json | grep -o '"status":"[^"]*"' | head -1
    
else
    echo "❌ Failed to get service info"
    cat service-status.json
fi

echo ""
echo "🧪 Testing current application:"
curl -X POST https://edsteward.ai/api/register \
    -H 'Content-Type: application/json' \
    -d '{"username":"test-'$(date +%s)'","password":"test123","confirmPassword":"test123"}' \
    2>/dev/null | head -c 200

echo ""
echo ""
echo "🎯 Next Steps:"
echo "1. If task definition shows 'edsteward:2' = ✅ NEW RDS DATABASE IS CONFIGURED"
echo "2. If pendingCount > 0 = ⏳ DEPLOYMENT STILL IN PROGRESS"  
echo "3. If you see 'User created' in test = ✅ FIXED!"
echo "4. If you see SSL certificate error = ❌ OLD CODE STILL RUNNING" 