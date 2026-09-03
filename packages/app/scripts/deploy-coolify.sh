#!/bin/zsh

# =============================================================================
# EdSteward: Deploy to Coolify
# =============================================================================
# Triggers a redeployment on Coolify by either:
#   1. Git push (if Coolify is connected to the repo's 'coolify' branch)
#   2. Coolify API webhook (if configured)
#
# Usage:
#   ./scripts/deploy-coolify.sh [--push|--api] [version]
#
# Options:
#   --push    Git-based deploy: commit, tag, push to 'coolify' branch (default)
#   --api     API-based deploy: trigger via Coolify webhook
#   version   Optional version tag (e.g., v1.6.0)
#
# Prerequisites:
#   - For --push: git remote 'origin' configured, on 'coolify' branch
#   - For --api: COOLIFY_API_TOKEN and COOLIFY_WEBHOOK_URL env vars set
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Parse arguments
MODE="push"
VERSION=""
for arg in "$@"; do
    case "$arg" in
        --push) MODE="push" ;;
        --api)  MODE="api" ;;
        --*)    err "Unknown option: $arg" ;;
        *)      VERSION="$arg" ;;
    esac
done

# =============================================================================
# Git-based deploy
# =============================================================================
deploy_git() {
    log "Deploying via Git push to 'coolify' branch..."

    # Verify we're on the coolify branch
    local CURRENT_BRANCH=$(git branch --show-current)
    if [[ "$CURRENT_BRANCH" != "coolify" ]]; then
        err "Not on 'coolify' branch (currently on '$CURRENT_BRANCH'). Switch with: git checkout coolify"
    fi

    # Check for uncommitted changes
    if [[ -n $(git status --porcelain) ]]; then
        warn "Uncommitted changes detected. Committing..."
        git add -A
        git commit -m "deploy: Coolify deployment ${VERSION:-$(date +%Y%m%d-%H%M%S)}"
    fi

    # Tag if version provided
    if [[ -n "$VERSION" ]]; then
        log "Tagging as $VERSION..."
        git tag -a "$VERSION" -m "Coolify deployment $VERSION"
        git push origin "$VERSION"
    fi

    # Push to trigger auto-deploy
    log "Pushing to origin/coolify..."
    git push origin coolify

    ok "Git push complete. Coolify will auto-deploy if configured."
    log "Check Coolify dashboard for deployment status."
}

# =============================================================================
# API-based deploy (Coolify webhook)
# =============================================================================
deploy_api() {
    log "Deploying via Coolify API webhook..."

    if [[ -z "${COOLIFY_API_TOKEN:-}" ]]; then
        err "COOLIFY_API_TOKEN not set. Get it from Coolify dashboard: Settings > API Tokens"
    fi
    if [[ -z "${COOLIFY_WEBHOOK_URL:-}" ]]; then
        err "COOLIFY_WEBHOOK_URL not set. Format: https://<coolify-host>/api/v1/deploy"
    fi

    local RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        "$COOLIFY_WEBHOOK_URL" \
        -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"force\": true}")

    local HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    local BODY=$(echo "$RESPONSE" | head -n -1)

    if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
        ok "Coolify deployment triggered (HTTP $HTTP_CODE)"
        echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    else
        err "Coolify API returned HTTP $HTTP_CODE: $BODY"
    fi
}

# =============================================================================
# Pre-flight checks
# =============================================================================
log "EdSteward Coolify Deployment"
log "Mode: $MODE"
[[ -n "$VERSION" ]] && log "Version: $VERSION"
echo ""

# Health check URLs (adjust if your Coolify FQDNs differ)
MORAVIAN_URL="${MORAVIAN_HEALTH_URL:-https://moravian.edsteward.ai/api/health}"
STAGING_URL="${STAGING_HEALTH_URL:-https://staging.edsteward.ai/api/health}"

# =============================================================================
# Deploy
# =============================================================================
case "$MODE" in
    push) deploy_git ;;
    api)  deploy_api ;;
    *)    err "Unknown mode: $MODE" ;;
esac

echo ""

# =============================================================================
# Post-deploy health checks
# =============================================================================
log "Waiting 30 seconds for containers to start..."
sleep 30

log "Running health checks..."
for URL in "$STAGING_URL" "$MORAVIAN_URL"; do
    DOMAIN=$(echo "$URL" | sed 's|https\?://||' | cut -d'/' -f1)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
        ok "$DOMAIN: healthy (HTTP $HTTP_CODE)"
    else
        warn "$DOMAIN: HTTP $HTTP_CODE (may still be starting)"
    fi
done

echo ""
ok "Deployment complete. Monitor in Coolify dashboard."
