#!/bin/zsh

# 🔍 Check EdSteward Production Status
# Quick status check for production deployment
# Usage: ./scripts/check-production-status.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
AWS_REGION="us-east-1"
ECS_CLUSTER="edsteward-cluster"
ECS_SERVICE="edsteward-service"
ECR_REPOSITORY="edsteward"

echo -e "${BLUE}🔍 EdSteward Production Status Check${NC}"
echo "=================================="

# Check ECS Service Status
echo -e "\n${YELLOW}📊 ECS Service Status:${NC}"
SERVICE_INFO=$(aws ecs describe-services \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION \
    --query 'services[0]' 2>/dev/null)

if [ $? -eq 0 ]; then
    RUNNING_COUNT=$(echo $SERVICE_INFO | jq -r '.runningCount')
    DESIRED_COUNT=$(echo $SERVICE_INFO | jq -r '.desiredCount')
    PENDING_COUNT=$(echo $SERVICE_INFO | jq -r '.pendingCount')
    SERVICE_STATUS=$(echo $SERVICE_INFO | jq -r '.status')
    
    echo "  Service Status: $SERVICE_STATUS"
    echo "  Running Tasks: $RUNNING_COUNT/$DESIRED_COUNT"
    echo "  Pending Tasks: $PENDING_COUNT"
    
    # Check deployment status
    DEPLOYMENT_STATUS=$(echo $SERVICE_INFO | jq -r '.deployments[] | select(.status == "PRIMARY") | .rolloutState // "UNKNOWN"')
    echo "  Deployment State: $DEPLOYMENT_STATUS"
    
    if [ "$RUNNING_COUNT" -eq "$DESIRED_COUNT" ] && [ "$DEPLOYMENT_STATUS" = "COMPLETED" ]; then
        echo -e "  ${GREEN}✅ Service is healthy and stable${NC}"
    elif [ "$DEPLOYMENT_STATUS" = "IN_PROGRESS" ]; then
        echo -e "  ${YELLOW}⏳ Deployment in progress${NC}"
    else
        echo -e "  ${RED}⚠️ Service may have issues${NC}"
    fi
else
    echo -e "  ${RED}❌ Could not retrieve service status${NC}"
fi

# Check Load Balancer Status
echo -e "\n${YELLOW}🌐 Load Balancer Status:${NC}"
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --names "${ECR_REPOSITORY}-alb" \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].DNSName' \
    --output text 2>/dev/null || echo "Not found")

if [ "$ALB_DNS" != "Not found" ]; then
    echo "  DNS Name: $ALB_DNS"
    echo "  URL: https://$ALB_DNS"
    
    # Quick health check
    if curl -s --max-time 10 "https://$ALB_DNS/health" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Application is responding${NC}"
    else
        echo -e "  ${YELLOW}⚠️ Application health check failed${NC}"
    fi
else
    echo -e "  ${RED}❌ Load balancer not found${NC}"
fi

# Check Recent ECR Images
echo -e "\n${YELLOW}🏷️ Recent ECR Images:${NC}"
RECENT_IMAGES=$(aws ecr describe-images \
    --repository-name $ECR_REPOSITORY \
    --region $AWS_REGION \
    --query 'sort_by(imageDetails,&imagePushedAt)[-3:].[imageTags[0],imagePushedAt]' \
    --output table 2>/dev/null || echo "")

if [ -n "$RECENT_IMAGES" ]; then
    echo "$RECENT_IMAGES"
else
    echo -e "  ${RED}❌ Could not retrieve ECR images${NC}"
fi

# Check CloudWatch Logs (last 5 log events)
echo -e "\n${YELLOW}📋 Recent Logs:${NC}"
RECENT_LOGS=$(aws logs describe-log-streams \
    --log-group-name "/aws/ecs/edsteward" \
    --region $AWS_REGION \
    --order-by LastEventTime \
    --descending \
    --max-items 1 \
    --query 'logStreams[0].logStreamName' \
    --output text 2>/dev/null || echo "")

if [ -n "$RECENT_LOGS" ] && [ "$RECENT_LOGS" != "None" ]; then
    echo "  Latest log stream: $RECENT_LOGS"
    echo "  Recent events:"
    aws logs get-log-events \
        --log-group-name "/aws/ecs/edsteward" \
        --log-stream-name "$RECENT_LOGS" \
        --region $AWS_REGION \
        --limit 3 \
        --query 'events[].message' \
        --output text 2>/dev/null | sed 's/^/    /' || echo "    No recent logs found"
else
    echo -e "  ${YELLOW}⚠️ No recent logs found${NC}"
fi

echo -e "\n${BLUE}Status check complete!${NC}" 