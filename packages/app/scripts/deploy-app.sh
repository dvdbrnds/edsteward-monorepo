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
PRODUCTION_URL="https://moravian.edsteward.ai"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 EdSteward Fast Deployment Started${NC}"
echo "=================================================="
echo -e "${YELLOW}💡 Remember: Develop locally using Docker containers${NC}"
echo -e "${YELLOW}   Command: make -f Makefile.local dev${NC}"
echo -e "${BLUE}🎯 Target: ${PRODUCTION_URL}${NC}"
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
    echo -e "\n${GREEN}🎉 ECS DEPLOYMENT SUCCESSFUL!${NC}"
else
    echo -e "\n${RED}❌ ECS deployment failed or timed out${NC}"
    echo "Checking service status..."
    
    # Show current service status
    aws ecs describe-services \
        --cluster ${ECS_CLUSTER} \
        --services ${ECS_SERVICE} \
        --region ${AWS_REGION} \
        --query 'services[0].{ServiceName:serviceName,DesiredCount:desiredCount,RunningCount:runningCount,TaskDefinition:taskDefinition}' \
        --output table
    
    echo -e "\n${RED}❌ Deployment failed - check AWS Console for details${NC}"
    exit 1
fi

# Step 7: Health Check
echo -e "\n${YELLOW}🏥 Step 7: Running health check...${NC}"
sleep 30 # Give the service time to fully start

echo "Testing health endpoint: ${PRODUCTION_URL}/health"
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" ${PRODUCTION_URL}/health)

if [ "$HEALTH_CHECK" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    
    # Test the main application
    echo "Testing main application..."
    MAIN_CHECK=$(curl -s -o /dev/null -w "%{http_code}" ${PRODUCTION_URL}/)
    
    if [ "$MAIN_CHECK" = "200" ]; then
        echo -e "${GREEN}✅ Main application responding${NC}"
    else
        echo -e "${YELLOW}⚠️  Main application returned: ${MAIN_CHECK}${NC}"
    fi
else
    echo -e "${RED}❌ Health check failed: ${HEALTH_CHECK}${NC}"
    echo "Checking service status..."
    
    # Show service events
    aws ecs describe-services \
        --cluster ${ECS_CLUSTER} \
        --services ${ECS_SERVICE} \
        --region ${AWS_REGION} \
        --query 'services[0].events[:5]' \
        --output table
    
    echo -e "\n${YELLOW}💡 Possible issues:${NC}"
    echo "1. Service may still be starting up"
    echo "2. Health check endpoint may not be responding"
    echo "3. ALB target group may not be healthy"
    echo "4. Check ALB listener rules for moravian.edsteward.ai"
    
    exit 1
fi

echo -e "\n${GREEN}🎯 DEPLOYMENT COMPLETE!${NC}"
echo "=================================================="
echo -e "${GREEN}✅ Your EdSteward platform has been updated${NC}"
echo -e "${BLUE}🌐 Production URL: ${PRODUCTION_URL}${NC}"
echo -e "${BLUE}🌐 Health Check: ${PRODUCTION_URL}/health${NC}"
echo -e "${BLUE}⚡ Deployment time: ~3-5 minutes${NC}"
echo -e "${BLUE}🎉 Ready for Moravian University!${NC}" 