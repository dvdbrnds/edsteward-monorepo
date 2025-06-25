#!/bin/zsh

# EdSteward Health Check Script
# Monitors all environments and provides status overview

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🏥 EdSteward Health Check${NC}"
echo "========================"
echo ""

# Environments to check
environments=(
  "staging.edsteward.ai"
  "moravian.edsteward.ai" 
  "admin.edsteward.ai"
)

# Track overall health
all_healthy=true

for env in "${environments[@]}"; do
  echo -n "Testing $env... "
  
  # Get HTTP status code and response time
  response=$(curl -s -o /dev/null -w "%{http_code}:%{time_total}" https://$env/health 2>/dev/null || echo "000:0.000")
  http_code=$(echo $response | cut -d: -f1)
  response_time=$(echo $response | cut -d: -f2)
  
  if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ Healthy${NC} (${response_time}s)"
  elif [ "$http_code" = "503" ]; then
    echo -e "${YELLOW}⚠️  Service Unavailable${NC} (${http_code})"
    all_healthy=false
  elif [ "$http_code" = "000" ]; then
    echo -e "${RED}❌ Connection Failed${NC}"
    all_healthy=false
  else
    echo -e "${RED}❌ Failed${NC} (${http_code})"
    all_healthy=false
  fi
done

echo ""

# Check DNS propagation for CNAME records
echo -e "${BLUE}🌐 DNS Health Check${NC}"
echo "==================="

dns_environments=(
  "staging.edsteward.ai"
  "moravian.edsteward.ai"
  "admin.edsteward.ai"
  "dev.edsteward.ai"
)

for env in "${dns_environments[@]}"; do
  echo -n "DNS for $env... "
  
  dns_result=$(dig $env CNAME +short 2>/dev/null || echo "")
  
  if [[ "$dns_result" == *"edsteward-alb"* ]]; then
    echo -e "${GREEN}✅ CNAME OK${NC}"
  elif [ -n "$dns_result" ]; then
    echo -e "${YELLOW}⚠️  Unexpected: $dns_result${NC}"
  else
    echo -e "${RED}❌ No CNAME${NC}"
  fi
done

echo ""

# Overall status
if [ "$all_healthy" = true ]; then
  echo -e "${GREEN}🎉 Overall Status: All systems healthy!${NC}"
else
  echo -e "${YELLOW}⚠️  Overall Status: Some issues detected${NC}"
fi

echo ""
echo -e "${BLUE}🔗 Useful Links:${NC}"
echo "• GitHub Actions: https://github.com/dvdbrnds/EdSteward/actions"
echo "• AWS ECS Console: https://console.aws.amazon.com/ecs/home?region=us-east-1"
echo "• CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups"

echo ""
echo -e "${BLUE}🔧 Quick Commands:${NC}"
echo "• Deploy to staging: git push origin ES-clientside"
echo "• Deploy to production: git push origin main"
echo "• Add new tenant: ./scripts/add-new-tenant.sh <id> '<name>' '<domain>'"
echo "• Force ECS restart: aws ecs update-service --cluster <cluster> --service <service> --force-new-deployment --region us-east-1" 