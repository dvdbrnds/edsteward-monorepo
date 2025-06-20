#!/bin/zsh

# EdSteward Fast Application Deployment Script
# Use this for application updates (NOT infrastructure changes)

set -e

# Configuration
AWS_ACCOUNT_ID="259661441422"
AWS_REGION="us-east-1"
ECR_REPOSITORY="edsteward"
ECS_CLUSTER="edsteward-cluster"
ECS_SERVICE="edsteward-service"
IMAGE_TAG="latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 EdSteward Fast Deployment Started${NC}"
echo "=================================================="

# Step 1: Build Docker Image
echo -e "\n${YELLOW}📦 Step 1: Building Docker image...${NC}"
docker build -t ${ECR_REPOSITORY}:${IMAGE_TAG} .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker build successful${NC}"
else
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi

# Step 2: Tag for ECR
echo -e "\n${YELLOW}🏷️  Step 2: Tagging image for ECR...${NC}"
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}

# Step 3: Login to ECR
echo -e "\n${YELLOW}🔐 Step 3: Logging into ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ ECR login successful${NC}"
else
    echo -e "${RED}❌ ECR login failed${NC}"
    exit 1
fi

# Step 4: Push to ECR
echo -e "\n${YELLOW}⬆️  Step 4: Pushing image to ECR...${NC}"
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Image pushed successfully${NC}"
else
    echo -e "${RED}❌ Image push failed${NC}"
    exit 1
fi

# Step 5: Update ECS Service
echo -e "\n${YELLOW}🔄 Step 5: Updating ECS service...${NC}"
aws ecs update-service \
    --cluster ${ECS_CLUSTER} \
    --service ${ECS_SERVICE} \
    --force-new-deployment \
    --region ${AWS_REGION}

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ ECS service update initiated${NC}"
else
    echo -e "${RED}❌ ECS service update failed${NC}"
    exit 1
fi

# Step 6: Wait for deployment
echo -e "\n${YELLOW}⏳ Step 6: Waiting for deployment to complete...${NC}"
echo "This may take 2-5 minutes..."

aws ecs wait services-stable \
    --cluster ${ECS_CLUSTER} \
    --services ${ECS_SERVICE} \
    --region ${AWS_REGION}

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
    echo "=================================================="
    echo -e "${GREEN}✅ Your EdSteward platform has been updated${NC}"
    echo -e "${BLUE}🌐 URL: https://edsteward.ai${NC}"
    echo -e "${BLUE}⚡ Deployment time: ~3-5 minutes${NC}"
else
    echo -e "\n${RED}❌ Deployment failed or timed out${NC}"
    echo "Check AWS Console for details"
    exit 1
fi

# Step 7: Health Check
echo -e "\n${YELLOW}🏥 Step 7: Running health check...${NC}"
sleep 30 # Give the service time to fully start

# Get the load balancer URL
LB_URL=$(aws elbv2 describe-load-balancers --region ${AWS_REGION} --query 'LoadBalancers[?contains(LoadBalancerName, `edsteward`)].DNSName' --output text)

if [ ! -z "$LB_URL" ]; then
    echo "Testing health endpoint: http://${LB_URL}/health"
    HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://${LB_URL}/health)
    
    if [ "$HEALTH_CHECK" = "200" ]; then
        echo -e "${GREEN}✅ Health check passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Health check returned: ${HEALTH_CHECK}${NC}"
        echo "Service may still be starting up..."
    fi
else
    echo -e "${YELLOW}⚠️  Could not find load balancer URL${NC}"
fi

echo -e "\n${GREEN}🎯 DEPLOYMENT COMPLETE!${NC}"
echo "==================================================" 