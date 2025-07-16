#!/bin/zsh

# EdSteward Docker Development Environment Manager
# Use this script to manage your Docker development environment

case "${1:-up}" in
  "up"|"start")
    echo "🚀 Starting Docker development environment..."
    docker-compose -f docker-compose.dev.yml up
    ;;
  "down"|"stop")
    echo "🛑 Stopping Docker development environment..."
    docker-compose -f docker-compose.dev.yml down
    ;;
  "build")
    echo "🔨 Building Docker development environment..."
    docker-compose -f docker-compose.dev.yml build --no-cache
    ;;
  "restart")
    echo "🔄 Restarting Docker development environment..."
    docker-compose -f docker-compose.dev.yml restart
    ;;
  "logs")
    echo "📋 Showing Docker development logs..."
    docker-compose -f docker-compose.dev.yml logs -f app
    ;;
  "shell")
    echo "🐚 Opening shell in Docker container..."
    docker-compose -f docker-compose.dev.yml exec app /bin/bash
    ;;
  "status")
    echo "📊 Docker development environment status:"
    docker-compose -f docker-compose.dev.yml ps
    echo ""
    echo "🔗 Application URLs:"
    echo "  • Main App: http://localhost:3000"
    echo "  • Docker Desktop: Available in Docker Desktop app"
    ;;
  "clean")
    echo "🧹 Cleaning up Docker development environment..."
    echo "⚠️  This will remove containers, volumes, and prune system. Continue? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
      docker-compose -f docker-compose.dev.yml down --volumes --remove-orphans
      docker system prune -f
      echo "✅ Docker environment cleaned successfully"
    else
      echo "❌ Clean operation cancelled"
    fi
    ;;
  "verify")
    echo "🔍 Verifying Docker development environment..."
    echo ""
    echo "📋 Checking prerequisites:"
    
    # Check Docker
    if command -v docker &> /dev/null; then
      echo "✅ Docker: $(docker --version)"
    else
      echo "❌ Docker: Not installed"
    fi
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
      echo "✅ Docker Compose: $(docker-compose --version)"
    else
      echo "❌ Docker Compose: Not installed"
    fi
    
    # Check Docker running
    if docker info &> /dev/null; then
      echo "✅ Docker daemon: Running"
    else
      echo "❌ Docker daemon: Not running"
    fi
    
    # Check files
    if [[ -f "docker-compose.dev.yml" ]]; then
      echo "✅ docker-compose.dev.yml: Found"
    else
      echo "❌ docker-compose.dev.yml: Missing"
    fi
    
    if [[ -f "Dockerfile.dev" ]]; then
      echo "✅ Dockerfile.dev: Found"
    else
      echo "❌ Dockerfile.dev: Missing"
    fi
    
    echo ""
    echo "📊 Container status:"
    docker-compose -f docker-compose.dev.yml ps
    ;;
  "update")
    echo "🔄 Updating Docker development environment..."
    echo "This will rebuild containers with latest changes..."
    docker-compose -f docker-compose.dev.yml down
    docker-compose -f docker-compose.dev.yml build --no-cache
    docker-compose -f docker-compose.dev.yml up -d
    echo "✅ Environment updated successfully"
    ;;
  "help"|"--help"|"-h")
    echo "🐳 EdSteward Docker Development Environment Manager"
    echo ""
    echo "Usage: $0 {command}"
    echo ""
    echo "📋 Available commands:"
    echo "  up/start   - Start Docker development environment"
    echo "  down/stop  - Stop Docker development environment" 
    echo "  build      - Rebuild Docker containers"
    echo "  restart    - Restart containers"
    echo "  logs       - View container logs"
    echo "  shell      - Access container shell for debugging"
    echo "  status     - Check container status and URLs"
    echo "  clean      - Clean Docker system (removes containers)"
    echo "  verify     - Verify Docker environment setup"
    echo "  update     - Update environment with latest changes"
    echo "  help       - Show this help message"
    echo ""
    echo "🔗 Quick URLs:"
    echo "  • Application: http://localhost:3000"
    echo "  • Documentation: ./DOCKER_DEVELOPMENT_GUIDE.md"
    echo ""
    echo "⚠️  Important: NEVER use 'npm run dev' on macOS!"
    echo "✅  Always use Docker development environment"
    ;;
  *)
    echo "❌ Unknown command: $1"
    echo ""
    echo "🐳 EdSteward Docker Development Environment Manager"
    echo "Use './dev.sh help' for usage information"
    echo ""
    echo "Quick start: ./dev.sh up"
    exit 1
    ;;
esac 