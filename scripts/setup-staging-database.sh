#!/bin/zsh

# 🗄️ Setup Staging Database
# This script helps you create a separate staging database

echo "🗄️ Setting up staging database for EdSteward..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="us-east-1"
STAGING_CLUSTER="edsteward-multi-tenant-staging-cluster"
STAGING_SERVICE="edsteward-multi-tenant-staging-service"
STAGING_TASK_FAMILY="edsteward-multi-tenant-staging"

echo -e "${BLUE}📋 Staging Database Setup Options:${NC}"
echo "1. Create new Neon staging database (recommended)"
echo "2. Use existing database with staging schema"
echo "3. Create local PostgreSQL staging database"
echo ""

echo -n "Choose option (1-3): "
read choice

case $choice in
    1)
        echo -e "${YELLOW}🏗️ Setting up Neon staging database...${NC}"
        echo ""
        echo -e "${BLUE}📝 Manual Steps for Neon:${NC}"
        echo "1. Go to https://console.neon.tech/"
        echo "2. Create a new database called 'edsteward-staging'"
        echo "3. Copy the connection string"
        echo ""
        echo -n "Enter your staging database URL: "
        read STAGING_DB_URL
        ;;
    2)
        echo -e "${YELLOW}🔧 Using existing database with staging schema...${NC}"
        echo "We'll add a 'staging_' prefix to all tables"
        echo -n "Enter your database URL: "
        read STAGING_DB_URL
        ;;
    3)
        echo -e "${YELLOW}🐘 Setting up local PostgreSQL...${NC}"
        STAGING_DB_URL="postgresql://postgres:password@localhost:5432/edsteward_staging"
        
        # Check if PostgreSQL is installed
        if ! command -v psql &> /dev/null; then
            echo -e "${YELLOW}Installing PostgreSQL via Homebrew...${NC}"
            brew install postgresql
            brew services start postgresql
        fi
        
        # Create staging database
        createdb edsteward_staging 2>/dev/null || echo "Database may already exist"
        ;;
    *)
        echo -e "${RED}❌ Invalid option${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✅ Database URL configured: ${STAGING_DB_URL}${NC}"

# Function to copy schema from production to staging
copy_schema_to_staging() {
    echo -e "${YELLOW}📋 Copying schema from production to staging...${NC}"
    
    # Production database URL (extract from current task definition)
    PROD_DB_URL=$(aws ecs describe-task-definition \
        --task-definition edsteward-hostname-fix:18 \
        --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' \
        --output text \
        --region us-east-1 | cat)
    
    if [ -z "$PROD_DB_URL" ] || [ "$PROD_DB_URL" = "None" ]; then
        echo -e "${RED}❌ Could not get production database URL${NC}"
        return 1
    fi
    
    echo "Production DB: ${PROD_DB_URL:0:30}..."
    echo "Staging DB: ${STAGING_DB_URL:0:30}..."
    
    # Export schema from production
    echo -e "${YELLOW}📤 Exporting production schema...${NC}"
    pg_dump "$PROD_DB_URL" --schema-only --no-owner --no-privileges > staging_schema.sql
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to export production schema${NC}"
        return 1
    fi
    
    # Import schema to staging
    echo -e "${YELLOW}📥 Importing schema to staging...${NC}"
    psql "$STAGING_DB_URL" < staging_schema.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Schema copied successfully${NC}"
    else
        echo -e "${RED}❌ Failed to import schema to staging${NC}"
        return 1
    fi
    
    # Optional: Copy sample data
    echo ""
    echo -n "Copy sample data from production? (y/N): "
    read copy_data
    
    if [[ $copy_data =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}📊 Copying sample data...${NC}"
        
        # Copy essential data (users, tenants, some regulations)
        pg_dump "$PROD_DB_URL" --data-only --no-owner --no-privileges \
            --table=tenants \
            --table=users \
            --table=regulations \
            --table=deadlines \
            > staging_data.sql
        
        psql "$STAGING_DB_URL" < staging_data.sql
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Sample data copied${NC}"
        else
            echo -e "${YELLOW}⚠️ Some data may not have copied (this is often normal)${NC}"
        fi
        
        rm staging_data.sql
    fi
    
    # Clean up
    rm staging_schema.sql
}

# Function to update staging task definition
update_staging_task_definition() {
    echo -e "${YELLOW}🔧 Updating staging task definition...${NC}"
    
    # Get current staging task definition
    aws ecs describe-task-definition \
        --task-definition "$STAGING_TASK_FAMILY" \
        --query 'taskDefinition' \
        --region us-east-1 | cat > current-staging-task.json
    
    # Update database URL in task definition
    cat current-staging-task.json | jq --arg db_url "$STAGING_DB_URL" '
        del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy) |
        .containerDefinitions[0].environment |= map(
            if .name == "DATABASE_URL" then .value = $db_url
            elif .name == "NODE_ENV" then .value = "staging"
            else . end
        )
    ' > updated-staging-task.json
    
    # Register new task definition
    NEW_TASK_ARN=$(aws ecs register-task-definition \
        --cli-input-json file://updated-staging-task.json \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text \
        --region us-east-1 | cat)
    
    echo "New staging task definition: $NEW_TASK_ARN"
    
    # Update service to use new task definition
    aws ecs update-service \
        --cluster "$STAGING_CLUSTER" \
        --service "$STAGING_SERVICE" \
        --task-definition "$NEW_TASK_ARN" \
        --region us-east-1 | cat > /dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Staging service updated with new database${NC}"
    else
        echo -e "${RED}❌ Failed to update staging service${NC}"
        return 1
    fi
    
    # Clean up
    rm current-staging-task.json updated-staging-task.json
}

# Function to test database connection
test_database_connection() {
    echo -e "${YELLOW}🔍 Testing database connection...${NC}"
    
    if psql "$STAGING_DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
        
        # Check if tables exist
        TABLE_COUNT=$(psql "$STAGING_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
        echo "Tables in staging database: $TABLE_COUNT"
        
        if [ "$TABLE_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✅ Database schema looks good${NC}"
        else
            echo -e "${YELLOW}⚠️ No tables found - you may need to run migrations${NC}"
        fi
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        echo "Please check your database URL and try again"
        return 1
    fi
}

# Main execution
echo -e "${BLUE}🚀 Starting staging database setup...${NC}"

# Test database connection first
test_database_connection

if [ $? -eq 0 ]; then
    # Copy schema if database is empty or user wants to refresh
    echo -n "Copy schema from production? (Y/n): "
    read copy_schema
    if [[ ! $copy_schema =~ ^[Nn]$ ]]; then
        copy_schema_to_staging
    fi
    
    # Update task definition
    update_staging_task_definition
    
    echo ""
    echo -e "${GREEN}🎉 Staging database setup complete!${NC}"
    echo ""
    echo -e "${BLUE}📋 What's Next:${NC}"
    echo "1. Wait for staging service to restart (2-3 minutes)"
    echo "2. Test your staging environment"
    echo "3. Make changes and push to ES-clientside branch"
    echo ""
    echo -e "${BLUE}🔗 Database URLs:${NC}"
    echo "Production: [REDACTED]"
    echo "Staging: ${STAGING_DB_URL:0:50}..."
    echo ""
    echo -e "${YELLOW}💡 To monitor staging service restart:${NC}"
    echo "aws ecs describe-services --cluster $STAGING_CLUSTER --services $STAGING_SERVICE --region $REGION"
else
    echo -e "${RED}❌ Database setup failed${NC}"
    exit 1
fi 