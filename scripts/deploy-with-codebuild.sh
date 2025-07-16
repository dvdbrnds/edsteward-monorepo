#!/bin/zsh

# 🚀 EdSteward AWS CodeBuild Deployment
# This builds the Docker image in AWS CodeBuild, avoiding local Docker issues
# Usage: ./scripts/deploy-with-codebuild.sh

set -e

# Fix AWS CLI pager issue in zsh
export AWS_PAGER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="259661441422"
ECR_REPOSITORY="edsteward-multi-tenant"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"
ECS_CLUSTER="edsteward-cluster"
ECS_SERVICE="edsteward-service"
CODEBUILD_PROJECT="edsteward-builder"
COMMIT_SHA=$(git rev-parse --short HEAD)
IMAGE_TAG="prod-${COMMIT_SHA}"

# Functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

echo -e "${BLUE}🚀 EdSteward CodeBuild Deployment${NC}"
echo "=================================================================="

# Step 1: Pre-flight checks
log "Running pre-flight checks..."
if ! command -v aws &> /dev/null; then
    error "AWS CLI not found. Install with: brew install awscli"
fi
success "Pre-flight checks passed"

# Step 2: Build frontend locally (this works)
log "Building frontend..."
if ! npm run build; then
    error "Frontend build failed"
fi
success "Frontend build completed"

# Step 3: Create buildspec.yml for CodeBuild
log "Creating CodeBuild configuration..."
cat > buildspec.yml << 'EOF'
version: 0.2
phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
  build:
    commands:
      - echo Build started on `date`
      - echo Building Docker image...
      - docker build --platform linux/amd64 -t $IMAGE_REPO_NAME:$IMAGE_TAG .
      - docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG
      - docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest
  post_build:
    commands:
      - echo Build completed on `date`
      - echo Pushing Docker image...
      - docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG
      - docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest
EOF

# Step 4: Create or update CodeBuild project
log "Setting up CodeBuild project..."
cat > codebuild-project.json << EOF
{
  "name": "${CODEBUILD_PROJECT}",
  "description": "Build EdSteward Docker image",
  "source": {
    "type": "GITHUB",
    "location": "https://github.com/your-repo/edsteward.git"
  },
  "artifacts": {
    "type": "NO_ARTIFACTS"
  },
  "environment": {
    "type": "LINUX_CONTAINER",
    "image": "aws/codebuild/standard:7.0",
    "computeType": "BUILD_GENERAL1_MEDIUM",
    "privilegedMode": true,
    "environmentVariables": [
      {
        "name": "AWS_DEFAULT_REGION",
        "value": "${AWS_REGION}"
      },
      {
        "name": "AWS_ACCOUNT_ID",
        "value": "${AWS_ACCOUNT_ID}"
      },
      {
        "name": "IMAGE_REPO_NAME",
        "value": "${ECR_REPOSITORY}"
      },
      {
        "name": "IMAGE_TAG",
        "value": "${IMAGE_TAG}"
      }
    ]
  },
  "serviceRole": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/service-role/codebuild-service-role"
}
EOF

# Step 5: Create the CodeBuild project (if it doesn't exist)
if ! aws codebuild batch-get-projects --names ${CODEBUILD_PROJECT} --region ${AWS_REGION} | grep -q '"projects": \[\]'; then
    log "CodeBuild project exists, updating..."
    aws codebuild update-project --cli-input-json file://codebuild-project.json --region ${AWS_REGION}
else
    log "Creating CodeBuild project..."
    aws codebuild create-project --cli-input-json file://codebuild-project.json --region ${AWS_REGION}
fi

# Step 6: Create source bundle
log "Creating source bundle..."
rm -f edsteward-source.zip
zip -r edsteward-source.zip . -x "node_modules/*" "*.git*" "*.zip" "coverage/*" "test-results/*"

# Step 7: Upload to S3 for CodeBuild
S3_BUCKET="edsteward-codebuild-source"
log "Uploading source to S3..."
aws s3 cp edsteward-source.zip s3://${S3_BUCKET}/edsteward-source.zip --region ${AWS_REGION}

# Step 8: Start CodeBuild
log "Starting CodeBuild..."
BUILD_ID=$(aws codebuild start-build \
    --project-name ${CODEBUILD_PROJECT} \
    --source-override "type=S3,location=${S3_BUCKET}/edsteward-source.zip" \
    --region ${AWS_REGION} \
    --query 'build.id' \
    --output text)

success "CodeBuild started: ${BUILD_ID}"

# Step 9: Wait for build to complete
log "Waiting for build to complete..."
while true; do
    BUILD_STATUS=$(aws codebuild batch-get-builds \
        --ids ${BUILD_ID} \
        --region ${AWS_REGION} \
        --query 'builds[0].buildStatus' \
        --output text)
    
    if [ "$BUILD_STATUS" = "SUCCEEDED" ]; then
        success "Build completed successfully!"
        break
    elif [ "$BUILD_STATUS" = "FAILED" ] || [ "$BUILD_STATUS" = "FAULT" ] || [ "$BUILD_STATUS" = "STOPPED" ] || [ "$BUILD_STATUS" = "TIMED_OUT" ]; then
        error "Build failed with status: $BUILD_STATUS"
    fi
    
    log "Build status: $BUILD_STATUS - waiting..."
    sleep 30
done

# Step 10: Update ECS Service
log "Updating ECS service..."
aws ecs update-service \
    --cluster ${ECS_CLUSTER} \
    --service ${ECS_SERVICE} \
    --force-new-deployment \
    --region ${AWS_REGION}

success "ECS service update initiated"

# Step 11: Cleanup
log "Cleaning up..."
rm -f buildspec.yml codebuild-project.json edsteward-source.zip

echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETED!${NC}"
echo "=================================================================="
echo -e "${GREEN}✅ EdSteward deployed via CodeBuild${NC}"
echo -e "${BLUE}🌐 URL: https://edsteward-alb-554701445.us-east-1.elb.amazonaws.com${NC}"
echo -e "${BLUE}📦 Image: ${ECR_URI}:${IMAGE_TAG}${NC}"
echo -e "${BLUE}🏗️  Build: ${BUILD_ID}${NC}"

# Save deployment status
cat > deployment-status.json << EOF
{
  "deploymentTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "imageTag": "${IMAGE_TAG}",
  "commitSha": "${COMMIT_SHA}",
  "buildId": "${BUILD_ID}",
  "deploymentMethod": "codebuild",
  "ecrUri": "${ECR_URI}",
  "cluster": "${ECS_CLUSTER}",
  "service": "${ECS_SERVICE}",
  "status": "completed",
  "url": "https://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
}
EOF

echo -e "\n${GREEN}🎯 DEPLOYMENT READY!${NC}" 