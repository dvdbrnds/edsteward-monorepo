#!/bin/zsh

# Export production schema to SQL file
echo "📤 Exporting production schema..."

# Complete production database URL from PRODUCTION_RECOVERY_AND_DEPLOYMENT_SUMMARY.md
PROD_DB_URL="postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech:5432/neondb?sslmode=require"

# Connect to production database and export schema
pg_dump "$PROD_DB_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file=sql_dump/beta_schema.sql

echo "✅ Schema exported to sql_dump/beta_schema.sql"

# Export data (excluding sensitive user data)
echo "📤 Exporting regulations data..."
pg_dump "$PROD_DB_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --table=regulations \
  --table=regulation_categories \
  --table=regulation_tags \
  --file=sql_dump/beta_regulations_data.sql

echo "✅ Regulations data exported to sql_dump/beta_regulations_data.sql"
