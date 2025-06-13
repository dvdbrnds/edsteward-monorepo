#!/bin/bash

echo "🔍 DIAGNOSING SSL ISSUE - EdSteward"
echo "==================================="
echo ""

echo "Issue: Service stuck in 503 for 5+ minutes after SSL deployment"
echo "This suggests the new SSL tasks are failing to start or pass health checks"
echo ""

echo "1. Checking recent CloudWatch logs for errors..."
aws logs tail /aws/ecs/edsteward --since 5m --region us-east-1 2>/dev/null | grep -A5 -B5 -i "error\|fatal\|ssl\|certificate\|connection" | tail -20

echo ""
echo "2. Possible SSL Configuration Issues:"
echo "   ❌ SSL certificate file missing: /app/ssl/rds-ca-2019-root.pem"
echo "   ❌ Incorrect certificate for RDS instance"  
echo "   ❌ SSL mode too strict (require vs prefer)"
echo "   ❌ Container startup failing due to SSL errors"

echo ""
echo "3. RECOVERY OPTIONS:"
echo ""

echo "🔧 OPTION A: Quick Fix - Use SSL without certificate file"
echo "   aws ecs register-task-definition \\"
echo "     --family edsteward-task \\"
echo "     --task-role-arn arn:aws:iam::259661441422:role/edsteward-task-role \\"
echo "     --execution-role-arn arn:aws:iam::259661441422:role/edstewardTaskExecutionRole \\"
echo "     --network-mode awsvpc \\"
echo "     --requires-compatibilities FARGATE \\"
echo "     --cpu 512 \\"
echo "     --memory 1024 \\"
echo "     --container-definitions '[{\"name\":\"edsteward\",\"image\":\"259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:v12.0-ssl-db-fix-20250612-210839\",\"portMappings\":[{\"containerPort\":3000,\"protocol\":\"tcp\"}],\"essential\":true,\"environment\":[{\"name\":\"NODE_ENV\",\"value\":\"production\"},{\"name\":\"DATABASE_URL\",\"value\":\"postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=prefer\"}],\"logConfiguration\":{\"logDriver\":\"awslogs\",\"options\":{\"awslogs-group\":\"/aws/ecs/edsteward\",\"awslogs-region\":\"us-east-1\",\"awslogs-stream-prefix\":\"ecs\"}}}]' \\"
echo "     --region us-east-1"

echo ""
echo "🔧 OPTION B: Rollback to working configuration"
echo "   aws ecs update-service \\"
echo "     --cluster edsteward-cluster \\"
echo "     --service edsteward-service \\"
echo "     --task-definition edsteward-task:62 \\"
echo "     --region us-east-1"

echo ""
echo "🔧 OPTION C: Check RDS SSL settings"
echo "   - RDS may have rds.force_ssl=1 (requiring SSL)"
echo "   - But our cert path might be wrong"

echo ""
echo "📋 IMMEDIATE RECOMMENDATION:"
echo "Since the service is down, let's try Option A (SSL without cert file)"
echo "This should work with most RDS configurations"

echo ""
echo "Would you like me to:"
echo "1. Try SSL with sslmode=prefer (no cert file) - RECOMMENDED"
echo "2. Rollback to working non-SSL version"
echo "3. Check what specific error is in the logs" 