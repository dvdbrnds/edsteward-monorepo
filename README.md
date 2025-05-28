# MCP Engine - Enterprise Compliance Management Platform

[![Phase](https://img.shields.io/badge/Phase-5%20Complete-green.svg)](./PHASE5_IMPLEMENTATION_SUMMARY.md)
[![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue.svg)](#architecture)
[![Deployment](https://img.shields.io/badge/Deployment-Kubernetes%20Ready-orange.svg)](#deployment)

A world-class, enterprise-ready compliance management platform that leverages Large Language Models (LLMs) for intelligent compliance analysis and regulation management.

## 🚀 Quick Start

### Local Development
```bash
# Clone and setup
git clone [repository-url]
cd mcp-engine
npm install

# Start the LLM Gateway (Phase 4)
node src/llm-gateway/start-llm-gateway-refactored.js

# Start the Frontend (separate terminal)
npm run dev:client
```

### Docker Deployment
```bash
# Phase 4 with Docker Compose
docker-compose -f docker-compose.phase4.yml up -d
```

### Kubernetes Deployment
```bash
# Phase 5 Enterprise Deployment
./scripts/deploy-phase5.sh
```

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Phase Evolution](#phase-evolution)
- [Features](#features)
- [Installation & Setup](#installation--setup)
- [API Documentation](#api-documentation)
- [Development Guide](#development-guide)
- [Deployment Options](#deployment-options)
- [Monitoring & Observability](#monitoring--observability)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## 🏗️ Architecture Overview

The MCP Engine follows a modern microservices architecture with dependency injection, service layer patterns, and enterprise-grade features:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  LLM Gateway    │    │   Monitoring    │
│   (React/Vite)  │◄──►│   (Express)     │◄──►│ (Prometheus)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │ Service Layer   │
                       │ • LLM Service   │
                       │ • Compliance    │
                       │ • Regulation    │
                       │ • Cache         │
                       │ • Auth          │
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │ Data Layer      │
                       │ • Redis Cache   │
                       │ • CSV Data      │
                       │ • Metrics       │
                       └─────────────────┘
```

### Core Components

- **LLM Gateway**: Express.js API server with intelligent routing
- **Service Layer**: Dependency-injected services for business logic
- **Frontend**: Modern React application with Vite
- **Caching**: Redis with memory fallback
- **Security**: JWT authentication, API keys, rate limiting
- **Monitoring**: Prometheus metrics, health checks, logging
- **Orchestration**: Kubernetes-ready with Helm charts

## 📈 Phase Evolution

The MCP Engine has evolved through 5 distinct phases:

### Phase 1: Foundation & Architecture ✅
- Dependency cleanup and legacy file organization
- Server factory pattern implementation
- Centralized configuration management
- Basic service structure

### Phase 2: Service Layer & Business Logic ✅
- Repository pattern implementation
- Service layer with dependency injection
- Business logic separation
- Data access abstraction

### Phase 3: Frontend Integration & User Experience ✅
- React hooks and context API
- Modern UI components
- Client-server integration
- User interface modernization

### Phase 4: Production Readiness & Advanced Features ✅
- Advanced caching system (Redis + memory fallback)
- Security & authentication (API keys, JWT, rate limiting)
- Advanced regulation management (versioning, bulk operations)
- Monitoring & observability (metrics, health checks)
- Enhanced LLM Gateway

### Phase 5: Enterprise Kubernetes & Advanced Operations ✅
- Kubernetes orchestration with auto-scaling
- Helm charts for deployment
- Advanced monitoring (Prometheus, Grafana, Jaeger)
- Production security (network policies, SSL)
- Infrastructure as Code

## ✨ Features

### Core Features
- **Intelligent Compliance Analysis**: LLM-powered compliance query processing
- **Regulation Management**: Advanced search, versioning, and bulk operations
- **Real-time Monitoring**: Comprehensive metrics and health monitoring
- **Scalable Architecture**: Kubernetes-ready with auto-scaling
- **Security First**: JWT auth, API keys, rate limiting, CORS protection

### Advanced Features
- **Distributed Caching**: Redis with intelligent fallback
- **Service Discovery**: Kubernetes-native service mesh
- **Observability**: Prometheus metrics, Grafana dashboards, Jaeger tracing
- **High Availability**: Multi-replica deployments with health checks
- **CI/CD Ready**: Automated deployment scripts and Helm charts

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- Docker & Docker Compose
- Kubernetes cluster (for Phase 5)
- Redis (optional, memory fallback available)

### Environment Configuration
```bash
# Copy environment template
cp env.example .env

# Required variables
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=development
LOG_LEVEL=info

# Optional (with defaults)
LLM_GATEWAY_PORT=3002
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Development Setup
```bash
# Install dependencies
npm install

# Start services
npm run dev:gateway    # LLM Gateway on :3002
npm run dev:client     # Frontend on :3050

# Or use the refactored gateway
node src/llm-gateway/start-llm-gateway-refactored.js
```

## 📚 API Documentation

### Base URL
- Local: `http://localhost:3002/api/llm`
- Production: `https://api.mcp-engine.com/api/llm`

### Core Endpoints

#### Health Check
```http
GET /api/llm/health
```
Returns comprehensive health status including service availability.

#### Compliance Query
```http
POST /api/llm/query
Content-Type: application/json

{
  "query": "What are FERPA requirements for student data?",
  "options": {
    "temperature": 0.3,
    "maxTokens": 1000
  }
}
```

#### Regulation Management
```http
GET /api/llm/regulations              # List all regulations
GET /api/llm/regulations/search?q=... # Search regulations
POST /api/llm/regulations             # Create regulation
PUT /api/llm/regulations/:id          # Update regulation
DELETE /api/llm/regulations/:id       # Delete regulation
```

#### Metrics & Monitoring
```http
GET /api/llm/metrics                  # Prometheus metrics
GET /api/llm/stats                    # System statistics
```

For detailed API documentation, see [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md).

## 👨‍💻 Development Guide

### Project Structure
```
mcp-engine/
├── src/
│   ├── shared/                    # Shared services & utilities
│   │   ├── services/             # Business logic services
│   │   ├── repositories/         # Data access layer
│   │   ├── interfaces/           # TypeScript-style interfaces
│   │   ├── cache/               # Caching implementations
│   │   ├── security/            # Authentication & authorization
│   │   ├── monitoring/          # Metrics & health checks
│   │   └── container/           # Dependency injection
│   ├── llm-gateway/             # LLM Gateway application
│   ├── client/                  # React frontend
│   └── core/                    # Core utilities
├── k8s/                         # Kubernetes manifests
├── scripts/                     # Deployment scripts
├── docs/                        # Documentation
└── examples/                    # Usage examples
```

### Adding New Services
1. Create service class in `src/shared/services/`
2. Implement repository in `src/shared/repositories/`
3. Register in service container
4. Add routes in LLM Gateway
5. Update tests and documentation

For detailed development guide, see [DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md).

## 🚀 Deployment Options

### Local Development
```bash
node src/llm-gateway/start-llm-gateway-refactored.js
```

### Docker Compose (Phase 4)
```bash
docker-compose -f docker-compose.phase4.yml up -d
```

### Kubernetes (Phase 5)
```bash
# Deploy with Helm
./scripts/deploy-phase5.sh

# Or manual deployment
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/llm-gateway-deployment.yaml
kubectl apply -f k8s/monitoring-stack.yaml
kubectl apply -f k8s/ingress.yaml
```

For detailed deployment guide, see [DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md).

## 📊 Monitoring & Observability

### Health Monitoring
- **Health Endpoint**: `/api/llm/health`
- **Service Status**: Real-time service availability
- **Dependency Checks**: Redis, OpenAI API connectivity

### Metrics Collection
- **Prometheus**: Custom metrics collection
- **Grafana**: Visual dashboards
- **Jaeger**: Distributed tracing

### Logging
- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: Debug, Info, Warn, Error
- **Log Aggregation**: Kubernetes-ready log collection

## 🔧 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Kill processes on port 3002
./kill-port.sh 3002
```

#### Redis Connection Issues
- Check Redis is running: `redis-cli ping`
- System falls back to memory cache automatically

#### Service Resolution Errors
- Verify service registration in container
- Check import paths in service files

#### OpenAI API Issues
- Verify API key in environment variables
- Check API quota and billing status

For detailed troubleshooting, see [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md).

## 📖 Documentation

- [Phase 4 Completion Summary](./PHASE4_COMPLETION_SUMMARY.md)
- [Phase 5 Implementation Summary](./PHASE5_IMPLEMENTATION_SUMMARY.md)
- [API Documentation](./docs/API_DOCUMENTATION.md)
- [Development Guide](./docs/DEVELOPMENT_GUIDE.md)
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)
- [Architecture Deep Dive](./docs/ARCHITECTURE.md)
- [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for LLM capabilities
- Kubernetes community for orchestration
- Express.js and React communities
- All contributors and maintainers

---

**MCP Engine** - Transforming compliance management through intelligent automation.