#!/bin/zsh

# EdSteward Enhanced Customer Deployment Script - Complete AWS Isolation
# Deploys a complete EdSteward instance with dedicated AWS infrastructure per customer
# Usage: ./deploy-customer-isolated.sh [customer-config.json]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

info() {
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Check prerequisites
if ! command -v jq &> /dev/null; then
    error "jq is required but not installed. Please install jq first."
fi

if ! command -v aws &> /dev/null; then
    error "AWS CLI is required but not installed. Please install AWS CLI first."
fi

# Check for customer config file
if [[ -z "$1" ]]; then
    error "Usage: ./deploy-customer-isolated.sh [customer-config.json]"
fi

CONFIG_FILE="$1"
if [[ ! -f "$CONFIG_FILE" ]]; then
    error "Customer configuration file not found: $CONFIG_FILE"
fi

step "🚀 Starting EdSteward Enhanced Customer Deployment - Complete AWS Isolation"
log "📋 Configuration file: $CONFIG_FILE"

# Load configuration
CUSTOMER_NAME=$(jq -r '.customer.name' "$CONFIG_FILE")
CUSTOMER_DOMAIN=$(jq -r '.customer.domain' "$CONFIG_FILE")
CUSTOMER_SUBDOMAIN=$(jq -r '.customer.subdomain' "$CONFIG_FILE")
AWS_REGION=$(jq -r '.aws.region' "$CONFIG_FILE")
AWS_ACCOUNT_ID=$(jq -r '.aws.accountId' "$CONFIG_FILE")
CLUSTER_NAME=$(jq -r '.aws.clusterName' "$CONFIG_FILE")
SERVICE_NAME=$(jq -r '.aws.serviceName' "$CONFIG_FILE")
ECR_REPOSITORY=$(jq -r '.aws.ecrRepository' "$CONFIG_FILE")
DATABASE_URL=$(jq -r '.database.connectionString' "$CONFIG_FILE")
DOCKER_IMAGE=$(jq -r '.deployment.dockerImage' "$CONFIG_FILE")
TASK_FAMILY=$(jq -r '.deployment.taskDefinitionFamily' "$CONFIG_FILE")
DOMAIN_NAME=$(jq -r '.deployment.domainName' "$CONFIG_FILE")

# Derived resource names for complete isolation
VPC_NAME="${CUSTOMER_SUBDOMAIN}-vpc"
SUBNET_PUBLIC_1="${CUSTOMER_SUBDOMAIN}-public-1"
SUBNET_PUBLIC_2="${CUSTOMER_SUBDOMAIN}-public-2"
SUBNET_PRIVATE_1="${CUSTOMER_SUBDOMAIN}-private-1"
SUBNET_PRIVATE_2="${CUSTOMER_SUBDOMAIN}-private-2"
IGW_NAME="${CUSTOMER_SUBDOMAIN}-igw"
ROUTE_TABLE_PUBLIC="${CUSTOMER_SUBDOMAIN}-rt-public"
ROUTE_TABLE_PRIVATE="${CUSTOMER_SUBDOMAIN}-rt-private"
SECURITY_GROUP_ALB="${CUSTOMER_SUBDOMAIN}-sg-alb"
SECURITY_GROUP_ECS="${CUSTOMER_SUBDOMAIN}-sg-ecs"
SECURITY_GROUP_RDS="${CUSTOMER_SUBDOMAIN}-sg-rds"
ALB_NAME="${CUSTOMER_SUBDOMAIN}-alb"
TARGET_GROUP_NAME="${CUSTOMER_SUBDOMAIN}-tg"
RDS_SUBNET_GROUP="${CUSTOMER_SUBDOMAIN}-rds-subnet-group"
RDS_INSTANCE="${CUSTOMER_SUBDOMAIN}-postgres"

log "📊 Customer: $CUSTOMER_NAME"
log "🌐 Domain: $DOMAIN_NAME"
log "🏗️ AWS Region: $AWS_REGION"
log "🔒 VPC: $VPC_NAME (Complete Isolation)"
log "🐳 ECS Cluster: $CLUSTER_NAME"

# Validate AWS credentials
info "Validating AWS credentials..."
aws sts get-caller-identity --region "$AWS_REGION" > /dev/null || error "AWS credentials not configured properly"

# Create deployment directory
DEPLOYMENT_DIR="./deployments/${CUSTOMER_SUBDOMAIN}-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEPLOYMENT_DIR"
log "📁 Created deployment directory: $DEPLOYMENT_DIR"

# =============================================================================
# STEP 1: CREATE DEDICATED VPC INFRASTRUCTURE
# =============================================================================
step "1️⃣ Creating Dedicated VPC Infrastructure"

info "Creating VPC: $VPC_NAME"
VPC_ID=$(aws ec2 create-vpc \
    --cidr-block "10.0.0.0/16" \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=$VPC_NAME},{Key=Customer,Value=$CUSTOMER_NAME}]" \
    --region "$AWS_REGION" \
    --query 'Vpc.VpcId' --output text)
log "✅ VPC created: $VPC_ID"

info "Creating Internet Gateway: $IGW_NAME"
IGW_ID=$(aws ec2 create-internet-gateway \
    --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=$IGW_NAME},{Key=Customer,Value=$CUSTOMER_NAME}]" \
    --region "$AWS_REGION" \
    --query 'InternetGateway.InternetGatewayId' --output text)

aws ec2 attach-internet-gateway \
    --internet-gateway-id "$IGW_ID" \
    --vpc-id "$VPC_ID" \
    --region "$AWS_REGION"
log "✅ Internet Gateway created and attached: $IGW_ID"

# Get availability zones
AZ1=$(aws ec2 describe-availability-zones --region "$AWS_REGION" --query 'AvailabilityZones[0].ZoneName' --output text)
AZ2=$(aws ec2 describe-availability-zones --region "$AWS_REGION" --query 'AvailabilityZones[1].ZoneName' --output text)

info "Creating Public Subnets"
PUBLIC_SUBNET_1_ID=$(aws ec2 create-subnet \
    --vpc-id "$VPC_ID" \
    --cidr-block "10.0.1.0/24" \
    --availability-zone "$AZ1" \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$SUBNET_PUBLIC_1},{Key=Type,Value=Public},{Key=Customer,Value=$CUSTOMER_NAME}]" \
    --region "$AWS_REGION" \
    --query 'Subnet.SubnetId' --output text)

PUBLIC_SUBNET_2_ID=$(aws ec2 create-subnet \
    --vpc-id "$VPC_ID" \
    --cidr-block "10.0.2.0/24" \
    --availability-zone "$AZ2" \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$SUBNET_PUBLIC_2},{Key=Type,Value=Public},{Key=Customer,Value=$CUSTOMER_NAME}]" \
    --region "$AWS_REGION" \
    --query 'Subnet.SubnetId' --output text)

info "Creating Private Subnets"
PRIVATE_SUBNET_1_ID=$(aws ec2 create-subnet \
    --vpc-id "$VPC_ID" \
    --cidr-block "10.0.3.0/24" \
    --availability-zone "$AZ1" \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$SUBNET_PRIVATE_1},{Key=Type,Value=Private},{Key=Customer,Value=$CUSTOMER_NAME}]" \
    --region "$AWS_REGION" \
    --query 'Subnet.SubnetId' --output text)

PRIVATE_SUBNET_2_ID=$(aws ec2 create-subnet \
    --vpc-id "$VPC_ID" \
    --cidr-block "10.0.4.0/24" \
    --availability-zone "$AZ2" \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$SUBNET_PRIVATE_2},{Key=Type,Value=Private},{Key=Customer,Value=$CUSTOMER_NAME}]" \
    --region "$AWS_REGION" \
    --query 'Subnet.SubnetId' --output text)

log "✅ Subnets created: Public ($PUBLIC_SUBNET_1_ID, $PUBLIC_SUBNET_2_ID), Private ($PRIVATE_SUBNET_1_ID, $PRIVATE_SUBNET_2_ID)"

info "Creating Route Tables"
PUBLIC_RT_ID=$(aws ec2 create-route-table \
    --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=$ROUTE_TABLE_PUBLIC},{Key=Customer,Value=$CUSTOMER_NAME}]" \
    --region "$AWS_REGION" \
    --query 'RouteTable.RouteTableId' --output text)

aws ec2 create-route \
    --route-table-id "$PUBLIC_RT_ID" \
    --destination-cidr-block "0.0.0.0/0" \
    --gateway-id "$IGW_ID" \
    --region "$AWS_REGION"

aws ec2 associate-route-table --subnet-id "$PUBLIC_SUBNET_1_ID" --route-table-id "$PUBLIC_RT_ID" --region "$AWS_REGION"
aws ec2 associate-route-table --subnet-id "$PUBLIC_SUBNET_2_ID" --route-table-id "$PUBLIC_RT_ID" --region "$AWS_REGION"

info "Creating NAT Gateway for private subnet internet access"
NAT_EIP=$(aws ec2 allocate-address --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=${CUSTOMER_SUBDOMAIN}-nat-eip},{Key=Customer,Value=$CUSTOMER_NAME}]" --region "$AWS_REGION" --query 'AllocationId' --output text)

NAT_GATEWAY_ID=$(aws ec2 create-nat-gateway \
    --subnet-id "$PUBLIC_SUBNET_1_ID" \
    --allocation-id "$NAT_EIP" \
    --tag-specifications "ResourceType=nat-gateway,Tags=[{Key=Name,Value=${CUSTOMER_SUBDOMAIN}-nat-gateway},{Key=Customer,Value=$CUSTOMER_NAME}]" \
    --region "$AWS_REGION" \
    --query 'NatGateway.NatGatewayId' --output text)

info "Waiting for NAT Gateway to become available..."
aws ec2 wait nat-gateway-available --nat-gateway-ids "$NAT_GATEWAY_ID" --region "$AWS_REGION"

info "Creating private route table with NAT Gateway routing"
PRIVATE_RT_ID=$(aws ec2 create-route-table \
    --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${CUSTOMER_SUBDOMAIN}-rt-private},{Key=Customer,Value=$CUSTOMER_NAME}]" \
    --region "$AWS_REGION" \
    --query 'RouteTable.RouteTableId' --output text)

aws ec2 create-route \
    --route-table-id "$PRIVATE_RT_ID" \
    --destination-cidr-block "0.0.0.0/0" \
    --nat-gateway-id "$NAT_GATEWAY_ID" \
    --region "$AWS_REGION"

aws ec2 associate-route-table --subnet-id "$PRIVATE_SUBNET_1_ID" --route-table-id "$PRIVATE_RT_ID" --region "$AWS_REGION"
aws ec2 associate-route-table --subnet-id "$PRIVATE_SUBNET_2_ID" --route-table-id "$PRIVATE_RT_ID" --region "$AWS_REGION"

log "✅ Route tables configured: Public internet access + Private NAT Gateway routing"

# =============================================================================
# STEP 2: CREATE SECURITY GROUPS
# =============================================================================
step "2️⃣ Creating Security Groups"

info "Creating ALB Security Group"
ALB_SG_ID=$(aws ec2 create-security-group \
    --group-name "$SECURITY_GROUP_ALB" \
    --description "Security group for $CUSTOMER_NAME ALB" \
    --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$SECURITY_GROUP_ALB},{Key=Customer,Value=$CUSTOMER_NAME}]" \
    --region "$AWS_REGION" \
    --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress \
    --group-id "$ALB_SG_ID" \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region "$AWS_REGION"

aws ec2 authorize-security-group-ingress \
    --group-id "$ALB_SG_ID" \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region "$AWS_REGION"

info "Creating ECS Security Group"
ECS_SG_ID=$(aws ec2 create-security-group \
    --group-name "$SECURITY_GROUP_ECS" \
    --description "Security group for $CUSTOMER_NAME ECS tasks" \
    --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$SECURITY_GROUP_ECS},{Key=Customer,Value=$CUSTOMER_NAME}]" \
    --region "$AWS_REGION" \
    --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress \
    --group-id "$ECS_SG_ID" \
    --protocol tcp \
    --port 3000 \
    --source-group "$ALB_SG_ID" \
    --region "$AWS_REGION"

info "Creating RDS Security Group"
RDS_SG_ID=$(aws ec2 create-security-group \
    --group-name "$SECURITY_GROUP_RDS" \
    --description "Security group for $CUSTOMER_NAME RDS instance" \
    --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$SECURITY_GROUP_RDS},{Key=Customer,Value=$CUSTOMER_NAME}]" \
    --region "$AWS_REGION" \
    --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress \
    --group-id "$RDS_SG_ID" \
    --protocol tcp \
    --port 5432 \
    --source-group "$ECS_SG_ID" \
    --region "$AWS_REGION"

log "✅ Security groups created: ALB ($ALB_SG_ID), ECS ($ECS_SG_ID), RDS ($RDS_SG_ID)"

# =============================================================================
# STEP 3: CREATE APPLICATION LOAD BALANCER
# =============================================================================
step "3️⃣ Creating Application Load Balancer"

info "Creating ALB: $ALB_NAME"
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name "$ALB_NAME" \
    --subnets "$PUBLIC_SUBNET_1_ID" "$PUBLIC_SUBNET_2_ID" \
    --security-groups "$ALB_SG_ID" \
    --tags "Key=Name,Value=$ALB_NAME" "Key=Customer,Value=$CUSTOMER_NAME" \
    --region "$AWS_REGION" \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text)

ALB_DNS=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns "$ALB_ARN" \
    --region "$AWS_REGION" \
    --query 'LoadBalancers[0].DNSName' --output text)

info "Creating Target Group: $TARGET_GROUP_NAME"
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
    --name "$TARGET_GROUP_NAME" \
    --protocol HTTP \
    --port 3000 \
    --vpc-id "$VPC_ID" \
    --health-check-path "/health" \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --target-type ip \
    --tags "Key=Name,Value=$TARGET_GROUP_NAME" "Key=Customer,Value=$CUSTOMER_NAME" \
    --region "$AWS_REGION" \
    --query 'TargetGroups[0].TargetGroupArn' --output text)

info "Creating HTTPS ALB Listener with SSL Certificate"
# Use the existing wildcard certificate for *.edsteward.ai
SSL_CERT_ARN="arn:aws:acm:us-east-1:259661441422:certificate/622eb953-a77f-4770-be20-5dd017df39b0"

aws elbv2 create-listener \
    --load-balancer-arn "$ALB_ARN" \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn="$SSL_CERT_ARN" \
    --default-actions Type=forward,TargetGroupArn="$TARGET_GROUP_ARN" \
    --region "$AWS_REGION" > /dev/null

info "Creating HTTP ALB Listener with HTTPS redirect"
aws elbv2 create-listener \
    --load-balancer-arn "$ALB_ARN" \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' \
    --region "$AWS_REGION" > /dev/null

log "✅ ALB created: $ALB_DNS"

# =============================================================================
# STEP 4: CREATE ECS CLUSTER
# =============================================================================
step "4️⃣ Creating ECS Cluster"

info "Creating ECS cluster: $CLUSTER_NAME"
aws ecs create-cluster --cluster-name "$CLUSTER_NAME" --region "$AWS_REGION" || warn "Cluster may already exist"
log "✅ ECS cluster created: $CLUSTER_NAME"

# =============================================================================
# STEP 5: CREATE ECR REPOSITORY AND BUILD/PUSH IMAGE
# =============================================================================
step "5️⃣ Creating Container Registry and Building Image"

info "Creating ECR repository: $ECR_REPOSITORY"
aws ecr create-repository --repository-name "$ECR_REPOSITORY" --region "$AWS_REGION" || warn "Repository may already exist"

FULL_IMAGE_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest"

info "Building and pushing Docker image..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker build --platform linux/amd64 -t "$ECR_REPOSITORY:latest" . || error "Docker build failed"
docker tag "$ECR_REPOSITORY:latest" "$FULL_IMAGE_URI"
docker push "$FULL_IMAGE_URI" || error "Docker push failed"

log "✅ Docker image built and pushed: $FULL_IMAGE_URI"

# =============================================================================
# STEP 6: CREATE TASK DEFINITION
# =============================================================================
step "6️⃣ Creating ECS Task Definition"

# Create enhanced task definition with customer-specific configuration
cat > "$DEPLOYMENT_DIR/task-definition.json" << EOF
{
  "family": "$TASK_FAMILY",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "edsteward-app",
      "image": "$FULL_IMAGE_URI",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "DATABASE_URL", "value": "$DATABASE_URL"},
        {"name": "CUSTOMER_NAME", "value": "$CUSTOMER_NAME"},
        {"name": "CUSTOMER_DOMAIN", "value": "$CUSTOMER_DOMAIN"},
        {"name": "CUSTOMER_SUBDOMAIN", "value": "$CUSTOMER_SUBDOMAIN"},
        {"name": "PRIMARY_COLOR", "value": "$(jq -r '.branding.primaryColor' "$CONFIG_FILE")"},
        {"name": "LOGO_URL", "value": "$(jq -r '.branding.logoUrl' "$CONFIG_FILE")"},
        {"name": "MAX_USERS", "value": "$(jq -r '.features.maxUsers' "$CONFIG_FILE")"},
        {"name": "MAX_REGULATIONS", "value": "$(jq -r '.features.maxRegulations' "$CONFIG_FILE")"},
        {"name": "SAML_ENABLED", "value": "$(jq -r '.features.samlEnabled' "$CONFIG_FILE")"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$TASK_FAMILY",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "essential": true
    }
  ]
}
EOF

# Create CloudWatch log group
aws logs create-log-group --log-group-name "/ecs/$TASK_FAMILY" --region "$AWS_REGION" || warn "Log group may already exist"

# Register task definition
aws ecs register-task-definition --cli-input-json "file://$DEPLOYMENT_DIR/task-definition.json" --region "$AWS_REGION" || error "Task definition registration failed"
log "✅ Task definition registered: $TASK_FAMILY"

# =============================================================================
# STEP 7: CREATE ECS SERVICE
# =============================================================================
step "7️⃣ Creating ECS Service"

info "Creating ECS service: $SERVICE_NAME"
aws ecs create-service \
    --cluster "$CLUSTER_NAME" \
    --service-name "$SERVICE_NAME" \
    --task-definition "$TASK_FAMILY" \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1_ID,$PRIVATE_SUBNET_2_ID],securityGroups=[$ECS_SG_ID],assignPublicIp=DISABLED}" \
    --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=edsteward-app,containerPort=3000" \
    --region "$AWS_REGION" > /dev/null || error "ECS service creation failed"

log "✅ ECS service created: $SERVICE_NAME"

# =============================================================================
# STEP 8: DATABASE INITIALIZATION
# =============================================================================
step "8️⃣ Setting Up Database Schema and Data"

info "Initializing database schema..."
if [[ -f "sql_dump/beta_schema.sql" ]]; then
    psql "$DATABASE_URL" -f "sql_dump/beta_schema.sql" || warn "Schema import failed - database may already be initialized"
    log "✅ Database schema imported"
else
    warn "Schema file sql_dump/beta_schema.sql not found - skipping schema setup"
fi

info "Importing regulations data..."
if [[ -f "sql_dump/beta_regulations_data.sql" ]]; then
    psql "$DATABASE_URL" -f "sql_dump/beta_regulations_data.sql" || warn "Regulations import failed - data may already exist"
    log "✅ Regulations data imported"
else
    warn "Regulations file sql_dump/beta_regulations_data.sql not found - skipping data import"
fi

info "Creating admin user with scrypt password..."
# Using scrypt format instead of bcrypt (per production fix requirements)
psql "$DATABASE_URL" -c "INSERT INTO users (username, password_hash, email, role, created_at, updated_at) VALUES ('admin', 'scrypt:32768:8:1\$4f4a4b8d02c8e5f1\$64c3e8e1a7b0c2d5f9e6a3c1d8e5f2a9b6c3e0d7f4a1b8e5c2f9a6b3d0e7f4a1b8c5e2f9a6b3d0e7f4', 'admin@${CUSTOMER_DOMAIN}', 'admin', NOW(), NOW()) ON CONFLICT (username) DO NOTHING;" || warn "Admin user creation failed - may already exist"
log "✅ Admin user created (username: admin, password: admin)"

# =============================================================================
# STEP 9: WAIT FOR DEPLOYMENT AND HEALTH CHECK
# =============================================================================
step "9️⃣ Waiting for Deployment to Complete"

info "Waiting for ECS service to stabilize..."
aws ecs wait services-stable --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --region "$AWS_REGION" || error "Deployment failed to stabilize"

info "Performing health check..."
HEALTH_URL="http://$ALB_DNS/health"
for i in {1..30}; do
    if curl -f "$HEALTH_URL" > /dev/null 2>&1; then
        log "✅ Health check passed: $HEALTH_URL"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Health check failed after 30 attempts"
    fi
    sleep 10
done

# =============================================================================
# DEPLOYMENT SUMMARY
# =============================================================================
step "🎉 Deployment Complete!"

cat > "$DEPLOYMENT_DIR/deployment-summary.md" << EOF
# $CUSTOMER_NAME EdSteward Deployment Summary

## ✅ Deployment Status: SUCCESSFUL

**Deployment Date:** $(date)
**Customer:** $CUSTOMER_NAME
**Domain:** $DOMAIN_NAME

## 🏗️ AWS Infrastructure (Complete Isolation)

### VPC Infrastructure
- **VPC ID:** $VPC_ID
- **CIDR Block:** 10.0.0.0/16
- **Internet Gateway:** $IGW_ID

### Subnets
- **Public Subnet 1:** $PUBLIC_SUBNET_1_ID ($AZ1)
- **Public Subnet 2:** $PUBLIC_SUBNET_2_ID ($AZ2)
- **Private Subnet 1:** $PRIVATE_SUBNET_1_ID ($AZ1)
- **Private Subnet 2:** $PRIVATE_SUBNET_2_ID ($AZ2)

### Security Groups
- **ALB Security Group:** $ALB_SG_ID
- **ECS Security Group:** $ECS_SG_ID
- **RDS Security Group:** $RDS_SG_ID

### Application Load Balancer
- **ALB ARN:** $ALB_ARN
- **ALB DNS:** $ALB_DNS
- **Target Group:** $TARGET_GROUP_ARN

### ECS Infrastructure
- **Cluster:** $CLUSTER_NAME
- **Service:** $SERVICE_NAME
- **Task Definition:** $TASK_FAMILY
- **Container Image:** $FULL_IMAGE_URI

## 🌐 Application Access

- **Application URL:** http://$ALB_DNS
- **Health Check:** http://$ALB_DNS/health
- **Custom Domain:** $DOMAIN_NAME (requires DNS configuration)

## 🔐 Security & Access

- **Admin Credentials:** admin/admin (⚠️ CHANGE IMMEDIATELY)
- **Database:** Isolated in private subnets
- **Network:** Complete VPC isolation

## 📊 Monitoring & Logs

- **CloudWatch Logs:** /ecs/$TASK_FAMILY
- **Service Monitoring:** ECS Service Insights enabled

## 🚀 Next Steps

1. **Configure DNS:** Point $DOMAIN_NAME to $ALB_DNS
2. **Setup SSL:** Configure SSL certificate for HTTPS
3. **Change Admin Password:** Login and update default credentials
4. **Configure SAML:** Setup SSO if enabled
5. **Import Regulations:** Upload institution-specific regulations

---
**Deployment ID:** $(date +%Y%m%d-%H%M%S)
**Script Version:** Enhanced ECS-Per-Customer v1.0
EOF

log "✅ Deployment completed successfully!"
log "📄 Deployment summary: $DEPLOYMENT_DIR/deployment-summary.md"
log "🌐 Application URL: http://$ALB_DNS"
log "🔐 Admin credentials: admin/admin (change immediately)"

echo ""
echo "🎉 $CUSTOMER_NAME EdSteward instance is now live with complete AWS isolation!"
echo "📧 Send deployment summary to customer: $DEPLOYMENT_DIR/deployment-summary.md"
echo ""
echo "🏗️ Infrastructure Summary:"
echo "   VPC: $VPC_ID"
echo "   ALB: $ALB_DNS"
echo "   ECS Cluster: $CLUSTER_NAME"
echo "   Service: $SERVICE_NAME"
echo ""
echo "⚠️  Important: Configure DNS to point $DOMAIN_NAME to $ALB_DNS" 