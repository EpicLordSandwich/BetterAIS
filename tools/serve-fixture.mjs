// Spusti: node tools/serve-fixture.mjs  →  http://127.0.0.1:8811/tools/smoke-fixture.html
import http from 'http';
import fs from 'fs';
import path from 'path';
const ROOT = path.resolve(process.cwd());
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.gif':'image/gif', '.json':'application/json' };
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let p = path.join(ROOT, u === '/' ? 'tools/smoke-fixture.html' : u);
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8811, '127.0.0.1', () => console.log('fixture server on 127.0.0.1:8811'));
