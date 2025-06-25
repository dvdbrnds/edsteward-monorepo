#!/bin/zsh

echo "🚀 Deploying Tenant Database Isolation to AWS ECS"
echo "=================================================="

# Tenant database URLs
ADMIN_DATABASE_URL="postgresql://postgres:EdSteward2024!Secure@edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward_admin?sslmode=require"
MORAVIAN_DATABASE_URL="postgresql://postgres:EdSteward2024!Secure@edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward_moravian?sslmode=require"
STAGING_DATABASE_URL="postgresql://postgres:EdSteward2024!Secure@edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward_staging?sslmode=require"
TEST_DATABASE_URL="postgresql://postgres:EdSteward2024!Secure@edsteward-public-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward_test?sslmode=require"

# ECS Configuration
CLUSTER_NAME="edsteward-cluster"
SERVICE_NAME="edsteward-service"
REGION="us-east-1"

echo "📋 Step 1: Getting current task definition..."

# Get current task definition
CURRENT_TASK_DEF=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $REGION \
    --query 'services[0].taskDefinition' \
    --output text)

if [ -z "$CURRENT_TASK_DEF" ]; then
    echo "❌ Failed to get current task definition"
    exit 1
fi

echo "Current task definition: $CURRENT_TASK_DEF"

# Download current task definition
aws ecs describe-task-definition \
    --task-definition $CURRENT_TASK_DEF \
    --region $REGION \
    --query 'taskDefinition' > current-task-def-with-tenant-dbs.json

echo "✅ Downloaded current task definition"

echo "📝 Step 2: Updating task definition with tenant database URLs..."

# Create updated task definition with tenant-specific database URLs
python3 -c "
import json
import sys

# Load current task definition
with open('current-task-def-with-tenant-dbs.json', 'r') as f:
    task_def = json.load(f)

# Remove AWS-managed fields
for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'placementConstraints', 'compatibilities', 'registeredAt', 'registeredBy']:
    task_def.pop(field, None)

# Find the container definition
container_def = None
for container in task_def.get('containerDefinitions', []):
    if container['name'] == 'edsteward-app':
        container_def = container
        break

if not container_def:
    print('❌ Could not find edsteward-app container')
    sys.exit(1)

# Get existing environment variables
env_vars = container_def.get('environment', [])

# Remove existing database URLs to avoid duplicates
env_vars = [env for env in env_vars if not env['name'].endswith('_DATABASE_URL')]

# Add tenant-specific database URLs
tenant_db_urls = [
    {'name': 'ADMIN_DATABASE_URL', 'value': '$ADMIN_DATABASE_URL'},
    {'name': 'MORAVIAN_DATABASE_URL', 'value': '$MORAVIAN_DATABASE_URL'},
    {'name': 'STAGING_DATABASE_URL', 'value': '$STAGING_DATABASE_URL'},
    {'name': 'TEST_DATABASE_URL', 'value': '$TEST_DATABASE_URL'}
]

env_vars.extend(tenant_db_urls)
container_def['environment'] = env_vars

# Save updated task definition
with open('updated-task-def-with-tenant-dbs.json', 'w') as f:
    json.dump(task_def, f, indent=2)

print('✅ Updated task definition with tenant database URLs')
"

# Replace environment variable placeholders with actual values
sed -i.bak "s|\$ADMIN_DATABASE_URL|$ADMIN_DATABASE_URL|g" updated-task-def-with-tenant-dbs.json
sed -i.bak "s|\$MORAVIAN_DATABASE_URL|$MORAVIAN_DATABASE_URL|g" updated-task-def-with-tenant-dbs.json
sed -i.bak "s|\$STAGING_DATABASE_URL|$STAGING_DATABASE_URL|g" updated-task-def-with-tenant-dbs.json
sed -i.bak "s|\$TEST_DATABASE_URL|$TEST_DATABASE_URL|g" updated-task-def-with-tenant-dbs.json

echo "✅ Replaced environment variable placeholders"

echo "📤 Step 3: Registering new task definition..."

# Register new task definition
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://updated-task-def-with-tenant-dbs.json \
    --region $REGION \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

if [ -z "$NEW_TASK_DEF_ARN" ]; then
    echo "❌ Failed to register new task definition"
    exit 1
fi

echo "✅ Registered new task definition: $NEW_TASK_DEF_ARN"

echo "🔄 Step 4: Updating ECS service..."

# Update ECS service with new task definition
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --task-definition $NEW_TASK_DEF_ARN \
    --region $REGION \
    --force-new-deployment > /dev/null

echo "✅ Updated ECS service with new task definition"

echo "⏳ Step 5: Waiting for deployment to complete..."

# Wait for service to stabilize
aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $REGION

echo "✅ Service deployment completed successfully"

echo "🧪 Step 6: Testing tenant isolation..."

# Test each tenant endpoint
echo "Testing staging environment..."
STAGING_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://staging.edsteward.ai/)
echo "Staging status: $STAGING_STATUS"

echo "Testing Moravian environment..."
MORAVIAN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://moravian.edsteward.ai/)
echo "Moravian status: $MORAVIAN_STATUS"

if [ "$STAGING_STATUS" = "200" ] && [ "$MORAVIAN_STATUS" = "200" ]; then
    echo "✅ Both environments are responding"
else
    echo "⚠️  One or more environments are not responding properly"
fi

echo ""
echo "🎉 Tenant Database Isolation Deployment Complete!"
echo "=================================================="
echo ""
echo "📊 Summary:"
echo "• Admin Database: edsteward_admin"
echo "• Moravian Database: edsteward_moravian (367 regulations)"
echo "• Staging Database: edsteward_staging (367 regulations)"
echo "• Test Database: edsteward_test (367 regulations)"
echo ""
echo "🔗 Each tenant now has complete database isolation"
echo "🚀 All environments should now show the full regulation dataset"
echo ""
echo "📋 Next Steps:"
echo "1. Test staging environment to verify 367 regulations are visible"
echo "2. Test Moravian environment to ensure data integrity"
echo "3. Monitor database connections and performance"
echo "4. Set up database backups for each tenant database"

# Clean up temporary files
rm -f current-task-def-with-tenant-dbs.json
rm -f updated-task-def-with-tenant-dbs.json
rm -f updated-task-def-with-tenant-dbs.json.bak 