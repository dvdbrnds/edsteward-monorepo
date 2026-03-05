#!/bin/zsh

echo "🔄 EdSteward Pipeline Resync Script"
echo "=================================="
echo ""
echo "This script will help you get back on track after emergency fixes"
echo "and ensure your pipeline is properly synchronized."
echo ""

# Check prerequisites
echo "🔧 Checking Prerequisites..."
echo ""

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Error: Not in EdSteward root directory"
    echo "   Please run this script from the project root"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker not found"
    echo "   Please install Docker Desktop"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Error: Docker is not running"
    echo "   Please start Docker Desktop"
    exit 1
fi

echo "✅ Docker is available and running"

# Check Git status
echo ""
echo "📋 Checking Git Status..."
echo ""

# Show current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo "⚠️  You have uncommitted changes:"
    git status --short
    echo ""
    echo "🤔 Do you want to commit these changes first? (y/N)"
    read -r COMMIT_CHANGES
    
    if [[ "$COMMIT_CHANGES" =~ ^[Yy]$ ]]; then
        echo "💾 Committing changes..."
        git add .
        git commit -m "Pipeline resync: commit pending changes"
        echo "✅ Changes committed"
    else
        echo "⚠️  Proceeding with uncommitted changes"
    fi
fi

# Test the new testing system
echo ""
echo "🧪 Testing New Test System..."
echo ""

# Run the improved tests
echo "Running improved test suite..."
if npm test; then
    echo "✅ New test system working correctly"
else
    echo "❌ Tests failed - please review and fix issues"
    exit 1
fi

# Test local development environment
echo ""
echo "🚀 Testing Local Development Environment..."
echo ""

echo "Starting development environment..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for it to be ready
echo "Waiting for application to start..."
sleep 10

# Test health endpoint
if curl -f -s http://localhost:3000/health > /dev/null; then
    echo "✅ Local development environment is working"
else
    echo "⚠️  Local development environment may need more time to start"
    echo "   You can check with: docker-compose -f docker-compose.dev.yml logs -f app"
fi

# Stop development environment
echo "Stopping development environment..."
docker-compose -f docker-compose.dev.yml down

# Check AWS deployment status
echo ""
echo "🔍 Checking AWS Deployment Status..."
echo ""

# Get latest workflow runs
if command -v gh &> /dev/null; then
    echo "Latest workflow runs:"
    gh run list --limit 3
    echo ""
    echo "🔗 Check deployment status: ./scripts/check-production-status.sh"
else
    echo "💡 Install GitHub CLI to check workflow status: brew install gh"
    echo "🔗 Check manually: ./scripts/check-production-status.sh"
fi

# Sync recommendations
echo ""
echo "🎯 Recommended Next Steps:"
echo "========================="
echo ""
echo "1. 🧪 Test your current feature in local staging:"
echo "   make -f Makefile.local staging"
echo ""
echo "2. 🚀 Deploy to dev environment for integration testing:"
echo "   git push origin dev"
echo ""
echo "3. 🎭 Deploy to staging for final verification:"
echo "   git push origin ES-clientside"
echo ""
echo "4. 📦 Deploy to production when ready:"
echo "   git checkout main && git merge ES-clientside && ./scripts/deploy-production.sh"
echo ""
echo "5. 📚 Follow the new workflow documentation:"
echo "   See: DEVELOPMENT_WORKFLOW_IMPROVED.md"
echo ""

# Environment URLs
echo "🌐 Environment URLs:"
echo "==================="
echo "• Local Dev: http://localhost:3000"
echo "• Dev Environment: https://dev.edsteward.ai"  
echo "• Staging: https://staging.edsteward.ai"
echo "• Production: https://moravian.edsteward.ai"
echo ""

# Success message
echo "🎉 Pipeline Resync Complete!"
echo ""
echo "Your development workflow is now back on track with:"
echo "✅ Improved testing system"
echo "✅ API endpoint validation"
echo "✅ Authentication consistency checks"
echo "✅ Emergency procedure documentation"
echo ""
echo "💡 Remember: Always test locally before deploying to AWS!"
echo "🛡️  The new workflow prevents authentication crises like before." 