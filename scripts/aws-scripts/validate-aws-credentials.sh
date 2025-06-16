#!/bin/zsh

# Validate AWS credentials and required permissions
# Usage: ./validate-aws-credentials.sh

set -e

echo "🔍 Validating AWS credentials and permissions..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is required but not installed"
    echo "💡 Install with: brew install awscli"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS credentials not configured or invalid"
    echo "💡 Configure with: aws configure"
    exit 1
fi

# Get caller identity
CALLER_IDENTITY=$(aws sts get-caller-identity)
USER_ARN=$(echo "$CALLER_IDENTITY" | jq -r '.Arn')
ACCOUNT_ID=$(echo "$CALLER_IDENTITY" | jq -r '.Account')

echo "✅ AWS credentials valid"
echo "📋 Account ID: $ACCOUNT_ID"
echo "📋 User ARN: $USER_ARN"

# Check required AWS permissions
echo "🔍 Checking required AWS permissions..."

# Check ECR permissions
echo "  🔍 Testing ECR access..."
if aws ecr describe-repositories --region us-east-1 > /dev/null 2>&1; then
    echo "  ✅ ECR access confirmed"
else
    echo "  ❌ ECR access denied"
    exit 1
fi

# Check ECS permissions
echo "  🔍 Testing ECS access..."
if aws ecs list-clusters --region us-east-1 > /dev/null 2>&1; then
    echo "  ✅ ECS access confirmed"
else
    echo "  ❌ ECS access denied"
    exit 1
fi

# Check if the target cluster exists
echo "  🔍 Checking target ECS cluster..."
if aws ecs describe-clusters --clusters edsteward-cluster --region us-east-1 > /dev/null 2>&1; then
    echo "  ✅ Target cluster 'edsteward-cluster' found"
else
    echo "  ❌ Target cluster 'edsteward-cluster' not found"
    exit 1
fi

# Check if the target service exists
echo "  🔍 Checking target ECS service..."
if aws ecs describe-services --cluster edsteward-cluster --services edsteward-service --region us-east-1 > /dev/null 2>&1; then
    echo "  ✅ Target service 'edsteward-service' found"
else
    echo "  ❌ Target service 'edsteward-service' not found"
    exit 1
fi

# Check ECR repository
echo "  🔍 Checking ECR repository..."
if aws ecr describe-repositories --repository-names edsteward-repo --region us-east-1 > /dev/null 2>&1; then
    echo "  ✅ ECR repository 'edsteward-repo' found"
else
    echo "  ❌ ECR repository 'edsteward-repo' not found"
    exit 1
fi

echo "✅ All AWS credentials and permissions validated successfully" 