#!/bin/zsh

echo "🔍 Verifying AWS Setup for GitHub Actions..."

# Check AWS credentials
echo "📋 Checking AWS credentials..."
if aws sts get-caller-identity > /dev/null 2>&1; then
    echo "✅ AWS credentials are configured"
    aws sts get-caller-identity --query 'Account' --output text | xargs -I {} echo "📊 AWS Account: {}"
else
    echo "❌ AWS credentials not configured or invalid"
    echo "💡 Run: aws configure"
    exit 1
fi

# Check ECR access
echo "📋 Checking ECR repository access..."
ECR_REPO="259661441422.dkr.ecr.us-east-1.amazonaws.com/edsteward-multi-tenant"

if aws ecr describe-repositories --repository-names edsteward-multi-tenant --region us-east-1 > /dev/null 2>&1; then
    echo "✅ ECR repository accessible: $ECR_REPO"
else
    echo "❌ ECR repository not accessible"
    exit 1
fi

# Check ECS clusters
echo "📋 Checking ECS clusters..."
export AWS_PAGER=""
for cluster in "edsteward-multi-tenant-staging-cluster" "edsteward-cluster"; do
    if aws ecs describe-clusters --clusters $cluster --region us-east-1 --query 'clusters[0].status' --output text 2>/dev/null | grep -q "ACTIVE"; then
        echo "✅ ECS cluster active: $cluster"
    else
        echo "❌ ECS cluster not found or inactive: $cluster"
    fi
done

echo ""
echo "🔑 For GitHub Actions, you need to add these secrets:"
echo "AWS_ACCESS_KEY_ID: $(aws configure get aws_access_key_id)"
echo "AWS_SECRET_ACCESS_KEY: [Your secret access key]"

echo ""
echo "🔗 Add secrets at: https://github.com/dvdbrnds/RegulatoryTrackr/settings/secrets/actions" 