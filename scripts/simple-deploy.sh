#!/bin/zsh

# EdSteward Simple & Fast Deployment
# This creates minimal infrastructure and deploys in under 10 minutes

set -e

# Fix AWS CLI pager issue in zsh
export AWS_PAGER=""

# Configuration
AWS_ACCOUNT_ID="259661441422"
AWS_REGION="us-east-1"
ECR_REPOSITORY="edsteward"
CLUSTER_NAME="edsteward-simple"
SERVICE_NAME="edsteward-app"
TASK_FAMILY="edsteward-task"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 EdSteward Simple Deployment Started${NC}"
echo "This will create minimal infrastructure and deploy your app quickly!"
echo "=================================================="

# Step 1: Create ECR Repository (if it doesn't exist)
echo -e "\n${YELLOW}📦 Step 1: Setting up ECR repository...${NC}"
aws ecr describe-repositories --repository-names ${ECR_REPOSITORY} --region ${AWS_REGION} 2>/dev/null || \
aws ecr create-repository --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION}
echo -e "${GREEN}✅ ECR repository ready${NC}"

# Step 2: Build and Push Docker Image
echo -e "\n${YELLOW}🔨 Step 2: Building Docker image...${NC}"
docker build -t ${ECR_REPOSITORY}:latest .
docker tag ${ECR_REPOSITORY}:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest

echo -e "\n${YELLOW}🔐 Step 3: Logging into ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

echo -e "\n${YELLOW}⬆️ Step 4: Pushing image...${NC}"
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest
echo -e "${GREEN}✅ Image pushed successfully${NC}"

# Step 3: Create ECS Cluster (if it doesn't exist)
echo -e "\n${YELLOW}🏗️ Step 5: Setting up ECS cluster...${NC}"
aws ecs describe-clusters --clusters ${CLUSTER_NAME} --region ${AWS_REGION} 2>/dev/null || \
aws ecs create-cluster --cluster-name ${CLUSTER_NAME} --region ${AWS_REGION}
echo -e "${GREEN}✅ ECS cluster ready${NC}"

# Step 4: Create Task Definition
echo -e "\n${YELLOW}📋 Step 6: Creating task definition...${NC}"
cat > task-definition.json << EOF
{
  "family": "${TASK_FAMILY}",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "edsteward-app",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "MULTI_TENANT",
          "value": "true"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/edsteward-simple",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Create CloudWatch Log Group
aws logs create-log-group --log-group-name "/ecs/edsteward-simple" --region ${AWS_REGION} 2>/dev/null || true

# Register Task Definition
aws ecs register-task-definition --cli-input-json file://task-definition.json --region ${AWS_REGION}
echo -e "${GREEN}✅ Task definition created${NC}"

# Step 5: Get Default VPC and Subnets
echo -e "\n${YELLOW}🌐 Step 7: Getting network configuration...${NC}"
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text --region ${AWS_REGION})
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=${VPC_ID}" --query 'Subnets[0:2].SubnetId' --output text --region ${AWS_REGION})

echo "Using VPC: ${VPC_ID}"
echo "Using Subnets: ${SUBNET_IDS}"

# Step 6: Create Security Group
echo -e "\n${YELLOW}🔒 Step 8: Creating security group...${NC}"
SG_ID=$(aws ec2 create-security-group \
  --group-name edsteward-simple-sg \
  --description "EdSteward Simple Security Group" \
  --vpc-id ${VPC_ID} \
  --region ${AWS_REGION} \
  --query 'GroupId' --output text 2>/dev/null || \
  aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=edsteward-simple-sg" \
  --query 'SecurityGroups[0].GroupId' --output text --region ${AWS_REGION})

# Add inbound rule for port 3000
aws ec2 authorize-security-group-ingress \
  --group-id ${SG_ID} \
  --protocol tcp \
  --port 3000 \
  --cidr 0.0.0.0/0 \
  --region ${AWS_REGION} 2>/dev/null || true

echo "Security Group: ${SG_ID}"

# Step 7: Create ECS Service
echo -e "\n${YELLOW}🚀 Step 9: Creating ECS service...${NC}"
aws ecs create-service \
  --cluster ${CLUSTER_NAME} \
  --service-name ${SERVICE_NAME} \
  --task-definition ${TASK_FAMILY}:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$(echo ${SUBNET_IDS} | tr ' ' ',')],securityGroups=[${SG_ID}],assignPublicIp=ENABLED}" \
  --region ${AWS_REGION} 2>/dev/null || \
aws ecs update-service \
  --cluster ${CLUSTER_NAME} \
  --service ${SERVICE_NAME} \
  --task-definition ${TASK_FAMILY}:1 \
  --region ${AWS_REGION}

echo -e "${GREEN}✅ ECS service created/updated${NC}"

# Step 8: Wait for service to be stable
echo -e "\n${YELLOW}⏳ Step 10: Waiting for service to start...${NC}"
echo "This usually takes 2-3 minutes..."

aws ecs wait services-stable \
  --cluster ${CLUSTER_NAME} \
  --services ${SERVICE_NAME} \
  --region ${AWS_REGION}

# Step 9: Get Public IP
echo -e "\n${YELLOW}🔍 Step 11: Getting public IP...${NC}"
TASK_ARN=$(aws ecs list-tasks --cluster ${CLUSTER_NAME} --service-name ${SERVICE_NAME} --query 'taskArns[0]' --output text --region ${AWS_REGION})
ENI_ID=$(aws ecs describe-tasks --cluster ${CLUSTER_NAME} --tasks ${TASK_ARN} --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text --region ${AWS_REGION})
PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids ${ENI_ID} --query 'NetworkInterfaces[0].Association.PublicIp' --output text --region ${AWS_REGION})

echo -e "\n${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
echo "=================================================="
echo -e "${GREEN}✅ EdSteward is now running!${NC}"
echo -e "${BLUE}🌐 Public URL: http://${PUBLIC_IP}:3000${NC}"
echo -e "${BLUE}🏥 Health Check: http://${PUBLIC_IP}:3000/health${NC}"
echo -e "${BLUE}⚡ Total deployment time: ~5-8 minutes${NC}"

# Step 10: Health Check
echo -e "\n${YELLOW}🏥 Step 12: Running health check...${NC}"
sleep 30
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://${PUBLIC_IP}:3000/health || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
    echo -e "${GREEN}🎯 Your EdSteward platform is live and ready!${NC}"
else
    echo -e "${YELLOW}⚠️ Health check returned: ${HEALTH_STATUS}${NC}"
    echo "Service may still be starting up. Check the URL in a few minutes."
fi

# Cleanup
rm -f task-definition.json

echo -e "\n${BLUE}📝 Next Steps:${NC}"
echo "• Test your app: http://${PUBLIC_IP}:3000"
echo "• For updates: ./scripts/update-simple.sh"
echo "• View logs: aws logs tail /ecs/edsteward-simple --follow"
echo "==================================================" 