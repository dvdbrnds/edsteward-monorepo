#!/bin/zsh

# Manual deployment script to update ECS service with existing image
# This bypasses Docker build issues

set -e

# Configuration
AWS_REGION="us-east-1"
ECS_CLUSTER="edsteward-cluster"
ECS_SERVICE="edsteward-service"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Export AWS pager to avoid issues
export AWS_PAGER=""

log "🚀 Manual ECS Service Update"
log "Cluster: $ECS_CLUSTER"
log "Service: $ECS_SERVICE"

# Force new deployment to restart tasks with latest image
log "Forcing new deployment..."
if aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --force-new-deployment \
    --region $AWS_REGION > /dev/null; then
    success "ECS service update initiated"
else
    error "Failed to update ECS service"
fi

# Wait for deployment to complete
log "Waiting for deployment to complete..."
sleep 5

# Check service status
log "Checking service status..."
SERVICE_STATUS=$(aws ecs describe-services \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION \
    --query 'services[0].{status:status,runningCount:runningCount,desiredCount:desiredCount}' \
    --output text)

echo "Service Status: $SERVICE_STATUS"

# Check if any tasks are running
RUNNING_COUNT=$(echo $SERVICE_STATUS | awk '{print $2}')
DESIRED_COUNT=$(echo $SERVICE_STATUS | awk '{print $3}')

if [ "$RUNNING_COUNT" -eq "$DESIRED_COUNT" ] && [ "$RUNNING_COUNT" -gt 0 ]; then
    success "✅ Deployment successful! Running tasks: $RUNNING_COUNT/$DESIRED_COUNT"
    success "🌐 Check https://moravian.edsteward.ai"
else
    log "⚠️  Deployment in progress. Running tasks: $RUNNING_COUNT/$DESIRED_COUNT"
    log "Run this script again in a few minutes to check status"
fi 