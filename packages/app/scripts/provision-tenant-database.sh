#!/bin/zsh

# EdSteward: Provision New Tenant Database on Neon
# Usage: ./scripts/provision-tenant-database.sh <tenant-id> [source-tenant]
#
# This script:
# 1. Creates a new Neon database branch (or uses existing project)
# 2. Copies shared data (regulations, task templates) from source tenant
# 3. Clears tenant-specific data (users, attestations, etc.)
# 4. Creates a default admin user
# 5. Outputs the new DATABASE_URL for configuration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Configuration
NEON_API_KEY="${NEON_API_KEY:-}"
NEON_PROJECT_ID="${NEON_PROJECT_ID:-}"
SOURCE_TENANT="${2:-moravian}"  # Default source is moravian

# Get the source database URL
get_source_db_url() {
    local tenant="$1"
    case "$tenant" in
        moravian) echo "${MORAVIAN_DATABASE_URL}" ;;
        staging) echo "${STAGING_DATABASE_URL}" ;;
        test) echo "${TEST_DATABASE_URL}" ;;
        *) echo "${DATABASE_URL}" ;;
    esac
}

# Tables that contain SHARED data (copy these)
SHARED_TABLES=(
    "regulations"
    "regulation_updates"
    "regulation_versions"
    "validation_status"
    "sync_control"
    "version_conflicts"
    "guides"
    "deadlines"
)

# Tables that are TENANT-SPECIFIC (clear these, keep schema)
TENANT_TABLES=(
    "users"
    "notes"
    "note_history"
    "evidence_files"
    "notifications"
    "notification_queue"
    "email_configs"
    "twilio_configs"
    "audit_logs"
    "attestation_tokens"
    "compliance_tasks"
    "task_evidence"
    "task_activity"
    "system_logs"
    "error_records"
    "transformation_logs"
    "csv_schemas"
    "field_mappings"
    "validation_rules"
)

usage() {
    cat << EOF
Usage: $0 <tenant-id> [source-tenant]

Arguments:
  tenant-id      Unique identifier for new tenant (e.g., 'muhlenberg', 'lehigh')
  source-tenant  Source tenant to copy shared data from (default: moravian)

Environment Variables Required:
  NEON_API_KEY           Your Neon API key (from console.neon.tech)
  NEON_PROJECT_ID        Your Neon project ID
  MORAVIAN_DATABASE_URL  Source database URL (or appropriate tenant URL)

Examples:
  # Create muhlenberg tenant from moravian data
  $0 muhlenberg moravian
  
  # Create lehigh tenant from staging data
  $0 lehigh staging
  
  # Create dev environment
  $0 dev moravian

This will:
  1. Create a new Neon database branch for the tenant
  2. Copy all regulations and task templates from source
  3. Clear all tenant-specific data (users, attestations, etc.)
  4. Create a default admin user
  5. Output the new DATABASE_URL

EOF
    exit 1
}

# Validate inputs
validate_inputs() {
    local tenant_id="$1"
    
    if [[ -z "$tenant_id" ]]; then
        error "Tenant ID is required"
    fi
    
    if [[ ! "$tenant_id" =~ ^[a-z0-9-]+$ ]]; then
        error "Tenant ID must contain only lowercase letters, numbers, and hyphens"
    fi
    
    if [[ -z "$NEON_API_KEY" ]]; then
        error "NEON_API_KEY environment variable is required"
    fi
    
    if [[ -z "$NEON_PROJECT_ID" ]]; then
        error "NEON_PROJECT_ID environment variable is required"
    fi
    
    local source_url=$(get_source_db_url "$SOURCE_TENANT")
    if [[ -z "$source_url" ]]; then
        error "Source database URL not found for tenant: $SOURCE_TENANT"
    fi
}

# Create Neon database branch
create_neon_branch() {
    local tenant_id="$1"
    
    log "Creating Neon database branch for tenant: $tenant_id"
    
    # Create branch via Neon API
    local response=$(curl -s -X POST \
        "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches" \
        -H "Authorization: Bearer ${NEON_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"branch\": {
                \"name\": \"tenant-${tenant_id}\",
                \"parent_id\": \"main\"
            },
            \"endpoints\": [{
                \"type\": \"read_write\"
            }]
        }")
    
    # Extract the connection string
    local branch_id=$(echo "$response" | jq -r '.branch.id // empty')
    
    if [[ -z "$branch_id" ]]; then
        # Check if branch already exists
        warning "Branch creation response: $response"
        warning "Branch may already exist. Trying to get existing branch..."
        
        # Get existing branches
        local branches=$(curl -s \
            "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches" \
            -H "Authorization: Bearer ${NEON_API_KEY}")
        
        branch_id=$(echo "$branches" | jq -r ".branches[] | select(.name == \"tenant-${tenant_id}\") | .id")
        
        if [[ -z "$branch_id" ]]; then
            error "Failed to create or find branch for tenant: $tenant_id"
        fi
    fi
    
    success "Branch created/found: $branch_id"
    
    # Get the endpoint for this branch
    local endpoints=$(curl -s \
        "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/endpoints" \
        -H "Authorization: Bearer ${NEON_API_KEY}")
    
    local endpoint_host=$(echo "$endpoints" | jq -r ".endpoints[] | select(.branch_id == \"$branch_id\") | .host")
    
    if [[ -z "$endpoint_host" ]]; then
        error "Could not find endpoint for branch: $branch_id"
    fi
    
    # Construct DATABASE_URL (you'll need to get password from Neon console)
    echo "postgresql://neondb_owner:PASSWORD@${endpoint_host}/neondb?sslmode=require"
}

# Copy shared data from source to target
copy_shared_data() {
    local source_url="$1"
    local target_url="$2"
    
    log "Copying shared data from source to target..."
    
    for table in "${SHARED_TABLES[@]}"; do
        log "  Copying table: $table"
        
        # Export from source
        psql "$source_url" -c "\copy $table TO '/tmp/edsteward_${table}.csv' WITH CSV HEADER" 2>/dev/null || {
            warning "  Table $table may not exist or is empty in source"
            continue
        }
        
        # Import to target (truncate first to avoid conflicts)
        psql "$target_url" -c "TRUNCATE TABLE $table CASCADE" 2>/dev/null || true
        psql "$target_url" -c "\copy $table FROM '/tmp/edsteward_${table}.csv' WITH CSV HEADER" 2>/dev/null || {
            warning "  Failed to import table $table"
        }
        
        # Clean up
        rm -f "/tmp/edsteward_${table}.csv"
    done
    
    success "Shared data copied successfully"
}

# Clear tenant-specific data
clear_tenant_data() {
    local target_url="$1"
    
    log "Clearing tenant-specific data..."
    
    for table in "${TENANT_TABLES[@]}"; do
        log "  Clearing table: $table"
        psql "$target_url" -c "TRUNCATE TABLE $table CASCADE" 2>/dev/null || {
            warning "  Table $table may not exist"
        }
    done
    
    success "Tenant-specific data cleared"
}

# Create default admin user
create_default_admin() {
    local target_url="$1"
    local tenant_id="$2"
    
    log "Creating default admin user..."
    
    # Generate a secure random password
    local temp_password=$(openssl rand -base64 12)
    
    # Hash the password (using Node.js since that's what the app uses)
    local hashed_password=$(node -e "
        const crypto = require('crypto');
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.scryptSync('${temp_password}', salt, 64).toString('hex');
        console.log(salt + ':' + hash);
    ")
    
    psql "$target_url" << EOF
INSERT INTO users (
    username, 
    password, 
    role, 
    email, 
    "firstName", 
    "lastName",
    created_at,
    updated_at
) VALUES (
    'admin',
    '${hashed_password}',
    'admin',
    'admin@${tenant_id}.edsteward.ai',
    'Admin',
    'User',
    NOW(),
    NOW()
) ON CONFLICT (username) DO NOTHING;
EOF
    
    success "Default admin user created"
    echo ""
    echo -e "${YELLOW}=== IMPORTANT ===${NC}"
    echo -e "Default admin credentials:"
    echo -e "  Username: admin"
    echo -e "  Password: ${temp_password}"
    echo -e "${YELLOW}Change this password immediately after first login!${NC}"
    echo ""
}

# Copy compliance task templates (not assignments)
copy_task_templates() {
    local source_url="$1"
    local target_url="$2"
    
    log "Copying compliance task templates..."
    
    # Export task templates (parent tasks without assignments)
    psql "$source_url" -c "\copy (
        SELECT * FROM compliance_tasks 
        WHERE parent_task_id IS NULL 
        AND (assigned_to IS NULL OR assigned_to = 0)
    ) TO '/tmp/edsteward_task_templates.csv' WITH CSV HEADER" 2>/dev/null || {
        warning "No task templates found in source"
        return
    }
    
    # Import templates
    psql "$target_url" -c "\copy compliance_tasks FROM '/tmp/edsteward_task_templates.csv' WITH CSV HEADER" 2>/dev/null || {
        warning "Failed to import task templates"
    }
    
    rm -f "/tmp/edsteward_task_templates.csv"
    
    success "Task templates copied"
}

# Main execution
main() {
    local tenant_id="$1"
    
    echo -e "${GREEN}=== EdSteward Tenant Database Provisioning ===${NC}"
    echo ""
    
    if [[ "$tenant_id" == "--help" ]] || [[ "$tenant_id" == "-h" ]] || [[ -z "$tenant_id" ]]; then
        usage
    fi
    
    validate_inputs "$tenant_id"
    
    local source_url=$(get_source_db_url "$SOURCE_TENANT")
    
    log "Tenant ID: $tenant_id"
    log "Source tenant: $SOURCE_TENANT"
    
    # Step 1: Create Neon branch
    echo ""
    local new_db_url=$(create_neon_branch "$tenant_id")
    
    echo ""
    echo -e "${YELLOW}=== ACTION REQUIRED ===${NC}"
    echo "1. Go to console.neon.tech"
    echo "2. Find branch: tenant-${tenant_id}"
    echo "3. Get the connection string (with password)"
    echo "4. Set it as: ${tenant_id^^}_DATABASE_URL"
    echo ""
    read -p "Enter the full DATABASE_URL for the new tenant: " new_db_url
    
    if [[ -z "$new_db_url" ]]; then
        error "DATABASE_URL is required to continue"
    fi
    
    # Step 2: Run migrations to ensure schema exists
    log "Ensuring database schema exists..."
    cd "$(dirname "$0")/.."
    DATABASE_URL="$new_db_url" npm run db:push 2>/dev/null || {
        warning "db:push may have had issues, continuing..."
    }
    
    # Step 3: Copy shared data
    echo ""
    copy_shared_data "$source_url" "$new_db_url"
    
    # Step 4: Copy task templates
    copy_task_templates "$source_url" "$new_db_url"
    
    # Step 5: Clear tenant-specific data (in case branch had any)
    clear_tenant_data "$new_db_url"
    
    # Step 6: Create default admin
    create_default_admin "$new_db_url" "$tenant_id"
    
    # Final summary
    echo ""
    echo -e "${GREEN}=== Tenant Provisioning Complete ===${NC}"
    echo ""
    echo "Tenant: $tenant_id"
    echo "Database URL: $new_db_url"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "1. Add to your .env or environment:"
    echo "   ${tenant_id^^}_DATABASE_URL=\"$new_db_url\""
    echo ""
    echo "2. Update server/services/multi-tenant-database.ts:"
    echo "   Add '${tenant_id}' to TENANT_DATABASE_CONFIGS"
    echo ""
    echo "3. Run add-new-tenant.sh to create DNS:"
    echo "   ./scripts/add-new-tenant.sh ${tenant_id} '${tenant_id^} University' '${tenant_id}.edu'"
    echo ""
    echo "4. Deploy the updated configuration"
    echo ""
    
    success "Done!"
}

main "$@"

