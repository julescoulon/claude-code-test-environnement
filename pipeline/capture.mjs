// Capture déterministe d'un plan : node pipeline/capture.mjs --out dir --from 0 --to 3 [--fps 24] [--w 1920 --h 1080] [--times 1,2.5]
// Chaque image = renderFrame(n / fps). Les images déjà présentes sont sautées (reprise).
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const fps = +(args.fps || 24), w = +(args.w || 1920), h = +(args.h || 1080);
const out = path.resolve(ROOT, args.out || 'render/test');
const page_ = args.page || 'src/index.html';
fs.mkdirSync(out, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// Chromium : variable CHROME, sinon le Chromium installé par Playwright (npx playwright install chromium)
let exe = process.env.CHROME;
if (!exe) {
  const known = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  try { exe = fs.existsSync(known) ? known : chromium.executablePath(); } catch { exe = undefined; }
}
if (!exe || !fs.existsSync(exe)) {
  console.error('Chromium introuvable : lancez `npx playwright install chromium` ou définissez CHROME=/chemin/vers/chrome');
  process.exit(2);
}
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--js-flags=--max-old-space-size=6000'],
});
const page = await browser.newPage({ viewport: { width: Math.min(w, 1920), height: Math.min(h, 1080) } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => { console.error('[pageerror]', e.message); process.exitCode = 1; });
await page.goto(`http://127.0.0.1:${port}/${page_}?w=${w}&h=${h}${args.query ? '&' + args.query : ''}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });

let frames;
if (args.times) frames = String(args.times).split(',').map((x) => Math.round(+x * fps));
else {
  const f0 = Math.ceil(+(args.from || 0) * fps - 1e-6), f1 = Math.ceil(+(args.to || 1) * fps - 1e-6);
  frames = []; for (let f = f0; f < f1; f++) frames.push(f);
}
const t0 = Date.now();
let done = 0;
for (const f of frames) {
  const file = path.join(out, String(f).padStart(5, '0') + '.png');
  if (fs.existsSync(file) && !args.force) { done++; continue; }
  const ts = Date.now();
  const url = await page.evaluate(async ({ t, fps }) => { await window.renderFrame(t, fps); return document.getElementById('c').toDataURL('image/png'); }, { t: f / fps, fps });
  fs.writeFileSync(file + '.tmp', Buffer.from(url.split(',')[1], 'base64'));
  fs.renameSync(file + '.tmp', file);
  done++;
  console.log(`${path.basename(out)} ${f} (${done}/${frames.length}) ${((Date.now() - ts) / 1000).toFixed(2)}s`);
}
console.log(`total ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (!args.times && !args.noDone && process.exitCode !== 1) fs.writeFileSync(path.join(out, 'DONE'), new Date(0).toISOString());
await browser.close();
server.close();
