#!/bin/zsh

echo "🚀 Deploying Context7 Session Fix to AWS ECS..."

# Set AWS region
export AWS_DEFAULT_REGION=us-east-1

# Update ECS service with new task definition
echo "📋 Updating ECS service..."
aws ecs update-service \
  --cluster edsteward-simple \
  --service edsteward-service \
  --task-definition edsteward-task-session-debug:7 \
  --force-new-deployment \
  --output table

if [ $? -eq 0 ]; then
    echo "✅ ECS service update initiated successfully"
    echo "⏱️  Waiting for deployment to complete..."
    echo "🔍 You can monitor the deployment in the AWS Console"
    echo "🌐 Test URL: http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com/api/health"
else
    echo "❌ Failed to update ECS service"
    exit 1
fi

echo "🎯 Context7 session fix deployment initiated!"
echo "📝 The deployment should resolve the session cookie issue in AWS" 