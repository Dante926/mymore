#!/bin/bash
# mymore SessionStart Hook Wrapper
# Ensures npm dependencies are installed before running the hook

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if better-sqlite3 is available, if not install deps
if [ ! -d "$HOOKS_DIR/node_modules/better-sqlite3" ]; then
  (cd "$HOOKS_DIR" && npm install --silent 2>/dev/null) || true
fi

# Run the actual hook script
exec node "$SCRIPT_DIR/session-context.js"
