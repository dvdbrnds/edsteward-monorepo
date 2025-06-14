#!/bin/bash

echo "🔧 DEPLOYING DATABASE FIX - Registration 500 Resolution"
echo "====================================================="
echo ""

echo "Issue: Database connection string parsing error"
echo "Fix: Clean SSL certificate path parsing in database.ts"
echo ""

echo "Building new Docker image with database fix..."
BUILD_TIME=$(date +%Y%m%d-%H%M%S)
IMAGE_TAG="v12.1-db-fix-$BUILD_TIME"

# CRITICAL: Always build for linux/amd64 platform to prevent deployment issues
docker buildx build --platform linux/amd64 --load -t edsteward:$IMAGE_TAG .

echo "Tagging for ECR..."
docker tag edsteward:$IMAGE_TAG 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:$IMAGE_TAG

echo "Pushing to ECR..."
docker push 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:$IMAGE_TAG

echo "Creating new task definition with fix..."
aws ecs register-task-definition \
  --family edsteward-task \
  --task-role-arn arn:aws:iam::259661441422:role/edsteward-task-role \
  --execution-role-arn arn:aws:iam::259661441422:role/edstewardTaskExecutionRole \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 512 \
  --memory 1024 \
  --container-definitions "[{
    \"name\": \"edsteward\",
    \"image\": \"259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:$IMAGE_TAG\",
    \"portMappings\": [{\"containerPort\": 3000, \"protocol\": \"tcp\"}],
    \"essential\": true,
    \"environment\": [
      {\"name\": \"NODE_ENV\", \"value\": \"production\"},
      {\"name\": \"DATABASE_URL\", \"value\": \"postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=disable\"}
    ],
    \"logConfiguration\": {
      \"logDriver\": \"awslogs\",
      \"options\": {
        \"awslogs-group\": \"/aws/ecs/edsteward\",
        \"awslogs-region\": \"us-east-1\",
        \"awslogs-stream-prefix\": \"ecs\"
      }
    }
  }]" \
  --region us-east-1

echo "Getting new revision..."
NEW_REVISION=$(aws ecs describe-task-definition --task-definition edsteward-task --region us-east-1 --query 'taskDefinition.revision' --output text)

echo "Updating service with database fix..."
aws ecs update-service \
  --cluster edsteward-cluster \
  --service edsteward-service \
  --task-definition edsteward-task:$NEW_REVISION \
  --force-new-deployment \
  --region us-east-1

echo "✅ Deployment initiated with database fix"
echo "Image: $IMAGE_TAG"
echo "Revision: $NEW_REVISION"

echo ""
echo "Waiting 2 minutes for deployment..."
sleep 120

echo ""
echo "Testing registration after fix..."
curl -s -X POST https://edsteward.ai/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123","email":"test@test.com","firstName":"Test","lastName":"User","role":"user","department":"IT"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "If you see 'User created' or 'User already exists', the fix worked!"
echo "The database connection string parsing issue should be resolved." 