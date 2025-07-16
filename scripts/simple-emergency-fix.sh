#!/bin/zsh

# Simple emergency fix for EdSteward 503 error
# This ensures the production deployment uses bcryptjs like the working dev environment

set -e

# Configuration
AWS_REGION="us-east-1"
ECS_CLUSTER="edsteward-cluster"
ECS_SERVICE="edsteward-service"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Export AWS pager
export AWS_PAGER=""

log "🚨 Simple Emergency Fix for EdSteward 503 Error"

# Step 1: Verify local development environment is working
log "Checking local development environment..."
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    error "Local development environment is not responding. Please start with: docker-compose -f docker-compose.dev.yml up"
fi
success "Local development environment is working"

# Step 2: Commit current working state
log "Committing current working state..."
git add -A
git commit -m "Emergency fix: bcryptjs working in development" || true
success "Current state committed"

# Step 3: Create a deployment-ready Dockerfile specifically for this fix
log "Creating deployment-ready Dockerfile..."
cat > Dockerfile.emergency << 'EOF'
# Emergency fix Dockerfile - ensures bcryptjs is used
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    bash \
    python3 \
    make \
    g++ \
    libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies with bcryptjs fix
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# CRITICAL: Replace bcrypt with bcryptjs for Alpine compatibility
RUN npm uninstall bcrypt --legacy-peer-deps && npm install bcryptjs @types/bcryptjs --legacy-peer-deps

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs /app/dist

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Set up user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Set permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Start the application
CMD ["npm", "start"]
EOF

# Step 4: Build the emergency Docker image
log "Building emergency Docker image..."
if docker build -f Dockerfile.emergency -t edsteward-emergency .; then
    success "Emergency Docker image built successfully"
else
    error "Failed to build emergency Docker image"
fi

# Step 5: Test the emergency image locally
log "Testing emergency image locally..."
docker run -d --name edsteward-emergency-test -p 3001:3000 edsteward-emergency

# Wait for container to start
sleep 10

# Test the container
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 | grep -q "200"; then
    success "Emergency image is working locally"
else
    error "Emergency image failed local test"
fi

# Stop test container
docker stop edsteward-emergency-test
docker rm edsteward-emergency-test

# Step 6: Push to ECR (manual instructions)
log "Emergency image is ready!"
success "✅ The emergency image 'edsteward-emergency' has been built and tested"

log "Manual deployment instructions:"
log "1. Tag the image: docker tag edsteward-emergency 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant:emergency-fix"
log "2. Login to ECR: aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259661441422.dkr.ecr.us-east-1.amazonaws.com"
log "3. Push image: docker push 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant:emergency-fix"
log "4. Update ECS service: aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment --region us-east-1"

log "Or run: ./scripts/push-emergency-image.sh"

# Step 7: Create push script
cat > scripts/push-emergency-image.sh << 'EOF'
#!/bin/zsh
set -e

ECR_URI="259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant"
export AWS_PAGER=""

echo "🚀 Pushing emergency image to ECR..."

# Tag image
docker tag edsteward-emergency $ECR_URI:emergency-fix
docker tag edsteward-emergency $ECR_URI:latest

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259661441422.dkr.ecr.us-east-1.amazonaws.com

# Push images
docker push $ECR_URI:emergency-fix
docker push $ECR_URI:latest

# Update ECS service
aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment --region us-east-1

echo "✅ Emergency deployment initiated!"
EOF

chmod +x scripts/push-emergency-image.sh

success "Emergency fix complete! Run ./scripts/push-emergency-image.sh to deploy" 