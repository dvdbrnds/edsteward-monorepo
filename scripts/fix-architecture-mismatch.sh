#!/bin/zsh

echo "🔧 Fixing Docker Architecture Mismatch Issue"
echo "=============================================="

# Set AWS pager to avoid issues
export AWS_PAGER=""

# Set variables
REGION="us-east-1"
REPOSITORY="259661441422.dkr.ecr.$REGION.amazonaws.com/edsteward"
TAG="fixed-architecture-$(date +%s)"
CLUSTER="edsteward-cluster"
SERVICE="edsteward-service"

echo "[INFO] Issue identified: bcrypt library compiled for wrong architecture"
echo "[INFO] Container built for ARM64 but running on x86_64 in ECS"
echo "[INFO] Solution: Rebuild Docker image with correct architecture targeting"

echo
echo "[INFO] Step 1: Building Docker image with x86_64 architecture..."
echo "[INFO] Using docker buildx to force x86_64 platform..."

# Build for x86_64 platform specifically
docker buildx build \
    --platform linux/amd64 \
    --no-cache \
    --tag $REPOSITORY:$TAG \
    --tag $REPOSITORY:latest \
    .

echo
echo "[INFO] Step 2: Pushing to ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REPOSITORY

docker push $REPOSITORY:$TAG
docker push $REPOSITORY:latest

echo
echo "[INFO] Step 3: Creating new task definition with corrected image..."
# Get current task definition and update the image
aws ecs describe-task-definition \
    --task-definition edsteward-fixed:1 \
    --region $REGION \
    --query 'taskDefinition' > /tmp/task-def.json

# Update the image URL in the task definition
sed -i.bak "s|\"image\": \".*\"|\"image\": \"$REPOSITORY:$TAG\"|g" /tmp/task-def.json

# Remove fields that shouldn't be in the registration
jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)' /tmp/task-def.json > /tmp/task-def-clean.json

# Register new task definition
NEW_TASK_DEF=$(aws ecs register-task-definition \
    --cli-input-json file:///tmp/task-def-clean.json \
    --region $REGION \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "[INFO] New task definition: $NEW_TASK_DEF"

echo
echo "[INFO] Step 4: Updating ECS service with new task definition..."
aws ecs update-service \
    --cluster $CLUSTER \
    --service $SERVICE \
    --task-definition $NEW_TASK_DEF \
    --force-new-deployment \
    --region $REGION

echo
echo "[INFO] Step 5: Monitoring deployment..."
echo "[INFO] Waiting for deployment to complete..."
sleep 30

echo
echo "[INFO] Step 6: Checking service status..."
aws ecs describe-services \
    --cluster $CLUSTER \
    --services $SERVICE \
    --region $REGION \
    --query 'services[0].{Running:runningCount,Pending:pendingCount,Desired:desiredCount}' \
    --output table

echo
echo "[INFO] Step 7: Checking target group health..."
aws elbv2 describe-target-health \
    --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-tg-alb/664e01592a97845a \
    --region $REGION

echo
echo "[INFO] Step 8: Testing application..."
curl -I https://moravian.edsteward.ai/health

echo
echo "✅ Architecture fix complete!"
echo "📋 Summary:"
echo "   - Built Docker image with linux/amd64 platform"
echo "   - Pushed image: $REPOSITORY:$TAG"
echo "   - Created new task definition: $NEW_TASK_DEF"
echo "   - Updated ECS service with new task definition"
echo "   - Forced new deployment"

echo
echo "🎯 If successful, the 503 error should be resolved!"
echo "🔍 Monitor the logs: aws logs tail /ecs/edsteward --follow" 