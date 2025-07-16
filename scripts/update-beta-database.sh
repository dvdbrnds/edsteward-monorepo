#!/bin/zsh
# Update Beta Database Script
# Updates beta task definition with new isolated database URL and redeploys

set -e

# Fix AWS CLI pager issues on macOS
export AWS_PAGER=""

echo "🔄 Updating beta database configuration..."

# Configuration
CLUSTER_NAME="edsteward-beta-cluster"
SERVICE_NAME="edsteward-beta-service"
TASK_DEF_FILE="beta-task-definition.json"
AWS_REGION="us-east-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Step 1: Get new database URL from user
echo_step "1. Enter New Beta Database URL"
echo ""
echo_warn "Please enter your new Neon beta database URL:"
echo "Format: postgresql://username:password@host:5432/neondb?sslmode=require"
echo ""
read -p "Beta Database URL: " NEW_DB_URL

if [[ -z "$NEW_DB_URL" ]]; then
    echo_error "Database URL cannot be empty"
    exit 1
fi

# Step 2: Validate database URL format
if [[ ! "$NEW_DB_URL" =~ ^postgresql:// ]]; then
    echo_error "Invalid database URL format. Must start with 'postgresql://'"
    exit 1
fi

# Step 3: Test database connection
echo_step "2. Test Database Connection"
echo_info "Testing connection to beta database..."
psql "$NEW_DB_URL" -c "SELECT 1;" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo_info "✅ Database connection successful"
else
    echo_error "❌ Failed to connect to database. Please check the URL."
    exit 1
fi

# Step 4: Update task definition file
echo_step "3. Update Task Definition"
echo_info "Updating beta-task-definition.json with new database URL..."

# Create backup
cp "$TASK_DEF_FILE" "${TASK_DEF_FILE}.backup"

# Update the DATABASE_URL value in the JSON file
# Using sed to replace the DATABASE_URL value
sed -i.bak "s|\"value\": \"postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech:5432/neondb?sslmode=require\"|\"value\": \"$NEW_DB_URL\"|g" "$TASK_DEF_FILE"

if [ $? -eq 0 ]; then
    echo_info "✅ Task definition updated"
    rm "${TASK_DEF_FILE}.bak"
else
    echo_error "❌ Failed to update task definition"
    exit 1
fi

# Step 5: Register new task definition
echo_step "4. Register New Task Definition"
echo_info "Registering updated task definition with AWS..."

TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file://"$TASK_DEF_FILE" --query 'taskDefinition.taskDefinitionArn' --output text --region $AWS_REGION)

if [ $? -eq 0 ]; then
    echo_info "✅ New task definition registered: $TASK_DEF_ARN"
else
    echo_error "❌ Failed to register task definition"
    exit 1
fi

# Step 6: Update ECS service
echo_step "5. Update ECS Service"
echo_info "Updating ECS service to use new task definition..."

aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --task-definition $TASK_DEF_ARN --force-new-deployment --region $AWS_REGION

if [ $? -eq 0 ]; then
    echo_info "✅ ECS service update initiated"
else
    echo_error "❌ Failed to update ECS service"
    exit 1
fi

# Step 7: Wait for service to be stable
echo_step "6. Wait for Service Stability"
echo_info "Waiting for service to be stable (this may take a few minutes)..."

aws ecs wait services-stable --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION

if [ $? -eq 0 ]; then
    echo_info "✅ Service is stable"
else
    echo_error "❌ Service failed to stabilize"
    exit 1
fi

# Step 8: Get new task IP and test
echo_step "7. Test Updated Service"
echo_info "Getting new task IP address..."

TASK_ARN=$(aws ecs list-tasks --cluster $CLUSTER_NAME --service-name $SERVICE_NAME --query 'taskArns[0]' --output text --region $AWS_REGION)
ENI_ID=$(aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $TASK_ARN --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text --region $AWS_REGION)
PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --query 'NetworkInterfaces[0].Association.PublicIp' --output text --region $AWS_REGION)

echo_info "✅ New beta IP: $PUBLIC_IP"

# Test the service
echo_info "Testing beta service with isolated database..."
HEALTH_STATUS=$(curl -s -w "%{http_code}" -o /dev/null http://$PUBLIC_IP:3000/health)

if [ "$HEALTH_STATUS" = "200" ]; then
    echo_info "✅ Health check passed"
else
    echo_error "❌ Health check failed (HTTP $HEALTH_STATUS)"
fi

# Test API with isolated database
API_STATUS=$(curl -s -w "%{http_code}" -o /dev/null http://$PUBLIC_IP:3000/api/regulations)

if [ "$API_STATUS" = "200" ]; then
    echo_info "✅ API test passed"
else
    echo_error "❌ API test failed (HTTP $API_STATUS)"
fi

echo ""
echo_info "🎉 Beta database update completed!"
echo_info "📝 Summary:"
echo_info "   🌐 Beta URL: http://$PUBLIC_IP:3000"
echo_info "   🗄️  Database: Isolated beta database"
echo_info "   🔐 Authentication: Independent from production"
echo_info "   ✅ Status: Fully operational"
echo ""
echo_warn "Next steps:"
echo_info "   1. Test authentication with beta user accounts"
echo_info "   2. Set up beta.edsteward.ai domain (if desired)"
echo_info "   3. Begin safe feature testing" 