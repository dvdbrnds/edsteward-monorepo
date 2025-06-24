#!/bin/zsh

# 🌐 Setup Staging Domain
# This script helps you configure domain routing for your staging environment

echo "🌐 Setting up staging domain for EdSteward..."

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

echo -e "${BLUE}📋 Staging Domain Setup Options:${NC}"
echo "1. Create staging subdomain (staging.yourdomain.com) - Recommended"
echo "2. Use host-based routing on existing load balancer"
echo "3. Create separate load balancer for staging"
echo "4. Local testing with port forwarding"
echo ""

echo -n "Choose option (1-4): "
read choice

case $choice in
    1)
        echo -e "${YELLOW}🏗️ Setting up staging subdomain...${NC}"
        setup_subdomain_routing
        ;;
    2)
        echo -e "${YELLOW}🔀 Setting up host-based routing...${NC}"
        setup_host_routing
        ;;
    3)
        echo -e "${YELLOW}⚖️ Creating separate load balancer...${NC}"
        setup_separate_alb
        ;;
    4)
        echo -e "${YELLOW}🔧 Setting up local testing...${NC}"
        setup_local_testing
        ;;
    *)
        echo -e "${RED}❌ Invalid option${NC}"
        exit 1
        ;;
esac

# Function to set up subdomain routing (Option 1 - Recommended)
setup_subdomain_routing() {
    echo -e "${BLUE}📝 Subdomain Setup Steps:${NC}"
    echo ""
    echo "This will create staging.yourdomain.com that routes to your staging environment"
    echo ""
    
    # Get current load balancer ARN
    LB_ARN=$(aws elbv2 describe-load-balancers --names "$LOAD_BALANCER_NAME" --query 'LoadBalancers[0].LoadBalancerArn' --output text --region "$REGION" | cat)
    
    if [ "$LB_ARN" = "None" ] || [ -z "$LB_ARN" ]; then
        echo -e "${RED}❌ Could not find load balancer: $LOAD_BALANCER_NAME${NC}"
        return 1
    fi
    
    echo "Load Balancer ARN: $LB_ARN"
    
    # Create staging target group
    echo -e "${YELLOW}🎯 Creating staging target group...${NC}"
    
    # Get VPC ID from existing target group
    VPC_ID=$(aws elbv2 describe-target-groups --names "edsteward-tg-alb" --query 'TargetGroups[0].VpcId' --output text --region "$REGION" | cat)
    
    STAGING_TG_ARN=$(aws elbv2 create-target-group \
        --name "edsteward-staging-tg" \
        --protocol HTTP \
        --port 3000 \
        --vpc-id "$VPC_ID" \
        --health-check-path "/health" \
        --health-check-interval-seconds 30 \
        --health-check-timeout-seconds 5 \
        --healthy-threshold-count 2 \
        --unhealthy-threshold-count 3 \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text \
        --region "$REGION" | cat)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Staging target group created: $STAGING_TG_ARN${NC}"
    else
        echo -e "${YELLOW}⚠️ Target group may already exist, continuing...${NC}"
        STAGING_TG_ARN=$(aws elbv2 describe-target-groups --names "edsteward-staging-tg" --query 'TargetGroups[0].TargetGroupArn' --output text --region "$REGION" | cat)
    fi
    
    # Register staging ECS service with target group
    echo -e "${YELLOW}🔗 Registering staging service with target group...${NC}"
    register_ecs_targets_with_target_group "$STAGING_TG_ARN"
    
    # Get listener ARNs
    HTTPS_LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn "$LB_ARN" --query 'Listeners[?Port==`443`].ListenerArn' --output text --region "$REGION" | cat)
    HTTP_LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn "$LB_ARN" --query 'Listeners[?Port==`80`].ListenerArn' --output text --region "$REGION" | cat)
    
    # Add staging rules to listeners
    if [ ! -z "$HTTPS_LISTENER_ARN" ]; then
        echo -e "${YELLOW}🔒 Adding HTTPS staging rule...${NC}"
        aws elbv2 create-rule \
            --listener-arn "$HTTPS_LISTENER_ARN" \
            --priority 100 \
            --conditions Field=host-header,Values=staging.yourdomain.com \
            --actions Type=forward,TargetGroupArn="$STAGING_TG_ARN" \
            --region "$REGION" | cat > /dev/null
    fi
    
    if [ ! -z "$HTTP_LISTENER_ARN" ]; then
        echo -e "${YELLOW}🌐 Adding HTTP staging rule...${NC}"
        aws elbv2 create-rule \
            --listener-arn "$HTTP_LISTENER_ARN" \
            --priority 100 \
            --conditions Field=host-header,Values=staging.yourdomain.com \
            --actions Type=forward,TargetGroupArn="$STAGING_TG_ARN" \
            --region "$REGION" | cat > /dev/null
    fi
    
    echo -e "${GREEN}✅ Load balancer routing configured!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Add DNS record: staging.yourdomain.com → $(aws elbv2 describe-load-balancers --names "$LOAD_BALANCER_NAME" --query 'LoadBalancers[0].DNSName' --output text --region "$REGION")"
    echo "2. Update SSL certificate to include staging.yourdomain.com"
    echo "3. Test: https://staging.yourdomain.com"
}

# Function to register ECS service targets with target group
register_ecs_targets_with_target_group() {
    local target_group_arn=$1
    
    echo "Getting ECS task IPs for staging service..."
    
    # Get task ARNs for staging service
    TASK_ARNS=$(aws ecs list-tasks --cluster "$STAGING_CLUSTER" --service-name "$STAGING_SERVICE" --query 'taskArns' --output text --region "$REGION" | cat)
    
    if [ -z "$TASK_ARNS" ] || [ "$TASK_ARNS" = "None" ]; then
        echo -e "${YELLOW}⚠️ No running tasks found for staging service${NC}"
        return 1
    fi
    
    # Get task details to find IP addresses
    for task_arn in $TASK_ARNS; do
        TASK_IP=$(aws ecs describe-tasks --cluster "$STAGING_CLUSTER" --tasks "$task_arn" --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' --output text --region "$REGION" | cat)
        
        if [ ! -z "$TASK_IP" ] && [ "$TASK_IP" != "None" ]; then
            echo "Registering task IP: $TASK_IP"
            aws elbv2 register-targets \
                --target-group-arn "$target_group_arn" \
                --targets Id="$TASK_IP",Port=3000 \
                --region "$REGION" | cat > /dev/null
        fi
    done
}

# Function for host-based routing (Option 2)
setup_host_routing() {
    echo -e "${BLUE}📝 Host-based Routing Setup:${NC}"
    echo "This adds staging routing rules to your existing load balancer"
    echo ""
    
    echo -n "Enter your staging hostname (e.g., staging.yourdomain.com): "
    read staging_hostname
    
    if [ -z "$staging_hostname" ]; then
        echo -e "${RED}❌ Hostname is required${NC}"
        return 1
    fi
    
    setup_subdomain_routing
    
    echo -e "${GREEN}✅ Host-based routing configured for: $staging_hostname${NC}"
}

# Function for separate ALB (Option 3)
setup_separate_alb() {
    echo -e "${BLUE}📝 Separate Load Balancer Setup:${NC}"
    echo "This creates a dedicated load balancer for staging"
    echo ""
    
    echo -e "${YELLOW}🏗️ Creating staging load balancer...${NC}"
    
    # Get subnets from existing ALB
    SUBNETS=$(aws elbv2 describe-load-balancers --names "$LOAD_BALANCER_NAME" --query 'LoadBalancers[0].AvailabilityZones[*].SubnetId' --output text --region "$REGION" | cat)
    SECURITY_GROUPS=$(aws elbv2 describe-load-balancers --names "$LOAD_BALANCER_NAME" --query 'LoadBalancers[0].SecurityGroups' --output text --region "$REGION" | cat)
    
    STAGING_ALB_ARN=$(aws elbv2 create-load-balancer \
        --name "edsteward-staging-alb" \
        --subnets $SUBNETS \
        --security-groups $SECURITY_GROUPS \
        --scheme internet-facing \
        --type application \
        --ip-address-type ipv4 \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text \
        --region "$REGION" | cat)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Staging load balancer created: $STAGING_ALB_ARN${NC}"
        
        # Get the DNS name
        STAGING_ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$STAGING_ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text --region "$REGION" | cat)
        
        echo -e "${BLUE}📋 Staging Load Balancer DNS: ${STAGING_ALB_DNS}${NC}"
        echo ""
        echo -e "${YELLOW}💡 You'll need to:${NC}"
        echo "1. Create target groups and listeners for this ALB"
        echo "2. Point your staging domain to: $STAGING_ALB_DNS"
        echo "3. Configure SSL certificate"
    else
        echo -e "${RED}❌ Failed to create staging load balancer${NC}"
        return 1
    fi
}

# Function for local testing (Option 4)
setup_local_testing() {
    echo -e "${BLUE}📝 Local Testing Setup:${NC}"
    echo "This sets up local port forwarding for testing"
    echo ""
    
    # Get staging service task
    TASK_ARN=$(aws ecs list-tasks --cluster "$STAGING_CLUSTER" --service-name "$STAGING_SERVICE" --query 'taskArns[0]' --output text --region "$REGION" | cat)
    
    if [ "$TASK_ARN" = "None" ] || [ -z "$TASK_ARN" ]; then
        echo -e "${RED}❌ No running tasks found for staging service${NC}"
        return 1
    fi
    
    # Get task IP
    TASK_IP=$(aws ecs describe-tasks --cluster "$STAGING_CLUSTER" --tasks "$TASK_ARN" --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' --output text --region "$REGION" | cat)
    
    echo -e "${GREEN}✅ Staging service IP: $TASK_IP${NC}"
    echo ""
    echo -e "${BLUE}📋 Local Testing Options:${NC}"
    echo "1. Direct access: http://$TASK_IP:3000"
    echo "2. Add to /etc/hosts: $TASK_IP staging.local"
    echo "3. Use AWS Session Manager for port forwarding"
    echo ""
    echo -e "${YELLOW}💡 To add to hosts file:${NC}"
    echo "sudo echo '$TASK_IP staging.local' >> /etc/hosts"
    echo "Then access: http://staging.local:3000"
}

# Main execution based on choice
case $choice in
    1|2) setup_subdomain_routing ;;
    3) setup_separate_alb ;;
    4) setup_local_testing ;;
esac

echo ""
echo -e "${GREEN}🎉 Staging domain setup process completed!${NC}"
echo ""
echo -e "${BLUE}🔗 Remember to:${NC}"
echo "1. Update your DNS records"
echo "2. Configure SSL certificates if needed"
echo "3. Test your staging environment"
echo "4. Update your deployment scripts with the staging URL" 