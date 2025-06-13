#!/bin/bash

# Deploy with SSL Database Configuration
# This script deploys the updated code with proper SSL database configuration

set -e  # Exit on any error

echo "🚀 Starting deployment with SSL database configuration..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="us-east-1"
ECR_REPO="259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward"
CLUSTER_NAME="edsteward-cluster"
SERVICE_NAME="edsteward-service"
TASK_FAMILY="edsteward-task"

# Build the application
echo -e "${YELLOW}📦 Building application...${NC}"
npm run build

# Build Docker image with new tag
echo -e "${YELLOW}🐳 Building Docker image...${NC}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
IMAGE_TAG="v12.0-ssl-db-fix-${TIMESTAMP}"
FULL_IMAGE_URI="${ECR_REPO}:${IMAGE_TAG}"

docker build -t edsteward:latest .
docker tag edsteward:latest $FULL_IMAGE_URI

# Login to ECR
echo -e "${YELLOW}🔐 Logging into ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO

# Push image
echo -e "${YELLOW}⬆️ Pushing image to ECR...${NC}"
docker push $FULL_IMAGE_URI
echo -e "${GREEN}✅ Image pushed: ${FULL_IMAGE_URI}${NC}"

# Update the SSL task definition with the new image
echo -e "${YELLOW}📝 Creating new task definition...${NC}"
NEW_TASK_DEF=$(cat ssl-task-def.json | jq --arg IMAGE "$FULL_IMAGE_URI" '.containerDefinitions[0].image = $IMAGE')

# Register the new task definition
echo -e "${YELLOW}📋 Registering new task definition...${NC}"
NEW_TASK_DEF_ARN=$(echo "$NEW_TASK_DEF" | aws ecs register-task-definition --cli-input-json file:///dev/stdin --query 'taskDefinition.taskDefinitionArn' --output text)
echo -e "${GREEN}✅ New task definition registered: ${NEW_TASK_DEF_ARN}${NC}"

# Update the ECS service
echo -e "${YELLOW}🔄 Updating ECS service...${NC}"
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --task-definition $NEW_TASK_DEF_ARN \
    --query 'service.serviceName' \
    --output text

echo -e "${GREEN}✅ ECS service update initiated${NC}"

# Wait for deployment to complete
echo -e "${YELLOW}⏳ Waiting for deployment to complete...${NC}"
aws ecs wait services-stable --cluster $CLUSTER_NAME --services $SERVICE_NAME

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"

# Get the service status
echo -e "${YELLOW}📊 Service status:${NC}"
aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --query 'services[0].{Status:status,RunningCount:runningCount,DesiredCount:desiredCount,TaskDefinition:taskDefinition}' \
    --output table

echo -e "${GREEN}✅ Database fixes deployed with SSL configuration!${NC}"
echo -e "${YELLOW}📝 Monitor the logs to ensure database connection is working:${NC}"
echo "aws logs tail /aws/ecs/edsteward --follow --region $AWS_REGION"

echo -e "\n${GREEN}🔍 Next steps:${NC}"
echo "1. Monitor CloudWatch logs for 'Database health monitoring started'"
echo "2. Check for successful SSL connections"
echo "3. Test application functionality"
echo "4. Run: npm run db:test with production DATABASE_URL to verify"

echo -e "\n${YELLOW}🔗 Useful commands:${NC}"
echo "# View logs:"
echo "aws logs tail /aws/ecs/edsteward --follow --region $AWS_REGION"
echo ""
echo "# Check service status:"
echo "aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME"
echo ""
echo "# Test database connection (after updating .env with production URL):"
echo "npm run db:test" 