#!/bin/zsh

# ============================================================================
# EdSteward Per-Tenant ECS Infrastructure Setup
# ============================================================================
# Creates dedicated ECS infrastructure for a single tenant:
#   - ALB target group
#   - ALB listener rule (host-based routing)
#   - ECS task definition
#   - ECS service
#
# Prerequisites:
#   - ECS cluster already exists (edsteward-cluster)
#   - ALB already exists with HTTPS listener
#   - ECR repository has at least one image
#   - Tenant's DATABASE_URL is stored in Secrets Manager
#
# Usage:
#   ./scripts/setup-tenant-infra.sh <tenant-id> [--dry-run]
#
# Examples:
#   ./scripts/setup-tenant-infra.sh desales
#   ./scripts/setup-tenant-infra.sh muhlenberg --dry-run
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

# ---- Arguments ----
TENANT_ID="${1:-}"
DRY_RUN=false
[[ "$2" == "--dry-run" ]] && DRY_RUN=true

if [[ -z "$TENANT_ID" ]]; then
    echo -e "${RED}Usage: $0 <tenant-id> [--dry-run]${NC}"
    echo ""
    echo "  tenant-id   Tenant identifier (lowercase, e.g. desales)"
    exit 1
fi

TENANT_UPPER="${TENANT_ID:u}"

# ---- Configuration ----
CLUSTER_NAME="${ECS_CLUSTER:-edsteward-cluster}"
SERVICE_NAME="edsteward-${TENANT_ID}"
TASK_FAMILY="edsteward-${TENANT_ID}-task"
TARGET_GROUP_NAME="edsteward-${TENANT_ID}-tg"
LOG_GROUP="/ecs/edsteward-${TENANT_ID}"
SUBDOMAIN="${TENANT_ID}.edsteward.ai"

SSL_CERT_ARN="arn:aws:acm:us-east-1:${AWS_ACCOUNT_ID}:certificate/622eb953-a77f-4770-be20-5dd017df39b0"

print_banner "Per-Tenant Infra: $TENANT_ID" "$SUBDOMAIN"

if [[ "$DRY_RUN" == "true" ]]; then
    warn "DRY RUN MODE -- no resources will be created"
fi

log "Cluster:       $CLUSTER_NAME"
log "Service:       $SERVICE_NAME"
log "Task Family:   $TASK_FAMILY"
log "Target Group:  $TARGET_GROUP_NAME"
log "Log Group:     $LOG_GROUP"
log "Subdomain:     $SUBDOMAIN"
echo ""

# ---- Pre-flight ----
run_preflight_checks

# ---- Discover existing infra ----
step "Looking up VPC and subnets from existing cluster..."

# Get VPC from existing service's network config
EXISTING_SERVICES=$(aws ecs list-services --cluster "$CLUSTER_NAME" --region "$AWS_REGION" --query 'serviceArns[0]' --output text 2>/dev/null)
if [[ -z "$EXISTING_SERVICES" || "$EXISTING_SERVICES" == "None" ]]; then
    error "No existing services found in cluster $CLUSTER_NAME. Set up the cluster first."
fi

EXISTING_SERVICE_NAME=$(basename "$EXISTING_SERVICES")
EXISTING_CONFIG=$(aws ecs describe-services \
    --cluster "$CLUSTER_NAME" \
    --services "$EXISTING_SERVICE_NAME" \
    --region "$AWS_REGION" \
    --query 'services[0].networkConfiguration.awsvpcConfiguration' \
    --output json 2>/dev/null)

VPC_SUBNETS=$(echo "$EXISTING_CONFIG" | jq -r '.subnets[]' | tr '\n' ',' | sed 's/,$//')
SECURITY_GROUPS=$(echo "$EXISTING_CONFIG" | jq -r '.securityGroups[]' | tr '\n' ',' | sed 's/,$//')
VPC_ID=$(aws ec2 describe-subnets --subnet-ids $(echo "$VPC_SUBNETS" | tr ',' ' ' | head -1) --region "$AWS_REGION" --query 'Subnets[0].VpcId' --output text 2>/dev/null)

success "VPC: $VPC_ID"
log "Subnets: $VPC_SUBNETS"
log "Security Groups: $SECURITY_GROUPS"

# ---- Find ALB and HTTPS listener ----
step "Finding ALB and HTTPS listener..."

ALB_ARN=$(aws elbv2 describe-load-balancers \
    --region "$AWS_REGION" \
    --query "LoadBalancers[?contains(LoadBalancerName, 'edsteward')].LoadBalancerArn | [0]" \
    --output text 2>/dev/null)

if [[ -z "$ALB_ARN" || "$ALB_ARN" == "None" ]]; then
    error "No EdSteward ALB found. Set up the base infrastructure first."
fi

HTTPS_LISTENER_ARN=$(aws elbv2 describe-listeners \
    --load-balancer-arn "$ALB_ARN" \
    --region "$AWS_REGION" \
    --query "Listeners[?Port==\`443\`].ListenerArn | [0]" \
    --output text 2>/dev/null)

if [[ -z "$HTTPS_LISTENER_ARN" || "$HTTPS_LISTENER_ARN" == "None" ]]; then
    error "No HTTPS listener (port 443) found on ALB. Set up SSL first."
fi

success "ALB: $(basename $ALB_ARN)"
log "HTTPS Listener: $(basename $HTTPS_LISTENER_ARN)"

# ---- Create CloudWatch log group ----
step "Creating CloudWatch log group: $LOG_GROUP"
if [[ "$DRY_RUN" != "true" ]]; then
    aws logs create-log-group --log-group-name "$LOG_GROUP" --region "$AWS_REGION" 2>/dev/null || true
    aws logs put-retention-policy --log-group-name "$LOG_GROUP" --retention-in-days 14 --region "$AWS_REGION" 2>/dev/null || true
    success "Log group ready"
else
    log "[DRY RUN] Would create log group $LOG_GROUP"
fi

# ---- Create target group ----
step "Creating ALB target group: $TARGET_GROUP_NAME"
if [[ "$DRY_RUN" != "true" ]]; then
    TG_ARN=$(aws elbv2 describe-target-groups \
        --names "$TARGET_GROUP_NAME" \
        --region "$AWS_REGION" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text 2>/dev/null || echo "None")

    if [[ "$TG_ARN" == "None" || -z "$TG_ARN" ]]; then
        TG_ARN=$(aws elbv2 create-target-group \
            --name "$TARGET_GROUP_NAME" \
            --protocol HTTP \
            --port 3000 \
            --vpc-id "$VPC_ID" \
            --target-type ip \
            --health-check-path "/api/health" \
            --health-check-interval-seconds 30 \
            --healthy-threshold-count 2 \
            --unhealthy-threshold-count 3 \
            --region "$AWS_REGION" \
            --query 'TargetGroups[0].TargetGroupArn' \
            --output text)
        success "Target group created: $TG_ARN"
    else
        success "Target group already exists: $TG_ARN"
    fi
else
    log "[DRY RUN] Would create target group $TARGET_GROUP_NAME"
    TG_ARN="arn:aws:elasticloadbalancing:$AWS_REGION:$AWS_ACCOUNT_ID:targetgroup/$TARGET_GROUP_NAME/dry-run"
fi

# ---- Create ALB listener rule (host-based routing) ----
step "Creating ALB listener rule for host: $SUBDOMAIN"

# Get the next available priority
EXISTING_PRIORITIES=$(aws elbv2 describe-rules \
    --listener-arn "$HTTPS_LISTENER_ARN" \
    --region "$AWS_REGION" \
    --query 'Rules[].Priority' \
    --output text 2>/dev/null | tr '\t' '\n' | grep -v default | sort -n | tail -1)
NEXT_PRIORITY=$(( ${EXISTING_PRIORITIES:-0} + 1 ))

if [[ "$DRY_RUN" != "true" ]]; then
    # Check if rule already exists for this host
    EXISTING_RULE=$(aws elbv2 describe-rules \
        --listener-arn "$HTTPS_LISTENER_ARN" \
        --region "$AWS_REGION" \
        --query "Rules[?Conditions[?Values[?contains(@, '${SUBDOMAIN}')]]].RuleArn | [0]" \
        --output text 2>/dev/null)

    if [[ -z "$EXISTING_RULE" || "$EXISTING_RULE" == "None" ]]; then
        aws elbv2 create-rule \
            --listener-arn "$HTTPS_LISTENER_ARN" \
            --priority "$NEXT_PRIORITY" \
            --conditions "Field=host-header,Values=[\"${SUBDOMAIN}\"]" \
            --actions "Type=forward,TargetGroupArn=${TG_ARN}" \
            --region "$AWS_REGION" > /dev/null
        success "Listener rule created (priority $NEXT_PRIORITY)"
    else
        success "Listener rule already exists for $SUBDOMAIN"
    fi
else
    log "[DRY RUN] Would create listener rule for $SUBDOMAIN at priority $NEXT_PRIORITY"
fi

# ---- Register ECS task definition ----
step "Registering ECS task definition: $TASK_FAMILY"

# Get the latest image tag from ECR
LATEST_TAG=$(aws ecr describe-images \
    --repository-name "$ECR_REPOSITORY" \
    --region "$AWS_REGION" \
    --query 'sort_by(imageDetails, &imagePushedAt)[-1].imageTags[0]' \
    --output text 2>/dev/null)

log "Using image: $ECR_URI:$LATEST_TAG"

# Build secrets ARN for the tenant's DATABASE_URL
DB_SECRET_ARN="arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:edsteward/${TENANT_ID}/database-url"

if [[ "$DRY_RUN" != "true" ]]; then
    TASK_DEF_JSON=$(cat <<TASKEOF
{
  "family": "${TASK_FAMILY}",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "edsteward-app",
      "image": "${ECR_URI}:${LATEST_TAG}",
      "essential": true,
      "portMappings": [
        { "containerPort": 3000, "hostPort": 3000, "protocol": "tcp" }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3000" },
        { "name": "MULTI_TENANT", "value": "false" },
        { "name": "TENANT_ID", "value": "${TENANT_ID}" },
        { "name": "VERSION", "value": "${LATEST_TAG}" },
        { "name": "BASE_URL", "value": "https://${SUBDOMAIN}" }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "${DB_SECRET_ARN}"
        },
        {
          "name": "SESSION_SECRET",
          "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:edsteward/session-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "${LOG_GROUP}",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
TASKEOF
)
    echo "$TASK_DEF_JSON" | aws ecs register-task-definition \
        --cli-input-json file:///dev/stdin \
        --region "$AWS_REGION" > /dev/null
    success "Task definition registered: $TASK_FAMILY"
else
    log "[DRY RUN] Would register task definition $TASK_FAMILY"
fi

# ---- Create ECS service ----
step "Creating ECS service: $SERVICE_NAME"
if [[ "$DRY_RUN" != "true" ]]; then
    EXISTING_SERVICE=$(aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region "$AWS_REGION" \
        --query 'services[?status==`ACTIVE`].serviceName | [0]' \
        --output text 2>/dev/null)

    if [[ -z "$EXISTING_SERVICE" || "$EXISTING_SERVICE" == "None" ]]; then
        aws ecs create-service \
            --cluster "$CLUSTER_NAME" \
            --service-name "$SERVICE_NAME" \
            --task-definition "$TASK_FAMILY" \
            --desired-count 1 \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[${VPC_SUBNETS}],securityGroups=[${SECURITY_GROUPS}],assignPublicIp=ENABLED}" \
            --load-balancers "targetGroupArn=${TG_ARN},containerName=edsteward-app,containerPort=3000" \
            --region "$AWS_REGION" > /dev/null
        success "ECS service created: $SERVICE_NAME"
    else
        success "ECS service already exists: $SERVICE_NAME"
    fi
else
    log "[DRY RUN] Would create ECS service $SERVICE_NAME"
fi

# ---- Summary ----
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  TENANT INFRASTRUCTURE READY${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Tenant:        ${CYAN}$TENANT_ID${NC}"
echo -e "  URL:           https://${SUBDOMAIN}"
echo -e "  ECS Service:   $SERVICE_NAME"
echo -e "  Task Family:   $TASK_FAMILY"
echo -e "  Target Group:  $TARGET_GROUP_NAME"
echo -e "  Image:         $ECR_URI:$LATEST_TAG"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Next steps:"
echo "  1. Ensure DNS record exists: $SUBDOMAIN -> ALB"
echo "  2. Store DATABASE_URL in Secrets Manager:"
echo "     aws secretsmanager create-secret --name edsteward/${TENANT_ID}/database-url --secret-string '<url>'"
echo "  3. Update admin console tenant record with ECS config:"
echo "     PUT /api/customers/${TENANT_ID}/deployment-config"
echo "     { \"ecsCluster\": \"$CLUSTER_NAME\", \"ecsService\": \"$SERVICE_NAME\", \"ecsTaskFamily\": \"$TASK_FAMILY\" }"
echo "  4. Deploy: ./scripts/deploy-tenant.sh $TENANT_ID $LATEST_TAG"
