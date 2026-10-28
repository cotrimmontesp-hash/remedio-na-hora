// Servidor local da pasta dist (depois de `npx expo export -p web`). Uso: npm run preview:web
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.PORT || 4173);
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json', '.ttf': 'font/ttf' };

http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  let arq = path.normalize(path.join(root, rel === '/' ? 'index.html' : rel));
  if (!arq.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(arq) || !fs.statSync(arq).isFile()) arq = path.join(root, 'index.html');
  if (!fs.existsSync(arq)) { res.writeHead(500); res.end('Rode antes: npx expo export -p web'); return; }
  res.writeHead(200, { 'content-type': tipos[path.extname(arq)] || 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
}).listen(port, () => console.log(`Web em http://localhost:${port}`));
