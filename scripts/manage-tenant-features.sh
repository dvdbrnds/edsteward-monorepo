#!/bin/zsh

# EdSteward Tenant Feature Management Script
# Manage feature flags across multiple tenants

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DATABASE_URL=${DATABASE_URL:-"postgresql://user:pass@localhost:5432/edsteward"}

# Helper functions
log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Show usage
show_usage() {
    cat <<EOF
${GREEN}EdSteward Tenant Feature Management${NC}

Usage: $0 <command> [options]

Commands:
  list-tenants                     List all tenants
  list-features <tenant-id>        List features for a tenant
  enable-feature <tenant-id> <feature-key>    Enable feature for tenant
  disable-feature <tenant-id> <feature-key>   Disable feature for tenant
  bulk-enable <feature-key>        Enable feature for ALL tenants
  bulk-disable <feature-key>       Disable feature for ALL tenants
  rollout <feature-key> <tenant-ids>  Enable feature for specific tenants

Examples:
  $0 list-tenants
  $0 list-features moravian
  $0 enable-feature moravian premium_analytics
  $0 bulk-enable new_dashboard
  $0 rollout beta_feature moravian,admin,test

EOF
}

# Database query helper
run_query() {
    local query="$1"
    psql "$DATABASE_URL" -t -c "$query" 2>/dev/null || error "Database query failed"
}

# List all tenants
list_tenants() {
    log "Listing all tenants..."
    
    local query="SELECT id, name, status FROM tenants ORDER BY id;"
    echo -e "${BLUE}ID${NC}\t${BLUE}Name${NC}\t${BLUE}Status${NC}"
    echo "----------------------------------------"
    
    run_query "$query" | while IFS='|' read -r id name status; do
        id=$(echo "$id" | xargs)
        name=$(echo "$name" | xargs)
        status=$(echo "$status" | xargs)
        
        if [ "$status" = "active" ]; then
            echo -e "${GREEN}$id${NC}\t$name\t✅ $status"
        else
            echo -e "${YELLOW}$id${NC}\t$name\t⚠️ $status"
        fi
    done
}

# List features for a tenant
list_features() {
    local tenant_id="$1"
    
    if [ -z "$tenant_id" ]; then
        error "Tenant ID required"
    fi
    
    log "Listing features for tenant: $tenant_id"
    
    local query="SELECT settings->'featureFlags' FROM tenants WHERE id = '$tenant_id';"
    local features=$(run_query "$query" | xargs)
    
    if [ "$features" = "" ] || [ "$features" = "null" ]; then
        warning "No custom feature flags set for tenant $tenant_id (using defaults)"
    else
        echo -e "${BLUE}Feature Flags for $tenant_id:${NC}"
        echo "$features" | jq -r 'to_entries[] | "\(.key): \(.value)"' 2>/dev/null || echo "$features"
    fi
}

# Enable feature for a tenant
enable_feature() {
    local tenant_id="$1"
    local feature_key="$2"
    
    if [ -z "$tenant_id" ] || [ -z "$feature_key" ]; then
        error "Tenant ID and feature key required"
    fi
    
    log "Enabling feature '$feature_key' for tenant '$tenant_id'..."
    
    local query="UPDATE tenants 
                 SET settings = jsonb_set(
                   COALESCE(settings, '{}'), 
                   '{featureFlags,$feature_key}', 
                   'true'
                 ),
                 updated_at = NOW()
                 WHERE id = '$tenant_id';"
    
    run_query "$query"
    success "Feature '$feature_key' enabled for tenant '$tenant_id'"
}

# Disable feature for a tenant
disable_feature() {
    local tenant_id="$1"
    local feature_key="$2"
    
    if [ -z "$tenant_id" ] || [ -z "$feature_key" ]; then
        error "Tenant ID and feature key required"
    fi
    
    log "Disabling feature '$feature_key' for tenant '$tenant_id'..."
    
    local query="UPDATE tenants 
                 SET settings = jsonb_set(
                   COALESCE(settings, '{}'), 
                   '{featureFlags,$feature_key}', 
                   'false'
                 ),
                 updated_at = NOW()
                 WHERE id = '$tenant_id';"
    
    run_query "$query"
    success "Feature '$feature_key' disabled for tenant '$tenant_id'"
}

# Bulk enable feature for all tenants
bulk_enable() {
    local feature_key="$1"
    
    if [ -z "$feature_key" ]; then
        error "Feature key required"
    fi
    
    warning "This will enable '$feature_key' for ALL tenants. Continue? (y/N)"
    read -r confirm
    
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        log "Operation cancelled"
        exit 0
    fi
    
    log "Enabling feature '$feature_key' for ALL tenants..."
    
    local query="UPDATE tenants 
                 SET settings = jsonb_set(
                   COALESCE(settings, '{}'), 
                   '{featureFlags,$feature_key}', 
                   'true'
                 ),
                 updated_at = NOW()
                 WHERE status = 'active';"
    
    local count=$(run_query "$query" | grep -o 'UPDATE [0-9]*' | grep -o '[0-9]*' || echo "0")
    success "Feature '$feature_key' enabled for $count tenants"
}

# Bulk disable feature for all tenants
bulk_disable() {
    local feature_key="$1"
    
    if [ -z "$feature_key" ]; then
        error "Feature key required"
    fi
    
    warning "This will disable '$feature_key' for ALL tenants. Continue? (y/N)"
    read -r confirm
    
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        log "Operation cancelled"
        exit 0
    fi
    
    log "Disabling feature '$feature_key' for ALL tenants..."
    
    local query="UPDATE tenants 
                 SET settings = jsonb_set(
                   COALESCE(settings, '{}'), 
                   '{featureFlags,$feature_key}', 
                   'false'
                 ),
                 updated_at = NOW()
                 WHERE status = 'active';"
    
    local count=$(run_query "$query" | grep -o 'UPDATE [0-9]*' | grep -o '[0-9]*' || echo "0")
    success "Feature '$feature_key' disabled for $count tenants"
}

# Progressive rollout to specific tenants
rollout_feature() {
    local feature_key="$1"
    local tenant_list="$2"
    
    if [ -z "$feature_key" ] || [ -z "$tenant_list" ]; then
        error "Feature key and tenant list required (comma-separated)"
    fi
    
    log "Rolling out feature '$feature_key' to tenants: $tenant_list"
    
    # Convert comma-separated list to array
    IFS=',' read -ra tenants <<< "$tenant_list"
    
    for tenant_id in "${tenants[@]}"; do
        tenant_id=$(echo "$tenant_id" | xargs) # trim whitespace
        log "Enabling for tenant: $tenant_id"
        enable_feature "$tenant_id" "$feature_key"
    done
    
    success "Rollout completed for ${#tenants[@]} tenants"
}

# Main command handler
case "$1" in
    "list-tenants")
        list_tenants
        ;;
    "list-features")
        list_features "$2"
        ;;
    "enable-feature")
        enable_feature "$2" "$3"
        ;;
    "disable-feature")
        disable_feature "$2" "$3"
        ;;
    "bulk-enable")
        bulk_enable "$2"
        ;;
    "bulk-disable")
        bulk_disable "$2"
        ;;
    "rollout")
        rollout_feature "$2" "$3"
        ;;
    *)
        show_usage
        ;;
esac 