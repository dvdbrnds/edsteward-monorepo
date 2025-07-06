## ECS Task Definition for Your Docker Container

### Sample ECS Task Definition
```json
{
  "family": "edsteward-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/edsteward-task-role",
  "containerDefinitions": [
    {
      "name": "edsteward-app",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/edsteward:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "MULTI_TENANT",
          "value": "true"
        },
        {
          "name": "DB_HOST",
          "value": "edsteward-aurora.cluster-xyz.region.rds.amazonaws.com"
        }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:edsteward-db-password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/edsteward",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## Cost Comparison for Single Domain Multi-Tenancy

| Component | Single Domain Multi-Tenant | Subdomain Per Tenant | Savings |
|-----------|---------------------------|---------------------|---------|
| **ALB** | 1 ALB ($16/month) | 1 ALB ($16/month) | $0 |
| **ECS Service** | 1 Service (~$30/month) | N Services (~$30N/month) | $30 × (N-1) |
| **SSL Certificates** | 1 Certificate (Free ACM) | 1 Wildcard or N Certs | $0-13N/month |
| **Operational Overhead** | Single deployment | N deployments | Significant |
| **Database** | N tenant DBs (~$15N/month) | N tenant DBs (~$15N/month) | $0 |

**Total Monthly Cost:**
- **Single Domain**: ~$46 + $15N (where N = number of tenants)
- **Subdomain Approach**: ~$16 + $45N 
- **Savings**: ~$30 × (N-1) per month + reduced operational complexity

For your EdSteward SaaS platform, **single domain multi-tenancy with ECS Fargate** provides the best balance of cost efficiency, user experience, and operational simplicity.# Docker to AWS Multi-Tenant Migration Options

## Option 1: ECS Fargate with ALB (Recommended for Your Use Case)

**Best for**: Quick deployment, managed infrastructure, cost-effective scaling

### Architecture
- **Application Load Balancer (ALB)** with host-based routing
- **ECS Fargate** for containerized app instances
- **RDS Aurora PostgreSQL** with database-per-tenant
- **Route 53** for DNS management
- **ACM** for SSL certificates

### Implementation Steps
1. **Container Registry**: Push Docker image to ECR
2. **Networking**: Create VPC with public/private subnets
3. **Database**: Deploy RDS Aurora with tenant isolation
4. **Container Orchestration**: ECS cluster with Fargate
5. **Load Balancing**: ALB with tenant-specific routing
6. **DNS**: Route 53 for subdomain management

### Tenant Isolation Model
```
customer1.edsteward.ai → ECS Task 1 → Database: customer1_db
customer2.edsteward.ai → ECS Task 2 → Database: customer2_db
admin.edsteward.ai     → ECS Task 3 → Database: admin_db
```

### Pros
- **Fast deployment** (matches your deployment checklist)
- **Automatic scaling** based on demand
- **Strong tenant isolation** (separate containers & databases)
- **Managed infrastructure** (less operational overhead)
- **Cost-effective** for small to medium workloads

### Cons
- Higher per-tenant cost at scale
- More complex database management

---

## Option 2: EKS with Namespace Isolation

**Best for**: Advanced container orchestration, high scalability needs

### Architecture
- **EKS cluster** with node groups
- **Kubernetes namespaces** for tenant isolation
- **NGINX Ingress Controller** or AWS Load Balancer Controller
- **RDS Aurora** with shared database + tenant schemas

### Implementation Steps
1. **EKS Setup**: Create managed Kubernetes cluster
2. **Namespace Strategy**: One namespace per tenant
3. **Ingress Configuration**: Route traffic based on host headers
4. **Database Schema**: Multi-tenant database with row-level security
5. **RBAC**: Kubernetes role-based access control

### Pros
- **Ultimate scalability** and orchestration features
- **Fine-grained resource control**
- **Advanced deployment strategies** (blue-green, canary)
- **Kubernetes ecosystem** benefits

### Cons
- **Steep learning curve** if new to Kubernetes
- **Higher operational complexity**
- **More setup time** initially

---

## Option 3: Lambda + API Gateway (Serverless)

**Best for**: Variable/sporadic usage, cost optimization

### Architecture
- **API Gateway** with custom domain routing
- **Lambda functions** for application logic
- **RDS Aurora Serverless** for database
- **S3** for static assets and file storage

### Implementation Steps
1. **Containerize for Lambda**: Use Lambda container images
2. **API Gateway Setup**: Custom domain with path-based routing
3. **Lambda Deployment**: One function per tenant or shared with tenant context
4. **Database**: Aurora Serverless with tenant isolation

### Pros
- **Pay-per-request** pricing model
- **Zero infrastructure management**
- **Automatic scaling** to zero
- **Perfect for compliance/audit workloads** (sporadic usage)

### Cons
- **Cold start latency** for infrequent use
- **15-minute execution limit**
- **Requires application refactoring**

---

## Option 4: Lightsail Containers (Simplest Start)

**Best for**: Quick proof of concept, minimal AWS learning curve

### Architecture
- **Lightsail container service** per tenant
- **Lightsail databases** for each tenant
- **Load balancer** for traffic distribution

### Pros
- **Simplest AWS option** - almost like managed Docker hosting
- **Predictable pricing**
- **Easy migration path** from local Docker
- **Built-in load balancing**

### Cons
- **Limited scalability** options
- **Fewer advanced AWS integrations**
- **Fixed pricing** regardless of usage

---

## Recommended Approach: ECS Fargate with Single Domain Multi-Tenancy

Based on your EdSteward compliance tracker system and your requirement for single domain (`edsteward.ai`) with tenant selection at login, **ECS Fargate with ALB and application-level multi-tenancy** is the optimal choice because:

### 1. **Aligns with Your Current Docker Container**
- Your existing Docker container runs perfectly as-is
- Minimal infrastructure changes required
- Application-level modifications for tenant awareness
- Supports your PostgreSQL database requirements

### 2. **Single Domain Multi-Tenant Strategy**
```
User Flow:
edsteward.ai → Login/Tenant Selection → Tenant Context
  ↓
user@university1.edu → University 1 SAML → University 1 Database
user@university2.edu → University 2 SAML → University 2 Database
admin@edsteward.ai → Admin Portal → Admin Database

Architecture:
Single ALB (edsteward.ai) → Single ECS Service → Multiple Tenant Databases
```

### 3. **Application-Level Multi-Tenancy Implementation**
```javascript
// Tenant detection middleware
app.use(tenantDetection); // Detects tenant from email domain or selection

// Dynamic database connections
const dbConnection = getTenantDatabase(req.tenant);

// Tenant-specific SAML configurations  
const samlConfig = getTenantSAMLConfig(req.tenant);
```

### 4. **Implementation Timeline**
- **Week 1**: Infrastructure setup (VPC, RDS, ECR, ECS)
- **Week 2**: Docker container deployment to ECS
- **Week 3**: Application multi-tenancy modifications
- **Week 4**: SAML integration and tenant onboarding automation

### 5. **Cost Structure**
- **Base infrastructure**: ~$75-125/month (ALB, ECS, RDS)
- **Per-tenant database costs**: ~$15-25/month (db.t3.micro per tenant)
- **Single ECS service**: Scales with usage, not tenant count
- **Much more cost-effective** than separate containers per tenant

### 6. **Operational Benefits**
- **Single application deployment** for all tenants
- **Centralized monitoring** and logging
- **Simplified SSL management** (single certificate for edsteward.ai)
- **Easier SAML integration** (tenant-specific configs in application)
- **Better user experience** (single URL to remember)

---

## Application Modifications Required for Multi-Tenancy

### 1. **Tenant Detection and Context Management**
```javascript
// middleware/tenantDetection.js
const detectTenant = (req, res, next) => {
  // Method 1: Email domain detection
  if (req.user?.email) {
    req.tenant = extractTenantFromEmail(req.user.email);
  }
  
  // Method 2: Session-based tenant selection
  if (req.session?.selectedTenant) {
    req.tenant = req.session.selectedTenant;
  }
  
  // Method 3: URL parameter for admin operations
  if (req.query.tenant && isAdmin(req.user)) {
    req.tenant = req.query.tenant;
  }
  
  next();
};
```

### 2. **Dynamic Database Connections**
```javascript
// services/database.js
const getTenantDatabase = (tenantId) => {
  return knex({
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      database: `edsteward_${tenantId}`,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    },
    pool: { min: 0, max: 10 }
  });
};

// Use in routes
app.get('/api/regulations', tenantDetection, async (req, res) => {
  const db = getTenantDatabase(req.tenant);
  const regulations = await db('regulations').select('*');
  res.json(regulations);
});
```

### 3. **Multi-Tenant SAML Configuration**
```javascript
// services/auth.js
const tenantSAMLConfigs = {
  'university1': {
    entryPoint: 'https://university1.edu/saml/sso',
    cert: process.env.UNIVERSITY1_SAML_CERT,
    issuer: 'university1-edsteward'
  },
  'university2': {
    entryPoint: 'https://university2.edu/saml/sso',
    cert: process.env.UNIVERSITY2_SAML_CERT,
    issuer: 'university2-edsteward'
  }
};

// Dynamic SAML strategy
app.get('/auth/saml/:tenant', (req, res, next) => {
  const config = tenantSAMLConfigs[req.params.tenant];
  const strategy = new SamlStrategy(config, handleSAMLResponse);
  passport.authenticate(strategy)(req, res, next);
});
```

### 4. **Tenant Management Interface**
```javascript
// routes/tenants.js (Admin only)
app.post('/api/admin/tenants', async (req, res) => {
  const { tenantId, name, domain, samlConfig } = req.body;
  
  // Create tenant database
  await createTenantDatabase(tenantId);
  
  // Store tenant configuration
  await storeTenantConfig(tenantId, { name, domain, samlConfig });
  
  // Run database migrations for new tenant
  await runTenantMigrations(tenantId);
  
  res.json({ success: true, tenantId });
});
```

---

## Docker to ECS Migration Checklist

### Phase 1: Infrastructure Setup (Week 1)
- [ ] Create AWS account and configure IAM
- [ ] Set up VPC with public/private subnets  
- [ ] Deploy RDS Aurora PostgreSQL cluster
- [ ] Create ECR repository for Docker images
- [ ] Configure Route 53 hosted zone for edsteward.ai
- [ ] Set up ACM certificate for edsteward.ai

### Phase 2: Docker Container to ECS (Week 2)
- [ ] Analyze current Docker container requirements
- [ ] Create ECS-compatible Dockerfile (if modifications needed)
- [ ] Push Docker image to ECR
- [ ] Create ECS cluster with Fargate
- [ ] Configure ECS task definition with environment variables
- [ ] Deploy ECS service with single instance
- [ ] Test container connectivity to RDS

### Phase 3: Application Multi-Tenancy (Week 3)
- [ ] Implement tenant detection middleware
- [ ] Add dynamic database connection logic
- [ ] Create tenant configuration management
- [ ] Modify authentication to support multiple SAML configs
- [ ] Add tenant isolation to all database queries
- [ ] Create tenant onboarding API endpoints
- [ ] Test multi-tenant functionality locally

### Phase 4: Load Balancing & Production Deployment (Week 4)
- [ ] Deploy Application Load Balancer
- [ ] Configure target groups for ECS service
- [ ] Set up DNS routing for edsteward.ai
- [ ] Deploy updated multi-tenant application
- [ ] Create first tenant (your university)
- [ ] Test end-to-end tenant isolation
- [ ] Set up monitoring and alerting
- [ ] Document tenant onboarding process

### Phase 5: Tenant Automation & Scaling (Week 5)
- [ ] Create automated tenant database provisioning
- [ ] Build tenant management admin interface
- [ ] Implement tenant-specific backup strategies
- [ ] Add usage monitoring per tenant
- [ ] Create tenant billing/usage tracking
- [ ] Set up automated scaling policies
- [ ] Document operational procedures