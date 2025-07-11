#!/bin/zsh

echo "🔍 Checking Deployment Status"
echo "============================"

# Check ECS service status
echo "📊 ECS Service Status:"
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1 --query "services[0].serviceName" --output text

# Check task count
echo "🔢 Task Count:"
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1 --query "services[0].runningCount" --output text

# Test health endpoint
echo "🏥 Health Check:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://moravian.edsteward.ai/api/health

# Test regulations endpoint
echo "📋 Regulations API:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://moravian.edsteward.ai/api/regulations

# Test HEAD request
echo "🔍 HEAD Request:"
curl -s -I -o /dev/null -w "HTTP %{http_code}\n" https://moravian.edsteward.ai/api/regulations

echo "✅ Deployment check complete" 