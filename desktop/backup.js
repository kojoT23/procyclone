// Database backups using pg_dump. No external dependencies.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

function findPgDump() {
  const exe = process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump';
  const candidates = [];

  if (process.platform === 'win32') {
    const base = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL');
    try {
      fs.readdirSync(base)
        .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
        .forEach((v) => candidates.push(path.join(base, v, 'bin', exe)));
    } catch { /* PostgreSQL folder not there */ }
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Postgres.app/Contents/Versions/latest/bin/pg_dump');
    ['18', '17', '16', '15', '14'].forEach((v) => {
      candidates.push(`/opt/homebrew/opt/postgresql@${v}/bin/pg_dump`);
      candidates.push(`/usr/local/opt/postgresql@${v}/bin/pg_dump`);
    });
    candidates.push('/opt/homebrew/bin/pg_dump', '/usr/local/bin/pg_dump');
  } else {
    candidates.push('/usr/bin/pg_dump');
  }

  for (const c of candidates) { if (fs.existsSync(c)) return c; }
  return 'pg_dump'; // last resort: whatever is on PATH
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function backupDir(documentsPath) {
  return path.join(documentsPath, 'Shorewinds CRM Backups');
}

function listBackups(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => /^shorewinds-crm-.*\.sql$/.test(f))
      .map((f) => ({ file: path.join(dir, f), time: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
  } catch { return []; }
}

function pruneBackups(dir, keep = 30) {
  listBackups(dir).slice(keep).forEach((b) => { try { fs.unlinkSync(b.file); } catch { /* ignore */ } });
}

function runBackup(env, dir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(dir, { recursive: true });
    const outFile = path.join(dir, `shorewinds-crm-${stamp()}.sql`);
    const tmpFile = outFile + '.partial'; // written first, renamed only on success, so a failed run never touches a good backup
    const args = [
      '-h', env.DB_HOST || 'localhost', '-p', env.DB_PORT || '5432',
      '-U', env.DB_USER, '-d', env.DB_NAME,
      '--no-owner', '--no-privileges', '-f', tmpFile,
    ];
    execFile(findPgDump(), args,
      { env: { ...process.env, PGPASSWORD: env.DB_PASSWORD || '' }, windowsHide: true, timeout: 120000 },
      (err, stdout, stderr) => {
        if (err) {
          try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
          const detail = (stderr || err.message || '').toString().trim().split('\n').slice(-3).join('\n');
          return reject(new Error(detail || 'pg_dump failed'));
        }
        try { fs.renameSync(tmpFile, outFile); } catch (e) { return reject(e); }
        pruneBackups(dir, 30);
        resolve(outFile);
      });
  });
}

// Backs up if the newest backup is older than maxAgeHours (default 20).
async function autoBackup(env, dir, maxAgeHours = 20) {
  const newest = listBackups(dir)[0];
  if (newest && Date.now() - newest.time < maxAgeHours * 3600 * 1000) return null;
  return runBackup(env, dir);
}

module.exports = { runBackup, autoBackup, backupDir, findPgDump, listBackups };
