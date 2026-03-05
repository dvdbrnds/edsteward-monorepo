#!/bin/zsh
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="us-east-1"
DEV_CLUSTER="edsteward-multi-tenant-dev-cluster"
DEV_SERVICE="edsteward-multi-tenant-dev-service"
DEV_TARGET_GROUP="edsteward-dev-tg"
ECR_REPOSITORY="edsteward-multi-tenant"

echo -e "${BLUE}🚀 Setting up EdSteward Dev Environment${NC}"
echo "=============================================="
echo ""

# Function to check if resource exists
check_cluster_exists() {
    aws ecs describe-clusters --clusters "$1" --query 'clusters[0].status' --output text 2>/dev/null || echo "NONE"
}

check_target_group_exists() {
    aws elbv2 describe-target-groups --names "$1" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "None"
}

# Get VPC and subnet information from existing staging setup
echo -e "${BLUE}📋 Getting existing infrastructure details...${NC}"

# Get VPC from existing staging target group
STAGING_TG_ARN=$(aws elbv2 describe-target-groups --names "edsteward-staging-ip-tg" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "None")

if [ "$STAGING_TG_ARN" = "None" ]; then
    echo -e "${RED}❌ Could not find staging target group. Please ensure staging environment is set up first.${NC}"
    exit 1
fi

VPC_ID=$(aws elbv2 describe-target-groups --target-group-arns "$STAGING_TG_ARN" --query 'TargetGroups[0].VpcId' --output text)
echo "VPC ID: $VPC_ID"

# Get subnets from existing staging service
STAGING_SERVICE_ARN=$(aws ecs describe-services --cluster "edsteward-multi-tenant-staging-cluster" --services "edsteward-multi-tenant-staging-service" --query 'services[0].serviceArn' --output text 2>/dev/null || echo "None")

if [ "$STAGING_SERVICE_ARN" = "None" ]; then
    echo -e "${RED}❌ Could not find staging service. Please ensure staging environment is set up first.${NC}"
    exit 1
fi

# Get subnets from staging service
SUBNETS=$(aws ecs describe-services --cluster "edsteward-multi-tenant-staging-cluster" --services "edsteward-multi-tenant-staging-service" --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets' --output text | tr '\t' ',')
SECURITY_GROUPS=$(aws ecs describe-services --cluster "edsteward-multi-tenant-staging-cluster" --services "edsteward-multi-tenant-staging-service" --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups' --output text | tr '\t' ',')

echo "Subnets: $SUBNETS"
echo "Security Groups: $SECURITY_GROUPS"

# 1. Create ECS Cluster
echo ""
echo -e "${BLUE}📦 Creating ECS cluster...${NC}"
CLUSTER_STATUS=$(check_cluster_exists "$DEV_CLUSTER")

if [ "$CLUSTER_STATUS" = "ACTIVE" ]; then
    echo -e "${GREEN}✅ Dev cluster already exists${NC}"
else
    aws ecs create-cluster \
        --cluster-name "$DEV_CLUSTER" \
        --capacity-providers FARGATE \
        --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
        --region "$REGION"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Dev cluster created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create dev cluster${NC}"
        exit 1
    fi
fi

# 2. Create Target Group
echo ""
echo -e "${BLUE}🎯 Creating target group...${NC}"
DEV_TG_ARN=$(check_target_group_exists "$DEV_TARGET_GROUP")

if [ "$DEV_TG_ARN" != "None" ]; then
    echo -e "${GREEN}✅ Dev target group already exists${NC}"
else
    DEV_TG_ARN=$(aws elbv2 create-target-group \
        --name "$DEV_TARGET_GROUP" \
        --protocol HTTP \
        --port 3000 \
        --vpc-id "$VPC_ID" \
        --target-type ip \
        --health-check-path /health \
        --health-check-interval-seconds 30 \
        --health-check-timeout-seconds 5 \
        --healthy-threshold-count 2 \
        --unhealthy-threshold-count 3 \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Dev target group created: $DEV_TG_ARN${NC}"
    else
        echo -e "${RED}❌ Failed to create dev target group${NC}"
        exit 1
    fi
fi

# 3. Get Load Balancer ARN and create listener rule
echo ""
echo -e "${BLUE}🔀 Setting up load balancer rules...${NC}"

# Get ALB ARN from existing staging setup
ALB_ARN=$(aws elbv2 describe-target-groups --target-group-arns "$STAGING_TG_ARN" --query 'TargetGroups[0].LoadBalancerArns[0]' --output text)
echo "Load Balancer ARN: $ALB_ARN"

# Get HTTPS listener ARN
HTTPS_LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[?Protocol==`HTTPS`].ListenerArn' --output text)
echo "HTTPS Listener ARN: $HTTPS_LISTENER_ARN"

# Check if dev rule already exists
EXISTING_RULE=$(aws elbv2 describe-rules --listener-arn "$HTTPS_LISTENER_ARN" --query 'Rules[?Conditions[0].Values[0]==`dev.edsteward.ai`].RuleArn' --output text)

if [ -n "$EXISTING_RULE" ] && [ "$EXISTING_RULE" != "None" ]; then
    echo -e "${GREEN}✅ Dev listener rule already exists${NC}"
else
    # Create listener rule for dev.edsteward.ai
    aws elbv2 create-rule \
        --listener-arn "$HTTPS_LISTENER_ARN" \
        --priority 200 \
        --conditions Field=host-header,Values=dev.edsteward.ai \
        --actions Type=forward,TargetGroupArn="$DEV_TG_ARN"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Dev listener rule created${NC}"
    else
        echo -e "${RED}❌ Failed to create dev listener rule${NC}"
        exit 1
    fi
fi

# 4. Create ECS Service
echo ""
echo -e "${BLUE}⚙️ Creating ECS service...${NC}"

# Check if service already exists
SERVICE_STATUS=$(aws ecs describe-services --cluster "$DEV_CLUSTER" --services "$DEV_SERVICE" --query 'services[0].status' --output text 2>/dev/null || echo "NONE")

if [ "$SERVICE_STATUS" = "ACTIVE" ]; then
    echo -e "${GREEN}✅ Dev service already exists${NC}"
else
    # Get task definition from staging and modify for dev
    echo "Getting staging task definition..."
    STAGING_TASK_DEF_ARN=$(aws ecs describe-services --cluster "edsteward-multi-tenant-staging-cluster" --services "edsteward-multi-tenant-staging-service" --query 'services[0].taskDefinition' --output text)
    
    # Download staging task definition
    aws ecs describe-task-definition --task-definition "$STAGING_TASK_DEF_ARN" --query 'taskDefinition' > temp-staging-task-def.json
    
    # Create dev task definition (modify for dev environment)
    cat temp-staging-task-def.json | jq '
        .family = "edsteward-multi-tenant-dev" |
        .containerDefinitions[0].environment = [
            {"name": "NODE_ENV", "value": "development"},
            {"name": "ENVIRONMENT_NAME", "value": "dev"},
            {"name": "TENANT_DETECTION_METHOD", "value": "subdomain"},
            {"name": "CORS_ORIGIN", "value": "https://dev.edsteward.ai"},
            {"name": "DATABASE_URL", "value": "postgresql://neondb_owner:5EbW9AKb5Tqm@ep-bold-truth-a5jknxpw.us-east-1.aws.neon.tech/regulatorytrackr-staging?sslmode=require"}
        ] |
        del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)
    ' > dev-task-definition.json
    
    # Register dev task definition
    DEV_TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file://dev-task-definition.json --query 'taskDefinition.taskDefinitionArn' --output text)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Dev task definition registered: $DEV_TASK_DEF_ARN${NC}"
    else
        echo -e "${RED}❌ Failed to register dev task definition${NC}"
        exit 1
    fi
    
    # Create the service
    aws ecs create-service \
        --cluster "$DEV_CLUSTER" \
        --service-name "$DEV_SERVICE" \
        --task-definition "$DEV_TASK_DEF_ARN" \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUPS],assignPublicIp=ENABLED}" \
        --load-balancers "targetGroupArn=$DEV_TG_ARN,containerName=app,containerPort=3000"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Dev service created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create dev service${NC}"
        exit 1
    fi
    
    # Clean up temp files
    rm -f temp-staging-task-def.json dev-task-definition.json
fi

# 5. Wait for service to be stable
echo ""
echo -e "${BLUE}⏳ Waiting for dev service to be stable...${NC}"
aws ecs wait services-stable --cluster "$DEV_CLUSTER" --services "$DEV_SERVICE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dev service is stable and running${NC}"
else
    echo -e "${YELLOW}⚠️ Service may still be starting up${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Dev environment setup complete!${NC}"
echo ""
echo -e "${BLUE}🌐 Dev environment will be available at:${NC}"
echo -e "  • ${YELLOW}https://dev.edsteward.ai${NC} (platform development)"
echo ""
echo -e "${BLUE}🏢 Multi-tenant SaaS platform serves all clients:${NC}"
echo -e "  • ${YELLOW}moravian.edsteward.ai${NC} (most mature tenant)"
echo -e "  • Future tenants get same platform updates"
echo -e "  • Feature flags control tenant-specific rollouts"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Update DNS: Add CNAME record for dev.edsteward.ai → your-alb-domain"
echo "2. Update GitHub Actions workflow to deploy dev branch"
echo "3. Create dev branch: git checkout -b dev && git push origin dev"
echo "4. Test deployment: Push to dev branch"
echo ""
echo -e "${BLUE}💡 Useful commands:${NC}"
echo "• Check dev service status: aws ecs describe-services --cluster $DEV_CLUSTER --services $DEV_SERVICE"
echo "• View dev logs: aws logs tail /ecs/edsteward-multi-tenant-dev --follow"
echo "• Deploy to dev: git push origin dev" 