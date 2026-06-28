#!/bin/bash
# dev-start.sh — Start Redis, clear ports, and start dev servers with crash recovery
# Usage: bash scripts/dev-start.sh
#
# Features:
#   - Starts Redis via Docker (or reuses existing container)
#   - Sets REDIS_URL for the backend automatically
#   - Kills any process blocking ports 3000 (frontend) or 3001 (backend)
#   - Starts all three services with auto-restart on crash (up to 5 retries)
#   - Color-coded output: red=redis, yellow=backend, cyan=frontend

FRONTEND_PORT=3000
BACKEND_PORT=3001
REDIS_PORT=6379
REDIS_CONTAINER="rei-redis"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

clear_port() {
  local port=$1
  local pids
  pids=$(netstat -ano 2>/dev/null | grep ":${port} " | grep LISTENING | awk '{print $5}' | sort -u)
  if [ -n "$pids" ]; then
    for pid in $pids; do
      if [ -n "$pid" ] && [ "$pid" != "0" ]; then
        echo "  Killing PID $pid on port $port"
        taskkill //PID "$pid" //F 2>/dev/null || true
      fi
    done
  else
    echo "  Port $port is clear"
  fi
}

start_redis() {
  echo "Checking Redis..."

  # Check if Redis is already responding
  if redis-cli -p $REDIS_PORT ping 2>/dev/null | grep -q PONG; then
    echo "  Redis already running on port $REDIS_PORT"
    return 0
  fi

  # Check if Docker is available
  if ! docker --version >/dev/null 2>&1; then
    echo "  WARNING: Docker not available and redis-server not found"
    echo "  Backend will run without Redis (graceful degradation)"
    return 1
  fi

  # Check if container exists but is stopped
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${REDIS_CONTAINER}$"; then
    echo "  Starting existing Redis container..."
    docker start "$REDIS_CONTAINER" >/dev/null 2>&1
  else
    echo "  Creating Redis container..."
    docker run -d \
      --name "$REDIS_CONTAINER" \
      -p "${REDIS_PORT}:6379" \
      --restart unless-stopped \
      redis:7-alpine >/dev/null 2>&1
  fi

  # Wait for Redis to be ready (up to 10s)
  local retries=0
  while [ $retries -lt 10 ]; do
    if docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null | grep -q PONG; then
      echo "  Redis ready on port $REDIS_PORT"
      return 0
    fi
    retries=$((retries + 1))
    sleep 1
  done

  echo "  WARNING: Redis container started but not responding"
  return 1
}

echo ""
echo "=== PropertyIQ Dev Server Startup ==="
echo ""

# Start Redis first
REDIS_AVAILABLE=false
if start_redis; then
  REDIS_AVAILABLE=true
  export REDIS_URL="redis://localhost:${REDIS_PORT}"
fi

echo ""
echo "Clearing ports..."
clear_port $FRONTEND_PORT
clear_port $BACKEND_PORT

sleep 1

# Verify ports freed — nuclear fallback if stuck
for port in $FRONTEND_PORT $BACKEND_PORT; do
  if netstat -ano 2>/dev/null | grep ":${port} " | grep -q LISTENING; then
    echo ""
    echo "WARNING: Port $port still blocked. Killing all node processes..."
    taskkill //IM node.exe //F 2>/dev/null || true
    sleep 2
    break
  fi
done

echo ""
echo "Wiping backend dist + tsbuildinfo (forces clean compile so restart picks up new code)..."
rm -rf "$ROOT_DIR/packages/backend/dist"
rm -f "$ROOT_DIR/packages/backend/tsconfig.build.tsbuildinfo"
rm -f "$ROOT_DIR/packages/backend/.tsbuildinfo"

echo ""
echo "Wiping frontend .next-dev cache (forces a clean client bundle so restart picks up new code)..."
# Dev server uses .next-dev (see packages/frontend/next.config.mjs) so a stray
# `next build` writing .next can't clobber it. Wipe the dev dir, not the build dir.
rm -rf "$ROOT_DIR/packages/frontend/.next-dev"

echo ""
if [ "$REDIS_AVAILABLE" = true ]; then
  echo "Starting servers (redis :$REDIS_PORT, backend :$BACKEND_PORT, frontend :$FRONTEND_PORT)"
else
  echo "Starting servers (backend :$BACKEND_PORT, frontend :$FRONTEND_PORT) [Redis unavailable]"
fi
echo "Auto-restart on crash: 5 retries, 3s delay"
echo "Press Ctrl+C to stop"
echo ""

cd "$ROOT_DIR"

# video-template builds to dist/ which the backend's RemotionCLIRenderer
# loads at render time. Without a watcher, source edits to packages/video-
# template/src/ silently no-op until someone re-runs `npm run build:cli`.
# Adding tsc --watch keeps dist/ aligned with src/ for the whole dev session.
VIDEO_TEMPLATE_WATCH="npm run build:cli:watch -w @propertyiq/video-template"

if [ "$REDIS_AVAILABLE" = true ]; then
  REDIS_URL="redis://localhost:${REDIS_PORT}" npx concurrently \
    --restart-tries 5 \
    --restart-after 3000 \
    --kill-others-on-fail \
    --names "redis,video-tmpl,backend,frontend" \
    --prefix "[{name}]" \
    --prefix-colors "red.bold,magenta.bold,yellow.bold,cyan.bold" \
    "docker logs -f $REDIS_CONTAINER" \
    "$VIDEO_TEMPLATE_WATCH" \
    "npm run start:dev -w backend" \
    "npm run dev -w web"
else
  npx concurrently \
    --restart-tries 5 \
    --restart-after 3000 \
    --kill-others-on-fail \
    --names "video-tmpl,backend,frontend" \
    --prefix "[{name}]" \
    --prefix-colors "magenta.bold,yellow.bold,cyan.bold" \
    "$VIDEO_TEMPLATE_WATCH" \
    "npm run start:dev -w backend" \
    "npm run dev -w web"
fi
