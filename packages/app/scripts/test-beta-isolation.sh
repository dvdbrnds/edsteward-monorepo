#!/bin/zsh

# Test Beta Isolation Script
# Tests complete isolation between beta.edsteward.ai and moravian.edsteward.ai

echo "🔍 Testing Beta Isolation - Complete Separation Test"
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

echo -e "${BLUE}Testing URLs:${NC}"
echo "  Beta: $BETA_URL"
echo "  Moravian: $MORAVIAN_URL"
echo ""

# Test 1: Database Connection Isolation
echo -e "${YELLOW}1. Database Connection Isolation${NC}"
echo "-----------------------------------"

echo "🔍 Beta Database URL:"
aws ecs describe-task-definition --task-definition edsteward-beta:11 --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' --output text | head -c 80
echo "..."

echo "🔍 Moravian Database URL:"
aws ecs describe-task-definition --task-definition edsteward-fixed:16 --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' --output text | head -c 80
echo "..."

echo ""

# Test 2: Branding and Institution Configuration
echo -e "${YELLOW}2. Branding & Institution Isolation${NC}"
echo "------------------------------------"

echo "🔍 Beta Branding:"
curl -s "$BETA_URL/api/branding" | jq -r '.institutionName' 2>/dev/null || echo "Failed to get branding"

echo "🔍 Moravian Branding:"
curl -s "$MORAVIAN_URL/api/branding" | jq -r '.institutionName' 2>/dev/null || echo "Failed to get branding"

echo ""

# Test 3: Meta Description Isolation
echo -e "${YELLOW}3. Meta Description Isolation${NC}"
echo "--------------------------------"

echo "🔍 Beta Meta Description:"
curl -s "$BETA_URL/" | grep -o 'meta name="description" content="[^"]*"' | head -1

echo "🔍 Moravian Meta Description:"
curl -s "$MORAVIAN_URL/" | grep -o 'meta name="description" content="[^"]*"' | head -1

echo ""

# Test 4: User Data Isolation
echo -e "${YELLOW}4. User Data Isolation${NC}"
echo "------------------------"

echo "🔍 Beta User Count:"
curl -s "$BETA_URL/api/debug" | grep -o '"userCount":[0-9]*' | head -1

echo "🔍 Moravian User Count:"
curl -s "$MORAVIAN_URL/api/debug" | grep -o '"userCount":[0-9]*' | head -1

echo ""

# Test 5: Regulation Data Isolation
echo -e "${YELLOW}5. Regulation Data Isolation${NC}"
echo "------------------------------"

echo "🔍 Beta Regulation Count:"
curl -s "$BETA_URL/api/debug" | grep -o '"regulationCount":[0-9]*' | head -1

echo "🔍 Moravian Regulation Count:"
curl -s "$MORAVIAN_URL/api/debug" | grep -o '"regulationCount":[0-9]*' | head -1

echo ""

# Test 6: Environment Variables Isolation
echo -e "${YELLOW}6. Environment Variables Isolation${NC}"
echo "------------------------------------"

echo "🔍 Beta Environment:"
echo "  NODE_ENV: $(aws ecs describe-task-definition --task-definition edsteward-beta:11 --query 'taskDefinition.containerDefinitions[0].environment[?name==`NODE_ENV`].value' --output text)"
echo "  INSTITUTION_NAME: $(aws ecs describe-task-definition --task-definition edsteward-beta:11 --query 'taskDefinition.containerDefinitions[0].environment[?name==`INSTITUTION_NAME`].value' --output text)"

echo "🔍 Moravian Environment:"
echo "  NODE_ENV: $(aws ecs describe-task-definition --task-definition edsteward-fixed:16 --query 'taskDefinition.containerDefinitions[0].environment[?name==`NODE_ENV`].value' --output text)"
echo "  INSTITUTION_NAME: $(aws ecs describe-task-definition --task-definition edsteward-fixed:16 --query 'taskDefinition.containerDefinitions[0].environment[?name==`INSTITUTION_NAME`].value' --output text)"

echo ""

# Test 7: Health Check Isolation
echo -e "${YELLOW}7. Health Check Isolation${NC}"
echo "----------------------------"

echo "🔍 Beta Health:"
curl -s "$BETA_URL/health" | head -10

echo "🔍 Moravian Health:"
curl -s "$MORAVIAN_URL/health" | head -10

echo ""

# Test 8: Infrastructure Isolation
echo -e "${YELLOW}8. Infrastructure Isolation${NC}"
echo "------------------------------"

echo "🔍 Beta Infrastructure:"
echo "  ECS Cluster: $(aws ecs describe-services --cluster edsteward-beta-cluster --services edsteward-beta-service --query 'services[0].clusterArn' --output text | cut -d'/' -f2)"
echo "  ECS Service: $(aws ecs describe-services --cluster edsteward-beta-cluster --services edsteward-beta-service --query 'services[0].serviceName' --output text)"

echo "🔍 Moravian Infrastructure:"
echo "  ECS Cluster: $(aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].clusterArn' --output text | cut -d'/' -f2)"
echo "  ECS Service: $(aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --query 'services[0].serviceName' --output text)"

echo ""

# Test 9: DNS Resolution Isolation
echo -e "${YELLOW}9. DNS Resolution Isolation${NC}"
echo "------------------------------"

echo "🔍 Beta DNS Resolution:"
nslookup beta.edsteward.ai | grep -A2 "Non-authoritative answer:"

echo "🔍 Moravian DNS Resolution:"
nslookup moravian.edsteward.ai | grep -A2 "Non-authoritative answer:"

echo ""

# Test 10: Target Group Isolation
echo -e "${YELLOW}10. Target Group Isolation${NC}"
echo "-----------------------------"

echo "🔍 Beta Target Group Health:"
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-beta-tg/a98245c58c034ed0 --query 'TargetHealthDescriptions[0].TargetHealth.State' --output text

echo "🔍 Moravian Target Group Health:"
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-tg/78b4d3e8ad3c5d1e --query 'TargetHealthDescriptions[0].TargetHealth.State' --output text 2>/dev/null || echo "Unknown (different target group)"

echo ""

# Summary
echo -e "${GREEN}✅ Isolation Test Complete!${NC}"
echo "=============================="
echo ""
echo -e "${BLUE}Expected Results for Complete Isolation:${NC}"
echo "  ✓ Different database URLs (different hosts/passwords)"
echo "  ✓ Different institution names (Beta Test Company vs Moravian University)"
echo "  ✓ Different meta descriptions"
echo "  ✓ Different user/regulation counts (separate data)"
echo "  ✓ Different environment variables"
echo "  ✓ Different ECS clusters/services"
echo "  ✓ Different DNS resolution targets"
echo "  ✓ Different target groups"
echo ""
echo -e "${YELLOW}If any test shows identical results, isolation may not be complete.${NC}" 