#!/bin/zsh

# ============================================================================
# EdSteward Staging Deployment Script
# ============================================================================
# Safely deploy to the staging environment.
# This is a REQUIRED step before any production deployment.
#
# Usage: ./scripts/deploy-staging.sh <version>
# Example: ./scripts/deploy-staging.sh v1.2.3
#
# The script will:
#   1. Build the Docker image
#   2. Push to ECR with version tag and staging-latest
#   3. Update ECS task definition
#   4. Deploy to staging cluster
#   5. Wait for healthy deployment
#   6. Record deployment for production gate
# ============================================================================

set -e

# Get script directory and source common functions
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"
source "$SCRIPT_DIR/lib/safety-checks.sh"

# Configuration
CLUSTER_NAME="edsteward-staging-cluster"
SERVICE_NAME="edsteward-staging-service"
TASK_FAMILY="edsteward-staging-task"
ENVIRONMENT="staging"
STAGING_URL="https://staging.edsteward.ai"

# Parse arguments
VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
    echo -e "${RED}Error: Version required${NC}"
    echo ""
    echo "Usage: ./scripts/deploy-staging.sh <version>"
    echo "Example: ./scripts/deploy-staging.sh v1.2.3"
    echo ""
    echo "To create a new version tag:"
    echo "  ./scripts/tag-release.sh minor"
    exit 1
fi

# Validate version format
validate_version "$VERSION"

print_banner "EdSteward Staging Deployment" "STAGING"

# Pre-flight checks
run_preflight_checks

# Check for uncommitted changes (warning only for staging)
check_uncommitted_changes

# Check if deployment is already in progress
check_deployment_in_progress "$CLUSTER_NAME" "$SERVICE_NAME"

# Get current version for comparison
CURRENT_VERSION=$(get_current_version "$CLUSTER_NAME" "$SERVICE_NAME")
log "Current staging version: $CURRENT_VERSION"
log "Deploying version: $VERSION"

if [[ "$VERSION" == "$CURRENT_VERSION" ]]; then
    warn "Version $VERSION is already deployed to staging."
    read "?Re-deploy anyway? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "Aborted."
        exit 0
    fi
fi

echo ""
step "1/6 - Building Frontend"
clear_port 3000
build_frontend

echo ""
step "2/6 - Building Docker Image"
build_docker_image "$VERSION"

echo ""
step "3/6 - Logging into ECR"
ecr_login

echo ""
step "4/6 - Pushing Images to ECR"
push_docker_image "$VERSION"
tag_and_push "$VERSION" "staging-latest"

echo ""
step "5/6 - Updating ECS Task Definition"

# Create task definition with the new image
log "Creating new task definition..."

TASK_DEF_JSON=$(cat << EOF
{
  "family": "${TASK_FAMILY}",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "edsteward-app",
      "image": "${ECR_URI}:${VERSION}",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {"name": "NODE_ENV", "value": "staging"},
        {"name": "PORT", "value": "3000"},
        {"name": "HOSTNAME", "value": "0.0.0.0"},
        {"name": "ENVIRONMENT", "value": "staging"},
        {"name": "BASE_URL", "value": "${STAGING_URL}"},
        {"name": "VERSION", "value": "${VERSION}"}
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:edsteward/staging/database-url"
        },
        {
          "name": "SESSION_SECRET",
          "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:edsteward/staging/session-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/edsteward-staging",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF
)

echo "$TASK_DEF_JSON" > /tmp/staging-task-def.json

TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file:///tmp/staging-task-def.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text \
    --region "$AWS_REGION")

rm -f /tmp/staging-task-def.json
success "Task definition registered: $TASK_DEF_ARN"

echo ""
step "6/6 - Deploying to ECS"

log "Updating ECS service..."
aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --task-definition "$TASK_DEF_ARN" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null

# Wait for deployment with progress
show_deployment_progress "$CLUSTER_NAME" "$SERVICE_NAME" 300

# Verify health
echo ""
log "Verifying deployment health..."
verify_health "$STAGING_URL" 30 10

# Record successful deployment
record_deployment "$ENVIRONMENT" "$VERSION" "success" "$TASK_DEF_ARN" "$CURRENT_VERSION"

# Final summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 STAGING DEPLOYMENT SUCCESSFUL!                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Version Deployed:${NC}    $VERSION"
echo -e "  ${CYAN}Previous Version:${NC}    $CURRENT_VERSION"
echo -e "  ${CYAN}Task Definition:${NC}     $TASK_DEF_ARN"
echo -e "  ${CYAN}Staging URL:${NC}         $STAGING_URL"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Test your changes at: $STAGING_URL"
echo "  2. Verify all functionality works as expected"
echo "  3. When ready, deploy to production:"
echo ""
echo -e "     ${CYAN}./scripts/deploy-production.sh $VERSION${NC}"
echo ""
