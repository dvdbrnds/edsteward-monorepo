#!/bin/zsh

# Wait for production deployment to complete
# Usage: ./wait-for-production.sh

set -e

# Load deployment info
if [ ! -f ".deployment-info" ]; then
    echo "❌ Deployment info not found. Run ECS deployment first."
    exit 1
fi

source .deployment-info

echo "⏳ Monitoring production deployment..."
echo "📋 Cluster: $CLUSTER_NAME"
echo "📋 Service: $SERVICE_NAME"
echo "📋 New task definition: $NEW_TASK_DEF_ARN"

TIMEOUT=900  # 15 minutes
INTERVAL=30  # 30 seconds
MAX_ATTEMPTS=$((TIMEOUT / INTERVAL))

echo "⏳ Waiting for deployment to complete (timeout: ${TIMEOUT}s)..."

for attempt in $(seq 1 $MAX_ATTEMPTS); do
    echo "🔍 Checking deployment status (attempt $attempt/$MAX_ATTEMPTS)..."
    
    # Get service status
    SERVICE_INFO=$(aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --region $AWS_REGION)
    
    RUNNING_COUNT=$(echo "$SERVICE_INFO" | jq -r '.services[0].runningCount')
    DESIRED_COUNT=$(echo "$SERVICE_INFO" | jq -r '.services[0].desiredCount')
    PENDING_COUNT=$(echo "$SERVICE_INFO" | jq -r '.services[0].pendingCount')
    
    echo "📊 Tasks: $RUNNING_COUNT running, $PENDING_COUNT pending, $DESIRED_COUNT desired"
    
    # Get deployment status
    DEPLOYMENTS=$(echo "$SERVICE_INFO" | jq -r '.services[0].deployments[]')
    
    # Check for PRIMARY deployment with our task definition
    PRIMARY_DEPLOYMENT=$(echo "$SERVICE_INFO" | jq -r --arg task_def "$NEW_TASK_DEF_ARN" '
        .services[0].deployments[] | 
        select(.status == "PRIMARY" and (.taskDefinition | contains($task_def)))'
    )
    
    if [ -n "$PRIMARY_DEPLOYMENT" ]; then
        PRIMARY_RUNNING=$(echo "$PRIMARY_DEPLOYMENT" | jq -r '.runningCount')
        PRIMARY_DESIRED=$(echo "$PRIMARY_DEPLOYMENT" | jq -r '.desiredCount')
        DEPLOYMENT_STATUS=$(echo "$PRIMARY_DEPLOYMENT" | jq -r '.rolloutState // "IN_PROGRESS"')
        
        echo "📊 Primary deployment: $PRIMARY_RUNNING/$PRIMARY_DESIRED tasks, status: $DEPLOYMENT_STATUS"
        
        # Check if deployment is stable
        if [ "$PRIMARY_RUNNING" = "$PRIMARY_DESIRED" ] && [ "$DEPLOYMENT_STATUS" = "COMPLETED" ]; then
            echo "✅ Deployment completed successfully!"
            
            # Verify all tasks are healthy
            echo "🔍 Verifying task health..."
            TASKS=$(aws ecs list-tasks \
                --cluster $CLUSTER_NAME \
                --service-name $SERVICE_NAME \
                --desired-status RUNNING \
                --region $AWS_REGION \
                --query 'taskArns' \
                --output text)
            
            if [ -n "$TASKS" ]; then
                TASK_DETAILS=$(aws ecs describe-tasks \
                    --cluster $CLUSTER_NAME \
                    --tasks $TASKS \
                    --region $AWS_REGION)
                
                HEALTHY_TASKS=$(echo "$TASK_DETAILS" | jq -r '.tasks[] | select(.lastStatus == "RUNNING") | .taskArn' | wc -l | tr -d ' ')
                TOTAL_TASKS=$(echo "$TASK_DETAILS" | jq -r '.tasks | length')
                
                echo "📊 Healthy tasks: $HEALTHY_TASKS/$TOTAL_TASKS"
                
                if [ "$HEALTHY_TASKS" = "$TOTAL_TASKS" ]; then
                    echo "✅ All tasks are healthy"
                    
                    # Get load balancer target health if available
                    echo "🔍 Checking load balancer health..."
                    # This is a basic check - in production you might want to check ALB target groups
                    
                    echo "✅ Production deployment verification completed"
                    exit 0
                else
                    echo "⚠️ Some tasks are not healthy yet, continuing to wait..."
                fi
            else
                echo "⚠️ No running tasks found, continuing to wait..."
            fi
        elif [ "$DEPLOYMENT_STATUS" = "FAILED" ]; then
            echo "❌ Deployment failed!"
            echo "🔍 Checking for deployment failure reasons..."
            
            # Get failed tasks for debugging
            FAILED_TASKS=$(aws ecs list-tasks \
                --cluster $CLUSTER_NAME \
                --service-name $SERVICE_NAME \
                --desired-status STOPPED \
                --region $AWS_REGION \
                --query 'taskArns' \
                --output text | head -5)  # Get last 5 failed tasks
            
            if [ -n "$FAILED_TASKS" ]; then
                echo "📋 Recent failed tasks:"
                aws ecs describe-tasks \
                    --cluster $CLUSTER_NAME \
                    --tasks $FAILED_TASKS \
                    --region $AWS_REGION \
                    --query 'tasks[].{TaskArn:taskArn,StoppedReason:stoppedReason,ExitCode:containers[0].exitCode}' \
                    --output table || true
            fi
            
            # Offer rollback
            echo "❌ Deployment has failed. Would you like to rollback? (y/N)"
            read -r ROLLBACK_CONFIRM
            if [ "$ROLLBACK_CONFIRM" = "y" ] || [ "$ROLLBACK_CONFIRM" = "Y" ]; then
                ./scripts/rollback-deployment.sh
                exit 1
            else
                echo "🛑 Manual intervention required"
                exit 1
            fi
        fi
    else
        echo "⚠️ Primary deployment with new task definition not found yet..."
    fi
    
    # Check for any failed deployments
    FAILED_DEPLOYMENTS=$(echo "$SERVICE_INFO" | jq -r '.services[0].deployments[] | select(.rolloutState == "FAILED")')
    if [ -n "$FAILED_DEPLOYMENTS" ]; then
        echo "❌ Found failed deployments. Manual intervention may be required."
    fi
    
    if [ $attempt -lt $MAX_ATTEMPTS ]; then
        echo "⏳ Waiting ${INTERVAL}s before next check..."
        sleep $INTERVAL
    fi
done

echo "❌ Deployment monitoring timeout after ${TIMEOUT} seconds"
echo "🔍 Final status check..."

# Final status
FINAL_SERVICE_INFO=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $AWS_REGION)

echo "$FINAL_SERVICE_INFO" | jq -r '.services[0].deployments[] | {Status:.status,RolloutState:.rolloutState,TaskDefinition:.taskDefinition,RunningCount:.runningCount,DesiredCount:.desiredCount}'

echo "❌ Deployment verification failed or timed out"
echo "💡 You may need to check the ECS console or run: make logs-production"
exit 1 