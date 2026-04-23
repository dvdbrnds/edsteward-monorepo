#!/bin/zsh

# ============================================================================
# EdSteward Per-Tenant Deployment
# ============================================================================
# Deploys a specific Docker image tag to a single tenant's ECS service.
#
# Usage:
#   ./scripts/deploy-tenant.sh <tenant-id> <image-tag> [--yes]
#
# Examples:
#   ./scripts/deploy-tenant.sh desales v1.5.15
#   ./scripts/deploy-tenant.sh moravian v1.5.16 --yes
#
# The script will:
#   1. Look up the tenant's ECS cluster/service/task-family (from env or defaults)
#   2. Verify the image tag exists in ECR
#   3. Clone the current task definition with the new image
#   4. Register the new task definition revision
#   5. Update the ECS service to use it
#   6. Wait for the service to stabilize
#   7. Verify health
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

# Parse global flags
parse_global_flags "$@"

# ---- Arguments ----
TENANT_ID="${1:-}"
IMAGE_TAG="${2:-}"

if [[ -z "$TENANT_ID" || -z "$IMAGE_TAG" ]]; then
    echo -e "${RED}Usage: $0 <tenant-id> <image-tag> [--yes]${NC}"
    echo ""
    echo "  tenant-id   Tenant identifier (e.g. desales, moravian)"
    echo "  image-tag   Docker image tag to deploy (e.g. v1.5.15)"
    echo "  --yes       Skip confirmation prompt"
    echo ""
    echo "Tenant ECS config is read from environment variables:"
    echo "  <TENANT>_ECS_CLUSTER   (default: edsteward-cluster)"
    echo "  <TENANT>_ECS_SERVICE   (default: edsteward-<tenant>)"
    echo "  <TENANT>_ECS_TASK_FAMILY (default: edsteward-<tenant>-task)"
    echo ""
    echo "Or override globally:"
    echo "  ECS_CLUSTER, ECS_SERVICE, ECS_TASK_FAMILY"
    exit 1
fi

# ---- Resolve tenant-specific ECS config ----
TENANT_UPPER="${TENANT_ID:u}"  # zsh uppercase

# Per-tenant overrides take precedence, then global env, then convention-based defaults
CLUSTER="${(P)${TENANT_UPPER}_ECS_CLUSTER:-${ECS_CLUSTER:-edsteward-cluster}}"
SERVICE="${(P)${TENANT_UPPER}_ECS_SERVICE:-${ECS_SERVICE:-edsteward-${TENANT_ID}}}"
TASK_FAMILY="${(P)${TENANT_UPPER}_ECS_TASK_FAMILY:-${ECS_TASK_FAMILY:-edsteward-${TENANT_ID}-task}}"

print_banner "Per-Tenant Deploy: $TENANT_ID" "$IMAGE_TAG"

log "Tenant:       $TENANT_ID"
log "Image Tag:    $IMAGE_TAG"
log "ECR Repo:     $ECR_REPOSITORY"
log "ECS Cluster:  $CLUSTER"
log "ECS Service:  $SERVICE"
log "Task Family:  $TASK_FAMILY"
echo ""

# ---- Pre-flight ----
run_preflight_checks

# ---- Verify image exists in ECR ----
step "Verifying image tag exists in ECR..."
if ! image_exists_in_ecr "$IMAGE_TAG"; then
    error "Image tag '$IMAGE_TAG' not found in ECR repository '$ECR_REPOSITORY'. Push it first."
fi
success "Image $IMAGE_TAG exists in ECR"

# ---- Get current version ----
CURRENT_VERSION=$(get_current_version "$CLUSTER" "$SERVICE")
log "Current running version: $CURRENT_VERSION"

if [[ "$CURRENT_VERSION" == "$IMAGE_TAG" ]]; then
    warn "Service is already running $IMAGE_TAG. Use --yes to force redeploy."
    if ! confirm_prompt "Force redeploy anyway?"; then
        echo "Aborted."
        exit 0
    fi
fi

# ---- Confirmation ----
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  DEPLOY SUMMARY${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Tenant:    ${CYAN}$TENANT_ID${NC}"
echo -e "  Current:   ${RED}$CURRENT_VERSION${NC}"
echo -e "  New:       ${GREEN}$IMAGE_TAG${NC}"
echo -e "  Service:   $SERVICE"
echo -e "  Cluster:   $CLUSTER"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if ! confirm_prompt "Deploy $IMAGE_TAG to $TENANT_ID?"; then
    echo "Aborted."
    exit 0
fi

# ---- Clone task definition with new image ----
step "Getting current task definition: $TASK_FAMILY"
CURRENT_TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition "$TASK_FAMILY" \
    --region "$AWS_REGION" \
    --query 'taskDefinition' \
    --output json)

# Build new task definition JSON (strip AWS-injected fields, update image)
step "Creating new task definition revision with image $ECR_URI:$IMAGE_TAG"
NEW_TASK_DEF=$(echo "$CURRENT_TASK_DEF" | jq \
    --arg IMAGE "$ECR_URI:$IMAGE_TAG" \
    --arg VERSION "$IMAGE_TAG" \
    'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)
     | .containerDefinitions[0].image = $IMAGE
     | (.containerDefinitions[0].environment // []) |= map(if .name == "VERSION" then .value = $VERSION else . end)')

# ---- Register new task definition ----
step "Registering new task definition..."
REGISTER_OUTPUT=$(aws ecs register-task-definition \
    --cli-input-json "$NEW_TASK_DEF" \
    --region "$AWS_REGION" \
    --output json)

NEW_TASK_DEF_ARN=$(echo "$REGISTER_OUTPUT" | jq -r '.taskDefinition.taskDefinitionArn')
NEW_REVISION=$(echo "$REGISTER_OUTPUT" | jq -r '.taskDefinition.revision')
success "Registered: $TASK_FAMILY:$NEW_REVISION"

# ---- Update ECS service ----
step "Updating ECS service $SERVICE to revision $NEW_REVISION..."
aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$SERVICE" \
    --task-definition "$NEW_TASK_DEF_ARN" \
    --force-new-deployment \
    --region "$AWS_REGION" \
    --output text > /dev/null

success "ECS service update initiated"

# ---- Wait for stabilization ----
wait_for_service_stable "$CLUSTER" "$SERVICE"

# ---- Health check ----
TENANT_URL="https://${TENANT_ID}.edsteward.ai"
verify_health "$TENANT_URL"

# ---- Record deployment ----
record_deployment "$TENANT_ID" "$IMAGE_TAG" "success" "$NEW_TASK_DEF_ARN" "$CURRENT_VERSION"

echo ""
success "Deployment complete!"
echo -e "  Tenant:   ${CYAN}$TENANT_ID${NC}"
echo -e "  Version:  ${GREEN}$IMAGE_TAG${NC}"
echo -e "  URL:      $TENANT_URL"
echo -e "  Task Def: $TASK_FAMILY:$NEW_REVISION"
