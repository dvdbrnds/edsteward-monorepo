#!/bin/zsh

# Moravian Production Deployment Script
# Deploys to moravian.edsteward.ai with the NEW isolated Neon database

set -e

# Configuration
CLUSTER_NAME="edsteward-cluster"
SERVICE_NAME="edsteward-service"
TASK_FAMILY="edsteward-saml-step3"
ECR_REPOSITORY="259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant"
AWS_REGION="us-east-1"

# NEW Moravian Database (isolated project)
NEW_DATABASE_URL="postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Disable AWS pager
export AWS_PAGER=""

# Generate unique tag using timestamp and git commit
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
GIT_COMMIT=$(git rev-parse --short HEAD)
IMAGE_TAG="moravian-${TIMESTAMP}-${GIT_COMMIT}"

echo "🚀 Starting Moravian Production Deployment..."
echo "📦 Image tag: ${IMAGE_TAG}"
echo "🗄️  Database: NEW isolated Moravian project"

# Step 1: Build Docker image with unique tag
echo "🔨 Building Docker image..."
docker build --platform linux/amd64 -t ${ECR_REPOSITORY}:${IMAGE_TAG} .

# Step 2: Authenticate with ECR
echo "🔐 Authenticating with ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPOSITORY}

# Step 3: Push image to ECR
echo "📤 Pushing image to ECR..."
docker push ${ECR_REPOSITORY}:${IMAGE_TAG}

# Step 4: Download current task definition
echo "📥 Downloading current task definition..."
aws ecs describe-task-definition \
    --task-definition ${TASK_FAMILY} \
    --query taskDefinition > current-task-def.json

# Step 5: Update task definition with new image AND new database URL
echo "✏️  Updating task definition with new image and database..."

# Use jq to update both the image and the DATABASE_URL environment variable
cat current-task-def.json | \
    jq ".containerDefinitions[0].image = \"${ECR_REPOSITORY}:${IMAGE_TAG}\"" | \
    jq "(.containerDefinitions[0].environment[] | select(.name == \"DATABASE_URL\")).value = \"${NEW_DATABASE_URL}\"" | \
    jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)' \
    > updated-task-def.json

# Verify the DATABASE_URL was updated
echo "🔍 Verifying DATABASE_URL update..."
NEW_DB_IN_DEF=$(cat updated-task-def.json | jq -r '.containerDefinitions[0].environment[] | select(.name == "DATABASE_URL").value' | head -c 60)
echo "   New DATABASE_URL (first 60 chars): ${NEW_DB_IN_DEF}..."

# Step 6: Register new task definition
echo "📝 Registering new task definition..."
NEW_TASK_DEF=$(aws ecs register-task-definition \
    --cli-input-json file://updated-task-def.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "✅ New task definition: ${NEW_TASK_DEF}"

# Step 7: Update ECS service with new task definition
echo "🔄 Updating ECS service..."
aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service ${SERVICE_NAME} \
    --task-definition ${NEW_TASK_DEF}

# Step 8: Wait for deployment to complete
echo "⏳ Waiting for deployment to complete (this may take 2-5 minutes)..."
aws ecs wait services-stable \
    --cluster ${CLUSTER_NAME} \
    --services ${SERVICE_NAME}

# Step 9: Verify deployment
echo "🔍 Verifying deployment..."
CURRENT_TASK=$(aws ecs describe-services \
    --cluster ${CLUSTER_NAME} \
    --services ${SERVICE_NAME} \
    --query 'services[0].taskDefinition' \
    --output text)

CURRENT_IMAGE=$(aws ecs describe-task-definition \
    --task-definition ${CURRENT_TASK} \
    --query 'taskDefinition.containerDefinitions[0].image' \
    --output text)

CURRENT_DB=$(aws ecs describe-task-definition \
    --task-definition ${CURRENT_TASK} \
    --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' \
    --output text | head -c 60)

echo ""
echo "✅ Deployment complete!"
echo "🎯 Current running image: ${CURRENT_IMAGE}"
echo "🗄️  Current DATABASE_URL: ${CURRENT_DB}..."
echo ""

# Clean up temporary files
rm -f current-task-def.json updated-task-def.json

if [[ "${CURRENT_IMAGE}" == "${ECR_REPOSITORY}:${IMAGE_TAG}" ]]; then
    echo "🎉 SUCCESS: Moravian production is running the correct image!"
    echo ""
    echo "🌐 Test at: https://moravian.edsteward.ai"
    echo "📊 Database: NEW isolated Moravian project (ep-summer-pine-ae88mdbc)"
else
    echo "❌ ERROR: ECS service is NOT running the expected image!"
    exit 1
fi

