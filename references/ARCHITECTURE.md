# EdSteward Platform Architecture Documentation

**Version**: 1.0.0  
**Last Updated**: January 2025  
**System**: Multi-Tenant Regulatory Compliance Management Platform  

---

## 🏗️ **System Overview**

EdSteward is a **multi-tenant regulatory compliance management platform** designed to help educational institutions track, manage, and maintain compliance with federal, state, and industry regulations. The platform implements a **database-per-tenant architecture** ensuring complete data isolation and security.

### **Core Purpose**
- 📋 **Regulation Management**: Track and manage regulatory requirements
- ⏰ **Deadline Tracking**: Monitor compliance deadlines and notifications  
- 📝 **Evidence Management**: Store and organize compliance documentation
- 🔐 **SAML Authentication**: Enterprise SSO integration
- 👥 **Multi-Tenant Isolation**: Complete data separation per institution

---

## 🛠️ **Technology Stack**

### **Runtime & Language**
- **Node.js**: 18+ (Alpine Linux in containers)
- **TypeScript**: 5.6.3 (Full type safety)
- **tsx**: 4.19.1 (TypeScript execution runtime)

### **Frontend Framework**
- **React**: 18.3.1 (Component-based UI)
- **Vite**: 5.4.9 (Build tool and dev server)
- **React Router**: 6.27.0 (Client-side routing)
- **TanStack Query**: 5.59.8 (Server state management)

### **Backend Framework**
- **Express.js**: 4.21.1 (Web server framework)
- **Passport.js**: 0.7.0 (Authentication middleware)
- **Express Session**: 1.18.1 (Session management)

### **Database Layer**
- **PostgreSQL**: Multi-instance (Primary database)
- **Drizzle ORM**: 0.39.1 (Type-safe database operations)
- **Drizzle Kit**: 0.30.4 (Schema management and migrations)
- **pg**: 8.16.2 (PostgreSQL driver)

### **Authentication & Security**
- **SAML 2.0**: `@node-saml/passport-saml` 4.0.4
- **bcrypt**: 5.1.1 (Password hashing)
- **CORS**: 2.8.5 (Cross-origin resource sharing)
- **Session Store**: PostgreSQL via `connect-pg-simple` 9.0.1

---

## 🏛️ **Architecture Pattern**

### **Multi-Tenant Model: Database-Per-Tenant**

EdSteward implements the **gold standard** database-per-tenant architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│  ┌─────────────────────────────────────────────────────┐│
│  │              Express.js Server                      ││
│  │    ┌─────────────┐  ┌─────────────┐                ││
│  │    │   Tenant    │  │   SAML      │                ││
│  │    │ Middleware  │  │   Auth      │                ││
│  │    └─────────────┘  └─────────────┘                ││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│                  Multi-Tenant Database Service           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Admin     │  │  Moravian   │  │   Staging   │      │
│  │  Database   │  │  Database   │  │  Database   │      │
│  │             │  │             │  │             │      │
│  │edsteward_   │  │edsteward_   │  │edsteward_   │      │
│  │   admin     │  │  moravian   │  │  staging    │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

#### **Database Isolation Strategy**
- **Physical Separation**: Each tenant has a dedicated PostgreSQL database
- **Connection Pooling**: Tenant-specific connection pools managed by `MultiTenantDatabaseService`
- **Complete Data Isolation**: Zero cross-tenant data access possible
- **Independent Scaling**: Per-tenant database optimization

#### **Tenant Routing**
- **Subdomain-based**: `admin.edsteward.ai`, `moravian.edsteward.ai`
- **Middleware Detection**: `server/middleware/tenant.ts` extracts tenant from request
- **Dynamic Database Selection**: Routes requests to appropriate tenant database

---

## 📊 **Database Architecture**

### **Current Database Instances**

| Tenant | Database Name | Purpose | Environment Variables |
|--------|---------------|---------|----------------------|
| **Admin** | `edsteward_admin` | Admin console, tenant management | `ADMIN_DATABASE_URL` |
| **Moravian** | `edsteward_moravian` | Moravian University production | `MORAVIAN_DATABASE_URL` |
| **Staging** | `edsteward_staging` | Testing environment | `STAGING_DATABASE_URL` |
| **Test** | `edsteward_test` | Development testing | `TEST_DATABASE_URL` |

### **Schema Structure**

#### **Core Tables** (`shared/schema.ts`)
```typescript
// User Management
- users: User accounts with SAML integration
- tenants: Tenant configuration and SAML settings

// Regulation Management  
- regulations: Regulatory requirements with versioning
- regulationVersions: Version history and change tracking
- regulationUpdates: MCP integration for regulatory changes

// Compliance Tracking
- deadlines: Compliance deadlines and notifications
- notes: Compliance notes and documentation
- evidenceFiles: Supporting documentation storage

// Notification System
- notifications: User notifications
- notificationQueue: Email/SMS notification queue

// System Management
- systemLogs: Audit trail and system events
- csvSchemas: Import/export schema definitions
```

#### **Key Features**
- **JSONB Columns**: Complex data structures (SAML config, tenant features)
- **Versioning Support**: Full audit trail for regulation changes
- **MCP Integration**: External regulatory data synchronization
- **File Management**: Evidence and document storage tracking

---

## 🎨 **Frontend Architecture**

### **React Application Structure**
```
client/src/
├── components/           # Reusable UI components
│   ├── ui/              # Radix UI component library
│   ├── layout/          # Navigation and page layout
│   ├── regulations/     # Regulation management
│   ├── admin/           # Admin console components
│   └── tenant/          # Tenant-specific components
├── pages/               # Route components
├── hooks/               # Custom React hooks
├── lib/                 # Utility libraries
├── types/               # TypeScript definitions
└── providers/           # Context providers
```

### **UI Component Library**
- **Radix UI**: Comprehensive accessible component primitives
- **TailwindCSS**: 3.4.14 with animations and typography
- **Shadcn/ui**: Design system built on Radix + Tailwind
- **Lucide React**: Icon library (0.454.0)
- **Framer Motion**: Animation library (11.18.2)

### **Advanced Components**
- **Monaco Editor**: Code editing capabilities
- **React Quill**: Rich text editing
- **Recharts**: Data visualization
- **React Hook Form**: Form management with validation
- **Date Picker**: Calendar and date selection

### **State Management**
- **TanStack Query**: Server state, caching, synchronization
- **React Context**: Global state management
- **React Router**: Navigation and routing
- **Local State**: Component-level state with hooks

---

## 🔐 **Authentication & Security**

### **SAML 2.0 Implementation**
```typescript
// SAML Configuration per Tenant
interface SAMLConfig {
  entityId: string;           // "urn:edsteward:sp:moravian"
  ssoUrl: string;            // OKTA SSO endpoint
  sloUrl: string;            // Single logout endpoint
  certificate: string;       // X.509 certificate
  attributeMapping: {        // User attribute mapping
    email: string;
    firstName: string;
    lastName: string;
    department: string;
    role: string;
  };
}
```

#### **Authentication Flow**
1. **Tenant Detection**: Subdomain extraction from request
2. **SAML Redirect**: Route to tenant-specific OKTA SSO
3. **Assertion Processing**: Validate SAML response and attributes
4. **User Provisioning**: Auto-create users from SAML attributes
5. **Session Management**: Secure session with database storage

#### **Security Features**
- **Domain Restrictions**: Email domain validation per tenant
- **SSL/TLS**: End-to-end encryption in transit
- **Session Security**: HttpOnly, Secure, SameSite cookies
- **CSRF Protection**: Express session middleware
- **SQL Injection Prevention**: Prepared statements via Drizzle ORM

---

## ☁️ **Cloud Infrastructure (AWS)**

### **Container Orchestration**
- **AWS ECS (Elastic Container Service)**: Container orchestration
- **AWS ECR (Elastic Container Registry)**: Docker image storage
- **Application Load Balancer**: Traffic distribution and SSL termination
- **Auto Scaling**: Dynamic scaling based on demand

### **Database Infrastructure**
- **Amazon RDS**: Managed PostgreSQL instances
- **VPC Configuration**: Private subnet isolation
- **Security Groups**: Network-level access control
- **SSL/TLS**: Encrypted database connections

### **Storage Services**
- **AWS S3**: File storage for evidence documents
- **EFS (Elastic File System)**: Shared storage for container data
- **Parameter Store**: Configuration management

### **Deployment Environments**

| Environment | ECS Cluster | Service | Domain |
|------------|-------------|---------|--------|
| **Production** | `edsteward-cluster` | `edsteward-service` | `moravian.edsteward.ai` |
| **Staging** | `edsteward-multi-tenant-staging-cluster` | `edsteward-multi-tenant-staging-service` | `staging.edsteward.ai` |
| **Dev** | `edsteward-multi-tenant-dev-cluster` | `edsteward-multi-tenant-dev-service` | `dev.edsteward.ai` |

---

## 🚀 **DevOps & CI/CD**

### **GitHub Actions Pipeline** (`.github/workflows/deploy.yml`)

#### **Workflow Triggers**
- **Production**: `main` branch push
- **Staging**: `staging` or `ES-clientside` branch push  
- **Development**: `dev` branch push

#### **Pipeline Stages**
```yaml
1. Test Stage:
   - Node.js 18 setup
   - Dependencies installation (npm ci --legacy-peer-deps)
   - Test execution (npm test)
   - Frontend build verification

2. Build Stage:
   - Docker multi-stage build
   - Platform: linux/amd64 (AWS compatibility)
   - ECR authentication and push
   - Image tagging strategy

3. Deploy Stage:
   - ECS service update
   - Force new deployment
   - Rolling update strategy
```

#### **Container Build Strategy**
```dockerfile
# Multi-stage Docker build
FROM node:18-alpine AS base
FROM base AS deps         # Production dependencies
FROM base AS builder      # Build stage  
FROM base AS runner       # Production runtime
```

### **Build Tools & Development**
- **Vite**: Fast development server and build tool
- **ESLint**: Code linting with TypeScript support
- **TypeScript Compiler**: Type checking and compilation
- **Docker**: Containerization for consistent deployments

---

## 📡 **API Architecture**

### **RESTful API Structure**
```
/api/
├── auth/                 # Authentication endpoints
│   ├── /login           # Local authentication
│   ├── /saml/           # SAML endpoints per tenant
│   └── /logout          # Session termination
├── admin/               # Admin console APIs
├── regulations/         # Regulation management
├── deadlines/           # Deadline tracking  
├── notes/               # Notes and documentation
├── evidence/            # File upload and management
├── notifications/       # Notification system
└── health              # Health check endpoint
```

### **Multi-Tenant API Routing**
- **Tenant Middleware**: Request interception and tenant identification
- **Database Routing**: Dynamic connection to tenant-specific databases
- **CORS Configuration**: Cross-origin support for subdomains
- **Error Handling**: Centralized error processing and logging

---

## 🔍 **Monitoring & Observability**

### **Application Monitoring**
- **Health Checks**: `/api/health` endpoint for container health
- **Database Health**: Per-tenant connection monitoring
- **System Logs**: Comprehensive logging via `systemLogs` table
- **Deadline Notifications**: Automated compliance monitoring

### **Infrastructure Monitoring**
- **ECS Service Metrics**: Container performance and scaling
- **RDS Monitoring**: Database performance and connections
- **Load Balancer Metrics**: Traffic distribution and health
- **CloudWatch Logs**: Centralized log aggregation

---

## 📦 **External Integrations**

### **Regulatory Data Sources (MCP)**
- **Model Control Panel**: External regulatory update integration
- **API Synchronization**: Automated regulation version updates
- **Validation Levels**: A/B/C/D validation hierarchy
- **Conflict Resolution**: Manual and automatic change resolution

### **Communication Services**
- **AWS SES**: Transactional email delivery
- **Twilio**: SMS notifications for critical deadlines
- **OpenAI**: AI-powered content analysis and generation

### **File Management**
- **AWS S3**: Evidence file storage with presigned URLs
- **Multer**: File upload handling and validation
- **PDF Processing**: Document parsing and analysis

---

## 🔧 **Development Environment**

### **Local Development Setup**
```bash
# Required Environment Variables
DATABASE_URL=postgresql://...        # Primary database
ADMIN_DATABASE_URL=postgresql://...  # Admin tenant
MORAVIAN_DATABASE_URL=postgresql://... # Moravian tenant
SESSION_SECRET=<256-bit-random>      # Session encryption
```

### **Development Scripts**
```json
{
  "dev": "tsx server/index.ts",           // Development server
  "build": "vite build",                  // Production build
  "db:push": "drizzle-kit push",          // Schema deployment
  "db:setup": "tsx server/create-notes-table.ts", // DB initialization
  "lint": "eslint . --max-warnings 0",    // Code linting
  "test": "npm run test:health && npm run test:build" // Testing
}
```

### **Code Quality Tools**
- **ESLint**: TypeScript and React linting rules
- **TypeScript**: Strict type checking configuration
- **Prettier**: Code formatting (via ESLint integration)
- **Git Hooks**: Pre-commit quality checks

---

## 📈 **Performance & Scalability**

### **Database Optimization**
- **Connection Pooling**: Per-tenant pool management
- **Query Optimization**: Drizzle ORM with prepared statements
- **Indexing Strategy**: Performance-critical table indexes
- **Database Migrations**: Schema evolution management

### **Frontend Optimization**  
- **Code Splitting**: Dynamic imports and lazy loading
- **Asset Optimization**: Vite build optimizations
- **Caching Strategy**: TanStack Query with stale-while-revalidate
- **Bundle Analysis**: Build size monitoring

### **Infrastructure Scaling**
- **Auto Scaling Groups**: Dynamic ECS scaling
- **Load Balancing**: Multi-AZ traffic distribution
- **Database Scaling**: RDS read replicas and connection pooling
- **CDN Strategy**: Static asset delivery optimization

---

## 🛡️ **Security Considerations**

### **Data Protection**
- **Encryption at Rest**: RDS encryption and S3 bucket encryption
- **Encryption in Transit**: TLS 1.2+ for all communications
- **Database Isolation**: Physical separation prevents data leakage
- **Access Controls**: Role-based permissions per tenant

### **Authentication Security**
- **SAML 2.0**: Industry-standard enterprise SSO
- **Certificate Validation**: X.509 certificate verification
- **Session Security**: Secure, HttpOnly, SameSite cookies
- **Domain Validation**: Email domain restrictions per tenant

### **Infrastructure Security**
- **VPC Isolation**: Private subnet for database instances
- **Security Groups**: Network-level access controls
- **IAM Roles**: Least-privilege AWS access
- **Container Security**: Non-root user execution

---

## 📋 **Deployment Checklist**

### **Pre-Deployment Requirements**
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] SAML configuration validated
- [ ] Health checks passing

### **Production Deployment Process**
1. **Code Review**: GitHub PR review and approval
2. **Automated Testing**: CI pipeline validation
3. **Container Build**: Multi-stage Docker build
4. **Registry Push**: ECR image deployment
5. **ECS Update**: Rolling deployment execution
6. **Health Validation**: Post-deployment verification

---

## 🎯 **Future Roadmap**

### **Planned Enhancements**
- **Advanced Analytics**: Compliance dashboard and reporting
- **API Versioning**: Backward-compatible API evolution
- **Mobile Application**: React Native compliance app
- **Advanced Notifications**: Intelligent deadline prediction
- **Integration Hub**: Third-party compliance tool integrations

### **Technical Debt Reduction**
- **Type Safety**: Complete TypeScript coverage
- **Test Coverage**: Comprehensive unit and integration tests
- **Documentation**: API documentation generation
- **Performance Monitoring**: Advanced observability stack

---

## 📚 **Documentation References**

- **Setup Guide**: `MORAVIAN_SAML_OKTA_SETUP_GUIDE.md`
- **Deployment Guide**: `DEPLOYMENT_GUIDE.md`
- **Multi-Tenant Architecture**: `MULTI_TENANT_ARCHITECTURE.md`
- **Database Migration**: `RDS_MIGRATION_GUIDE.md`
- **Development Workflow**: `DEVELOPMENT_WORKFLOW.md`

---

## 👥 **Team & Contacts**

**Project**: EdSteward Regulatory Compliance Platform  
**Architecture**: Multi-Tenant SaaS with Database-Per-Tenant Isolation  
**Primary Technology**: TypeScript, React, Node.js, PostgreSQL, AWS  
**Authentication**: SAML 2.0 with OKTA Integration  
**Deployment**: Containerized AWS ECS with Auto-Scaling  

---

*This architecture documentation is maintained alongside the codebase and updated with each major release. For technical questions or architecture discussions, please refer to the team leads and senior developers.* 