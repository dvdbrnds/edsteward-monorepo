#!/bin/zsh

# ============================================================================
# Check Active Users Before Deployment
# ============================================================================
# Queries the target database to see who has been active recently.
# Run this BEFORE deploying to avoid disrupting active users.
#
# Usage:
#   ./scripts/check-active-users.sh              # Check local dev DB (default)
#   ./scripts/check-active-users.sh production    # Check production DB
#   ./scripts/check-active-users.sh staging       # Check staging DB
#   ./scripts/check-active-users.sh --minutes 30  # Custom activity window
# ============================================================================

set -e

MINUTES=15
TARGET="local"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        production|prod)
            TARGET="production"
            shift
            ;;
        staging)
            TARGET="staging"
            shift
            ;;
        local|dev)
            TARGET="local"
            shift
            ;;
        --minutes|-m)
            MINUTES="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Usage: $0 [production|staging|local] [--minutes N]"
            exit 1
            ;;
    esac
done

# Resolve the database URL
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [[ "$TARGET" == "production" ]]; then
    echo "🔴 Checking PRODUCTION active users..."
    DB_URL=$(aws ecs describe-task-definition \
        --task-definition edsteward-saml-production \
        --query 'taskDefinition.containerDefinitions[0].environment[?name==`DATABASE_URL`].value' \
        --output text 2>/dev/null)
    if [[ -z "$DB_URL" ]]; then
        echo "❌ Could not retrieve production DATABASE_URL from ECS. Make sure AWS CLI is configured."
        exit 1
    fi
elif [[ "$TARGET" == "staging" ]]; then
    echo "🟡 Checking STAGING active users..."
    DB_URL=$(grep "^DATABASE_URL" "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'")
else
    echo "🟢 Checking LOCAL DEV active users..."
    DB_URL=$(grep "^DATABASE_URL" "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'")
fi

if [[ -z "$DB_URL" ]]; then
    echo "❌ No DATABASE_URL found. Check your .env file."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Active users in the last ${MINUTES} minutes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ACTIVE=$(psql "$DB_URL" -t -A -F '|' -c "
  SELECT
    username,
    COALESCE(\"firstName\" || ' ' || \"lastName\", username) as name,
    role,
    to_char(last_active_at AT TIME ZONE 'America/New_York', 'HH12:MI AM') as last_active
  FROM users
  WHERE last_active_at > NOW() - INTERVAL '${MINUTES} minutes'
  ORDER BY last_active_at DESC;
" 2>/dev/null)

if [[ -z "$ACTIVE" ]]; then
    echo "  ✅ No active users in the last ${MINUTES} minutes. Safe to deploy!"
else
    COUNT=$(echo "$ACTIVE" | wc -l | tr -d ' ')
    echo "  ⚠️  ${COUNT} active user(s):"
    echo ""
    printf "  %-18s %-25s %-10s %s\n" "USERNAME" "NAME" "ROLE" "LAST ACTIVE"
    printf "  %-18s %-25s %-10s %s\n" "────────" "────" "────" "───────────"
    echo "$ACTIVE" | while IFS='|' read -r user name role active; do
        printf "  %-18s %-25s %-10s %s\n" "$user" "$name" "$role" "$active"
    done
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Also show recent logins for context
echo ""
echo "  Recent logins (last 24h):"
echo ""

RECENT=$(psql "$DB_URL" -t -A -F '|' -c "
  SELECT
    username,
    COALESCE(\"firstName\" || ' ' || \"lastName\", username) as name,
    to_char(last_login AT TIME ZONE 'America/New_York', 'Mon DD HH12:MI AM') as login_time
  FROM users
  WHERE last_login > NOW() - INTERVAL '24 hours'
  ORDER BY last_login DESC
  LIMIT 10;
" 2>/dev/null)

if [[ -z "$RECENT" ]]; then
    echo "  No logins in the last 24 hours."
else
    printf "  %-18s %-25s %s\n" "USERNAME" "NAME" "LOGGED IN"
    printf "  %-18s %-25s %s\n" "────────" "────" "─────────"
    echo "$RECENT" | while IFS='|' read -r user name login; do
        printf "  %-18s %-25s %s\n" "$user" "$name" "$login"
    done
fi

echo ""
