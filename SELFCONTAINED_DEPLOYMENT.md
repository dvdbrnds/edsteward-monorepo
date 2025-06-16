# RegulatoryTrackr Self-Contained Deployment

This setup includes **everything in Docker containers**: Frontend, Backend, PostgreSQL Database, and Redis.

## 🎯 What This Includes

- **Frontend**: Vite-built React application
- **Backend**: Node.js/Express API server  
- **Database**: PostgreSQL 15 with all 367 regulations
- **Cache**: Redis for sessions and caching
- **All data included**: Complete schema + regulations + users

## 🚀 Quick Start

```bash
# Start everything (builds containers if needed)
./start-selfcontained.sh

# Fresh start (removes all data and starts clean)
./start-selfcontained.sh --fresh
```

## 📋 Prerequisites

- Docker and Docker Compose installed
- 8GB+ available disk space
- Ports 3000, 5432, 6379 available

## 🔧 Configuration

### Database Configuration
- **Host**: postgres (internal) / localhost (external)
- **Port**: 5432
- **Database**: regulatorytrackr  
- **Username**: reguser
- **Password**: reg_secure_pass_2024

### Redis Configuration
- **Host**: redis (internal) / localhost (external)
- **Port**: 6379
- **Password**: redis_secure_pass_2024

### Application Configuration
- **URL**: http://localhost:3000
- **Environment**: Production
- **Session**: Secure with Redis backend

## 📁 File Structure

```
├── docker-compose.production.yml    # Main container orchestration
├── Dockerfile.selfcontained        # Application container definition
├── sql_dump/
│   ├── init_schema.sql             # Database schema (clean)
│   ├── complete_regulations_data.sql # All 367 regulations
│   └── users_data.sql              # User accounts
├── start-selfcontained.sh          # Startup script
└── logs/                           # Application logs (mounted)
```

## 🐳 Docker Services

### 1. PostgreSQL Container
- **Image**: postgres:15-alpine
- **Auto-loads**: Schema + 367 regulations + users
- **Persistent storage**: postgres_data volume
- **Health checks**: Built-in

### 2. Redis Container  
- **Image**: redis:7-alpine
- **Persistent storage**: redis_data volume
- **Password protected**: redis_secure_pass_2024

### 3. Application Container
- **Built from**: Dockerfile.selfcontained
- **Includes**: Frontend + Backend + Node.js
- **Health checks**: HTTP endpoint monitoring
- **Depends on**: PostgreSQL + Redis (waits for healthy)

## 🔍 Monitoring & Logs

```bash
# View all service status
docker-compose -f docker-compose.production.yml ps

# Follow all logs
docker-compose -f docker-compose.production.yml logs -f

# View specific service logs
docker-compose -f docker-compose.production.yml logs -f app
docker-compose -f docker-compose.production.yml logs -f postgres
docker-compose -f docker-compose.production.yml logs -f redis

# Check health status
docker-compose -f docker-compose.production.yml exec app node -e "require('http').get('http://localhost:3000/health', (res) => console.log('Status:', res.statusCode))"
```

## 🛠️ Management Commands

```bash
# Start services
docker-compose -f docker-compose.production.yml up -d

# Stop services  
docker-compose -f docker-compose.production.yml down

# Rebuild application
docker-compose -f docker-compose.production.yml up --build -d

# Access database directly
docker-compose -f docker-compose.production.yml exec postgres psql -U reguser -d regulatorytrackr

# Access Redis directly
docker-compose -f docker-compose.production.yml exec redis redis-cli -a redis_secure_pass_2024

# Clean restart with fresh data
docker-compose -f docker-compose.production.yml down -v
./start-selfcontained.sh --fresh
```

## 🔒 Security Features

- **Non-root containers**: All services run as non-root users
- **Password protection**: Database and Redis require authentication  
- **Health monitoring**: All services have health checks
- **Volume persistence**: Data survives container restarts
- **Network isolation**: Services communicate on private network

## 📊 Data & Schema

### Regulations Table (367 records)
- ✅ All 46 columns including JSONB fields
- ✅ Complete data: names, categories, actions, filing_deadlines
- ✅ Proper indexing for performance
- ✅ Foreign key relationships

### Additional Tables
- Users (authentication)
- Comments, Notes, Deadlines
- Evidence Files, Notifications
- System Logs, Session storage

## 🚀 AWS Deployment (Optional)

This self-contained setup can be deployed to AWS in several ways:

### Option 1: ECS with Docker Compose
```bash
# Convert to ECS format
docker-compose -f docker-compose.production.yml config > ecs-task-definition.json
```

### Option 2: EC2 with Docker
```bash
# Simply copy files and run
scp -r . ec2-user@your-instance:/home/ec2-user/regulatorytrackr/
ssh ec2-user@your-instance "cd regulatorytrackr && ./start-selfcontained.sh"
```

### Option 3: Kubernetes
```bash
# Convert to Kubernetes manifests
kompose convert -f docker-compose.production.yml
```

## 🔧 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using ports
   lsof -i :3000
   lsof -i :5432
   lsof -i :6379
   ```

2. **Database Connection Issues**
   ```bash
   # Check database logs
   docker-compose -f docker-compose.production.yml logs postgres
   
   # Test connection
   docker-compose -f docker-compose.production.yml exec postgres pg_isready -U reguser
   ```

3. **Application Won't Start**
   ```bash
   # Check application logs
   docker-compose -f docker-compose.production.yml logs app
   
   # Rebuild containers
   docker-compose -f docker-compose.production.yml up --build --force-recreate
   ```

4. **Data Issues**
   ```bash
   # Fresh start
   ./start-selfcontained.sh --fresh
   
   # Check data loaded
   docker-compose -f docker-compose.production.yml exec postgres psql -U reguser -d regulatorytrackr -c "SELECT COUNT(*) FROM regulations;"
   ```

## ✅ Success Verification

After startup, verify everything works:

1. **Application**: http://localhost:3000 should load
2. **Database**: Should have 367 regulations
3. **Health Check**: http://localhost:3000/health should return 200
4. **API**: http://localhost:3000/api/regulations should return data

Expected output:
```bash
curl http://localhost:3000/api/regulations | jq '.length'
# Should return: 367
```

## 💾 Backup & Restore

### Backup
```bash
# Backup database
docker-compose -f docker-compose.production.yml exec postgres pg_dump -U reguser regulatorytrackr > backup.sql

# Backup volumes
docker run --rm -v regulatorytrackr_postgres_data:/data -v $(pwd):/backup ubuntu tar czf /backup/postgres_backup.tar.gz /data
```

### Restore
```bash
# Restore database
docker-compose -f docker-compose.production.yml exec -T postgres psql -U reguser regulatorytrackr < backup.sql

# Restore volumes
docker run --rm -v regulatorytrackr_postgres_data:/data -v $(pwd):/backup ubuntu tar xzf /backup/postgres_backup.tar.gz -C /
``` 