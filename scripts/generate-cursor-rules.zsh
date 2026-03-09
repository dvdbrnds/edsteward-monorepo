#!/bin/zsh
#
# Generates .cursor/rules/project-state.mdc from the current codebase.
# Run from the monorepo root: zsh scripts/generate-cursor-rules.zsh
# Safe to run at any time — idempotent, overwrites the output file.

REPO_ROOT="${0:A:h:h}"
OUTPUT="$REPO_ROOT/.cursor/rules/project-state.mdc"

mkdir -p "$REPO_ROOT/.cursor/rules"

# --- Extract version from packages/app/client/src/lib/version.ts ---
VERSION_FILE="$REPO_ROOT/packages/app/client/src/lib/version.ts"
APP_VERSION="unknown"
APP_STAGE="unknown"
if [[ -f "$VERSION_FILE" ]]; then
  APP_VERSION=$(grep 'APP_VERSION' "$VERSION_FILE" | head -1 | sed 's/.*"\(.*\)".*/\1/' || true)
  APP_STAGE=$(grep 'APP_STAGE' "$VERSION_FILE" | head -1 | sed 's/.*"\(.*\)".*/\1/' || true)
  [[ -z "$APP_VERSION" ]] && APP_VERSION="unknown"
  [[ -z "$APP_STAGE" ]] && APP_STAGE="unknown"
fi

# --- Extract engine version from packages/engine/package.json ---
ENGINE_PKG="$REPO_ROOT/packages/engine/package.json"
ENGINE_VERSION="unknown"
if [[ -f "$ENGINE_PKG" ]]; then
  ENGINE_VERSION=$(grep '"version"' "$ENGINE_PKG" | head -1 | sed 's/.*"\([0-9][^"]*\)".*/\1/' || true)
  [[ -z "$ENGINE_VERSION" ]] && ENGINE_VERSION="unknown"
fi

# --- Ports (defaults from mcp-start.js CONFIG block) ---
REGISTRY_PORT="3010"
LLM_PORT="3002"
FRONTEND_PORT="3050"
DELIVERY_PORT="3051"
CUSTOMER_PORT="3060"
INQUISITOR_PORT="3061"

MCP_START="$REPO_ROOT/packages/engine/mcp-start.js"
if [[ -f "$MCP_START" ]]; then
  _try_port() {
    local result
    result=$(grep "$1" "$MCP_START" 2>/dev/null | head -1 | grep -o '[0-9]\{4,\}' 2>/dev/null || true)
    if [[ -n "$result" ]]; then
      echo "$result"
    else
      echo "$2"
    fi
  }
  REGISTRY_PORT=$(_try_port "registry:" "$REGISTRY_PORT")
  LLM_PORT=$(_try_port "llmGateway:" "$LLM_PORT")
  FRONTEND_PORT=$(_try_port "frontend:" "$FRONTEND_PORT")
  DELIVERY_PORT=$(_try_port "delivery:" "$DELIVERY_PORT")
  CUSTOMER_PORT=$(_try_port "customerManagement:" "$CUSTOMER_PORT")
  INQUISITOR_PORT=$(_try_port "inquisitor:" "$INQUISITOR_PORT")
fi

# --- Environment URLs ---
PROD_URL="https://moravian.edsteward.ai"
STAGING_URL="https://staging.edsteward.ai"
DEV_URL="http://localhost:3000"

CUSTOMERS_JSON="$REPO_ROOT/packages/engine/config/customers.json"
if [[ -f "$CUSTOMERS_JSON" ]]; then
  _url=$(grep -A5 '"moravian-prod"' "$CUSTOMERS_JSON" 2>/dev/null | grep '"url"' | sed 's/.*"\(http[^"]*\)".*/\1/' || true)
  [[ -n "$_url" ]] && PROD_URL="$_url"
fi

# --- Count regulation JSON files ---
ENHANCED_DIR="$REPO_ROOT/packages/engine/enhanced-regulations"
REG_COUNT="unknown"
if [[ -d "$ENHANCED_DIR" ]]; then
  REG_COUNT=$(ls -1 "$ENHANCED_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
  [[ -z "$REG_COUNT" ]] && REG_COUNT="0"
fi

# --- Workspace packages ---
PACKAGES_TABLE=""
for pkg_json in "$REPO_ROOT"/packages/*/package.json; do
  [[ -f "$pkg_json" ]] || continue
  pkg_name=$(grep '"name"' "$pkg_json" | head -1 | sed 's/.*"\([^"]*\)".*/\1/' || true)
  pkg_dir=$(dirname "$pkg_json")
  pkg_dir="${pkg_dir#$REPO_ROOT/}"
  PACKAGES_TABLE="${PACKAGES_TABLE}| \`${pkg_dir}\` | ${pkg_name} |
"
done

# --- Timestamp ---
GENERATED_AT=$(date '+%Y-%m-%d %H:%M:%S')

# --- Write output ---
cat > "$OUTPUT" <<EOF
---
description: "AUTO-GENERATED project state — do not edit by hand. Regenerate: zsh scripts/generate-cursor-rules.zsh"
globs:
alwaysApply: true
---

# Project State (auto-generated)

> Generated at: ${GENERATED_AT}

## Versions

| Component | Version |
|-----------|---------|
| EdSteward App | ${APP_STAGE} v${APP_VERSION} |
| MCP Engine | v${ENGINE_VERSION} |

## Workspace Packages

| Path | Package Name |
|------|-------------|
${PACKAGES_TABLE}
## Ports

| Port | Service | Health Check |
|------|---------|-------------|
| 3000 | EdSteward App (Express + Vite) | \`curl -s http://localhost:3000/api/health\` |
| 3001 | Admin Console Frontend (Vite) | \`curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/\` |
| 4000 | Admin Console Backend (Express) | \`curl -s http://localhost:4000/api/health\` |
| ${REGISTRY_PORT} | Engine: Registry API | \`curl -s http://localhost:${REGISTRY_PORT}/health\` |
| ${LLM_PORT} | Engine: LLM Gateway | \`curl -s http://localhost:${LLM_PORT}/api/llm/health\` |
| ${FRONTEND_PORT} | Engine: Frontend (Vite) | \`curl -s -o /dev/null -w "%{http_code}" http://localhost:${FRONTEND_PORT}/\` |
| ${DELIVERY_PORT} | Engine: Delivery Server | \`curl -s http://localhost:${DELIVERY_PORT}/health\` |
| ${CUSTOMER_PORT} | Engine: Customer API | \`curl -s -o /dev/null -w "%{http_code}" http://localhost:${CUSTOMER_PORT}/\` |
| ${INQUISITOR_PORT} | Engine: Inquisitor MCP | \`curl -s -o /dev/null -w "%{http_code}" http://localhost:${INQUISITOR_PORT}/\` |

## Environments

| Environment | URL |
|-------------|-----|
| Production | ${PROD_URL} |
| Staging | ${STAGING_URL} |
| Local Dev | ${DEV_URL} |

## Regulation Data

- Enhanced regulation JSON files: **${REG_COUNT}**
- Location: \`packages/engine/enhanced-regulations/\`
EOF

echo "Generated $OUTPUT"
