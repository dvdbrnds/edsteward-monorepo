#!/bin/zsh

# ============================================================================
# EdSteward Production Rollback Script
# ============================================================================
# Quickly rollback production to a previous version.
#
# Usage: 
#   ./scripts/rollback-production.sh           # Interactive mode
#   ./scripts/rollback-production.sh <version> # Specific version
#
# Examples:
#   ./scripts/rollback-production.sh           # Select from recent deployments
#   ./scripts/rollback-production.sh v1.2.2    # Rollback to specific version
# ============================================================================

set -e

# Get script directory and source common functions
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"
source "$SCRIPT_DIR/lib/safety-checks.sh"

# Production Configuration
CLUSTER_NAME="edsteward-cluster"
SERVICE_NAME="edsteward-service"
ENVIRONMENT="production"
PRODUCTION_URL="https://moravian.edsteward.ai"

# Parse arguments
TARGET_VERSION="${1:-}"

print_banner "EdSteward Production Rollback" "PRODUCTION"

echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  WARNING: This will rollback PRODUCTION to a previous version!        ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Pre-flight checks
run_preflight_checks

# Get current version
CURRENT_VERSION=$(get_current_version "$CLUSTER_NAME" "$SERVICE_NAME")
log "Current production version: $CURRENT_VERSION"

# Get project root for deployment records
PROJECT_ROOT=$(get_project_root)
DEPLOY_DIR="$PROJECT_ROOT/deployments/production"

# If no version specified, show interactive selection
if [[ -z "$TARGET_VERSION" ]]; then
    echo ""
    echo -e "${CYAN}Recent production deployments:${NC}"
    echo ""
    
    # List recent deployments with numbers for selection
    declare -a VERSIONS
    local i=1
    
    for file in $(ls -t "$DEPLOY_DIR"/*.json 2>/dev/null | head -n 10); do
        local version=$(jq -r '.version' "$file")
        local timestamp=$(jq -r '.timestamp' "$file")
        local status=$(jq -r '.status' "$file")
        local deployer=$(jq -r '.deployer' "$file")
        
        # Skip current version
        if [[ "$version" == "$CURRENT_VERSION" ]]; then
            echo -e "  ${BLUE}$i.${NC} $version - ${GREEN}CURRENT${NC} - $timestamp"
        else
            local status_color="$GREEN"
            if [[ "$status" == "rolled_back" ]]; then
                status_color="$YELLOW"
            fi
            echo -e "  ${BLUE}$i.${NC} $version - ${status_color}$status${NC} - $timestamp by $deployer"
        fi
        
        VERSIONS[$i]="$version"
        ((i++))
    done
    
    if [[ ${#VERSIONS[@]} -eq 0 ]]; then
        error "No deployment records found. Cannot determine available rollback versions."
    fi
    
    echo ""
    echo -n "Select version to rollback to (1-${#VERSIONS[@]}), or 'q' to quit: "
    read selection
    
    if [[ "$selection" == "q" || "$selection" == "Q" ]]; then
        echo "Cancelled."
        exit 0
    fi
    
    if [[ ! "$selection" =~ ^[0-9]+$ ]] || [[ $selection -lt 1 ]] || [[ $selection -gt ${#VERSIONS[@]} ]]; then
        error "Invalid selection: $selection"
    fi
    
    TARGET_VERSION="${VERSIONS[$selection]}"
fi

# Validate version format
validate_version "$TARGET_VERSION"

# Check we're not rolling back to current version
if [[ "$TARGET_VERSION" == "$CURRENT_VERSION" ]]; then
    error "Cannot rollback to current version ($CURRENT_VERSION). Already running."
fi

# Check if image exists in ECR
log "Verifying rollback image exists in ECR..."
if ! image_exists_in_ecr "$TARGET_VERSION"; then
    error "Image not found in ECR: $TARGET_VERSION. Cannot rollback."
fi
success "Rollback image found in ECR"

# Show confirmation
confirm_rollback "$TARGET_VERSION" "$CURRENT_VERSION"

# ============================================================================
# ROLLBACK
# ============================================================================

echo ""
step "1/3 - Preparing Rollback Task Definition"

# Get the task definition ARN from the deployment record
ROLLBACK_TASK_DEF=""
local rollback_record=$(ls -t "$DEPLOY_DIR"/*-${TARGET_VERSION}.json 2>/dev/null | head -n 1)

if [[ -n "$rollback_record" ]]; then
    ROLLBACK_TASK_DEF=$(jq -r '.taskDefinitionArn' "$rollback_record")
    log "Found original task definition: $ROLLBACK_TASK_DEF"
fi

# If we have the original task def and it's still valid, use it
if [[ -n "$ROLLBACK_TASK_DEF" && "$ROLLBACK_TASK_DEF" != "null" ]]; then
    # Verify task definition still exists
    if aws ecs describe-task-definition --task-definition "$ROLLBACK_TASK_DEF" --region "$AWS_REGION" &>/dev/null; then
        success "Using original task definition"
    else
        warn "Original task definition no longer exists, creating new one"
        ROLLBACK_TASK_DEF=""
    fi
fi

# If we don't have a valid task def, create a new one with the rollback image
if [[ -z "$ROLLBACK_TASK_DEF" || "$ROLLBACK_TASK_DEF" == "null" ]]; then
    log "Creating new task definition for rollback..."
    
    # Get the current task definition and update the image
    CURRENT_TASK_DEF=$(aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --query 'services[0].taskDefinition' \
        --output text \
        --region "$AWS_REGION")
    
    # Get the current task definition JSON and update the image
    aws ecs describe-task-definition \
        --task-definition "$CURRENT_TASK_DEF" \
        --query 'taskDefinition' \
        --region "$AWS_REGION" > /tmp/rollback-task-def-base.json
    
    # Update the image to the rollback version
    cat /tmp/rollback-task-def-base.json | \
        jq ".containerDefinitions[0].image = \"${ECR_URI}:${TARGET_VERSION}\"" | \
        jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)' \
        > /tmp/rollback-task-def.json
    
    ROLLBACK_TASK_DEF=$(aws ecs register-task-definition \
        --cli-input-json file:///tmp/rollback-task-def.json \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text \
        --region "$AWS_REGION")
    
    rm -f /tmp/rollback-task-def-base.json /tmp/rollback-task-def.json
    success "Created rollback task definition: $ROLLBACK_TASK_DEF"
fi

echo ""
step "2/3 - Executing Rollback"

log "Updating ECS service to rollback version..."
aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --task-definition "$ROLLBACK_TASK_DEF" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null

# Wait for rollback to complete
show_deployment_progress "$CLUSTER_NAME" "$SERVICE_NAME" 600

echo ""
step "3/3 - Verifying Rollback"

# Verify health
verify_health "$PRODUCTION_URL" 30 10

# Verify the correct version is running
NEW_VERSION=$(get_current_version "$CLUSTER_NAME" "$SERVICE_NAME")
if [[ "$NEW_VERSION" != "$TARGET_VERSION" ]]; then
    warn "Running version ($NEW_VERSION) doesn't match target ($TARGET_VERSION)"
    warn "The image tag may have been retagged. Verify manually."
fi

# Record the rollback
record_deployment "$ENVIRONMENT" "$TARGET_VERSION" "rolled_back" "$ROLLBACK_TASK_DEF" "$CURRENT_VERSION"

# Also update the previous deployment record to show it was rolled back from
if [[ -n "$rollback_record" ]]; then
    # Mark the failed version in a separate record
    local failed_record="$DEPLOY_DIR/$(date +"%Y-%m-%d")-${CURRENT_VERSION}-failed.json"
    cat > "$failed_record" << EOF
{
  "version": "$CURRENT_VERSION",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployer": "$(whoami)",
  "action": "rolled_back_from",
  "rolledBackTo": "$TARGET_VERSION",
  "status": "rolled_back_from",
  "environment": "$ENVIRONMENT"
}
EOF
fi

# Final summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ROLLBACK COMPLETED SUCCESSFULLY!                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Rolled Back From:${NC}    $CURRENT_VERSION"
echo -e "  ${CYAN}Rolled Back To:${NC}      $TARGET_VERSION"
echo -e "  ${CYAN}Task Definition:${NC}     $ROLLBACK_TASK_DEF"
echo -e "  ${CYAN}Production URL:${NC}      $PRODUCTION_URL"
echo -e "  ${CYAN}Executed By:${NC}         $(whoami)"
echo -e "  ${CYAN}Executed At:${NC}         $(date)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Verify the application is working: $PRODUCTION_URL"
echo "  2. Investigate what went wrong with $CURRENT_VERSION"
echo "  3. Fix the issue in a new version before deploying again"
echo ""
echo -e "${RED}Important:${NC} Document why this rollback was needed!"
echo ""
