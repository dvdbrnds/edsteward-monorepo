#!/bin/zsh

# Deploy to AWS ECS with rollback capabilities
# Usage: ./deploy-to-ecs.sh <image_name>

set -e

IMAGE_NAME="${1:-regulatorytrackr-app}"
AWS_REGION="us-east-1"
CLUSTER_NAME="edsteward-cluster"
SERVICE_NAME="edsteward-service"

echo "🚀 Deploying to ECS..."
echo "📋 Cluster: $CLUSTER_NAME"
echo "📋 Service: $SERVICE_NAME"

# Read the production image tag
if [ ! -f ".production-image-tag" ]; then
    echo "❌ Production image tag not found. Run ECR push first."
    exit 1
fi

PRODUCTION_IMAGE=$(cat .production-image-tag)
echo "📋 Production image: $PRODUCTION_IMAGE"

# Get current task definition
echo "🔍 Getting current task definition..."
CURRENT_TASK_DEF=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $AWS_REGION \
    --query 'services[0].taskDefinition' \
    --output text)

echo "📋 Current task definition: $CURRENT_TASK_DEF"

# Store current task definition for rollback
echo "$CURRENT_TASK_DEF" > .rollback-task-definition

# Get task definition details
echo "🔍 Retrieving task definition details..."
TASK_DEF_JSON=$(aws ecs describe-task-definition \
    --task-definition $CURRENT_TASK_DEF \
    --region $AWS_REGION)

# Extract task definition components
FAMILY=$(echo "$TASK_DEF_JSON" | jq -r '.taskDefinition.family')
NETWORK_MODE=$(echo "$TASK_DEF_JSON" | jq -r '.taskDefinition.networkMode')
REQUIRES_COMPATIBILITIES=$(echo "$TASK_DEF_JSON" | jq -r '.taskDefinition.requiresCompatibilities')
CPU=$(echo "$TASK_DEF_JSON" | jq -r '.taskDefinition.cpu')
MEMORY=$(echo "$TASK_DEF_JSON" | jq -r '.taskDefinition.memory')
EXECUTION_ROLE_ARN=$(echo "$TASK_DEF_JSON" | jq -r '.taskDefinition.executionRoleArn')
TASK_ROLE_ARN=$(echo "$TASK_DEF_JSON" | jq -r '.taskDefinition.taskRoleArn // empty')

echo "📋 Task definition family: $FAMILY"

# Create new task definition with updated image
echo "🔧 Creating new task definition..."

# Get existing container definitions and update the image
CONTAINER_DEFINITIONS=$(echo "$TASK_DEF_JSON" | jq --arg new_image "$PRODUCTION_IMAGE" '
    .taskDefinition.containerDefinitions | 
    map(if .name == "edsteward-app" then .image = $new_image else . end)'
)

# Build new task definition JSON
NEW_TASK_DEF="{
    \"family\": \"$FAMILY\",
    \"networkMode\": \"$NETWORK_MODE\",
    \"requiresCompatibilities\": $REQUIRES_COMPATIBILITIES,
    \"cpu\": \"$CPU\",
    \"memory\": \"$MEMORY\",
    \"executionRoleArn\": \"$EXECUTION_ROLE_ARN\",
    \"containerDefinitions\": $CONTAINER_DEFINITIONS"

# Add task role if it exists
if [ -n "$TASK_ROLE_ARN" ] && [ "$TASK_ROLE_ARN" != "null" ]; then
    NEW_TASK_DEF="$NEW_TASK_DEF, \"taskRoleArn\": \"$TASK_ROLE_ARN\""
fi

NEW_TASK_DEF="$NEW_TASK_DEF }"

# Register new task definition
echo "📝 Registering new task definition..."
NEW_TASK_DEF_ARN=$(echo "$NEW_TASK_DEF" | aws ecs register-task-definition \
    --region $AWS_REGION \
    --cli-input-json file:///dev/stdin \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "✅ New task definition registered: $NEW_TASK_DEF_ARN"

# Store new task definition for potential rollback
echo "$NEW_TASK_DEF_ARN" > .new-task-definition

# Update the service
echo "🔄 Updating ECS service..."
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --task-definition "$NEW_TASK_DEF_ARN" \
    --force-new-deployment \
    --region $AWS_REGION > /dev/null

echo "✅ Service update initiated"
echo "📋 New task definition: $NEW_TASK_DEF_ARN"

# Create deployment monitoring script for next stage
cat > .deployment-info << EOF
CLUSTER_NAME=$CLUSTER_NAME
SERVICE_NAME=$SERVICE_NAME
NEW_TASK_DEF_ARN=$NEW_TASK_DEF_ARN
ROLLBACK_TASK_DEF=$CURRENT_TASK_DEF
PRODUCTION_IMAGE=$PRODUCTION_IMAGE
AWS_REGION=$AWS_REGION
EOF

echo "✅ ECS deployment initiated successfully"
echo "📋 Deployment info saved to .deployment-info" 