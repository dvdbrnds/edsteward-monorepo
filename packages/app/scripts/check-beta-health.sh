#!/bin/zsh

# Health check for beta environment
echo "🏥 EdSteward Beta Health Check"
echo "============================="

# Check ECS service status
echo "🔍 Checking ECS service status..."
aws ecs describe-services \
  --cluster edsteward-beta-cluster \
  --services edsteward-beta-service \
  --region us-east-1 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,TaskDefinition:taskDefinition}'

# Check ALB health
echo "🌐 Checking application health..."
curl -s -o /dev/null -w "%{http_code}" https://beta.edsteward.ai/health

# Check database connectivity
echo "🗄️ Checking database connectivity..."
# This will be filled in after beta DB is created

echo "✅ Beta health check complete!"
