#!/bin/zsh

# EdSteward Simple Update Script
# Updates the running application in under 3 minutes

set -e

# Fix AWS CLI pager issue in zsh
export AWS_PAGER=""

# Configuration
AWS_ACCOUNT_ID="259661441422"
AWS_REGION="us-east-1"
ECR_REPOSITORY="edsteward"
CLUSTER_NAME="edsteward-simple"
SERVICE_NAME="edsteward-app"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 EdSteward Simple Update Started${NC}"
echo "=================================================="

# Step 1: Build and Push Docker Image
echo -e "\n${YELLOW}🔨 Step 1: Building updated Docker image...${NC}"
docker build -t ${ECR_REPOSITORY}:latest .
docker tag ${ECR_REPOSITORY}:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest

echo -e "\n${YELLOW}🔐 Step 2: Logging into ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

echo -e "\n${YELLOW}⬆️ Step 3: Pushing updated image...${NC}"
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest
echo -e "${GREEN}✅ Updated image pushed${NC}"

# Step 2: Force new deployment
echo -e "\n${YELLOW}🚀 Step 4: Updating ECS service...${NC}"
aws ecs update-service \
  --cluster ${CLUSTER_NAME} \
  --service ${SERVICE_NAME} \
  --force-new-deployment \
  --region ${AWS_REGION}

echo -e "${GREEN}✅ Service update initiated${NC}"

# Step 3: Wait for deployment
echo -e "\n${YELLOW}⏳ Step 5: Waiting for update to complete...${NC}"
echo "This usually takes 2-3 minutes..."

aws ecs wait services-stable \
  --cluster ${CLUSTER_NAME} \
  --services ${SERVICE_NAME} \
  --region ${AWS_REGION}

# Step 4: Get Public IP and test
echo -e "\n${YELLOW}🔍 Step 6: Getting service info...${NC}"
TASK_ARN=$(aws ecs list-tasks --cluster ${CLUSTER_NAME} --service-name ${SERVICE_NAME} --query 'taskArns[0]' --output text --region ${AWS_REGION})
ENI_ID=$(aws ecs describe-tasks --cluster ${CLUSTER_NAME} --tasks ${TASK_ARN} --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text --region ${AWS_REGION})
PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids ${ENI_ID} --query 'NetworkInterfaces[0].Association.PublicIp' --output text --region ${AWS_REGION})

echo -e "\n${GREEN}🎉 UPDATE SUCCESSFUL!${NC}"
echo "=================================================="
echo -e "${GREEN}✅ EdSteward has been updated!${NC}"
echo -e "${BLUE}🌐 URL: http://${PUBLIC_IP}:3000${NC}"
echo -e "${BLUE}⚡ Update time: ~3-5 minutes${NC}"

# Health Check
echo -e "\n${YELLOW}🏥 Step 7: Running health check...${NC}"
sleep 30
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://${PUBLIC_IP}:3000/health || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
    echo -e "${GREEN}🎯 Your updated EdSteward platform is live!${NC}"
else
    echo -e "${YELLOW}⚠️ Health check returned: ${HEALTH_STATUS}${NC}"
    echo "Service may still be starting up. Check the URL in a few minutes."
fi

echo "==================================================" 