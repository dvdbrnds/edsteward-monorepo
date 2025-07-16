#!/bin/zsh

echo "🔧 Quick 503 Fix - ECS Deployment"
echo "================================="

echo "[INFO] Step 1: Force new ECS deployment..."
aws ecs update-service --cluster edsteward-cluster --service edsteward-service --force-new-deployment --region us-east-1

echo "[INFO] Step 2: Wait for deployment to start..."
sleep 10

echo "[INFO] Step 3: Check ECS service status..."
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1 --query 'services[0].deployments[0].{Status:status,Running:runningCount,Pending:pendingCount,Desired:desiredCount}'

echo "[INFO] Step 4: Check target group health..."
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-tg-alb/664e01592a97845a --region us-east-1

echo "[INFO] Step 5: Test application..."
curl -I https://moravian.edsteward.ai/health

echo "✅ Quick fix complete!" 