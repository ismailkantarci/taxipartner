#!/usr/bin/env node
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const DOCS_DIR = resolve(process.cwd(), 'docs');
const PORT = Number(process.env.PORT || 4174);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    let filePath = url.pathname.endsWith('/') ? url.pathname + 'style-sandbox.html' : url.pathname;
    const absolute = resolve(DOCS_DIR, '.' + filePath);
    const st = await stat(absolute);
    if (st.isDirectory()) {
      res.writeHead(302, { Location: url.pathname + '/' });
      res.end();
      return;
    }
    const ext = extname(absolute);
    const headers = { 'Content-Type': mime[ext] || 'application/octet-stream' };
    if (ext === '.html' && filePath.endsWith('style-sandbox.html')) {
      // Local sandbox needs inline <script>/<style>; keep override limited to this file.
      headers['Content-Security-Policy'] = "default-src 'self'; base-uri 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://ui-avatars.com; font-src 'self' data:; connect-src 'self'; object-src 'none'";
    }
    res.writeHead(200, headers);
    createReadStream(absolute).pipe(res);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Sandbox server running at http://localhost:${PORT}/style-sandbox.html`);
});
