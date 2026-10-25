// Penerjemah Dokumen: server lokal  →  http://localhost:8090
// Menyajikan halaman aplikasi, meneruskan teks ke Google Translate,
// dan menyimpan hasil ke folder Hasil_Terjemahan.
const http = require('http'), fs = require('fs'), path = require('path'), { exec } = require('child_process');

const root = __dirname;
const appDir = path.join(root, 'app');
const inDir = path.join(root, 'Masukan');
const outDir = path.join(root, 'Hasil_Terjemahan');
const port = process.env.PORT || 8090;
for (const d of [inDir, outDir]) fs.mkdirSync(d, { recursive: true });

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const SUPPORTED = /\.(pdf|docx|pptx|xlsx|csv|tsv|txt|md|srt|vtt|html?|json|png|jpe?g|bmp|webp|gif)$/i;

// ---------- Terjemahan ----------
const cache = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MAX_CHARS = 4500;
let blockedUntil = 0;

async function googleTranslate(text, sl, tl, stats = {}) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t`;
  // Bila Google membatasi (429), jeda 5 menit dan langsung tolak agar peramban beralih ke penerjemah Chrome.
  const limited = () => Object.assign(new Error('Google Translate sedang membatasi permintaan (HTTP 429)'), { fatal: true, status: 429 });
  if (Date.now() < blockedUntil) throw limited();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ q: text }) });
      if (r.status === 429) {
        if (attempt >= 1) { blockedUntil = Date.now() + 5 * 60 * 1000; throw limited(); }
        throw new Error('HTTP 429');
      }
      if (r.status >= 500) throw new Error('HTTP ' + r.status);
      if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { fatal: true });
      const j = await r.json();
      if (j[2]) stats[j[2]] = (stats[j[2]] || 0) + text.length;
      return (j[0] || []).map(x => x[0] || '').join('');
    } catch (e) {
      if (e.fatal || attempt === 4) throw e;
      await sleep(1000 * 2 ** attempt); // 1, 2, 4, 8 detik
    }
  }
}

// Terjemahkan daftar baris (tanpa \n di dalamnya) dalam kelompok ≤ MAX_CHARS.
async function translateLines(lines, sl, tl, stats) {
  const out = new Array(lines.length);
  const batches = [];
  let cur = [], len = 0;
  lines.forEach((t, i) => {
    if (cur.length && len + t.length + 1 > MAX_CHARS) { batches.push(cur); cur = []; len = 0; }
    cur.push(i); len += t.length + 1;
  });
  if (cur.length) batches.push(cur);

  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const b = batches[next++];
      const joined = b.map(i => lines[i]).join('\n');
      let parts = joined.length > MAX_CHARS ? null : (await googleTranslate(joined, sl, tl, stats)).split('\n');
      if (!parts || parts.length !== b.length) {
        // Jumlah baris tidak cocok / baris terlalu panjang: terjemahkan satu per satu.
        parts = [];
        for (const i of b) parts.push(await translateLong(lines[i], sl, tl, stats));
      }
      b.forEach((i, k) => { out[i] = parts[k].trim(); });
      await sleep(150);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return out;
}

// Satu teks panjang: potong per kalimat agar tiap permintaan ≤ MAX_CHARS.
async function translateLong(text, sl, tl, stats) {
  if (text.length <= MAX_CHARS) return googleTranslate(text, sl, tl, stats);
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
  const pieces = []; let buf = '';
  for (let s of sentences) {
    while (s.length > MAX_CHARS) { pieces.push(s.slice(0, MAX_CHARS)); s = s.slice(MAX_CHARS); }
    if (buf.length + s.length > MAX_CHARS) { pieces.push(buf); buf = ''; }
    buf += s;
  }
  if (buf) pieces.push(buf);
  const res = [];
  for (const p of pieces) res.push(await googleTranslate(p, sl, tl, stats));
  return res.join(' ');
}

// Teks yang tidak perlu diterjemahkan: kosong, angka, URL, email, DOI, simbol.
const skip = t => !t.trim() || !/\p{L}/u.test(t) || /^\s*(https?:\/\/|www\.|doi:|10\.\d{4,}\/)\S*\s*$/i.test(t) || /^\s*\S+@\S+\.\S+\s*$/.test(t);

async function translateTexts(texts, sl, tl, stats = {}) {
  const result = texts.map(t => (typeof t === 'string' ? t : ''));
  // Teks dipecah per baris; baris yang sama hanya dikirim sekali.
  const pieces = result.map(t => t.split('\n'));
  const uniq = [...new Set(pieces.flat().filter(l => !skip(l) && !cache.has(sl + '|' + tl + '|' + l)))];
  if (uniq.length) {
    const tr = await translateLines(uniq, sl, tl, stats);
    uniq.forEach((l, i) => cache.set(sl + '|' + tl + '|' + l, tr[i]));
  }
  return pieces.map(ls => ls.map(l => {
    if (skip(l)) return l;
    const lead = l.match(/^\s*/)[0];
    return lead + (cache.get(sl + '|' + tl + '|' + l) ?? l);
  }).join('\n'));
}

// ---------- Utilitas ----------
function readBody(req, limit = 300 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('File terlalu besar')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const sendJson = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const safeName = n => path.basename(String(n || 'hasil')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180) || 'hasil';
function uniquePath(dir, name) {
  const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
  let p = path.join(dir, name), n = 2;
  while (fs.existsSync(p)) p = path.join(dir, `${base} (${n++})${ext}`);
  return p;
}

// ---------- Server ----------
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  try {
    if (u.pathname === '/api/versi') return sendJson(res, 200, { versi: 3 });
    if (u.pathname === '/api/translate' && req.method === 'POST') {
      const { texts, sl = 'auto', tl = 'id' } = JSON.parse((await readBody(req)).toString('utf8'));
      if (!Array.isArray(texts)) return sendJson(res, 400, { error: 'texts harus berupa array' });
      const stats = {};
      const out = await translateTexts(texts, sl, tl, stats);
      const detected = Object.keys(stats).sort((a, b) => stats[b] - stats[a])[0] || null;
      return sendJson(res, 200, { texts: out, detected });
    }
    if (u.pathname === '/api/grammar' && req.method === 'POST') {
      // Pemeriksa tata bahasa LanguageTool (bahasa Inggris dan bahasa lain yang didukungnya)
      const { text, language = 'auto' } = JSON.parse((await readBody(req)).toString('utf8'));
      const r = await fetch('https://api.languagetool.org/v2/check', { method: 'POST', body: new URLSearchParams({ text, language }) });
      if (!r.ok) return sendJson(res, r.status, { error: r.status === 429 ? 'Batas pemeriksaan per menit tercapai, coba lagi sebentar' : 'LanguageTool: HTTP ' + r.status });
      return sendJson(res, 200, await r.json());
    }
    if (u.pathname === '/api/crossref') {
      // Data bibliografi untuk referensi APA: cari lewat DOI, atau lewat judul bila DOI tidak ada
      const doi = u.searchParams.get('doi'), title = u.searchParams.get('title') || '';
      const url = doi ? 'https://api.crossref.org/works/' + encodeURIComponent(doi)
        : 'https://api.crossref.org/works?rows=5&query.bibliographic=' + encodeURIComponent(title);
      const r = await fetch(url, { headers: { 'User-Agent': 'PenerjemahDokumen/1.0' } });
      if (!r.ok) return sendJson(res, r.status, { error: r.status === 404 ? 'DOI tidak ditemukan di Crossref' : 'Crossref: HTTP ' + r.status });
      return sendJson(res, 200, await r.json());
    }
    if (u.pathname === '/api/simpan' && req.method === 'POST') {
      const p = uniquePath(outDir, safeName(u.searchParams.get('name')));
      fs.writeFileSync(p, await readBody(req));
      return sendJson(res, 200, { file: path.basename(p), folder: outDir });
    }
    if (u.pathname === '/api/buka-folder') {
      const which = u.searchParams.get('folder') === 'masukan' ? inDir : outDir;
      exec(`explorer "${which}"`);
      return sendJson(res, 200, { ok: true });
    }
    if (u.pathname === '/api/masukan') {
      const files = fs.readdirSync(inDir).filter(f => SUPPORTED.test(f) && fs.statSync(path.join(inDir, f)).isFile());
      return sendJson(res, 200, { files, folder: inDir });
    }
    if (u.pathname === '/api/masukan/file') {
      const p = path.join(inDir, safeName(u.searchParams.get('name')));
      if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      return fs.createReadStream(p).pipe(res);
    }

    let p = decodeURIComponent(u.pathname);
    if (p === '/') p = '/index.html';
    const f = path.join(appDir, path.normalize(p));
    if (!f.startsWith(appDir)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Tidak ditemukan'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) {
    console.error(e);
    sendJson(res, e.status || 500, { error: e.message });
  }
}).on('error', e => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.log('Aplikasi sudah berjalan di jendela lain (http://localhost:' + port + ').');
  console.log('Tutup jendela ini; halaman aplikasi sudah dibuka di browser.');
}).listen(port, () => {
  console.log('Penerjemah Dokumen berjalan di http://localhost:' + port);
  console.log('Hasil disimpan di: ' + outDir);
  console.log('Tutup jendela ini untuk menghentikan aplikasi.');
});
