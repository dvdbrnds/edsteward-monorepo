#!/bin/bash

echo "🚨 FIXING SSL ISSUE - EdSteward Production"
echo "=========================================="
echo ""

# Direct AWS commands without table formatting
echo "Step 1: Forcing deployment of SSL task definition..."
aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --task-definition edsteward-task:63 \
  --force-new-deployment \
  --region us-east-1 > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Deployment command executed successfully"
else
  echo "❌ Deployment command failed"
  exit 1
fi

echo ""
echo "Step 2: Waiting for deployment to start (30 seconds)..."
sleep 30

echo ""
echo "Step 3: Testing login endpoint..."
node test-login.js

echo ""
echo "Step 4: Next Actions Based on Result:"
echo "- If still shows 'no encryption': Wait another 2-3 minutes, then re-test"
echo "- If shows 'User not found': SSL is fixed! Go to https://edsteward.ai/register"
echo "- If other error: Check CloudWatch logs for details"

echo ""
echo "📋 Manual Commands for Reference:"
echo "# Check deployment status:"
echo "aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1"
echo ""
echo "# View logs:"
echo "aws logs tail /aws/ecs/edsteward --follow --region us-east-1"
echo ""
echo "# Test again:"
echo "node test-login.js" 