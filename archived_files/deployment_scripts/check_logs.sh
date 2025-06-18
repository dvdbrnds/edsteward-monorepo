#!/bin/bash

echo "=== Checking ECS Service Status ==="
aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --region us-east-1 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}' \
  --output table

echo ""
echo "=== Getting Latest CloudWatch Logs ==="
LOG_GROUP="/aws/ecs/edsteward"

# Check if log group exists
if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region us-east-1 --query 'logGroups[0].logGroupName' --output text > /dev/null 2>&1; then
  echo "Found log group: $LOG_GROUP"
  
  # Get latest log events (last 50 lines)
  aws logs tail "$LOG_GROUP" --since 5m --region us-east-1 | tail -50
else
  echo "Log group $LOG_GROUP not found. Trying alternative names..."
  
  # List all ECS-related log groups
  echo "Available ECS log groups:"
  aws logs describe-log-groups --log-group-name-prefix "/aws/ecs" --region us-east-1 --query 'logGroups[].logGroupName' --output table
fi

echo ""
echo "=== Getting Latest ECS Task Details ==="
TASKS=$(aws ecs list-tasks --cluster edsteward-cluster --region us-east-1 --query 'taskArns' --output text)
if [ -n "$TASKS" ]; then
  echo "Found tasks: $TASKS"
  aws ecs describe-tasks --cluster edsteward-cluster --tasks $TASKS --region us-east-1 --query 'tasks[0].{TaskArn:taskArn,LastStatus:lastStatus,HealthStatus:healthStatus,CreatedAt:createdAt}'
else
  echo "No tasks found"
fi

echo ""
echo "=== Health Check ==="
echo "Testing ALB endpoint..."
curl -v edsteward-alb-554701445.us-east-1.elb.amazonaws.com/health 2>&1 | head -20 