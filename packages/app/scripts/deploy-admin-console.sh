#!/bin/zsh

# ============================================================================
# EdSteward Admin Console Deployment Script
# ============================================================================
# Deploy the admin console to admin.edsteward.ai via AWS ECS.
#
# Usage: ./scripts/deploy-admin-console.sh <version> [--yes|-y]
# Example: ./scripts/deploy-admin-console.sh v1.5.15
#
# Prerequisites:
#   - AWS CLI configured with appropriate permissions
#   - Docker running (Colima on macOS)
#   - ECR repository created: edsteward-admin-console
#   - ECS cluster, service, and task definition created
#   - ALB listener rule routing admin.edsteward.ai to this service
#
# The script will:
#   1. Build the Docker image from admin-console/Dockerfile.production
#   2. Push to ECR with version tag
#   3. Update ECS task definition
#   4. Deploy to ECS
#   5. Wait for healthy deployment
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

# Configuration -- must match actual AWS resource names
CLUSTER_NAME="${ADMIN_CLUSTER:-edsteward-cluster}"
SERVICE_NAME="${ADMIN_SERVICE:-admin-console-service}"
TASK_FAMILY="${ADMIN_TASK_FAMILY:-edsteward-admin-console}"
ECR_REPO_NAME="edsteward-admin-console"
ADMIN_ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"
ADMIN_CONSOLE_DIR="$SCRIPT_DIR/../admin-console"
ADMIN_URL="https://admin.edsteward.ai"

# Parse global flags
parse_global_flags "$@"

VERSION=""
for arg in "$@"; do
    case "$arg" in
        --yes|-y) ;;
        *) VERSION="$arg" ;;
    esac
done

if [[ -z "$VERSION" ]]; then
    echo -e "${RED}Error: Version required${NC}"
    echo ""
    echo "Usage: ./scripts/deploy-admin-console.sh <version>"
    echo "Example: ./scripts/deploy-admin-console.sh v1.5.15"
    exit 1
fi

print_banner "EdSteward Admin Console Deployment" "ADMIN"

# Pre-flight: verify Docker is running
log "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running. Start Colima: colima start${NC}"
    exit 1
fi

# Pre-flight: verify AWS credentials
log "Checking AWS credentials..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}AWS credentials not configured. Run: aws configure${NC}"
    exit 1
fi

# Ensure ECR repository exists
log "Ensuring ECR repository exists..."
aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" > /dev/null 2>&1 || \
    aws ecr create-repository \
        --repository-name "$ECR_REPO_NAME" \
        --image-scanning-configuration scanOnPush=true \
        --region "$AWS_REGION"

# ECR login
log "Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build the image (linux/amd64 for Fargate)
log "Building admin console Docker image (${VERSION}) for linux/amd64..."
docker build \
    --platform linux/amd64 \
    -f "$ADMIN_CONSOLE_DIR/Dockerfile.production" \
    -t "${ADMIN_ECR_URI}:${VERSION}" \
    -t "${ADMIN_ECR_URI}:latest" \
    "$ADMIN_CONSOLE_DIR"

# Push to ECR
log "Pushing to ECR..."
docker push "${ADMIN_ECR_URI}:${VERSION}"
docker push "${ADMIN_ECR_URI}:latest"

# Get current task definition
log "Fetching current task definition..."
CURRENT_TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition "$TASK_FAMILY" \
    --query 'taskDefinition' \
    --output json 2>/dev/null || echo "")

if [[ -z "$CURRENT_TASK_DEF" || "$CURRENT_TASK_DEF" == "" ]]; then
    warn "No existing task definition found for $TASK_FAMILY."
    warn "You need to create the initial ECS task definition, service, and ALB rule manually."
    warn "Image has been pushed to: ${ADMIN_ECR_URI}:${VERSION}"
    echo ""
    echo -e "${CYAN}Next steps to complete first-time deployment:${NC}"
    echo "  1. Create ECS task definition '$TASK_FAMILY' with image ${ADMIN_ECR_URI}:${VERSION}"
    echo "  2. Set environment variables: DATABASE_URL, ADMIN_CONSOLE_PASSWORD, ADMIN_CONSOLE_EMAIL, etc."
    echo "  3. Create ECS service '$SERVICE_NAME' in cluster '$CLUSTER_NAME'"
    echo "  4. Add ALB listener rule for admin.edsteward.ai -> target group"
    echo "  5. Re-run this script to deploy updates"
    exit 0
fi

# Update task definition with new image
log "Registering new task definition..."
NEW_TASK_DEF=$(echo "$CURRENT_TASK_DEF" | \
    jq --arg IMAGE "${ADMIN_ECR_URI}:${VERSION}" \
    '.containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

NEW_TASK_ARN=$(echo "$NEW_TASK_DEF" | \
    aws ecs register-task-definition --cli-input-json file:///dev/stdin \
    --query 'taskDefinition.taskDefinitionArn' --output text)

log "New task definition: $NEW_TASK_ARN"

# Update service
log "Updating ECS service..."
aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --task-definition "$NEW_TASK_ARN" \
    --force-new-deployment \
    --query 'service.deployments[0].{status:status,desired:desiredCount,running:runningCount}' \
    --output table

# Wait for deployment to stabilize
log "Waiting for ECS service to stabilize (up to 10 minutes)..."
WAIT_START=$SECONDS
if aws ecs wait services-stable \
    --cluster "$CLUSTER_NAME" \
    --services "$SERVICE_NAME" 2>/dev/null; then
    WAIT_ELAPSED=$(( SECONDS - WAIT_START ))
    success "ECS service stable in ${WAIT_ELAPSED}s"
else
    WAIT_ELAPSED=$(( SECONDS - WAIT_START ))
    warn "ECS wait timed out after ${WAIT_ELAPSED}s. Checking service events..."
    aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region "$AWS_REGION" \
        --query 'services[0].events[0:3].message' \
        --output text
fi

# Health check with retry
log "Verifying health at ${ADMIN_URL}/api/health..."
for i in 1 2 3 4 5; do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${ADMIN_URL}/api/health" 2>/dev/null || echo "000")
    if [[ "$HTTP_STATUS" == "200" ]]; then
        TOTAL_ELAPSED=$(( SECONDS ))
        echo -e "\n${GREEN}✅ Admin console deployed successfully! (${TOTAL_ELAPSED}s total)${NC}"
        echo -e "   URL: ${CYAN}${ADMIN_URL}${NC}"
        echo -e "   Version: ${VERSION}"
        echo -e "   Task Def: ${NEW_TASK_ARN}"
        exit 0
    fi
    [[ $i -lt 5 ]] && sleep 5
done

warn "Health check returned HTTP ${HTTP_STATUS} after 5 attempts."
warn "Service may still be starting. Check: aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME"
