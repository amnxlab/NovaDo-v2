#!/usr/bin/env bash
set -e

# ── NovaDo Start Script ──────────────────────────────────────────────────────
# Starts the Express data server + Vite dev server together.
# Usage: ./start.sh
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")"

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
