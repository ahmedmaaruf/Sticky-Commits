#!/usr/bin/env node
// Tiny zero-dependency dev server: `npm run dev` → http://localhost:5173
// cards.json is rebuilt on every request, so new stickers show up on refresh.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, buildManifest } from './build.mjs';

const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
};

function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/cards.json') {
    const { manifest, results } = buildManifest();
    for (const r of results) for (const e of r.errors) console.log(`  ✖ ${r.folder}: ${e}`);
    res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(manifest));
  }

  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.resolve(ROOT, `.${pathname}`);
  if (!file.startsWith(ROOT + path.sep) || file.includes(`${path.sep}.git`)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

// Listen on both IPv4 and IPv6 loopback so "localhost" always works (but stays private to this computer).
http.createServer(handle).listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ✨ Sticker wall running at  http://localhost:${PORT}`);
});
http.createServer(handle).listen(PORT, '::1').on('error', () => { /* no IPv6 here — that's fine */ });
