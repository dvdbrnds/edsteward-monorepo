#!/bin/bash

# AWS ECS Deployment Script for RegulatoryTrackr
# Usage: ./deploy-aws.sh [environment] [image-tag]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
IMAGE_TAG=${2:-latest}
APP_NAME="regulatorytrackr"
AWS_REGION=${AWS_REGION:-us-east-1}

# Functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI not found. Please install AWS CLI."
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker not found. Please install Docker."
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        error "AWS credentials not configured. Please run 'aws configure'."
    fi
    
    success "Prerequisites check passed"
}

# Get AWS account ID and ECR repository URI
get_aws_info() {
    log "Getting AWS account information..."
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    ECR_REPOSITORY="${ECR_REGISTRY}/${APP_NAME}"
    
    log "Account ID: $ACCOUNT_ID"
    log "ECR Repository: $ECR_REPOSITORY"
}

# Build Docker image
build_image() {
    log "Building Docker image..."
    
    # Build the image
    docker build -t ${APP_NAME}:${IMAGE_TAG} .
    
    # Tag for ECR
    docker tag ${APP_NAME}:${IMAGE_TAG} ${ECR_REPOSITORY}:${IMAGE_TAG}
    docker tag ${APP_NAME}:${IMAGE_TAG} ${ECR_REPOSITORY}:latest
    
    success "Docker image built successfully"
}

# Push to ECR
push_to_ecr() {
    log "Pushing image to ECR..."
    
    # Get ECR login token
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    
    # Create repository if it doesn't exist
    aws ecr describe-repositories --repository-names $APP_NAME --region $AWS_REGION &>/dev/null || \
        aws ecr create-repository --repository-name $APP_NAME --region $AWS_REGION
    
    # Push images
    docker push ${ECR_REPOSITORY}:${IMAGE_TAG}
    docker push ${ECR_REPOSITORY}:latest
    
    success "Image pushed to ECR successfully"
}

# Update ECS service
update_ecs_service() {
    log "Updating ECS service..."
    
    CLUSTER_NAME="${APP_NAME}-cluster"
    SERVICE_NAME="${APP_NAME}-service"
    TASK_DEFINITION="${APP_NAME}-task"
    
    # Check if cluster exists
    if ! aws ecs describe-clusters --clusters $CLUSTER_NAME --region $AWS_REGION &>/dev/null; then
        error "ECS cluster '$CLUSTER_NAME' not found. Please deploy infrastructure first."
    fi
    
    # Check if service exists
    if ! aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION &>/dev/null; then
        error "ECS service '$SERVICE_NAME' not found. Please deploy infrastructure first."
    fi
    
    # Force new deployment
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --force-new-deployment \
        --region $AWS_REGION > /dev/null
    
    success "ECS service update initiated"
}

# Wait for deployment
wait_for_deployment() {
    log "Waiting for deployment to complete..."
    
    CLUSTER_NAME="${APP_NAME}-cluster"
    SERVICE_NAME="${APP_NAME}-service"
    
    # Wait for service stability
    aws ecs wait services-stable \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --region $AWS_REGION
    
    success "Deployment completed successfully"
}

# Get service status
get_service_status() {
    log "Getting service status..."
    
    CLUSTER_NAME="${APP_NAME}-cluster"
    SERVICE_NAME="${APP_NAME}-service"
    
    # Get service information
    SERVICE_INFO=$(aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --region $AWS_REGION \
        --query 'services[0]')
    
    RUNNING_COUNT=$(echo $SERVICE_INFO | jq -r '.runningCount')
    DESIRED_COUNT=$(echo $SERVICE_INFO | jq -r '.desiredCount')
    
    echo -e "\n${GREEN}=== Deployment Status ===${NC}"
    echo "Environment: $ENVIRONMENT"
    echo "Image Tag: $IMAGE_TAG"
    echo "Running Tasks: $RUNNING_COUNT/$DESIRED_COUNT"
    
    # Get ALB DNS name
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --names "${APP_NAME}-alb" \
        --region $AWS_REGION \
        --query 'LoadBalancers[0].DNSName' \
        --output text 2>/dev/null || echo "Not found")
    
    echo "Load Balancer: $ALB_DNS"
    
    if [ "$ALB_DNS" != "Not found" ]; then
        echo "Application URL: https://$ALB_DNS"
    fi
}

# Run database migrations (if needed)
run_migrations() {
    log "Running database migrations..."
    
    # This would typically run migrations
    # For now, just log what should be done
    warning "Database migrations should be run manually if needed"
    echo "Connect to your RDS instance and run:"
    echo "  psql -h <rds-endpoint> -U postgres -d regulatorytrackr -f database/migrations.sql"
}

# Main deployment function
main() {
    echo -e "${GREEN}=== AWS ECS Deployment Started ===${NC}"
    echo "Environment: $ENVIRONMENT"
    echo "Image Tag: $IMAGE_TAG"
    echo "AWS Region: $AWS_REGION"
    echo ""
    
    check_prerequisites
    get_aws_info
    build_image
    push_to_ecr
    update_ecs_service
    wait_for_deployment
    get_service_status
    run_migrations
    
    echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
    success "Application deployed successfully to AWS ECS"
}

# Handle script interruption
trap 'error "Deployment interrupted"' INT TERM

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 