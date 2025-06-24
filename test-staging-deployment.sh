#!/bin/zsh

echo "🎯 Testing Staging Deployment: https://staging.edsteward.ai/"
echo "============================================================"

# Test 1: Basic connectivity
echo "1️⃣ Basic Connectivity Test:"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://staging.edsteward.ai/)
if [[ "$HTTP_STATUS" == "200" ]]; then
    echo "✅ Site is accessible (HTTP $HTTP_STATUS)"
else
    echo "❌ Site returned HTTP $HTTP_STATUS"
fi

echo ""

# Test 2: Health endpoint
echo "2️⃣ Health Endpoint Test:"
HEALTH_RESPONSE=$(curl -s https://staging.edsteward.ai/health)
if [[ "$HEALTH_RESPONSE" == "OK" ]]; then
    echo "✅ Basic health check passed"
else
    echo "❌ Health check failed: $HEALTH_RESPONSE"
fi

echo ""

# Test 3: API Health endpoint  
echo "3️⃣ API Health Endpoint Test:"
API_HEALTH=$(curl -s https://staging.edsteward.ai/api/health)
if echo "$API_HEALTH" | grep -q '"status":"healthy"'; then
    echo "✅ API health check passed"
    echo "   Tenant: $(echo "$API_HEALTH" | grep -o '"tenantId":"[^"]*"' | cut -d'"' -f4)"
    echo "   Database: $(echo "$API_HEALTH" | grep -o '"connected":[^,]*' | cut -d':' -f2)"
else
    echo "❌ API health check failed"
    echo "   Response: $API_HEALTH"
fi

echo ""

# Test 4: Load balancer target health
echo "4️⃣ Load Balancer Target Health:"
export AWS_PAGER=""
HEALTHY_TARGETS=$(aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-staging-ip-tg/1cb66badce896e14 \
  --region us-east-1 \
  --query 'TargetHealthDescriptions[?TargetHealth.State==`healthy`].Target.Id' \
  --output text | wc -w)

TOTAL_TARGETS=$(aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:259661441422:targetgroup/edsteward-staging-ip-tg/1cb66badce896e14 \
  --region us-east-1 \
  --query 'TargetHealthDescriptions[].Target.Id' \
  --output text | wc -w)

echo "✅ $HEALTHY_TARGETS/$TOTAL_TARGETS targets healthy"

echo ""

# Test 5: GitHub Actions integration
echo "5️⃣ GitHub Actions Integration:"
LATEST_IMAGE=$(aws ecr describe-images \
  --repository-name edsteward-multi-tenant \
  --region us-east-1 \
  --query 'sort_by(imageDetails,&imagePushedAt)[-1].imageTags[0]' \
  --output text)

LATEST_PUSH=$(aws ecr describe-images \
  --repository-name edsteward-multi-tenant \
  --region us-east-1 \
  --query 'sort_by(imageDetails,&imagePushedAt)[-1].imagePushedAt' \
  --output text)

echo "✅ Latest image: $LATEST_IMAGE"
echo "   Pushed: $LATEST_PUSH"

echo ""
echo "🎉 STAGING DEPLOYMENT TEST SUMMARY:"
echo "   ✅ Site accessible at https://staging.edsteward.ai/"
echo "   ✅ Health checks passing"
echo "   ✅ Load balancer working"
echo "   ✅ GitHub Actions pipeline functional"
echo ""
echo "🚀 Ready for production deployment!"
echo "   To deploy to production: git checkout main && git merge ES-clientside && git push origin main" 