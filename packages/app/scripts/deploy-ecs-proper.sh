#!/bin/zsh

# Proper ECS Deployment Script - Fixes the recurring image update issue
# This script ensures the ECS service actually uses the latest Docker image

set -e

# Configuration
CLUSTER_NAME="edsteward-cluster"
SERVICE_NAME="edsteward-service"
TASK_FAMILY="edsteward-saml-step3"
ECR_REPOSITORY="259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant"
AWS_REGION="us-east-1"

# Disable AWS pager
export AWS_PAGER=""

# Generate unique tag using timestamp and git commit
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
GIT_COMMIT=$(git rev-parse --short HEAD)
IMAGE_TAG="deploy-${TIMESTAMP}-${GIT_COMMIT}"

echo "🚀 Starting proper ECS deployment..."
echo "📦 Image tag: ${IMAGE_TAG}"

# Step 1: Build Docker image with unique tag
echo "🔨 Building Docker image..."
docker build --platform linux/amd64 -t ${ECR_REPOSITORY}:${IMAGE_TAG} .

# Step 2: Authenticate with ECR
echo "🔐 Authenticating with ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPOSITORY}

# Step 3: Push image to ECR
echo "📤 Pushing image to ECR..."
docker push ${ECR_REPOSITORY}:${IMAGE_TAG}

# Step 4: Download current task definition
echo "📥 Downloading current task definition..."
aws ecs describe-task-definition \
    --task-definition ${TASK_FAMILY} \
    --query taskDefinition > current-task-def.json

# Step 5: Update task definition with new image
echo "✏️  Updating task definition with new image..."
cat current-task-def.json | \
    jq ".containerDefinitions[0].image = \"${ECR_REPOSITORY}:${IMAGE_TAG}\"" | \
    jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)' \
    > updated-task-def.json

# Step 6: Register new task definition
echo "📝 Registering new task definition..."
NEW_TASK_DEF=$(aws ecs register-task-definition \
    --cli-input-json file://updated-task-def.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "✅ New task definition: ${NEW_TASK_DEF}"

# Step 7: Update ECS service with new task definition
echo "🔄 Updating ECS service..."
aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service ${SERVICE_NAME} \
    --task-definition ${NEW_TASK_DEF}

# Step 8: Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
aws ecs wait services-stable \
    --cluster ${CLUSTER_NAME} \
    --services ${SERVICE_NAME}

# Step 9: Verify deployment
echo "🔍 Verifying deployment..."
CURRENT_IMAGE=$(aws ecs describe-services \
    --cluster ${CLUSTER_NAME} \
    --services ${SERVICE_NAME} \
    --query 'services[0].taskDefinition' \
    --output text | xargs aws ecs describe-task-definition \
    --task-definition --query 'taskDefinition.containerDefinitions[0].image' \
    --output text)

echo "✅ Deployment complete!"
echo "🎯 Current running image: ${CURRENT_IMAGE}"
echo "🏷️  Expected image: ${ECR_REPOSITORY}:${IMAGE_TAG}"

# Clean up temporary files
rm -f current-task-def.json updated-task-def.json

if [[ "${CURRENT_IMAGE}" == "${ECR_REPOSITORY}:${IMAGE_TAG}" ]]; then
    echo "🎉 SUCCESS: ECS service is running the correct image!"
else
    echo "❌ ERROR: ECS service is NOT running the expected image!"
    exit 1
fi
