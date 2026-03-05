#!/bin/zsh

# Complete Isolation Test Script
# Tests isolation between beta.edsteward.ai, moravian.edsteward.ai, and admin.edsteward.ai

echo "🔍 Testing Complete Isolation - All Three Environments"
echo "======================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test URLs
BETA_URL="https://beta.edsteward.ai"
MORAVIAN_URL="https://moravian.edsteward.ai"
ADMIN_URL="https://admin.edsteward.ai"

echo -e "${BLUE}Testing URLs:${NC}"
echo "  Beta: $BETA_URL"
echo "  Moravian: $MORAVIAN_URL"
echo "  Admin: $ADMIN_URL"
echo ""

# Test 1: Health Check - Basic Connectivity
echo -e "${YELLOW}1. Health Check - Basic Connectivity${NC}"
echo "------------------------------------"

echo "🔍 Beta Health:"
curl -s "$BETA_URL/health" -m 5 || echo "FAILED"

echo "🔍 Moravian Health:"
curl -s "$MORAVIAN_URL/health" -m 5 || echo "FAILED"

echo "🔍 Admin Health:"
curl -s "$ADMIN_URL/health" -m 5 || echo "FAILED"

echo ""

# Test 2: Infrastructure Isolation
echo -e "${YELLOW}2. Infrastructure Isolation${NC}"
echo "-----------------------------"

echo "🔍 Beta Infrastructure:"
echo "  ECS Cluster: $(aws ecs describe-services --cluster edsteward-beta-cluster --services edsteward-beta-service --query 'services[0].clusterArn' --output text 2>/dev/null | cut -d'/' -f2 || echo 'ERROR')"
echo "  ECS Service: $(aws ecs describe-services --cluster edsteward-beta-cluster --services edsteward-beta-service --query 'services[0].serviceName' --output text 2>/dev/null || echo 'ERROR')"
echo "  Target Group: edsteward-beta-tg"

echo "🔍 Moravian Infrastructure:"
echo "  ECS Cluster: $(aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].clusterArn' --output text 2>/dev/null | cut -d'/' -f2 || echo 'ERROR')"
echo "  ECS Service: $(aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].serviceName' --output text 2>/dev/null || echo 'ERROR')"
echo "  Target Group: edsteward-tg"

echo "🔍 Admin Infrastructure:"
echo "  ECS Cluster: $(aws ecs describe-services --cluster edsteward-admin-cluster --services edsteward-admin-service --query 'services[0].clusterArn' --output text 2>/dev/null | cut -d'/' -f2 || echo 'ERROR')"
echo "  ECS Service: $(aws ecs describe-services --cluster edsteward-admin-cluster --services edsteward-admin-service --query 'services[0].serviceName' --output text 2>/dev/null || echo 'ERROR')"
echo "  Target Group: edsteward-admin-tg"

echo ""

# Test 3: Database Isolation
echo -e "${YELLOW}3. Database Isolation${NC}"
echo "---------------------"

echo "🔍 Beta Database:"
aws ecs describe-task-definition --task-definition edsteward-beta:12 --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' --output text 2>/dev/null | head -c 80 || echo "ERROR"
echo "..."

echo "🔍 Moravian Database:"
aws ecs describe-task-definition --task-definition edsteward-fixed:16 --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' --output text 2>/dev/null | head -c 80 || echo "ERROR"
echo "..."

echo "🔍 Admin Database:"
aws ecs describe-task-definition --task-definition edsteward-admin:1 --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' --output text 2>/dev/null | head -c 80 || echo "ERROR"
echo "..."

echo ""

# Test 4: Environment Variables Isolation
echo -e "${YELLOW}4. Environment Variables Isolation${NC}"
echo "-----------------------------------"

echo "🔍 Beta Environment:"
echo "  NODE_ENV: $(aws ecs describe-task-definition --task-definition edsteward-beta:12 --query 'taskDefinition.containerDefinitions[0].environment[?name==`NODE_ENV`].value' --output text 2>/dev/null || echo 'ERROR')"
echo "  INSTITUTION_NAME: $(aws ecs describe-task-definition --task-definition edsteward-beta:12 --query 'taskDefinition.containerDefinitions[0].environment[?name==`INSTITUTION_NAME`].value' --output text 2>/dev/null || echo 'ERROR')"
echo "  ADMIN_MODE: $(aws ecs describe-task-definition --task-definition edsteward-beta:12 --query 'taskDefinition.containerDefinitions[0].environment[?name==`ADMIN_MODE`].value' --output text 2>/dev/null || echo 'Not Set')"

echo "🔍 Moravian Environment:"
echo "  NODE_ENV: $(aws ecs describe-task-definition --task-definition edsteward-fixed:16 --query 'taskDefinition.containerDefinitions[0].environment[?name==`NODE_ENV`].value' --output text 2>/dev/null || echo 'ERROR')"
echo "  INSTITUTION_NAME: $(aws ecs describe-task-definition --task-definition edsteward-fixed:16 --query 'taskDefinition.containerDefinitions[0].environment[?name==`INSTITUTION_NAME`].value' --output text 2>/dev/null || echo 'ERROR')"
echo "  ADMIN_MODE: $(aws ecs describe-task-definition --task-definition edsteward-fixed:16 --query 'taskDefinition.containerDefinitions[0].environment[?name==`ADMIN_MODE`].value' --output text 2>/dev/null || echo 'Not Set')"

echo "🔍 Admin Environment:"
echo "  NODE_ENV: $(aws ecs describe-task-definition --task-definition edsteward-admin:1 --query 'taskDefinition.containerDefinitions[0].environment[?name==`NODE_ENV`].value' --output text 2>/dev/null || echo 'ERROR')"
echo "  INSTITUTION_NAME: $(aws ecs describe-task-definition --task-definition edsteward-admin:1 --query 'taskDefinition.containerDefinitions[0].environment[?name==`INSTITUTION_NAME`].value' --output text 2>/dev/null || echo 'ERROR')"
echo "  ADMIN_MODE: $(aws ecs describe-task-definition --task-definition edsteward-admin:1 --query 'taskDefinition.containerDefinitions[0].environment[?name==`ADMIN_MODE`].value' --output text 2>/dev/null || echo 'Not Set')"

echo ""

# Test 5: DNS Resolution Isolation
echo -e "${YELLOW}5. DNS Resolution Isolation${NC}"
echo "----------------------------"

echo "🔍 Beta DNS Resolution:"
nslookup beta.edsteward.ai 2>/dev/null | grep -A2 "Non-authoritative answer:" || echo "DNS ERROR"

echo "🔍 Moravian DNS Resolution:"
nslookup moravian.edsteward.ai 2>/dev/null | grep -A2 "Non-authoritative answer:" || echo "DNS ERROR"

echo "🔍 Admin DNS Resolution:"
nslookup admin.edsteward.ai 2>/dev/null | grep -A2 "Non-authoritative answer:" || echo "DNS ERROR"

echo ""

# Test 6: Target Group Health
echo -e "${YELLOW}6. Target Group Health${NC}"
echo "------------------------"

echo "🔍 Beta Target Group Health:"
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-beta-tg/a98245c58c034ed0 --query 'TargetHealthDescriptions[0].TargetHealth.State' --output text 2>/dev/null || echo "ERROR"

echo "🔍 Moravian Target Group Health:"
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-tg/78b4d3e8ad3c5d1e --query 'TargetHealthDescriptions[0].TargetHealth.State' --output text 2>/dev/null || echo "Different/Unknown"

echo "🔍 Admin Target Group Health:"
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-admin-tg/70957bb3a91d8b16 --query 'TargetHealthDescriptions[0].TargetHealth.State' --output text 2>/dev/null || echo "ERROR"

echo ""

# Test 7: Branding API Test
echo -e "${YELLOW}7. Branding API Test${NC}"
echo "-------------------"

echo "🔍 Beta Branding:"
curl -s "$BETA_URL/api/branding" -m 5 | jq -r '.branding.institutionName' 2>/dev/null || echo "API ERROR"

echo "🔍 Moravian Branding:"
curl -s "$MORAVIAN_URL/api/branding" -m 5 | jq -r '.branding.institutionName' 2>/dev/null || echo "API ERROR"

echo "🔍 Admin Branding:"
curl -s "$ADMIN_URL/api/branding" -m 5 | jq -r '.branding.institutionName' 2>/dev/null || echo "API ERROR"

echo ""

# Test 8: Running Task Count
echo -e "${YELLOW}8. Running Task Count${NC}"
echo "---------------------"

echo "🔍 Beta Running Tasks:"
aws ecs describe-services --cluster edsteward-beta-cluster --services edsteward-beta-service --query 'services[0].runningCount' --output text 2>/dev/null || echo "ERROR"

echo "🔍 Moravian Running Tasks:"
aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].runningCount' --output text 2>/dev/null || echo "ERROR"

echo "🔍 Admin Running Tasks:"
aws ecs describe-services --cluster edsteward-admin-cluster --services edsteward-admin-service --query 'services[0].runningCount' --output text 2>/dev/null || echo "ERROR"

echo ""

# Summary
echo -e "${GREEN}✅ Complete Isolation Test Finished!${NC}"
echo "===================================="
echo ""
echo -e "${BLUE}Expected Results for Perfect Isolation:${NC}"
echo "  ✓ All health checks return 'OK'"
echo "  ✓ Three different ECS clusters: beta, main, admin"
echo "  ✓ Three different ECS services with different names"
echo "  ✓ Three different target groups"
echo "  ✓ Different database URLs (beta has different host)"
echo "  ✓ Different institution names:"
echo "    - Beta: 'Beta Test Company'"
echo "    - Moravian: 'Moravian University'"
echo "    - Admin: 'EdSteward Admin Console'"
echo "  ✓ Admin has ADMIN_MODE=true, others don't"
echo "  ✓ All DNS records resolve to same ALB but different routing"
echo "  ✓ All target groups are healthy"
echo "  ✓ All services have 1 running task"
echo ""
echo -e "${YELLOW}If any results are unexpected, isolation may need adjustment.${NC}" 