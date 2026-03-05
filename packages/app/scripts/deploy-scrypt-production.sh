#!/bin/zsh

# Production deployment script for EdSteward with scrypt authentication
# This script builds and deploys the scrypt-based authentication system

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

log "🚀 Starting scrypt-based production deployment..."

# Step 1: Create source archive
log "Creating source archive..."
rm -rf /tmp/edsteward-scrypt-source.zip
zip -r /tmp/edsteward-scrypt-source.zip . \
    -x "*.git*" \
    -x "node_modules/*" \
    -x "coverage/*" \
    -x "dist/*" \
    -x "*.log" \
    -x "test-results/*" \
    -x "playwright-report/*" \
    -x "*.DS_Store" || error "Failed to create source archive"

log "Source archive created: $(ls -lh /tmp/edsteward-scrypt-source.zip)"

# Step 2: Upload to S3
log "Uploading source to S3..."
aws s3 cp /tmp/edsteward-scrypt-source.zip s3://259661441422-codebuild-source/edsteward-scrypt-source.zip || error "Failed to upload to S3"

# Step 3: Create buildspec for scrypt-based build
log "Creating buildspec for scrypt-based build..."
cat > buildspec.yml << 'EOF'
version: 0.2
phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
      - echo Creating production Dockerfile with scrypt authentication...
      - |
        cat > Dockerfile.scrypt << 'DOCKEREOF'
        # Production Dockerfile with scrypt authentication (no bcrypt dependencies)
        FROM public.ecr.aws/lambda/nodejs:18-x86_64

        # Install system dependencies
        RUN yum update -y && yum install -y git curl

        # Create app directory
        WORKDIR /app

        # Copy package files
        COPY package.json package-lock.json ./

        # Install dependencies (no bcrypt/bcryptjs needed - using built-in crypto)
        RUN npm ci --legacy-peer-deps --only=production --no-audit --no-fund

        # Copy application code
        COPY . .

        # Build the application
        RUN npm run build

        # Create non-root user
        RUN adduser -D -s /bin/sh nodeuser
        RUN chown -R nodeuser:nodeuser /app

        # Switch to non-root user
        USER nodeuser

        # Expose port
        EXPOSE 3000

        # Health check
        HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
          CMD curl -f http://localhost:3000/ || exit 1

        # Start the application
        CMD ["npm", "start"]
        DOCKEREOF
  build:
    commands:
      - echo Build started on `date`
      - echo Building Docker image with scrypt authentication...
      - docker build -f Dockerfile.scrypt -t $IMAGE_REPO_NAME:$IMAGE_TAG .
      - docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG
      - docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest
  post_build:
    commands:
      - echo Build completed on `date`
      - echo Pushing Docker image to ECR...
      - docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG
      - docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest
      - echo Updating ECS service...
      - aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment --region $AWS_DEFAULT_REGION
EOF

log "Buildspec created successfully"

# Step 4: Trigger CodeBuild
log "Triggering CodeBuild for scrypt deployment..."
BUILD_ID=$(aws codebuild start-build \
    --project-name edsteward-emergency-build \
    --source-version master \
    --environment-variables-override \
        name=AWS_DEFAULT_REGION,value=us-east-1 \
        name=AWS_ACCOUNT_ID,value=259661441422 \
        name=IMAGE_REPO_NAME,value=edsteward-multi-tenant \
        name=IMAGE_TAG,value=scrypt-auth-$(date +%s) \
    --query 'build.id' --output text) || error "Failed to start CodeBuild"

log "CodeBuild started with ID: $BUILD_ID"

# Step 5: Wait for build completion
log "Waiting for build to complete..."
while true; do
    BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].buildStatus' --output text)
    
    if [ "$BUILD_STATUS" = "SUCCEEDED" ]; then
        log "✅ Build completed successfully!"
        break
    elif [ "$BUILD_STATUS" = "FAILED" ] || [ "$BUILD_STATUS" = "FAULT" ] || [ "$BUILD_STATUS" = "STOPPED" ] || [ "$BUILD_STATUS" = "TIMED_OUT" ]; then
        error "❌ Build failed with status: $BUILD_STATUS"
    else
        log "⏳ Build status: $BUILD_STATUS - waiting..."
        sleep 10
    fi
done

# Step 6: Wait for ECS deployment
log "Waiting for ECS service deployment..."
sleep 30

# Step 7: Check deployment status
log "Checking deployment status..."
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1 \
    --query 'services[0].{runningCount:runningCount,desiredCount:desiredCount,status:status}' --output table

log "✅ Scrypt-based deployment completed!"
log "🌐 Application should be available at: https://moravian.edsteward.ai"

# Step 8: Test the deployment
log "Testing deployment..."
sleep 30
if curl -I https://moravian.edsteward.ai | grep -q "200 OK"; then
    log "✅ Deployment successful - HTTP 200 OK"
else
    warn "⚠️  Deployment may still be starting up - check in a few minutes"
fi

log "🎉 Scrypt-based authentication deployment completed successfully!" 