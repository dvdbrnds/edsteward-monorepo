#!/bin/zsh
# Check regulation ID alignment between local dev and production databases.
# Run before deploying to ensure no ID drift has occurred.
#
# Usage: ./scripts/check-regulation-id-alignment.sh [--fix]

set -euo pipefail

SCRIPT_DIR="${0:a:h}"
APP_DIR="${SCRIPT_DIR:h}"
ENV_FILE="$APP_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing $ENV_FILE"
  exit 1
fi

DB_URL=$(grep "^DATABASE_URL" "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'")

if [[ -z "$DB_URL" ]]; then
  echo "❌ DATABASE_URL not found in .env"
  exit 1
fi

PROD_DB_URL=$(aws ecs describe-task-definition --task-definition edsteward-saml-production \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' --output text 2>/dev/null)

if [[ -z "$PROD_DB_URL" ]]; then
  echo "❌ Could not retrieve production DATABASE_URL from ECS"
  echo "   Make sure AWS CLI is configured and you have access to edsteward-saml-production"
  exit 1
fi

echo "🔍 Checking regulation ID alignment..."
echo ""

# Get regulation name+id pairs from both databases
PROD_REGS=$(psql "$PROD_DB_URL" -t -A -c "SELECT id || '|' || name FROM regulations ORDER BY id;")
LOCAL_REGS=$(psql "$DB_URL" -t -A -c "SELECT id || '|' || name FROM regulations ORDER BY id;")

PROD_COUNT=$(echo "$PROD_REGS" | wc -l | tr -d ' ')
LOCAL_COUNT=$(echo "$LOCAL_REGS" | wc -l | tr -d ' ')

echo "Production: $PROD_COUNT regulations"
echo "Local:      $LOCAL_COUNT regulations"
echo ""

MISMATCHES=0
MISSING=0

while IFS='|' read -r pid pname; do
  [[ -z "$pid" ]] && continue
  LOCAL_MATCH=$(echo "$LOCAL_REGS" | grep "|${pname}$" | head -1)
  LOCAL_ID=$(echo "$LOCAL_MATCH" | cut -d'|' -f1)
  
  if [[ -z "$LOCAL_ID" ]]; then
    MISSING=$((MISSING+1))
    echo "⚠️  MISSING in local: id=$pid name='$pname'"
  elif [[ "$LOCAL_ID" != "$pid" ]]; then
    MISMATCHES=$((MISMATCHES+1))
    echo "❌ ID MISMATCH: '$pname' — prod=$pid local=$LOCAL_ID"
  fi
done <<< "$PROD_REGS"

echo ""
if [[ $MISMATCHES -eq 0 && $MISSING -eq 0 ]]; then
  echo "✅ All $PROD_COUNT production regulations have matching IDs in local"
  
  LOCAL_ONLY=$((LOCAL_COUNT - PROD_COUNT))
  if [[ $LOCAL_ONLY -gt 0 ]]; then
    MAX_PROD_ID=$(psql "$PROD_DB_URL" -t -A -c "SELECT MAX(id) FROM regulations;")
    echo "   Local has $LOCAL_ONLY additional regulations (IDs > $MAX_PROD_ID)"
  fi
  exit 0
else
  echo "❌ ALIGNMENT FAILED"
  echo "   Mismatched IDs: $MISMATCHES"
  echo "   Missing in local: $MISSING"
  echo ""
  echo "   Run the database alignment procedure to fix this."
  echo "   See: packages/app/scripts/db-align/README.md"
  exit 1
fi
