# MCP Engine Deployment Guide

## Overview

This guide covers all deployment options for the MCP Engine, from local development to enterprise Kubernetes deployments. The system supports multiple deployment strategies to accommodate different environments and requirements.

## Table of Contents

- [Deployment Options](#deployment-options)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Production Considerations](#production-considerations)
- [Monitoring & Observability](#monitoring--observability)
- [Security Configuration](#security-configuration)
- [Troubleshooting](#troubleshooting)

## Deployment Options

| Option | Use Case | Complexity | Scalability |
|--------|----------|------------|-------------|
| Local Development | Development, testing | Low | Single instance |
| Docker Compose | Small deployments, staging | Medium | Limited scaling |
| Kubernetes | Production, enterprise | High | Full auto-scaling |

## Local Development

### Prerequisites

```bash
# Required
Node.js 18+
npm 8+

# Optional
Redis (for caching)
```

### Quick Start

```bash
# Clone and setup
git clone [repository-url]
cd mcp-engine
npm install

# Configure environment
cp env.example .env
# Edit .env with your settings

# Start services
node src/llm-gateway/start-llm-gateway-refactored.js  # Port 3002
npm run dev:client                                    # Port 3050
```

### Environment Configuration

```bash
# .env file
NODE_ENV=development
LOG_LEVEL=debug
OPENAI_API_KEY=your_openai_api_key
LLM_GATEWAY_PORT=3002
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Service Management

```bash
# Start individual services
node src/llm-gateway/start-llm-gateway-refactored.js
node src/llm-gateway/start-llm-gateway-phase4.js

# Kill processes on specific ports
./kill-port.sh 3002
./kill-port.sh 3050

# Check service health
curl http://localhost:3002/api/llm/health
```

## Docker Deployment

### Phase 4 Docker Compose

```bash
# Start Phase 4 services
docker-compose -f docker-compose.phase4.yml up -d

# View logs
docker-compose -f docker-compose.phase4.yml logs -f

# Stop services
docker-compose -f docker-compose.phase4.yml down
```

### Docker Compose Configuration

```yaml
# docker-compose.phase4.yml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  llm-gateway:
    build:
      context: .
      dockerfile: Dockerfile.phase4
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

volumes:
  redis_data:
```

### Building Custom Images

```bash
# Build Phase 4 image
docker build -f Dockerfile.phase4 -t mcp-engine/llm-gateway:phase4-latest .

# Build with specific tag
docker build -f Dockerfile.phase4 -t mcp-engine/llm-gateway:v4.0.0 .

# Push to registry
docker tag mcp-engine/llm-gateway:phase4-latest your-registry/mcp-engine:latest
docker push your-registry/mcp-engine:latest
```

### Docker Environment Variables

```bash
# Create .env file for Docker Compose
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=production
LOG_LEVEL=info
REDIS_PASSWORD=secure_redis_password
```

## Kubernetes Deployment

### Phase 5 Kubernetes Deployment

#### Automated Deployment

```bash
# Deploy with automated script
./scripts/deploy-phase5.sh

# Deploy to specific namespace
./scripts/deploy-phase5.sh --namespace mcp-production

# Deploy with custom values
./scripts/deploy-phase5.sh --values custom-values.yaml
```

#### Manual Deployment

```bash
# Create namespace and resources
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/llm-gateway-deployment.yaml
kubectl apply -f k8s/monitoring-stack.yaml
kubectl apply -f k8s/ingress.yaml

# Verify deployment
kubectl get pods -n mcp-engine
kubectl get services -n mcp-engine
```

### Helm Deployment

```bash
# Add required repositories
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install dependencies
helm install ingress-nginx ingress-nginx/ingress-nginx
helm install prometheus prometheus-community/kube-prometheus-stack

# Deploy MCP Engine
helm install mcp-engine ./k8s/helm-chart \
  --namespace mcp-engine \
  --create-namespace \
  --values ./k8s/helm-chart/values.yaml
```

### Kubernetes Configuration

#### Namespace and Resource Quotas

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mcp-engine
  labels:
    name: mcp-engine
    phase: "5"
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: mcp-engine-quota
  namespace: mcp-engine
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
```

#### LLM Gateway Deployment

```yaml
# k8s/llm-gateway-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-gateway
  namespace: mcp-engine
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llm-gateway
  template:
    spec:
      containers:
      - name: llm-gateway
        image: mcp-engine/llm-gateway:phase4-latest
        ports:
        - containerPort: 3002
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          value: "redis-service"
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 1000m
            memory: 1Gi
```

#### Auto-scaling Configuration

```yaml
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: llm-gateway-hpa
  namespace: mcp-engine
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: llm-gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Ingress Configuration

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-engine-ingress
  namespace: mcp-engine
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - api.mcp-engine.com
    secretName: mcp-engine-tls
  rules:
  - host: api.mcp-engine.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: llm-gateway-service
            port:
              number: 3002
```

## Production Considerations

### Resource Requirements

#### Minimum Requirements
- **CPU**: 2 cores
- **Memory**: 4GB RAM
- **Storage**: 20GB
- **Network**: 100Mbps

#### Recommended Production
- **CPU**: 8 cores
- **Memory**: 16GB RAM
- **Storage**: 100GB SSD
- **Network**: 1Gbps

### High Availability Setup

```yaml
# Multi-zone deployment
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - llm-gateway
              topologyKey: kubernetes.io/hostname
```

### Persistent Storage

```yaml
# Persistent Volume Claim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: llm-gateway-pvc
  namespace: mcp-engine
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 5Gi
  storageClassName: fast-ssd
```

### Database Configuration

```yaml
# Redis with persistence
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - /etc/redis/redis.conf
        - --requirepass
        - $(REDIS_PASSWORD)
        volumeMounts:
        - name: redis-data
          mountPath: /data
        - name: redis-config
          mountPath: /etc/redis
```

## Monitoring & Observability

### Prometheus Metrics

```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: llm-gateway-metrics
  namespace: mcp-engine
spec:
  selector:
    matchLabels:
      app: llm-gateway
  endpoints:
  - port: http
    path: /api/llm/metrics
    interval: 30s
```

### Grafana Dashboards

```bash
# Import pre-built dashboards
kubectl apply -f k8s/monitoring/grafana-dashboards.yaml

# Access Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80
# Open http://localhost:3000
```

### Logging Configuration

```yaml
# Fluentd for log collection
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd
spec:
  template:
    spec:
      containers:
      - name: fluentd
        image: fluent/fluentd-kubernetes-daemonset:v1-debian-elasticsearch
        env:
        - name: FLUENT_ELASTICSEARCH_HOST
          value: "elasticsearch.logging.svc.cluster.local"
```

### Health Checks

```yaml
# Liveness and readiness probes
spec:
  containers:
  - name: llm-gateway
    livenessProbe:
      httpGet:
        path: /api/llm/health
        port: 3002
      initialDelaySeconds: 60
      periodSeconds: 30
    readinessProbe:
      httpGet:
        path: /api/llm/health
        port: 3002
      initialDelaySeconds: 30
      periodSeconds: 10
```

## Security Configuration

### Network Policies

```yaml
# Network policy for micro-segmentation
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: llm-gateway-netpol
  namespace: mcp-engine
spec:
  podSelector:
    matchLabels:
      app: llm-gateway
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3002
```

### RBAC Configuration

```yaml
# Service Account and RBAC
apiVersion: v1
kind: ServiceAccount
metadata:
  name: llm-gateway
  namespace: mcp-engine
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: llm-gateway-role
  namespace: mcp-engine
rules:
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list", "watch"]
```

### Secret Management

```yaml
# Kubernetes secrets
apiVersion: v1
kind: Secret
metadata:
  name: llm-secrets
  namespace: mcp-engine
type: Opaque
data:
  openai-api-key: <base64-encoded-key>
  redis-password: <base64-encoded-password>
```

### SSL/TLS Configuration

```yaml
# cert-manager ClusterIssuer
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@mcp-engine.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

## Troubleshooting

### Common Issues

#### Pod Startup Issues

```bash
# Check pod status
kubectl get pods -n mcp-engine

# View pod logs
kubectl logs -n mcp-engine deployment/llm-gateway

# Describe pod for events
kubectl describe pod -n mcp-engine <pod-name>
```

#### Service Discovery Issues

```bash
# Check service endpoints
kubectl get endpoints -n mcp-engine

# Test service connectivity
kubectl run test-pod --image=busybox -it --rm -- /bin/sh
# Inside pod: wget -qO- http://llm-gateway-service:3002/api/llm/health
```

#### Resource Issues

```bash
# Check resource usage
kubectl top pods -n mcp-engine
kubectl top nodes

# Check resource quotas
kubectl describe quota -n mcp-engine
```

#### Ingress Issues

```bash
# Check ingress status
kubectl get ingress -n mcp-engine

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

### Debugging Commands

```bash
# Port forward for local access
kubectl port-forward -n mcp-engine svc/llm-gateway-service 3002:3002

# Execute commands in pod
kubectl exec -it -n mcp-engine deployment/llm-gateway -- /bin/bash

# View all resources
kubectl get all -n mcp-engine

# Check events
kubectl get events -n mcp-engine --sort-by='.lastTimestamp'
```

### Performance Tuning

#### Resource Optimization

```yaml
# Optimized resource requests/limits
resources:
  requests:
    cpu: 200m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

#### JVM Tuning (if applicable)

```yaml
env:
- name: NODE_OPTIONS
  value: "--max-old-space-size=1024"
```

### Backup and Recovery

#### Database Backup

```bash
# Redis backup
kubectl exec -n mcp-engine deployment/redis -- redis-cli BGSAVE

# Copy backup file
kubectl cp mcp-engine/redis-pod:/data/dump.rdb ./backup/
```

#### Configuration Backup

```bash
# Backup all configurations
kubectl get all,configmap,secret -n mcp-engine -o yaml > mcp-engine-backup.yaml
```

### Scaling Operations

#### Manual Scaling

```bash
# Scale deployment
kubectl scale deployment llm-gateway --replicas=5 -n mcp-engine

# Scale down
kubectl scale deployment llm-gateway --replicas=2 -n mcp-engine
```

#### Auto-scaling Monitoring

```bash
# Check HPA status
kubectl get hpa -n mcp-engine

# View HPA details
kubectl describe hpa llm-gateway-hpa -n mcp-engine
```

## Environment-Specific Configurations

### Development Environment

```yaml
# Development values
replicaCount: 1
resources:
  requests:
    cpu: 100m
    memory: 128Mi
autoscaling:
  enabled: false
```

### Staging Environment

```yaml
# Staging values
replicaCount: 2
resources:
  requests:
    cpu: 200m
    memory: 256Mi
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
```

### Production Environment

```yaml
# Production values
replicaCount: 3
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
```

This deployment guide provides comprehensive coverage of all deployment scenarios for the MCP Engine. Choose the appropriate deployment method based on your requirements and infrastructure capabilities. 