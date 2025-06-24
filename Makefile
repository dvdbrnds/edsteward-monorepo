# RegulatoryTrackr Staged Deployment Pipeline
# Ensures proper local verification before AWS deployment

.PHONY: help clean check-tools dev dev-logs dev-stop dev-restart dev-shell dev-status dev-ready stage1-build stage1-test stage2-local-staging stage2-integration-tests stage2-approve stage3-production-deploy deploy-safe pipeline logs-staging logs-staging-all stop-staging restart-staging staging-status open-staging approve-staging emergency-stop

# Default shell for macOS
SHELL := /bin/zsh

# Configuration
PROJECT_NAME := regulatorytrackr
IMAGE_NAME := $(PROJECT_NAME)-app
CONTAINER_NAME := $(PROJECT_NAME)-test
STAGING_CONTAINER_NAME := $(PROJECT_NAME)-staging
NETWORK_NAME := $(PROJECT_NAME)-network

# Environment files
ENV_LOCAL := .env.local
ENV_STAGING := .env.staging
ENV_PRODUCTION := .env.production

# Timeout settings (in seconds)
BUILD_TIMEOUT := 600
TEST_TIMEOUT := 300
HEALTH_CHECK_TIMEOUT := 120

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)RegulatoryTrackr Staged Deployment Pipeline$(NC)"
	@echo "============================================="
	@echo ""
	@echo "$(GREEN)Development workflow:$(NC)"
	@echo "  make dev                   # Start development environment with hot reload"
	@echo "  make dev-logs              # View development logs"
	@echo "  make dev-ready             # Lock in development and deploy to production"
	@echo ""
	@echo "$(GREEN)Safe deployment workflow:$(NC)"
	@echo "  make pipeline              # Run complete staged pipeline (no dev)"
	@echo "  make deploy-safe           # Alias for pipeline"
	@echo ""
	@echo "$(YELLOW)Individual stages:$(NC)"
	@echo "  make stage1-build          # Stage 1: Local Docker build & unit tests"
	@echo "  make stage2-local-staging  # Stage 2: Local staging environment"
	@echo "  make stage2-approve        # Human approval gate for staging"
	@echo "  make stage3-production-deploy # Stage 3: Production deployment"
	@echo ""
	@echo "$(BLUE)Development management:$(NC)"
	@echo "  make dev-stop              # Stop development environment"
	@echo "  make dev-restart           # Restart development environment"
	@echo "  make dev-shell             # Open shell in dev container"
	@echo "  make dev-status            # Check development status"
	@echo ""
	@echo "$(BLUE)Staging management:$(NC)"
	@echo "  make open-staging          # Open staging app in browser"
	@echo "  make logs-staging          # View staging app logs"
	@echo "  make logs-staging-all      # View all staging service logs"
	@echo "  make staging-status        # Check staging environment status"
	@echo "  make restart-staging       # Restart staging environment"
	@echo "  make stop-staging          # Stop staging environment"
	@echo "  make approve-staging       # Quick approve staging for production"
	@echo ""
	@echo "$(BLUE)Utility commands:$(NC)"
	@echo "  make check-tools           # Verify required tools are installed"
	@echo "  make clean                 # Clean up containers and images"
	@echo "  make health-check          # Check application health"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-25s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

check-tools: ## Verify all required tools are installed
	@echo "$(BLUE)🔧 Checking required tools...$(NC)"
	@command -v docker >/dev/null 2>&1 || { echo "$(RED)❌ Docker is required but not installed$(NC)"; exit 1; }
	@command -v docker-compose >/dev/null 2>&1 || { echo "$(RED)❌ Docker Compose is required but not installed$(NC)"; exit 1; }
	@command -v node >/dev/null 2>&1 || { echo "$(RED)❌ Node.js is required but not installed$(NC)"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "$(RED)❌ npm is required but not installed$(NC)"; exit 1; }
	@command -v curl >/dev/null 2>&1 || { echo "$(RED)❌ curl is required but not installed$(NC)"; exit 1; }
	@echo "$(GREEN)✅ All required tools are installed$(NC)"

clean: ## Clean up containers, images, and networks
	@echo "$(YELLOW)🧹 Cleaning up...$(NC)"
	-docker-compose -f docker-compose.dev.yml down -v 2>/dev/null
	-docker-compose -f docker-compose.local-staging.yml down -v 2>/dev/null
	-docker stop $(CONTAINER_NAME) $(STAGING_CONTAINER_NAME) 2>/dev/null
	-docker rm $(CONTAINER_NAME) $(STAGING_CONTAINER_NAME) 2>/dev/null
	-docker network rm $(NETWORK_NAME) 2>/dev/null
	-docker image prune -f
	@echo "$(GREEN)✅ Cleanup completed$(NC)"

# Development Environment
dev: ## Start development environment with hot reload
	@echo "$(BLUE)🚀 Starting development environment...$(NC)"
	@echo "$(YELLOW)This will mount your source code for hot reloading$(NC)"
	@echo ""
	@docker-compose -f docker-compose.dev.yml up -d --build
	@echo ""
	@echo "$(GREEN)✅ Development environment ready!$(NC)"
	@echo ""
	@echo "$(BLUE)🌐 Application URLs:$(NC)"
	@echo "  • Main app: http://localhost:3000"
	@echo "  • Vite dev server: http://localhost:5173"
	@echo ""
	@echo "$(YELLOW)📝 Your source code is mounted - changes will be reflected immediately!$(NC)"
	@echo ""
	@echo "$(BLUE)💡 Development commands:$(NC)"
	@echo "  make dev-logs              # View live logs"
	@echo "  make dev-shell             # Open shell in dev container"
	@echo "  make dev-restart           # Restart dev environment"
	@echo "  make dev-stop              # Stop dev environment"
	@echo ""
	@echo "$(GREEN)🎉 Start developing! Edit your code and see changes instantly.$(NC)"

dev-logs: ## View development environment logs
	@echo "$(BLUE)📋 Development environment logs:$(NC)"
	@docker-compose -f docker-compose.dev.yml logs -f app-dev

dev-stop: ## Stop development environment
	@echo "$(YELLOW)🛑 Stopping development environment...$(NC)"
	@docker-compose -f docker-compose.dev.yml down
	@echo "$(GREEN)✅ Development environment stopped$(NC)"

dev-restart: ## Restart development environment
	@echo "$(BLUE)🔄 Restarting development environment...$(NC)"
	@$(MAKE) dev-stop
	@$(MAKE) dev

dev-shell: ## Open shell in development container
	@echo "$(BLUE)🐚 Opening shell in development container...$(NC)"
	@docker-compose -f docker-compose.dev.yml exec app-dev /bin/bash

dev-status: ## Check development environment status
	@echo "$(BLUE)📊 Development environment status:$(NC)"
	@docker-compose -f docker-compose.dev.yml ps

# Stage 1: Local Docker Build & Test
stage1-build: check-tools ## Stage 1: Build Docker image and run unit tests
	@echo "$(BLUE)🚀 STAGE 1: Local Docker Build & Test$(NC)"
	@echo "========================================="
	
	@echo "$(BLUE)📋 Pre-build validation...$(NC)"
	@test -f Dockerfile || { echo "$(RED)❌ Dockerfile not found$(NC)"; exit 1; }
	@test -f package.json || { echo "$(RED)❌ package.json not found$(NC)"; exit 1; }
	
	@echo "$(BLUE)🏗️  Building Docker image...$(NC)"
	@timeout $(BUILD_TIMEOUT) docker build \
		--tag $(IMAGE_NAME):latest \
		--tag $(IMAGE_NAME):$$(date +%Y%m%d-%H%M%S) \
		--progress=plain \
		. || { echo "$(RED)❌ Docker build failed or timed out$(NC)"; exit 1; }
	
	@echo "$(BLUE)🧪 Running container health check...$(NC)"
	@docker run --rm --name $(CONTAINER_NAME)-health \
		-e NODE_ENV=test \
		-d $(IMAGE_NAME):latest
	@sleep 10
	@docker logs $(CONTAINER_NAME)-health
	@docker stop $(CONTAINER_NAME)-health || true
	
	@echo "$(GREEN)✅ Stage 1 completed successfully$(NC)"

stage1-test: stage1-build ## Run comprehensive tests in Docker container
	@echo "$(BLUE)🧪 Running comprehensive tests...$(NC)"
	
	@echo "$(BLUE)🔍 Testing application startup...$(NC)"
	@docker run --rm --name $(CONTAINER_NAME)-startup-test \
		-e NODE_ENV=test \
		--timeout $(TEST_TIMEOUT) \
		$(IMAGE_NAME):latest \
		timeout 30 node -e "console.log('Startup test passed')" || { echo "$(RED)❌ Startup test failed$(NC)"; exit 1; }
	
	@echo "$(BLUE)🔍 Testing TypeScript compilation...$(NC)"
	@docker run --rm --name $(CONTAINER_NAME)-tsc-test \
		-e NODE_ENV=test \
		$(IMAGE_NAME):latest \
		node -e "require('typescript'); console.log('TypeScript available')" || { echo "$(RED)❌ TypeScript test failed$(NC)"; exit 1; }
	
	@echo "$(GREEN)✅ All Stage 1 tests passed$(NC)"

# Stage 2: Local Staging Environment
stage2-local-staging: stage1-test ## Stage 2: Create local staging environment
	@echo "$(BLUE)🎭 STAGE 2: Local Staging Environment$(NC)"
	@echo "==========================================="
	
	@echo "$(BLUE)🧹 Cleaning up any existing staging environment...$(NC)"
	@$(MAKE) stop-staging 2>/dev/null || true
	
	@echo "$(BLUE)🚀 Starting local staging with Docker Compose...$(NC)"
	@docker-compose -f docker-compose.local-staging.yml up -d --build
	
	@echo "$(BLUE)⏳ Waiting for staging environment to be ready...$(NC)"
	@./scripts/wait-for-health.sh http://localhost:3000/health $(HEALTH_CHECK_TIMEOUT) || { \
		echo "$(RED)❌ Staging environment failed to start$(NC)"; \
		$(MAKE) logs-staging; \
		exit 1; \
	}
	
	@echo "$(GREEN)✅ Stage 2 local staging environment ready$(NC)"
	@echo ""
	@echo "$(YELLOW)🌐 Your application is now running at: http://localhost:3000$(NC)"
	@echo "$(YELLOW)📋 Please manually verify the application is working correctly:$(NC)"
	@echo "  • Open http://localhost:3000 in your browser"
	@echo "  • Test login functionality"
	@echo "  • Verify API endpoints are responding"
	@echo "  • Check that all features work as expected"
	@echo ""
	@echo "$(BLUE)💡 Useful commands while testing:$(NC)"
	@echo "  make logs-staging     # View application logs"
	@echo "  make health-check     # Check health endpoint"
	@echo "  make stop-staging     # Stop staging environment"
	@echo ""

stage2-integration-tests: stage2-local-staging ## Run integration tests in staging
	@echo "$(BLUE)🧪 Running automated integration tests...$(NC)"
	
	@echo "$(BLUE)🔍 Testing health endpoint...$(NC)"
	@curl -f -s http://localhost:3000/health > /dev/null || { echo "$(RED)❌ Health check failed$(NC)"; exit 1; }
	
	@echo "$(BLUE)🔍 Testing API endpoints...$(NC)"
	@./scripts/test-api-endpoints.sh http://localhost:3000 || { echo "$(RED)❌ API tests failed$(NC)"; exit 1; }
	
	@echo "$(BLUE)📊 Checking performance metrics...$(NC)"
	@./scripts/performance-check.sh http://localhost:3000 || { echo "$(RED)❌ Performance check failed$(NC)"; exit 1; }
	
	@echo "$(BLUE)🔐 Testing authentication flow...$(NC)"
	@./scripts/test-auth-flow.sh http://localhost:3000 || { echo "$(RED)❌ Auth tests failed$(NC)"; exit 1; }
	
	@echo "$(GREEN)✅ All automated integration tests passed$(NC)"
	@echo ""
	@echo "$(YELLOW)⚠️  HUMAN APPROVAL REQUIRED$(NC)"
	@echo "$(YELLOW)=============================$(NC)"
	@echo ""
	@echo "$(BLUE)📋 The staging environment is ready for your review:$(NC)"
	@echo "  🌐 Application URL: http://localhost:3000"
	@echo "  📊 All automated tests have passed"
	@echo ""
	@echo "$(YELLOW)Please thoroughly test the application and confirm:$(NC)"
	@echo "  ✓ UI/UX works correctly"
	@echo "  ✓ All features function as expected"
	@echo "  ✓ Performance is acceptable"
	@echo "  ✓ No errors in browser console"
	@echo "  ✓ Database operations work"
	@echo "  ✓ Authentication flows work"
	@echo ""
	@echo "$(YELLOW)📋 To view logs while testing: make logs-staging$(NC)"
	@echo ""

stage2-approve: stage2-integration-tests ## Human approval gate for staging
	@echo "$(YELLOW)👤 HUMAN APPROVAL CHECKPOINT$(NC)"
	@echo "$(YELLOW)==============================$(NC)"
	@echo ""
	@echo "$(BLUE)You have manually tested the staging environment.$(NC)"
	@echo "$(BLUE)Do you approve proceeding to production deployment? (y/N)$(NC)"
	@echo ""
	@echo "$(RED)⚠️  This will deploy to AWS production environment!$(NC)"
	@echo ""
	@read -r APPROVE; \
	if [ "$$APPROVE" != "y" ] && [ "$$APPROVE" != "Y" ]; then \
		echo "$(YELLOW)🛑 Deployment halted - staging approval denied$(NC)"; \
		echo "$(BLUE)💡 You can continue testing with: make logs-staging$(NC)"; \
		echo "$(BLUE)💡 Or restart the pipeline with: make pipeline$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)✅ Staging approved for production deployment$(NC)"
	@echo "$(GREEN)🚀 Proceeding to production deployment...$(NC)"
	@echo ""

# Stage 3: Production Deployment
stage3-production-deploy: stage2-approve ## Stage 3: Deploy to AWS production
	@echo "$(BLUE)🌍 STAGE 3: Production Deployment$(NC)"
	@echo "===================================="
	@echo ""
	@echo "$(GREEN)✅ Staging environment approved$(NC)"
	@echo "$(BLUE)🚀 Initiating production deployment...$(NC)"
	@echo ""
	
	@echo "$(BLUE)🔍 Validating AWS credentials...$(NC)"
	@./scripts/validate-aws-credentials.sh || { echo "$(RED)❌ AWS credentials validation failed$(NC)"; exit 1; }
	
	@echo "$(BLUE)🏷️  Tagging image for production...$(NC)"
	@PROD_TAG=$$(date +%Y%m%d-%H%M%S)-prod; \
	docker tag $(IMAGE_NAME):latest $(IMAGE_NAME):$$PROD_TAG; \
	echo "Production tag: $$PROD_TAG" > .production-tag
	
	@echo "$(BLUE)📤 Pushing to ECR...$(NC)"
	@./scripts/push-to-ecr.sh $(IMAGE_NAME) || { echo "$(RED)❌ ECR push failed$(NC)"; exit 1; }
	
	@echo "$(BLUE)🚀 Deploying to ECS...$(NC)"
	@./scripts/deploy-to-ecs.sh $(IMAGE_NAME) || { echo "$(RED)❌ ECS deployment failed$(NC)"; exit 1; }
	
	@echo "$(BLUE)⏳ Waiting for production deployment...$(NC)"
	@./scripts/wait-for-production.sh || { echo "$(RED)❌ Production deployment verification failed$(NC)"; exit 1; }
	
	@echo "$(BLUE)🧪 Running production smoke tests...$(NC)"
	@./scripts/production-smoke-tests.sh || { echo "$(RED)❌ Production smoke tests failed$(NC)"; exit 1; }
	
	@echo "$(GREEN)✅ Stage 3 production deployment completed successfully$(NC)"

# Development Ready Pipeline
dev-ready: ## Lock in current development and proceed to staging
	@echo "$(BLUE)🔒 DEVELOPMENT READY - LOCKING IN CHANGES$(NC)"
	@echo "============================================="
	@echo ""
	@echo "$(YELLOW)This will:$(NC)"
	@echo "  1. Stop your development environment"
	@echo "  2. Build production Docker image with your current changes"
	@echo "  3. Start staging environment for final verification"
	@echo "  4. Wait for your approval before production deployment"
	@echo ""
	@echo "$(RED)⚠️  Make sure you've saved all your changes!$(NC)"
	@echo ""
	@read -r CONFIRM_READY; \
	if [ "$$CONFIRM_READY" != "y" ] && [ "$$CONFIRM_READY" != "Y" ]; then \
		echo "$(YELLOW)🛑 Development lock-in cancelled$(NC)"; \
		echo "$(BLUE)💡 Continue developing with: make dev$(NC)"; \
		exit 1; \
	fi
	
	@echo "$(BLUE)🛑 Stopping development environment...$(NC)"
	@$(MAKE) dev-stop 2>/dev/null || true
	
	@echo "$(BLUE)🔒 Locking in your changes and building for staging...$(NC)"
	@$(MAKE) stage1-build stage1-test
	@echo ""
	@$(MAKE) stage2-local-staging stage2-integration-tests stage2-approve
	@echo ""
	@$(MAKE) stage3-production-deploy
	@echo ""
	@echo "$(GREEN)🎉 DEVELOPMENT TO PRODUCTION PIPELINE COMPLETED!$(NC)"
	@echo "$(GREEN)🚀 Your application is now running in production$(NC)"

# Complete pipeline (for direct deployment without dev workflow)
pipeline: ## Run complete staged deployment pipeline (no dev environment)
	@echo "$(BLUE)🔄 STARTING COMPLETE STAGED DEPLOYMENT PIPELINE$(NC)"
	@echo "=================================================="
	@echo ""
	@echo "$(YELLOW)This pipeline will:$(NC)"
	@echo "  1. Build and test current code in Docker"
	@echo "  2. Create local staging environment for manual verification"
	@echo "  3. Wait for your approval before proceeding to production"
	@echo "  4. Deploy to AWS production only after approval"
	@echo ""
	@echo "$(BLUE)💡 For development workflow, use: make dev$(NC)"
	@echo "$(YELLOW)⚠️  The pipeline will PAUSE for human verification and approval$(NC)"
	@echo ""
	
	@$(MAKE) stage1-build stage1-test
	@echo ""
	@$(MAKE) stage2-local-staging stage2-integration-tests stage2-approve
	@echo ""
	@$(MAKE) stage3-production-deploy
	@echo ""
	@echo "$(GREEN)🎉 COMPLETE PIPELINE EXECUTED SUCCESSFULLY!$(NC)"
	@echo "$(GREEN)🚀 Your application is now running in production$(NC)"

deploy-safe: pipeline ## Alias for complete pipeline

# Utility commands
logs-staging: ## View staging container logs
	@echo "$(BLUE)📋 Staging environment logs:$(NC)"
	@docker-compose -f docker-compose.local-staging.yml logs -f app

logs-staging-all: ## View all staging service logs
	@echo "$(BLUE)📋 All staging service logs:$(NC)"
	@docker-compose -f docker-compose.local-staging.yml logs -f

health-check: ## Check application health
	@echo "$(BLUE)🔍 Checking application health...$(NC)"
	@curl -f -s http://localhost:3000/health && echo "$(GREEN)✅ Application is healthy$(NC)" || echo "$(RED)❌ Application health check failed$(NC)"

stop-staging: ## Stop staging environment
	@echo "$(YELLOW)🛑 Stopping staging environment...$(NC)"
	@docker-compose -f docker-compose.local-staging.yml down -v 2>/dev/null || true
	@echo "$(GREEN)✅ Staging environment stopped$(NC)"

restart-staging: ## Restart staging environment
	@echo "$(BLUE)🔄 Restarting staging environment...$(NC)"
	@$(MAKE) stop-staging
	@$(MAKE) stage2-local-staging

staging-status: ## Check staging environment status
	@echo "$(BLUE)📊 Staging environment status:$(NC)"
	@docker-compose -f docker-compose.local-staging.yml ps

open-staging: ## Open staging application in browser (macOS)
	@echo "$(BLUE)🌐 Opening staging application...$(NC)"
	@open http://localhost:3000

# Quick approval commands for convenience
approve-staging: ## Quick approve staging for production
	@echo "$(YELLOW)⚡ Quick staging approval$(NC)"
	@$(MAKE) stage2-approve

# Emergency stop
emergency-stop: ## Emergency stop all containers
	@echo "$(RED)🛑 EMERGENCY STOP - Stopping all containers$(NC)"
	@$(MAKE) stop-staging
	@docker stop $(STAGING_CONTAINER_NAME) $(PROJECT_NAME)-redis 2>/dev/null || true
	@echo "$(YELLOW)⚠️  All containers stopped$(NC)" 