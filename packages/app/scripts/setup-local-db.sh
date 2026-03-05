#!/bin/bash

# Setup Local PostgreSQL Database for EdSteward
echo "🚀 Setting up local PostgreSQL database..."

# Database configuration
DB_NAME="edsteward"
DB_USER="edsteward_user"
DB_PASS="local_dev_password"

# Check if we're on macOS with Homebrew PostgreSQL
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "📊 Creating database and user on macOS..."
    
    # Add PostgreSQL bin to PATH for this session
    export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"
    
    # Create database and user (on macOS, we can connect as current user)
    createdb $DB_NAME 2>/dev/null || echo "Database may already exist"
    
    psql -d postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "User may already exist"
    psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    psql -d postgres -c "ALTER USER $DB_USER CREATEDB;"
    
    # Grant schema permissions
    psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
    psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
    psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
    
else
    # Linux/Ubuntu setup
    echo "📊 Creating database and user on Linux..."
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
fi

echo "✅ Database created successfully!"
echo ""
echo "📝 Update your .env file with:"
echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
echo ""
echo "🔧 Next steps:"
echo "1. Update your .env file with the DATABASE_URL above"
echo "2. Run database migrations: npm run db:push"
echo "3. Import your exported data (if you have exports)" 