#!/bin/zsh
# =============================================================================
# Seed the Coolify engine-postgres with regulation data from local mcp_engine
# =============================================================================
#
# Usage:
#   # Option A: Direct connection (if engine-postgres port is exposed)
#   ./seed-engine-db.sh "postgresql://mcp_user:mcp_secure_2026@10.232.1.50:9433/mcp_engine"
#
#   # Option B: Copy dump into container and restore
#   docker cp mcp_engine_seed.dump <container_id>:/tmp/
#   docker exec <container_id> pg_restore -U mcp_user -d mcp_engine --clean --if-exists /tmp/mcp_engine_seed.dump
#
# The dump file is in custom format (pg_dump -Fc), use pg_restore to import.
# =============================================================================

set -euo pipefail

DUMP_FILE="$(dirname "$0")/mcp_engine_seed.dump"

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "ERROR: Dump file not found: $DUMP_FILE"
  echo "Run from packages/engine/coolify/ or provide the full path"
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <target-database-url>"
  echo ""
  echo "Example:"
  echo "  $0 'postgresql://mcp_user:mcp_secure_2026@10.232.1.50:9433/mcp_engine'"
  exit 1
fi

TARGET_URL="$1"

echo "Seeding engine database from: $DUMP_FILE"
echo "Target: $TARGET_URL"
echo ""

pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "$TARGET_URL" "$DUMP_FILE" 2>&1 || true

echo ""
echo "Seed complete. Verifying..."

psql "$TARGET_URL" -c "SELECT relname as table_name, n_live_tup as row_count FROM pg_stat_user_tables ORDER BY n_live_tup DESC;" 2>&1

echo "Done."
