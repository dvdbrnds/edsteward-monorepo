#!/bin/zsh

# ============================================================================
# EdSteward Deployment Safety Checks
# ============================================================================
# Safety gates and confirmation prompts for deployments.
# Source this file: source "$(dirname "$0")/lib/safety-checks.sh"
# ============================================================================

# Ensure deploy-common.sh is sourced first
if [[ -z "${BLUE:-}" ]]; then
    source "$(dirname "$0")/deploy-common.sh"
fi

# Check for uncommitted changes and warn
check_uncommitted_changes() {
    if has_uncommitted_changes; then
        echo ""
        warn "You have uncommitted changes in your working directory:"
        echo ""
        git status --short
        echo ""
        read "?Continue anyway? (y/N): " confirm
        if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
            echo "Aborted. Commit or stash your changes first."
            exit 0
        fi
    fi
}

# Verify version exists in staging before production deploy
require_staging_deployment() {
    local version="$1"
    
    if ! version_deployed_to_staging "$version"; then
        echo ""
        error "Version $version has not been deployed to staging yet!

Production deployments require:
  1. First deploy to staging: ./scripts/deploy-staging.sh $version
  2. Test on staging.edsteward.ai
  3. Then deploy to production: ./scripts/deploy-production.sh $version
"
    fi
    
    success "Version $version found in staging deployments"
}

# Require image to exist in ECR
require_image_in_ecr() {
    local tag="$1"
    
    log "Checking if image exists in ECR: $tag"
    
    if ! image_exists_in_ecr "$tag"; then
        error "Image not found in ECR: $tag
        
Build and push the image first:
  ./scripts/tag-release.sh <major|minor|patch>
  
Or deploy to staging which builds automatically:
  ./scripts/deploy-staging.sh $tag
"
    fi
    
    success "Image found in ECR: $tag"
}

# Show deployment summary before production
show_production_deploy_summary() {
    local version="$1"
    local current_version="$2"
    
    echo ""
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║                    PRODUCTION DEPLOYMENT WARNING                        ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${CYAN}Current Production Version:${NC}  $current_version"
    echo -e "  ${CYAN}Version to Deploy:${NC}           $version"
    echo -e "  ${CYAN}Commit SHA:${NC}                  $(get_commit_sha)"
    echo -e "  ${CYAN}Git Branch:${NC}                  $(get_git_branch)"
    echo -e "  ${CYAN}Deployer:${NC}                    $(whoami)"
    echo -e "  ${CYAN}Timestamp:${NC}                   $(date)"
    echo ""
    
    # Show recent commits if versions differ
    if [[ "$version" != "$current_version" && "$current_version" != "unknown" ]]; then
        echo -e "${CYAN}Changes since $current_version:${NC}"
        echo ""
        # Try to show git log between versions (if tags exist)
        git log --oneline "${current_version}..HEAD" 2>/dev/null | head -10 || echo "  (Could not determine changes)"
        echo ""
    fi
}

# Interactive confirmation for production deployment
confirm_production_deploy() {
    local version="$1"
    
    echo -e "${RED}This will deploy to PRODUCTION and affect real users.${NC}"
    echo ""
    echo -e "Type ${YELLOW}deploy production${NC} to confirm: "
    read confirmation
    
    if [[ "$confirmation" != "deploy production" ]]; then
        echo ""
        echo "Deployment cancelled."
        exit 0
    fi
    
    echo ""
    success "Production deployment confirmed"
}

# Full production deployment gate
production_deployment_gate() {
    local version="$1"
    local cluster="$2"
    local service="$3"
    
    # Get current version
    local current_version=$(get_current_version "$cluster" "$service")
    
    # Check if same version
    if [[ "$version" == "$current_version" ]]; then
        echo ""
        warn "Version $version is already deployed to production."
        read "?Force re-deployment anyway? (y/N): " confirm
        if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
            echo "Aborted."
            exit 0
        fi
    fi
    
    # Require staging deployment first
    require_staging_deployment "$version"
    
    # Check image exists
    require_image_in_ecr "$version"
    
    # Show summary
    show_production_deploy_summary "$version" "$current_version"
    
    # Require explicit confirmation
    confirm_production_deploy "$version"
    
    # Return current version for recording
    echo "$current_version"
}

# Rollback confirmation
confirm_rollback() {
    local target_version="$1"
    local current_version="$2"
    
    echo ""
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║                       PRODUCTION ROLLBACK                               ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${CYAN}Current Version:${NC}  $current_version"
    echo -e "  ${CYAN}Rolling Back To:${NC}  $target_version"
    echo ""
    echo -e "${RED}This will rollback production to a previous version.${NC}"
    echo ""
    echo -e "Type ${YELLOW}rollback production${NC} to confirm: "
    read confirmation
    
    if [[ "$confirmation" != "rollback production" ]]; then
        echo ""
        echo "Rollback cancelled."
        exit 0
    fi
    
    echo ""
    success "Rollback confirmed"
}

# Check staging health before allowing production deploy
verify_staging_health() {
    log "Verifying staging environment is healthy..."
    
    local staging_url="https://staging.edsteward.ai"
    
    if ! curl -sf "$staging_url/api/health" > /dev/null 2>&1; then
        echo ""
        warn "Staging environment health check failed!"
        echo "  URL: $staging_url/api/health"
        echo ""
        read "?Continue with production deployment anyway? (y/N): " confirm
        if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
            echo "Aborted. Fix staging first."
            exit 0
        fi
    else
        success "Staging health check passed"
    fi
}

# Validate environment argument
validate_environment() {
    local env="$1"
    
    case "$env" in
        staging|production)
            return 0
            ;;
        *)
            error "Invalid environment: $env. Must be 'staging' or 'production'"
            ;;
    esac
}

# Check if deployment is already in progress
check_deployment_in_progress() {
    local cluster="$1"
    local service="$2"
    
    local deployment_count=$(aws ecs describe-services \
        --cluster "$cluster" \
        --services "$service" \
        --query 'services[0].deployments | length(@)' \
        --output text \
        --region "$AWS_REGION" 2>/dev/null)
    
    if [[ "$deployment_count" -gt 1 ]]; then
        warn "A deployment is already in progress for $service"
        echo ""
        aws ecs describe-services \
            --cluster "$cluster" \
            --services "$service" \
            --query 'services[0].deployments[*].{Status:status,Running:runningCount,Desired:desiredCount,Created:createdAt}' \
            --output table \
            --region "$AWS_REGION" 2>/dev/null
        echo ""
        read "?Wait for current deployment to complete? (Y/n): " confirm
        if [[ "$confirm" == "n" || "$confirm" == "N" ]]; then
            echo "Aborted."
            exit 0
        fi
        
        log "Waiting for current deployment to complete..."
        wait_for_service_stable "$cluster" "$service"
    fi
}

# Rate limiting - prevent rapid deployments
check_deployment_cooldown() {
    local environment="$1"
    local cooldown_minutes="${2:-5}"
    
    local project_root=$(get_project_root)
    local deploy_dir="$project_root/deployments/$environment"
    local last_deploy=$(ls -t "$deploy_dir"/*.json 2>/dev/null | head -n 1)
    
    if [[ -n "$last_deploy" ]]; then
        local last_timestamp=$(jq -r '.timestamp' "$last_deploy")
        local last_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_timestamp" "+%s" 2>/dev/null || echo "0")
        local now_epoch=$(date "+%s")
        local diff_minutes=$(( (now_epoch - last_epoch) / 60 ))
        
        if [[ $diff_minutes -lt $cooldown_minutes ]]; then
            local last_version=$(jq -r '.version' "$last_deploy")
            warn "Last deployment ($last_version) was only $diff_minutes minutes ago."
            echo ""
            read "?Deploy again so soon? (y/N): " confirm
            if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
                echo "Aborted. Wait a few minutes before deploying again."
                exit 0
            fi
        fi
    fi
}

# Show deployment progress
show_deployment_progress() {
    local cluster="$1"
    local service="$2"
    local timeout="${3:-300}"
    
    echo ""
    log "Monitoring deployment progress..."
    echo ""
    
    local start_time=$(date +%s)
    local last_status=""
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [[ $elapsed -gt $timeout ]]; then
            error "Deployment timed out after ${timeout}s"
        fi
        
        local status=$(aws ecs describe-services \
            --cluster "$cluster" \
            --services "$service" \
            --query 'services[0].deployments[0].{Status:status,Running:runningCount,Desired:desiredCount}' \
            --output json \
            --region "$AWS_REGION" 2>/dev/null)
        
        local deploy_status=$(echo "$status" | jq -r '.Status')
        local running=$(echo "$status" | jq -r '.Running')
        local desired=$(echo "$status" | jq -r '.Desired')
        
        local progress_msg="  Status: $deploy_status | Running: $running/$desired | Elapsed: ${elapsed}s"
        
        if [[ "$progress_msg" != "$last_status" ]]; then
            echo -e "\r$progress_msg"
            last_status="$progress_msg"
        fi
        
        if [[ "$deploy_status" == "PRIMARY" && "$running" == "$desired" ]]; then
            echo ""
            success "Deployment completed in ${elapsed}s"
            return 0
        fi
        
        sleep 5
    done
}
