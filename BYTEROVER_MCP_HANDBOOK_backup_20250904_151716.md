# Byterover Handbook

*Generated: December 28, 2024*

## Layer 1: System Overview

**Purpose**: Enterprise-grade compliance management platform that leverages Large Language Models (LLMs) for intelligent compliance analysis and regulation management. The MCP Engine serves as a comprehensive solution for universities and educational institutions to manage federal and state regulatory compliance requirements.

**Tech Stack**: 
- Backend: Node.js 18+, Express.js, ES Modules
- Frontend: React 18, Vite, Styled Components  
- Database: PostgreSQL with Redis caching
- Orchestration: Kubernetes, Docker, Helm charts
- Monitoring: Prometheus, Grafana, Jaeger tracing
- Security: JWT authentication, API key management, CORS, rate limiting

**Architecture**: Microservices architecture with dependency injection, service layer patterns, and enterprise-grade features. The system follows a layered approach with service containers, repository patterns, and advanced caching strategies.

**Key Technical Decisions**:
- Dependency injection container for service management
- Repository pattern for data access abstraction
- Multi-level caching (Redis + Memory fallback)
- Kubernetes-native deployment with auto-scaling
- MCP (Model Context Protocol) for LLM integration

**Entry Points**: 
- Main startup: `mcp-start.js`
- LLM Gateway: `src/llm-gateway/start-llm-gateway-refactored.js`
- Frontend: `src/client/index.jsx`
- Registry API: `src/server/registry-api/registry-server.js`

---

## Layer 2: Module Map

**Core Modules**:
- **LLM Gateway** (`src/llm-gateway/`): Express.js API server with intelligent routing, multiple implementations (refactored, phase4, simple)
- **Service Layer** (`src/shared/services/`): Business logic services (ComplianceService, LLMService) with dependency injection
- **Repository Layer** (`src/shared/repositories/`): Data access abstraction (RegulationRepository, MemoryCacheRepository)
- **Client Application** (`src/client/`): Modern React application with Vite, routing, and styled components
- **Delivery System** (`src/delivery-system/`): Real-time regulation delivery with TUF compliance and EdSteward integration

**Data Layer**:
- **PostgreSQL Schema** (`database/migrations/`): Regulatory sources, updates tracking, regulation versions with change history
- **Redis Caching** (`src/shared/cache/`): Distributed caching with intelligent fallback to memory
- **CSV Data Store** (`data/compmat.csv`): 295 federal regulations with comprehensive metadata
- **TUF Repository** (`src/delivery-system/tuf-repository/`): Secure regulation delivery system

**Integration Points**:
- **EdSteward Integration** (`src/delivery-system/edsteward-integration.js`): AWS WebSocket integration for customer systems
- **MCP Protocol** (`src/protocol/`): Model Context Protocol for LLM server interactions
- **Registry API** (`src/server/registry-api/`): RESTful API for regulation metadata and console generation
- **WebSocket Service** (`src/websocket-service/`): Real-time updates and notifications

**Utilities**:
- **Service Container** (`src/shared/container/`): Dependency injection and service lifecycle management
- **Monitoring** (`src/shared/monitoring/`, `src/observability/`): Prometheus metrics, health checks, telemetry
- **Security** (`src/shared/security/`, `src/middleware/`): Authentication, authorization, rate limiting
- **Logger** (`src/utils/logger.js`): Structured logging with correlation IDs

**Module Dependencies**:
```
LLM Gateway → Service Layer → Repository Layer → Data Layer
Client App → Registry API → LLM Gateway
Delivery System → EdSteward Integration → WebSocket Service
Service Container → All Services → Repositories → Cache Layer
```

---

## Layer 3: Integration Guide

**API Endpoints**:
```
LLM Gateway (Port 3002):
- GET /api/llm/health - Health check with service status
- POST /api/llm/query - Compliance query processing
- GET /api/llm/compliance/{regulation-slug} - Specific regulation compliance data
- GET /api/llm/usc/{title}/{section} - USC content retrieval
- GET /api/llm/regulations - List all regulations
- POST /api/llm/regulations - Create regulation
- GET /api/llm/metrics - Prometheus metrics

Registry API (Port 3010):
- GET /api/regulations - List all 295 regulations
- GET /console/{regulation-slug} - Generate regulation console
- GET /api/regulations/search?q=... - Search regulations
- POST /api/regulations/batch - Batch operations

Frontend (Port 3050):
- / - Main React application
- /reg-66-advanced-console.html - REG-66 console interface

Delivery System (Port 3051):
- WebSocket connections for real-time updates
- EdSteward integration endpoints
```

**Configuration Files**:
- `package.json` - Dependencies and npm scripts
- `docker-compose.yml` - Local development environment
- `docker-compose.phase4.yml` - Production Docker setup
- `k8s/*.yaml` - Kubernetes manifests for enterprise deployment
- `env.example` - Environment variable template
- `vite.config.js` - Frontend build configuration

**External Integrations**:
- **OpenAI API**: LLM processing for compliance analysis
- **EdSteward AWS**: Customer-facing compliance dashboard integration
- **Government APIs**: USC (uscode.house.gov), CFR, Congress.gov for regulation content
- **Redis**: Distributed caching and session storage
- **PostgreSQL**: Primary database for regulation metadata

**Workflows**:
1. **Regulation Processing**: CSV → Repository → Cache → LLM Gateway → Client
2. **Compliance Analysis**: Query → LLM Service → OpenAI API → Structured Response
3. **Real-time Updates**: Change Detection → Delivery System → WebSocket → EdSteward
4. **Console Generation**: Regulation Slug → Registry API → Dynamic HTML Console

**Interface Definitions**:
- Service interfaces in `src/shared/interfaces/`
- MCP protocol definitions in `src/protocol/`
- API contracts in `api-contract.md`
- Data models in `src/models/`

---

## Layer 4: Extension Points

**Design Patterns**:
- **Dependency Injection**: Service container with automatic dependency resolution
- **Repository Pattern**: Data access abstraction with caching strategies
- **Factory Pattern**: Server factory for Express app creation (`src/core/server-factory.js`)
- **Observer Pattern**: Event-driven regulation updates and notifications
- **Strategy Pattern**: Multiple LLM Gateway implementations (refactored, phase4, simple)

**Extension Points**:
- **New Regulation Sources**: Extend `src/regulatory-sources/` for additional government APIs
- **Custom Validators**: Add to `src/lambda/validators/` for regulation-specific validation logic
- **Additional Services**: Register in `src/shared/container/service-registry.js`
- **New Cache Strategies**: Implement in `src/shared/cache/` following existing patterns
- **Custom Middleware**: Add to `src/middleware/` for authentication, rate limiting, etc.

**Customization Areas**:
- **State-Specific Regulations**: Currently missing Pennsylvania regulations - can be added to CSV and database
- **Institution-Specific Templates**: Compliance templates can be customized per university
- **Custom Compliance Scoring**: Algorithm customization in `src/services/compliance-processor.js`
- **Branding and UI**: React components in `src/client/components/` for white-label customization

**Plugin Architecture**:
- **MCP Server Plugins**: Regulation-specific servers in `src/regulation-server/`
- **Validation Plugins**: Level-based validators (A, B, C, D) for different complexity regulations
- **Integration Plugins**: EdSteward and other external system integrations
- **Monitoring Plugins**: Custom metrics and alerting in observability layer

**Recent Changes**:
- **Friday Beta Deployment**: System verified ready for Moravian University deployment
- **295 Federal Regulations**: Complete coverage of federal compliance requirements
- **EdSteward Integration**: Real-time WebSocket updates to customer AWS systems
- **Database Migration**: Transition from CSV to PostgreSQL (postponed to post-beta)
- **LLM Gateway Consolidation**: Multiple implementations available for different use cases

---

## Critical Gap Identified: Pennsylvania State Regulations

**URGENT ISSUE**: MCP Engine currently serves 295 federal regulations but **LACKS Pennsylvania state education regulations** required for Moravian University and other PA institutions.

**Impact**: 
- Customer deployment incomplete without state compliance coverage
- Moravian operates under both federal AND Pennsylvania state jurisdiction
- Missing state regulations creates significant compliance value gap

**Required Action**:
1. Identify specific PA Department of Education regulations from EdSteward system
2. Add PA regulations to MCP Engine database and CSV data
3. Implement PA regulation validation logic (Levels A-D)
4. Test PA regulation transmission to EdSteward AWS system
5. Verify complete federal + state coverage for customer deployment

**Extension Strategy for State Regulations**:
- Add state-specific regulation categories to `data/compmat.csv`
- Extend validation templates in `src/lambda/validators/`
- Update agency mappings for Pennsylvania Department of Education
- Implement state-specific compliance scoring algorithms
- Add PA regulation console generation capabilities

---

*Byterover handbook optimized for agent navigation and human developer onboarding*
