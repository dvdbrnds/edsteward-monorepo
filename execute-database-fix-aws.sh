#!/bin/zsh

echo "🔧 EXECUTING DATABASE FIX VIA AWS ECS"
echo "===================================="

# Set AWS region
export AWS_DEFAULT_REGION=us-east-1

echo "🔍 Finding ECS cluster and service..."

# Find the production cluster and service
CLUSTER_NAME="edsteward-cluster"
SERVICE_NAME=$(aws ecs list-services --cluster $CLUSTER_NAME --query 'serviceArns[0]' --output text | cut -d'/' -f3)

if [ -z "$SERVICE_NAME" ]; then
    echo "❌ No service found in cluster $CLUSTER_NAME"
    echo "🔍 Checking other clusters..."
    
    # Try the multi-tenant staging cluster
    CLUSTER_NAME="edsteward-multi-tenant-staging-cluster"
    SERVICE_NAME=$(aws ecs list-services --cluster $CLUSTER_NAME --query 'serviceArns[0]' --output text | cut -d'/' -f3)
fi

if [ -z "$SERVICE_NAME" ]; then
    echo "❌ No service found. Listing all clusters:"
    aws ecs list-clusters --query 'clusterArns[*]' --output table
    exit 1
fi

echo "✅ Found cluster: $CLUSTER_NAME"
echo "✅ Found service: $SERVICE_NAME"

# Get a running task
echo "🔍 Finding running task..."
TASK_ARN=$(aws ecs list-tasks --cluster $CLUSTER_NAME --service-name $SERVICE_NAME --query 'taskArns[0]' --output text)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
    echo "❌ No running tasks found for service $SERVICE_NAME"
    exit 1
fi

echo "✅ Found task: $TASK_ARN"

# Copy the database fix script to the container and execute it
echo "📋 Executing database fix script..."

# Create a simple inline script to execute
cat > /tmp/db_fix_command.sh << 'EOF'
#!/bin/bash
echo "🔧 Starting database fix inside container..."

# Check if we have the fix script
if [ -f "simple-db-fix.js" ]; then
    echo "✅ Found simple-db-fix.js, executing..."
    node simple-db-fix.js
elif [ -f "fix-staging-tenant.js" ]; then
    echo "✅ Found fix-staging-tenant.js, executing..."
    node fix-staging-tenant.js
else
    echo "📋 Creating inline database fix..."
    
    # Create a minimal fix script inline
    cat > /tmp/inline_fix.js << 'JSEOF'
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain"),
  subdomain: text("subdomain"),
  databaseName: text("database_name"),
  status: text("status").default("active"),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

async function fix() {
  const sql = postgres(process.env.DATABASE_URL);
  const db = drizzle(sql);
  
  console.log('🔧 Fixing staging tenant...');
  
  // Delete incorrect record
  await db.delete(tenants).where(eq(tenants.subdomain, 'staging'));
  console.log('🗑️ Deleted incorrect record');
  
  // Insert correct record
  await db.insert(tenants).values({
    id: 'staging',
    name: 'EdSteward Staging Environment',
    domain: 'staging.edsteward.ai',
    subdomain: 'staging',
    databaseName: 'edsteward_staging',
    status: 'active',
    settings: {
      allowedDomains: ['edsteward.ai', 'staging.edsteward.ai'],
      defaultRole: 'admin',
      enableAutoProvisioning: true,
      features: {
        apiAccess: true,
        customDomain: false,
        ssoEnabled: false,
        maxUsers: 1000,
        maxRegulations: 10000
      }
    }
  });
  console.log('✅ Inserted correct record');
  
  await sql.end();
  console.log('🎉 Database fix completed!');
}

fix().catch(console.error);
JSEOF
    
    echo "🚀 Running inline database fix..."
    node /tmp/inline_fix.js
fi

echo "🔍 Verifying fix..."
curl -s https://staging.edsteward.ai/api/health | head -200
EOF

# Execute the command in the container
echo "🚀 Executing database fix in ECS container..."
aws ecs execute-command \
    --cluster $CLUSTER_NAME \
    --task $TASK_ARN \
    --container app \
    --interactive \
    --command "bash /tmp/db_fix_command.sh"

echo ""
echo "🔍 VERIFICATION:"
echo "Testing staging tenant after fix..."
curl -s https://staging.edsteward.ai/api/health | jq '.tenant.tenantId // "No tenant info"'

echo ""
echo "✅ Database fix execution completed!" 