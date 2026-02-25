#!/bin/bash
# dev-start.sh — Clear ports 3000/3001 and start dev servers with crash recovery
# Usage: bash scripts/dev-start.sh
#
# Features:
#   - Kills any process blocking ports 3000 (frontend) or 3001 (backend)
#   - Starts both servers with auto-restart on crash (up to 5 retries)
#   - 3-second delay between retries to let ports release
#   - Color-coded output: yellow=backend, cyan=frontend

FRONTEND_PORT=3000
BACKEND_PORT=3001
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

echo ""
echo "=== PropertyIQ Dev Server Startup ==="
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
echo "Starting servers (frontend :$FRONTEND_PORT, backend :$BACKEND_PORT)"
echo "Auto-restart on crash: 5 retries, 3s delay"
echo "Press Ctrl+C to stop"
echo ""

cd "$ROOT_DIR"
npx concurrently \
  --restart-tries 5 \
  --restart-after 3000 \
  --kill-others-on-fail \
  --names "backend,frontend" \
  --prefix "[{name}]" \
  --prefix-colors "yellow.bold,cyan.bold" \
  "npm run start:dev -w backend" \
  "npm run dev -w web"
