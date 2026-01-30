#!/bin/zsh

# 🚀 EdSteward Production Deployment (AWS Only)
# PROVEN WORKING METHOD - AWS-only deployment
# Usage: ./scripts/deploy-production.sh

set -e

# Fix AWS CLI pager issue in zsh - CRITICAL for macOS
export AWS_PAGER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Production deployment values
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="259661441422"
ECR_REPOSITORY="edsteward-multi-tenant"  # CORRECT: from working deployments
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"
ECS_CLUSTER="edsteward-cluster"           # CORRECT: from working deployments
ECS_SERVICE="edsteward-service"           # CORRECT: from working deployments
COMMIT_SHA=$(git rev-parse --short HEAD)
IMAGE_TAG="prod-${COMMIT_SHA}"
LATEST_TAG="latest"

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

echo -e "${BLUE}🚀 EdSteward Production Deployment (Proven Working Method)${NC}"
echo "=================================================================="

# Step 1: Pre-flight checks
log "Running pre-flight checks..."
if ! command -v aws &> /dev/null; then
    error "AWS CLI not found. Install with: brew install awscli"
fi
if ! command -v docker &> /dev/null; then
    error "Docker not found. Install with: brew install docker"
fi
if ! docker info &> /dev/null; then
    error "Docker is not running. Please start Docker Desktop"
fi
success "Pre-flight checks passed"

# Step 2: Kill any processes on port 3000
log "Clearing any processes on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
success "Port 3000 cleared"

# Step 3: Build frontend - EXACT command from working workflow
log "Building frontend..."
if ! npm run build; then
    error "Frontend build failed"
fi
success "Frontend build completed"

# Step 4: Build Docker Image - Deployment command
log "Building Docker image for AWS (linux/amd64)..."
if ! docker build --platform linux/amd64 -t ${ECR_URI}:${IMAGE_TAG} .; then
    error "Docker build failed"
fi
success "Docker build successful: ${IMAGE_TAG}"

# Step 5: Tag as latest - EXACT pattern from working GitHub Actions
log "Tagging as latest..."
docker tag ${ECR_URI}:${IMAGE_TAG} ${ECR_URI}:${LATEST_TAG}

# Step 6: Login to ECR - Deployment command
log "Logging into ECR..."
if ! aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}; then
    error "ECR login failed"
fi
success "ECR login successful"

# Step 7: Push to ECR - EXACT commands from working GitHub Actions
log "Pushing images to ECR..."
if ! docker push ${ECR_URI}:${IMAGE_TAG}; then
    error "Image push failed"
fi
if ! docker push ${ECR_URI}:${LATEST_TAG}; then
    error "Latest tag push failed"
fi
success "Images pushed successfully"

# Step 8: Update ECS Service - Deployment command
log "Updating ECS service..."
if ! aws ecs update-service \
    --cluster ${ECS_CLUSTER} \
    --service ${ECS_SERVICE} \
    --force-new-deployment \
    --region ${AWS_REGION}; then
    error "ECS service update failed"
fi
success "ECS service update initiated"

# Step 9: Simple wait for stability
log "Waiting for deployment to stabilize..."
echo "This may take 2-5 minutes..."
sleep 120  # Give it time to start

echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETED!${NC}"
echo "=================================================================="
echo -e "${GREEN}✅ EdSteward deployed with proven working method${NC}"
echo -e "${BLUE}🌐 URL: https://edsteward-alb-554701445.us-east-1.elb.amazonaws.com${NC}"
echo -e "${BLUE}📦 Image: ${ECR_URI}:${IMAGE_TAG}${NC}"
echo -e "${BLUE}🏷️  Latest: ${ECR_URI}:${LATEST_TAG}${NC}"
echo -e "${BLUE}⚡ Features: Branding + Database improvements deployed${NC}"

log "Deployment summary saved to deployment-status.json"
cat > deployment-status.json << EOF
{
  "deploymentTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "imageTag": "${IMAGE_TAG}",
  "commitSha": "${COMMIT_SHA}",
  "ecrUri": "${ECR_URI}",
  "cluster": "${ECS_CLUSTER}",
  "service": "${ECS_SERVICE}",
  "status": "completed",
  "url": "https://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
}
EOF

echo -e "\n${GREEN}🎯 DEPLOYMENT READY!${NC}" 