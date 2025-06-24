#!/bin/zsh

# 🔧 Fix Staging Setup
# This script fixes the staging environment to make it actually accessible

echo "🔧 Fixing staging environment setup..."

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
LOAD_BALANCER_NAME="edsteward-alb"

echo -e "${BLUE}📋 Current Staging Issues:${NC}"
echo "1. Using old production Docker image"
echo "2. No load balancer connection"
echo "3. Multiple unhealthy tasks"
echo ""

echo -e "${YELLOW}🔧 Fixing staging environment...${NC}"

# Step 1: Clean up unhealthy tasks
echo -e "${YELLOW}1️⃣ Cleaning up unhealthy tasks...${NC}"
aws ecs update-service \
    --cluster "$STAGING_CLUSTER" \
    --service "$STAGING_SERVICE" \
    --desired-count 0 \
    --region "$REGION" > /dev/null

echo "Waiting for tasks to stop..."
sleep 30

aws ecs update-service \
    --cluster "$STAGING_CLUSTER" \
    --service "$STAGING_SERVICE" \
    --desired-count 1 \
    --region "$REGION" > /dev/null

echo -e "${GREEN}✅ Service restarted with 1 task${NC}"

# Step 2: Create staging target group for load balancer
echo -e "${YELLOW}2️⃣ Setting up load balancer access...${NC}"

# Get VPC ID from existing target group
VPC_ID=$(aws elbv2 describe-target-groups --names "edsteward-tg-alb" --query 'TargetGroups[0].VpcId' --output text --region "$REGION" 2>/dev/null | cat)

if [ "$VPC_ID" != "None" ] && [ ! -z "$VPC_ID" ]; then
    echo "Found VPC: $VPC_ID"
    
    # Create or get staging target group
    STAGING_TG_ARN=$(aws elbv2 describe-target-groups --names "edsteward-staging-tg" --query 'TargetGroups[0].TargetGroupArn' --output text --region "$REGION" 2>/dev/null | cat)
    
    if [ "$STAGING_TG_ARN" = "None" ] || [ -z "$STAGING_TG_ARN" ]; then
        echo "Creating staging target group..."
        STAGING_TG_ARN=$(aws elbv2 create-target-group \
            --name "edsteward-staging-tg" \
            --protocol HTTP \
            --port 3000 \
            --vpc-id "$VPC_ID" \
            --health-check-path "/" \
            --health-check-interval-seconds 30 \
            --health-check-timeout-seconds 5 \
            --healthy-threshold-count 2 \
            --unhealthy-threshold-count 3 \
            --query 'TargetGroups[0].TargetGroupArn' \
            --output text \
            --region "$REGION" | cat)
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Created staging target group${NC}"
        else
            echo -e "${RED}❌ Failed to create target group${NC}"
        fi
    else
        echo -e "${GREEN}✅ Using existing staging target group${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Could not find VPC, skipping load balancer setup${NC}"
fi

# Step 3: Wait for new task and get its IP
echo -e "${YELLOW}3️⃣ Waiting for staging task to be healthy...${NC}"
sleep 60

# Get the new task IP
TASK_ARN=$(aws ecs list-tasks --cluster "$STAGING_CLUSTER" --service-name "$STAGING_SERVICE" --query 'taskArns[0]' --output text --region "$REGION" | cat)

if [ "$TASK_ARN" != "None" ] && [ ! -z "$TASK_ARN" ]; then
    TASK_IP=$(aws ecs describe-tasks --cluster "$STAGING_CLUSTER" --tasks "$TASK_ARN" --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' --output text --region "$REGION" | cat)
    
    if [ ! -z "$TASK_IP" ] && [ "$TASK_IP" != "None" ]; then
        echo -e "${GREEN}✅ Staging task running at: $TASK_IP${NC}"
        
        # Register with target group if it exists
        if [ ! -z "$STAGING_TG_ARN" ] && [ "$STAGING_TG_ARN" != "None" ]; then
            echo "Registering task with target group..."
            aws elbv2 register-targets \
                --target-group-arn "$STAGING_TG_ARN" \
                --targets Id="$TASK_IP",Port=3000 \
                --region "$REGION" | cat > /dev/null
            
            echo -e "${GREEN}✅ Task registered with load balancer${NC}"
        fi
        
        # Test the staging environment
        echo -e "${YELLOW}4️⃣ Testing staging environment...${NC}"
        sleep 10
        
        echo "Testing HTTP connection..."
        if curl -s --connect-timeout 5 "http://$TASK_IP:3000" > /dev/null; then
            echo -e "${GREEN}✅ Staging environment is responding!${NC}"
        else
            echo -e "${YELLOW}⚠️ Staging environment may still be starting up${NC}"
        fi
        
        echo ""
        echo -e "${GREEN}🎉 Staging Environment Fixed!${NC}"
        echo ""
        echo -e "${BLUE}📋 Access Your Staging Environment:${NC}"
        echo "Direct IP: http://$TASK_IP:3000"
        echo "Login: dvdbrnds / gabadh"
        echo ""
        
        if [ ! -z "$STAGING_TG_ARN" ] && [ "$STAGING_TG_ARN" != "None" ]; then
            echo -e "${BLUE}🌐 Load Balancer Setup:${NC}"
            echo "Target Group: edsteward-staging-tg"
            echo "To add domain routing, you'll need to:"
            echo "1. Add a listener rule to your load balancer"
            echo "2. Point staging.yourdomain.com to your ALB"
        fi
        
        echo ""
        echo -e "${YELLOW}💡 To deploy new changes:${NC}"
        echo "git push origin ES-clientside"
        echo ""
        
    else
        echo -e "${RED}❌ Could not get task IP${NC}"
    fi
else
    echo -e "${RED}❌ No staging tasks found${NC}"
fi

echo -e "${BLUE}📊 Current Status:${NC}"
aws ecs describe-services --cluster "$STAGING_CLUSTER" --services "$STAGING_SERVICE" --query 'services[0].{Status:status,RunningCount:runningCount,DesiredCount:desiredCount}' --region "$REGION" | cat 