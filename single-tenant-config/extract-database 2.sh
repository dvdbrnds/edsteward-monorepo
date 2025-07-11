#!/bin/zsh

# Extract Moravian database schema and data
# Run this script with appropriate database credentials

set -e

echo "🗄️ Extracting Moravian Database"

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-edsteward_moravian}"
DB_USER="${DB_USER:-postgres}"

# Extract schema only
echo "Extracting schema..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema-only --no-owner --no-privileges \
    > moravian-schema.sql

# Extract data (excluding sensitive tables)
echo "Extracting data..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --data-only --no-owner --no-privileges \
    --exclude-table=users --exclude-table=user_sessions \
    > moravian-data.sql

# Create admin user script
cat > create-admin-user.sql << 'EOSQL'
-- Create admin user for single-tenant deployment
INSERT INTO users (email, password, name, role, created_at, updated_at)
VALUES (
    'admin@moravian.edu',
    '$2b$12$LQv3c1yqBwUHC5q.JqTrVOKgUs5/LqCfZjLzFgIrOJmIYJWmrHKhi', -- password: admin123
    'System Administrator',
    'admin',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create demo user
INSERT INTO users (email, password, name, role, created_at, updated_at)
VALUES (
    'demo@moravian.edu',
    '$2b$12$LQv3c1yqBwUHC5q.JqTrVOKgUs5/LqCfZjLzFgIrOJmIYJWmrHKhi', -- password: demo123
    'Demo User',
    'user',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;
EOSQL

echo "✅ Database extraction complete"
echo "Files created:"
echo "  - moravian-schema.sql"
echo "  - moravian-data.sql"
echo "  - create-admin-user.sql"
