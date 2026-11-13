// Tiny static file server for the built admin portal (React build folder).
// Binds to 127.0.0.1 only, so nothing on the shop network can reach it.
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

function makeHandler(root) {
  const rootResolved = path.resolve(root);
  return (req, res) => {
    let urlPath;
    try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { res.writeHead(400); return res.end('Bad request'); }

    let filePath = path.join(rootResolved, urlPath);
    if (!filePath.startsWith(rootResolved)) { res.writeHead(403); return res.end('Forbidden'); }

    let isFile = false;
    try { isFile = fs.statSync(filePath).isFile(); } catch { /* not found */ }

    // Single-page-app fallback: unknown paths (but not asset requests) get index.html
    if (!isFile) {
      if (path.extname(urlPath)) { res.writeHead(404); return res.end('Not found'); }
      filePath = path.join(rootResolved, 'index.html');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(500); return res.end('Cannot read file'); }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      });
      res.end(data);
    });
  };
}

// Tries startPort, startPort+1, ... until one is free. Resolves { server, port }.
function startUiServer(root, startPort = 3000, tries = 10) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    const attempt = () => {
      const server = http.createServer(makeHandler(root));
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && port < startPort + tries - 1) { port += 1; attempt(); }
        else reject(err);
      });
      server.listen(port, '127.0.0.1', () => resolve({ server, port }));
    };
    attempt();
  });
}

module.exports = { startUiServer };
