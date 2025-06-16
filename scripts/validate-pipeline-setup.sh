#!/bin/zsh

# Validate deployment pipeline setup
# Usage: ./validate-pipeline-setup.sh

set -e

echo "🔍 Validating deployment pipeline setup..."
echo "========================================"

ERRORS=0

# Check required files exist
echo "📋 Checking required files..."

REQUIRED_FILES=(
    "Makefile"
    "Dockerfile"
    "docker-compose.local-staging.yml"
    "package.json"
    "DEPLOYMENT_README.md"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - MISSING"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check scripts directory and permissions
echo ""
echo "📋 Checking scripts..."

REQUIRED_SCRIPTS=(
    "scripts/wait-for-health.sh"
    "scripts/test-api-endpoints.sh"
    "scripts/performance-check.sh"
    "scripts/test-auth-flow.sh"
    "scripts/validate-aws-credentials.sh"
    "scripts/push-to-ecr.sh"
    "scripts/deploy-to-ecs.sh"
    "scripts/wait-for-production.sh"
    "scripts/production-smoke-tests.sh"
    "scripts/rollback-deployment.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            echo "  ✅ $script (executable)"
        else
            echo "  ⚠️ $script (not executable)"
            chmod +x "$script"
            echo "    🔧 Made executable"
        fi
    else
        echo "  ❌ $script - MISSING"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check Docker is available
echo ""
echo "📋 Checking Docker..."

if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        echo "  ✅ Docker is running"
    else
        echo "  ❌ Docker is installed but not running"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "  ❌ Docker is not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    echo "  ✅ Docker Compose is available"
else
    echo "  ❌ Docker Compose is not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check Node.js and npm
echo ""
echo "📋 Checking Node.js environment..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "  ✅ Node.js $NODE_VERSION"
else
    echo "  ❌ Node.js is not installed"
    ERRORS=$((ERRORS + 1))
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "  ✅ npm $NPM_VERSION"
else
    echo "  ❌ npm is not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check package.json has required scripts
echo ""
echo "📋 Checking package.json scripts..."

if [ -f "package.json" ]; then
    if grep -q '"build"' package.json; then
        echo "  ✅ Build script found"
    else
        echo "  ⚠️ Build script not found in package.json"
    fi
    
    if grep -q '"start"' package.json; then
        echo "  ✅ Start script found"
    else
        echo "  ⚠️ Start script not found in package.json"
    fi
fi

# Check Makefile targets
echo ""
echo "📋 Checking Makefile targets..."

MAKEFILE_TARGETS=(
    "pipeline"
    "stage1-build"
    "stage2-local-staging"
    "stage2-approve"
    "stage3-production-deploy"
    "logs-staging"
    "stop-staging"
)

for target in "${MAKEFILE_TARGETS[@]}"; do
    if grep -q "^${target}:" Makefile; then
        echo "  ✅ $target target found"
    else
        echo "  ❌ $target target not found"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check AWS CLI (optional but recommended)
echo ""
echo "📋 Checking AWS CLI (optional)..."

if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1 | cut -d/ -f2 | cut -d' ' -f1)
    echo "  ✅ AWS CLI $AWS_VERSION"
    
    # Check if credentials are configured
    if aws sts get-caller-identity &> /dev/null; then
        echo "  ✅ AWS credentials configured"
    else
        echo "  ⚠️ AWS credentials not configured (run 'aws configure')"
    fi
else
    echo "  ⚠️ AWS CLI not installed (required for production deployment)"
fi

# Check jq (for JSON processing)
echo ""
echo "📋 Checking jq..."

if command -v jq &> /dev/null; then
    echo "  ✅ jq is available"
else
    echo "  ⚠️ jq not installed (install with 'brew install jq')"
fi

# Check curl
if command -v curl &> /dev/null; then
    echo "  ✅ curl is available"
else
    echo "  ❌ curl is not installed"
    ERRORS=$((ERRORS + 1))
fi

# Final summary
echo ""
echo "📊 Validation Summary"
echo "===================="

if [ $ERRORS -eq 0 ]; then
    echo "$(tput setaf 2)✅ All checks passed! Your deployment pipeline is ready.$(tput sgr0)"
    echo ""
    echo "🚀 To get started:"
    echo "  make pipeline    # Run complete staged deployment"
    echo "  make help        # View all available commands"
    echo ""
    echo "📖 For detailed documentation, see: DEPLOYMENT_README.md"
else
    echo "$(tput setaf 1)❌ Found $ERRORS error(s). Please fix the issues above.$(tput sgr0)"
    exit 1
fi 