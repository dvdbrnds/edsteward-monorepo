#!/bin/bash

echo "🚀 Deploying EdSteward Authentication Fix..."

# Step 1: Register the new task definition
echo "📝 Registering new task definition..."
TASK_DEF_ARN=$(aws ecs register-task-definition --region us-east-1 --cli-input-json file://auth-fix-task-def.json --query 'taskDefinition.taskDefinitionArn' --output text)

if [ $? -eq 0 ]; then
    echo "✅ Task definition registered: $TASK_DEF_ARN"
else
    echo "❌ Failed to register task definition"
    exit 1
fi

# Step 2: Update the service
echo "🔄 Updating ECS service..."
aws ecs update-service --region us-east-1 --cluster edsteward-cluster --service edsteward-service --task-definition $TASK_DEF_ARN --force-new-deployment

if [ $? -eq 0 ]; then
    echo "✅ Service update initiated"
else
    echo "❌ Failed to update service"
    exit 1
fi

echo "🎉 Deployment completed! Wait a few minutes for the service to start..."
echo "🌐 Check status: https://moravian.edsteward.ai" 