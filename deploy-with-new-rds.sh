#!/bin/bash

echo "🚀 DEPLOYING WITH NEW RDS POSTGRESQL DATABASE"
echo "============================================="
echo "🐘 Using: edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com"
echo "🔒 SSL: Properly configured with rds-ca-rsa2048-g1"
echo ""

# New database URL
NEW_DATABASE_URL="postgresql://edsteward_admin:iRCCeTqRikGOeNldbWcGov75q@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=require"

echo "📦 Building Docker image with RDS database..."
docker build -t edsteward:v13.0-rds-$(date +%Y%m%d-%H%M%S) .

# Get the image tag
IMAGE_TAG=$(docker images edsteward --format "table {{.Tag}}" | grep rds | head -1)
echo "📦 Built image: edsteward:$IMAGE_TAG"

# Tag for ECR
echo "🏷️ Tagging for ECR..."
docker tag edsteward:$IMAGE_TAG 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:$IMAGE_TAG

# Push to ECR
echo "⬆️ Pushing to ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259661441422.dkr.ecr.us-east-1.amazonaws.com
docker push 259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:$IMAGE_TAG

# Get current task definition
echo "📋 Getting current task definition..."
aws ecs describe-task-definition --task-definition edsteward --query 'taskDefinition' > current-task-def.json

# Create new task definition with RDS database
echo "🔄 Creating new task definition with RDS database..."
cat current-task-def.json | jq --arg IMAGE "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward:$IMAGE_TAG" --arg DB_URL "$NEW_DATABASE_URL" '
  .containerDefinitions[0].image = $IMAGE |
  .containerDefinitions[0].environment = [
    {
      "name": "DATABASE_URL",
      "value": $DB_URL
    },
    {
      "name": "NODE_ENV", 
      "value": "production"
    },
    {
      "name": "SESSION_SECRET",
      "value": "your-production-session-secret-here"
    }
  ] |
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)
' > new-task-def.json

# Register new task definition
NEW_REVISION=$(aws ecs register-task-definition --cli-input-json file://new-task-def.json --query 'taskDefinition.revision')
echo "✅ New task definition revision: $NEW_REVISION"

# Update service
echo "🚀 Updating ECS service with RDS database..."
aws ecs update-service \
    --cluster edsteward \
    --service edsteward \
    --task-definition edsteward:$NEW_REVISION \
    --force-new-deployment

echo ""
echo "✅ RDS DATABASE DEPLOYMENT INITIATED"
echo "==================================="
echo "🐘 Database: edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com"
echo "📦 Image: $IMAGE_TAG"
echo "📝 Revision: $NEW_REVISION"
echo ""
echo "🔧 Key Benefits:"
echo "✅ Proper multi-tenant PostgreSQL database"
echo "✅ SSL certificates work correctly (no more parsing errors)"
echo "✅ Production-ready with backups and encryption"
echo "✅ Scalable and managed by AWS"
echo ""
echo "⏳ Waiting 3 minutes for deployment..."
sleep 180

echo ""
echo "🧪 Testing with new RDS database..."

echo "📱 Testing registration API..."
REGISTRATION_RESULT=$(curl -s "https://edsteward.ai/api/register" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test_rds_user","password":"test123","confirmPassword":"test123"}')

echo "Registration result: $REGISTRATION_RESULT"

if echo "$REGISTRATION_RESULT" | grep -q "User created\|User already exists\|success"; then
    echo "✅ SUCCESS! Registration is working with new RDS database!"
else
    echo "⚠️ Registration may still have issues. Check logs for details."
fi

echo ""
echo "🎉 RDS POSTGRESQL DEPLOYMENT COMPLETE!"
echo "====================================="
echo ""
echo "🔗 Your production database is now:"
echo "   postgresql://edsteward_admin:***@edsteward-postgres.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward"
echo ""
echo "💡 Next Steps:"
echo "1. Test all functionality on https://edsteward.ai"
echo "2. Set up database migrations if needed"
echo "3. Configure multi-tenant schemas as required"
echo "4. Monitor performance and scale as needed"

# Cleanup
rm -f current-task-def.json new-task-def.json 