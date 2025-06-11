#!/bin/bash

set -e

echo "Updating ECS task definition..."

# Save current task definition
aws ecs describe-task-definition --task-definition edsteward-task --region us-east-1 --query 'taskDefinition' > /tmp/current.json

# Create updated task definition
cat /tmp/current.json | jq '.containerDefinitions[0].image = "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:v1.13" | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)' > /tmp/updated.json

# Register new task definition
echo "Registering new task definition..."
aws ecs register-task-definition --region us-east-1 --cli-input-json file:///tmp/updated.json

# Update service
echo "Updating ECS service..."
aws ecs update-service --cluster edsteward-cluster --service edsteward-service --task-definition edsteward-task --region us-east-1

echo "Done!" 