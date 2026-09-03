#!/bin/zsh

# =============================================================================
# EdSteward: Neon -> Coolify PostgreSQL Migration Script
# =============================================================================
# Exports a database from Neon and imports it into a Coolify-managed PostgreSQL.
#
# Usage:
#   ./scripts/migrate-to-coolify.sh export <neon-database-url> [dump-file]
#   ./scripts/migrate-to-coolify.sh import <coolify-database-url> <dump-file>
#   ./scripts/migrate-to-coolify.sh verify <database-url>
#   ./scripts/migrate-to-coolify.sh full <neon-url> <coolify-url>
#
# Examples:
#   # Export from Neon production
#   ./scripts/migrate-to-coolify.sh export "postgresql://...@ep-weathered-term.../neondb" moravian-prod.dump
#
#   # Import into Coolify PostgreSQL
#   ./scripts/migrate-to-coolify.sh import "postgresql://edsteward:pass@localhost:5432/edsteward" moravian-prod.dump
#
#   # Full migration (export + import + verify)
#   ./scripts/migrate-to-coolify.sh full "postgresql://...@ep-weathered-term.../neondb" "postgresql://edsteward:pass@localhost:5432/edsteward"
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[MIGRATE]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DUMP_DIR="./migration-dumps"

# Ensure prerequisites
if ! command -v pg_dump &>/dev/null; then
    err "pg_dump not found. Install with: brew install postgresql"
fi
if ! command -v pg_restore &>/dev/null; then
    err "pg_restore not found. Install with: brew install postgresql"
fi
if ! command -v psql &>/dev/null; then
    err "psql not found. Install with: brew install postgresql"
fi

mkdir -p "$DUMP_DIR"

# =============================================================================
# Export from Neon
# =============================================================================
do_export() {
    local SOURCE_URL="$1"
    local DUMP_FILE="${2:-$DUMP_DIR/edsteward-$TIMESTAMP.dump}"

    log "Exporting database from Neon..."
    log "Target dump file: $DUMP_FILE"

    # Test connection
    log "Testing source connection..."
    if ! psql "$SOURCE_URL" -c "SELECT 1;" &>/dev/null; then
        err "Cannot connect to source database. Check the URL."
    fi
    ok "Source connection verified"

    # Get row counts before export
    log "Source database row counts:"
    psql "$SOURCE_URL" -t -A -c "
        SELECT 'regulations: ' || COUNT(*) FROM regulations
        UNION ALL SELECT 'compliance_tasks: ' || COUNT(*) FROM compliance_tasks
        UNION ALL SELECT 'users: ' || COUNT(*) FROM users
        UNION ALL SELECT 'role_assignments: ' || COUNT(*) FROM role_assignments
        UNION ALL SELECT 'evidence_files: ' || COUNT(*) FROM evidence_files
        UNION ALL SELECT 'file_storage: ' || COUNT(*) FROM file_storage
        UNION ALL SELECT 'audit_logs: ' || COUNT(*) FROM audit_logs
        UNION ALL SELECT 'session: ' || COUNT(*) FROM session;
    " 2>/dev/null || warn "Some tables may not exist yet"

    # Export with pg_dump (custom format for faster restore)
    log "Running pg_dump (custom format)..."
    pg_dump "$SOURCE_URL" \
        --format=custom \
        --verbose \
        --no-owner \
        --no-privileges \
        --file="$DUMP_FILE" \
        2>&1 | tail -5

    local DUMP_SIZE=$(ls -lh "$DUMP_FILE" | awk '{print $5}')
    ok "Export complete: $DUMP_FILE ($DUMP_SIZE)"
    echo "$DUMP_FILE"
}

# =============================================================================
# Import into Coolify PostgreSQL
# =============================================================================
do_import() {
    local TARGET_URL="$1"
    local DUMP_FILE="$2"

    if [[ ! -f "$DUMP_FILE" ]]; then
        err "Dump file not found: $DUMP_FILE"
    fi

    log "Importing database into Coolify PostgreSQL..."
    log "Dump file: $DUMP_FILE"

    # Test connection
    log "Testing target connection..."
    if ! psql "$TARGET_URL" -c "SELECT 1;" &>/dev/null; then
        err "Cannot connect to target database. Is the Coolify PostgreSQL container running?"
    fi
    ok "Target connection verified"

    # Check if target has existing data
    local EXISTING_ROWS=$(psql "$TARGET_URL" -t -A -c "
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    " 2>/dev/null || echo "0")

    if [[ "$EXISTING_ROWS" -gt "0" ]]; then
        warn "Target database has $EXISTING_ROWS existing tables."
        echo -n "  Drop existing schema and import? [y/N]: "
        read CONFIRM
        if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
            err "Aborted by user"
        fi
        log "Dropping existing schema..."
        psql "$TARGET_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null
    fi

    # Restore
    log "Running pg_restore..."
    pg_restore "$TARGET_URL" \
        --verbose \
        --no-owner \
        --no-privileges \
        --single-transaction \
        "$DUMP_FILE" \
        2>&1 | tail -10

    ok "Import complete"
}

# =============================================================================
# Verify migration
# =============================================================================
do_verify() {
    local DB_URL="$1"

    log "Verifying database integrity..."

    # Check key tables exist and have data
    local RESULTS=$(psql "$DB_URL" -t -A -c "
        SELECT 'regulations: ' || COUNT(*) FROM regulations
        UNION ALL SELECT 'compliance_tasks: ' || COUNT(*) FROM compliance_tasks
        UNION ALL SELECT 'users: ' || COUNT(*) FROM users
        UNION ALL SELECT 'role_assignments: ' || COUNT(*) FROM role_assignments
        UNION ALL SELECT 'evidence_files: ' || COUNT(*) FROM evidence_files
        UNION ALL SELECT 'audit_logs: ' || COUNT(*) FROM audit_logs;
    " 2>/dev/null)

    echo "$RESULTS"

    # Check for critical data
    local REG_COUNT=$(psql "$DB_URL" -t -A -c "SELECT COUNT(*) FROM regulations;" 2>/dev/null)
    local TASK_COUNT=$(psql "$DB_URL" -t -A -c "SELECT COUNT(*) FROM compliance_tasks;" 2>/dev/null)
    local USER_COUNT=$(psql "$DB_URL" -t -A -c "SELECT COUNT(*) FROM users;" 2>/dev/null)

    if [[ "$REG_COUNT" -gt "0" ]]; then
        ok "Regulations: $REG_COUNT rows"
    else
        warn "No regulations found!"
    fi

    if [[ "$TASK_COUNT" -gt "0" ]]; then
        ok "Compliance tasks: $TASK_COUNT rows"
    else
        warn "No compliance tasks found!"
    fi

    if [[ "$USER_COUNT" -gt "0" ]]; then
        ok "Users: $USER_COUNT rows"
    else
        warn "No users found!"
    fi

    # Check reg_key alignment
    local NULL_REGKEYS=$(psql "$DB_URL" -t -A -c "SELECT COUNT(*) FROM regulations WHERE reg_key IS NULL;" 2>/dev/null)
    if [[ "$NULL_REGKEYS" -gt "0" ]]; then
        warn "$NULL_REGKEYS regulations have NULL reg_key values"
    else
        ok "All regulations have reg_key values"
    fi

    ok "Verification complete"
}

# =============================================================================
# Full migration (export + import + verify)
# =============================================================================
do_full() {
    local SOURCE_URL="$1"
    local TARGET_URL="$2"
    local DUMP_FILE="$DUMP_DIR/edsteward-full-$TIMESTAMP.dump"

    log "Starting full migration: Neon -> Coolify"
    echo ""

    log "Step 1/3: Export from Neon"
    do_export "$SOURCE_URL" "$DUMP_FILE"
    echo ""

    log "Step 2/3: Import into Coolify PostgreSQL"
    do_import "$TARGET_URL" "$DUMP_FILE"
    echo ""

    log "Step 3/3: Verify migration"
    do_verify "$TARGET_URL"
    echo ""

    ok "Full migration complete!"
    log "Dump file preserved at: $DUMP_FILE"
    log "Next steps:"
    log "  1. Test the application against the new database"
    log "  2. Verify SAML login works"
    log "  3. Check regulation list loads correctly"
    log "  4. Test MCP Engine push"
}

# =============================================================================
# Main
# =============================================================================
case "${1:-}" in
    export)
        [[ -z "${2:-}" ]] && err "Usage: $0 export <neon-database-url> [dump-file]"
        do_export "$2" "${3:-}"
        ;;
    import)
        [[ -z "${2:-}" || -z "${3:-}" ]] && err "Usage: $0 import <coolify-database-url> <dump-file>"
        do_import "$2" "$3"
        ;;
    verify)
        [[ -z "${2:-}" ]] && err "Usage: $0 verify <database-url>"
        do_verify "$2"
        ;;
    full)
        [[ -z "${2:-}" || -z "${3:-}" ]] && err "Usage: $0 full <neon-url> <coolify-url>"
        do_full "$2" "$3"
        ;;
    *)
        echo "EdSteward Neon -> Coolify PostgreSQL Migration"
        echo ""
        echo "Usage:"
        echo "  $0 export <neon-database-url> [dump-file]    Export from Neon"
        echo "  $0 import <coolify-database-url> <dump-file>  Import into Coolify PG"
        echo "  $0 verify <database-url>                      Verify row counts"
        echo "  $0 full <neon-url> <coolify-url>              Full migration"
        exit 1
        ;;
esac
