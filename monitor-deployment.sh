#!/bin/zsh

echo "🔍 ECS Deployment Monitor for admin.edsteward.ai"
echo "================================================"
echo ""

# Function to get deployment status
get_deployment_status() {
    aws ecs describe-services \
        --cluster edsteward-cluster \
        --services edsteward-service \
        --query 'services[0].deployments[0:2].[id,status,rolloutState,runningCount,desiredCount,taskDefinition]' \
        --output table | cat
}

# Function to get recent events
get_recent_events() {
    aws ecs describe-services \
        --cluster edsteward-cluster \
        --services edsteward-service \
        --query 'services[0].events[0:3].[createdAt,message]' \
        --output table | cat
}

# Function to test the website
test_website() {
    echo "🌐 Testing admin.edsteward.ai..."
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" https://admin.edsteward.ai/)
    local title=$(curl -s https://admin.edsteward.ai/ | grep -o '<title>[^<]*</title>' | sed 's/<[^>]*>//g')
    echo "   HTTP Status: $response_code"
    echo "   Current Title: $title"
    
    # Check if immediate title fix is present
    local has_fix=$(curl -s https://admin.edsteward.ai/ | grep -c "IMMEDIATE TITLE FIX")
    if [[ $has_fix -gt 0 ]]; then
        echo "   ✅ Title fix script found in HTML"
    else
        echo "   ❌ Title fix script NOT found"
    fi
}

# Function to check target health
check_target_health() {
    echo "🎯 Load Balancer Target Health:"
    aws elbv2 describe-target-health \
        --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-tg-alb/664e01592a97845a \
        --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason]' \
        --output table | cat
}

# Main monitoring loop
while true; do
    clear
    echo "🔍 ECS Deployment Monitor - $(date)"
    echo "================================================"
    
    echo "📊 DEPLOYMENT STATUS:"
    get_deployment_status
    
    echo ""
    echo "📰 RECENT EVENTS:"
    get_recent_events
    
    echo ""
    test_website
    
    echo ""
    check_target_health
    
    echo ""
    echo "🔄 Refreshing in 30 seconds... (Press Ctrl+C to stop)"
    sleep 30
done 