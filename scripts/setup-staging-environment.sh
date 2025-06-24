#!/bin/zsh

# 🚀 Setup Staging Environment on AWS
# This script helps you create a staging environment that mirrors production

echo "🎯 Setting up staging environment for EdSteward..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="us-east-1"
STAGING_CLUSTER="edsteward-multi-tenant-staging-cluster"
STAGING_SERVICE="edsteward-multi-tenant-staging-service"
PRODUCTION_CLUSTER="edsteward-multi-tenant-cluster"
PRODUCTION_SERVICE="edsteward-multi-tenant-service"

echo -e "${BLUE}📋 Staging Environment Configuration:${NC}"
echo "  Region: $REGION"
echo "  Staging Cluster: $STAGING_CLUSTER"
echo "  Staging Service: $STAGING_SERVICE"
echo ""

# Check if AWS CLI is installed and configured
echo -e "${YELLOW}🔍 Checking AWS CLI...${NC}"
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    echo "Install: brew install awscli"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI configured${NC}"

# Function to check if ECS cluster exists
check_cluster_exists() {
    local cluster_name=$1
    aws ecs describe-clusters --clusters "$cluster_name" --query 'clusters[0].status' --output text 2>/dev/null
}

# Function to create ECS cluster
create_cluster() {
    local cluster_name=$1
    echo -e "${YELLOW}🏗️  Creating ECS cluster: $cluster_name${NC}"
    
    aws ecs create-cluster \
        --cluster-name "$cluster_name" \
        --capacity-providers FARGATE \
        --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
        --region "$REGION"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Cluster created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create cluster${NC}"
        return 1
    fi
}

# Function to copy service from production to staging
copy_service_to_staging() {
    echo -e "${YELLOW}📋 Getting production service definition...${NC}"
    
    # Get the current production task definition
    TASK_DEF_ARN=$(aws ecs describe-services \
        --cluster "$PRODUCTION_CLUSTER" \
        --services "$PRODUCTION_SERVICE" \
        --query 'services[0].taskDefinition' \
        --output text \
        --region "$REGION")
    
    if [ "$TASK_DEF_ARN" = "None" ] || [ -z "$TASK_DEF_ARN" ]; then
        echo -e "${RED}❌ Could not find production service. Please ensure production is set up first.${NC}"
        return 1
    fi
    
    echo "Production task definition: $TASK_DEF_ARN"
    
    # Get the task definition details
    aws ecs describe-task-definition \
        --task-definition "$TASK_DEF_ARN" \
        --query 'taskDefinition' \
        --region "$REGION" > temp-task-def.json
    
    # Create staging task definition (modify for staging)
    cat temp-task-def.json | jq '
        del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy) |
        .family = "edsteward-multi-tenant-staging" |
        .containerDefinitions[0].environment |= map(
            if .name == "NODE_ENV" then .value = "staging"
            elif .name == "DATABASE_URL" then .value = "postgresql://staging_user:staging_pass@staging-db-host:5432/staging_db?sslmode=require"
            else . end
        )
    ' > staging-task-def.json
    
    # Register the staging task definition
    echo -e "${YELLOW}📝 Registering staging task definition...${NC}"
    STAGING_TASK_DEF_ARN=$(aws ecs register-task-definition \
        --cli-input-json file://staging-task-def.json \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text \
        --region "$REGION")
    
    echo "Staging task definition: $STAGING_TASK_DEF_ARN"
    
    # Clean up temp files
    rm temp-task-def.json staging-task-def.json
    
    # Create the staging service
    echo -e "${YELLOW}🚀 Creating staging service...${NC}"
    aws ecs create-service \
        --cluster "$STAGING_CLUSTER" \
        --service-name "$STAGING_SERVICE" \
        --task-definition "$STAGING_TASK_DEF_ARN" \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}" \
        --region "$REGION"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Staging service created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create staging service${NC}"
        echo -e "${YELLOW}💡 You may need to update the network configuration manually${NC}"
        return 1
    fi
}

# Main execution
echo -e "${BLUE}🚀 Starting staging environment setup...${NC}"

# Check if staging cluster exists
STAGING_STATUS=$(check_cluster_exists "$STAGING_CLUSTER")
if [ "$STAGING_STATUS" = "ACTIVE" ]; then
    echo -e "${GREEN}✅ Staging cluster already exists${NC}"
else
    create_cluster "$STAGING_CLUSTER"
fi

# Copy service configuration from production
copy_service_to_staging

echo ""
echo -e "${GREEN}🎉 Staging environment setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Update your staging database configuration"
echo "2. Configure staging domain/load balancer"
echo "3. Test the staging deployment"
echo ""
echo -e "${BLUE}🔗 Workflow:${NC}"
echo "• Push to 'ES-clientside' branch → Deploys to STAGING"
echo "• Push to 'main' branch → Deploys to PRODUCTION"
echo ""
echo -e "${YELLOW}💡 To create a staging branch:${NC}"
echo "git checkout -b staging"
echo "git push origin staging" 