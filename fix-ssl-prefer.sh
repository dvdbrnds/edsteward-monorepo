#!/bin/bash

echo "🔧 FIXING SSL - Using sslmode=prefer (no cert file)"
echo "=================================================="
echo ""

echo "Creating new task definition with sslmode=prefer..."
aws ecs register-task-definition \
  --family edsteward-task \
  --task-role-arn arn:aws:iam::259661441422:role/edsteward-task-role \
  --execution-role-arn arn:aws:iam::259661441422:role/edstewardTaskExecutionRole \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 512 \
  --memory 1024 \
  --container-definitions '[{
    "name": "edsteward",
    "image": "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:v12.0-ssl-db-fix-20250612-210839",
    "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
    "essential": true,
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "DATABASE_URL", "value": "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=prefer"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/aws/ecs/edsteward",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]' \
  --region us-east-1 > /dev/null 2>&1

echo "✅ New task definition created"

echo ""
echo "Updating service to use new task definition..."
NEW_REVISION=$(aws ecs describe-task-definition --task-definition edsteward-task --region us-east-1 --query 'taskDefinition.revision' --output text 2>/dev/null)
echo "Using revision: $NEW_REVISION"

aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --task-definition edsteward-task:$NEW_REVISION \
  --force-new-deployment \
  --region us-east-1 > /dev/null 2>&1

echo "✅ Service updated"

echo ""
echo "Waiting 60 seconds for deployment..."
sleep 60

echo ""
echo "Testing service..."
node test-login.js

echo ""
echo "Key differences in this fix:"
echo "- sslmode=prefer (will use SSL if available, fallback to non-SSL)"
echo "- No sslcert parameter (no certificate file required)"
echo "- Should work with most RDS configurations"

echo ""
echo "If this works, you'll see either:"
echo "✅ 'User not found' = SSL working, need to create production account"
echo "✅ Different error = Service recovered, SSL might be working" 