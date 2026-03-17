#!/bin/zsh

# ============================================================================
# EdSteward Production Deployment Script (GATED)
# ============================================================================
# Safely deploy to production with multiple safety gates.
#
# REQUIREMENTS:
#   - Version MUST have been deployed to staging first
#   - Interactive confirmation required
#   - Health checks must pass before completion
#
# Usage: ./scripts/deploy-production.sh <version> [--yes|-y]
# Example: ./scripts/deploy-production.sh v1.2.3
# Example: ./scripts/deploy-production.sh v1.2.3 --yes
#
# Safety Gates:
#   1. Version must exist in staging deployments
#   2. Image must exist in ECR
#   3. Staging health check must pass
#   4. Interactive "deploy production" confirmation
#   5. Cooldown check (warns if deploying too frequently)
# ============================================================================

set -e

# Get script directory and source common functions
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"
source "$SCRIPT_DIR/lib/safety-checks.sh"

# Production Configuration
CLUSTER_NAME="edsteward-cluster"
SERVICE_NAME="edsteward-service"
TASK_FAMILY="edsteward-saml-production"
ENVIRONMENT="production"
PRODUCTION_URL="https://moravian.edsteward.ai"

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
    echo "Usage: ./scripts/deploy-production.sh <version>"
    echo "Example: ./scripts/deploy-production.sh v1.2.3"
    echo ""
    echo -e "${YELLOW}IMPORTANT:${NC} The version must first be deployed to staging!"
    echo ""
    echo "Workflow:"
    echo "  1. Deploy to staging:    ./scripts/deploy-staging.sh v1.2.3"
    echo "  2. Test on staging"
    echo "  3. Deploy to production: ./scripts/deploy-production.sh v1.2.3"
    echo ""
    echo "Recent staging deployments:"
    list_deployments "staging" 5
    exit 1
fi

# Validate version format
validate_version "$VERSION"

print_banner "EdSteward Production Deployment" "PRODUCTION"

echo -e "${RED}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  WARNING: This will deploy to PRODUCTION and affect REAL USERS!       ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Pre-flight checks
run_preflight_checks

# Check for uncommitted changes
check_uncommitted_changes

# Check deployment cooldown (warn if < 5 minutes since last deploy)
check_deployment_cooldown "production" 5

# Get current production version BEFORE gates (for comparison)
CURRENT_VERSION=$(get_current_version "$CLUSTER_NAME" "$SERVICE_NAME")

# ============================================================================
# SAFETY GATES
# ============================================================================

echo ""
echo -e "${CYAN}=== Running Safety Gates ===${NC}"
echo ""

# Gate 1: Require staging deployment
step "Gate 1/4: Checking staging deployment..."
require_staging_deployment "$VERSION"

# Gate 2: Verify image exists in ECR
step "Gate 2/4: Verifying image in ECR..."
require_image_in_ecr "$VERSION"

# Gate 3: Check staging health
step "Gate 3/4: Verifying staging health..."
verify_staging_health

# Gate 4: Check no deployment in progress
step "Gate 4/4: Checking for in-progress deployments..."
check_deployment_in_progress "$CLUSTER_NAME" "$SERVICE_NAME"

echo ""
success "All safety gates passed!"

# ============================================================================
# SCHEMA SYNC — ensure production DB has all columns/tables the new code expects
# ============================================================================
echo ""
step "Schema Sync: Checking production database schema..."
node "$SCRIPT_DIR/sync-schema.js" --production || {
    warn "Schema sync encountered errors (non-fatal). Proceeding with deployment."
}

# Show deployment summary and get confirmation
show_production_deploy_summary "$VERSION" "$CURRENT_VERSION"
confirm_production_deploy "$VERSION"

# ============================================================================
# DEPLOYMENT
# ============================================================================

echo ""
step "1/3 - Creating ECS Task Definition"

# Retrieve the currently ACTIVE (running) task definition and update only the image + version.
# This preserves all existing environment variables including DATABASE_URL, SESSION_SECRET,
# and SAML configuration. NEVER recreate the task definition from scratch — secrets will be lost.
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

# Verify the base task definition has DATABASE_URL set (safety check)
DB_URL_CHECK=$(aws ecs describe-task-definition \
    --task-definition "$ACTIVE_TASK_DEF" \
    --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value | [0]' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null)

if [[ -z "$DB_URL_CHECK" || "$DB_URL_CHECK" == "None" || "$DB_URL_CHECK" == "" ]]; then
    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  SAFETY ABORT: Base task definition has empty DATABASE_URL!            ║${NC}"
    echo -e "${RED}║  This would deploy a broken container. Fix the active task def first.  ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    error "Cannot deploy: base task definition is missing DATABASE_URL"
fi

# Extract the full task definition JSON, keeping only the fields needed for registration
aws ecs describe-task-definition \
    --task-definition "$ACTIVE_TASK_DEF" \
    --query 'taskDefinition.{family:family,networkMode:networkMode,requiresCompatibilities:requiresCompatibilities,cpu:cpu,memory:memory,executionRoleArn:executionRoleArn,taskRoleArn:taskRoleArn,containerDefinitions:containerDefinitions}' \
    --output json \
    --region "$AWS_REGION" > /tmp/production-task-def-base.json

# Update only the image and VERSION env var — preserve everything else
log "Updating image to ${ECR_URI}:${VERSION}..."
python3 -c "
import json, sys
with open('/tmp/production-task-def-base.json') as f:
    td = json.load(f)
# Remove taskRoleArn if null (Fargate doesn't accept null)
if td.get('taskRoleArn') is None:
    del td['taskRoleArn']
td['containerDefinitions'][0]['image'] = '${ECR_URI}:${VERSION}'
# Update VERSION env var
for env in td['containerDefinitions'][0].get('environment', []):
    if env['name'] == 'VERSION':
        env['value'] = '${VERSION}'
        break
else:
    td['containerDefinitions'][0].setdefault('environment', []).append({'name': 'VERSION', 'value': '${VERSION}'})
with open('/tmp/production-task-def.json', 'w') as f:
    json.dump(td, f, indent=2)
"

log "Creating new task definition..."

TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file:///tmp/production-task-def.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text \
    --region "$AWS_REGION")

rm -f /tmp/production-task-def.json /tmp/production-task-def-base.json
success "Task definition registered: $TASK_DEF_ARN"

echo ""
step "2/3 - Deploying to ECS"

log "Updating ECS service..."
aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --task-definition "$TASK_DEF_ARN" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null

# Also tag the image as production-latest
log "Tagging image as production-latest..."
docker pull "$ECR_URI:$VERSION" 2>/dev/null || true
docker tag "$ECR_URI:$VERSION" "$ECR_URI:production-latest" 2>/dev/null || true
docker push "$ECR_URI:production-latest" 2>/dev/null || warn "Could not update production-latest tag"

# Wait for deployment with progress
show_deployment_progress "$CLUSTER_NAME" "$SERVICE_NAME" 600

echo ""
step "3/3 - Verifying Deployment Health"

# Verify health
verify_health "$PRODUCTION_URL" 30 10

# Record successful deployment
record_deployment "$ENVIRONMENT" "$VERSION" "success" "$TASK_DEF_ARN" "$CURRENT_VERSION"

# Final summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              PRODUCTION DEPLOYMENT SUCCESSFUL!                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Version Deployed:${NC}    $VERSION"
echo -e "  ${CYAN}Previous Version:${NC}    $CURRENT_VERSION"
echo -e "  ${CYAN}Task Definition:${NC}     $TASK_DEF_ARN"
echo -e "  ${CYAN}Production URL:${NC}      $PRODUCTION_URL"
echo -e "  ${CYAN}Deployed By:${NC}         $(whoami)"
echo -e "  ${CYAN}Deployed At:${NC}         $(date)"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "  - Monitor logs: aws logs tail /ecs/edsteward-saml-production --follow"
echo "  - Check health: curl $PRODUCTION_URL/api/health"
echo ""
echo -e "  If issues arise, rollback with:"
echo -e "     ${CYAN}./scripts/rollback-production.sh${NC}"
echo ""
