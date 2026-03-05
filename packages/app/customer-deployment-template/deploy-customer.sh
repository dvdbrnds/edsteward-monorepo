#!/bin/zsh

# EdSteward Customer Deployment Script
# Deploys a complete EdSteward instance to a customer's AWS environment
# Usage: ./deploy-customer.sh [customer-config.json]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

info() {
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    error "jq is required but not installed. Please install jq first."
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    error "AWS CLI is required but not installed. Please install AWS CLI first."
fi

# Check for customer config file
if [[ -z "$1" ]]; then
    error "Usage: ./deploy-customer.sh [customer-config.json]"
fi

CONFIG_FILE="$1"
if [[ ! -f "$CONFIG_FILE" ]]; then
    error "Customer configuration file not found: $CONFIG_FILE"
fi

log "🚀 Starting EdSteward Customer Deployment"
log "📋 Configuration file: $CONFIG_FILE"

# Load configuration
CUSTOMER_NAME=$(jq -r '.customer.name' "$CONFIG_FILE")
CUSTOMER_DOMAIN=$(jq -r '.customer.domain' "$CONFIG_FILE")
AWS_REGION=$(jq -r '.aws.region' "$CONFIG_FILE")
AWS_ACCOUNT_ID=$(jq -r '.aws.accountId' "$CONFIG_FILE")
CLUSTER_NAME=$(jq -r '.aws.clusterName' "$CONFIG_FILE")
SERVICE_NAME=$(jq -r '.aws.serviceName' "$CONFIG_FILE")
ECR_REPOSITORY=$(jq -r '.aws.ecrRepository' "$CONFIG_FILE")
DATABASE_URL=$(jq -r '.database.connectionString' "$CONFIG_FILE")
DOCKER_IMAGE=$(jq -r '.deployment.dockerImage' "$CONFIG_FILE")
TASK_FAMILY=$(jq -r '.deployment.taskDefinitionFamily' "$CONFIG_FILE")
DOMAIN_NAME=$(jq -r '.deployment.domainName' "$CONFIG_FILE")

log "📊 Customer: $CUSTOMER_NAME"
log "🌐 Domain: $DOMAIN_NAME"
log "🏗️ AWS Region: $AWS_REGION"
log "🐳 Cluster: $CLUSTER_NAME"

# Validate AWS credentials
info "Validating AWS credentials..."
aws sts get-caller-identity --region "$AWS_REGION" > /dev/null || error "AWS credentials not configured properly"

# Create deployment directory
DEPLOYMENT_DIR="./deployments/${CUSTOMER_NAME}-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEPLOYMENT_DIR"
log "📁 Created deployment directory: $DEPLOYMENT_DIR"

# Step 1: Create ECS Cluster
info "Creating ECS cluster: $CLUSTER_NAME"
aws ecs create-cluster --cluster-name "$CLUSTER_NAME" --region "$AWS_REGION" || warn "Cluster may already exist"

# Step 2: Create ECR repository
info "Creating ECR repository: $ECR_REPOSITORY"
aws ecr create-repository --repository-name "$ECR_REPOSITORY" --region "$AWS_REGION" || warn "Repository may already exist"

# Step 3: Build and push Docker image
info "Building and pushing Docker image..."
FULL_IMAGE_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest"

# Login to ECR
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build Docker image with customer-specific configuration
info "Building customer-specific Docker image..."
docker build --platform linux/amd64 -t "$ECR_REPOSITORY:latest" . || error "Docker build failed"

# Tag and push image
docker tag "$ECR_REPOSITORY:latest" "$FULL_IMAGE_URI"
docker push "$FULL_IMAGE_URI" || error "Docker push failed"

# Step 4: Create task definition
info "Creating ECS task definition..."
./customer-deployment-template/create-task-definition.sh "$CONFIG_FILE" "$FULL_IMAGE_URI" > "$DEPLOYMENT_DIR/task-definition.json"

# Register task definition
aws ecs register-task-definition --cli-input-json "file://$DEPLOYMENT_DIR/task-definition.json" --region "$AWS_REGION" || error "Task definition registration failed"

# Step 5: Create ECS service
info "Creating ECS service: $SERVICE_NAME"
./customer-deployment-template/create-ecs-service.sh "$CONFIG_FILE" "$DEPLOYMENT_DIR" || error "ECS service creation failed"

# Step 6: Setup database
info "Setting up customer database..."
./customer-deployment-template/setup-customer-database.sh "$CONFIG_FILE" || error "Database setup failed"

# Step 7: Configure domain and SSL
info "Configuring domain and SSL..."
./customer-deployment-template/setup-domain-ssl.sh "$CONFIG_FILE" || warn "Domain setup may require manual configuration"

# Step 8: Wait for deployment
info "Waiting for deployment to stabilize..."
aws ecs wait services-stable --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --region "$AWS_REGION" || error "Deployment failed to stabilize"

# Step 9: Health check
info "Performing health check..."
./customer-deployment-template/health-check.sh "$CONFIG_FILE" || error "Health check failed"

# Step 10: Generate deployment summary
info "Generating deployment summary..."
./customer-deployment-template/generate-deployment-summary.sh "$CONFIG_FILE" "$DEPLOYMENT_DIR" > "$DEPLOYMENT_DIR/deployment-summary.md"

log "✅ Customer deployment completed successfully!"
log "📄 Deployment summary: $DEPLOYMENT_DIR/deployment-summary.md"
log "🌐 Application URL: https://$DOMAIN_NAME"
log "🔐 Admin credentials: admin/admin (change immediately)"

echo ""
echo "🎉 $CUSTOMER_NAME EdSteward instance is now live!"
echo "📧 Send deployment summary to customer: $DEPLOYMENT_DIR/deployment-summary.md" 