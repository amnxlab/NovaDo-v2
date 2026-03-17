#!/usr/bin/env bash
set -euo pipefail

# NovaDo stop script
# - Stops NovaDo dev stack started by start.sh (concurrently -> node server.js + vite)
# - Cleans stale pid files
# - Frees ports 3000/3001

cd "$(dirname "$0")"

NOVADO_PID_FILES=(
  "/tmp/novado-ai-portal.pid"
  "/tmp/novado-ahmedamin.pid"
)

# Kill process IDs captured by launcher pid files, if any.
for PF in "${NOVADO_PID_FILES[@]}"; do
  if [[ -f "$PF" ]]; then
    PID="$(cat "$PF" 2>/dev/null || true)"
    if [[ -n "${PID}" ]]; then
      kill -TERM "$PID" 2>/dev/null || true
      sleep 0.2
      kill -KILL "$PID" 2>/dev/null || true
    fi
    rm -f "$PF" 2>/dev/null || true
  fi
done

# Terminate known NovaDo process patterns.
pkill -TERM -f "concurrently.*node server.js.*vite|concurrently.*vite.*node server.js" 2>/dev/null || true
pkill -TERM -f "node server.js" 2>/dev/null || true
pkill -TERM -f "(^|/)vite(\s|$)" 2>/dev/null || true
sleep 0.5

pkill -KILL -f "concurrently.*node server.js.*vite|concurrently.*vite.*node server.js" 2>/dev/null || true
pkill -KILL -f "node server.js" 2>/dev/null || true
pkill -KILL -f "(^|/)vite(\s|$)" 2>/dev/null || true

# Ensure ports are free.
for PORT in 3000 3001; do
  fuser -k "${PORT}/tcp" 2>/dev/null || true
done

echo "NovaDo stopped (best effort)."
