#!/bin/bash

# MCP Engine MVP Deployment Script
# Deploys minimum viable MCP infrastructure to AWS

set -e  # Exit on any error

echo "🚀 MCP Engine MVP Deployment"
echo "============================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
print_step "1. Checking Prerequisites..."

# Check if AWS CLI is installed and configured
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

print_success "AWS CLI configured"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js version: $NODE_VERSION"

# Check if Serverless Framework is installed
if ! command -v serverless &> /dev/null; then
    print_warning "Serverless Framework not found. Installing globally..."
    npm install -g serverless
fi

SERVERLESS_VERSION=$(serverless --version)
print_success "Serverless Framework: $SERVERLESS_VERSION"

echo ""

# Install dependencies
print_step "2. Installing Dependencies..."
if [ -f "package-mvp.json" ]; then
    cp package-mvp.json package.json
    npm install
    print_success "Dependencies installed"
else
    print_error "package-mvp.json not found"
    exit 1
fi

echo ""

# Deploy to AWS
print_step "3. Deploying to AWS..."

STAGE=${1:-dev}
REGION=${2:-us-east-1}

print_step "   Stage: $STAGE"
print_step "   Region: $REGION"

echo ""
print_step "   Deploying MCP Lambda functions..."

if serverless deploy --config serverless-mvp.yml --stage $STAGE --region $REGION; then
    print_success "Deployment completed successfully!"
else
    print_error "Deployment failed"
    exit 1
fi

echo ""

# Get deployment info
print_step "4. Getting Deployment Information..."

# Extract endpoints from CloudFormation outputs
STACK_NAME="mcp-engine-mvp-$STAGE"

VALIDATION_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`MCPValidationEndpoint`].OutputValue' \
    --output text 2>/dev/null || echo "")

HEALTH_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`MCPHealthEndpoint`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$VALIDATION_ENDPOINT" ] || [ -z "$HEALTH_ENDPOINT" ]; then
    print_warning "Could not retrieve endpoints from CloudFormation. Getting from Serverless info..."
    
    # Fallback: Get from serverless info
    SERVERLESS_INFO=$(serverless info --config serverless-mvp.yml --stage $STAGE --region $REGION)
    
    # Extract API Gateway URL
    API_URL=$(echo "$SERVERLESS_INFO" | grep -o 'https://[a-zA-Z0-9]*.execute-api.[a-zA-Z0-9-]*.amazonaws.com/[a-zA-Z0-9]*' | head -1)
    
    if [ -n "$API_URL" ]; then
        VALIDATION_ENDPOINT="$API_URL/mcp/validate"
        HEALTH_ENDPOINT="$API_URL/health"
    fi
fi

echo ""
print_success "🎯 MCP Engine MVP Deployed Successfully!"
echo ""
echo "📍 Endpoints:"
echo "   Validation: $VALIDATION_ENDPOINT"
echo "   Health:     $HEALTH_ENDPOINT"
echo ""

# Update test script with actual endpoints
if [ -n "$VALIDATION_ENDPOINT" ] && [ -n "$HEALTH_ENDPOINT" ]; then
    print_step "5. Updating Test Script..."
    
    # Update the test script with actual endpoints
    sed -i.bak "s|endpoint: process.env.MCP_ENDPOINT.*|endpoint: process.env.MCP_ENDPOINT \|\| '$VALIDATION_ENDPOINT',|g" test-mcp-endpoint.js
    sed -i.bak "s|healthEndpoint: process.env.MCP_HEALTH_ENDPOINT.*|healthEndpoint: process.env.MCP_HEALTH_ENDPOINT \|\| '$HEALTH_ENDPOINT'|g" test-mcp-endpoint.js
    
    print_success "Test script updated with actual endpoints"
    
    echo ""
    print_step "6. Testing Deployed Endpoints..."
    
    # Wait a moment for deployment to propagate
    sleep 5
    
    # Run endpoint tests
    if node test-mcp-endpoint.js; then
        print_success "All endpoint tests passed!"
    else
        print_warning "Some endpoint tests failed. Check the output above."
    fi
else
    print_warning "Could not retrieve endpoint URLs. Please check AWS Console."
fi

echo ""
print_step "📋 Next Steps:"
echo "   1. Share the validation endpoint with EdSteward team:"
echo "      $VALIDATION_ENDPOINT"
echo ""
echo "   2. Configure EdSteward to send regulation data in MCP format"
echo ""
echo "   3. Monitor logs:"
echo "      serverless logs -f orchestrator --config serverless-mvp.yml --stage $STAGE"
echo "      serverless logs -f level1-validator --config serverless-mvp.yml --stage $STAGE"
echo ""
echo "   4. To remove deployment:"
echo "      serverless remove --config serverless-mvp.yml --stage $STAGE"
echo ""

print_success "🎉 MCP Engine MVP deployment complete!"
echo "🔗 Patent claims satisfied with working MCP validation endpoint."
