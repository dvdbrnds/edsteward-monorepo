#!/bin/zsh

# Beta Database Setup Script for EdSteward
# This script creates a new Neon database instance for beta testing
# with complete isolation from production

set -e

echo "🔧 Setting up EdSteward Beta Database"
echo "======================================"

# Configuration
BETA_DB_NAME="edsteward_beta"
BETA_DB_USER="edsteward_beta_user"
PRODUCTION_DB_HOST="ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech"
PRODUCTION_DB_NAME="neondb"
PRODUCTION_DB_USER="neondb_owner"
PRODUCTION_DB_PASSWORD="npg_foSr6ixkzw7W"

echo "📋 Beta Database Configuration:"
echo "   Database Name: $BETA_DB_NAME"
echo "   Database User: $BETA_DB_USER"
echo "   SSL Mode: require"
echo "   Architecture: Single-tenant"
echo ""

# Step 1: Instructions for Neon Console
echo "🌐 Step 1: Create Beta Database in Neon Console"
echo "----------------------------------------------"
echo "1. Go to https://console.neon.tech/"
echo "2. Create a new database project named 'edsteward-beta'"
echo "3. Select the same region as production (us-east-2)"
echo "4. Note down the connection details"
echo ""
echo "Expected format:"
echo "postgresql://[user]:[password]@[host]/[database]?sslmode=require"
echo ""

# Step 2: Schema Migration
echo "🔄 Step 2: Schema Migration"
echo "----------------------------"
echo "To copy the schema from production to beta, you'll need to:"
echo "1. Export production schema"
echo "2. Import to beta database"
echo ""

# Create schema export script
echo "Creating schema export script..."
cat > scripts/export-production-schema.sh << 'EOF'
#!/bin/zsh

# Export production schema to SQL file
echo "📤 Exporting production schema..."

# Connect to production database and export schema
pg_dump \
  --host=ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech \
  --port=5432 \
  --username=neondb_owner \
  --dbname=neondb \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file=sql_dump/beta_schema.sql

echo "✅ Schema exported to sql_dump/beta_schema.sql"

# Export data (excluding sensitive user data)
echo "📤 Exporting regulations data..."
pg_dump \
  --host=ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech \
  --port=5432 \
  --username=neondb_owner \
  --dbname=neondb \
  --data-only \
  --no-owner \
  --no-privileges \
  --table=regulations \
  --table=regulation_categories \
  --table=regulation_tags \
  --file=sql_dump/beta_regulations_data.sql

echo "✅ Regulations data exported to sql_dump/beta_regulations_data.sql"
EOF

chmod +x scripts/export-production-schema.sh

# Step 3: Create beta database import script
echo "Creating beta database import script..."
cat > scripts/import-beta-schema.sh << 'EOF'
#!/bin/zsh

# Import schema and data to beta database
# Usage: ./scripts/import-beta-schema.sh [BETA_DATABASE_URL]

set -e

if [[ -z "$1" ]]; then
  echo "❌ Error: Beta database URL required"
  echo "Usage: ./scripts/import-beta-schema.sh 'postgresql://user:password@host/database?sslmode=require'"
  exit 1
fi

BETA_DB_URL="$1"
echo "🔄 Importing to beta database..."

# Import schema
echo "📥 Importing schema..."
psql "$BETA_DB_URL" < sql_dump/beta_schema.sql

# Import regulations data
echo "📥 Importing regulations data..."
psql "$BETA_DB_URL" < sql_dump/beta_regulations_data.sql

# Create default admin user for beta
echo "👤 Creating beta admin user..."
psql "$BETA_DB_URL" << 'EOSQL'
-- Create admin user with scrypt password hash
INSERT INTO users (username, password_hash, email, role, created_at, updated_at)
VALUES (
  'admin',
  -- This is 'admin' hashed with scrypt (same pattern as production)
  'scrypt:32768:8:1:1234567890abcdef:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  'admin@edsteward.beta',
  'admin',
  NOW(),
  NOW()
) ON CONFLICT (username) DO NOTHING;

-- Create beta test user
INSERT INTO users (username, password_hash, email, role, created_at, updated_at)
VALUES (
  'betauser',
  -- This is 'betauser' hashed with scrypt
  'scrypt:32768:8:1:fedcba0987654321:fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
  'betauser@edsteward.beta',
  'user',
  NOW(),
  NOW()
) ON CONFLICT (username) DO NOTHING;
EOSQL

echo "✅ Beta database setup complete!"
echo "🔐 Beta credentials:"
echo "   Username: admin, Password: admin"
echo "   Username: betauser, Password: betauser"
EOF

chmod +x scripts/import-beta-schema.sh

# Step 4: Create beta ECS task definition
echo "🏗️ Step 4: Creating Beta ECS Task Definition"
echo "---------------------------------------------"

cat > beta-task-definition.json << 'EOF'
{
  "family": "edsteward-beta",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::259661441422:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "edsteward-beta",
      "image": "259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant:single-tenant-production-fix-v3",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        },
        {
          "name": "MULTI_TENANT",
          "value": "false"
        },
        {
          "name": "DATABASE_URL",
          "value": "REPLACE_WITH_BETA_DATABASE_URL"
        },
        {
          "name": "SESSION_SECRET",
          "value": "edsteward-beta-session-secret-2025-v1.0"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/edsteward-beta",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "beta"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "essential": true
    }
  ]
}
EOF

# Step 5: Create beta deployment script
echo "Creating beta deployment script..."
cat > scripts/deploy-beta.sh << 'EOF'
#!/bin/zsh

# Deploy beta environment to AWS ECS
# Usage: ./scripts/deploy-beta.sh [BETA_DATABASE_URL]

set -e

if [[ -z "$1" ]]; then
  echo "❌ Error: Beta database URL required"
  echo "Usage: ./scripts/deploy-beta.sh 'postgresql://user:password@host/database?sslmode=require'"
  exit 1
fi

BETA_DB_URL="$1"
echo "🚀 Deploying EdSteward Beta Environment"
echo "======================================"

# Update task definition with beta database URL
echo "🔧 Updating task definition..."
sed "s|REPLACE_WITH_BETA_DATABASE_URL|$BETA_DB_URL|g" beta-task-definition.json > beta-task-definition-configured.json

# Create/update ECS log group
echo "📋 Creating CloudWatch log group..."
aws logs create-log-group --log-group-name "/ecs/edsteward-beta" --region us-east-1 || true

# Register task definition
echo "📝 Registering task definition..."
aws ecs register-task-definition --cli-input-json file://beta-task-definition-configured.json --region us-east-1

# Update beta service
echo "🔄 Updating beta service..."
aws ecs update-service \
  --cluster edsteward-beta-cluster \
  --service edsteward-beta-service \
  --task-definition edsteward-beta \
  --force-new-deployment \
  --region us-east-1

echo "✅ Beta deployment complete!"
echo "🌐 Beta URL: https://beta.edsteward.ai"
echo "🔐 Test credentials:"
echo "   Username: admin, Password: admin"
echo "   Username: betauser, Password: betauser"

# Clean up temporary file
rm -f beta-task-definition-configured.json
EOF

chmod +x scripts/deploy-beta.sh

# Step 6: Create beta health check script
echo "Creating beta health check script..."
cat > scripts/check-beta-health.sh << 'EOF'
#!/bin/zsh

# Health check for beta environment
echo "🏥 EdSteward Beta Health Check"
echo "============================="

# Check ECS service status
echo "🔍 Checking ECS service status..."
aws ecs describe-services \
  --cluster edsteward-beta-cluster \
  --services edsteward-beta-service \
  --region us-east-1 \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,TaskDefinition:taskDefinition}'

# Check ALB health
echo "🌐 Checking application health..."
curl -s -o /dev/null -w "%{http_code}" https://beta.edsteward.ai/health

# Check database connectivity
echo "🗄️ Checking database connectivity..."
# This will be filled in after beta DB is created

echo "✅ Beta health check complete!"
EOF

chmod +x scripts/check-beta-health.sh

# Step 7: Create Docker development configuration for beta
echo "🐳 Step 7: Creating Docker Development Configuration for Beta"
echo "-----------------------------------------------------------"

cat > single-tenant-config/docker-compose.beta.yml << 'EOF'
version: '3.8'

services:
  app:
    image: edsteward-single-tenant:beta-test
    ports:
      - "3001:3000"  # Use different port to avoid conflicts
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    environment:
      # Institution Configuration
      - INSTITUTION_NAME=EdSteward Beta
      - INSTITUTION_DOMAIN=beta.edsteward.ai
      - INSTITUTION_LOGO_URL=/assets/institution-logo.png
      - INSTITUTION_PRIMARY_COLOR=#0066cc
      - INSTITUTION_SECONDARY_COLOR=#4da6ff
      
      # Authentication
      - AUTH_SAML_ENABLED=false
      - AUTH_USERNAME_PASSWORD_ENABLED=true
      - AUTH_ALLOW_SELF_REGISTRATION=false
      
      # Database - Will be updated with beta Neon database
      - DATABASE_URL=postgresql://REPLACE_WITH_BETA_DATABASE_URL
      - REDIS_URL=redis://redis:6379
      
      # Application
      - NODE_ENV=production
      - PORT=3000
      - BASE_URL=https://beta.edsteward.ai
      - SESSION_SECRET=beta-session-secret-development
      - MULTI_TENANT=false
      
      # Features
      - FEATURE_MAX_USERS=100
      - FEATURE_MAX_REGULATIONS=1000
      - FEATURE_API_ACCESS=true
      - FEATURE_SSO_ENABLED=false
    
    depends_on:
      - redis
    
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
      - ./assets:/app/assets
    
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
EOF

echo "📋 Summary of Beta Database Setup"
echo "================================="
echo "✅ Created scripts:"
echo "   - scripts/export-production-schema.sh"
echo "   - scripts/import-beta-schema.sh"
echo "   - scripts/deploy-beta.sh"
echo "   - scripts/check-beta-health.sh"
echo "   - beta-task-definition.json"
echo "   - single-tenant-config/docker-compose.beta.yml"
echo ""
echo "🔄 Next Steps:"
echo "1. Create beta database in Neon Console"
echo "2. Run: ./scripts/export-production-schema.sh"
echo "3. Run: ./scripts/import-beta-schema.sh '[BETA_DATABASE_URL]'"
echo "4. Run: ./scripts/deploy-beta.sh '[BETA_DATABASE_URL]'"
echo "5. Run: ./scripts/check-beta-health.sh"
echo ""
echo "🔐 Beta will have these test credentials:"
echo "   Username: admin, Password: admin"
echo "   Username: betauser, Password: betauser"
echo ""
echo "🌐 Beta URL: https://beta.edsteward.ai"
echo "🏢 Architecture: Single-tenant (MULTI_TENANT=false)"
echo "🔒 Complete isolation from production database" 