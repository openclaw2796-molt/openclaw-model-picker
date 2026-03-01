/* OpenClaw Model Picker (portable)
 * - Local-only bind: 127.0.0.1
 * - Default port 18888; auto-increments if busy
 * - Never returns secrets (only primary + fallback + model options)
 * - Only edits: agents.defaults.model.primary and agents.defaults.model.fallbacks
 * - Makes timestamped backup before writing
 * - Validates JSON before saving
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { execFile } = require('child_process');

const HOST = '127.0.0.1';
const DEFAULT_PORT = 18888;

const CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH
  ? String(process.env.OPENCLAW_CONFIG_PATH)
  : path.join(process.env.HOME || '', '.openclaw', 'openclaw.json');

const LOG_PATH = path.join(process.env.HOME || '', '.openclaw', 'logs', 'gateway.log');

const REQUIRED_MODELS = [
  'openrouter/openrouter/free',
  'openrouter/openrouter/auto',
];

function friendlyConfigMissingMessage() {
  return `OpenClaw config not found. Expected at: ${CONFIG_PATH}\n\nIf your config lives elsewhere, start with:\nOPENCLAW_CONFIG_PATH=/path/to/openclaw.json openclaw-model-picker`;
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeText(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}

function safeJsonParse(text) {
  return JSON.parse(text);
}

function getConfigObject() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const err = new Error(friendlyConfigMissingMessage());
    err.code = 'CONFIG_MISSING';
    throw err;
  }
  const raw = readText(CONFIG_PATH);
  return safeJsonParse(raw);
}

function getCurrentModel(config) {
  const primary = config?.agents?.defaults?.model?.primary ?? '';
  const fallbacks = config?.agents?.defaults?.model?.fallbacks ?? [];
  return {
    primary: typeof primary === 'string' ? primary : '',
    fallbacks: Array.isArray(fallbacks) ? fallbacks.filter(v => typeof v === 'string') : [],
  };
}

function discoverModelOptions(config) {
  const options = new Set(REQUIRED_MODELS);

  // Discover keys under agents.defaults.models
  const modelsObj = config?.agents?.defaults?.models;
  if (modelsObj && typeof modelsObj === 'object') {
    for (const k of Object.keys(modelsObj)) {
      if (typeof k === 'string' && k.trim()) options.add(k);
    }
  }

  // Also discover any openai-codex/* strings anywhere in the config
  // (model ids are not secrets; do not include the rest of the config in API output)
  const raw = JSON.stringify(config);
  const re = /openai-codex\/[A-Za-z0-9._-]+/g;
  for (const m of raw.matchAll(re)) options.add(m[0]);

  return Array.from(options).sort();
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function makeBackup() {
  const backupPath = `${CONFIG_PATH}.bak-${timestamp()}`;
  fs.copyFileSync(CONFIG_PATH, backupPath);
  return backupPath;
}

function onlyAllowedChanges(beforeObj, afterObj) {
  // Ensure ONLY these fields can differ:
  // - agents.defaults.model.primary
  // - agents.defaults.model.fallbacks
  const scrub = (obj) => {
    const clone = JSON.parse(JSON.stringify(obj));
    if (!clone.agents) clone.agents = {};
    if (!clone.agents.defaults) clone.agents.defaults = {};
    if (!clone.agents.defaults.model) clone.agents.defaults.model = {};
    delete clone.agents.defaults.model.primary;
    delete clone.agents.defaults.model.fallbacks;
    return clone;
  };
  return JSON.stringify(scrub(beforeObj)) === JSON.stringify(scrub(afterObj));
}

function writeConfigSafely(primary, fallbacks) {
  const beforeRaw = readText(CONFIG_PATH);
  const beforeObj = safeJsonParse(beforeRaw);

  const afterObj = JSON.parse(JSON.stringify(beforeObj));
  if (!afterObj.agents) afterObj.agents = {};
  if (!afterObj.agents.defaults) afterObj.agents.defaults = {};
  if (!afterObj.agents.defaults.model) afterObj.agents.defaults.model = {};

  afterObj.agents.defaults.model.primary = primary;
  afterObj.agents.defaults.model.fallbacks = fallbacks;

  if (!onlyAllowedChanges(beforeObj, afterObj)) {
    throw new Error('Refusing to save: would modify fields outside agents.defaults.model.primary and agents.defaults.model.fallbacks');
  }

  // Backup before writing
  makeBackup();

  // Validate JSON by round-tripping the exact string we're going to write
  const pretty = JSON.stringify(afterObj, null, 2) + '\n';
  safeJsonParse(pretty);

  // Write to temp then rename
  const tmpPath = `${CONFIG_PATH}.tmp-${process.pid}`;
  writeText(tmpPath, pretty);
  safeJsonParse(readText(tmpPath));
  fs.renameSync(tmpPath, CONFIG_PATH);
}

function runOpenClaw(args) {
  return new Promise((resolve, reject) => {
    execFile('openclaw', args, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

async function applyGatewayRestartStopStart() {
  await runOpenClaw(['gateway', 'stop']);
  await runOpenClaw(['gateway', 'start']);
}

function tailGatewayForModelLine(model, maxLines = 4000) {
  try {
    const data = readText(LOG_PATH);
    const lines = data.split(/\r?\n/).filter(Boolean);
    const recent = lines.slice(Math.max(0, lines.length - maxLines));
    const needle = `[gateway] agent model: ${model}`;
    return recent.some(l => l.includes(needle));
  } catch {
    return false;
  }
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, HOST);
  });
}

async function pickPort(startPort = DEFAULT_PORT, maxTries = 50) {
  for (let p = startPort; p < startPort + maxTries; p++) {
    // eslint-disable-next-line no-await-in-loop
    if (await portIsFree(p)) return p;
  }
  throw new Error('No free port found');
}

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname)));

app.get('/api/status', (req, res) => {
  try {
    const config = getConfigObject();
    const current = getCurrentModel(config);
    const options = discoverModelOptions(config);
    res.json({ primary: current.primary, fallback: current.fallbacks, options });
  } catch (e) {
    if (e && e.code === 'CONFIG_MISSING') return res.status(404).json({ error: e.message });
    res.status(500).json({ error: 'Failed to read config (is it valid JSON?)' });
  }
});

app.post('/api/set', (req, res) => {
  try {
    const primary = String(req.body?.primary || '').trim();
    const fallback = req.body?.fallback;
    if (!primary) return res.status(400).json({ error: 'primary is required' });

    let fallbacks = [];
    if (Array.isArray(fallback)) {
      fallbacks = fallback.map(v => String(v).trim()).filter(Boolean);
    } else if (typeof fallback === 'string') {
      fallbacks = fallback.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }

    // Ensure config exists + is valid before creating backup
    getConfigObject();

    writeConfigSafely(primary, fallbacks);
    res.json({ success: true, backupMade: true });
  } catch (e) {
    if (e && e.code === 'CONFIG_MISSING') return res.status(404).json({ error: e.message });
    res.status(500).json({ error: e.message || 'Failed to save' });
  }
});

app.post('/api/apply', async (req, res) => {
  try {
    await applyGatewayRestartStopStart();
    res.json({ success: true });
  } catch {
    // Do not leak stdout/stderr (could contain tokens depending on environment)
    res.status(500).json({ error: 'Failed to restart gateway' });
  }
});

app.get('/api/verify', (req, res) => {
  const model = String(req.query?.model || '').trim();
  if (!model) return res.status(400).json({ error: 'model query param required' });
  res.json({ ok: tailGatewayForModelLine(model) });
});

(async () => {
  const port = await pickPort(DEFAULT_PORT);
  // Write chosen port to a local file for launchers (not a secret)
  try { writeText(path.join(__dirname, '.port'), String(port)); } catch {}

  app.listen(port, HOST, () => {
    console.log(`Model Picker running at http://${HOST}:${port}`);
  });
})();
