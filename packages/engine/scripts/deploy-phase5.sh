#!/bin/bash

# MCP Engine Phase 5 Deployment Script
# Enterprise Kubernetes & Advanced Operations

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
K8S_DIR="$PROJECT_ROOT/k8s"
HELM_CHART_DIR="$K8S_DIR/helm-chart"
NAMESPACE="mcp-engine"
RELEASE_NAME="mcp-engine"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed. Please install helm first."
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed. Please install docker first."
        exit 1
    fi
    
    # Check kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build and push Docker images
build_images() {
    log_info "Building Docker images..."
    
    # Build LLM Gateway image
    log_info "Building LLM Gateway image..."
    docker build -f "$PROJECT_ROOT/Dockerfile.phase4" -t "mcp-engine/llm-gateway:phase4-latest" "$PROJECT_ROOT"
    
    # Build Frontend image (if Dockerfile exists)
    if [ -f "$PROJECT_ROOT/Dockerfile.frontend" ]; then
        log_info "Building Frontend image..."
        docker build -f "$PROJECT_ROOT/Dockerfile.frontend" -t "mcp-engine/frontend:phase4-latest" "$PROJECT_ROOT"
    else
        log_warning "Frontend Dockerfile not found, skipping frontend image build"
    fi
    
    log_success "Docker images built successfully"
}

# Setup Kubernetes cluster dependencies
setup_cluster_dependencies() {
    log_info "Setting up cluster dependencies..."
    
    # Add Helm repositories
    log_info "Adding Helm repositories..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    # Install NGINX Ingress Controller
    log_info "Installing NGINX Ingress Controller..."
    if ! kubectl get namespace ingress-nginx &> /dev/null; then
        helm install ingress-nginx ingress-nginx/ingress-nginx \
            --create-namespace \
            --namespace ingress-nginx \
            --set controller.metrics.enabled=true \
            --set controller.podAnnotations."prometheus\.io/scrape"=true \
            --set controller.podAnnotations."prometheus\.io/port"=10254
    else
        log_info "NGINX Ingress Controller already installed"
    fi
    
    # Install cert-manager
    log_info "Installing cert-manager..."
    if ! kubectl get namespace cert-manager &> /dev/null; then
        helm install cert-manager jetstack/cert-manager \
            --create-namespace \
            --namespace cert-manager \
            --version v1.8.0 \
            --set installCRDs=true
    else
        log_info "cert-manager already installed"
    fi
    
    # Install metrics-server (if not present)
    log_info "Checking metrics-server..."
    if ! kubectl get deployment metrics-server -n kube-system &> /dev/null; then
        kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
    else
        log_info "metrics-server already installed"
    fi
    
    log_success "Cluster dependencies setup completed"
}

# Deploy using raw Kubernetes manifests
deploy_k8s_manifests() {
    log_info "Deploying Kubernetes manifests..."
    
    # Apply namespace first
    kubectl apply -f "$K8S_DIR/namespace.yaml"
    
    # Apply other manifests
    kubectl apply -f "$K8S_DIR/redis-deployment.yaml"
    kubectl apply -f "$K8S_DIR/llm-gateway-deployment.yaml"
    kubectl apply -f "$K8S_DIR/monitoring-stack.yaml"
    kubectl apply -f "$K8S_DIR/ingress.yaml"
    
    log_success "Kubernetes manifests deployed"
}

# Deploy using Helm chart
deploy_helm_chart() {
    log_info "Deploying Helm chart..."
    
    # Update Helm dependencies
    cd "$HELM_CHART_DIR"
    helm dependency update
    
    # Deploy or upgrade the release
    helm upgrade --install "$RELEASE_NAME" . \
        --namespace "$NAMESPACE" \
        --create-namespace \
        --values values.yaml \
        --set global.environment="$ENVIRONMENT" \
        --wait \
        --timeout 10m
    
    log_success "Helm chart deployed successfully"
}

# Wait for deployments to be ready
wait_for_deployments() {
    log_info "Waiting for deployments to be ready..."
    
    # Wait for deployments
    kubectl wait --for=condition=available --timeout=600s deployment/redis -n "$NAMESPACE" || true
    kubectl wait --for=condition=available --timeout=600s deployment/llm-gateway -n "$NAMESPACE" || true
    kubectl wait --for=condition=available --timeout=600s deployment/prometheus -n "$NAMESPACE" || true
    kubectl wait --for=condition=available --timeout=600s deployment/grafana -n "$NAMESPACE" || true
    kubectl wait --for=condition=available --timeout=600s deployment/jaeger-all-in-one -n "$NAMESPACE" || true
    kubectl wait --for=condition=available --timeout=600s deployment/frontend -n "$NAMESPACE" || true
    
    log_success "All deployments are ready"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check pod status
    log_info "Pod status:"
    kubectl get pods -n "$NAMESPACE"
    
    # Check service status
    log_info "Service status:"
    kubectl get services -n "$NAMESPACE"
    
    # Check ingress status
    log_info "Ingress status:"
    kubectl get ingress -n "$NAMESPACE"
    
    # Check HPA status
    log_info "HPA status:"
    kubectl get hpa -n "$NAMESPACE"
    
    # Test health endpoints
    log_info "Testing health endpoints..."
    
    # Port forward to test locally
    kubectl port-forward -n "$NAMESPACE" service/llm-gateway-service 3002:3002 &
    PF_PID=$!
    sleep 5
    
    if curl -f http://localhost:3002/api/llm/health &> /dev/null; then
        log_success "LLM Gateway health check passed"
    else
        log_warning "LLM Gateway health check failed"
    fi
    
    kill $PF_PID 2>/dev/null || true
    
    log_success "Deployment verification completed"
}

# Display access information
display_access_info() {
    log_info "Deployment completed successfully!"
    echo
    log_info "Access Information:"
    echo "===================="
    
    # Get ingress IP
    INGRESS_IP=$(kubectl get ingress mcp-engine-ingress -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
    
    if [ "$INGRESS_IP" != "pending" ] && [ -n "$INGRESS_IP" ]; then
        echo "🌐 Main Application: https://mcp-engine.com"
        echo "🔌 API Gateway: https://api.mcp-engine.com"
        echo "📊 Monitoring: https://monitoring.mcp-engine.com"
        echo "🔍 Tracing: https://tracing.mcp-engine.com"
        echo
        echo "📍 Ingress IP: $INGRESS_IP"
        echo "💡 Add the following to your /etc/hosts file for local testing:"
        echo "$INGRESS_IP mcp-engine.com"
        echo "$INGRESS_IP api.mcp-engine.com"
        echo "$INGRESS_IP monitoring.mcp-engine.com"
        echo "$INGRESS_IP tracing.mcp-engine.com"
    else
        echo "⏳ Ingress IP is still pending. Use port-forwarding for local access:"
        echo
        echo "kubectl port-forward -n $NAMESPACE service/llm-gateway-service 3002:3002"
        echo "kubectl port-forward -n $NAMESPACE service/frontend-service 3050:3050"
        echo "kubectl port-forward -n $NAMESPACE service/grafana-service 3000:3000"
        echo "kubectl port-forward -n $NAMESPACE service/jaeger-query-service 16686:16686"
    fi
    
    echo
    log_info "Useful Commands:"
    echo "=================="
    echo "📋 View pods: kubectl get pods -n $NAMESPACE"
    echo "📊 View metrics: kubectl top pods -n $NAMESPACE"
    echo "📝 View logs: kubectl logs -f deployment/llm-gateway -n $NAMESPACE"
    echo "🔧 Scale deployment: kubectl scale deployment llm-gateway --replicas=5 -n $NAMESPACE"
    echo "🗑️  Delete deployment: helm uninstall $RELEASE_NAME -n $NAMESPACE"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
}

# Main deployment function
main() {
    log_info "Starting MCP Engine Phase 5 deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Namespace: $NAMESPACE"
    log_info "Release: $RELEASE_NAME"
    echo
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    build_images
    setup_cluster_dependencies
    
    # Choose deployment method
    if [ "${USE_HELM:-true}" = "true" ] && [ -d "$HELM_CHART_DIR" ]; then
        deploy_helm_chart
    else
        deploy_k8s_manifests
    fi
    
    wait_for_deployments
    verify_deployment
    display_access_info
    
    log_success "MCP Engine Phase 5 deployment completed successfully! 🚀"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --environment|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --namespace|-n)
            NAMESPACE="$2"
            shift 2
            ;;
        --release|-r)
            RELEASE_NAME="$2"
            shift 2
            ;;
        --no-helm)
            USE_HELM="false"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --environment ENV    Set environment (default: production)"
            echo "  -n, --namespace NS       Set namespace (default: mcp-engine)"
            echo "  -r, --release RELEASE    Set release name (default: mcp-engine)"
            echo "  --no-helm               Use raw Kubernetes manifests instead of Helm"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main 