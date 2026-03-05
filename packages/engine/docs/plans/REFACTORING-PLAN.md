# MCP Engine Refactoring Plan

## **Directory Structure Reorganization**

### Current Issues:
- 20+ directories at src/ root level
- Mixed naming conventions (kebab-case, camelCase)
- Test files mixed with source code
- Inconsistent module organization

### Proposed New Structure:
```
src/
├── core/                     # Core application infrastructure
│   ├── server-factory.js     # ✅ CREATED - Express server factory
│   ├── config/              # Configuration management
│   ├── constants.js         # Application constants
│   └── error-types.js       # Error definitions
├── features/                # Feature-based modules
│   ├── compliance/          # Compliance processing
│   ├── regulations/         # Regulation management
│   ├── validation/          # Validation services
│   └── admin/              # Admin functionality
├── shared/                  # Shared utilities and services
│   ├── database/           # Database access layer
│   ├── middleware/         # Express middleware
│   ├── utils/              # Utility functions
│   └── services/           # Shared business services
├── api/                    # API layer
│   ├── routes/             # Route definitions
│   ├── controllers/        # Request handlers
│   └── schemas/            # Request/response schemas
├── workers/                # Background workers
│   ├── queue/              # Queue processing
│   └── cdc/                # Change data capture
├── gateways/              # External service gateways
│   ├── llm-gateway/        # LLM gateway service
│   └── mcp-gateway/        # MCP protocol gateway
├── client/                # Frontend application
└── __tests__/             # All test files
```

## **Critical Refactoring Priorities**

### **Priority 1: Server Factory Implementation**
- ✅ **CREATED**: `src/core/server-factory.js`
- **Next**: Refactor all Express apps to use factory
- **Impact**: Eliminates 15+ duplicate server setups

### **Priority 2: Service Layer Architecture**
Current: Mixed business logic in routes and controllers
Proposed: Proper service layer with dependency injection

### **Priority 3: Database Layer Refactoring**
Current: Mixed data access patterns
Proposed: Repository pattern with proper abstractions

### **Priority 4: Configuration Management**
Current: Scattered config logic across files
Proposed: Centralized configuration with validation

### **Priority 5: Error Handling Standardization**
Current: Inconsistent error patterns
Proposed: Unified error handling with custom error types

## **Implementation Steps**

### **Phase 1: Core Infrastructure (Week 1)**
1. ✅ Create server factory
2. Implement configuration management
3. Standardize error handling
4. Create shared utilities

### **Phase 2: Service Layer (Week 2)**
1. Extract compliance processing service
2. Create regulation service
3. Implement repository pattern
4. Add dependency injection

### **Phase 3: API Standardization (Week 3)**
1. Refactor all routes to use new patterns
2. Implement consistent response formats
3. Add proper input validation
4. Standardize authentication

### **Phase 4: Testing & Documentation (Week 4)**
1. Move all tests to __tests__ directory
2. Add integration tests
3. Update documentation
4. Performance optimization

## **File-by-File Refactoring Plan**

### **Immediate Actions Needed:**

#### **Remove Empty Files:**
- `src/routes/notifications.js` (0 bytes)
- `src/routes/regulations.js` (0 bytes)
- `src/routes/sync.js` (0 bytes)
- `src/server.js` (0 bytes)
- `src/temp_file.txt` (0 bytes)

#### **Consolidate Authentication:**
- Merge `src/middleware/authentication.js` & `src/middleware/authMiddleware.js`
- Create single auth strategy

#### **Large Files to Break Down:**
- `src/services/compliance-processor.js` (303 lines) → Split into multiple services
- `src/database/connection.js` (200 lines) → Separate repository classes
- `src/llm-gateway/start-llm-gateway.js` (256 lines) → Extract route handlers

#### **Refactor Express Apps (15+ files):**
All these files should use the new server factory:
- `src/app.js`
- `src/simple-admin-server.js`
- `src/mock-server.js`
- `src/llm-gateway/start-llm-gateway.js`
- `src/llm-gateway/llm-gateway-service.js`
- `src/batch/start-batch-server.js`
- `src/server/registry-api/registry-server.js`
- `src/regulation-server/base-regulation-server-entry.js`
- And 7+ more...

## **Benefits Expected**

### **Code Quality:**
- 60% reduction in code duplication
- Consistent error handling across all services
- Improved testability with dependency injection
- Better separation of concerns

### **Maintainability:**
- Clear feature boundaries
- Standardized patterns across codebase
- Easier onboarding for new developers
- Reduced cognitive load

### **Performance:**
- Better resource management
- Optimized database connections
- Reduced startup time
- Improved error recovery

### **Security:**
- Standardized authentication
- Consistent input validation
- Better audit trails
- Improved error information disclosure

## **Risk Mitigation**

### **Testing Strategy:**
- Maintain backward compatibility during transition
- Comprehensive integration tests
- Gradual migration approach
- Rollback plans for each phase

### **Migration Strategy:**
- Feature flags for new implementations
- Parallel running during transition
- Comprehensive monitoring
- User acceptance testing 