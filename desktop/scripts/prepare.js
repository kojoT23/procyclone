// Collects everything the desktop app needs into desktop/app/:
//   app/frontend  -> the built admin portal (React)
//   app/backend   -> backend source + production dependencies only
// Run from anywhere:  node scripts/prepare.js
// Works on Windows, Mac and Linux. Your own backend/ and frontend/ folders are never modified.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');      // project root (has backend/ and frontend/)
const OUT = path.resolve(__dirname, '..', 'app');
const FRONTEND = path.join(ROOT, 'frontend');
const BACKEND = path.join(ROOT, 'backend');

function run(cmd, cwd, extraEnv = {}) {
  console.log(`\n> (${path.relative(ROOT, cwd) || '.'}) ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
}

// npm ci is strict about the lock file; if it complains, fall back to a normal install.
function install(cwd, extra = '') {
  const hasLock = fs.existsSync(path.join(cwd, 'package-lock.json'));
  if (hasLock) {
    try { run(`npm ci ${extra}`.trim(), cwd); return; }
    catch { console.warn('\nnpm ci failed (lock file out of sync). Falling back to npm install...'); }
  }
  run(`npm install --no-audit --no-fund ${extra}`.trim(), cwd);
}

function must(p, what) {
  if (!fs.existsSync(p)) { console.error(`\nERROR: ${what} not found at ${p}`); process.exit(1); }
}

must(path.join(FRONTEND, 'package.json'), 'frontend/package.json');
must(path.join(BACKEND, 'package.json'), 'backend/package.json');
must(path.join(BACKEND, 'src', 'index.js'), 'backend/src/index.js');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ---- 1. Build the admin portal, pointed at the local backend ----
if (!fs.existsSync(path.join(FRONTEND, 'node_modules'))) {
  install(FRONTEND);
}
run('npm run build', FRONTEND, {
  REACT_APP_API_URL: 'http://localhost:5001/api',
  GENERATE_SOURCEMAP: 'false',
  CI: 'false',
});
must(path.join(FRONTEND, 'build', 'index.html'), 'the frontend build output');
fs.cpSync(path.join(FRONTEND, 'build'), path.join(OUT, 'frontend'), { recursive: true });

// ---- 2. Copy the backend (no .env, no node_modules, no logs) ----
const outBackend = path.join(OUT, 'backend');
fs.mkdirSync(outBackend, { recursive: true });
fs.cpSync(path.join(BACKEND, 'src'), path.join(outBackend, 'src'), { recursive: true });
fs.copyFileSync(path.join(BACKEND, 'package.json'), path.join(outBackend, 'package.json'));
if (fs.existsSync(path.join(BACKEND, 'package-lock.json'))) {
  fs.copyFileSync(path.join(BACKEND, 'package-lock.json'), path.join(outBackend, 'package-lock.json'));
}

// ---- 3. Make the bundled backend listen on 127.0.0.1 only (no firewall prompt, no network exposure) ----
const idx = path.join(outBackend, 'src', 'index.js');
const src = fs.readFileSync(idx, 'utf8');
const before = 'server.listen(PORT, async () =>';
const after = "server.listen(PORT, process.env.BIND_HOST || '::', async () =>";
if (src.includes(before)) {
  fs.writeFileSync(idx, src.replace(before, after));
  console.log('\nPatched bundled backend to honour BIND_HOST.');
} else {
  console.warn("\nWARNING: could not find 'server.listen(PORT, async () =>' in backend/src/index.js.");
  console.warn('The app will still work, but the backend will listen on all network interfaces.');
}

// ---- 4. Install production-only backend dependencies ----
install(outBackend, '--omit=dev');

console.log('\nDone. desktop/app is ready.');
