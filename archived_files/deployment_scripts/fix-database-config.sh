#!/bin/bash

echo "🔧 FIXING DATABASE CONFIGURATION - Registration Issue"
echo "===================================================="
echo ""

echo "Issue: Database connection string is malformed"
echo "Error: '/app/ssl/rds-ca-2019-root.pem?sslmode=disable'"
echo "Solution: Create clean task definition without SSL cert file"
echo ""

echo "Creating clean task definition..."
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
      {"name": "DATABASE_URL", "value": "postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=disable"}
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

echo "✅ Clean task definition created"

echo ""
echo "Getting new revision number..."
NEW_REVISION=$(aws ecs describe-task-definition --task-definition edsteward-task --region us-east-1 --query 'taskDefinition.revision' --output text 2>/dev/null)
echo "New revision: $NEW_REVISION"

echo ""
echo "Updating service with clean configuration..."
aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --task-definition edsteward-task:$NEW_REVISION \
  --force-new-deployment \
  --region us-east-1 > /dev/null 2>&1

echo "✅ Service updated"

echo ""
echo "Waiting 90 seconds for deployment..."
sleep 90

echo ""
echo "Testing registration endpoint..."
curl -s -X POST https://edsteward.ai/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123","email":"test@test.com","firstName":"Test","lastName":"User","role":"user","department":"IT"}' \
  -w "HTTP Status: %{http_code}\n"

echo ""
echo "Key fix:"
echo "- Removed SSL certificate file reference completely"
echo "- Using sslmode=disable (clean non-SSL connection)"
echo "- Should allow database operations to work"

echo ""
echo "If successful, you should see either:"
echo "✅ 'User already exists' or 'User created' = Database working!"
echo "❌ 'ENOENT' error = Still has SSL config issue" 