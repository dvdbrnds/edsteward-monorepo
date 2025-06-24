#!/bin/zsh

# Manual deployment script for EdSteward Multi-Tenant
# Usage: ./scripts/deploy-manual.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}
COMMIT_HASH=$(git rev-parse --short HEAD)
ECR_REGISTRY="259661441422.dkr.ecr.us-east-1.amazonaws.com"
ECR_REPOSITORY="edsteward-multi-tenant"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Error: Environment must be 'staging' or 'production'"
    echo "Usage: $0 [staging|production]"
    exit 1
fi

echo "🚀 Starting deployment to $ENVIRONMENT..."
echo "📝 Commit: $COMMIT_HASH"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REGISTRY

# Build image
if [[ "$ENVIRONMENT" == "staging" ]]; then
    IMAGE_TAG="staging-$COMMIT_HASH"
    LATEST_TAG="staging-latest"
    CLUSTER="edsteward-multi-tenant-staging-cluster"
    SERVICE="edsteward-multi-tenant-staging-service"
    URL="https://staging.edsteward.ai"
else
    IMAGE_TAG="prod-$COMMIT_HASH"
    LATEST_TAG="latest"
    CLUSTER="edsteward-multi-tenant-cluster"
    SERVICE="edsteward-multi-tenant-service"
    URL="https://edsteward.ai"
fi

echo "🏗️  Building Docker image..."
docker build --platform linux/amd64 -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .

echo "📤 Pushing to ECR..."
docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

# Tag and push latest
docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:$LATEST_TAG
docker push $ECR_REGISTRY/$ECR_REPOSITORY:$LATEST_TAG

# Update ECS service
echo "🔄 Updating ECS service..."
aws ecs update-service \
    --cluster $CLUSTER \
    --service $SERVICE \
    --force-new-deployment \
    --region us-east-1 > /dev/null

echo "✅ Deployment initiated successfully!"
echo "🌐 URL: $URL"
echo "📊 Monitor deployment: aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region us-east-1"
echo ""
echo "⏳ Deployment typically takes 2-3 minutes to complete." 