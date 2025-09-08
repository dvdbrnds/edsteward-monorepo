# Byterover Handbook

*Generated: January 9, 2025*

## Layer 1: System Overview

**Purpose**: EdSteward is an advanced AI-powered regulatory compliance platform for higher education accreditation management, delivering intelligent insights across multiple jurisdictions through innovative technology.

**Tech Stack**: 
- Frontend: React 18 + TypeScript, Vite, TanStack Query, Wouter routing, Tailwind CSS + Radix UI
- Backend: Express.js + TypeScript, PostgreSQL + Drizzle ORM, JWT authentication, WebSocket real-time updates
- Authentication: Passport.js with local + SAML (@node-saml/passport-saml v4.0.4)
- Infrastructure: Docker-first development, AWS ECS/ECR deployment, multi-tenant architecture

**Architecture**: Multi-layered web application with Docker-first development approach. Frontend React SPA communicates with Express.js API backend. PostgreSQL database with Drizzle ORM for data persistence. Multi-tenant architecture with tenant isolation. SAML SSO integration for enterprise authentication.

**Key Technical Decisions**:
- Docker-first development (NEVER use npm run dev on macOS)
- Multi-tenant SaaS architecture with database-per-tenant isolation
- JWT + SAML hybrid authentication system
- Real-time updates via WebSocket connections
- Rate limiting and intelligent retry mechanisms

**Entry Points**: 
- Development: `./dev.sh up` (Docker required)
- Production: `npm start` (NODE_ENV=production tsx server/index.ts)
- Main server: server/index.ts
- Frontend entry: src/main.tsx

---

## Layer 2: Module Map

**Core Modules**:
- **Authentication System**: server/auth/ (saml.ts, single-tenant-auth.ts, tenant-saml.ts) - Multi-IDP SAML + local auth
- **API Routes**: server/routes/api/ - RESTful endpoints for regulations, deadlines, notes, admin functions
- **Database Layer**: server/services/database.ts, server/db.ts - PostgreSQL with Drizzle ORM, multi-tenant support
- **Frontend Components**: client/ - React components with Radix UI, responsive design

**Data Layer**:
- **Database**: PostgreSQL with Drizzle ORM (drizzle.config.ts)
- **Storage Services**: server/storage/ - Data persistence abstractions
- **Repositories**: server/repositories/ - Data access patterns
- **Migrations**: server/migrations/ - Database schema management

**Integration Points**:
- **SAML Authentication**: server/config/saml.ts - Multi-IDP configuration (Okta, Shibboleth, InCommon)
- **WebSocket Server**: server/websocket-server.ts - Real-time communication
- **AWS Services**: S3 storage, SES email, ECS deployment
- **MCP Integration**: server/mcp-integration-api.ts - External regulation data

**Utilities**:
- **Middleware**: server/middleware/ - Security, logging, tenant resolution, session management
- **Services**: server/services/ - Business logic, email, notifications, data collection
- **Scripts**: Development and deployment automation scripts

**Module Dependencies**:
- Frontend depends on backend API
- Authentication system integrates with all protected routes
- Multi-tenant middleware affects all API endpoints
- Database layer supports all data operations
- SAML configuration requires proper certificate management

---

## Layer 3: Integration Guide

**API Endpoints**:
- **Authentication**: /auth/login, /auth/saml/login/:provider, /auth/saml/callback/:provider
- **Regulations**: /api/regulations - CRUD operations for compliance data
- **Deadlines**: /api/deadlines - Deadline management and tracking
- **Notes**: /api/notes - User annotations and comments
- **Admin**: /api/admin - Administrative functions and tenant management
- **Health**: /api/health - System health monitoring

**Configuration Files**:
- **.env**: Environment variables (API URLs, database connections, SAML settings)
- **drizzle.config.ts**: Database ORM configuration
- **docker-compose.yml**: Development environment setup
- **server/config/saml.ts**: SAML identity provider configurations
- **server/config/institution.ts**: Institution-specific settings

**External Integrations**:
- **OKTA SAML SSO**: Enterprise authentication with certificate-based security
- **AWS Services**: ECS (hosting), ECR (container registry), S3 (storage), SES (email)
- **PostgreSQL/Neon**: Primary database with multi-tenant isolation
- **WebSocket**: Real-time updates for regulation changes
- **MCP Engine**: External regulation data synchronization

**Workflows**:
- **SAML Authentication Flow**: User → IDP → SAML callback → JWT token → Protected resources
- **Development Workflow**: Docker containers → Hot reload → Local testing → AWS deployment
- **Data Sync**: MCP Engine → WebSocket → Frontend updates → Database persistence
- **Multi-tenant Request**: Subdomain → Tenant resolution → Database routing → Response

**Interface Definitions**:
- **SAML Profile**: User attributes from identity providers
- **JWT Tokens**: Access and refresh token structure
- **API Responses**: Standardized JSON response format
- **WebSocket Events**: Real-time update message structure

---

## Layer 4: Extension Points

**Design Patterns**:
- **Multi-Strategy Authentication**: Passport.js strategies for local + SAML authentication
- **Repository Pattern**: Data access abstraction in server/repositories/
- **Middleware Chain**: Express.js middleware for cross-cutting concerns
- **Service Layer**: Business logic separation in server/services/
- **Multi-tenant Architecture**: Database-per-tenant isolation pattern

**Extension Points**:
- **SAML Identity Providers**: Add new IDPs in server/config/saml.ts (Shibboleth, InCommon supported)
- **Authentication Strategies**: Extend Passport.js strategies in server/auth/
- **API Endpoints**: Add new routes in server/routes/api/
- **Frontend Components**: React components with Radix UI system
- **Database Schemas**: Drizzle migrations for schema changes

**Customization Areas**:
- **Tenant Configuration**: Institution-specific settings and branding
- **SAML Attribute Mapping**: Custom user attribute extraction from SAML profiles
- **Rate Limiting**: Configurable limits per endpoint and tenant
- **Email Templates**: Customizable notification templates
- **UI Themes**: Tailwind CSS + Radix UI theming system

**Plugin Architecture**:
- **Middleware Plugins**: Custom Express.js middleware for specific requirements
- **Service Plugins**: Pluggable business logic services
- **Authentication Plugins**: Additional Passport.js strategies
- **Database Plugins**: Custom Drizzle ORM extensions

**Recent Changes**:
- SAML authentication system fully implemented with multi-IDP support
- Docker-first development environment established
- Multi-tenant architecture with database isolation
- AWS ECS/ECR deployment pipeline configured
- WebSocket real-time updates implemented

---

*Byterover handbook optimized for agent navigation and human developer onboarding*


