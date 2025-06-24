#!/bin/zsh

echo "🔍 Diagnosing GitHub Actions Workflow Failures..."
echo "=================================================="
echo ""

# Check if npm test passes locally
echo "1️⃣ Testing if npm test passes locally..."
if npm test -- --passWithNoTests > /dev/null 2>&1; then
    echo "✅ npm test passes locally"
else
    echo "❌ npm test fails locally - this could be the issue"
    echo "   Running npm test to see the error:"
    npm test -- --passWithNoTests
fi

echo ""

# Check if npm build passes locally  
echo "2️⃣ Testing if npm build passes locally..."
if npm run build > /dev/null 2>&1; then
    echo "✅ npm run build passes locally"
else
    echo "❌ npm run build fails locally - this could be the issue"
    echo "   Running npm run build to see the error:"
    npm run build
fi

echo ""

# Check AWS credentials are valid
echo "3️⃣ Testing AWS credentials..."
export AWS_PAGER=""
if aws sts get-caller-identity > /dev/null 2>&1; then
    echo "✅ AWS credentials work locally"
    echo "   Account: $(aws sts get-caller-identity --query 'Account' --output text)"
else
    echo "❌ AWS credentials don't work locally"
fi

echo ""

# Check Docker is available and working
echo "4️⃣ Testing Docker..."
if docker --version > /dev/null 2>&1; then
    echo "✅ Docker is available"
    if docker ps > /dev/null 2>&1; then
        echo "✅ Docker daemon is running"
    else
        echo "❌ Docker daemon is not running"
    fi
else
    echo "❌ Docker is not installed"
fi

echo ""

# Check if ECR repository is accessible
echo "5️⃣ Testing ECR access..."
if aws ecr describe-repositories --repository-names edsteward-multi-tenant --region us-east-1 > /dev/null 2>&1; then
    echo "✅ ECR repository is accessible"
else
    echo "❌ ECR repository is not accessible"
fi

echo ""
echo "🔗 Common failure causes in GitHub Actions:"
echo "   • npm ci --legacy-peer-deps fails (dependency issues)"
echo "   • npm test fails (test failures)"  
echo "   • npm run build fails (build errors)"
echo "   • AWS credentials invalid (wrong secrets)"
echo "   • ECR permissions issues"
echo "   • Docker build platform issues"
echo ""
echo "💡 Check the specific error in GitHub Actions logs at:"
echo "   https://github.com/dvdbrnds/EdSteward/actions" 