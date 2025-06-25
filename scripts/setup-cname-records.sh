#!/bin/zsh

# EdSteward CNAME Setup Script
# Automates DNS configuration for multi-tenant deployment

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

# Get ALB DNS name
get_alb_dns_name() {
    local alb_name="edsteward-alb"
    
    # Try multiple ALB name patterns
    local alb_dns=$(aws elbv2 describe-load-balancers \
        --names "$alb_name" \
        --query 'LoadBalancers[0].DNSName' \
        --output text --region "$AWS_REGION" 2>/dev/null | cat)
    
    if [ "$alb_dns" = "None" ] || [ -z "$alb_dns" ]; then
        # Try with multi-tenant prefix
        alb_dns=$(aws elbv2 describe-load-balancers \
            --query 'LoadBalancers[?contains(LoadBalancerName, `edsteward`)].DNSName' \
            --output text --region "$AWS_REGION" 2>/dev/null | head -1)
    fi
    
    echo "$alb_dns"
}

# Get hosted zone ID
get_hosted_zone_id() {
    if [ -n "$HOSTED_ZONE_ID" ]; then
        echo "$HOSTED_ZONE_ID"
        return
    fi
    
    local zone_id=$(aws route53 list-hosted-zones \
        --query "HostedZones[?Name=='${BASE_DOMAIN}.'].Id" \
        --output text --region "$AWS_REGION" 2>/dev/null | head -1)
    
    # Remove the /hostedzone/ prefix if present
    echo "${zone_id#/hostedzone/}"
}

# Create CNAME record
create_cname_record() {
    local subdomain="$1"
    local target="$2"
    local zone_id="$3"
    
    log "Creating CNAME record: ${subdomain}.${BASE_DOMAIN} → ${target}"
    
    local change_batch=$(cat <<EOF
{
    "Comment": "EdSteward CNAME record for ${subdomain}",
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "${subdomain}.${BASE_DOMAIN}",
            "Type": "CNAME",
            "TTL": 300,
            "ResourceRecords": [{"Value": "${target}"}]
        }
    }]
}
EOF
)
    
    local change_id=$(aws route53 change-resource-record-sets \
        --hosted-zone-id "$zone_id" \
        --change-batch "$change_batch" \
        --query 'ChangeInfo.Id' \
        --output text --region "$AWS_REGION")
    
    if [ $? -eq 0 ]; then
        success "CNAME record created: ${subdomain}.${BASE_DOMAIN}"
        echo "Change ID: ${change_id}"
    else
        error "Failed to create CNAME record for ${subdomain}.${BASE_DOMAIN}"
    fi
}

# Main execution
main() {
    echo -e "${GREEN}=== EdSteward CNAME Setup ===${NC}"
    
    # Get ALB DNS name
    log "Finding ALB DNS name..."
    ALB_DNS=$(get_alb_dns_name)
    
    if [ -z "$ALB_DNS" ] || [ "$ALB_DNS" = "None" ]; then
        error "Could not find ALB DNS name. Please check your ALB configuration."
    fi
    
    success "Found ALB: $ALB_DNS"
    
    # Get hosted zone ID
    log "Finding Route53 hosted zone..."
    ZONE_ID=$(get_hosted_zone_id)
    
    if [ -z "$ZONE_ID" ]; then
        error "Could not find hosted zone for $BASE_DOMAIN"
    fi
    
    success "Found hosted zone: $ZONE_ID"
    
    # Create CNAME records for all environments
    log "Creating CNAME records for all EdSteward environments..."
    
    # Production environments
    create_cname_record "staging" "$ALB_DNS" "$ZONE_ID"
    create_cname_record "moravian" "$ALB_DNS" "$ZONE_ID"
    
    # Development environment
    create_cname_record "dev" "$ALB_DNS" "$ZONE_ID"
    
    # Admin environment
    create_cname_record "admin" "$ALB_DNS" "$ZONE_ID"
    
    echo ""
    success "All CNAME records created successfully!"
    
    echo -e "${BLUE}📋 DNS Configuration Summary:${NC}"
    echo "  • staging.edsteward.ai → $ALB_DNS"
    echo "  • moravian.edsteward.ai → $ALB_DNS"
    echo "  • dev.edsteward.ai → $ALB_DNS"
    echo "  • admin.edsteward.ai → $ALB_DNS"
    
    echo ""
    echo -e "${BLUE}💡 Benefits:${NC}"
    echo "  ✓ Zero downtime deployment"
    echo "  ✓ Easy environment management"
    echo "  ✓ Flexible ALB changes without DNS updates"
    echo "  ✓ Improved disaster recovery"
    
    echo ""
    echo -e "${BLUE}🔧 Next Steps:${NC}"
    echo "  1. Test all domains: curl -I https://staging.edsteward.ai/health"
    echo "  2. Monitor DNS propagation: dig staging.edsteward.ai"
    echo "  3. Your GitHub Actions pipeline remains unchanged"
}

# Show usage if no arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h    Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  AWS_REGION         AWS region (default: us-east-1)"
    echo "  HOSTED_ZONE_ID     Route53 hosted zone ID (auto-detected if not set)"
    echo ""
    echo "This script creates CNAME records for all EdSteward environments:"
    echo "  • staging.edsteward.ai"
    echo "  • moravian.edsteward.ai"
    echo "  • dev.edsteward.ai"
    echo "  • admin.edsteward.ai"
    exit 0
fi

# Run main function
main "$@" 