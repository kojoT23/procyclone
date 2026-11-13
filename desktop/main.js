const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { startUiServer } = require('./ui-server');
const { runBackup, autoBackup, backupDir } = require('./backup');

const API_PORT = 5001; // the admin portal is built to talk to http://localhost:5001/api
const RES = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'app');
const BACKEND_DIR = path.join(RES, 'backend');
const FRONTEND_DIR = path.join(RES, 'frontend');

let DATA_DIR, ENV_FILE, LOG_FILE;
let win = null;
let backendProc = null;
let uiServer = null;
let stopping = false;
let appReady = false;
const lastLines = [];

// ---------- single instance ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}

// ---------- settings file (.env) ----------
function hex(n) { return crypto.randomBytes(n).toString('hex'); }

function ensureEnv() {
  if (fs.existsSync(ENV_FILE)) return false;
  const dbUser = process.platform === 'win32' ? 'postgres' : os.userInfo().username;
  const text = [
    '# Shorewinds CRM settings. Edit, save, then click Retry (or reopen the app).',
    'DB_HOST=localhost',
    'DB_PORT=5432',
    'DB_NAME=shorewinds_crm',
    `DB_USER=${dbUser}`,
    '# Windows: the password you chose when you installed PostgreSQL. Mac (Postgres.app/Homebrew): leave empty.',
    'DB_PASSWORD=',
    `JWT_SECRET=${hex(32)}`,
    'JWT_EXPIRES_IN=15m',
    `JWT_REFRESH_SECRET=${hex(32)}`,
    'JWT_REFRESH_EXPIRES_IN=7d',
    '',
    '# Optional extras. Copy these from your old backend/.env if you use them:',
    '# GMAIL_USER=',
    '# GMAIL_APP_PASSWORD=',
    '# RESEND_API_KEY=',
    '# ANTHROPIC_API_KEY=',
    '# FLEEPYSTORE_WEBHOOK_SECRET=',
    '',
  ].join('\n');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ENV_FILE, text, { mode: 0o600 });
  return true;
}

function parseEnv(file) {
  const out = {};
  try {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith('#')) return;
      out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    });
  } catch { /* missing file */ }
  return out;
}

// ---------- helpers ----------
function log(line) {
  lastLines.push(line);
  if (lastLines.length > 40) lastLines.shift();
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch { /* ignore */ }
}

function trimLog() {
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 5 * 1024 * 1024) fs.writeFileSync(LOG_FILE, '');
  } catch { /* ignore */ }
}

function portInUse(port) {
  const tryHost = (host) => new Promise((resolve) => {
    const s = net.connect({ port, host });
    s.setTimeout(800);
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('timeout', () => { s.destroy(); resolve(false); });
    s.once('error', () => resolve(false));
  });
  return Promise.all([tryHost('127.0.0.1'), tryHost('::1')]).then(([a, b]) => a || b);
}

function healthStatus() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: API_PORT, path: '/health', timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function splash(text) {
  if (!win || win.isDestroyed()) return;
  const html = `<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#0f172a;color:#fff;text-align:center">
    <div><div style="font-size:28px;font-weight:800;letter-spacing:.5px">Shorewinds CRM</div>
    <div style="margin-top:12px;opacity:.7">${text}</div></div></body>`;
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

// ---------- backend process ----------
function stopBackend() {
  stopping = true;
  if (backendProc && !backendProc.killed) { try { backendProc.kill(); } catch { /* ignore */ } }
  backendProc = null;
}

function startBackend(uiPort) {
  stopping = false;
  const settings = parseEnv(ENV_FILE);
  const entry = path.join(BACKEND_DIR, 'src', 'index.js');
  if (!fs.existsSync(entry)) throw new Error('Backend files are missing from the app (' + entry + ').');

  backendProc = spawn(process.execPath, [entry], {
    cwd: DATA_DIR, // the backend reads its .env from the working folder
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(API_PORT),
      BIND_HOST: '127.0.0.1',
      ALLOWED_ORIGINS: `http://localhost:${uiPort}`,
      TRUST_PROXY_HOPS: '0',
      // The backend crashes at startup if this is missing; the dummy only matters until a real key is added.
      ...(settings.RESEND_API_KEY || process.env.RESEND_API_KEY ? {} : { RESEND_API_KEY: 're_not_configured' }),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const onData = (buf) => buf.toString().split(/\r?\n/).filter(Boolean).forEach(log);
  backendProc.stdout.on('data', onData);
  backendProc.stderr.on('data', onData);
  backendProc.on('exit', (code) => {
    log(`[backend exited with code ${code}]`);
    const wasRunning = backendProc && !stopping;
    backendProc = null;
    if (wasRunning && appReady) {
      dialog.showMessageBoxSync({
        type: 'error', title: 'Shorewinds CRM',
        message: 'The background service stopped unexpectedly.',
        detail: 'The app will restart. If this keeps happening, open the log file from the File menu.',
      });
      app.relaunch(); app.exit(0);
    }
  });
}

async function waitForBackend() {
  for (let i = 0; i < 75; i++) { // ~30 seconds
    if (!backendProc) return { ok: false, reason: 'exited' };
    const status = await healthStatus();
    if (status === 200) return { ok: true };
    if (status !== null) return { ok: false, reason: 'database', status };
    await sleep(400);
  }
  return { ok: false, reason: 'timeout' };
}

// ---------- problem dialog (Retry / settings / log / Quit) ----------
async function showProblem(message, detail) {
  for (;;) {
    const { response } = await dialog.showMessageBox(win && !win.isDestroyed() ? win : undefined, {
      type: 'error', title: 'Shorewinds CRM', message, detail,
      buttons: ['Retry', 'Open settings file', 'Open log file', 'Quit'],
      defaultId: 0, cancelId: 3, noLink: true,
    });
    if (response === 0) return 'retry';
    if (response === 1) shell.openPath(ENV_FILE);
    else if (response === 2) shell.openPath(LOG_FILE);
    else return 'quit';
  }
}

// ---------- startup ----------
async function boot() {
  for (;;) {
    splash('Starting…');
    stopBackend();

    if (await portInUse(API_PORT)) {
      const r = await showProblem(
        `Port ${API_PORT} is already in use.`,
        'Another copy of the Shorewinds/Procyclone backend (or another program) is running. Close it, then click Retry.');
      if (r === 'quit') return app.quit();
      continue;
    }

    let uiPort;
    try {
      if (!uiServer) {
        const started = await startUiServer(FRONTEND_DIR, 3000, 10);
        uiServer = started.server;
        uiServer.uiPort = started.port;
      }
      uiPort = uiServer.uiPort;
      startBackend(uiPort);
    } catch (err) {
      const r = await showProblem('Shorewinds CRM could not start.', String(err.message || err));
      if (r === 'quit') return app.quit();
      continue;
    }

    splash('Connecting to the database…');
    const result = await waitForBackend();
    if (result.ok) {
      appReady = true;
      win.loadURL(`http://localhost:${uiPort}`);
      const env = parseEnv(ENV_FILE);
      autoBackup(env, backupDir(app.getPath('documents'))).then(
        (f) => f && log('[auto-backup] ' + f),
        (e) => log('[auto-backup failed] ' + e.message));
      return;
    }

    let message, detail;
    const tail = lastLines.slice(-8).join('\n');
    if (result.reason === 'database') {
      message = 'Cannot connect to the database.';
      detail = 'Check that PostgreSQL is running and that the database name, user and password in the settings file are correct.\n\nSettings file:\n' + ENV_FILE + (tail ? '\n\nLatest log lines:\n' + tail : '');
    } else if (result.reason === 'exited') {
      message = 'The background service would not start.';
      detail = (tail || 'No details were logged.') + '\n\nSettings file:\n' + ENV_FILE;
    } else {
      message = 'The background service took too long to start.';
      detail = (tail || 'No details were logged.');
    }
    const r = await showProblem(message, detail);
    if (r === 'quit') return app.quit();
  }
}

// ---------- window + menu ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 860, minWidth: 1024, minHeight: 640,
    title: 'Shorewinds CRM',
    backgroundColor: '#0f172a',
    autoHideMenuBar: process.platform !== 'darwin',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  const isOurs = (url) => url.startsWith('http://localhost:') || url === 'about:blank' || url.startsWith('data:');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isOurs(url)) return { action: 'allow' }; // print previews, exports
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!isOurs(url)) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
  win.on('page-title-updated', (e) => e.preventDefault()); // keep the window title "Shorewinds CRM"
  win.on('closed', () => { win = null; });
}

async function manualBackup() {
  const env = parseEnv(ENV_FILE);
  try {
    const file = await runBackup(env, backupDir(app.getPath('documents')));
    const { response } = await dialog.showMessageBox(win, {
      type: 'info', title: 'Backup complete', message: 'Database backup saved.', detail: file,
      buttons: ['OK', 'Show in folder'], defaultId: 0,
    });
    if (response === 1) shell.showItemInFolder(file);
  } catch (err) {
    dialog.showMessageBox(win, {
      type: 'error', title: 'Backup failed',
      message: 'Could not back up the database.',
      detail: err.message + '\n\nMake sure PostgreSQL is installed (it includes pg_dump) and the settings file is correct.',
    });
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const fileMenu = {
    label: 'File',
    submenu: [
      { label: 'Back up database now', click: manualBackup },
      { label: 'Open backups folder', click: () => { const d = backupDir(app.getPath('documents')); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); } },
      { type: 'separator' },
      { label: 'Open settings file', click: () => shell.openPath(ENV_FILE) },
      { label: 'Open log file', click: () => shell.openPath(LOG_FILE) },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  };
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    fileMenu,
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- app lifecycle ----------
app.whenReady().then(() => {
  DATA_DIR = app.getPath('userData');
  ENV_FILE = path.join(DATA_DIR, '.env');
  LOG_FILE = path.join(DATA_DIR, 'backend.log');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  trimLog();
  ensureEnv();
  buildMenu();
  createWindow();
  boot();
  app.on('activate', () => { if (!win) { createWindow(); boot(); } });
});

app.on('before-quit', () => {
  stopBackend();
  if (uiServer) { try { uiServer.close(); } catch { /* ignore */ } }
});
app.on('window-all-closed', () => app.quit());
