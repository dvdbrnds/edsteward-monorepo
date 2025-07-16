#!/bin/zsh

# Troubleshoot 503 Error on moravian.edsteward.ai
# Based on AWS CLI documentation from Context7

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

echo -e "${BLUE}🔧 Troubleshooting 503 Error on ${DOMAIN}${NC}"
echo "Based on AWS CLI Documentation from Context7"
echo "=================================================="

# Step 1: Check Target Group Health
log "Step 1: Checking Target Group Health..."
echo "Target Group ARN: ${TARGET_GROUP_ARN}"

TARGET_HEALTH=$(aws elbv2 describe-target-health \
    --target-group-arn ${TARGET_GROUP_ARN} \
    --region ${AWS_REGION} 2>/dev/null || echo "[]")

if [ "$TARGET_HEALTH" = "[]" ]; then
    error "No targets found in target group"
    echo "This explains the 503 error - ALB has no targets to route traffic to"
else
    echo "Target Health Status:"
    echo "$TARGET_HEALTH" | jq -r '.TargetHealthDescriptions[] | "Target: \(.Target.Id):\(.Target.Port) - Status: \(.TargetHealth.State)"' 2>/dev/null || echo "$TARGET_HEALTH"
fi

# Step 2: Check ECS Service Status
log "Step 2: Checking ECS Service Status..."
ECS_SERVICE_INFO=$(aws ecs describe-services \
    --cluster ${ECS_CLUSTER} \
    --services ${ECS_SERVICE} \
    --region ${AWS_REGION} 2>/dev/null)

if [ $? -eq 0 ]; then
    DESIRED_COUNT=$(echo "$ECS_SERVICE_INFO" | jq -r '.services[0].desiredCount' 2>/dev/null)
    RUNNING_COUNT=$(echo "$ECS_SERVICE_INFO" | jq -r '.services[0].runningCount' 2>/dev/null)
    PENDING_COUNT=$(echo "$ECS_SERVICE_INFO" | jq -r '.services[0].pendingCount' 2>/dev/null)
    
    log "ECS Service Status:"
    echo "  Desired: $DESIRED_COUNT"
    echo "  Running: $RUNNING_COUNT"
    echo "  Pending: $PENDING_COUNT"
    
    if [ "$RUNNING_COUNT" -eq 0 ]; then
        error "No running ECS tasks! This is the root cause of the 503 error."
        
        # Check recent service events
        log "Checking recent service events..."
        echo "$ECS_SERVICE_INFO" | jq -r '.services[0].events[:5][] | "\(.createdAt) - \(.message)"' 2>/dev/null || echo "Could not parse service events"
        
        # Check if tasks are failing to start
        log "Checking if tasks are failing to start..."
        TASK_ARNS=$(aws ecs list-tasks \
            --cluster ${ECS_CLUSTER} \
            --service-name ${ECS_SERVICE} \
            --region ${AWS_REGION} \
            --query 'taskArns' \
            --output text 2>/dev/null)
        
        if [ -n "$TASK_ARNS" ] && [ "$TASK_ARNS" != "None" ]; then
            log "Found tasks, checking task status..."
            aws ecs describe-tasks \
                --cluster ${ECS_CLUSTER} \
                --tasks $TASK_ARNS \
                --region ${AWS_REGION} \
                --query 'tasks[0].{TaskArn:taskArn,LastStatus:lastStatus,DesiredStatus:desiredStatus,StoppedReason:stoppedReason}' \
                --output table 2>/dev/null || echo "Could not describe tasks"
        fi
    else
        success "ECS tasks are running"
    fi
else
    error "Could not describe ECS service"
fi

# Step 3: Check Target Group Configuration
log "Step 3: Checking Target Group Configuration..."
TG_CONFIG=$(aws elbv2 describe-target-groups \
    --target-group-arns ${TARGET_GROUP_ARN} \
    --region ${AWS_REGION} 2>/dev/null)

if [ $? -eq 0 ]; then
    log "Target Group Configuration:"
    echo "$TG_CONFIG" | jq -r '.TargetGroups[0] | "Health Check Path: \(.HealthCheckPath)\nHealth Check Port: \(.HealthCheckPort)\nHealth Check Protocol: \(.HealthCheckProtocol)\nHealthy Threshold: \(.HealthyThresholdCount)\nUnhealthy Threshold: \(.UnhealthyThresholdCount)\nHealth Check Interval: \(.HealthCheckIntervalSeconds)s\nHealth Check Timeout: \(.HealthCheckTimeoutSeconds)s"' 2>/dev/null || echo "Could not parse target group config"
else
    error "Could not describe target group"
fi

# Step 4: Check Load Balancer Rules
log "Step 4: Checking Load Balancer Rules..."
ALB_ARN=$(aws elbv2 describe-load-balancers \
    --names ${ALB_NAME} \
    --region ${AWS_REGION} \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text 2>/dev/null)

if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
    LISTENER_ARN=$(aws elbv2 describe-listeners \
        --load-balancer-arn ${ALB_ARN} \
        --region ${AWS_REGION} \
        --query 'Listeners[0].ListenerArn' \
        --output text 2>/dev/null)
    
    if [ -n "$LISTENER_ARN" ] && [ "$LISTENER_ARN" != "None" ]; then
        log "Checking listener rules for ${DOMAIN}..."
        RULES=$(aws elbv2 describe-rules \
            --listener-arn ${LISTENER_ARN} \
            --region ${AWS_REGION} 2>/dev/null)
        
        MORAVIAN_RULE=$(echo "$RULES" | jq -r '.Rules[] | select(.Conditions[]?.Values[]? | contains("moravian.edsteward.ai")) | .RuleArn' 2>/dev/null)
        
        if [ -n "$MORAVIAN_RULE" ]; then
            success "Found listener rule for ${DOMAIN}: $MORAVIAN_RULE"
        else
            error "No listener rule found for ${DOMAIN}"
        fi
    fi
fi

# Step 5: Test Direct Health Check
log "Step 5: Testing direct health check..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/health)
log "Health check response: $HEALTH_RESPONSE"

if [ "$HEALTH_RESPONSE" = "503" ]; then
    error "503 Service Unavailable - No healthy targets"
elif [ "$HEALTH_RESPONSE" = "200" ]; then
    success "Health check passed!"
else
    warning "Unexpected response: $HEALTH_RESPONSE"
fi

# Step 6: Recommendations
echo -e "\n${BLUE}📋 TROUBLESHOOTING RECOMMENDATIONS${NC}"
echo "=================================================="

if [ "$RUNNING_COUNT" -eq 0 ]; then
    echo -e "${RED}❌ ROOT CAUSE: No running ECS tasks${NC}"
    echo ""
    echo "🔧 IMMEDIATE FIXES:"
    echo "1. Force new ECS deployment:"
    echo "   aws ecs update-service --cluster ${ECS_CLUSTER} --service ${ECS_SERVICE} --force-new-deployment --region ${AWS_REGION}"
    echo ""
    echo "2. Check task definition and logs:"
    echo "   aws ecs describe-tasks --cluster ${ECS_CLUSTER} --tasks [TASK_ARN] --region ${AWS_REGION}"
    echo ""
    echo "3. Check CloudWatch logs:"
    echo "   aws logs describe-log-groups --log-group-name-prefix '/ecs/${ECS_SERVICE}' --region ${AWS_REGION}"
    echo ""
    echo "4. Verify service configuration:"
    echo "   - Check task definition has correct image"
    echo "   - Verify network configuration (subnets, security groups)"
    echo "   - Check IAM roles and permissions"
    echo ""
    echo "5. Register targets manually if needed:"
    echo "   aws elbv2 register-targets --target-group-arn ${TARGET_GROUP_ARN} --targets Id=[IP],Port=3000 --region ${AWS_REGION}"
fi

if [ "$TARGET_HEALTH" = "[]" ]; then
    echo -e "${YELLOW}⚠️  No targets registered with target group${NC}"
    echo "This could be due to:"
    echo "- ECS service not properly configured with target group"
    echo "- Network issues preventing registration"
    echo "- Health check failures"
fi

echo -e "\n${GREEN}✅ VERIFICATION STEPS${NC}"
echo "After fixes, verify:"
echo "1. ECS tasks are running: aws ecs describe-services --cluster ${ECS_CLUSTER} --services ${ECS_SERVICE} --region ${AWS_REGION}"
echo "2. Targets are healthy: aws elbv2 describe-target-health --target-group-arn ${TARGET_GROUP_ARN} --region ${AWS_REGION}"
echo "3. Application responds: curl -I https://${DOMAIN}/health"

echo -e "\n${BLUE}🎯 TROUBLESHOOTING COMPLETE${NC}" 