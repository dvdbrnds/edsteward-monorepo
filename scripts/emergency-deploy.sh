#!/bin/zsh

# Emergency deployment script for EdSteward using AWS CodeBuild
# This script uses the WORKING development environment configuration

set -e

# Set AWS pager to prevent interactive prompts
export AWS_PAGER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log "🚨 Starting emergency deployment for EdSteward..."

# Step 1: Create source archive
log "Creating source archive..."
rm -rf /tmp/edsteward-source.zip
zip -r /tmp/edsteward-source.zip . \
    -x "*.git*" \
    -x "node_modules/*" \
    -x "coverage/*" \
    -x "dist/*" \
    -x "*.log" \
    -x "test-results/*" \
    -x "playwright-report/*" \
    || error "Failed to create source archive"

# Step 2: Create buildspec that mirrors working dev environment
log "Creating buildspec for bcryptjs fix using working dev environment..."
cat > buildspec.yml << 'EOF'
version: 0.2
phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
      - echo Creating emergency Dockerfile based on working dev environment...
      - |
        cat > Dockerfile.emergency << 'DOCKEREOF'
        # Emergency production Dockerfile based on working dev environment
        FROM public.ecr.aws/lambda/nodejs:18-x86_64

        # Install system dependencies
        RUN yum update -y && yum install -y git curl zip unzip

        # Set working directory
        WORKDIR /app

        # Copy package files first for better caching
        COPY package.json package-lock.json ./

        # Install dependencies (same as working dev environment)
        RUN npm ci --legacy-peer-deps --no-audit --no-fund

        # Replace bcrypt with bcryptjs (EXACT same as working dev environment)
        RUN npm uninstall bcrypt --legacy-peer-deps && npm install bcryptjs @types/bcryptjs --legacy-peer-deps

        # Copy source code
        COPY . .

        # Ensure docs directory exists
        RUN mkdir -p /app/docs/api

        # Build the application
        RUN npm run build

        # Create necessary directories
        RUN mkdir -p /app/uploads /app/logs

        # Expose port
        EXPOSE 3000

        # Start the application
        CMD ["npm", "start"]
        DOCKEREOF
  build:
    commands:
      - echo Build started on `date`
      - echo Building the Docker image...
      - docker build -f Dockerfile.emergency -t $IMAGE_REPO_NAME:$IMAGE_TAG .
      - docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG
      - docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest
  post_build:
    commands:
      - echo Build completed on `date`
      - echo Pushing the Docker image...
      - docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG
      - docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest
      - echo Updating ECS service...
      - aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment --region $AWS_DEFAULT_REGION
EOF

# Step 3: Upload to S3
log "Uploading source to S3..."
aws s3 cp /tmp/edsteward-source.zip s3://259661441422-codebuild-source/edsteward-source.zip || error "Failed to upload to S3"

# Step 4: Trigger CodeBuild
log "Triggering CodeBuild..."
BUILD_ID=$(aws codebuild start-build \
    --project-name edsteward-emergency-build \
    --environment-variables-override \
        name=AWS_DEFAULT_REGION,value=us-east-1 \
        name=AWS_ACCOUNT_ID,value=259661441422 \
        name=IMAGE_REPO_NAME,value=edsteward-multi-tenant \
        name=IMAGE_TAG,value=working-bcryptjs-$(date +%s) \
    --query 'build.id' --output text) || error "Failed to start CodeBuild"

log "CodeBuild started with ID: $BUILD_ID"

# Step 5: Wait for build completion
log "Waiting for build to complete..."
while true; do
    BUILD_STATUS=$(aws codebuild batch-get-builds --ids $BUILD_ID --query 'builds[0].buildStatus' --output text)
    
    if [[ "$BUILD_STATUS" == "SUCCEEDED" ]]; then
        log "✅ Build completed successfully!"
        break
    elif [[ "$BUILD_STATUS" == "FAILED" ]] || [[ "$BUILD_STATUS" == "FAULT" ]] || [[ "$BUILD_STATUS" == "STOPPED" ]] || [[ "$BUILD_STATUS" == "TIMED_OUT" ]]; then
        error "❌ Build failed with status: $BUILD_STATUS"
    else
        log "⏳ Build status: $BUILD_STATUS - waiting..."
        sleep 10
    fi
done

# Step 6: Wait for ECS deployment
log "Waiting for ECS deployment to complete..."
sleep 30

# Step 7: Check deployment status
log "Checking deployment status..."
RUNNING_COUNT=$(aws ecs describe-services \
    --cluster edsteward-cluster \
    --services edsteward-service \
    --region us-east-1 \
    --query 'services[0].runningCount' \
    --output text)

if [[ "$RUNNING_COUNT" -eq 1 ]]; then
    log "✅ ECS service is running with 1 healthy task"
else
    warn "⚠️  ECS service running count: $RUNNING_COUNT"
fi

# Step 8: Test the application
log "Testing application..."
sleep 30
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://moravian.edsteward.ai || echo "000")

if [[ "$HTTP_STATUS" == "200" ]]; then
    log "🎉 SUCCESS! Application is responding with HTTP 200"
    log "✅ Emergency deployment completed successfully!"
    log "🌐 Application available at: https://moravian.edsteward.ai"
else
    warn "⚠️  Application responding with HTTP $HTTP_STATUS"
    log "📋 Check ECS logs for more details"
fi

# Cleanup
rm -f buildspec.yml /tmp/edsteward-source.zip

log "🚀 Emergency deployment script completed!" 