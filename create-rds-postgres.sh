#!/bin/bash

echo "🐘 CREATING RDS POSTGRESQL FOR MULTI-TENANT APPLICATION"
echo "======================================================"

# Configuration
DB_INSTANCE_ID="edsteward-postgres"
DB_NAME="edsteward"
DB_USERNAME="edsteward_admin"
DB_PASSWORD="$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)"
DB_INSTANCE_CLASS="db.t3.micro"  # Start small, can scale up
ALLOCATED_STORAGE="20"
ENGINE_VERSION="15.4"

echo "📝 Database Configuration:"
echo "   Instance ID: $DB_INSTANCE_ID"
echo "   Database Name: $DB_NAME"
echo "   Username: $DB_USERNAME"
echo "   Password: [GENERATED]"
echo "   Instance Class: $DB_INSTANCE_CLASS"
echo "   Storage: ${ALLOCATED_STORAGE}GB"
echo "   PostgreSQL Version: $ENGINE_VERSION"
echo ""

# Get default VPC and subnet group
DEFAULT_VPC=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text)
echo "🌐 Using default VPC: $DEFAULT_VPC"

# Create security group for RDS
echo "🔒 Creating security group for RDS..."
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name edsteward-rds-sg \
    --description "Security group for EdSteward RDS PostgreSQL" \
    --vpc-id $DEFAULT_VPC \
    --query 'GroupId' \
    --output text)

echo "✅ Security group created: $SECURITY_GROUP_ID"

# Add rule to allow PostgreSQL access (port 5432) from anywhere in VPC
echo "🔓 Adding PostgreSQL access rule..."
aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 5432 \
    --cidr 10.0.0.0/8

# Create DB subnet group
echo "🌐 Creating DB subnet group..."
SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$DEFAULT_VPC" \
    --query 'Subnets[].SubnetId' \
    --output text | tr '\t' ' ')

aws rds create-db-subnet-group \
    --db-subnet-group-name edsteward-subnet-group \
    --db-subnet-group-description "Subnet group for EdSteward RDS" \
    --subnet-ids $SUBNETS

# Create RDS instance
echo "🏗️  Creating RDS PostgreSQL instance..."
echo "⏳ This will take 5-10 minutes..."

aws rds create-db-instance \
    --db-instance-identifier $DB_INSTANCE_ID \
    --db-instance-class $DB_INSTANCE_CLASS \
    --engine postgres \
    --engine-version $ENGINE_VERSION \
    --master-username $DB_USERNAME \
    --master-user-password $DB_PASSWORD \
    --allocated-storage $ALLOCATED_STORAGE \
    --db-name $DB_NAME \
    --vpc-security-group-ids $SECURITY_GROUP_ID \
    --db-subnet-group-name edsteward-subnet-group \
    --backup-retention-period 7 \
    --storage-encrypted \
    --publicly-accessible \
    --auto-minor-version-upgrade \
    --deletion-protection

echo ""
echo "⏳ Waiting for RDS instance to be available..."
aws rds wait db-instance-available --db-instance-identifier $DB_INSTANCE_ID

# Get the endpoint
ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier $DB_INSTANCE_ID \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

echo ""
echo "🎉 RDS PostgreSQL Instance Created Successfully!"
echo "=============================================="
echo "📍 Endpoint: $ENDPOINT"
echo "🗄️  Database: $DB_NAME"
echo "👤 Username: $DB_USERNAME"
echo "🔑 Password: $DB_PASSWORD"
echo ""
echo "🔗 Connection String:"
echo "postgresql://$DB_USERNAME:$DB_PASSWORD@$ENDPOINT:5432/$DB_NAME?sslmode=require"
echo ""
echo "⚠️  IMPORTANT: Save this password! It won't be shown again."
echo "💾 Add this to your environment variables:"
echo "DATABASE_URL=\"postgresql://$DB_USERNAME:$DB_PASSWORD@$ENDPOINT:5432/$DB_NAME?sslmode=require\""
echo ""
echo "🔧 Next steps:"
echo "1. Update your environment variables with the new DATABASE_URL"
echo "2. Test the connection locally"
echo "3. Deploy to production with the new database" 