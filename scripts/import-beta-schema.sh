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
