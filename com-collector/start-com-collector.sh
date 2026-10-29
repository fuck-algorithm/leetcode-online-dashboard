#!/usr/bin/env bash
# Start the LeetCode.com browser collector.
# Headed Chromium is required because Cloudflare rejects headless browsers,
# so when there is no X display we start one with Xvfb.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing com-collector dependencies..."
  npm install
fi

if [ -n "${DISPLAY:-}" ]; then
  exec node collector.js
fi

exec xvfb-run -a -s '-screen 0 1280x800x24 -extension GLX' node collector.js
