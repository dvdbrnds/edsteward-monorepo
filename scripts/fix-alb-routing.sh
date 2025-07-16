#!/bin/zsh

# Fix ALB Routing for moravian.edsteward.ai
# This script ensures proper routing from ALB to ECS service

set -e

# Configuration
AWS_REGION="us-east-1"
ALB_NAME="edsteward-alb"
ECS_CLUSTER="edsteward-cluster"
ECS_SERVICE="edsteward-service"
DOMAIN="moravian.edsteward.ai"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo -e "${BLUE}🔧 ALB Routing Fix for ${DOMAIN}${NC}"
echo "=================================================="

# Step 1: Get ALB ARN
log "Getting ALB ARN..."
ALB_ARN=$(aws elbv2 describe-load-balancers \
    --region ${AWS_REGION} \
    --query "LoadBalancers[?LoadBalancerName=='${ALB_NAME}'].LoadBalancerArn" \
    --output text)

if [ -z "$ALB_ARN" ] || [ "$ALB_ARN" = "None" ]; then
    error "Could not find ALB: ${ALB_NAME}"
fi

log "ALB ARN: ${ALB_ARN}"

# Step 2: Get listener ARN (HTTP listener)
log "Getting listener ARN..."
LISTENER_ARN=$(aws elbv2 describe-listeners \
    --load-balancer-arn ${ALB_ARN} \
    --region ${AWS_REGION} \
    --query "Listeners[?Port==\`80\`].ListenerArn" \
    --output text)

if [ -z "$LISTENER_ARN" ] || [ "$LISTENER_ARN" = "None" ]; then
    error "Could not find HTTP listener on ALB"
fi

log "Listener ARN: ${LISTENER_ARN}"

# Step 3: Check for existing target group
log "Checking target groups..."
TARGET_GROUP_ARNS=$(aws elbv2 describe-target-groups \
    --region ${AWS_REGION} \
    --query "TargetGroups[?contains(TargetGroupName, 'edsteward') && HealthCheckPath=='/health'].TargetGroupArn" \
    --output text)

# Select the first target group ARN from the list
TARGET_GROUP_ARN=$(echo "$TARGET_GROUP_ARNS" | awk '{print $1}')

if [ -z "$TARGET_GROUP_ARN" ] || [ "$TARGET_GROUP_ARN" = "None" ]; then
    # Try to find any edsteward target group
    TARGET_GROUP_ARNS=$(aws elbv2 describe-target-groups \
        --region ${AWS_REGION} \
        --query "TargetGroups[?contains(TargetGroupName, 'edsteward-tg')].TargetGroupArn" \
        --output text)
    TARGET_GROUP_ARN=$(echo "$TARGET_GROUP_ARNS" | awk '{print $1}')
fi

if [ -z "$TARGET_GROUP_ARN" ] || [ "$TARGET_GROUP_ARN" = "None" ]; then
    error "Could not find suitable target group"
fi

log "Target Group ARN: ${TARGET_GROUP_ARN}"

# Step 4: Check if rule already exists for moravian.edsteward.ai
log "Checking existing listener rules..."
EXISTING_RULE=$(aws elbv2 describe-rules \
    --listener-arn ${LISTENER_ARN} \
    --region ${AWS_REGION} \
    --query "Rules[?Conditions[?Field=='host-header' && Values[?contains(@, 'moravian.edsteward.ai')]]].RuleArn" \
    --output text)

if [ -n "$EXISTING_RULE" ] && [ "$EXISTING_RULE" != "None" ]; then
    warning "Rule already exists for ${DOMAIN}: ${EXISTING_RULE}"
else
    # Step 5: Create listener rule for moravian.edsteward.ai
    log "Creating listener rule for ${DOMAIN}..."
    
    RULE_ARN=$(aws elbv2 create-rule \
        --listener-arn ${LISTENER_ARN} \
        --priority 10 \
        --conditions Field=host-header,Values=${DOMAIN} \
        --actions Type=forward,TargetGroupArn=${TARGET_GROUP_ARN} \
        --region ${AWS_REGION} \
        --query "Rules[0].RuleArn" \
        --output text)
    
    if [ $? -eq 0 ]; then
        success "Created listener rule: ${RULE_ARN}"
    else
        error "Failed to create listener rule"
    fi
fi

# Step 6: Check ECS service and ensure it's running
log "Checking ECS service status..."
SERVICE_INFO=$(aws ecs describe-services \
    --cluster ${ECS_CLUSTER} \
    --services ${ECS_SERVICE} \
    --region ${AWS_REGION} \
    --query 'services[0].{ServiceName:serviceName,DesiredCount:desiredCount,RunningCount:runningCount,TaskDefinition:taskDefinition}' \
    --output json)

DESIRED_COUNT=$(echo ${SERVICE_INFO} | jq -r '.DesiredCount')
RUNNING_COUNT=$(echo ${SERVICE_INFO} | jq -r '.RunningCount')

log "ECS Service Status: ${RUNNING_COUNT}/${DESIRED_COUNT} tasks running"

if [ "$RUNNING_COUNT" -eq 0 ]; then
    warning "No tasks running! Forcing new deployment..."
    aws ecs update-service \
        --cluster ${ECS_CLUSTER} \
        --service ${ECS_SERVICE} \
        --force-new-deployment \
        --region ${AWS_REGION} > /dev/null
    
    log "Waiting for service to start..."
    sleep 30
fi

# Step 7: Test the connection
log "Testing connection to ${DOMAIN}..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/health)

if [ "$HEALTH_CHECK" = "200" ]; then
    success "Health check passed! ${DOMAIN} is working correctly"
elif [ "$HEALTH_CHECK" = "503" ]; then
    warning "Service unavailable (503) - tasks may still be starting"
    log "Check ECS service status: aws ecs describe-services --cluster ${ECS_CLUSTER} --services ${ECS_SERVICE} --region ${AWS_REGION}"
else
    warning "Health check returned: ${HEALTH_CHECK}"
fi

# Step 8: Show final status
echo -e "\n${GREEN}🎯 ALB ROUTING CONFIGURATION COMPLETE${NC}"
echo "=================================================="
echo -e "${BLUE}🌐 Test URL: https://${DOMAIN}/health${NC}"
echo -e "${BLUE}🌐 Main URL: https://${DOMAIN}/${NC}"
echo -e "${BLUE}📋 ALB: ${ALB_NAME}${NC}"
echo -e "${BLUE}📋 Target Group: ${TARGET_GROUP_ARN##*/}${NC}"
echo -e "${BLUE}📋 ECS Service: ${ECS_SERVICE}${NC}"

if [ "$HEALTH_CHECK" = "200" ]; then
    echo -e "${GREEN}✅ All systems operational!${NC}"
else
    echo -e "${YELLOW}⚠️  Service may still be starting up${NC}"
    echo -e "${YELLOW}   Wait 2-3 minutes and test again${NC}"
fi 