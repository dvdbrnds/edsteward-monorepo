#!/bin/zsh
# check-regulation-alignment.zsh
#
# Compares reg_key alignment between the MCP Engine DB and a target app DB.
# Exits non-zero if any misalignment is detected.
#
# Usage:
#   ./scripts/check-regulation-alignment.zsh                 # compares engine vs production
#   ./scripts/check-regulation-alignment.zsh --target dev    # compares engine vs local dev
#   ./scripts/check-regulation-alignment.zsh --target staging
#   ./scripts/check-regulation-alignment.zsh --verbose       # show full details

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

VERBOSE=false
TARGET="production"

for arg in "$@"; do
  case "$arg" in
    --verbose) VERBOSE=true ;;
    --target) ;; # next arg is the value
    dev|staging|production) TARGET="$arg" ;;
  esac
done

ENGINE_DB="postgresql://localhost:5432/mcp_engine"

case "$TARGET" in
  production)
    TARGET_DB=$(aws ecs describe-task-definition --task-definition edsteward-saml-production \
      --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' \
      --output text 2>/dev/null)
    if [[ -z "$TARGET_DB" ]]; then
      echo "❌ Could not retrieve production DATABASE_URL from ECS"
      exit 1
    fi
    ;;
  dev|staging)
    source "$REPO_ROOT/packages/app/.env" 2>/dev/null
    TARGET_DB="$DATABASE_URL"
    ;;
esac

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo "🔍 Regulation Alignment Check: Engine ↔ ${TARGET}"
echo "   Engine DB: localhost:5432/mcp_engine"
echo "   Target DB: ${TARGET}"
echo ""

# Export reg_keys from both databases
psql "$ENGINE_DB" -t -A -c "
  SELECT reg_key, jurisdiction_source, name
  FROM regulations WHERE is_current = TRUE AND reg_key IS NOT NULL
  ORDER BY reg_key
" > "$TMPDIR/engine.txt"

psql "$TARGET_DB" -t -A -c "
  SELECT reg_key, jurisdiction_source, name
  FROM regulations WHERE is_current = TRUE AND reg_key IS NOT NULL
  ORDER BY reg_key
" > "$TMPDIR/target.txt"

ENGINE_COUNT=$(wc -l < "$TMPDIR/engine.txt" | tr -d ' ')
TARGET_COUNT=$(wc -l < "$TMPDIR/target.txt" | tr -d ' ')

# Extract just keys for set operations
awk -F'|' '{print $1}' "$TMPDIR/engine.txt" | sort > "$TMPDIR/engine_keys.txt"
awk -F'|' '{print $1}' "$TMPDIR/target.txt" | sort > "$TMPDIR/target_keys.txt"

MATCHED=$(comm -12 "$TMPDIR/engine_keys.txt" "$TMPDIR/target_keys.txt" | wc -l | tr -d ' ')
TARGET_ONLY=$(comm -23 "$TMPDIR/target_keys.txt" "$TMPDIR/engine_keys.txt" | wc -l | tr -d ' ')
ENGINE_ONLY=$(comm -13 "$TMPDIR/target_keys.txt" "$TMPDIR/engine_keys.txt" | wc -l | tr -d ' ')

# Check for NULL reg_keys in target
NULL_KEYS=$(psql "$TARGET_DB" -t -A -c "
  SELECT COUNT(*) FROM regulations WHERE is_current = TRUE AND reg_key IS NULL
")

# Check for name collisions on shared keys
COLLISIONS=0
while IFS='|' read -r ekey ejuris ename; do
  tline=$(grep "^${ekey}|" "$TMPDIR/target.txt" | head -1)
  if [[ -n "$tline" ]]; then
    tname=$(echo "$tline" | cut -d'|' -f3)
    enorm=$(echo "$ename" | tr '[:upper:]' '[:lower:]' | cut -c1-25)
    tnorm=$(echo "$tname" | tr '[:upper:]' '[:lower:]' | cut -c1-25)
    if [[ "$enorm" != "$tnorm" ]]; then
      COLLISIONS=$((COLLISIONS + 1))
      if $VERBOSE; then
        echo "  ⚠️  $ekey collision:"
        echo "     Engine: $ename"
        echo "     Target: $tname"
      fi
    fi
  fi
done < "$TMPDIR/engine.txt"

# Jurisdiction count comparison
ENGINE_FED=$(psql "$ENGINE_DB" -t -A -c "SELECT COUNT(*) FROM regulations WHERE is_current = TRUE AND jurisdiction_source = 'federal'")
TARGET_FED=$(psql "$TARGET_DB" -t -A -c "SELECT COUNT(*) FROM regulations WHERE is_current = TRUE AND jurisdiction_source = 'federal'")
ENGINE_STATE=$(psql "$ENGINE_DB" -t -A -c "SELECT COUNT(*) FROM regulations WHERE is_current = TRUE AND jurisdiction_source = 'state'")
TARGET_STATE=$(psql "$TARGET_DB" -t -A -c "SELECT COUNT(*) FROM regulations WHERE is_current = TRUE AND jurisdiction_source = 'state'")

echo "📊 Results:"
echo "   Engine regs (with key): $ENGINE_COUNT"
echo "   Target regs (with key): $TARGET_COUNT"
echo "   Matched reg_keys:       $MATCHED"
echo "   Target-only keys:       $TARGET_ONLY"
echo "   Engine-only keys:       $ENGINE_ONLY"
echo "   Name collisions:        $COLLISIONS"
echo "   Target NULL reg_keys:   $NULL_KEYS"
echo ""
echo "   Federal — Engine: $ENGINE_FED / Target: $TARGET_FED"
echo "   State   — Engine: $ENGINE_STATE / Target: $TARGET_STATE"
echo ""

ERRORS=0

if [[ "$TARGET_ONLY" -gt 0 ]]; then
  echo "❌ DRIFT: $TARGET_ONLY regulations in ${TARGET} are missing from the engine"
  if $VERBOSE; then
    comm -23 "$TMPDIR/target_keys.txt" "$TMPDIR/engine_keys.txt" | while read key; do
      grep "^${key}|" "$TMPDIR/target.txt"
    done
  fi
  ERRORS=$((ERRORS + 1))
fi

if [[ "$COLLISIONS" -gt 0 ]]; then
  echo "❌ COLLISION: $COLLISIONS reg_keys map to different regulations"
  ERRORS=$((ERRORS + 1))
fi

if [[ "$NULL_KEYS" -gt 0 ]]; then
  echo "⚠️  WARNING: $NULL_KEYS regulations in ${TARGET} have no reg_key"
  if $VERBOSE; then
    psql "$TARGET_DB" -t -A -c "
      SELECT id, item_id, jurisdiction_source, name
      FROM regulations WHERE is_current = TRUE AND reg_key IS NULL
      ORDER BY id
    "
  fi
fi

if [[ "$ENGINE_ONLY" -gt 0 ]]; then
  echo "ℹ️  INFO: $ENGINE_ONLY engine regulations not yet in ${TARGET}"
  if $VERBOSE; then
    comm -13 "$TMPDIR/target_keys.txt" "$TMPDIR/engine_keys.txt" | while read key; do
      grep "^${key}|" "$TMPDIR/engine.txt"
    done
  fi
fi

echo ""
if [[ "$ERRORS" -eq 0 && "$NULL_KEYS" -eq 0 ]]; then
  echo "✅ ALIGNED: All $MATCHED reg_keys match between engine and ${TARGET}"
  exit 0
elif [[ "$ERRORS" -eq 0 ]]; then
  echo "⚠️  MOSTLY ALIGNED: Keys match but $NULL_KEYS regs missing keys"
  exit 0
else
  echo "❌ MISALIGNED: $ERRORS issues found"
  exit 1
fi
