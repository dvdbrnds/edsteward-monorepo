#!/bin/bash

echo "🚨 EMERGENCY DEPLOYMENT - Critical Fix for Production"
echo "⚠️  This fixes container startup failures"

# Register the critical fix task definition
echo "📝 Registering critical fix task definition..."
TASK_DEF_ARN=$(aws ecs register-task-definition --region us-east-1 --cli-input-json file://critical-fix-task-def.json --query 'taskDefinition.taskDefinitionArn' --output text)

if [ $? -eq 0 ]; then
    echo "✅ Critical fix task definition registered: $TASK_DEF_ARN"
else
    echo "❌ FAILED to register critical fix task definition"
    exit 1
fi

# Update the service immediately
echo "🚀 EMERGENCY UPDATE - Deploying critical fix..."
aws ecs update-service --region us-east-1 --cluster edsteward-cluster --service edsteward-service --task-definition $TASK_DEF_ARN --force-new-deployment

if [ $? -eq 0 ]; then
    echo "✅ EMERGENCY DEPLOYMENT INITIATED"
    echo "🕐 Containers should start in 2-3 minutes"
    echo "🌐 Check: https://moravian.edsteward.ai"
else
    echo "❌ CRITICAL: Failed to deploy emergency fix"
    exit 1
fi

echo "🎯 Critical fix deployed - monitoring startup..." 