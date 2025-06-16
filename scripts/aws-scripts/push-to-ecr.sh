#!/bin/zsh

# Push Docker image to AWS ECR
# Usage: ./push-to-ecr.sh <image_name>

set -e

IMAGE_NAME="${1:-regulatorytrackr-app}"
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY="edsteward-repo"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"

echo "📤 Pushing image to ECR..."
echo "🏷️  Image: $IMAGE_NAME"
echo "🏷️  ECR URI: $ECR_URI"

# Get ECR login token
echo "🔐 Authenticating with ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# Create production tag with timestamp
PROD_TAG=$(date +%Y%m%d-%H%M%S)-prod
LATEST_TAG="latest"

echo "🏷️  Tagging image for ECR..."
echo "  Local image: ${IMAGE_NAME}:latest"
echo "  ECR tags: ${ECR_URI}:${PROD_TAG}, ${ECR_URI}:${LATEST_TAG}"

# Tag the image for ECR
docker tag "${IMAGE_NAME}:latest" "${ECR_URI}:${PROD_TAG}"
docker tag "${IMAGE_NAME}:latest" "${ECR_URI}:${LATEST_TAG}"

# Push both tags to ECR
echo "📤 Pushing tagged image to ECR..."
docker push "${ECR_URI}:${PROD_TAG}"
docker push "${ECR_URI}:${LATEST_TAG}"

# Store the production tag for later use
echo "${ECR_URI}:${PROD_TAG}" > .production-image-tag
echo "${PROD_TAG}" > .production-tag

echo "✅ Successfully pushed to ECR"
echo "📋 Production image: ${ECR_URI}:${PROD_TAG}"
echo "📋 Tag saved to .production-image-tag"

# Verify the image was pushed
echo "🔍 Verifying image in ECR..."
if aws ecr describe-images --repository-name $ECR_REPOSITORY --image-ids imageTag=$PROD_TAG --region $AWS_REGION > /dev/null 2>&1; then
    echo "✅ Image verification successful"
else
    echo "❌ Image verification failed"
    exit 1
fi 