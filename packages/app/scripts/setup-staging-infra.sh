#!/bin/zsh

# ============================================================================
# EdSteward Staging Environment Infrastructure Setup
# ============================================================================
# This script creates a complete staging environment in AWS.
# Run this ONCE to provision staging infrastructure.
#
# Usage: ./scripts/setup-staging-infra.sh [--dry-run]
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="259661441422"
PROJECT_NAME="edsteward"
ENVIRONMENT="staging"

# Resource names
VPC_CIDR="10.1.0.0/16"
CLUSTER_NAME="${PROJECT_NAME}-staging-cluster"
SERVICE_NAME="${PROJECT_NAME}-staging-service"
ALB_NAME="${PROJECT_NAME}-staging-alb"
TARGET_GROUP_NAME="${PROJECT_NAME}-staging-tg"
TASK_FAMILY="${PROJECT_NAME}-staging-task"
ECR_REPOSITORY="edsteward-multi-tenant"
LOG_GROUP="/ecs/${PROJECT_NAME}-staging"

# SSL Certificate (same wildcard cert for *.edsteward.ai)
SSL_CERT_ARN="arn:aws:acm:us-east-1:259661441422:certificate/622eb953-a77f-4770-be20-5dd017df39b0"

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}DRY RUN MODE - No resources will be created${NC}"
fi

# Disable AWS pager
export AWS_PAGER=""

# Logging functions
log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
step() { echo -e "${CYAN}[STEP]${NC} $1"; }

echo -e "${CYAN}"
echo "============================================================================"
echo "  EdSteward Staging Infrastructure Setup"
echo "============================================================================"
echo -e "${NC}"

# Pre-flight checks
log "Running pre-flight checks..."

if ! command -v aws &> /dev/null; then
    error "AWS CLI not found. Install with: brew install awscli"
fi

if ! aws sts get-caller-identity &> /dev/null; then
    error "AWS credentials not configured. Run: aws configure"
fi

CALLER_ACCOUNT=$(aws sts get-caller-identity --query 'Account' --output text)
if [[ "$CALLER_ACCOUNT" != "$AWS_ACCOUNT_ID" ]]; then
    error "AWS account mismatch. Expected: $AWS_ACCOUNT_ID, Got: $CALLER_ACCOUNT"
fi

success "Pre-flight checks passed"

# Check if staging cluster already exists
if aws ecs describe-clusters --clusters "$CLUSTER_NAME" --region "$AWS_REGION" --query 'clusters[0].status' --output text 2>/dev/null | grep -q "ACTIVE"; then
    warn "Staging cluster $CLUSTER_NAME already exists!"
    read "?Continue anyway? This will update existing resources. (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "Aborted."
        exit 0
    fi
fi

echo ""
step "1/8 - Getting existing VPC and networking info"

# Use the same VPC as production (simpler and cheaper)
log "Looking for existing edsteward VPC..."

# Try to find the existing VPC
EXISTING_VPC=$(aws ec2 describe-vpcs \
    --filters "Name=tag:Name,Values=*edsteward*" \
    --query 'Vpcs[0].VpcId' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "None")

if [[ "$EXISTING_VPC" == "None" || -z "$EXISTING_VPC" ]]; then
    # Look for default VPC
    EXISTING_VPC=$(aws ec2 describe-vpcs \
        --filters "Name=isDefault,Values=true" \
        --query 'Vpcs[0].VpcId' \
        --output text \
        --region "$AWS_REGION")
    log "Using default VPC: $EXISTING_VPC"
else
    log "Using existing edsteward VPC: $EXISTING_VPC"
fi

VPC_ID="$EXISTING_VPC"

# Get public subnets
PUBLIC_SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=map-public-ip-on-launch,Values=true" \
    --query 'Subnets[*].SubnetId' \
    --output text \
    --region "$AWS_REGION")

if [[ -z "$PUBLIC_SUBNETS" ]]; then
    # Fallback: get any subnets
    PUBLIC_SUBNETS=$(aws ec2 describe-subnets \
        --filters "Name=vpc-id,Values=$VPC_ID" \
        --query 'Subnets[0:2].SubnetId' \
        --output text \
        --region "$AWS_REGION")
fi

# Split by whitespace (spaces or tabs)
SUBNET_ARRAY=(${=PUBLIC_SUBNETS})
SUBNET_1="${SUBNET_ARRAY[1]}"
SUBNET_2="${SUBNET_ARRAY[2]:-$SUBNET_1}"

# Ensure we have valid subnet IDs (no tabs/spaces in them)
SUBNET_1="${SUBNET_1//[$'\t\n ']}"
SUBNET_2="${SUBNET_2//[$'\t\n ']}"

success "VPC: $VPC_ID, Subnets: $SUBNET_1, $SUBNET_2"

echo ""
step "2/8 - Creating Security Groups"

# Check for existing security group
EXISTING_SG=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${PROJECT_NAME}-staging-sg" "Name=vpc-id,Values=$VPC_ID" \
    --query 'SecurityGroups[0].GroupId' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "None")

if [[ "$EXISTING_SG" != "None" && -n "$EXISTING_SG" ]]; then
    log "Using existing security group: $EXISTING_SG"
    SG_ID="$EXISTING_SG"
else
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Would create security group: ${PROJECT_NAME}-staging-sg"
        SG_ID="sg-dry-run-placeholder"
    else
        log "Creating security group..."
        SG_ID=$(aws ec2 create-security-group \
            --group-name "${PROJECT_NAME}-staging-sg" \
            --description "Security group for EdSteward staging environment" \
            --vpc-id "$VPC_ID" \
            --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${PROJECT_NAME}-staging-sg},{Key=Environment,Value=staging}]" \
            --query 'GroupId' \
            --output text \
            --region "$AWS_REGION")
        
        # Allow HTTP
        aws ec2 authorize-security-group-ingress \
            --group-id "$SG_ID" \
            --protocol tcp \
            --port 80 \
            --cidr 0.0.0.0/0 \
            --region "$AWS_REGION" 2>/dev/null || true
        
        # Allow HTTPS
        aws ec2 authorize-security-group-ingress \
            --group-id "$SG_ID" \
            --protocol tcp \
            --port 443 \
            --cidr 0.0.0.0/0 \
            --region "$AWS_REGION" 2>/dev/null || true
        
        # Allow port 3000 (app port)
        aws ec2 authorize-security-group-ingress \
            --group-id "$SG_ID" \
            --protocol tcp \
            --port 3000 \
            --cidr 0.0.0.0/0 \
            --region "$AWS_REGION" 2>/dev/null || true
        
        success "Created security group: $SG_ID"
    fi
fi

echo ""
step "3/8 - Creating Application Load Balancer"

# Check for existing ALB
EXISTING_ALB=$(aws elbv2 describe-load-balancers \
    --names "$ALB_NAME" \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "None")

if [[ "$EXISTING_ALB" != "None" && -n "$EXISTING_ALB" ]]; then
    log "Using existing ALB: $ALB_NAME"
    ALB_ARN="$EXISTING_ALB"
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --load-balancer-arns "$ALB_ARN" \
        --query 'LoadBalancers[0].DNSName' \
        --output text \
        --region "$AWS_REGION")
else
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Would create ALB: $ALB_NAME"
        ALB_ARN="arn:aws:elasticloadbalancing:dry-run"
        ALB_DNS="staging-dry-run.elb.amazonaws.com"
    else
        log "Creating Application Load Balancer..."
        ALB_ARN=$(aws elbv2 create-load-balancer \
            --name "$ALB_NAME" \
            --subnets $SUBNET_1 $SUBNET_2 \
            --security-groups "$SG_ID" \
            --tags "Key=Name,Value=$ALB_NAME" "Key=Environment,Value=staging" \
            --query 'LoadBalancers[0].LoadBalancerArn' \
            --output text \
            --region "$AWS_REGION")
        
        ALB_DNS=$(aws elbv2 describe-load-balancers \
            --load-balancer-arns "$ALB_ARN" \
            --query 'LoadBalancers[0].DNSName' \
            --output text \
            --region "$AWS_REGION")
        
        success "Created ALB: $ALB_DNS"
    fi
fi

echo ""
step "4/8 - Creating Target Group"

# Check for existing target group
EXISTING_TG=$(aws elbv2 describe-target-groups \
    --names "$TARGET_GROUP_NAME" \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "None")

if [[ "$EXISTING_TG" != "None" && -n "$EXISTING_TG" ]]; then
    log "Using existing target group: $TARGET_GROUP_NAME"
    TG_ARN="$EXISTING_TG"
else
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Would create target group: $TARGET_GROUP_NAME"
        TG_ARN="arn:aws:elasticloadbalancing:dry-run:targetgroup"
    else
        log "Creating Target Group..."
        TG_ARN=$(aws elbv2 create-target-group \
            --name "$TARGET_GROUP_NAME" \
            --protocol HTTP \
            --port 3000 \
            --vpc-id "$VPC_ID" \
            --health-check-path "/api/health" \
            --health-check-interval-seconds 30 \
            --health-check-timeout-seconds 5 \
            --healthy-threshold-count 2 \
            --unhealthy-threshold-count 3 \
            --target-type ip \
            --tags "Key=Name,Value=$TARGET_GROUP_NAME" "Key=Environment,Value=staging" \
            --query 'TargetGroups[0].TargetGroupArn' \
            --output text \
            --region "$AWS_REGION")
        
        success "Created target group: $TG_ARN"
    fi
fi

echo ""
step "5/8 - Creating ALB Listeners"

if [[ "$DRY_RUN" != "true" ]]; then
    # Check if HTTPS listener exists
    HTTPS_LISTENER=$(aws elbv2 describe-listeners \
        --load-balancer-arn "$ALB_ARN" \
        --query "Listeners[?Port==\`443\`].ListenerArn" \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo "")
    
    if [[ -z "$HTTPS_LISTENER" ]]; then
        log "Creating HTTPS listener..."
        aws elbv2 create-listener \
            --load-balancer-arn "$ALB_ARN" \
            --protocol HTTPS \
            --port 443 \
            --certificates CertificateArn="$SSL_CERT_ARN" \
            --default-actions Type=forward,TargetGroupArn="$TG_ARN" \
            --region "$AWS_REGION" > /dev/null
        success "Created HTTPS listener"
    else
        log "HTTPS listener already exists"
    fi
    
    # Check if HTTP listener exists
    HTTP_LISTENER=$(aws elbv2 describe-listeners \
        --load-balancer-arn "$ALB_ARN" \
        --query "Listeners[?Port==\`80\`].ListenerArn" \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo "")
    
    if [[ -z "$HTTP_LISTENER" ]]; then
        log "Creating HTTP redirect listener..."
        aws elbv2 create-listener \
            --load-balancer-arn "$ALB_ARN" \
            --protocol HTTP \
            --port 80 \
            --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' \
            --region "$AWS_REGION" > /dev/null
        success "Created HTTP redirect listener"
    else
        log "HTTP listener already exists"
    fi
else
    log "Would create HTTPS and HTTP listeners"
fi

echo ""
step "6/8 - Creating ECS Cluster"

# Check for existing cluster
CLUSTER_STATUS=$(aws ecs describe-clusters \
    --clusters "$CLUSTER_NAME" \
    --query 'clusters[0].status' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "MISSING")

if [[ "$CLUSTER_STATUS" == "ACTIVE" ]]; then
    log "ECS Cluster already exists: $CLUSTER_NAME"
else
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Would create ECS cluster: $CLUSTER_NAME"
    else
        log "Creating ECS Cluster..."
        aws ecs create-cluster \
            --cluster-name "$CLUSTER_NAME" \
            --tags "key=Name,value=$CLUSTER_NAME" "key=Environment,value=staging" \
            --region "$AWS_REGION" > /dev/null
        success "Created ECS cluster: $CLUSTER_NAME"
    fi
fi

echo ""
step "7/8 - Creating CloudWatch Log Group"

if [[ "$DRY_RUN" == "true" ]]; then
    log "Would create log group: $LOG_GROUP"
else
    aws logs create-log-group \
        --log-group-name "$LOG_GROUP" \
        --region "$AWS_REGION" 2>/dev/null || log "Log group already exists"
    
    # Set retention to 7 days for staging (save costs)
    aws logs put-retention-policy \
        --log-group-name "$LOG_GROUP" \
        --retention-in-days 7 \
        --region "$AWS_REGION" 2>/dev/null || true
    
    success "Log group ready: $LOG_GROUP"
fi

echo ""
step "8/8 - Creating ECS Task Definition"

if [[ "$DRY_RUN" == "true" ]]; then
    log "Would create task definition: $TASK_FAMILY"
else
    log "Creating ECS task definition..."
    
    # Get the latest production image as a starting point
    ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"
    
    cat > /tmp/staging-task-definition.json << EOF
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
      "image": "${ECR_URI}:staging-latest",
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
        {"name": "BASE_URL", "value": "https://staging.edsteward.ai"}
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
          "awslogs-group": "${LOG_GROUP}",
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

    aws ecs register-task-definition \
        --cli-input-json file:///tmp/staging-task-definition.json \
        --region "$AWS_REGION" > /dev/null
    
    rm -f /tmp/staging-task-definition.json
    success "Created task definition: $TASK_FAMILY"
fi

# Create ECS Service (if not exists)
echo ""
log "Creating/Updating ECS Service..."

SERVICE_STATUS=$(aws ecs describe-services \
    --cluster "$CLUSTER_NAME" \
    --services "$SERVICE_NAME" \
    --query 'services[0].status' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "MISSING")

if [[ "$SERVICE_STATUS" == "ACTIVE" ]]; then
    log "ECS Service already exists: $SERVICE_NAME"
else
    if [[ "$DRY_RUN" == "true" ]]; then
        log "Would create ECS service: $SERVICE_NAME"
    else
        log "Creating ECS Service..."
        
        # Get private subnets if available, otherwise use public
        PRIVATE_SUBNETS=$(aws ec2 describe-subnets \
            --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*private*" \
            --query 'Subnets[*].SubnetId' \
            --output text \
            --region "$AWS_REGION" 2>/dev/null || echo "")
        
        if [[ -z "$PRIVATE_SUBNETS" ]]; then
            SERVICE_SUBNETS="$SUBNET_1,$SUBNET_2"
            ASSIGN_PUBLIC_IP="ENABLED"
        else
            SERVICE_SUBNETS=$(echo "$PRIVATE_SUBNETS" | tr '\t' ',' | cut -d',' -f1-2)
            ASSIGN_PUBLIC_IP="DISABLED"
        fi
        
        aws ecs create-service \
            --cluster "$CLUSTER_NAME" \
            --service-name "$SERVICE_NAME" \
            --task-definition "$TASK_FAMILY" \
            --desired-count 1 \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[$SERVICE_SUBNETS],securityGroups=[$SG_ID],assignPublicIp=$ASSIGN_PUBLIC_IP}" \
            --load-balancers "targetGroupArn=$TG_ARN,containerName=edsteward-app,containerPort=3000" \
            --tags "key=Name,value=$SERVICE_NAME" "key=Environment,value=staging" \
            --region "$AWS_REGION" > /dev/null 2>&1 || warn "Service creation may have failed - check AWS console"
        
        success "Created ECS service: $SERVICE_NAME"
    fi
fi

echo ""
echo -e "${CYAN}============================================================================"
echo "  Staging Infrastructure Setup Complete!"
echo "============================================================================${NC}"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}DRY RUN - No resources were created${NC}"
    echo ""
    echo "Run without --dry-run to create resources:"
    echo "  ./scripts/setup-staging-infra.sh"
else
    echo -e "${GREEN}Resources Created/Verified:${NC}"
    echo "  VPC:            $VPC_ID"
    echo "  Security Group: $SG_ID"
    echo "  ALB:            $ALB_DNS"
    echo "  Target Group:   $TG_ARN"
    echo "  ECS Cluster:    $CLUSTER_NAME"
    echo "  ECS Service:    $SERVICE_NAME"
    echo "  Log Group:      $LOG_GROUP"
    echo ""
    echo -e "${CYAN}Staging URL:${NC} https://staging.edsteward.ai"
    echo -e "${CYAN}ALB URL:${NC}     http://$ALB_DNS"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Configure DNS: Point staging.edsteward.ai to $ALB_DNS"
    echo "  2. Set up staging secrets: ./scripts/setup-secrets.sh"
    echo "  3. Deploy to staging: ./scripts/deploy-staging.sh <version>"
fi

# Save infrastructure details for other scripts
if [[ "$DRY_RUN" != "true" ]]; then
    cat > "/Users/dvdbrnds/Desktop/ES Clientside/EdSteward/deployments/staging/infrastructure.json" << EOF
{
  "environment": "staging",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "vpcId": "$VPC_ID",
  "securityGroupId": "$SG_ID",
  "albArn": "$ALB_ARN",
  "albDns": "$ALB_DNS",
  "targetGroupArn": "$TG_ARN",
  "clusterName": "$CLUSTER_NAME",
  "serviceName": "$SERVICE_NAME",
  "taskFamily": "$TASK_FAMILY",
  "logGroup": "$LOG_GROUP",
  "subnets": ["$SUBNET_1", "$SUBNET_2"]
}
EOF
    success "Infrastructure details saved to deployments/staging/infrastructure.json"
fi
