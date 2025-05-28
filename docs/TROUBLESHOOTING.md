# MCP Engine Troubleshooting Guide

## Overview

This guide provides solutions to common issues encountered when developing, deploying, and operating the MCP Engine. Issues are organized by category with step-by-step resolution procedures.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Service Startup Issues](#service-startup-issues)
- [API and Network Issues](#api-and-network-issues)
- [Database and Caching Issues](#database-and-caching-issues)
- [Authentication and Security Issues](#authentication-and-security-issues)
- [Performance Issues](#performance-issues)
- [Kubernetes-Specific Issues](#kubernetes-specific-issues)
- [Development Environment Issues](#development-environment-issues)
- [Monitoring and Logging Issues](#monitoring-and-logging-issues)

## Quick Diagnostics

### Health Check Commands

```bash
# Check service health
curl http://localhost:3002/api/llm/health

# Check specific endpoints
curl http://localhost:3002/api/llm/test
curl http://localhost:3002/api/llm/stats

# Check process status
ps aux | grep node
netstat -tulpn | grep :3002
```

### Log Analysis

```bash
# View recent logs
tail -f logs/app.log

# Search for errors
grep -i error logs/app.log
grep -i "failed\|exception" logs/app.log

# Check system logs
journalctl -u mcp-engine -f
```

### System Resource Check

```bash
# Memory usage
free -h
ps aux --sort=-%mem | head

# CPU usage
top -p $(pgrep -d',' node)

# Disk space
df -h
du -sh logs/
```

## Service Startup Issues

### Issue: Port Already in Use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3002
```

**Solution:**
```bash
# Find process using the port
lsof -i :3002
netstat -tulpn | grep :3002

# Kill the process
kill -9 <PID>

# Or use the provided script
./kill-port.sh 3002

# Restart the service
node src/llm-gateway/start-llm-gateway-refactored.js
```

### Issue: Module Not Found Errors

**Symptoms:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/path/to/module.js'
```

**Solution:**
```bash
# Check file exists
ls -la src/shared/services/

# Verify import paths (must include .js extension)
# Incorrect: import { Service } from './service'
# Correct: import { Service } from './service.js'

# Check for typos in file names
find src/ -name "*.js" | grep -i service

# Reinstall dependencies if needed
rm -rf node_modules package-lock.json
npm install
```

### Issue: Service Container Resolution Errors

**Symptoms:**
```
Error: Failed to resolve service 'serviceName': registration.serviceClass is not a constructor
```

**Solution:**
```bash
# Check service registration
node -e "
const container = require('./src/shared/container/ServiceContainer.js');
console.log('Registered services:', Array.from(container.services.keys()));
"

# Verify service exports
node -e "
const service = require('./src/shared/services/MyService.js');
console.log('Service export:', typeof service.MyService);
"

# Fix export/import issues
# Ensure proper export: export class MyService { }
# Ensure proper import: import { MyService } from './MyService.js'
```

### Issue: Environment Variables Not Loaded

**Symptoms:**
```
WARN [config] Missing environment variables: OPENAI_API_KEY
```

**Solution:**
```bash
# Check .env file exists
ls -la .env

# Verify .env content
cat .env

# Check environment loading
node -e "
require('dotenv').config();
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
"

# Create .env from template
cp env.example .env
# Edit .env with your values
```

## API and Network Issues

### Issue: 404 Not Found on API Endpoints

**Symptoms:**
```
GET /api/llm/test 404 1.347 ms - 131
```

**Solution:**
```bash
# Check route registration
curl http://localhost:3002/api/llm/health

# Verify routes are mounted
node -e "
const app = require('./src/llm-gateway/start-llm-gateway-refactored.js');
// Check if routes are properly registered
"

# Check route definitions
grep -r "router\." src/llm-gateway/routes-refactored.js

# Restart service with debug logging
DEBUG=express:* node src/llm-gateway/start-llm-gateway-refactored.js
```

### Issue: CORS Errors

**Symptoms:**
```
Access to fetch at 'http://localhost:3002/api/llm/query' from origin 'http://localhost:3050' has been blocked by CORS policy
```

**Solution:**
```javascript
// Check CORS configuration in gateway
app.use(cors({
  origin: ['http://localhost:3050', 'http://localhost:3000'],
  credentials: true
}));

// Or allow all origins for development
app.use(cors({
  origin: true,
  credentials: true
}));
```

### Issue: Request Timeout

**Symptoms:**
```
Error: timeout of 30000ms exceeded
```

**Solution:**
```bash
# Check OpenAI API connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Increase timeout in client
# Set timeout to 60 seconds
const response = await fetch(url, { 
  signal: AbortSignal.timeout(60000) 
});

# Check network connectivity
ping api.openai.com
traceroute api.openai.com
```

### Issue: Rate Limiting

**Symptoms:**
```
HTTP 429: Too Many Requests
X-RateLimit-Remaining: 0
```

**Solution:**
```bash
# Check rate limit headers
curl -I http://localhost:3002/api/llm/query

# Implement exponential backoff
# Wait before retrying: 1s, 2s, 4s, 8s...

# Check OpenAI quota
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/usage
```

## Database and Caching Issues

### Issue: Redis Connection Failed

**Symptoms:**
```
ERROR [redis-cache] Redis connection error: {"errno":-61,"code":"ECONNREFUSED"}
```

**Solution:**
```bash
# Check Redis is running
redis-cli ping
# Expected response: PONG

# Start Redis if not running
redis-server

# Check Redis configuration
redis-cli config get "*"

# Test connection with credentials
redis-cli -a your_password ping

# Verify Redis host/port in .env
echo "REDIS_HOST=$REDIS_HOST"
echo "REDIS_PORT=$REDIS_PORT"

# System falls back to memory cache automatically
# Check logs for fallback message:
# "Redis unavailable, using memory cache only"
```

### Issue: Cache Performance Issues

**Symptoms:**
- Slow response times
- High memory usage
- Cache misses

**Solution:**
```bash
# Check cache hit rate
curl http://localhost:3002/api/llm/stats

# Monitor Redis memory usage
redis-cli info memory

# Check cache key patterns
redis-cli keys "*"

# Clear cache if needed
redis-cli flushall

# Optimize cache TTL settings
# Reduce TTL for frequently changing data
# Increase TTL for static data
```

### Issue: Data Loading Errors

**Symptoms:**
```
INFO [regulation-repository] Loaded 0 regulations from CSV
```

**Solution:**
```bash
# Check CSV file exists
ls -la compmat.csv data/

# Verify CSV format
head -5 compmat.csv

# Check file permissions
chmod 644 compmat.csv

# Verify CSV parsing
node -e "
const fs = require('fs');
const csv = fs.readFileSync('compmat.csv', 'utf8');
console.log('Lines:', csv.split('\n').length);
console.log('First line:', csv.split('\n')[0]);
"
```

## Authentication and Security Issues

### Issue: OpenAI API Authentication Failed

**Symptoms:**
```
ERROR [llm-service] Service error: OpenAI service error: HTTP 401: Unauthorized
```

**Solution:**
```bash
# Verify API key format
echo $OPENAI_API_KEY | wc -c
# Should be around 51 characters

# Test API key directly
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Check API key in environment
node -e "console.log('API Key:', process.env.OPENAI_API_KEY?.substring(0, 10) + '...')"

# Regenerate API key if needed
# Go to OpenAI dashboard -> API Keys -> Create new key
```

### Issue: JWT Token Errors

**Symptoms:**
```
ERROR [auth] Invalid token: JsonWebTokenError: invalid signature
```

**Solution:**
```bash
# Check JWT secret
echo $JWT_SECRET

# Verify token format
node -e "
const jwt = require('jsonwebtoken');
try {
  const decoded = jwt.verify('your_token', process.env.JWT_SECRET);
  console.log('Token valid:', decoded);
} catch (err) {
  console.log('Token error:', err.message);
}
"

# Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Issue: API Key Validation Failed

**Symptoms:**
```
HTTP 403: Forbidden - Invalid API key
```

**Solution:**
```bash
# Check API key format in request
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3002/api/llm/query

# Verify API key in logs
grep "API key" logs/app.log

# Check authentication manager
node -e "
const auth = require('./src/shared/security/AuthenticationManager.js');
// Check if API key exists in system
"
```

## Performance Issues

### Issue: High Memory Usage

**Symptoms:**
- Process memory > 1GB
- Out of memory errors
- Slow response times

**Solution:**
```bash
# Monitor memory usage
node --max-old-space-size=2048 src/llm-gateway/start-llm-gateway-refactored.js

# Check for memory leaks
node --inspect src/llm-gateway/start-llm-gateway-refactored.js
# Open chrome://inspect in Chrome

# Implement memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory:', Math.round(usage.heapUsed / 1024 / 1024) + 'MB');
}, 30000);

# Clear cache periodically
# Implement cache eviction policies
```

### Issue: Slow API Response Times

**Symptoms:**
- Response times > 5 seconds
- Timeout errors
- High CPU usage

**Solution:**
```bash
# Profile API endpoints
curl -w "@curl-format.txt" http://localhost:3002/api/llm/health

# Create curl-format.txt:
echo "time_total: %{time_total}s\ntime_connect: %{time_connect}s\ntime_starttransfer: %{time_starttransfer}s" > curl-format.txt

# Check database query performance
# Add query timing logs

# Implement caching
# Cache frequently requested data

# Use connection pooling
# Reuse database connections
```

### Issue: High CPU Usage

**Symptoms:**
- CPU usage > 80%
- Slow response times
- System unresponsive

**Solution:**
```bash
# Profile CPU usage
node --prof src/llm-gateway/start-llm-gateway-refactored.js
# Generate profile: node --prof-process isolate-*.log > profile.txt

# Check for infinite loops
# Review recent code changes

# Implement rate limiting
# Limit concurrent requests

# Use clustering
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Start server
}
```

## Kubernetes-Specific Issues

### Issue: Pod Startup Failures

**Symptoms:**
```
kubectl get pods -n mcp-engine
NAME                           READY   STATUS    RESTARTS   AGE
llm-gateway-xxx                0/1     CrashLoopBackOff   5          5m
```

**Solution:**
```bash
# Check pod logs
kubectl logs -n mcp-engine deployment/llm-gateway

# Describe pod for events
kubectl describe pod -n mcp-engine llm-gateway-xxx

# Check resource limits
kubectl describe deployment -n mcp-engine llm-gateway

# Verify image exists
docker pull mcp-engine/llm-gateway:phase4-latest

# Check environment variables
kubectl get secret -n mcp-engine llm-secrets -o yaml
```

### Issue: Service Discovery Problems

**Symptoms:**
```
Error: getaddrinfo ENOTFOUND redis-service
```

**Solution:**
```bash
# Check service exists
kubectl get svc -n mcp-engine

# Check endpoints
kubectl get endpoints -n mcp-engine

# Test DNS resolution
kubectl run test-pod --image=busybox -it --rm -- nslookup redis-service.mcp-engine.svc.cluster.local

# Check network policies
kubectl get networkpolicy -n mcp-engine
```

### Issue: Persistent Volume Issues

**Symptoms:**
```
Warning  FailedMount  pod/llm-gateway-xxx  MountVolume.SetUp failed
```

**Solution:**
```bash
# Check PVC status
kubectl get pvc -n mcp-engine

# Check storage class
kubectl get storageclass

# Describe PVC for events
kubectl describe pvc -n mcp-engine llm-gateway-pvc

# Check node storage
kubectl get nodes -o wide
kubectl describe node <node-name>
```

### Issue: Ingress Not Working

**Symptoms:**
- External URL not accessible
- 502/503 errors
- SSL certificate issues

**Solution:**
```bash
# Check ingress status
kubectl get ingress -n mcp-engine

# Check ingress controller
kubectl get pods -n ingress-nginx

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Test internal service
kubectl port-forward -n mcp-engine svc/llm-gateway-service 3002:3002

# Check DNS records
nslookup api.mcp-engine.com

# Check SSL certificate
kubectl get certificate -n mcp-engine
kubectl describe certificate -n mcp-engine mcp-engine-tls
```

## Development Environment Issues

### Issue: Hot Reload Not Working

**Symptoms:**
- Changes not reflected
- Manual restart required

**Solution:**
```bash
# Use nodemon for auto-restart
npm install -g nodemon
nodemon src/llm-gateway/start-llm-gateway-refactored.js

# Check file watchers
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Use development mode
NODE_ENV=development npm run dev
```

### Issue: Frontend Build Errors

**Symptoms:**
```
Error: Failed to parse source for import analysis
```

**Solution:**
```bash
# Check file extensions
# Rename .js files with JSX to .jsx

# Update import paths
# Use .jsx extension for JSX files

# Clear build cache
rm -rf node_modules/.vite
npm run dev:client

# Check Vite configuration
cat vite.config.js
```

### Issue: ESM Import Errors

**Symptoms:**
```
SyntaxError: Cannot use import statement outside a module
```

**Solution:**
```bash
# Ensure package.json has type: "module"
grep '"type"' package.json

# Use .js extension in imports
# import { service } from './service.js'

# Check Node.js version
node --version
# Requires Node.js 14+
```

## Monitoring and Logging Issues

### Issue: Logs Not Appearing

**Symptoms:**
- Empty log files
- Missing error logs

**Solution:**
```bash
# Check log directory permissions
ls -la logs/
chmod 755 logs/

# Verify logger configuration
node -e "
const logger = require('./src/shared/utils/logger.js');
logger.info('Test log message');
"

# Check log level
echo "LOG_LEVEL=$LOG_LEVEL"

# Force log output
LOG_LEVEL=debug node src/llm-gateway/start-llm-gateway-refactored.js
```

### Issue: Metrics Not Collected

**Symptoms:**
- Empty metrics endpoint
- Prometheus not scraping

**Solution:**
```bash
# Check metrics endpoint
curl http://localhost:3002/api/llm/metrics

# Verify Prometheus configuration
kubectl get configmap -n monitoring prometheus-config -o yaml

# Check service monitor
kubectl get servicemonitor -n mcp-engine

# Test metrics collection
node -e "
const metrics = require('./src/shared/monitoring/MetricsCollector.js');
metrics.incrementCounter('test_metric');
console.log(metrics.getMetrics());
"
```

### Issue: Health Checks Failing

**Symptoms:**
```
Readiness probe failed: HTTP probe failed with statuscode: 500
```

**Solution:**
```bash
# Test health endpoint manually
curl -v http://localhost:3002/api/llm/health

# Check health check implementation
grep -r "health" src/llm-gateway/

# Verify dependencies
# Ensure all required services are available

# Adjust probe timing
# Increase initialDelaySeconds and timeoutSeconds
```

## Emergency Procedures

### Service Recovery

```bash
# Quick restart
./kill-port.sh 3002
node src/llm-gateway/start-llm-gateway-refactored.js &

# Kubernetes restart
kubectl rollout restart deployment/llm-gateway -n mcp-engine

# Clear all caches
redis-cli flushall
rm -rf logs/*
```

### Data Recovery

```bash
# Backup current state
cp compmat.csv compmat.csv.backup
kubectl get all -n mcp-engine -o yaml > backup.yaml

# Restore from backup
cp compmat.csv.backup compmat.csv
kubectl apply -f backup.yaml
```

### Rollback Procedures

```bash
# Git rollback
git log --oneline -10
git reset --hard <commit-hash>

# Kubernetes rollback
kubectl rollout history deployment/llm-gateway -n mcp-engine
kubectl rollout undo deployment/llm-gateway -n mcp-engine

# Docker rollback
docker tag mcp-engine/llm-gateway:previous mcp-engine/llm-gateway:latest
kubectl set image deployment/llm-gateway llm-gateway=mcp-engine/llm-gateway:latest -n mcp-engine
```

## Getting Help

### Log Collection

```bash
# Collect all logs
mkdir debug-logs
cp logs/* debug-logs/
kubectl logs -n mcp-engine deployment/llm-gateway > debug-logs/k8s-logs.txt
kubectl describe all -n mcp-engine > debug-logs/k8s-describe.txt

# System information
uname -a > debug-logs/system-info.txt
node --version >> debug-logs/system-info.txt
npm --version >> debug-logs/system-info.txt
```

### Support Information

When reporting issues, include:

1. **Environment**: Local/Docker/Kubernetes
2. **Version**: Git commit hash or release version
3. **Error logs**: Complete error messages and stack traces
4. **Steps to reproduce**: Exact commands and configuration
5. **System info**: OS, Node.js version, available resources

### Useful Commands Reference

```bash
# Process management
ps aux | grep node
kill -9 $(lsof -t -i:3002)

# Network debugging
netstat -tulpn | grep :3002
curl -v http://localhost:3002/api/llm/health

# File system
find . -name "*.js" -type f | head -10
du -sh logs/ node_modules/

# Kubernetes debugging
kubectl get events --sort-by='.lastTimestamp' -n mcp-engine
kubectl top pods -n mcp-engine
kubectl describe pod <pod-name> -n mcp-engine
```

This troubleshooting guide covers the most common issues encountered with the MCP Engine. For issues not covered here, check the logs for specific error messages and consult the development team. 