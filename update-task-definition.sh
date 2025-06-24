#!/bin/bash

# Update Task Definition with New Image
set -e

# Configuration
AWS_REGION="us-east-1"
ECR_REPO="259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward"
CLUSTER_NAME="edsteward-cluster"
SERVICE_NAME="edsteward-service"
NEW_IMAGE="259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:v12.0-ssl-db-fix-20250612-210839"

echo "🔄 Updating task definition with new image: $NEW_IMAGE"

# Create updated task definition
jq --arg IMAGE "$NEW_IMAGE" '.containerDefinitions[0].image = $IMAGE' ssl-task-def.json > updated-task-def.json

# Register the new task definition
echo "📋 Registering new task definition..."
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://updated-task-def.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "✅ New task definition registered: $NEW_TASK_DEF_ARN"

# Update the ECS service
echo "🔄 Updating ECS service..."
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --task-definition $NEW_TASK_DEF_ARN \
    --query 'service.serviceName' \
    --output text

echo "✅ ECS service update initiated"

# Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
aws ecs wait services-stable --cluster $CLUSTER_NAME --services $SERVICE_NAME

echo "🎉 Deployment completed successfully!"

# Clean up
rm -f updated-task-def.json

echo "📊 Service status:"
aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --query 'services[0].{Status:status,RunningCount:runningCount,DesiredCount:desiredCount,TaskDefinition:taskDefinition}' \
    --output table

echo "✅ Database fixes deployed with SSL configuration!" 