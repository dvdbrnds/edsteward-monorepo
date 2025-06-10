#!/bin/bash

# Multi-Tenant Onboarding Script for RegulatoryTrackr
# Usage: ./tenant-onboarding.sh <tenant-id> <tenant-name> <subdomain> <idp-config-file>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
BASE_DOMAIN=${BASE_DOMAIN:-"edsteward.ai"}
PARAMETER_PREFIX="/regulatorytrackr/tenants"
HOSTED_ZONE_ID=${HOSTED_ZONE_ID}

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
    echo "Usage: $0 <tenant-id> <tenant-name> <subdomain> [idp-config-file]"
    echo ""
    echo "Arguments:"
    echo "  tenant-id        Unique identifier for tenant (e.g., 'acme-corp')"
    echo "  tenant-name      Display name for tenant (e.g., 'ACME Corporation')"
    echo "  subdomain        Subdomain for tenant (e.g., 'acme')"
    echo "  idp-config-file  Optional JSON file with IdP configuration"
    echo ""
    echo "Environment Variables:"
    echo "  AWS_REGION       AWS region (default: us-east-1)"
    echo "  BASE_DOMAIN      Base domain (default: edsteward.ai)"
    echo "  HOSTED_ZONE_ID   Route53 hosted zone ID (required for DNS)"
    echo ""
    echo "Example:"
    echo "  $0 acme-corp 'ACME Corporation' acme ./acme-idp-config.json"
    exit 1
}

validate_inputs() {
    if [ $# -lt 3 ]; then
        error "Missing required arguments"
        usage
    fi

    # Validate tenant ID format
    if [[ ! "$1" =~ ^[a-z0-9-]+$ ]]; then
        error "Tenant ID must contain only lowercase letters, numbers, and hyphens"
    fi

    # Validate subdomain format
    if [[ ! "$3" =~ ^[a-z0-9-]+$ ]]; then
        error "Subdomain must contain only lowercase letters, numbers, and hyphens"
    fi

    # Check if AWS CLI is configured
    if ! aws sts get-caller-identity &>/dev/null; then
        error "AWS CLI not configured. Please run 'aws configure'"
    fi
}

check_tenant_exists() {
    local tenant_id="$1"
    
    if aws ssm get-parameter --name "${PARAMETER_PREFIX}/${tenant_id}/config" &>/dev/null; then
        error "Tenant '$tenant_id' already exists"
    fi
}

get_alb_dns_name() {
    local alb_name="regulatorytrackr-alb"
    
    aws elbv2 describe-load-balancers \
        --names "$alb_name" \
        --query 'LoadBalancers[0].DNSName' \
        --output text 2>/dev/null || echo ""
}

create_default_tenant_config() {
    local tenant_id="$1"
    local tenant_name="$2"
    local subdomain="$3"
    local idp_config_file="$4"
    
    local saml_config="{}"
    
    if [ -n "$idp_config_file" ] && [ -f "$idp_config_file" ]; then
        log "Loading IdP configuration from $idp_config_file"
        saml_config=$(cat "$idp_config_file")
    else
        warning "No IdP configuration file provided. SAML will need to be configured manually."
        saml_config='{
            "entityId": "",
            "ssoUrl": "",
            "sloUrl": "",
            "certificate": "",
            "attributeMapping": {
                "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
                "firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
                "lastName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
                "groups": "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"
            }
        }'
    fi
    
    cat <<EOF
{
    "id": "$tenant_id",
    "name": "$tenant_name",
    "subdomain": "$subdomain",
    "domain": "$subdomain.$BASE_DOMAIN",
    "samlConfig": $saml_config,
    "settings": {
        "allowedDomains": [],
        "defaultRole": "user",
        "enableAutoProvisioning": true,
        "region": "$AWS_REGION",
        "timeZone": "UTC"
    },
    "status": "active",
    "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
}

create_tenant_parameter() {
    local tenant_id="$1"
    local config="$2"
    
    log "Creating tenant configuration in Parameter Store..."
    
    aws ssm put-parameter \
        --name "${PARAMETER_PREFIX}/${tenant_id}/config" \
        --value "$config" \
        --type "String" \
        --description "Configuration for tenant: $tenant_id" \
        --region "$AWS_REGION"
    
    success "Tenant configuration created in Parameter Store"
}

create_dns_record() {
    local subdomain="$1"
    local alb_dns_name="$2"
    
    if [ -z "$HOSTED_ZONE_ID" ]; then
        warning "HOSTED_ZONE_ID not set. Skipping DNS record creation."
        echo "To create DNS record manually:"
        echo "  Domain: $subdomain.$BASE_DOMAIN"
        echo "  Type: CNAME"
        echo "  Value: $alb_dns_name"
        return
    fi
    
    if [ -z "$alb_dns_name" ]; then
        warning "Could not find ALB DNS name. Skipping DNS record creation."
        return
    fi
    
    log "Creating DNS record for $subdomain.$BASE_DOMAIN..."
    
    local change_batch=$(cat <<EOF
{
    "Changes": [{
        "Action": "CREATE",
        "ResourceRecordSet": {
            "Name": "$subdomain.$BASE_DOMAIN",
            "Type": "CNAME",
            "TTL": 300,
            "ResourceRecords": [{"Value": "$alb_dns_name"}]
        }
    }]
}
EOF
)
    
    aws route53 change-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID" \
        --change-batch "$change_batch" \
        --region "$AWS_REGION" &>/dev/null
    
    success "DNS record created for $subdomain.$BASE_DOMAIN"
}

create_database_tenant_entry() {
    local tenant_id="$1"
    local tenant_name="$2"
    local subdomain="$3"
    
    log "Creating database entry for tenant..."
    
    # This would typically connect to your database and insert tenant record
    # For now, we'll just log what should be done
    cat <<EOF

Database Setup Required:
========================
Please run the following SQL to create the tenant entry:

INSERT INTO tenants (id, name, subdomain, domain, status, created_at, updated_at)
VALUES (
    '$tenant_id',
    '$tenant_name',
    '$subdomain',
    '$subdomain.$BASE_DOMAIN',
    'active',
    NOW(),
    NOW()
);

EOF
}

generate_onboarding_summary() {
    local tenant_id="$1"
    local tenant_name="$2"
    local subdomain="$3"
    local idp_config_file="$4"
    
    cat <<EOF

${GREEN}=== Tenant Onboarding Complete ===${NC}

Tenant Details:
  ID: $tenant_id
  Name: $tenant_name
  Subdomain: $subdomain
  URL: https://$subdomain.$BASE_DOMAIN

Next Steps:
1. Configure Identity Provider (IdP):
   - Entity ID: urn:regulatorytrackr:sp:$tenant_id
   - ACS URL: https://$subdomain.$BASE_DOMAIN/auth/saml/callback
   - Metadata URL: https://$subdomain.$BASE_DOMAIN/auth/saml/metadata

2. Update tenant configuration if needed:
   aws ssm put-parameter \\
     --name "${PARAMETER_PREFIX}/${tenant_id}/config" \\
     --value '{}' \\
     --overwrite

3. Test authentication:
   - Visit: https://$subdomain.$BASE_DOMAIN
   - Click "SSO Login"
   - Authenticate with configured IdP

4. Monitor logs:
   aws logs tail /aws/ecs/regulatorytrackr --follow

Configuration stored in: ${PARAMETER_PREFIX}/${tenant_id}/config

EOF
}

# Main execution
main() {
    local tenant_id="$1"
    local tenant_name="$2"
    local subdomain="$3"
    local idp_config_file="$4"
    
    log "Starting tenant onboarding for '$tenant_name' ($tenant_id)..."
    
    # Validate inputs
    validate_inputs "$@"
    
    # Check if tenant already exists
    check_tenant_exists "$tenant_id"
    
    # Get ALB DNS name for CNAME record
    local alb_dns_name=$(get_alb_dns_name)
    if [ -n "$alb_dns_name" ]; then
        log "Found ALB DNS name: $alb_dns_name"
    fi
    
    # Create tenant configuration
    local tenant_config=$(create_default_tenant_config "$tenant_id" "$tenant_name" "$subdomain" "$idp_config_file")
    
    # Store configuration in Parameter Store
    create_tenant_parameter "$tenant_id" "$tenant_config"
    
    # Create DNS record
    create_dns_record "$subdomain" "$alb_dns_name"
    
    # Show database setup instructions
    create_database_tenant_entry "$tenant_id" "$tenant_name" "$subdomain"
    
    # Generate summary
    generate_onboarding_summary "$tenant_id" "$tenant_name" "$subdomain" "$idp_config_file"
    
    success "Tenant onboarding completed successfully!"
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 