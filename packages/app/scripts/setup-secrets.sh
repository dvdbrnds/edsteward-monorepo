#!/bin/zsh

# ============================================================================
# EdSteward AWS Secrets Manager Setup
# ============================================================================
# This script migrates hardcoded credentials to AWS Secrets Manager.
# Run this ONCE to set up secrets, then update ECS task definitions to use them.
#
# Usage: ./scripts/setup-secrets.sh [--dry-run]
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="259661441422"
DRY_RUN=false

# Parse arguments
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}DRY RUN MODE - No changes will be made${NC}"
fi

# Logging functions
log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Disable AWS pager
export AWS_PAGER=""

echo -e "${CYAN}"
echo "============================================================================"
echo "  EdSteward AWS Secrets Manager Setup"
echo "============================================================================"
echo -e "${NC}"

# Pre-flight checks
log "Running pre-flight checks..."

if ! command -v aws &> /dev/null; then
    error "AWS CLI not found. Install with: brew install awscli"
fi

if ! aws sts get-caller-identity &> /dev/null; then
    error "AWS credentials not configured. Run: aws configure"
fi

CALLER_IDENTITY=$(aws sts get-caller-identity --query 'Account' --output text)
if [[ "$CALLER_IDENTITY" != "$AWS_ACCOUNT_ID" ]]; then
    error "AWS account mismatch. Expected: $AWS_ACCOUNT_ID, Got: $CALLER_IDENTITY"
fi

success "Pre-flight checks passed"

# Function to create or update a secret
create_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local description="$3"
    
    log "Processing secret: $secret_name"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "  Would create/update: $secret_name"
        echo "  Description: $description"
        echo "  Value length: ${#secret_value} characters"
        return 0
    fi
    
    # Check if secret already exists
    if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$AWS_REGION" &> /dev/null; then
        warn "Secret $secret_name already exists, updating..."
        aws secretsmanager put-secret-value \
            --secret-id "$secret_name" \
            --secret-string "$secret_value" \
            --region "$AWS_REGION" > /dev/null
        success "Updated secret: $secret_name"
    else
        aws secretsmanager create-secret \
            --name "$secret_name" \
            --description "$description" \
            --secret-string "$secret_value" \
            --region "$AWS_REGION" > /dev/null
        success "Created secret: $secret_name"
    fi
}

# Function to prompt for secret value
prompt_secret() {
    local prompt_text="$1"
    local default_value="$2"
    local secret_value
    
    if [[ -n "$default_value" ]]; then
        echo -e "${CYAN}$prompt_text${NC}"
        echo -e "  Default (from existing scripts): ${YELLOW}[hidden - ${#default_value} chars]${NC}"
        read "?  Press Enter to use default, or enter new value: " secret_value
        if [[ -z "$secret_value" ]]; then
            echo "$default_value"
        else
            echo "$secret_value"
        fi
    else
        read "?$prompt_text: " secret_value
        echo "$secret_value"
    fi
}

echo ""
echo -e "${CYAN}=== Setting Up Staging Secrets ===${NC}"
echo ""

# Staging Database URL
log "Setting up staging database URL..."
echo -e "${YELLOW}You need a staging Neon database. Options:${NC}"
echo "  1. Create a new Neon project for staging"
echo "  2. Create a branch of your production database"
echo "  3. Use an existing staging database"
echo ""

# Check if we can detect existing staging database
EXISTING_STAGING_DB=""
if [[ -f "single-tenant-config/.env.single-tenant" ]]; then
    EXISTING_STAGING_DB=$(grep "DATABASE_URL" "single-tenant-config/.env.single-tenant" 2>/dev/null | cut -d'=' -f2 || echo "")
fi

STAGING_DB_URL=$(prompt_secret "Enter staging DATABASE_URL" "$EXISTING_STAGING_DB")
if [[ -z "$STAGING_DB_URL" ]]; then
    warn "No staging database URL provided. You'll need to set this manually later."
    STAGING_DB_URL="PLACEHOLDER_STAGING_DATABASE_URL"
fi

# Staging Session Secret
STAGING_SESSION_SECRET=$(openssl rand -base64 32)
log "Generated new staging session secret"

# Create staging secrets
create_secret "edsteward/staging/database-url" "$STAGING_DB_URL" "EdSteward Staging Database Connection URL"
create_secret "edsteward/staging/session-secret" "$STAGING_SESSION_SECRET" "EdSteward Staging Session Encryption Secret"

echo ""
echo -e "${CYAN}=== Setting Up Production Secrets ===${NC}"
echo ""

# Production Database URL (from existing scripts)
# Found in deploy-production-saml.sh and deploy-moravian-production.sh
EXISTING_PROD_DB="postgresql://neondb_owner:npg_a2BNKdZeg9FU@ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

log "Setting up production database URL..."
PROD_DB_URL=$(prompt_secret "Enter production DATABASE_URL" "$EXISTING_PROD_DB")

# Production Session Secret
EXISTING_SESSION_SECRET="production-session-secret-change-this-in-real-production"
log "Setting up production session secret..."
echo -e "${YELLOW}Current session secret appears to be a placeholder. Generating a secure one.${NC}"
PROD_SESSION_SECRET=$(openssl rand -base64 32)

# Create production secrets
create_secret "edsteward/production/database-url" "$PROD_DB_URL" "EdSteward Production Database Connection URL"
create_secret "edsteward/production/session-secret" "$PROD_SESSION_SECRET" "EdSteward Production Session Encryption Secret"

echo ""
echo -e "${CYAN}=== Setting Up SAML Secrets ===${NC}"
echo ""

# SAML Configuration (from deploy-production-saml.sh)
SAML_CONFIG=$(cat << 'SAMLEOF'
{
  "enabled": true,
  "entityId": "urn:edsteward:sp",
  "ssoUrl": "https://login.moravian.edu/app/moravian_edstewardbeta_1/exk1c4nmsctSaNRIg0x8/sso/saml",
  "callbackUrl": "https://moravian.edsteward.ai/auth/saml/callback",
  "sloUrl": "https://moravian.edsteward.ai/auth/saml/logout"
}
SAMLEOF
)

create_secret "edsteward/production/saml-config" "$SAML_CONFIG" "EdSteward Production SAML/SSO Configuration"

# Read SAML certificate if it exists
if [[ -f "certs/okta-cert.pem" ]]; then
    log "Found SAML certificate, storing in Secrets Manager..."
    SAML_CERT=$(cat "certs/okta-cert.pem")
    create_secret "edsteward/production/saml-certificate" "$SAML_CERT" "EdSteward Production SAML Certificate (Okta)"
else
    warn "SAML certificate not found at certs/okta-cert.pem"
fi

echo ""
echo -e "${CYAN}=== Summary ===${NC}"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}DRY RUN COMPLETE - No changes were made${NC}"
    echo ""
    echo "To actually create the secrets, run without --dry-run:"
    echo "  ./scripts/setup-secrets.sh"
else
    success "All secrets have been created/updated in AWS Secrets Manager"
    echo ""
    echo -e "${GREEN}Secrets created:${NC}"
    echo "  - edsteward/staging/database-url"
    echo "  - edsteward/staging/session-secret"
    echo "  - edsteward/production/database-url"
    echo "  - edsteward/production/session-secret"
    echo "  - edsteward/production/saml-config"
    if [[ -f "certs/okta-cert.pem" ]]; then
        echo "  - edsteward/production/saml-certificate"
    fi
fi

echo ""
echo -e "${CYAN}=== Next Steps ===${NC}"
echo ""
echo "1. Update ECS task definitions to use secrets instead of environment variables:"
echo ""
echo '   "secrets": ['
echo '     {'
echo '       "name": "DATABASE_URL",'
echo '       "valueFrom": "arn:aws:secretsmanager:'$AWS_REGION':'$AWS_ACCOUNT_ID':secret:edsteward/production/database-url"'
echo '     },'
echo '     {'
echo '       "name": "SESSION_SECRET",'
echo '       "valueFrom": "arn:aws:secretsmanager:'$AWS_REGION':'$AWS_ACCOUNT_ID':secret:edsteward/production/session-secret"'
echo '     }'
echo '   ]'
echo ""
echo "2. Ensure your ECS task execution role has permission to access Secrets Manager:"
echo ""
echo '   {
     "Effect": "Allow",
     "Action": [
       "secretsmanager:GetSecretValue"
     ],
     "Resource": [
       "arn:aws:secretsmanager:'$AWS_REGION':'$AWS_ACCOUNT_ID':secret:edsteward/*"
     ]
   }'
echo ""
echo "3. Remove hardcoded credentials from deployment scripts"
echo ""
echo -e "${GREEN}Secrets setup complete!${NC}"
