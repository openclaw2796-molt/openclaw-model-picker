#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$HOME/.openclaw/tools/model-picker"

mkdir -p "$INSTALL_DIR"

# Copy app files (no node_modules)
rsync -a --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.DS_Store' \
  "$REPO_DIR/" "$INSTALL_DIR/"

# Install dependencies
cd "$INSTALL_DIR"
if command -v npm >/dev/null 2>&1; then
  npm install --silent
else
  echo "ERROR: npm is required. Please install Node.js (which includes npm)." >&2
  exit 1
fi

# Create launcher command: openclaw-model-picker
LAUNCHER_CONTENT='#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$HOME/.openclaw/tools/model-picker"
cd "$APP_DIR"
exec node server.js
'

# Prefer /usr/local/bin if writable; otherwise use ~/.local/bin
if [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
  BIN_DIR="/usr/local/bin"
else
  BIN_DIR="$HOME/.local/bin"
  mkdir -p "$BIN_DIR"
fi

LAUNCHER_PATH="$BIN_DIR/openclaw-model-picker"
printf "%s" "$LAUNCHER_CONTENT" > "$LAUNCHER_PATH"
chmod +x "$LAUNCHER_PATH"

echo "Installed to: $INSTALL_DIR"
echo "Launcher: $LAUNCHER_PATH"

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo
  echo "NOTE: Your PATH may not include $BIN_DIR."
  echo "If the command 'openclaw-model-picker' is not found, run:" 
  echo "  export PATH=\"$BIN_DIR:\$PATH\""
fi
