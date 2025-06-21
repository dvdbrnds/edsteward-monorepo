#!/bin/zsh

# CRITICAL: This script ALWAYS builds for AWS ECS (linux/amd64)
# Never build without this script for AWS deployments!

set -e

echo "🔧 Building Docker image for AWS ECS (linux/amd64 ONLY)"
echo "🚨 CRITICAL: This ensures compatibility with AWS Fargate/EC2"

# Get timestamp for unique tag
TIMESTAMP=$(date +%s)
IMAGE_TAG="aws-session-fix-${TIMESTAMP}"
ECR_REPO="259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward"
FULL_IMAGE_NAME="${ECR_REPO}:${IMAGE_TAG}"
PLATFORM="linux/amd64"

echo "📦 Building image: $FULL_IMAGE_NAME"
echo "🏗️  Platform: $PLATFORM (AWS Required)"

# Build with EXPLICIT platform specification for AWS
docker build \
  --platform "$PLATFORM" \
  --no-cache \
  -t "$FULL_IMAGE_NAME" \
  .

echo "✅ Image built successfully for AWS ECS"
echo "��️  Tag: $IMAGE_TAG"

# Verify the architecture
echo "🔍 Verifying image architecture..."
ARCH=$(docker image inspect "${ECR_REPO}:${IMAGE_TAG}" --format '{{.Architecture}}')
echo "📋 Architecture: ${ARCH}"

if [ "$ARCH" != "amd64" ]; then
    echo "❌ ERROR: Image architecture is ${ARCH}, not amd64!"
    echo "🚨 This image will NOT work on AWS ECS!"
    exit 1
fi

echo "✅ Architecture verified: ${ARCH} (AWS Compatible)"

# Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259661441422.dkr.ecr.us-east-1.amazonaws.com

# Push to ECR
echo "⬆️  Pushing to ECR..."
docker push "${ECR_REPO}:${IMAGE_TAG}"

echo "🎉 SUCCESS: Image pushed to ECR"
echo "🏷️  Full image: ${ECR_REPO}:${IMAGE_TAG}"
echo "📝 Use this tag in your task definition: ${IMAGE_TAG}"

# Output the tag for easy copying
echo ""
echo "=== COPY THIS TAG ==="
echo "${IMAGE_TAG}"
echo "===================" 