#!/bin/zsh

# EdSteward New Tenant Setup Script
# Usage: ./scripts/add-new-tenant.sh <tenant-id> <tenant-name> <tenant-domain>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
BASE_DOMAIN="edsteward.ai"
HOSTED_ZONE_ID="Z0186546264I8JDBHPSR7"
ALB_DNS="edsteward-alb-554701445.us-east-1.elb.amazonaws.com"

# Functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

usage() {
    echo "Usage: $0 <tenant-id> <tenant-name> <tenant-domain>"
    echo ""
    echo "Arguments:"
    echo "  tenant-id      Unique identifier for tenant (e.g., 'university-xyz')"
    echo "  tenant-name    Display name for tenant (e.g., 'University XYZ')"
    echo "  tenant-domain  Primary domain for tenant (e.g., 'university-xyz.edu')"
    echo ""
    echo "Examples:"
    echo "  $0 university-abc 'University ABC' 'university-abc.edu'"
    echo "  $0 college-xyz 'College XYZ' 'college-xyz.edu'"
    echo "  $0 school-district-123 'School District 123' 'sd123.k12.state.us'"
    echo ""
    echo "This will create:"
    echo "  • CNAME: {tenant-id}.edsteward.ai → ALB"
    echo "  • Tenant configuration in database"
    echo "  • SAML endpoints ready for configuration"
    exit 1
}

# Validate tenant ID format
validate_tenant_id() {
    local tenant_id="$1"
    
    if [[ ! "$tenant_id" =~ ^[a-z0-9-]+$ ]]; then
        error "Tenant ID must contain only lowercase letters, numbers, and hyphens"
    fi
    
    if [[ ${#tenant_id} -lt 3 ]]; then
        error "Tenant ID must be at least 3 characters long"
    fi
    
    if [[ ${#tenant_id} -gt 50 ]]; then
        error "Tenant ID must be less than 50 characters long"
    fi
}

# Check if tenant already exists
check_tenant_exists() {
    local tenant_id="$1"
    
    log "Checking if tenant already exists..."
    
    # Check DNS record
    local existing_record=$(dig ${tenant_id}.${BASE_DOMAIN} CNAME +short 2>/dev/null || echo "")
    
    if [ -n "$existing_record" ]; then
        error "Tenant ${tenant_id}.${BASE_DOMAIN} already exists (DNS record found)"
    fi
    
    success "Tenant ID is available"
}

# Create CNAME record
create_cname_record() {
    local tenant_id="$1"
    
    log "Creating CNAME record for ${tenant_id}.${BASE_DOMAIN}..."
    
    local change_batch=$(cat <<EOF
{
    "Comment": "EdSteward tenant: ${tenant_id}",
    "Changes": [{
        "Action": "CREATE",
        "ResourceRecordSet": {
            "Name": "${tenant_id}.${BASE_DOMAIN}",
            "Type": "CNAME",
            "TTL": 300,
            "ResourceRecords": [{"Value": "${ALB_DNS}"}]
        }
    }]
}
EOF
)
    
    local change_id=$(aws route53 change-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID" \
        --change-batch "$change_batch" \
        --query 'ChangeInfo.Id' \
        --output text --region "$AWS_REGION")
    
    if [ $? -eq 0 ]; then
        success "CNAME record created: ${tenant_id}.${BASE_DOMAIN}"
        echo "Change ID: ${change_id}"
    else
        error "Failed to create CNAME record"
    fi
}

# Wait for DNS propagation
wait_for_dns() {
    local tenant_id="$1"
    local max_attempts=12
    local attempt=1
    
    log "Waiting for DNS propagation..."
    
    while [ $attempt -le $max_attempts ]; do
        local dns_result=$(dig ${tenant_id}.${BASE_DOMAIN} CNAME +short 2>/dev/null || echo "")
        
        if [ -n "$dns_result" ]; then
            success "DNS propagated: ${tenant_id}.${BASE_DOMAIN} → ${dns_result}"
            return 0
        fi
        
        echo -n "."
        sleep 10
        ((attempt++))
    done
    
    warning "DNS propagation taking longer than expected (may take up to 5 minutes)"
}

# Test tenant access
test_tenant_access() {
    local tenant_id="$1"
    
    log "Testing tenant access..."
    
    local response=$(curl -s -I https://${tenant_id}.${BASE_DOMAIN}/health 2>/dev/null || echo "")
    
    if echo "$response" | grep -q "HTTP/2 200"; then
        success "Tenant is accessible at https://${tenant_id}.${BASE_DOMAIN}"
        
        # Check for tenant headers
        local tenant_header=$(echo "$response" | grep -i "x-tenant-id" || echo "")
        if [ -n "$tenant_header" ]; then
            success "Tenant detection working: $tenant_header"
        else
            warning "Tenant detection may need database configuration"
        fi
    else
        warning "Tenant may not be immediately accessible (DNS still propagating)"
        echo "Test manually: curl -I https://${tenant_id}.${BASE_DOMAIN}/health"
    fi
}

# Generate tenant configuration
generate_tenant_config() {
    local tenant_id="$1"
    local tenant_name="$2"
    local tenant_domain="$3"
    
    cat <<EOF

${GREEN}=== Tenant Configuration ===${NC}

${BLUE}Database Configuration:${NC}
Run this SQL to configure the tenant in your database:

INSERT INTO tenants (
  id, name, subdomain, domain, status, settings, created_at, updated_at
) VALUES (
  '${tenant_id}',
  '${tenant_name}',
  '${tenant_id}',
  '${tenant_domain}',
  'active',
  '{
    "allowedDomains": ["${tenant_domain}"],
    "defaultRole": "user",
    "enableAutoProvisioning": true,
    "features": {
      "maxUsers": 1000,
      "maxRegulations": 5000,
      "ssoEnabled": true,
      "apiAccess": true,
      "customDomain": false
    }
  }',
  NOW(),
  NOW()
);

${BLUE}SAML Configuration:${NC}
Configure the tenant's Identity Provider with:

• Entity ID: urn:regulatorytrackr:sp:${tenant_id}
• ACS URL: https://${tenant_id}.${BASE_DOMAIN}/auth/saml/callback
• Metadata URL: https://${tenant_id}.${BASE_DOMAIN}/auth/saml/metadata

${BLUE}Access URLs:${NC}
• Tenant URL: https://${tenant_id}.${BASE_DOMAIN}
• Health Check: https://${tenant_id}.${BASE_DOMAIN}/health
• Admin Panel: https://${tenant_id}.${BASE_DOMAIN}/admin

EOF
}

# Main execution
main() {
    local tenant_id="$1"
    local tenant_name="$2"
    local tenant_domain="$3"
    
    echo -e "${GREEN}=== EdSteward New Tenant Setup ===${NC}"
    
    # Validate inputs
    if [ -z "$tenant_id" ] || [ -z "$tenant_name" ] || [ -z "$tenant_domain" ]; then
        usage
    fi
    
    # Validate tenant ID format
    validate_tenant_id "$tenant_id"
    
    # Check if tenant already exists
    check_tenant_exists "$tenant_id"
    
    # Create CNAME record
    create_cname_record "$tenant_id"
    
    # Wait for DNS propagation
    wait_for_dns "$tenant_id"
    
    # Test tenant access
    test_tenant_access "$tenant_id"
    
    # Generate configuration instructions
    generate_tenant_config "$tenant_id" "$tenant_name" "$tenant_domain"
    
    success "Tenant ${tenant_name} setup complete!"
    
    echo ""
    echo -e "${BLUE}💡 Next Steps:${NC}"
    echo "1. Run the database SQL above to configure tenant settings"
    echo "2. Configure SAML with the tenant's Identity Provider"
    echo "3. Test login at https://${tenant_id}.${BASE_DOMAIN}"
    echo "4. Monitor tenant usage and adjust settings as needed"
}

# Show usage if help requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    usage
fi

# Run main function
main "$@" 