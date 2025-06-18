#!/bin/bash

echo "🚨 EMERGENCY SSL FIX - EdSteward"
echo "================================"
echo ""

echo "1. Checking if SSL task definition exists and is correct..."
aws ecs describe-task-definition \
  --task-definition edsteward-task:63 \
  --region us-east-1 \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' \
  --output text > ssl_check.txt 2>/dev/null

if grep -q "sslmode=require" ssl_check.txt; then
  echo "✅ SSL task definition is correct"
else
  echo "❌ SSL task definition issue detected"
  echo "Task definition 63 may not have SSL configuration"
fi

echo ""
echo "2. Forcing service to scale down and up (hard reset)..."

# Scale to 0
echo "   Scaling service to 0 tasks..."
aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --desired-count 0 \
  --region us-east-1 > /dev/null 2>&1

echo "   Waiting 30 seconds for tasks to stop..."
sleep 30

# Scale back to 1 with SSL task definition
echo "   Scaling back to 1 task with SSL configuration..."
aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --task-definition edsteward-task:63 \
  --desired-count 1 \
  --force-new-deployment \
  --region us-east-1 > /dev/null 2>&1

echo ""
echo "3. Waiting 60 seconds for new task to start..."
sleep 60

echo ""
echo "4. Testing SSL connection..."
node test-login.js

echo ""
echo "📋 If still failing, manual options:"
echo "Option A: Check CloudWatch logs for specific errors"
echo "Option B: Update RDS security group to allow non-SSL temporarily"
echo "Option C: Create new task definition with different SSL approach"
echo ""
echo "Manual commands:"
echo "aws logs tail /aws/ecs/edsteward --follow --region us-east-1"
echo "aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1"

# Cleanup
rm -f ssl_check.txt 