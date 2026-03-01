#!/usr/bin/env bash
set -euo pipefail

# Ensure installed
DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/install.sh" >/dev/null

# Start in background
(openclaw-model-picker >/tmp/openclaw-model-picker.out 2>&1 &) 

# Find the port by probing /api/status from 18888 upward
PORT=""
for p in $(seq 18888 18950); do
  if curl -fsS "http://127.0.0.1:$p/api/status" >/dev/null 2>&1; then
    PORT="$p"
    break
  fi
  sleep 0.1
done

if [ -z "$PORT" ]; then
  echo "Could not detect a running server. Output:" 
  sed -E 's/(sk-[A-Za-z0-9_-]+|sk-or-[A-Za-z0-9_-]+|gsk_[A-Za-z0-9_-]+|AIza[0-9A-Za-z_-]+)/[REDACTED]/g' /tmp/openclaw-model-picker.out || true
  exit 1
fi

URL="http://127.0.0.1:$PORT"
open "$URL" || true

echo "Opened: $URL"
echo "(If it didn't open automatically, paste the URL into your browser.)"
