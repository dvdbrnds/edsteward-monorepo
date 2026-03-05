#!/bin/zsh

echo "🚀 Monitoring AWS Staging Deployment..."
echo "========================================"

# Function to check ECR images
check_ecr_images() {
    echo "\n📦 Checking ECR Images:"
    aws ecr list-images --repository-name edsteward-multi-tenant --region us-east-1 --query 'imageIds[*].imageTag' --output table 2>/dev/null || echo "No images found yet"
}

# Function to check staging service status
check_service_status() {
    echo "\n🔄 Checking Staging Service Status:"
    aws ecs describe-services --cluster edsteward-multi-tenant-staging-cluster --services edsteward-multi-tenant-staging-service --region us-east-1 --query 'services[0].{runningCount:runningCount,pendingCount:pendingCount,desiredCount:desiredCount,deployments:deployments[0].{status:status,rolloutState:rolloutState}}' --output table
}

# Function to check task health
check_task_health() {
    echo "\n🏥 Checking Task Health:"
    TASK_ARN=$(aws ecs list-tasks --cluster edsteward-multi-tenant-staging-cluster --service-name edsteward-multi-tenant-staging-service --region us-east-1 --query 'taskArns[0]' --output text)
    
    if [[ "$TASK_ARN" != "None" && "$TASK_ARN" != "" ]]; then
        aws ecs describe-tasks --cluster edsteward-multi-tenant-staging-cluster --tasks "$TASK_ARN" --region us-east-1 --query 'tasks[0].{lastStatus:lastStatus,healthStatus:healthStatus,privateIP:attachments[0].details[?name==`privateIPv4Address`].value|[0]}' --output table
        
        # Test connectivity
        PRIVATE_IP=$(aws ecs describe-tasks --cluster edsteward-multi-tenant-staging-cluster --tasks "$TASK_ARN" --region us-east-1 --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value|[0]' --output text)
        if [[ "$PRIVATE_IP" != "None" && "$PRIVATE_IP" != "" ]]; then
            echo "\n🌐 Testing Connectivity to $PRIVATE_IP:3000:"
            timeout 5 curl -s "http://$PRIVATE_IP:3000/api/health" && echo "✅ Health check passed" || echo "❌ Health check failed"
        fi
    else
        echo "No tasks found"
    fi
}

# Main monitoring loop
while true; do
    clear
    echo "🚀 AWS Staging Deployment Monitor - $(date)"
    echo "=============================================="
    
    check_ecr_images
    check_service_status
    check_task_health
    
    echo "\n⏱️  Refreshing in 30 seconds... (Ctrl+C to stop)"
    sleep 30
done 