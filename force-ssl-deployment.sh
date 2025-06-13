#!/bin/bash

echo "🚀 Forcing SSL Deployment - EdSteward"
echo "====================================="

# Set AWS region
export AWS_DEFAULT_REGION=us-east-1

echo "1. Current service status:"
aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --query 'services[0].{TaskDefinition:taskDefinition,RunningCount:runningCount,DesiredCount:desiredCount}' \
  --output table

echo ""
echo "2. Forcing new deployment with SSL task definition..."
aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --task-definition edsteward-task:63 \
  --force-new-deployment

echo ""
echo "3. Checking deployment status..."
aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --query 'services[0].deployments[*].{Status:status,TaskDef:taskDefinition,CreatedAt:createdAt}' \
  --output table

echo ""
echo "4. Listing current running tasks..."
aws ecs list-tasks \
  --cluster edsteward-cluster \
  --service-name edsteward-service \
  --query 'taskArns' \
  --output table

echo ""
echo "✅ Deployment initiated. Check logs in 2-3 minutes:"
echo "   aws logs tail /aws/ecs/edsteward --follow --region us-east-1"
echo ""
echo "🔍 Verify SSL is working:"
echo "   curl -v https://edsteward.ai/api/health" 