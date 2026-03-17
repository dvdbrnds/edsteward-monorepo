#!/bin/zsh

# ============================================================================
# EdSteward Staging Deployment Script
# ============================================================================
# Safely deploy to the staging environment.
# This is a REQUIRED step before any production deployment.
#
# Usage: ./scripts/deploy-staging.sh <version> [--yes|-y]
# Example: ./scripts/deploy-staging.sh v1.2.3
# Example: ./scripts/deploy-staging.sh v1.2.3 --yes
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

# Parse global flags (--yes, -y)
parse_global_flags "$@"

# Parse arguments (skip flags)
VERSION=""
for arg in "$@"; do
    case "$arg" in
        --yes|-y) ;; # skip flags
        *) VERSION="$arg" ;;
    esac
done

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

# Check regulation ID alignment with production
if [[ -x "$SCRIPT_DIR/check-regulation-id-alignment.sh" ]]; then
    log "Checking regulation ID alignment with production..."
    if ! "$SCRIPT_DIR/check-regulation-id-alignment.sh"; then
        warn "Regulation IDs are misaligned with production!"
        warn "See: packages/app/scripts/db-align/README.md"
        if ! confirm_prompt "Deploy anyway?"; then
            echo "Aborted."
            exit 0
        fi
    fi
fi

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
    if ! confirm_prompt "Re-deploy anyway?"; then
        echo "Aborted."
        exit 0
    fi
fi

# ============================================================================
# SCHEMA SYNC — ensure staging DB has all columns/tables the new code expects.
# drizzle-kit push can't run non-interactively (prompts on table rename ambiguity),
# so we use sync-schema.js which only does ADD COLUMN / CREATE TABLE IF NOT EXISTS.
# ============================================================================
step "Schema Sync: Ensuring staging database matches code schema..."
cd "$SCRIPT_DIR/.."
node "$SCRIPT_DIR/sync-schema.cjs" --staging || {
    warn "Schema sync had errors (non-fatal). Review output above."
}
cd - > /dev/null

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

# Retrieve the currently ACTIVE (running) task definition and update only the image + version.
# This preserves correct Secrets Manager ARNs (which include random suffixes).
log "Retrieving active task definition as base..."

ACTIVE_TASK_DEF=$(aws ecs describe-services \
    --cluster "$CLUSTER_NAME" \
    --services "$SERVICE_NAME" \
    --query 'services[0].deployments[?status==`ACTIVE`].taskDefinition | [0]' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null)

if [[ -z "$ACTIVE_TASK_DEF" || "$ACTIVE_TASK_DEF" == "None" ]]; then
    ACTIVE_TASK_DEF=$(aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --query 'services[0].deployments[0].taskDefinition' \
        --output text \
        --region "$AWS_REGION" 2>/dev/null)
fi

log "Base task definition: $ACTIVE_TASK_DEF"

# Extract the full task definition JSON, keeping only the fields needed for registration
aws ecs describe-task-definition \
    --task-definition "$ACTIVE_TASK_DEF" \
    --query 'taskDefinition.{family:family,networkMode:networkMode,requiresCompatibilities:requiresCompatibilities,cpu:cpu,memory:memory,executionRoleArn:executionRoleArn,taskRoleArn:taskRoleArn,containerDefinitions:containerDefinitions}' \
    --output json \
    --region "$AWS_REGION" > /tmp/staging-task-def-base.json

# Update the image to the new version
log "Updating image to ${ECR_URI}:${VERSION}..."
python3 -c "
import json, sys
with open('/tmp/staging-task-def-base.json') as f:
    td = json.load(f)
td['containerDefinitions'][0]['image'] = '${ECR_URI}:${VERSION}'
# Update VERSION env var
for env in td['containerDefinitions'][0].get('environment', []):
    if env['name'] == 'VERSION':
        env['value'] = '${VERSION}'
        break
else:
    td['containerDefinitions'][0].setdefault('environment', []).append({'name': 'VERSION', 'value': '${VERSION}'})
with open('/tmp/staging-task-def.json', 'w') as f:
    json.dump(td, f, indent=2)
"

log "Creating new task definition..."

TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file:///tmp/staging-task-def.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text \
    --region "$AWS_REGION")

rm -f /tmp/staging-task-def.json /tmp/staging-task-def-base.json
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
