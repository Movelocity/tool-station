#!/usr/bin/env bash
# Install deps once if needed, then start the KV + static server.
set -e

if ! python3 -c "import fastapi, uvicorn, yaml" 2>/dev/null; then
  echo "Installing dependencies..."
  pip install fastapi uvicorn[standard] "redis[asyncio]" pyyaml --quiet
fi

exec python3 server.py
