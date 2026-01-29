#!/bin/zsh

# 🚀 EdSteward Production Deployment with SAML (AWS Only)
# SAML-enabled deployment for Friday board meeting
# Usage: ./scripts/deploy-production-saml.sh

set -e

# Fix AWS CLI pager issue in zsh - CRITICAL for macOS
export AWS_PAGER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Production deployment values
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="259661441422"
ECR_REPOSITORY="edsteward-multi-tenant"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"
ECS_CLUSTER="edsteward-cluster"
ECS_SERVICE="edsteward-service"
COMMIT_SHA=$(git rev-parse --short HEAD)
IMAGE_TAG="saml-prod-${COMMIT_SHA}"
LATEST_TAG="latest"

# Production URLs for SAML
PRODUCTION_BASE_URL="https://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"

# Functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo -e "${BLUE}🚀 EdSteward Production Deployment with SAML${NC}"
echo "=================================================================="

# Step 1: Pre-flight checks
log "Running pre-flight checks..."
if ! command -v aws &> /dev/null; then
    error "AWS CLI not found. Install with: brew install awscli"
fi
if ! command -v docker &> /dev/null; then
    error "Docker not found. Install with: brew install docker"
fi
if ! docker info &> /dev/null; then
    error "Docker is not running. Please start Docker Desktop"
fi

# Check if SAML certificate exists
if [[ ! -f "certs/okta-cert.pem" ]]; then
    error "SAML certificate not found at certs/okta-cert.pem"
fi
success "Pre-flight checks passed"

# Step 2: Kill any processes on port 3000
log "Clearing any processes on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
success "Port 3000 cleared"

# Step 3: Build frontend
log "Building frontend..."
if ! npm run build; then
    error "Frontend build failed"
fi
success "Frontend build completed"

# Step 4: Build Docker Image with SAML support
log "Building Docker image for AWS with SAML support (linux/amd64)..."
if ! docker build --platform linux/amd64 -t ${ECR_URI}:${IMAGE_TAG} .; then
    error "Docker build failed"
fi
success "Docker build successful: ${IMAGE_TAG}"

# Step 5: Tag as latest
log "Tagging as latest..."
docker tag ${ECR_URI}:${IMAGE_TAG} ${ECR_URI}:${LATEST_TAG}

# Step 6: Login to ECR
log "Logging into ECR..."
if ! aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}; then
    error "ECR login failed"
fi
success "ECR login successful"

# Step 7: Push to ECR
log "Pushing images to ECR..."
if ! docker push ${ECR_URI}:${IMAGE_TAG}; then
    error "Image push failed"
fi
if ! docker push ${ECR_URI}:${LATEST_TAG}; then
    error "Latest tag push failed"
fi
success "Images pushed successfully"

# Step 8: Create/Update ECS Task Definition with SAML Environment Variables
log "Creating ECS task definition with SAML configuration..."
cat > saml-task-definition.json << EOF
{
  "family": "edsteward-saml-production",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "edsteward-app",
      "image": "${ECR_URI}:${IMAGE_TAG}",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        },
        {
          "name": "HOSTNAME",
          "value": "0.0.0.0"
        },
        {
          "name": "DATABASE_URL",
          "value": "postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
        },
        {
          "name": "SESSION_SECRET",
          "value": "production-session-secret-change-this-in-real-production"
        },
        {
          "name": "INSTITUTION_NAME",
          "value": "Moravian_University"
        },
        {
          "name": "INSTITUTION_DOMAIN",
          "value": "moravian.edu"
        },
        {
          "name": "AUTH_SAML_ENABLED",
          "value": "true"
        },
        {
          "name": "AUTH_SAML_ENTITY_ID",
          "value": "urn:edsteward:sp"
        },
        {
          "name": "AUTH_SAML_SSO_URL",
          "value": "https://login.moravian.edu/app/moravian_edstewardbeta_1/exk1c4nmsctSaNRIg0x8/sso/saml"
        },
        {
          "name": "AUTH_ALLOW_SELF_REGISTRATION",
          "value": "true"
        },
        {
          "name": "BASE_URL",
          "value": "${PRODUCTION_BASE_URL}"
        },
        {
          "name": "SAML_SP_ENTITY_ID",
          "value": "urn:edsteward:sp"
        },
        {
          "name": "SAML_CALLBACK_URL",
          "value": "${PRODUCTION_BASE_URL}/auth/saml/callback"
        },
        {
          "name": "SAML_SLO_URL",
          "value": "${PRODUCTION_BASE_URL}/auth/saml/logout"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/edsteward-saml-production",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

# Step 9: Create CloudWatch log group
log "Creating CloudWatch log group..."
aws logs create-log-group --log-group-name "/ecs/edsteward-saml-production" --region ${AWS_REGION} 2>/dev/null || true

# Step 10: Register task definition
log "Registering ECS task definition..."
TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file://saml-task-definition.json --query 'taskDefinition.taskDefinitionArn' --output text --region ${AWS_REGION})
if [[ $? -eq 0 ]]; then
    success "Task definition registered: $TASK_DEF_ARN"
else
    error "Failed to register task definition"
fi

# Step 11: Update ECS Service
log "Updating ECS service with new SAML-enabled task definition..."
if ! aws ecs update-service \
    --cluster ${ECS_CLUSTER} \
    --service ${ECS_SERVICE} \
    --task-definition ${TASK_DEF_ARN} \
    --force-new-deployment \
    --region ${AWS_REGION}; then
    error "ECS service update failed"
fi
success "ECS service update initiated"

# Step 12: Wait for deployment
log "Waiting for deployment to stabilize..."
echo "This may take 3-5 minutes..."
sleep 180  # Give it time to start

# Step 13: Clean up
log "Cleaning up temporary files..."
rm -f saml-task-definition.json

echo -e "\n${GREEN}🎉 SAML DEPLOYMENT COMPLETED!${NC}"
echo "=================================================================="
echo -e "${GREEN}✅ EdSteward deployed with SAML authentication${NC}"
echo -e "${BLUE}🌐 URL: ${PRODUCTION_BASE_URL}${NC}"
echo -e "${BLUE}🔐 SAML Login: ${PRODUCTION_BASE_URL}/auth/saml${NC}"
echo -e "${BLUE}📦 Image: ${ECR_URI}:${IMAGE_TAG}${NC}"
echo -e "${BLUE}🏷️  Task Definition: ${TASK_DEF_ARN}${NC}"

echo -e "\n${YELLOW}⚠️  IMPORTANT: Update OKTA moravian_edstewardbeta_1 app with these URLs:${NC}"
echo -e "${BLUE}   Single Sign-On URL: ${PRODUCTION_BASE_URL}/auth/saml/callback${NC}"
echo -e "${BLUE}   Audience URI (SP Entity ID): urn:edsteward:sp${NC}"
echo -e "${BLUE}   Default Relay State: /${NC}"
echo -e "${BLUE}   Current OKTA SSO URL: https://login.moravian.edu/app/moravian_edstewardbeta_1/exk1c4nmsctSaNRIg0x8/sso/saml${NC}"

log "Deployment summary saved to deployment-status.json"
cat > deployment-status.json << EOF
{
  "deploymentTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "imageTag": "${IMAGE_TAG}",
  "commitSha": "${COMMIT_SHA}",
  "ecrUri": "${ECR_URI}",
  "cluster": "${ECS_CLUSTER}",
  "service": "${ECS_SERVICE}",
  "taskDefinitionArn": "${TASK_DEF_ARN}",
  "status": "completed",
  "url": "${PRODUCTION_BASE_URL}",
  "samlEnabled": true,
  "samlLoginUrl": "${PRODUCTION_BASE_URL}/auth/saml",
  "samlCallbackUrl": "${PRODUCTION_BASE_URL}/auth/saml/callback"
}
EOF

echo -e "\n${GREEN}🎯 SAML DEPLOYMENT READY FOR BOARD MEETING!${NC}"
