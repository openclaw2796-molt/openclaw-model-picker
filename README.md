# OpenClaw Model Picker (local)

A tiny local-only web app to change OpenClaw’s default model **without editing JSON**.

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
