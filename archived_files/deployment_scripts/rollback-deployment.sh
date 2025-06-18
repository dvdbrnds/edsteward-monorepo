#!/bin/zsh

# Rollback ECS deployment
# Usage: ./rollback-deployment.sh

set -e

echo "🔄 Initiating deployment rollback..."

# Load deployment info
if [ ! -f ".deployment-info" ]; then
    echo "❌ Deployment info not found. Cannot rollback."
    exit 1
fi

source .deployment-info

if [ ! -f ".rollback-task-definition" ]; then
    echo "❌ Rollback task definition not found. Cannot rollback."
    exit 1
fi

ROLLBACK_TASK_DEF=$(cat .rollback-task-definition)

echo "📋 Cluster: $CLUSTER_NAME"
echo "📋 Service: $SERVICE_NAME"
echo "📋 Rolling back to: $ROLLBACK_TASK_DEF"

# Confirm rollback
echo "⚠️  Are you sure you want to rollback the deployment? (y/N)"
read -r CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "🛑 Rollback cancelled"
    exit 1
fi

# Update service to use previous task definition
echo "🔄 Rolling back ECS service..."
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --task-definition "$ROLLBACK_TASK_DEF" \
    --force-new-deployment \
    --region $AWS_REGION > /dev/null

echo "✅ Rollback initiated"

# Monitor rollback
echo "⏳ Monitoring rollback progress..."
TIMEOUT=600  # 10 minutes
INTERVAL=30
MAX_ATTEMPTS=$((TIMEOUT / INTERVAL))

for attempt in $(seq 1 $MAX_ATTEMPTS); do
    echo "🔍 Checking rollback status (attempt $attempt/$MAX_ATTEMPTS)..."
    
    SERVICE_INFO=$(aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --region $AWS_REGION)
    
    RUNNING_COUNT=$(echo "$SERVICE_INFO" | jq -r '.services[0].runningCount')
    DESIRED_COUNT=$(echo "$SERVICE_INFO" | jq -r '.services[0].desiredCount')
    
    echo "📊 Tasks: $RUNNING_COUNT/$DESIRED_COUNT"
    
    # Check if we're back to the rollback task definition
    PRIMARY_DEPLOYMENT=$(echo "$SERVICE_INFO" | jq -r --arg task_def "$ROLLBACK_TASK_DEF" '
        .services[0].deployments[] | 
        select(.status == "PRIMARY" and (.taskDefinition | contains($task_def)))'
    )
    
    if [ -n "$PRIMARY_DEPLOYMENT" ]; then
        PRIMARY_RUNNING=$(echo "$PRIMARY_DEPLOYMENT" | jq -r '.runningCount')
        PRIMARY_DESIRED=$(echo "$PRIMARY_DEPLOYMENT" | jq -r '.desiredCount')
        DEPLOYMENT_STATUS=$(echo "$PRIMARY_DEPLOYMENT" | jq -r '.rolloutState // "IN_PROGRESS"')
        
        echo "📊 Rollback deployment: $PRIMARY_RUNNING/$PRIMARY_DESIRED tasks, status: $DEPLOYMENT_STATUS"
        
        if [ "$PRIMARY_RUNNING" = "$PRIMARY_DESIRED" ] && [ "$DEPLOYMENT_STATUS" = "COMPLETED" ]; then
            echo "✅ Rollback completed successfully!"
            
            # Quick health check
            echo "🔍 Performing post-rollback health check..."
            sleep 30  # Wait for load balancer to update
            
            PRODUCTION_URL="http://edsteward-alb-554701445.us-east-1.elb.amazonaws.com"
            if curl -f -s --max-time 30 "$PRODUCTION_URL/health" > /dev/null; then
                echo "✅ Post-rollback health check passed"
            else
                echo "⚠️ Post-rollback health check failed - manual intervention may be needed"
            fi
            
            # Log rollback event
            cat > .rollback-log << EOF
ROLLBACK_TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
ROLLED_BACK_FROM=$NEW_TASK_DEF_ARN
ROLLED_BACK_TO=$ROLLBACK_TASK_DEF
CLUSTER=$CLUSTER_NAME
SERVICE=$SERVICE_NAME
REASON=Manual rollback
EOF
            
            echo "📋 Rollback logged to .rollback-log"
            echo "🎉 Rollback completed successfully!"
            exit 0
        fi
    fi
    
    if [ $attempt -lt $MAX_ATTEMPTS ]; then
        echo "⏳ Waiting ${INTERVAL}s before next check..."
        sleep $INTERVAL
    fi
done

echo "❌ Rollback monitoring timeout"
echo "🔍 Final rollback status:"

FINAL_SERVICE_INFO=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $AWS_REGION)

echo "$FINAL_SERVICE_INFO" | jq -r '.services[0].deployments[] | {Status:.status,RolloutState:.rolloutState,TaskDefinition:.taskDefinition,RunningCount:.runningCount,DesiredCount:.desiredCount}'

echo "⚠️ Rollback may still be in progress. Check ECS console for status." 