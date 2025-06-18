#!/bin/bash

echo "🔧 DEPLOYING SSL CERTIFICATE FIX"
echo "================================="
echo "Issue: pg-connection-string library malforming SSL certificate paths"
echo "Fix: Proper SSL configuration parsing without file path errors"
echo ""

# Build new image with SSL fix
echo "🏗️ Building Docker image with SSL fix..."
# CRITICAL: Always build for linux/amd64 platform to prevent deployment issues
docker buildx build --platform linux/amd64 --load -t edsteward:v12.3-ssl-fix-$(date +%Y%m%d-%H%M%S) .

# Get the image tag
IMAGE_TAG=$(docker images edsteward --format "table {{.Tag}}" | grep ssl-fix | head -1)
echo "📦 Built image: edsteward:$IMAGE_TAG"

# Tag for ECR
echo "🏷️ Tagging for ECR..."
docker tag edsteward:$IMAGE_TAG 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:$IMAGE_TAG

# Push to ECR
echo "⬆️ Pushing to ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259661441422.dkr.ecr.us-east-1.amazonaws.com
docker push 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:$IMAGE_TAG

# Get current task definition
echo "📋 Getting current task definition..."
aws ecs describe-task-definition --task-definition edsteward --query 'taskDefinition' > current-task-def.json

# Create new task definition with SSL fix
echo "🔄 Creating new task definition..."
cat current-task-def.json | jq --arg IMAGE "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:$IMAGE_TAG" '
  .containerDefinitions[0].image = $IMAGE |
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)
' > new-task-def.json

# Register new task definition
NEW_REVISION=$(aws ecs register-task-definition --cli-input-json file://new-task-def.json --query 'taskDefinition.revision')
echo "✅ New task definition revision: $NEW_REVISION"

# Update service
echo "🚀 Updating ECS service..."
aws ecs update-service \
    --cluster edsteward \
    --service edsteward \
    --task-definition edsteward:$NEW_REVISION \
    --force-new-deployment

echo ""
echo "✅ SSL Fix Deployment Initiated"
echo "==============================="
echo "Image: $IMAGE_TAG"
echo "Revision: $NEW_REVISION"
echo ""
echo "🔧 Key SSL Fixes Applied:"
echo "✅ Proper URL parsing instead of string manipulation"
echo "✅ SSL certificate file existence check"
echo "✅ Fallback to SSL disabled if parsing fails"
echo "✅ No more malformed certificate file paths"
echo ""
echo "⏳ Waiting 2 minutes for deployment..."
sleep 120

echo ""
echo "🧪 Testing fixed registration..."
curl -s "https://edsteward.ai/api/register" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test123","password":"test123","confirmPassword":"test123"}' \
  | head -c 200

echo ""
echo ""
echo "🎯 If you see 'User created' or 'User already exists', the SSL fix worked!"
echo "If you still see SSL certificate errors, you may need to create a new RDS instance."

# Cleanup
rm -f current-task-def.json new-task-def.json 