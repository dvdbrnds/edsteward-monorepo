#!/bin/zsh

# EdSteward Application Rollback Script
# Use this to quickly rollback to the previous deployment

set -e

# Configuration
AWS_REGION="us-east-1"
ECS_CLUSTER="edsteward-cluster"
ECS_SERVICE="edsteward-service"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}🔄 EdSteward Application Rollback Started${NC}"
echo "=================================================="

# Step 1: Get current deployment info
echo -e "\n${YELLOW}📋 Step 1: Getting current deployment info...${NC}"
CURRENT_TASK_DEF=$(aws ecs describe-services \
    --cluster ${ECS_CLUSTER} \
    --services ${ECS_SERVICE} \
    --region ${AWS_REGION} \
    --query 'services[0].taskDefinition' \
    --output text)

echo "Current task definition: ${CURRENT_TASK_DEF}"

# Step 2: Get previous task definition
echo -e "\n${YELLOW}📜 Step 2: Finding previous task definition...${NC}"
TASK_FAMILY=$(echo ${CURRENT_TASK_DEF} | cut -d':' -f6 | cut -d'/' -f2)
CURRENT_REVISION=$(echo ${CURRENT_TASK_DEF} | cut -d':' -f7)
PREVIOUS_REVISION=$((CURRENT_REVISION - 1))

if [ ${PREVIOUS_REVISION} -lt 1 ]; then
    echo -e "${RED}❌ No previous revision found to rollback to${NC}"
    exit 1
fi

PREVIOUS_TASK_DEF="${TASK_FAMILY}:${PREVIOUS_REVISION}"
echo "Rolling back to: ${PREVIOUS_TASK_DEF}"

# Step 3: Confirm rollback
echo -e "\n${YELLOW}⚠️  Step 3: Rollback confirmation${NC}"
echo "This will rollback your EdSteward platform to the previous version."
echo "Current:  ${CURRENT_TASK_DEF}"
echo "Previous: ${PREVIOUS_TASK_DEF}"
echo ""
read -p "Are you sure you want to rollback? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Rollback cancelled${NC}"
    exit 0
fi

# Step 4: Update ECS service to previous task definition
echo -e "\n${YELLOW}🔄 Step 4: Rolling back ECS service...${NC}"
aws ecs update-service \
    --cluster ${ECS_CLUSTER} \
    --service ${ECS_SERVICE} \
    --task-definition ${PREVIOUS_TASK_DEF} \
    --region ${AWS_REGION}

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Rollback initiated${NC}"
else
    echo -e "${RED}❌ Rollback failed${NC}"
    exit 1
fi

# Step 5: Wait for rollback to complete
echo -e "\n${YELLOW}⏳ Step 5: Waiting for rollback to complete...${NC}"
echo "This may take 2-5 minutes..."

aws ecs wait services-stable \
    --cluster ${ECS_CLUSTER} \
    --services ${ECS_SERVICE} \
    --region ${AWS_REGION}

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ROLLBACK SUCCESSFUL!${NC}"
    echo "=================================================="
    echo -e "${GREEN}✅ Your EdSteward platform has been rolled back${NC}"
    echo -e "${BLUE}🌐 URL: https://edsteward.ai${NC}"
    echo -e "${BLUE}📋 Reverted to: ${PREVIOUS_TASK_DEF}${NC}"
else
    echo -e "\n${RED}❌ Rollback failed or timed out${NC}"
    echo "Check AWS Console for details"
    exit 1
fi

# Step 6: Health Check
echo -e "\n${YELLOW}🏥 Step 6: Running health check...${NC}"
sleep 30 # Give the service time to fully start

# Get the load balancer URL
LB_URL=$(aws elbv2 describe-load-balancers --region ${AWS_REGION} --query 'LoadBalancers[?contains(LoadBalancerName, `edsteward`)].DNSName' --output text)

if [ ! -z "$LB_URL" ]; then
    echo "Testing health endpoint: http://${LB_URL}/health"
    HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://${LB_URL}/health)
    
    if [ "$HEALTH_CHECK" = "200" ]; then
        echo -e "${GREEN}✅ Health check passed after rollback${NC}"
    else
        echo -e "${YELLOW}⚠️  Health check returned: ${HEALTH_CHECK}${NC}"
        echo "Service may still be starting up..."
    fi
else
    echo -e "${YELLOW}⚠️  Could not find load balancer URL${NC}"
fi

echo -e "\n${GREEN}🎯 ROLLBACK COMPLETE!${NC}"
echo "==================================================" 