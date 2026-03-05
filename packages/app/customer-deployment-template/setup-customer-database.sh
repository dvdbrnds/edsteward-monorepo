#!/bin/zsh

# Setup Customer Database
# Usage: ./setup-customer-database.sh [customer-config.json]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[DB]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[DB]${NC} $1"
}

error() {
    echo -e "${RED}[DB]${NC} $1"
    exit 1
}

if [[ -z "$1" ]]; then
    error "Usage: ./setup-customer-database.sh [customer-config.json]"
fi

CONFIG_FILE="$1"
if [[ ! -f "$CONFIG_FILE" ]]; then
    error "Customer configuration file not found: $CONFIG_FILE"
fi

# Load configuration
CUSTOMER_NAME=$(jq -r '.customer.name' "$CONFIG_FILE")
DATABASE_URL=$(jq -r '.database.connectionString' "$CONFIG_FILE")
DATABASE_TYPE=$(jq -r '.database.type' "$CONFIG_FILE")

log "Setting up database for customer: $CUSTOMER_NAME"
log "Database type: $DATABASE_TYPE"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    error "psql (PostgreSQL client) is required but not installed"
fi

# Test database connection
log "Testing database connection..."
psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null || error "Cannot connect to database"

# Create database schema
log "Creating database schema..."
if [[ -f "sql_dump/beta_schema.sql" ]]; then
    psql "$DATABASE_URL" -f "sql_dump/beta_schema.sql" || error "Failed to create schema"
else
    error "Schema file not found: sql_dump/beta_schema.sql"
fi

# Import base regulations data
log "Importing regulations data..."
if [[ -f "sql_dump/beta_regulations_data.sql" ]]; then
    psql "$DATABASE_URL" -f "sql_dump/beta_regulations_data.sql" || error "Failed to import regulations data"
else
    error "Regulations data file not found: sql_dump/beta_regulations_data.sql"
fi

# Create customer-specific admin user
log "Creating admin user..."
ADMIN_EMAIL=$(jq -r '.customer.contact.adminEmail' "$CONFIG_FILE")
SUPPORT_EMAIL=$(jq -r '.customer.contact.supportEmail' "$CONFIG_FILE")

psql "$DATABASE_URL" -c "
-- Create admin user with scrypt password hash
INSERT INTO public.users (username, password, email, role, created_at, updated_at)
VALUES (
  'admin',
  'scrypt:32768:8:1:1234567890abcdef:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  '$ADMIN_EMAIL',
  'admin',
  NOW(),
  NOW()
) ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = NOW();

-- Create support user
INSERT INTO public.users (username, password, email, role, created_at, updated_at)
VALUES (
  'support',
  'scrypt:32768:8:1:fedcba0987654321:fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
  '$SUPPORT_EMAIL',
  'user',
  NOW(),
  NOW()
) ON CONFLICT (username) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = NOW();
" || error "Failed to create admin users"

# Setup customer-specific branding in database
log "Setting up customer branding..."
INSTITUTION_NAME=$(jq -r '.branding.institutionName' "$CONFIG_FILE")
INSTITUTION_TITLE=$(jq -r '.branding.title' "$CONFIG_FILE")
LOGO_URL=$(jq -r '.branding.logoUrl' "$CONFIG_FILE")
FAVICON_URL=$(jq -r '.branding.faviconUrl' "$CONFIG_FILE")
PRIMARY_COLOR=$(jq -r '.branding.primaryColor' "$CONFIG_FILE")
SECONDARY_COLOR=$(jq -r '.branding.secondaryColor' "$CONFIG_FILE")
ACCENT_COLOR=$(jq -r '.branding.accentColor' "$CONFIG_FILE")
LOGIN_BG_COLOR=$(jq -r '.branding.loginScreenBackgroundColor' "$CONFIG_FILE")
LOGIN_ACCENT_COLOR=$(jq -r '.branding.loginScreenAccentColor' "$CONFIG_FILE")
LOGIN_TEXT_COLOR=$(jq -r '.branding.loginScreenTextColor' "$CONFIG_FILE")
LOGIN_HERO_COLOR=$(jq -r '.branding.loginScreenHeroColor' "$CONFIG_FILE")

# Create or update branding configuration
psql "$DATABASE_URL" -c "
-- Insert or update branding configuration
INSERT INTO public.branding_configurations (id, config_data, created_at, updated_at)
VALUES (
  1,
  '{
    \"institutionName\": \"$INSTITUTION_NAME\",
    \"title\": \"$INSTITUTION_TITLE\",
    \"logoUrl\": \"$LOGO_URL\",
    \"faviconUrl\": \"$FAVICON_URL\",
    \"primaryColor\": \"$PRIMARY_COLOR\",
    \"secondaryColor\": \"$SECONDARY_COLOR\",
    \"accentColor\": \"$ACCENT_COLOR\",
    \"loginScreenBackgroundColor\": \"$LOGIN_BG_COLOR\",
    \"loginScreenAccentColor\": \"$LOGIN_ACCENT_COLOR\",
    \"loginScreenTextColor\": \"$LOGIN_TEXT_COLOR\",
    \"loginScreenHeroColor\": \"$LOGIN_HERO_COLOR\"
  }'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  config_data = EXCLUDED.config_data,
  updated_at = NOW();
" || error "Failed to setup branding configuration"

# Verify database setup
log "Verifying database setup..."
REGULATION_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM public.regulations;" | xargs)
USER_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM public.users;" | xargs)
BRANDING_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM public.branding_configurations;" | xargs)

log "Database setup complete!"
log "📊 Regulations: $REGULATION_COUNT"
log "👥 Users: $USER_COUNT"
log "🎨 Branding configurations: $BRANDING_COUNT"

# Display default credentials
log "🔐 Default credentials:"
log "   Admin: admin/admin"
log "   Support: support/support"
log "   Email: $ADMIN_EMAIL"
warn "⚠️  Please change default passwords immediately after deployment!"

# Generate database summary
cat << EOF > "/tmp/database-summary-${CUSTOMER_NAME}.txt"
Database Setup Summary for ${CUSTOMER_NAME}
============================================

Database URL: ${DATABASE_URL}
Database Type: ${DATABASE_TYPE}

Data Import Results:
- Regulations: ${REGULATION_COUNT}
- Users: ${USER_COUNT}
- Branding Configurations: ${BRANDING_COUNT}

Default Credentials:
- Admin: admin/admin (Email: ${ADMIN_EMAIL})
- Support: support/support (Email: ${SUPPORT_EMAIL})

⚠️  IMPORTANT: Change default passwords immediately after deployment!

Setup completed at: $(date)
EOF

log "Database summary saved to: /tmp/database-summary-${CUSTOMER_NAME}.txt" 