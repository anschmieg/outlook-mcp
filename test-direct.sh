#!/bin/bash
# Manual HTTP testing against local Cloudflare Worker
set -euo pipefail

PORT=${PORT:-8787}

echo "Starting local Worker with wrangler on port ${PORT}..."
(
  # Start dev server in background
  npx wrangler dev src/worker.js --port ${PORT} --local > /dev/null 2>&1 &
  echo $! > .wrangler_dev_pid
) || { echo "Failed to start wrangler dev"; exit 1; }

sleep 2

echo "Health:"
curl -s http://localhost:${PORT}/health | jq .

echo "Initialize:"
curl -s -X POST http://localhost:${PORT}/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | jq .

echo "Tools list:"
curl -s -X POST http://localhost:${PORT}/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq .

echo "Authenticate tool:"
curl -s -X POST http://localhost:${PORT}/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"authenticate","arguments":{}}}' | jq .

if [ -f .wrangler_dev_pid ]; then
  PID=$(cat .wrangler_dev_pid)
  echo "Stopping wrangler dev (pid $PID)" && kill "$PID" || true
  rm -f .wrangler_dev_pid
fi

echo "Done."
