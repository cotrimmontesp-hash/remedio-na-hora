// Teste de fumaça da versão web (dist/) com Chrome headless via CDP (sem dependências). Node 22+ (WebSocket global).
// Uso: npx expo export -p web && node testes-web/teste-web.mjs [saida.png]
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../dist');
const SAIDA = process.argv[2] || 'testes-web/print_web.png';
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const srv = http.createServer((q, r) => {
  let f = path.join(raiz, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(raiz, 'index.html');
  r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(4188);

const chrome = spawn(process.env.CHROME || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=9333', '--user-data-dir=/tmp/remedio-chrome', '--window-size=412,915', 'about:blank'], { stdio: 'ignore' });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let alvo;
for (let i = 0; i < 50 && !alvo; i++) { await dormir(200); try { alvo = (await (await fetch('http://127.0.0.1:9333/json')).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let n = 0; const pend = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const avaliar = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const texto = () => avaliar('document.body.innerText');
// clica no elemento mais interno com esse aria-label ou texto (o Pressable do RN-web)
const clicar = (rotulo) => avaliar(`(() => { const l = [...document.querySelectorAll('[aria-label],[role=button],div')].filter(x => x.getAttribute('aria-label') === ${JSON.stringify(rotulo)} || (x.innerText||'').trim() === ${JSON.stringify(rotulo)}); const e = l[l.length - 1]; if (!e) return false; e.click(); return true; })()`);
const digitar = async (rotulo, t) => { await avaliar(`document.querySelector('[aria-label=${JSON.stringify(rotulo)}]').focus()`); await cdp('Input.insertText', { text: t }); };
const ok = []; const falhou = [];
const conferir = (nome, cond) => (cond ? ok : falhou).push(nome);

await cdp('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
await cdp('Page.enable');
await cdp('Page.navigate', { url: 'http://127.0.0.1:4188/' });
await dormir(2500);
await avaliar('localStorage.clear()');
await cdp('Page.reload'); await dormir(2500);
let t = await texto();
conferir('aviso sem orientação médica', /não dá orientação médica/.test(t));
conferir('aviso web sem alarme', /aqui NÃO há alarme/.test(t));
conferir('lista vazia', /ainda não cadastrou/.test(t));

// cadastrar pelo formulário
conferir('abre formulário', await clicar('Adicionar remédio'));
await dormir(500);
await digitar('Nome do remédio', 'Remédio de teste');
await digitar('Novo horário', '08:00'); await clicar('+ Horário'); await dormir(200);
await digitar('Novo horário', '2030'); await clicar('+ Horário'); await dormir(200);
await digitar('Observação', 'depois do café');
await clicar('Salvar'); await dormir(800);
t = await texto();
conferir('remédio salvo com 2 horários', /Remédio de teste/.test(t) && /08:00 · 20:30/.test(t));
const salvo = JSON.parse(await avaliar("localStorage.getItem('remedio-na-hora:v1')") || '{}');
conferir('salvo no localStorage', salvo.remedios?.[0]?.horarios?.join(',') === '08:00,20:30');

// dados de exemplo para o print (horários relativos ao relógio da box)
const h = (min) => { const d = new Date(Date.now() + min * 60000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const dia = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const passado = h(-120), recente = h(-90), futuro = h(150);
const exemplo = { remedios: [
  { id: 'r1', nome: 'Remédio da pressão (exemplo)', horarios: [passado, futuro].sort(), obs: 'com água' },
  { id: 'r2', nome: 'Vitamina (exemplo)', horarios: [recente], obs: 'depois do café' },
], tomadas: { [`${dia}|r1|${passado}`]: Date.now() - 7000000 } };
await avaliar(`localStorage.setItem('remedio-na-hora:v1', ${JSON.stringify(JSON.stringify(exemplo))})`);
await cdp('Page.reload'); await dormir(2500);
t = await texto();
conferir('histórico: tomou', /✅ Tomou/.test(t));
conferir('histórico: não tomou', /❌ Não tomou/.test(t));
conferir('histórico: pendente', /⏳ Pendente/.test(t) || futuro < passado);
conferir('próximo alarme', /Próximo alarme/.test(t));
const png = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.writeFileSync(SAIDA, Buffer.from(png.result.data, 'base64'));

// marcar "Tomei" e excluir
await clicar(`Marcar Vitamina (exemplo) ${recente} como tomado`); await dormir(400);
conferir('marcar tomei', (await texto()).split('✅ Tomou').length - 1 === 2);
await avaliar('window.confirm = () => true');
await avaliar(`(() => { const b = [...document.querySelectorAll('div')].filter(x => (x.innerText||'').trim() === 'Excluir'); b[b.length-1].click(); })()`); await dormir(400);
conferir('excluir', !/Vitamina \(exemplo\)/.test(await texto()));

console.log('OK:', ok.length, ok.join(' | '));
console.log('FALHOU:', falhou.length, falhou.join(' | '));
ws.close(); chrome.kill(); srv.close();
process.exit(falhou.length ? 1 : 0);
