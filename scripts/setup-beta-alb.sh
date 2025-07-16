#!/bin/zsh
# Beta ALB Configuration Script
# Sets up Application Load Balancer for beta.edsteward.ai

set -e

# Fix AWS CLI pager issues on macOS
export AWS_PAGER=""

echo "🔧 Setting up ALB for beta.edsteward.ai..."

# Configuration
CLUSTER_NAME="edsteward-beta-cluster"
SERVICE_NAME="edsteward-beta-service"
TARGET_GROUP_NAME="edsteward-beta-tg"
DOMAIN_NAME="beta.edsteward.ai"
AWS_REGION="us-east-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Get VPC ID
echo_info "Getting VPC information..."
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text --region $AWS_REGION)
echo_info "Using VPC: $VPC_ID"

# Step 2: Find existing ALB (assuming you have one from production)
echo_info "Finding existing Application Load Balancer..."
ALB_ARN=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName, `edsteward`)].LoadBalancerArn' --output text --region $AWS_REGION)

if [ -z "$ALB_ARN" ]; then
    echo_error "No existing ALB found. Creating new ALB..."
    
    # Get subnets for ALB
    SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].SubnetId' --output text --region $AWS_REGION)
    SUBNET_ARRAY=(${=SUBNET_IDS})
    
    # Create ALB (use at least 2 subnets in different AZs)
    ALB_ARN=$(aws elbv2 create-load-balancer \
        --name edsteward-beta-alb \
        --subnets ${SUBNET_ARRAY[1]} ${SUBNET_ARRAY[2]} \
        --security-groups sg-default \
        --scheme internet-facing \
        --type application \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text \
        --region $AWS_REGION)
    
    echo_info "Created ALB: $ALB_ARN"
else
    echo_info "Using existing ALB: $ALB_ARN"
fi

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].DNSName' --output text --region $AWS_REGION)
echo_info "ALB DNS: $ALB_DNS"

# Step 3: Create Target Group for Beta
echo_info "Creating target group for beta..."
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
    --name $TARGET_GROUP_NAME \
    --protocol HTTP \
    --port 3000 \
    --vpc-id $VPC_ID \
    --health-check-path "/health" \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text \
    --region $AWS_REGION 2>/dev/null || \
    aws elbv2 describe-target-groups \
        --names $TARGET_GROUP_NAME \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text \
        --region $AWS_REGION)

echo_info "Target Group ARN: $TARGET_GROUP_ARN"

# Step 4: Update ECS Service to use Target Group
echo_info "Updating ECS service to use target group..."
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --load-balancers targetGroupArn=$TARGET_GROUP_ARN,containerName=edsteward-beta-app,containerPort=3000 \
    --region $AWS_REGION || echo_warn "Service update may have failed - check manually"

# Step 5: Create HTTP Listener (if not exists)
echo_info "Setting up HTTP listener..."
HTTP_LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --query 'Listeners[?Port==`80`].ListenerArn' --output text --region $AWS_REGION)

if [ -z "$HTTP_LISTENER_ARN" ]; then
    HTTP_LISTENER_ARN=$(aws elbv2 create-listener \
        --load-balancer-arn $ALB_ARN \
        --protocol HTTP \
        --port 80 \
        --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN \
        --query 'Listeners[0].ListenerArn' \
        --output text \
        --region $AWS_REGION)
    echo_info "Created HTTP listener: $HTTP_LISTENER_ARN"
else
    echo_info "Using existing HTTP listener: $HTTP_LISTENER_ARN"
fi

# Step 6: Create Listener Rule for beta.edsteward.ai
echo_info "Creating listener rule for beta.edsteward.ai..."
aws elbv2 create-rule \
    --listener-arn $HTTP_LISTENER_ARN \
    --priority 100 \
    --conditions Field=host-header,Values=$DOMAIN_NAME \
    --actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN \
    --region $AWS_REGION || echo_warn "Rule may already exist"

# Step 7: Request SSL Certificate
echo_info "Requesting SSL certificate for $DOMAIN_NAME..."
CERT_ARN=$(aws acm request-certificate \
    --domain-name $DOMAIN_NAME \
    --validation-method DNS \
    --query 'CertificateArn' \
    --output text \
    --region $AWS_REGION 2>/dev/null || \
    aws acm list-certificates \
        --query "CertificateSummaryList[?DomainName=='$DOMAIN_NAME'].CertificateArn" \
        --output text \
        --region $AWS_REGION)

if [ ! -z "$CERT_ARN" ]; then
    echo_info "Certificate ARN: $CERT_ARN"
    
    # Get DNS validation record
    VALIDATION_RECORD=$(aws acm describe-certificate \
        --certificate-arn $CERT_ARN \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
        --output text \
        --region $AWS_REGION)
    
    echo_info "📋 DNS Validation Required:"
    echo_info "Add this CNAME record to your DNS:"
    echo_info "$VALIDATION_RECORD"
else
    echo_warn "Certificate request failed or already exists"
fi

# Step 8: Create HTTPS Listener (will need certificate validation first)
echo_info "Creating HTTPS listener (certificate validation required)..."
HTTPS_LISTENER_ARN=$(aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=$CERT_ARN \
    --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN \
    --query 'Listeners[0].ListenerArn' \
    --output text \
    --region $AWS_REGION 2>/dev/null || echo_warn "HTTPS listener creation failed - certificate may not be validated yet")

echo_info "✅ ALB setup completed!"
echo_info "🌐 ALB DNS: $ALB_DNS"
echo_info "🔗 Next steps:"
echo_info "  1. Add CNAME record: beta.edsteward.ai -> $ALB_DNS"
echo_info "  2. Validate SSL certificate (add DNS validation records)"
echo_info "  3. Test: https://beta.edsteward.ai"

echo_info "📊 Configuration Summary:"
echo_info "  Load Balancer: $ALB_ARN"
echo_info "  Target Group: $TARGET_GROUP_ARN"
echo_info "  HTTP Listener: $HTTP_LISTENER_ARN"
echo_info "  Certificate: $CERT_ARN"
echo_info "  Domain: $DOMAIN_NAME" 