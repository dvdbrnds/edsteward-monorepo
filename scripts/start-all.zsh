#!/bin/zsh
#
# EdSteward Monorepo — Start All Services
#
# Clears all ports, starts Docker infrastructure, then launches
# the MCP Engine and EdSteward App with a single Ctrl+C to stop everything.
#
# Usage: zsh scripts/start-all.zsh [--skip-docker] [--skip-admin]

set -uo pipefail

REPO_ROOT="${0:A:h:h}"

# ── Flags ──────────────────────────────────────────────────────────────────────
SKIP_DOCKER=false
SKIP_ADMIN=false
for arg in "$@"; do
  case "$arg" in
    --skip-docker) SKIP_DOCKER=true ;;
    --skip-admin)  SKIP_ADMIN=true ;;
    --help|-h)
      echo "Usage: zsh scripts/start-all.zsh [--skip-docker] [--skip-admin]"
      echo "  --skip-docker  Skip Docker infrastructure (postgres, redis, kafka)"
      echo "  --skip-admin   Skip admin console (ports 3001, 4000)"
      exit 0 ;;
  esac
done

# ── Port Configuration ─────────────────────────────────────────────────────────
APP_PORTS=(3000)
ADMIN_PORTS=(3001 4000)
ENGINE_PORTS=(3003 3004 3010 3050 3060 3061)

if $SKIP_ADMIN; then
  ALL_PORTS=($APP_PORTS $ENGINE_PORTS)
else
  ALL_PORTS=($APP_PORTS $ADMIN_PORTS $ENGINE_PORTS)
fi

# ── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo "${BLUE}[$(date +%H:%M:%S)]${NC} $1" }
ok()   { echo "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1" }
warn() { echo "${YELLOW}[$(date +%H:%M:%S)] !${NC} $1" }
err()  { echo "${RED}[$(date +%H:%M:%S)] ✗${NC} $1" }

# ── Track child PIDs for cleanup ───────────────────────────────────────────────
CHILD_PIDS=()
SHUTTING_DOWN=false

cleanup() {
  if $SHUTTING_DOWN; then return; fi
  SHUTTING_DOWN=true
  echo ""
  log "Shutting down all services..."

  for pid in "${CHILD_PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null
    fi
  done

  sleep 2

  for pid in "${CHILD_PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      warn "Force-killing PID $pid"
      kill -9 "$pid" 2>/dev/null
    fi
  done

  ok "All services stopped."
  exit 0
}

trap cleanup INT TERM

# ── Clear Ports ────────────────────────────────────────────────────────────────
echo ""
echo "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "${BOLD}  EdSteward — Starting All Services${NC}"
echo "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

log "Clearing ports: ${ALL_PORTS[*]}"

for port in "${ALL_PORTS[@]}"; do
  pids=$(lsof -ti tcp:"$port" 2>/dev/null)
  if [[ -n "$pids" ]]; then
    echo "$pids" | while read -r pid; do
      kill -9 "$pid" 2>/dev/null && warn "Killed PID $pid on port $port"
    done
    sleep 0.3
  fi
done

ok "All ports cleared."
echo ""

# ── Docker Infrastructure ──────────────────────────────────────────────────────
if ! $SKIP_DOCKER; then
  log "Checking Docker infrastructure..."

  if ! command -v docker &>/dev/null; then
    err "Docker not found. Install Docker or use --skip-docker."
    exit 1
  fi

  if ! docker info &>/dev/null; then
    warn "Docker daemon not running. Trying to start Colima..."
    colima start 2>/dev/null || {
      err "Could not start Docker. Start Colima/Docker Desktop manually, or use --skip-docker."
      exit 1
    }
  fi

  COMPOSE_FILE="$REPO_ROOT/packages/engine/docker-compose.yml"
  if [[ -f "$COMPOSE_FILE" ]]; then
    PG_RUNNING=$(docker ps --filter "name=postgres" --filter "status=running" -q 2>/dev/null)
    REDIS_RUNNING=$(docker ps --filter "name=redis" --filter "status=running" -q 2>/dev/null)

    if [[ -n "$PG_RUNNING" && -n "$REDIS_RUNNING" ]]; then
      ok "Docker infrastructure already running (postgres + redis)."
    else
      log "Starting PostgreSQL and Redis (skipping Kafka/Debezium — not needed locally)..."
      docker compose -f "$COMPOSE_FILE" up -d postgres redis 2>&1 | while read -r line; do
        echo "  ${CYAN}[docker]${NC} $line"
      done

      log "Waiting for PostgreSQL to be healthy..."
      for i in {1..30}; do
        if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U app_user -d regulations &>/dev/null; then
          ok "PostgreSQL is ready."
          break
        fi
        if [[ $i -eq 30 ]]; then
          err "PostgreSQL did not become healthy in time."
          exit 1
        fi
        sleep 1
      done

      log "Waiting for Redis to be healthy..."
      for i in {1..15}; do
        if docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping &>/dev/null; then
          ok "Redis is ready."
          break
        fi
        if [[ $i -eq 15 ]]; then
          warn "Redis did not respond — engine will fall back to in-memory cache."
        fi
        sleep 1
      done
    fi
  else
    warn "No docker-compose.yml found at $COMPOSE_FILE — skipping Docker."
  fi
  echo ""
fi

# ── Helper: wait for a port to respond ─────────────────────────────────────────
wait_for_port() {
  local port=$1 name=$2 max=${3:-30}
  for i in $(seq 1 $max); do
    if curl -sf "http://localhost:$port" &>/dev/null || \
       curl -sf "http://localhost:$port/health" &>/dev/null || \
       curl -sf "http://localhost:$port/api/health" &>/dev/null; then
      ok "$name is up on port $port"
      return 0
    fi
    sleep 1
  done
  warn "$name did not respond on port $port within ${max}s (may still be starting)"
  return 1
}

# ── Start MCP Engine ───────────────────────────────────────────────────────────
log "${MAGENTA}Starting MCP Engine...${NC}"

(cd "$REPO_ROOT/packages/engine" && node mcp-start.js 2>&1 | while IFS= read -r line; do
  echo "  ${MAGENTA}[engine]${NC} $line"
done) &
ENGINE_PID=$!
CHILD_PIDS+=($ENGINE_PID)

log "Engine launcher PID: $ENGINE_PID — waiting for Registry API (port 3010)..."
wait_for_port 3010 "Engine Registry API" 45
echo ""

# ── Start EdSteward App ───────────────────────────────────────────────────────
log "${GREEN}Starting EdSteward App...${NC}"

(cd "$REPO_ROOT/packages/app" && npx tsx server/index.ts 2>&1 | while IFS= read -r line; do
  echo "  ${GREEN}[app]${NC} $line"
done) &
APP_PID=$!
CHILD_PIDS+=($APP_PID)

log "App PID: $APP_PID — waiting for port 3000..."
wait_for_port 3000 "EdSteward App" 30
echo ""

# ── Start Admin Console ───────────────────────────────────────────────────────
if ! $SKIP_ADMIN; then
  log "${CYAN}Starting Admin Console...${NC}"

  (cd "$REPO_ROOT/packages/app/admin-console" && npx vite --port 3001 2>&1 | while IFS= read -r line; do
    echo "  ${CYAN}[admin-fe]${NC} $line"
  done) &
  ADMIN_FE_PID=$!
  CHILD_PIDS+=($ADMIN_FE_PID)

  (cd "$REPO_ROOT/packages/app/admin-console/server" && npx tsx watch index.ts 2>&1 | while IFS= read -r line; do
    echo "  ${CYAN}[admin-be]${NC} $line"
  done) &
  ADMIN_BE_PID=$!
  CHILD_PIDS+=($ADMIN_BE_PID)

  log "Admin Console frontend PID: $ADMIN_FE_PID, backend PID: $ADMIN_BE_PID"
  wait_for_port 3001 "Admin Console Frontend" 20
  echo ""
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "${BOLD}  All Services Running${NC}"
echo "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  ${GREEN}EdSteward App${NC}        http://localhost:3000"
if ! $SKIP_ADMIN; then
echo "  ${CYAN}Admin Console${NC}        http://localhost:3001"
echo "  ${CYAN}Admin API${NC}            http://localhost:4000"
fi
echo "  ${MAGENTA}Engine Registry${NC}     http://localhost:3010"
echo "  ${MAGENTA}Engine LLM Gateway${NC}  http://localhost:3004"
echo "  ${MAGENTA}Engine Frontend${NC}     http://localhost:3050"
echo "  ${MAGENTA}Engine Delivery${NC}     http://localhost:3003"
echo "  ${MAGENTA}Engine Customer API${NC} http://localhost:3060"
echo "  ${MAGENTA}Engine Inquisitor${NC}   http://localhost:3061"
echo ""
echo "  Press ${BOLD}Ctrl+C${NC} to stop everything."
echo ""

# ── Keep alive, wait for all children ──────────────────────────────────────────
wait
