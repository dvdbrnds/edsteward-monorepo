#!/bin/zsh

# ============================================================================
# EdSteward Uptime Monitoring Setup
# ============================================================================
# Creates CloudWatch alarms for endpoint health monitoring.
# Uses Route53 Health Checks (simpler than Synthetics, no Lambda needed).
#
# Usage: ./scripts/setup-uptime-monitoring.sh
#
# This creates:
#   1. Route53 health checks for production + staging
#   2. CloudWatch alarms that fire when health checks fail
#   3. SNS topic for alert notifications
# ============================================================================

set -e

AWS_REGION="${AWS_REGION:-us-east-1}"
ALERT_EMAIL="${ALERT_EMAIL:-david@edsteward.ai}"
SNS_TOPIC_NAME="edsteward-uptime-alerts"

echo "🔍 Setting up EdSteward uptime monitoring..."

# 1. Create SNS topic for alerts (idempotent)
echo "📧 Creating SNS alert topic..."
SNS_TOPIC_ARN=$(aws sns create-topic \
    --name "$SNS_TOPIC_NAME" \
    --region "$AWS_REGION" \
    --query 'TopicArn' --output text)

echo "   Topic: $SNS_TOPIC_ARN"

# Subscribe email (will send confirmation email — only needed once)
aws sns subscribe \
    --topic-arn "$SNS_TOPIC_ARN" \
    --protocol email \
    --notification-endpoint "$ALERT_EMAIL" \
    --region "$AWS_REGION" > /dev/null 2>&1 || true

echo "   Subscribed: $ALERT_EMAIL (check inbox for confirmation)"

# 2. Create Route53 health checks
# Health checks must be created in us-east-1 for Route53
create_health_check() {
    local name="$1"
    local fqdn="$2"
    local path="$3"
    local search_string="$4"

    echo "🏥 Creating health check for $fqdn$path..."

    # Check if it already exists
    EXISTING=$(aws route53 list-health-checks \
        --query "HealthChecks[?HealthCheckConfig.FullyQualifiedDomainName=='${fqdn}' && HealthCheckConfig.ResourcePath=='${path}'].Id" \
        --output text 2>/dev/null)

    if [[ -n "$EXISTING" && "$EXISTING" != "None" ]]; then
        echo "   Already exists: $EXISTING"
        echo "$EXISTING"
        return
    fi

    HC_ID=$(aws route53 create-health-check \
        --caller-reference "${name}-$(date +%s)" \
        --health-check-config "{
            \"FullyQualifiedDomainName\": \"${fqdn}\",
            \"Port\": 443,
            \"Type\": \"HTTPS_STR_MATCH\",
            \"ResourcePath\": \"${path}\",
            \"SearchString\": \"${search_string}\",
            \"RequestInterval\": 30,
            \"FailureThreshold\": 3,
            \"EnableSNI\": true
        }" \
        --query 'HealthCheck.Id' --output text)

    # Tag the health check
    aws route53 change-tags-for-resource \
        --resource-type healthcheck \
        --resource-id "$HC_ID" \
        --add-tags "Key=Name,Value=${name}" > /dev/null

    echo "   Created: $HC_ID"
    echo "$HC_ID"
}

PROD_HC_ID=$(create_health_check \
    "edsteward-production" \
    "moravian.edsteward.ai" \
    "/health" \
    "OK")

STAGING_HC_ID=$(create_health_check \
    "edsteward-staging" \
    "staging.edsteward.ai" \
    "/health" \
    "OK")

# 3. Create CloudWatch alarms for health checks
# Route53 health check metrics are always in us-east-1
create_alarm() {
    local name="$1"
    local hc_id="$2"
    local env_label="$3"

    echo "🚨 Creating CloudWatch alarm: $name..."

    aws cloudwatch put-metric-alarm \
        --alarm-name "$name" \
        --alarm-description "EdSteward ${env_label} is DOWN - health check failing" \
        --namespace "AWS/Route53" \
        --metric-name "HealthCheckStatus" \
        --dimensions "Name=HealthCheckId,Value=${hc_id}" \
        --comparison-operator LessThanThreshold \
        --threshold 1 \
        --evaluation-periods 2 \
        --period 60 \
        --statistic Minimum \
        --treat-missing-data breaching \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --ok-actions "$SNS_TOPIC_ARN" \
        --region us-east-1

    echo "   ✅ Alarm created"
}

create_alarm "edsteward-production-down" "$PROD_HC_ID" "Production (moravian.edsteward.ai)"
create_alarm "edsteward-staging-down" "$STAGING_HC_ID" "Staging (staging.edsteward.ai)"

echo ""
echo "✅ Uptime monitoring setup complete!"
echo ""
echo "Summary:"
echo "  - Production health check: $PROD_HC_ID"
echo "  - Staging health check: $STAGING_HC_ID"
echo "  - Alert email: $ALERT_EMAIL"
echo "  - SNS topic: $SNS_TOPIC_ARN"
echo ""
echo "⚠️  Check your email ($ALERT_EMAIL) and confirm the SNS subscription."
echo "    View in AWS Console: https://console.aws.amazon.com/route53/healthchecks"
