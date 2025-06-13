#!/bin/bash

echo "🔍 RDS DATABASE INVESTIGATION"
echo "============================"
echo ""

echo "1. Getting RDS Instance Details..."
/opt/homebrew/bin/aws rds describe-db-instances \
  --db-instance-identifier edsteward-db \
  --region us-east-1 \
  --query 'DBInstances[0].{
    Engine:Engine,
    EngineVersion:EngineVersion,
    Status:DBInstanceStatus,
    Endpoint:Endpoint.Address,
    Port:Endpoint.Port,
    PubliclyAccessible:PubliclyAccessible,
    StorageEncrypted:StorageEncrypted,
    CACertificate:CACertificateIdentifier,
    VpcId:DBSubnetGroup.VpcId,
    AvailabilityZone:AvailabilityZone
  }' \
  --output table

echo ""
echo "2. Getting RDS Security Groups..."
/opt/homebrew/bin/aws rds describe-db-instances \
  --db-instance-identifier edsteward-db \
  --region us-east-1 \
  --query 'DBInstances[0].VpcSecurityGroups[*].{GroupId:VpcSecurityGroupId,Status:Status}' \
  --output table

echo ""
echo "3. Getting SSL/TLS Certificate Info..."
/opt/homebrew/bin/aws rds describe-certificates \
  --region us-east-1 \
  --query 'Certificates[?CertificateType==`CA`].{Identifier:CertificateIdentifier,ValidFrom:ValidFrom,ValidTill:ValidTill}' \
  --output table

echo ""
echo "4. Testing Direct Database Connection (without SSL)..."
echo "Attempting connection with sslmode=disable..."

# Create a temporary test script for database connection
cat > /tmp/test_db_connection.js << 'EOF'
const { Pool } = require('pg');

const connectionString = 'postgresql://postgres:FZ2Pk9ij4ow2yStKrJiZD7vfUW9emT+PtVrM2VV536s=@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/edsteward?sslmode=disable';

const pool = new Pool({
  connectionString: connectionString,
  ssl: false,
  connectionTimeoutMillis: 5000
});

async function testConnection() {
  try {
    console.log('Testing connection...');
    const client = await pool.connect();
    console.log('✅ Connection successful');
    
    const result = await client.query('SELECT version()');
    console.log('✅ Query successful:', result.rows[0].version);
    
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    process.exit(1);
  }
}

testConnection();
EOF

echo "Running Node.js connection test..."
cd /tmp && node test_db_connection.js

echo ""
echo "5. Getting Current ECS Task Definition..."
/opt/homebrew/bin/aws ecs describe-task-definition \
  --task-definition edsteward-task \
  --region us-east-1 \
  --query 'taskDefinition.{
    Revision:revision,
    Status:status,
    Image:containerDefinitions[0].image,
    Environment:containerDefinitions[0].environment
  }' \
  --output json

echo ""
echo "6. Checking ECS Service Status..."
/opt/homebrew/bin/aws ecs describe-services \
  --cluster edsteward-cluster \
  --services edsteward-service \
  --region us-east-1 \
  --query 'services[0].{
    Status:status,
    RunningCount:runningCount,
    DesiredCount:desiredCount,
    TaskDefinition:taskDefinition,
    Events:events[0:3]
  }' \
  --output json

echo ""
echo "7. Recent Container Logs..."
echo "Getting latest logs from ECS..."
/opt/homebrew/bin/aws logs filter-log-events \
  --log-group-name "/aws/ecs/edsteward" \
  --region us-east-1 \
  --start-time $(date -u -d '10 minutes ago' +%s)000 \
  --filter-pattern "ENOENT" \
  --max-items 5 \
  --query 'events[*].message' \
  --output text

echo ""
echo "INVESTIGATION COMPLETE"
echo "=====================" 