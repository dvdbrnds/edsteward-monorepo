#!/bin/zsh

# Comprehensive 503 Fix Script
# Based on Context7 AWS CLI troubleshooting findings

set -e

# Configuration
AWS_REGION="us-east-1"
DOMAIN="moravian.edsteward.ai"
ALB_NAME="edsteward-alb"
ECS_CLUSTER="edsteward-cluster"
ECS_SERVICE="edsteward-service"
TARGET_GROUP_ARN="arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-dev-tg/373f0921c0540412"

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
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo -e "${BLUE}🔧 Comprehensive 503 Fix for ${DOMAIN}${NC}"
echo "Based on Context7 AWS CLI Troubleshooting"
echo "=================================================="

# Step 1: Check CloudWatch Logs for task failures
log "Step 1: Checking CloudWatch Logs for task failures..."

# Find log groups
LOG_GROUPS=$(aws logs describe-log-groups \
    --log-group-name-prefix '/ecs/' \
    --region ${AWS_REGION} \
    --query 'logGroups[?contains(logGroupName, `edsteward`)].logGroupName' \
    --output text 2>/dev/null)

if [ -n "$LOG_GROUPS" ]; then
    log "Found log groups: $LOG_GROUPS"
    
    # Get recent logs
    for LOG_GROUP in $LOG_GROUPS; do
        log "Checking logs in: $LOG_GROUP"
        RECENT_LOGS=$(aws logs filter-log-events \
            --log-group-name "$LOG_GROUP" \
            --start-time $(($(date +%s) - 3600)) \
            --region ${AWS_REGION} \
            --query 'events[*].message' \
            --output text 2>/dev/null | head -10)
        
        if [ -n "$RECENT_LOGS" ]; then
            echo "Recent logs:"
            echo "$RECENT_LOGS"
        else
            warning "No recent logs in $LOG_GROUP"
        fi
        echo ""
    done
else
    warning "No ECS log groups found"
fi

# Step 2: Fix missing listener rule
log "Step 2: Fixing missing listener rule for ${DOMAIN}..."

# Get ALB and listener info
ALB_ARN=$(aws elbv2 describe-load-balancers \
    --names ${ALB_NAME} \
    --region ${AWS_REGION} \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text 2>/dev/null)

if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
    LISTENER_ARN=$(aws elbv2 describe-listeners \
        --load-balancer-arn ${ALB_ARN} \
        --region ${AWS_REGION} \
        --query 'Listeners[?Port==`80`].ListenerArn' \
        --output text 2>/dev/null)
    
    if [ -n "$LISTENER_ARN" ] && [ "$LISTENER_ARN" != "None" ]; then
        # Check if rule already exists
        EXISTING_RULE=$(aws elbv2 describe-rules \
            --listener-arn ${LISTENER_ARN} \
            --region ${AWS_REGION} \
            --query "Rules[?Conditions[?Field=='host-header' && Values[?contains(@, '${DOMAIN}')]]].RuleArn" \
            --output text 2>/dev/null)
        
        if [ -z "$EXISTING_RULE" ] || [ "$EXISTING_RULE" = "None" ]; then
            log "Creating listener rule for ${DOMAIN}..."
            
            RULE_ARN=$(aws elbv2 create-rule \
                --listener-arn ${LISTENER_ARN} \
                --priority 5 \
                --conditions Field=host-header,Values=${DOMAIN} \
                --actions Type=forward,TargetGroupArn=${TARGET_GROUP_ARN} \
                --region ${AWS_REGION} \
                --query "Rules[0].RuleArn" \
                --output text 2>/dev/null)
            
            if [ $? -eq 0 ] && [ -n "$RULE_ARN" ]; then
                success "Created listener rule: $RULE_ARN"
            else
                error "Failed to create listener rule"
            fi
        else
            success "Listener rule already exists: $EXISTING_RULE"
        fi
    else
        error "Could not find HTTP listener"
    fi
else
    error "Could not find ALB: $ALB_NAME"
fi

# Step 3: Check task definition and potentially create new one
log "Step 3: Checking task definition..."

CURRENT_TASK_DEF=$(aws ecs describe-services \
    --cluster ${ECS_CLUSTER} \
    --services ${ECS_SERVICE} \
    --region ${AWS_REGION} \
    --query 'services[0].taskDefinition' \
    --output text 2>/dev/null)

if [ -n "$CURRENT_TASK_DEF" ] && [ "$CURRENT_TASK_DEF" != "None" ]; then
    log "Current task definition: $CURRENT_TASK_DEF"
    
    # Check if task definition exists and is valid
    TASK_DEF_INFO=$(aws ecs describe-task-definition \
        --task-definition ${CURRENT_TASK_DEF} \
        --region ${AWS_REGION} 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        log "Task definition is valid"
        
        # Extract key configuration
        echo "$TASK_DEF_INFO" | jq -r '.taskDefinition | "CPU: \(.cpu)\nMemory: \(.memory)\nNetwork Mode: \(.networkMode)\nContainer Count: \(.containerDefinitions | length)"' 2>/dev/null || echo "Could not parse task definition"
    else
        error "Task definition is invalid or not found"
    fi
else
    error "Could not get current task definition"
fi

# Step 4: Check service configuration
log "Step 4: Checking service configuration..."

SERVICE_CONFIG=$(aws ecs describe-services \
    --cluster ${ECS_CLUSTER} \
    --services ${ECS_SERVICE} \
    --region ${AWS_REGION} 2>/dev/null)

if [ $? -eq 0 ]; then
    # Check load balancer configuration
    LB_CONFIG=$(echo "$SERVICE_CONFIG" | jq -r '.services[0].loadBalancers' 2>/dev/null)
    
    if [ "$LB_CONFIG" != "null" ] && [ "$LB_CONFIG" != "[]" ]; then
        log "Service has load balancer configuration"
        echo "$LB_CONFIG" | jq -r '.[] | "Target Group: \(.targetGroupArn)\nContainer: \(.containerName):\(.containerPort)"' 2>/dev/null || echo "Could not parse LB config"
    else
        warning "Service has no load balancer configuration"
        log "This could explain why targets aren't registering properly"
    fi
    
    # Check network configuration
    NETWORK_CONFIG=$(echo "$SERVICE_CONFIG" | jq -r '.services[0].networkConfiguration.awsvpcConfiguration' 2>/dev/null)
    
    if [ "$NETWORK_CONFIG" != "null" ]; then
        log "Network configuration found"
        echo "$NETWORK_CONFIG" | jq -r '"Subnets: \(.subnets | join(", "))\nSecurity Groups: \(.securityGroups | join(", "))\nPublic IP: \(.assignPublicIp)"' 2>/dev/null || echo "Could not parse network config"
    else
        warning "No network configuration found"
    fi
else
    error "Could not describe service"
fi

# Step 5: Force restart with wait
log "Step 5: Forcing service restart and waiting..."

aws ecs update-service \
    --cluster ${ECS_CLUSTER} \
    --service ${ECS_SERVICE} \
    --force-new-deployment \
    --region ${AWS_REGION} > /dev/null 2>&1

log "Waiting for service to stabilize (this may take 3-5 minutes)..."

# Wait for service to stabilize
aws ecs wait services-stable \
    --cluster ${ECS_CLUSTER} \
    --services ${ECS_SERVICE} \
    --region ${AWS_REGION}

if [ $? -eq 0 ]; then
    success "Service has stabilized"
    
    # Check final status
    log "Checking final service status..."
    FINAL_STATUS=$(aws ecs describe-services \
        --cluster ${ECS_CLUSTER} \
        --services ${ECS_SERVICE} \
        --region ${AWS_REGION} \
        --query 'services[0].{DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount}' \
        --output table 2>/dev/null)
    
    echo "$FINAL_STATUS"
    
    # Test health endpoint
    log "Testing health endpoint..."
    sleep 30  # Give time for health checks
    
    HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/health)
    
    if [ "$HEALTH_RESPONSE" = "200" ]; then
        success "Health check passed! ✅"
        echo -e "${GREEN}🎉 ${DOMAIN} is now responding correctly!${NC}"
    elif [ "$HEALTH_RESPONSE" = "503" ]; then
        warning "Still getting 503 - targets may need more time to become healthy"
    else
        warning "Unexpected response: $HEALTH_RESPONSE"
    fi
else
    error "Service failed to stabilize"
fi

echo -e "\n${BLUE}🎯 FIX ATTEMPT COMPLETE${NC}"
echo "If issues persist, check:"
echo "1. Task definition has correct Docker image"
echo "2. Security groups allow traffic on port 3000"
echo "3. Subnets have internet gateway access"
echo "4. IAM roles have correct permissions" 