#!/bin/zsh

echo "🏢 Setting up Multi-Tenant Databases for EdSteward"
echo "======================================================"

# Database connection details
DB_HOST="ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech"
DB_PORT="5432"
DB_USER="neondb_owner"
DB_PASSWORD="npg_foSr6ixkzw7W"

# Function to create database if it doesn't exist
create_database() {
    local db_name=$1
    echo "📋 Creating database: $db_name"
    
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d neondb -c "CREATE DATABASE $db_name;" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Database $db_name created successfully"
    else
        echo "ℹ️  Database $db_name already exists or creation failed"
    fi
}

# Function to copy schema from main database to tenant database
copy_schema() {
    local target_db=$1
    echo "🔄 Copying schema to: $target_db"
    
    # Export schema from main database
    PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d neondb --schema-only > /tmp/schema.sql
    
    # Import schema to target database
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $target_db < /tmp/schema.sql > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Schema copied to $target_db successfully"
    else
        echo "⚠️  Schema copy to $target_db failed"
    fi
    
    # Clean up
    rm -f /tmp/schema.sql
}

# Function to create initial admin user in tenant database
create_admin_user() {
    local db_name=$1
    local username=$2
    local email=$3
    echo "👤 Creating admin user in $db_name: $username"
    
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $db_name -c "
        INSERT INTO users (username, password, email, role, \"firstName\", \"lastName\", department)
        VALUES ('$username', 'password', '$email', 'admin', 'Admin', 'User', 'IT')
        ON CONFLICT (username) DO NOTHING;
    " > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Admin user created in $db_name"
    else
        echo "⚠️  Admin user creation failed in $db_name"
    fi
}

echo ""
echo "🚀 Step 1: Creating tenant databases..."

# Create admin database
create_database "neondb_admin"

# Create test database  
create_database "neondb_test"

echo ""
echo "🚀 Step 2: Setting up database schemas..."

# Copy schema to admin database
copy_schema "neondb_admin"

# Copy schema to test database
copy_schema "neondb_test"

echo ""
echo "🚀 Step 3: Creating initial admin users..."

# Create admin users for each tenant
create_admin_user "neondb_admin" "admin" "admin@edsteward.ai"
create_admin_user "neondb_test" "testadmin" "test@edsteward.ai"

echo ""
echo "🎉 Multi-tenant database setup completed!"
echo ""
echo "📊 Database Summary:"
echo "   • Admin Database: neondb_admin (admin@edsteward.ai / password)"
echo "   • Moravian Database: neondb (existing data)"
echo "   • Test Database: neondb_test (testadmin@edsteward.ai / password)"
echo ""
echo "🔗 Connection URLs:"
echo "   • Admin: postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb_admin?sslmode=require"
echo "   • Moravian: postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
echo "   • Test: postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech/neondb_test?sslmode=require"
echo ""
echo "✅ Ready for tenant isolation testing!" 