#!/bin/zsh

# ============================================================================
# EdSteward Deployment Common Functions
# ============================================================================
# Shared functions for all deployment scripts.
# Source this file: source "$(dirname "$0")/lib/deploy-common.sh"
# ============================================================================

# Colors for output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export MAGENTA='\033[0;35m'
export NC='\033[0m' # No Color

# Configuration
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-259661441422}"
export ECR_REPOSITORY="${ECR_REPOSITORY:-edsteward-multi-tenant}"
export ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"

# Disable AWS pager
export AWS_PAGER=""

# Get the project root directory
get_project_root() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
    echo "$(cd "$script_dir/../.." && pwd)"
}

# Logging functions
log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { 
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}
step() { echo -e "${CYAN}[STEP]${NC} $1"; }
debug() { 
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${MAGENTA}[DEBUG]${NC} $1"
    fi
}

# Print a header banner
print_banner() {
    local title="$1"
    local env="${2:-}"
    
    echo -e "${CYAN}"
    echo "============================================================================"
    echo "  $title"
    if [[ -n "$env" ]]; then
        echo "  Environment: $env"
    fi
    echo "============================================================================"
    echo -e "${NC}"
}

# Validate a semantic version tag
validate_version() {
    local version="$1"
    
    if [[ ! "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
        error "Invalid version format: $version. Expected: v{major}.{minor}.{patch} (e.g., v1.2.3)"
    fi
    
    return 0
}

# Get current git commit SHA
get_commit_sha() {
    git rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

# Get current git branch
get_git_branch() {
    git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

# Check if there are uncommitted changes
has_uncommitted_changes() {
    if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
        return 0  # true
    fi
    return 1  # false
}

# Pre-flight checks for all deployments
run_preflight_checks() {
    log "Running pre-flight checks..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI not found. Install with: brew install awscli"
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker not found. Install with: brew install docker"
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker Desktop"
    fi
    
    # Check jq
    if ! command -v jq &> /dev/null; then
        error "jq not found. Install with: brew install jq"
    fi
    
    # Validate AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured or expired. Run: aws configure"
    fi
    
    # Verify AWS account
    local caller_account=$(aws sts get-caller-identity --query 'Account' --output text)
    if [[ "$caller_account" != "$AWS_ACCOUNT_ID" ]]; then
        error "AWS account mismatch. Expected: $AWS_ACCOUNT_ID, Got: $caller_account"
    fi
    
    success "Pre-flight checks passed"
}

# Login to ECR
ecr_login() {
    log "Logging into ECR..."
    if ! aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_URI" 2>/dev/null; then
        error "ECR login failed"
    fi
    success "ECR login successful"
}

# Build Docker image
build_docker_image() {
    local tag="$1"
    local platform="${2:-linux/amd64}"
    
    log "Building Docker image: $ECR_URI:$tag"
    
    if ! docker build --platform "$platform" -t "$ECR_URI:$tag" .; then
        error "Docker build failed"
    fi
    
    success "Docker image built: $tag"
}

# Push Docker image to ECR
push_docker_image() {
    local tag="$1"
    
    log "Pushing image to ECR: $tag"
    
    if ! docker push "$ECR_URI:$tag"; then
        error "Docker push failed for tag: $tag"
    fi
    
    success "Image pushed: $tag"
}

# Tag and push additional Docker tags
tag_and_push() {
    local source_tag="$1"
    local target_tag="$2"
    
    log "Tagging $source_tag as $target_tag"
    docker tag "$ECR_URI:$source_tag" "$ECR_URI:$target_tag"
    push_docker_image "$target_tag"
}

# Get current running version from ECS
get_current_version() {
    local cluster="$1"
    local service="$2"
    
    local task_def=$(aws ecs describe-services \
        --cluster "$cluster" \
        --services "$service" \
        --query 'services[0].taskDefinition' \
        --output text \
        --region "$AWS_REGION" 2>/dev/null)
    
    if [[ -z "$task_def" || "$task_def" == "None" ]]; then
        echo "unknown"
        return
    fi
    
    local image=$(aws ecs describe-task-definition \
        --task-definition "$task_def" \
        --query 'taskDefinition.containerDefinitions[0].image' \
        --output text \
        --region "$AWS_REGION" 2>/dev/null)
    
    # Extract tag from image URI
    echo "${image##*:}"
}

# Get ALB DNS for a service
get_service_url() {
    local cluster="$1"
    local service="$2"
    
    # This is simplified - in production you'd look up the actual ALB
    case "$cluster" in
        *staging*)
            echo "https://staging.edsteward.ai"
            ;;
        *)
            echo "https://moravian.edsteward.ai"
            ;;
    esac
}

# Wait for ECS service to stabilize
wait_for_service_stable() {
    local cluster="$1"
    local service="$2"
    local timeout="${3:-600}"  # Default 10 minutes
    
    log "Waiting for ECS service to stabilize (timeout: ${timeout}s)..."
    
    if ! aws ecs wait services-stable \
        --cluster "$cluster" \
        --services "$service" \
        --region "$AWS_REGION" 2>/dev/null; then
        error "ECS service failed to stabilize within timeout"
    fi
    
    success "ECS service is stable"
}

# Perform health check on deployed service
verify_health() {
    local url="$1"
    local max_attempts="${2:-30}"
    local interval="${3:-10}"
    
    log "Verifying health at $url/api/health..."
    
    for i in $(seq 1 $max_attempts); do
        if curl -sf "$url/api/health" > /dev/null 2>&1; then
            success "Health check passed!"
            return 0
        fi
        
        if [[ $i -lt $max_attempts ]]; then
            debug "Health check attempt $i/$max_attempts failed, retrying in ${interval}s..."
            sleep "$interval"
        fi
    done
    
    error "Health check failed after $max_attempts attempts"
}

# Wait for healthy deployment (combines service stable + health check)
wait_for_healthy_deployment() {
    local cluster="$1"
    local service="$2"
    local url="$3"
    
    wait_for_service_stable "$cluster" "$service"
    verify_health "$url"
}

# Record deployment to log file
record_deployment() {
    local environment="$1"
    local version="$2"
    local status="$3"
    local task_def_arn="${4:-}"
    local previous_version="${5:-unknown}"
    
    local project_root=$(get_project_root)
    local deploy_dir="$project_root/deployments/$environment"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local date_prefix=$(date +"%Y-%m-%d")
    local deployer=$(whoami)
    local commit_sha=$(get_commit_sha)
    
    mkdir -p "$deploy_dir"
    
    local record_file="$deploy_dir/${date_prefix}-${version}.json"
    
    cat > "$record_file" << EOF
{
  "version": "$version",
  "timestamp": "$timestamp",
  "deployer": "$deployer",
  "commitSha": "$commit_sha",
  "gitBranch": "$(get_git_branch)",
  "taskDefinitionArn": "$task_def_arn",
  "previousVersion": "$previous_version",
  "status": "$status",
  "environment": "$environment"
}
EOF
    
    log "Deployment recorded: $record_file"
}

# List recent deployments
list_deployments() {
    local environment="$1"
    local count="${2:-10}"
    
    local project_root=$(get_project_root)
    local deploy_dir="$project_root/deployments/$environment"
    
    if [[ ! -d "$deploy_dir" ]]; then
        warn "No deployments found for $environment"
        return
    fi
    
    echo -e "${CYAN}Recent $environment deployments:${NC}"
    echo ""
    
    local i=1
    for file in $(ls -t "$deploy_dir"/*.json 2>/dev/null | head -n "$count"); do
        local version=$(jq -r '.version' "$file")
        local timestamp=$(jq -r '.timestamp' "$file")
        local status=$(jq -r '.status' "$file")
        local deployer=$(jq -r '.deployer' "$file")
        
        local status_color="$GREEN"
        if [[ "$status" == "failed" ]]; then
            status_color="$RED"
        elif [[ "$status" == "rolled_back" ]]; then
            status_color="$YELLOW"
        fi
        
        echo -e "  ${BLUE}$i.${NC} $version - ${status_color}$status${NC} - $timestamp by $deployer"
        ((i++))
    done
    
    echo ""
}

# Get the task definition ARN for a specific version
get_task_definition_for_version() {
    local environment="$1"
    local version="$2"
    
    local project_root=$(get_project_root)
    local deploy_dir="$project_root/deployments/$environment"
    
    # Find the deployment record
    local record=$(ls -t "$deploy_dir"/*-${version}.json 2>/dev/null | head -n 1)
    
    if [[ -z "$record" ]]; then
        echo ""
        return
    fi
    
    jq -r '.taskDefinitionArn' "$record"
}

# Check if a version has been deployed to staging
version_deployed_to_staging() {
    local version="$1"
    
    local project_root=$(get_project_root)
    local staging_dir="$project_root/deployments/staging"
    
    if ls "$staging_dir"/*-${version}.json &>/dev/null; then
        return 0  # true
    fi
    return 1  # false
}

# Check if a Docker image exists in ECR
image_exists_in_ecr() {
    local tag="$1"
    
    if aws ecr describe-images \
        --repository-name "$ECR_REPOSITORY" \
        --image-ids imageTag="$tag" \
        --region "$AWS_REGION" &>/dev/null; then
        return 0  # true
    fi
    return 1  # false
}

# Build frontend
build_frontend() {
    log "Building frontend..."
    
    if ! npm run build; then
        error "Frontend build failed"
    fi
    
    success "Frontend build completed"
}

# Clear processes on a port (useful before builds)
clear_port() {
    local port="$1"
    
    log "Clearing any processes on port $port..."
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
}
