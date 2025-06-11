#!/bin/bash

echo "=== MANUALLY UPDATING ECS TO v1.20 ==="

CLUSTER="edsteward-cluster"
SERVICE="edsteward-service"  
TASK_DEF="edsteward-task"
IMAGE="259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:v1.20"

echo "1. Getting current task definition..."
CURRENT_TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition $TASK_DEF \
    --region us-east-1 \
    --query 'taskDefinition')

echo "2. Updating image to v1.19..."
NEW_TASK_DEF=$(echo $CURRENT_TASK_DEF | jq --arg image "$IMAGE" '
    .containerDefinitions[0].image = $image |
    del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)
')

echo "3. Registering new task definition..."
NEW_REVISION=$(aws ecs register-task-definition \
    --region us-east-1 \
    --cli-input-json "$NEW_TASK_DEF" \
    --query 'taskDefinition.revision')

echo "New task definition revision: $NEW_REVISION"

echo "4. Stopping all current tasks..."
aws ecs update-service \
    --cluster $CLUSTER \
    --service $SERVICE \
    --desired-count 0 \
    --region us-east-1

echo "5. Waiting for tasks to stop..."
sleep 30

echo "6. Starting service with new task definition..."
aws ecs update-service \
    --cluster $CLUSTER \
    --service $SERVICE \
    --desired-count 2 \
    --task-definition "${TASK_DEF}:${NEW_REVISION}" \
    --region us-east-1 \
    --force-new-deployment

echo "7. Deployment initiated. Checking status..."
sleep 15

aws ecs describe-services \
    --cluster $CLUSTER \
    --services $SERVICE \
    --region us-east-1 \
    --query 'services[0].{status:status,runningCount:runningCount,desiredCount:desiredCount,taskDefinition:taskDefinition}'

echo "=== UPDATE COMPLETE ===" 