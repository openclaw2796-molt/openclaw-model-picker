#!/usr/bin/env bash
set -euo pipefail

# OpenClaw Model Picker installer
# - Works when executed from a cloned repo OR via curl | bash
# - Installs into: ~/.openclaw/tools/model-picker/
# - Creates launcher: ~/.local/bin/openclaw-model-picker

REPO="openclaw2796-molt/openclaw-model-picker"
VERSION_DEFAULT="v1.0.2"
VERSION="${OCMP_VERSION:-$VERSION_DEFAULT}"

INSTALL_DIR="$HOME/.openclaw/tools/model-picker"
BIN_DIR="$HOME/.local/bin"
LAUNCHER_PATH="$BIN_DIR/openclaw-model-picker"

need_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    return 0
  fi

  local os
  os="$(uname -s 2>/dev/null || echo unknown)"

  echo "ERROR: Required command not found: $cmd" >&2
  echo >&2

  case "$cmd" in
    curl)
      echo "Install curl:" >&2
      if [ "$os" = "Darwin" ]; then
        echo "  macOS: brew install curl" >&2
      else
        echo "  Ubuntu/Debian: sudo apt-get update && sudo apt-get install -y curl" >&2
      fi
      ;;
    tar)
      echo "Install tar:" >&2
      if [ "$os" = "Darwin" ]; then
        echo "  macOS: (tar is built-in)" >&2
        echo "  If missing: brew install gnu-tar" >&2
      else
        echo "  Ubuntu/Debian: sudo apt-get install -y tar" >&2
      fi
      ;;
    node|npm)
      echo "Install Node.js + npm:" >&2
      if [ "$os" = "Darwin" ]; then
        echo "  macOS: brew install node" >&2
      else
        echo "  Ubuntu/Debian: sudo apt-get update && sudo apt-get install -y nodejs npm" >&2
      fi
      echo "  Or install from: https://nodejs.org/" >&2
      ;;
    *)
      echo "Please install '$cmd' using your system package manager." >&2
      ;;
  esac

  exit 1
}

need_cmd curl
need_cmd tar
need_cmd node
need_cmd npm

mkdir -p "$INSTALL_DIR" "$BIN_DIR"

SCRIPT_DIR=""
# If running from a file (not stdin), resolve directory.
SCRIPT_REF="$0"
if declare -p BASH_SOURCE >/dev/null 2>&1; then
  # bash array; may be unset in some execution modes under -u
  SCRIPT_REF="${BASH_SOURCE[0]-}"
fi
if [[ "$SCRIPT_REF" != "bash" && "$SCRIPT_REF" != "-" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_REF")" && pwd)"
fi

is_repo_checkout() {
  local d="$1"
  [[ -n "$d" ]] && [[ -f "$d/package.json" ]] && [[ -f "$d/server.js" ]] && [[ -f "$d/index.html" ]]
}

copy_from_dir() {
  local src="$1"
  # Copy only what we need; do NOT copy node_modules or git metadata.
  for f in index.html server.js package.json package-lock.json run.command LICENSE README.md .port; do
    if [[ -e "$src/$f" ]]; then
      rm -rf "$INSTALL_DIR/$f" || true
      cp -a "$src/$f" "$INSTALL_DIR/" 2>/dev/null || cp "$src/$f" "$INSTALL_DIR/"
    fi
  done
}

download_and_extract_release() {
  local version="$1"
  TMPDIR_OCMP="$(mktemp -d)"
  trap "rm -rf '$TMPDIR_OCMP'" EXIT

  local url="https://github.com/${REPO}/archive/refs/tags/${version}.tar.gz"
  echo "Downloading ${REPO} ${version}..." >&2

  curl -fsSL "$url" -o "$TMPDIR_OCMP/src.tgz"

  mkdir -p "$TMPDIR_OCMP/src"
  tar -xzf "$TMPDIR_OCMP/src.tgz" -C "$TMPDIR_OCMP/src" --strip-components=1

  if ! is_repo_checkout "$TMPDIR_OCMP/src"; then
    echo "ERROR: Downloaded archive did not contain expected app files." >&2
    exit 1
  fi

  copy_from_dir "$TMPDIR_OCMP/src"
}

# Install app files
if is_repo_checkout "$SCRIPT_DIR"; then
  copy_from_dir "$SCRIPT_DIR"
else
  download_and_extract_release "$VERSION"
fi

# Install JS dependencies (local to INSTALL_DIR)
cd "$INSTALL_DIR"
npm install --silent --no-fund --no-audit

# Create launcher
cat > "$LAUNCHER_PATH" <<'LAUNCH'
#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$HOME/.openclaw/tools/model-picker"
cd "$APP_DIR"
exec node server.js
LAUNCH
chmod +x "$LAUNCHER_PATH"

echo "Installed to: $INSTALL_DIR"
echo "Launcher: $LAUNCHER_PATH"
echo

echo "Run: openclaw-model-picker"
echo "It will print a local URL (127.0.0.1) when it starts."

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo
  echo "NOTE: Your PATH may not include $BIN_DIR."
  echo "If 'openclaw-model-picker' is not found, add this to your shell profile:" 
  echo "  export PATH=\"$BIN_DIR:\$PATH\""
fi
