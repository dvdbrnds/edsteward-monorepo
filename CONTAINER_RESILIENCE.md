# Docker Container Resilience Guide

## Overview
The EdSteward Docker container has been enhanced with comprehensive resilience features to ensure reliable startup, operation, and recovery from failures.

## Resilience Features Implemented

### 1. **Health Checks & Monitoring**
- **Docker Health Check**: Built-in health check every 30s with `/api/health` endpoint
- **Enhanced Health Endpoint**: Returns detailed database and server status
- **Database Health Monitoring**: Continuous monitoring with failure tracking
- **Restart Policy**: `unless-stopped` ensures automatic restart on failure

### 2. **Startup Resilience**
- **Database Connection Retry**: Progressive backoff with 3 retry attempts
- **Schema Validation**: Ensures database schema exists before starting
- **Environment Validation**: Checks required environment variables
- **Graceful Fallbacks**: Application continues if non-critical services fail

### 3. **Security Enhancements**
- **Non-root User**: Runs as `nextjs` user (uid:1001) for security
- **Init System**: Uses `tini` for proper signal handling and zombie reaping
- **Resource Limits**: Memory limits (2GB max, 512MB reserved)
- **Proper Permissions**: Correct file ownership and permissions

### 4. **Configuration Management**
- **Environment Variables**: Externalized configuration via `.env` files
- **Docker Compose Override**: Environment-specific configurations
- **Template Files**: `.env.example` for easy setup
- **No Hardcoded Secrets**: All credentials from environment

## Files Modified/Created

### Core Configuration
- `docker-compose.dev.yml` - Added health checks, restart policy, resource limits
- `Dockerfile.dev` - Enhanced with security and resilience features
- `server/routes/index.ts` - Enhanced `/api/health` endpoint with database status

### Templates & Documentation
- `.env.example` - Environment variable template
- `docker-compose.override.yml` - Environment-specific overrides
- `scripts/docker-entrypoint.sh` - Robust startup script (for future use)

## Health Check Details

The `/api/health` endpoint now returns:
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2025-06-18T12:37:59.633Z",
  "server": "running",
  "database": {
    "connected": true,
    "monitoring": true,
    "consecutiveFailures": 0,
    "maxFailures": 3
  }
}
```

## Usage

### Starting the Container
```bash
# With default configuration
docker-compose -f docker-compose.dev.yml up -d

# With environment file
cp .env.example .env
# Edit .env with your values
docker-compose -f docker-compose.dev.yml up -d
```

### Monitoring Health
```bash
# Check container health
docker ps
# Check detailed health
curl http://localhost:3000/api/health
# Check Docker health status
docker inspect --format='{{.State.Health.Status}}' edsteward-app-1
```

### Logs & Debugging
```bash
# View startup logs
docker logs edsteward-app-1

# Follow logs in real-time
docker logs -f edsteward-app-1

# Check resource usage
docker stats edsteward-app-1
```

## Failure Scenarios Handled

1. **Database Connection Loss**: Health monitoring detects and logs failures
2. **Container Crashes**: Automatic restart via `unless-stopped` policy
3. **Memory Issues**: Resource limits prevent container from consuming all memory
4. **Startup Failures**: Retry logic and graceful fallbacks
5. **Signal Handling**: Proper cleanup on shutdown via `tini`

## Security Improvements

- Runs as non-root user `nextjs:nodejs`
- Uses Alpine Linux for minimal attack surface
- No hardcoded credentials in container
- Proper file permissions and ownership
- Init system prevents zombie processes

## Performance Optimizations

- Connection pooling for database
- Resource limits prevent runaway processes
- Health check intervals optimized (30s)
- Cached Docker layers for faster rebuilds

## Testing the Setup

1. **Health Check**: `curl http://localhost:3000/api/health`
2. **Login Test**: Use credentials `developer:admin123` or `testuser:test123`
3. **Restart Test**: `docker restart edsteward-app-1`
4. **Resource Test**: Monitor with `docker stats`

## Next Steps for Production

1. Use environment-specific configurations
2. Implement log aggregation
3. Add monitoring and alerting
4. Use secrets management (Docker secrets, K8s secrets)
5. Implement backup and disaster recovery
6. Load balancing and horizontal scaling

## Troubleshooting

### Container Won't Start
- Check logs: `docker logs edsteward-app-1`
- Verify environment variables in `.env`
- Ensure database connectivity
- Check file permissions

### Health Check Failing
- Verify database connection
- Check application logs
- Ensure port 3000 is accessible
- Test endpoint manually

### Memory Issues
- Adjust resource limits in docker-compose.yml
- Monitor usage with `docker stats`
- Check for memory leaks in logs

## Configuration Examples

### Development
```yaml
# docker-compose.dev.yml
restart: unless-stopped
healthcheck:
  interval: 30s
  timeout: 10s
  retries: 3
```

### Production
```yaml
# docker-compose.prod.yml
restart: always
healthcheck:
  interval: 10s
  timeout: 5s
  retries: 5
deploy:
  resources:
    limits:
      memory: 4g
    reservations:
      memory: 1g
```

This resilient setup ensures your EdSteward application can handle various failure scenarios and automatically recover, providing a stable development and production environment. 