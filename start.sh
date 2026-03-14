#!/usr/bin/env bash
set -e

# ── NovaDo Start Script ──────────────────────────────────────────────────────
# Starts the Express data server + Vite dev server together.
# Usage: ./start.sh
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")"

# Kill any stale processes on ports 3000 and 3001
for PORT in 3000 3001; do
  PID=$(lsof -ti tcp:$PORT 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo "🔪 Killing stale process on port $PORT (PID $PID)..."
    kill -9 $PID 2>/dev/null || true
    sleep 0.3
  fi
done

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo ""
echo "⚡  Starting NovaDo..."
echo "   Data server  →  http://localhost:3001"
echo "   App          →  http://localhost:3000"
echo "   Press Ctrl+C to stop everything."
echo ""

npm run dev
