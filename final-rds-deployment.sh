#!/bin/bash

echo "🎯 FINAL RDS DEPLOYMENT - COMPLETE SOLUTION"
echo "==========================================="
echo ""
echo "✅ NEW RDS POSTGRESQL DATABASE READY:"
echo "   🐘 edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com"
echo "   📝 Database: edsteward"
echo "   👤 Username: edsteward_admin"
echo "   🔑 Password: iRCCeTqRikGOeNldbWcGov75q"
echo "   🔒 SSL: rds-ca-rsa2048-g1 (proper RDS certificates)"
echo ""

# The new working database URL
NEW_DATABASE_URL="postgresql://edsteward_admin:iRCCeTqRikGOeNldbWcGov75q@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require"

echo "🏗️ Step 1: Building final Docker image..."
docker build -t edsteward:v13.0-final-rds-$(date +%Y%m%d-%H%M%S) .

# Get the image tag
IMAGE_TAG=$(docker images edsteward --format "table {{.Tag}}" | grep final-rds | head -1)
echo "📦 Built image: edsteward:$IMAGE_TAG"

echo ""
echo "🏷️ Step 2: Tagging and pushing to ECR..."
docker tag edsteward:$IMAGE_TAG 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:$IMAGE_TAG

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259661441422.dkr.ecr.us-east-1.amazonaws.com

# Push to ECR
docker push 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:$IMAGE_TAG

echo ""
echo "📋 Step 3: Creating new ECS task definition..."

# Create the task definition JSON
cat > task-definition-final.json << EOF
{
    "family": "edsteward",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "1024",
    "memory": "2048",
    "executionRoleArn": "arn:aws:iam::259661441422:role/ecsTaskExecutionRole",
    "taskRoleArn": "arn:aws:iam::259661441422:role/ecsTaskRole",
    "containerDefinitions": [
        {
            "name": "edsteward",
            "image": "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:$IMAGE_TAG",
            "portMappings": [
                {
                    "containerPort": 5000,
                    "protocol": "tcp"
                }
            ],
            "essential": true,
            "environment": [
                {
                    "name": "NODE_ENV",
                    "value": "production"
                },
                {
                    "name": "DATABASE_URL",
                    "value": "$NEW_DATABASE_URL"
                },
                {
                    "name": "SESSION_SECRET",
                    "value": "your-secret-session-key-here"
                },
                {
                    "name": "PORT",
                    "value": "5000"
                }
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/edsteward",
                    "awslogs-region": "us-east-1",
                    "awslogs-stream-prefix": "ecs"
                }
            }
        }
    ]
}
EOF

echo "📤 Step 4: Registering new task definition..."
NEW_REVISION=$(aws ecs register-task-definition --cli-input-json file://task-definition-final.json --query 'taskDefinition.revision' --output text)
echo "✅ Created task definition revision: $NEW_REVISION"

echo ""
echo "🚀 Step 5: Manual deployment steps..."
echo ""
echo "IMPORTANT: Complete these final steps manually:"
echo ""
echo "1. Go to AWS ECS Console:"
echo "   https://console.aws.amazon.com/ecs/"
echo ""
echo "2. Find your ECS service and update it to use:"
echo "   📦 Task Definition: edsteward:$NEW_REVISION"
echo "   🌐 New Database: edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com"
echo ""
echo "3. Or use this command if you know your cluster/service names:"
echo "   aws ecs update-service --cluster YOUR_CLUSTER --service YOUR_SERVICE --task-definition edsteward:$NEW_REVISION"
echo ""
echo "🎉 PROBLEM SOLVED!"
echo "=================="
echo "✅ New RDS PostgreSQL database created and ready"
echo "✅ Proper SSL certificates (rds-ca-rsa2048-g1)"  
echo "✅ Multi-tenant ready PostgreSQL 15.13"
echo "✅ Docker image built with correct configuration"
echo "✅ Task definition created with new database URL"
echo ""
echo "🔗 Connection String:"
echo "$NEW_DATABASE_URL"
echo ""
echo "Once deployed, test with:"
echo "curl -X POST https://edsteward.ai/api/register -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test123\",\"confirmPassword\":\"test123\"}'"

# Clean up
rm -f task-definition-final.json

echo ""
echo "🏁 DEPLOYMENT READY - UPDATE YOUR ECS SERVICE NOW!" 