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
APP_NAME="edsteward"
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
    
    # Build the image with correct platform for ECS (linux/amd64) and load to local daemon
    docker buildx build --platform linux/amd64 --load -t ${APP_NAME}:${IMAGE_TAG} .
    
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
    
    # Get current task definition
    CURRENT_TASK_DEF=$(aws ecs describe-task-definition \
        --task-definition $TASK_DEFINITION \
        --region $AWS_REGION \
        --query 'taskDefinition' 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        # Update the image in the task definition while preserving all environment variables
        NEW_TASK_DEF=$(echo $CURRENT_TASK_DEF | jq --arg image "${ECR_REPOSITORY}:${IMAGE_TAG}" '
            .containerDefinitions[0].image = $image |
            del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)
        ')
        
        # Show current DATABASE_URL for debugging
        echo "Current environment variables preserved:"
        echo $CURRENT_TASK_DEF | jq -r '.containerDefinitions[0].environment[] | select(.name == "DATABASE_URL") | "  DATABASE_URL: " + .value[:50] + "..."'
        echo $CURRENT_TASK_DEF | jq -r '.containerDefinitions[0].environment[] | select(.name == "SESSION_SECRET") | "  SESSION_SECRET: " + .value[:20] + "..."'
        
        # Register new task definition
        aws ecs register-task-definition \
            --region $AWS_REGION \
            --cli-input-json "$NEW_TASK_DEF" > /dev/null
        
        log "Updated task definition with new image: ${ECR_REPOSITORY}:${IMAGE_TAG}"
    fi
    
    # Force new deployment with updated task definition
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --force-new-deployment \
        --region $AWS_REGION > /dev/null
    
    success "ECS service update initiated"
}

# Wait for deployment with fast failure detection
wait_for_deployment() {
    log "Waiting for deployment to complete..."
    
    CLUSTER_NAME="${APP_NAME}-cluster"
    SERVICE_NAME="${APP_NAME}-service"
    
    # Fast deployment check with early failure detection
    local max_attempts=30  # 5 minutes max (10 second intervals)
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        # Get service status
        local service_status=$(aws ecs describe-services \
            --cluster $CLUSTER_NAME \
            --services $SERVICE_NAME \
            --region $AWS_REGION \
            --query 'services[0]' 2>/dev/null)
        
        if [ $? -eq 0 ]; then
            local running_count=$(echo $service_status | jq -r '.runningCount // 0')
            local desired_count=$(echo $service_status | jq -r '.desiredCount // 0')
            local pending_count=$(echo $service_status | jq -r '.pendingCount // 0')
            
            echo "[$attempt/$max_attempts] Running: $running_count/$desired_count, Pending: $pending_count"
            
            # Success condition: desired tasks are running
            if [ "$running_count" -eq "$desired_count" ] && [ "$desired_count" -gt 0 ]; then
                success "Deployment completed successfully"
                return 0
            fi
            
            # Fast failure detection: check for recent task failures
            if [ $attempt -gt 5 ]; then  # After 1 minute, start checking for failures
                local recent_failures=$(aws ecs list-tasks \
                    --cluster $CLUSTER_NAME \
                    --service-name $SERVICE_NAME \
                    --desired-status STOPPED \
                    --region $AWS_REGION \
                    --max-items 1 \
                    --query 'length(taskArns)' \
                    --output text 2>/dev/null || echo "0")
                
                if [ "$recent_failures" -gt 0 ] && [ "$running_count" -eq 0 ] && [ "$pending_count" -eq 0 ]; then
                    return 1
                fi
            fi
        fi
        
        sleep 10
        ((attempt++))
    done
    
    warning "Deployment timeout reached (5 minutes). Check service status manually."
    return 1
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