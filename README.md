## Quick Copy (all-in-one)

```bash
git clone https://github.com/openclaw2796-molt/openclaw-model-picker.git
cd openclaw-model-picker
./install.sh
openclaw-model-picker
# Open the printed URL (usually http://127.0.0.1:18888)
```

# OpenClaw Model Picker (local)
[![Release](https://img.shields.io/github/v/release/openclaw2796-molt/openclaw-model-picker)](https://github.com/openclaw2796-molt/openclaw-model-picker/releases)
[![License: MIT](https://img.shields.io/github/license/openclaw2796-molt/openclaw-model-picker)](LICENSE)

A tiny local-only web app to change OpenClaw’s default model **without editing JSON**.

Includes quick presets + local-only search to speed up picking common models.

## What it edits (and only this)
- `agents.defaults.model.primary`
- `agents.defaults.model.fallbacks`

## Safety
- Binds to `127.0.0.1` only (not public)
- UI/API never returns API keys or tokens
- Makes a timestamped backup before writing: `~/.openclaw/openclaw.json.bak-YYYYMMDD-HHMMSS`
- Validates JSON before saving

## Install
```bash
cd "~/Openclawshared Folder/openclaw-model-picker"
./install.sh
```

## Run
```bash
openclaw-model-picker
```
Then open the printed URL (it will be `http://127.0.0.1:18888` or the next free port).

## macOS (double-click)
Double-click `run.command`.

## If your OpenClaw config is in a different place
```bash
OPENCLAW_CONFIG_PATH=/path/to/openclaw.json openclaw-model-picker
```

## License

MIT


## One-line install (curl)

```bash
curl -fsSL https://raw.githubusercontent.com/openclaw2796-molt/openclaw-model-picker/v1.0.3/install.sh | bash
```


## Requirements

- OpenClaw installed (uses `~/.openclaw/openclaw.json`)
- Node.js + npm (installer runs `npm install`)
- macOS/Linux with `curl` + `tar`
- Windows: not supported yet (unless using WSL)



## Uninstall

```bash
rm -rf ~/.openclaw/tools/model-picker && rm -f ~/.local/bin/openclaw-model-picker
```

