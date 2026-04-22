#!/bin/zsh

# ============================================================================
# EdSteward Secret Rotation
# ============================================================================
# Rotates cryptographic secrets in ECS task definitions and forces
# a new deployment so the running containers pick up the new values.
#
# Usage:
#   ./scripts/rotate-secrets.sh --env staging --secret SESSION_SECRET
#   ./scripts/rotate-secrets.sh --env production --secret MFA_ENCRYPTION_KEY
#   ./scripts/rotate-secrets.sh --env production --secret all
#   ./scripts/rotate-secrets.sh --env production --dry-run --secret all
#
# Rotatable secrets:
#   SESSION_SECRET          - Invalidates all active sessions (users re-login)
#   MFA_ENCRYPTION_KEY      - Invalidates MFA enrollments (users re-enroll)
#   ATTESTATION_JWT_SECRET  - Invalidates pending attestation tokens
#   all                     - Rotates all three
# ============================================================================

set -e

ROTATABLE_SECRETS=("SESSION_SECRET" "MFA_ENCRYPTION_KEY" "ATTESTATION_JWT_SECRET")

TASK_DEF_STAGING="edsteward-multi-tenant-staging"
TASK_DEF_PRODUCTION="edsteward-saml-production"
CLUSTER_STAGING="edsteward-staging-cluster"
CLUSTER_PRODUCTION="edsteward-production-cluster"
SERVICE_STAGING="edsteward-staging-service"
SERVICE_PRODUCTION="edsteward-saml-production"
AWS_REGION="${AWS_REGION:-us-east-1}"

ENV=""
SECRET_NAME=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --env)       ENV="$2"; shift 2 ;;
    --secret)    SECRET_NAME="$2"; shift 2 ;;
    --dry-run)   DRY_RUN=true; shift ;;
    -h|--help)
      echo "Usage: $0 --env <staging|production> --secret <name|all> [--dry-run]"
      echo ""
      echo "Secrets: SESSION_SECRET, MFA_ENCRYPTION_KEY, ATTESTATION_JWT_SECRET, all"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$ENV" || -z "$SECRET_NAME" ]]; then
  echo "❌ Required: --env <staging|production> --secret <name|all>"
  exit 1
fi

if [[ "$ENV" == "staging" ]]; then
  TASK_DEF="$TASK_DEF_STAGING"
  CLUSTER="$CLUSTER_STAGING"
  SERVICE="$SERVICE_STAGING"
elif [[ "$ENV" == "production" ]]; then
  TASK_DEF="$TASK_DEF_PRODUCTION"
  CLUSTER="$CLUSTER_PRODUCTION"
  SERVICE="$SERVICE_PRODUCTION"
else
  echo "❌ --env must be 'staging' or 'production'"
  exit 1
fi

# Determine which secrets to rotate
SECRETS_TO_ROTATE=()
if [[ "$SECRET_NAME" == "all" ]]; then
  SECRETS_TO_ROTATE=("${ROTATABLE_SECRETS[@]}")
else
  if ! printf '%s\n' "${ROTATABLE_SECRETS[@]}" | grep -qx "$SECRET_NAME"; then
    echo "❌ Unknown secret: $SECRET_NAME"
    echo "   Valid: ${ROTATABLE_SECRETS[*]}, all"
    exit 1
  fi
  SECRETS_TO_ROTATE=("$SECRET_NAME")
fi

echo "🔐 EdSteward Secret Rotation"
echo "   Environment: $ENV"
echo "   Task Def:    $TASK_DEF"
echo "   Secrets:     ${SECRETS_TO_ROTATE[*]}"
echo ""

# Impact warnings
for secret in "${SECRETS_TO_ROTATE[@]}"; do
  case $secret in
    SESSION_SECRET)
      echo "⚠️  SESSION_SECRET: All active sessions will be invalidated. Users must re-login." ;;
    MFA_ENCRYPTION_KEY)
      echo "⚠️  MFA_ENCRYPTION_KEY: All MFA enrollments will be invalidated. Users must re-enroll MFA." ;;
    ATTESTATION_JWT_SECRET)
      echo "⚠️  ATTESTATION_JWT_SECRET: Pending attestation tokens will be invalidated." ;;
  esac
done
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo "🏃 DRY RUN — generating values but not applying"
  echo ""
  for secret in "${SECRETS_TO_ROTATE[@]}"; do
    NEW_VALUE=$(openssl rand -hex 32)
    echo "   $secret → ${NEW_VALUE:0:8}...${NEW_VALUE: -8} (64 hex chars)"
  done
  echo ""
  echo "✅ Dry run complete. Remove --dry-run to apply."
  exit 0
fi

if [[ "$ENV" == "production" ]]; then
  echo "🔴 This is PRODUCTION. Type 'rotate $ENV' to confirm:"
  read -r CONFIRM
  if [[ "$CONFIRM" != "rotate $ENV" ]]; then
    echo "❌ Aborted."
    exit 1
  fi
fi

# Get current task definition
echo "📥 Fetching current task definition..."
CURRENT_TD=$(aws ecs describe-task-definition \
    --task-definition "$TASK_DEF" \
    --region "$AWS_REGION" 2>&1)

if [[ $? -ne 0 ]]; then
  echo "❌ Failed to fetch task definition: $CURRENT_TD"
  exit 1
fi

# Build the updated task definition
TD_JSON=$(echo "$CURRENT_TD" | python3 -c "
import json, sys
td = json.load(sys.stdin)['taskDefinition']
# Remove fields that can't be in register-task-definition
for key in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
    td.pop(key, None)
json.dump(td, sys.stdout)
")

# Rotate each secret
for secret in "${SECRETS_TO_ROTATE[@]}"; do
  NEW_VALUE=$(openssl rand -hex 32)
  echo "🔄 Rotating $secret → ${NEW_VALUE:0:8}...${NEW_VALUE: -8}"

  TD_JSON=$(echo "$TD_JSON" | python3 -c "
import json, sys
td = json.load(sys.stdin)
env = td['containerDefinitions'][0]['environment']
found = False
for e in env:
    if e['name'] == '$secret':
        e['value'] = '$NEW_VALUE'
        found = True
        break
if not found:
    env.append({'name': '$secret', 'value': '$NEW_VALUE'})
json.dump(td, sys.stdout)
")
done

# Write to temp file and register
TMPFILE=$(mktemp /tmp/rotate-td-XXXXXX.json)
echo "$TD_JSON" > "$TMPFILE"

echo "📤 Registering new task definition..."
NEW_TD_ARN=$(aws ecs register-task-definition \
    --cli-input-json "file://$TMPFILE" \
    --region "$AWS_REGION" \
    --query 'taskDefinition.taskDefinitionArn' --output text 2>&1)

if [[ $? -ne 0 ]]; then
  echo "❌ Failed to register task definition: $NEW_TD_ARN"
  rm -f "$TMPFILE"
  exit 1
fi

rm -f "$TMPFILE"
echo "✅ New task definition: $NEW_TD_ARN"

# Force new deployment
echo "🚀 Forcing new deployment..."
aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$SERVICE" \
    --task-definition "$NEW_TD_ARN" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null 2>&1

echo ""
echo "✅ Secret rotation complete!"
echo "   Environment:      $ENV"
echo "   Rotated:          ${SECRETS_TO_ROTATE[*]}"
echo "   Task Definition:  $NEW_TD_ARN"
echo ""
echo "   Monitor deployment: aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].deployments' --region $AWS_REGION"

# Log the rotation event
LOG_DIR="$(dirname "$0")/../deployments/rotations"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d)-$ENV.json"
cat > "$LOG_FILE" <<LOGEOF
{
  "event": "secret-rotation",
  "environment": "$ENV",
  "secrets": $(printf '%s\n' "${SECRETS_TO_ROTATE[@]}" | python3 -c "import json,sys; print(json.dumps([l.strip() for l in sys.stdin]))"),
  "taskDefinition": "$NEW_TD_ARN",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "rotatedBy": "$(whoami)"
}
LOGEOF
echo "   Rotation logged: $LOG_FILE"
