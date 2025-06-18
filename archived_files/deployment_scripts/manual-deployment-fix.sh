#!/bin/bash

echo "🚨 MANUAL ECS DEPLOYMENT FIX"
echo "============================"

CLUSTER="edsteward-cluster"
SERVICE="edsteward-service"
REGION="us-east-1"

echo ""
echo "Step 1: Getting current service status..."
aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION --query 'services[0].{Status:status,TaskDefinition:taskDefinition,Running:runningCount,Desired:desiredCount}' --output table

echo ""
echo "Step 2: Listing current tasks..."
TASK_ARNS=$(aws ecs list-tasks --cluster $CLUSTER --service-name $SERVICE --region $REGION --query 'taskArns' --output text)

if [ ! -z "$TASK_ARNS" ]; then
    echo "Found running tasks. Stopping them to break deployment deadlock..."
    for TASK_ARN in $TASK_ARNS; do
        echo "Stopping task: $TASK_ARN"
        aws ecs stop-task --cluster $CLUSTER --task $TASK_ARN --reason "Manual deployment fix" --region $REGION > /dev/null
    done
    
    echo "Waiting 30 seconds for tasks to stop..."
    sleep 30
else
    echo "No running tasks found."
fi

echo ""
echo "Step 3: Getting latest task definition..."
LATEST_TASK_DEF=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION --query 'services[0].taskDefinition' --output text)
echo "Current task definition: $LATEST_TASK_DEF"

echo ""
echo "Step 4: Force new deployment..."
aws ecs update-service \
    --cluster $CLUSTER \
    --service $SERVICE \
    --force-new-deployment \
    --deployment-configuration maximumPercent=200,minimumHealthyPercent=0 \
    --region $REGION \
    --query 'service.{Status:status,TaskDefinition:taskDefinition,Deployments:deployments[0].status}' \
    --output table

echo ""
echo "Step 5: Monitoring deployment (this may take a few minutes)..."
echo "You can monitor progress in the AWS Console or run:"
echo "aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION"

echo ""
echo "Step 6: Test endpoints after deployment completes:"
echo "curl https://edsteward.ai/api/test"
echo "curl https://edsteward.ai/api/db-direct"
echo "curl https://edsteward.ai/api/db-stats"

echo ""
echo "🚨 MANUAL FIX INITIATED - Monitor AWS Console for completion" 