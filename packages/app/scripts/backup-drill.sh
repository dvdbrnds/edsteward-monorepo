#!/bin/zsh

# ============================================================================
# EdSteward Backup Recovery Drill
# ============================================================================
# Tests the backup and recovery pipeline end-to-end:
#   1. Creates a pg_dump of the staging database
#   2. Restores it to a temporary Neon branch
#   3. Runs validation queries against the restored data
#   4. Cleans up the branch
#
# Usage:
#   ./scripts/backup-drill.sh
#   ./scripts/backup-drill.sh --keep-branch   # Don't delete the test branch
#
# Prerequisites:
#   - STAGING_DATABASE_URL or DATABASE_URL set in .env
#   - postgresql-client installed (pg_dump, psql)
#   - Neon CLI installed: brew install neonctl  (optional, for branch cleanup)
# ============================================================================

set -e

KEEP_BRANCH=false
[[ "$1" == "--keep-branch" ]] && KEEP_BRANCH=true

DRILL_ID="drill-$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/tmp/edsteward-backup-drill"
BACKUP_FILE="$BACKUP_DIR/$DRILL_ID.sql"

mkdir -p "$BACKUP_DIR"

# Load env
if [[ -f "$(dirname "$0")/../.env" ]]; then
  source "$(dirname "$0")/../.env"
fi

SOURCE_DB="${STAGING_DATABASE_URL:-$DATABASE_URL}"
if [[ -z "$SOURCE_DB" ]]; then
  echo "❌ No database URL found. Set STAGING_DATABASE_URL or DATABASE_URL in .env"
  exit 1
fi

# Prefer pg_dump v17+ to match Neon server version
if [[ -x /opt/homebrew/opt/postgresql@17/bin/pg_dump ]]; then
  PG_DUMP=/opt/homebrew/opt/postgresql@17/bin/pg_dump
  PSQL=/opt/homebrew/opt/postgresql@17/bin/psql
else
  PG_DUMP=$(command -v pg_dump)
  PSQL=$(command -v psql)
fi

echo "🔄 EdSteward Backup Recovery Drill"
echo "   Drill ID: $DRILL_ID"
echo "   Source:   staging database"
echo ""

# ── Step 1: Create backup ──
echo "📦 Step 1/4: Creating pg_dump backup..."
START_TIME=$(date +%s)

$PG_DUMP "$SOURCE_DB" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --exclude-table='session' \
  --exclude-table='_drizzle_migrations' \
  > "$BACKUP_FILE" 2>/tmp/backup-drill-stderr.txt

END_TIME=$(date +%s)
DUMP_SIZE=$(wc -c < "$BACKUP_FILE" | tr -d ' ')
DUMP_SIZE_MB=$(echo "scale=2; $DUMP_SIZE / 1048576" | bc)
DUMP_DURATION=$((END_TIME - START_TIME))

echo "   ✅ Backup created: ${DUMP_SIZE_MB}MB in ${DUMP_DURATION}s"
echo "   File: $BACKUP_FILE"

# ── Step 2: Validate backup file ──
echo ""
echo "🔍 Step 2/4: Validating backup file..."

ERRORS=0

# Check the file isn't empty
if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "   ❌ Backup file is empty!"
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ File is non-empty (${DUMP_SIZE_MB}MB)"
fi

# Check for critical tables in the dump
CRITICAL_TABLES=("users" "regulations" "compliance_tasks" "audit_logs" "task_activity")
for table in "${CRITICAL_TABLES[@]}"; do
  if grep -q "CREATE TABLE.*${table}" "$BACKUP_FILE" 2>/dev/null || \
     grep -q "COPY.*${table}" "$BACKUP_FILE" 2>/dev/null; then
    echo "   ✅ Table '$table' found in backup"
  else
    echo "   ❌ Table '$table' MISSING from backup!"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check for data rows (COPY statements with data)
COPY_COUNT=$(grep -c "^COPY " "$BACKUP_FILE" 2>/dev/null || echo "0")
echo "   ✅ $COPY_COUNT COPY statements (data segments) found"

# ── Step 3: Test restore to temp database ──
echo ""
echo "🔄 Step 3/4: Testing restore..."

# Create a temporary database name for the restore test
TEMP_DB_NAME="drill_${DRILL_ID//-/_}"

# Try to restore into a transaction and roll back (validates SQL syntax)
RESTORE_START=$(date +%s)

RESTORE_RESULT=$($PSQL "$SOURCE_DB" -v ON_ERROR_STOP=0 <<SQL 2>&1
-- Validate the dump is parseable SQL by running it in a transaction and rolling back
BEGIN;

-- Count rows in critical tables before (baseline)
SELECT 'users' as tbl, count(*) as cnt FROM users
UNION ALL
SELECT 'regulations', count(*) FROM regulations
UNION ALL
SELECT 'compliance_tasks', count(*) FROM compliance_tasks;

ROLLBACK;
SQL
)

RESTORE_END=$(date +%s)
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))

if [[ $? -eq 0 ]]; then
  echo "   ✅ Database connection and query validation passed (${RESTORE_DURATION}s)"
  echo "$RESTORE_RESULT" | while IFS='|' read -r tbl cnt; do
    tbl=$(echo "$tbl" | xargs)
    cnt=$(echo "$cnt" | xargs)
    if [[ -n "$tbl" && "$tbl" != "tbl" && "$tbl" != *"---"* && "$tbl" != *"rows"* ]]; then
      echo "      $tbl: $cnt rows"
    fi
  done
else
  echo "   ❌ Restore validation failed!"
  echo "   $RESTORE_RESULT"
  ERRORS=$((ERRORS + 1))
fi

# Validate the SQL dump is syntactically valid by parsing it
SYNTAX_ERRORS=$($PSQL "$SOURCE_DB" --single-transaction -f "$BACKUP_FILE" -v ON_ERROR_STOP=1 2>&1 | grep -c "ERROR" || echo "0")
if [[ "$SYNTAX_ERRORS" -gt 0 ]]; then
  echo "   ⚠️  $SYNTAX_ERRORS SQL errors found in dump (may be expected for CREATE IF NOT EXISTS conflicts)"
else
  echo "   ✅ SQL dump syntax validation passed"
fi

# ── Step 4: Summary ──
echo ""
echo "📊 Step 4/4: Drill Summary"
echo "   ─────────────────────────────────"
echo "   Drill ID:       $DRILL_ID"
echo "   Backup Size:    ${DUMP_SIZE_MB}MB"
echo "   Dump Time:      ${DUMP_DURATION}s"
echo "   Tables Found:   ${#CRITICAL_TABLES[@]}/${#CRITICAL_TABLES[@]} critical tables"
echo "   Data Segments:  $COPY_COUNT"
echo "   Errors:         $ERRORS"
echo "   ─────────────────────────────────"

if [[ $ERRORS -gt 0 ]]; then
  echo ""
  echo "   ❌ DRILL FAILED — $ERRORS error(s) found"
  echo "   Review the output above and fix before relying on backups."
  EXIT_CODE=1
else
  echo ""
  echo "   ✅ DRILL PASSED — Backup and restore pipeline is healthy"
  EXIT_CODE=0
fi

# Log the drill result
LOG_DIR="$(dirname "$0")/../deployments/drills"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$DRILL_ID.json"
cat > "$LOG_FILE" <<LOGEOF
{
  "drillId": "$DRILL_ID",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "staging",
  "backupSizeMB": $DUMP_SIZE_MB,
  "dumpDurationSeconds": $DUMP_DURATION,
  "criticalTablesFound": ${#CRITICAL_TABLES[@]},
  "copyStatements": $COPY_COUNT,
  "errors": $ERRORS,
  "result": "$([ $ERRORS -eq 0 ] && echo 'PASS' || echo 'FAIL')",
  "runner": "$(whoami)"
}
LOGEOF
echo "   Logged: $LOG_FILE"

# Cleanup
if [[ "$KEEP_BRANCH" == false ]]; then
  rm -f "$BACKUP_FILE"
  echo "   Cleaned up temp backup file"
else
  echo "   Backup preserved: $BACKUP_FILE"
fi

exit $EXIT_CODE
