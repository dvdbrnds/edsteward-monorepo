# MCP Engine Documentation

Welcome to the comprehensive documentation for the MCP Engine - an enterprise-ready compliance management platform that leverages Large Language Models for intelligent compliance analysis and regulation management.

## 📚 Documentation Overview

This documentation covers all aspects of the MCP Engine, from basic setup to advanced enterprise deployment. The system has evolved through 5 distinct phases, each building upon the previous to create a world-class compliance platform.

## 🚀 Quick Start

- **New to MCP Engine?** Start with the [Main README](../README.md)
- **Want to deploy quickly?** Check the [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- **Need to troubleshoot?** See the [Troubleshooting Guide](./TROUBLESHOOTING.md)
- **Developing features?** Read the [Development Guide](./DEVELOPMENT_GUIDE.md)

## 📖 Documentation Structure

### Core Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [**Main README**](../README.md) | Project overview, quick start, and feature summary | Everyone |
| [**API Documentation**](./API_DOCUMENTATION.md) | Complete API reference with examples | Developers, Integrators |
| [**Development Guide**](./DEVELOPMENT_GUIDE.md) | Development setup, patterns, and contribution guide | Developers |
| [**Deployment Guide**](./DEPLOYMENT_GUIDE.md) | All deployment options from local to Kubernetes | DevOps, System Administrators |
| [**Architecture Documentation**](./ARCHITECTURE.md) | System design, patterns, and technical decisions | Architects, Senior Developers |
| [**Troubleshooting Guide**](./TROUBLESHOOTING.md) | Common issues and solutions | Everyone |

### Phase Documentation

| Document | Description | Status |
|----------|-------------|---------|
| [**Phase 4 Completion Summary**](../PHASE4_COMPLETION_SUMMARY.md) | Production readiness features | ✅ Complete |
| [**Phase 5 Implementation Summary**](../PHASE5_IMPLEMENTATION_SUMMARY.md) | Enterprise Kubernetes deployment | ✅ Complete |

## 🏗️ System Architecture Overview

The MCP Engine follows a modern microservices architecture:

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
```

**Key Features:**
- **Dependency Injection**: Custom IoC container for service management
- **Multi-level Caching**: Redis with memory fallback
- **Enterprise Security**: JWT auth, API keys, rate limiting
- **Kubernetes Ready**: Auto-scaling, monitoring, observability
- **Production Monitoring**: Prometheus, Grafana, Jaeger tracing

## 📋 Documentation by Use Case

### For Developers

**Getting Started:**
1. [Development Environment Setup](./DEVELOPMENT_GUIDE.md#development-environment-setup)
2. [Code Organization](./DEVELOPMENT_GUIDE.md#code-organization)
3. [Adding New Features](./DEVELOPMENT_GUIDE.md#adding-new-features)

**API Integration:**
1. [API Overview](./API_DOCUMENTATION.md#overview)
2. [Authentication](./API_DOCUMENTATION.md#authentication)
3. [Core Endpoints](./API_DOCUMENTATION.md#core-endpoints)
4. [SDK Examples](./API_DOCUMENTATION.md#sdk-examples)

**Architecture Understanding:**
1. [Service Layer Design](./ARCHITECTURE.md#service-layer-design)
2. [Dependency Injection](./ARCHITECTURE.md#dependency-injection)
3. [Design Patterns](./ARCHITECTURE.md#design-patterns)

### For DevOps Engineers

**Deployment Options:**
1. [Local Development](./DEPLOYMENT_GUIDE.md#local-development)
2. [Docker Deployment](./DEPLOYMENT_GUIDE.md#docker-deployment)
3. [Kubernetes Deployment](./DEPLOYMENT_GUIDE.md#kubernetes-deployment)

**Production Considerations:**
1. [Resource Requirements](./DEPLOYMENT_GUIDE.md#production-considerations)
2. [Security Configuration](./DEPLOYMENT_GUIDE.md#security-configuration)
3. [Monitoring Setup](./DEPLOYMENT_GUIDE.md#monitoring--observability)

**Operations:**
1. [Troubleshooting](./TROUBLESHOOTING.md)
2. [Performance Tuning](./TROUBLESHOOTING.md#performance-issues)
3. [Backup & Recovery](./DEPLOYMENT_GUIDE.md#backup-and-recovery)

### For System Administrators

**Installation & Setup:**
1. [Prerequisites](../README.md#installation--setup)
2. [Environment Configuration](./DEPLOYMENT_GUIDE.md#environment-configuration)
3. [Service Management](./DEPLOYMENT_GUIDE.md#service-management)

**Monitoring & Maintenance:**
1. [Health Monitoring](./TROUBLESHOOTING.md#quick-diagnostics)
2. [Log Analysis](./TROUBLESHOOTING.md#log-analysis)
3. [Performance Monitoring](./DEPLOYMENT_GUIDE.md#monitoring--observability)

### For Architects

**System Design:**
1. [High-Level Architecture](./ARCHITECTURE.md#system-architecture)
2. [Data Flow](./ARCHITECTURE.md#data-flow)
3. [Security Architecture](./ARCHITECTURE.md#security-architecture)

**Technical Decisions:**
1. [Technology Stack](./ARCHITECTURE.md#technology-stack)
2. [Caching Strategy](./ARCHITECTURE.md#caching-strategy)
3. [Deployment Architecture](./ARCHITECTURE.md#deployment-architecture)

## 🔧 Common Tasks

### Development Tasks

| Task | Documentation | Quick Command |
|------|---------------|---------------|
| Start development server | [Development Guide](./DEVELOPMENT_GUIDE.md#development-scripts) | `node src/llm-gateway/start-llm-gateway-refactored.js` |
| Run tests | [Development Guide](./DEVELOPMENT_GUIDE.md#testing-strategy) | `npm test` |
| Add new service | [Development Guide](./DEVELOPMENT_GUIDE.md#adding-new-features) | See service creation guide |
| Debug issues | [Troubleshooting](./TROUBLESHOOTING.md#debugging--troubleshooting) | Check logs and health endpoints |

### Deployment Tasks

| Task | Documentation | Quick Command |
|------|---------------|---------------|
| Local deployment | [Deployment Guide](./DEPLOYMENT_GUIDE.md#local-development) | `npm install && npm start` |
| Docker deployment | [Deployment Guide](./DEPLOYMENT_GUIDE.md#docker-deployment) | `docker-compose -f docker-compose.phase4.yml up -d` |
| Kubernetes deployment | [Deployment Guide](./DEPLOYMENT_GUIDE.md#kubernetes-deployment) | `./scripts/deploy-phase5.sh` |
| Health check | [Troubleshooting](./TROUBLESHOOTING.md#quick-diagnostics) | `curl http://localhost:3002/api/llm/health` |

### Operational Tasks

| Task | Documentation | Quick Command |
|------|---------------|---------------|
| View logs | [Troubleshooting](./TROUBLESHOOTING.md#log-analysis) | `tail -f logs/app.log` |
| Check metrics | [API Documentation](./API_DOCUMENTATION.md#monitoring--metrics) | `curl http://localhost:3002/api/llm/metrics` |
| Scale services | [Deployment Guide](./DEPLOYMENT_GUIDE.md#scaling-operations) | `kubectl scale deployment llm-gateway --replicas=5` |
| Backup data | [Deployment Guide](./DEPLOYMENT_GUIDE.md#backup-and-recovery) | See backup procedures |

## 🎯 Phase Evolution

The MCP Engine has evolved through 5 phases:

### Phase 1: Foundation & Architecture ✅
- Basic service structure and configuration
- Server factory pattern implementation
- Dependency cleanup and organization

### Phase 2: Service Layer & Business Logic ✅
- Repository pattern implementation
- Service layer with dependency injection
- Business logic separation

### Phase 3: Frontend Integration & User Experience ✅
- React hooks and context API
- Modern UI components
- Client-server integration

### Phase 4: Production Readiness & Advanced Features ✅
- Advanced caching (Redis + memory fallback)
- Security & authentication (JWT, API keys, rate limiting)
- Monitoring & observability (metrics, health checks)
- Enhanced LLM Gateway

### Phase 5: Enterprise Kubernetes & Advanced Operations ✅
- Kubernetes orchestration with auto-scaling
- Helm charts for deployment
- Advanced monitoring (Prometheus, Grafana, Jaeger)
- Production security (network policies, SSL)

## 🔍 Finding Information

### Search by Topic

| Topic | Primary Document | Additional Resources |
|-------|------------------|---------------------|
| **API Usage** | [API Documentation](./API_DOCUMENTATION.md) | [Development Guide](./DEVELOPMENT_GUIDE.md) |
| **Deployment** | [Deployment Guide](./DEPLOYMENT_GUIDE.md) | [Troubleshooting](./TROUBLESHOOTING.md) |
| **Development** | [Development Guide](./DEVELOPMENT_GUIDE.md) | [Architecture](./ARCHITECTURE.md) |
| **Troubleshooting** | [Troubleshooting Guide](./TROUBLESHOOTING.md) | [Deployment Guide](./DEPLOYMENT_GUIDE.md) |
| **Architecture** | [Architecture Documentation](./ARCHITECTURE.md) | [Development Guide](./DEVELOPMENT_GUIDE.md) |

### Search by Error/Issue

| Error Type | Documentation Section |
|------------|----------------------|
| **Port in use** | [Troubleshooting - Service Startup](./TROUBLESHOOTING.md#service-startup-issues) |
| **Module not found** | [Troubleshooting - Service Startup](./TROUBLESHOOTING.md#service-startup-issues) |
| **API 404 errors** | [Troubleshooting - API Issues](./TROUBLESHOOTING.md#api-and-network-issues) |
| **Redis connection** | [Troubleshooting - Database Issues](./TROUBLESHOOTING.md#database-and-caching-issues) |
| **Authentication** | [Troubleshooting - Security Issues](./TROUBLESHOOTING.md#authentication-and-security-issues) |
| **Performance** | [Troubleshooting - Performance](./TROUBLESHOOTING.md#performance-issues) |
| **Kubernetes** | [Troubleshooting - Kubernetes](./TROUBLESHOOTING.md#kubernetes-specific-issues) |

## 📞 Getting Help

### Documentation Issues
If you find issues with the documentation:
1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md) first
2. Search existing issues in the repository
3. Create a new issue with the `documentation` label

### Technical Support
For technical issues:
1. Follow the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Collect logs using the [log collection procedures](./TROUBLESHOOTING.md#log-collection)
3. Include environment details and steps to reproduce

### Contributing
To contribute to the documentation:
1. Read the [Development Guide](./DEVELOPMENT_GUIDE.md#contributing-guidelines)
2. Follow the documentation style guide
3. Submit a pull request with your improvements

## 📝 Documentation Standards

### Writing Guidelines
- **Clear and Concise**: Use simple, direct language
- **Code Examples**: Include working code examples
- **Step-by-Step**: Provide detailed procedures
- **Cross-References**: Link to related documentation
- **Up-to-Date**: Keep examples current with the codebase

### Code Examples
- All code examples should be tested and working
- Include necessary imports and dependencies
- Provide context for where code should be placed
- Use consistent formatting and style

### Maintenance
This documentation is maintained alongside the codebase:
- Updated with each major release
- Reviewed for accuracy during development
- Community contributions welcome

---

**MCP Engine Documentation** - Last updated: January 2024  
**Version**: 5.0.0 (Phase 5 Complete)  
**Maintainers**: MCP Engine Development Team 