#!/bin/zsh

echo "🔧 Direct AWS Check - Bypassing Shell Issues"
echo "============================================="

# Use direct path to AWS CLI
AWS_CLI="/opt/homebrew/bin/aws"
REGION="us-east-1"
CLUSTER="edsteward-cluster"
SERVICE="edsteward-service"

echo "[INFO] Checking ECS tasks..."
$AWS_CLI ecs list-tasks --cluster $CLUSTER --region $REGION

echo
echo "[INFO] Checking ECS service status..."
$AWS_CLI ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION --query 'services[0].{Status:status,Running:runningCount,Pending:pendingCount,Desired:desiredCount}' --output table

echo
echo "[INFO] Checking ECS service events..."
$AWS_CLI ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION --query 'services[0].events[0:3].{Message:message,Time:createdAt}' --output table

echo
echo "[INFO] Forcing new deployment..."
$AWS_CLI ecs update-service --cluster $CLUSTER --service $SERVICE --force-new-deployment --region $REGION --query 'service.{Status:status,Running:runningCount,Pending:pendingCount}'

echo
echo "[INFO] Checking target group health..."
$AWS_CLI elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-tg-alb/664e01592a97845a --region $REGION

echo
echo "[INFO] Testing application..."
curl -I https://moravian.edsteward.ai/health

echo "✅ Direct AWS check complete!" 