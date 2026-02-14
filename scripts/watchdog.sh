#!/bin/bash
# PropertyIQ Dev Server Watchdog
# Monitors frontend (port 3000) and backend (port 3001) and restarts if down.

PROJ_DIR="/d/projects/rei-platform"
CHECK_INTERVAL=15  # seconds between health checks
MAX_STARTUP_WAIT=30  # seconds to wait for server to come up after restart
LOG_PREFIX="[watchdog]"

frontend_pid=""
backend_pid=""

log() {
  echo "$LOG_PREFIX $(date '+%H:%M:%S') $1"
}

start_backend() {
  log "Starting backend..."
  cd "$PROJ_DIR" && npm run dev:backend > /tmp/piq-backend.log 2>&1 &
  backend_pid=$!
  log "Backend started (PID $backend_pid)"

  # Wait for it to be ready
  for i in $(seq 1 $MAX_STARTUP_WAIT); do
    if curl -s -o /dev/null -w "" http://localhost:3001 2>/dev/null; then
      log "Backend is responding."
      return 0
    fi
    sleep 1
  done
  log "WARNING: Backend did not respond within ${MAX_STARTUP_WAIT}s (may still be starting)"
}

start_frontend() {
  log "Starting frontend..."
  cd "$PROJ_DIR" && npm run dev:frontend > /tmp/piq-frontend.log 2>&1 &
  frontend_pid=$!
  log "Frontend started (PID $frontend_pid)"

  # Wait for it to be ready
  for i in $(seq 1 $MAX_STARTUP_WAIT); do
    if curl -s -o /dev/null -w "" http://localhost:3000 2>/dev/null; then
      log "Frontend is responding."
      return 0
    fi
    sleep 1
  done
  log "WARNING: Frontend did not respond within ${MAX_STARTUP_WAIT}s (may still be starting)"
}

check_backend() {
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null)
  if [[ "$http_code" == "000" ]]; then
    return 1  # down
  fi
  return 0  # up
}

check_frontend() {
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  if [[ "$http_code" == "000" ]]; then
    return 1  # down
  fi
  return 0  # up
}

# Trap to clean up child processes on exit
cleanup() {
  log "Shutting down watchdog..."
  [[ -n "$backend_pid" ]] && kill "$backend_pid" 2>/dev/null
  [[ -n "$frontend_pid" ]] && kill "$frontend_pid" 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# --- Main ---
log "=== PropertyIQ Watchdog Started ==="
log "Checking every ${CHECK_INTERVAL}s | Frontend :3000 | Backend :3001"

# Initial check - only start what's not already running
if ! check_backend; then
  start_backend
else
  log "Backend already running on :3001"
fi

if ! check_frontend; then
  start_frontend
else
  log "Frontend already running on :3000"
fi

# Monitor loop
backend_restarts=0
frontend_restarts=0

while true; do
  sleep "$CHECK_INTERVAL"

  if ! check_backend; then
    backend_restarts=$((backend_restarts + 1))
    log "!!! Backend DOWN - restarting (restart #${backend_restarts})"
    start_backend
  fi

  if ! check_frontend; then
    frontend_restarts=$((frontend_restarts + 1))
    log "!!! Frontend DOWN - restarting (restart #${frontend_restarts})"
    start_frontend
  fi
done
