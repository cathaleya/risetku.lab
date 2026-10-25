/**
 * ==============================================================================
 * RisetKu - Master Unified Academic Ecosystem Gateway Server (Local & Production)
 * Port Default: 8000 (http://localhost:8000)
 * ==============================================================================
 * Menyajikan 5 Modul Ekosistem Terpadu:
 * 1. Portal Utama RisetKu  -> http://localhost:8000/
 * 2. Cek-In               -> http://localhost:8000/cekin/
 * 3. SLR-In Aja           -> http://localhost:8000/slr/
 * 4. Terjemahin_Aja       -> http://localhost:8000/terjemahin/ (+ Mesin API /api/translate)
 * 5. Analisis-Aja         -> http://localhost:8000/analisis/
 * 6. MADEL-5C             -> https://madel5c.com
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 8000;

// Path Direktori Aplikasi
const ROOT_DIR = __dirname;
const PORTFOLIO_DIR = path.join(ROOT_DIR, 'web_portfolio');
const CEKIN_DIR = path.join(ROOT_DIR, 'Chek_In');
const SLR_DIR = path.join(ROOT_DIR, 'web_SLR');
const TERJEMAHIN_APP_DIR = path.join(ROOT_DIR, 'Penerjemah_Dokumen', 'app');
const TERJEMAHIN_IN_DIR = path.join(ROOT_DIR, 'Penerjemah_Dokumen', 'Masukan');
const TERJEMAHIN_OUT_DIR = path.join(ROOT_DIR, 'Penerjemah_Dokumen', 'Hasil_Terjemahan');
const ANALISIS_DIR = path.join(ROOT_DIR, 'web_analisis');
const THINKALOUD_DIR = path.join(ROOT_DIR, 'web_thinkaloud');

// Buat folder input/output terjemahan jika belum ada
for (const d of [TERJEMAHIN_IN_DIR, TERJEMAHIN_OUT_DIR]) {
  try {
    fs.mkdirSync(d, { recursive: true });
  } catch (e) {}
}

// MIME Types Komprehensif
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// -----------------------------------------------------------------------------
// Engine Penerjemah Terjemahin_Aja (Google Translate Multi-chunk & Caching)
// -----------------------------------------------------------------------------
const trCache = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MAX_CHARS = 4500;
let blockedUntil = 0;

async function googleTranslate(text, sl, tl, stats = {}) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t`;
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
      await sleep(1000 * 2 ** attempt);
    }
  }
}

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

const skipText = t => !t.trim() || !/\p{L}/u.test(t) || /^\s*(https?:\/\/|www\.|doi:|10\.\d{4,}\/)\S*\s*$/i.test(t) || /^\s*\S+@\S+\.\S+\s*$/.test(t);

async function translateTexts(texts, sl, tl, stats = {}) {
  const result = texts.map(t => (typeof t === 'string' ? t : ''));
  const pieces = result.map(t => t.split('\n'));
  const uniq = [...new Set(pieces.flat().filter(l => !skipText(l) && !trCache.has(sl + '|' + tl + '|' + l)))];
  if (uniq.length) {
    const tr = await translateLines(uniq, sl, tl, stats);
    uniq.forEach((l, i) => trCache.set(sl + '|' + tl + '|' + l, tr[i]));
  }
  return pieces.map(ls => ls.map(l => {
    if (skipText(l)) return l;
    const lead = l.match(/^\s*/)[0];
    return lead + (trCache.get(sl + '|' + tl + '|' + l) ?? l);
  }).join('\n'));
}

function readBody(req, limit = 300 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('File terlalu besar')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const sendJson = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};

const safeName = n => path.basename(String(n || 'hasil')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180) || 'hasil';
function uniquePath(dir, name) {
  const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
  let p = path.join(dir, name), n = 2;
  while (fs.existsSync(p)) p = path.join(dir, `${base} (${n++})${ext}`);
  return p;
}

// -----------------------------------------------------------------------------
// Static File Serving Helper
// -----------------------------------------------------------------------------
function serveStaticFile(res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <div style="font-family:sans-serif; text-align:center; padding:50px;">
          <h2 style="color:#e11d48">404 - Halaman / Berkas Tidak Ditemukan</h2>
          <p>Path: <code>${filePath}</code></p>
          <a href="/" style="display:inline-block; padding:10px 20px; background:#e11d48; color:#fff; text-decoration:none; border-radius:8px; font-weight:bold;">Kembali ke Portal RisetKu</a>
        </div>
      `);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// -----------------------------------------------------------------------------
// Unified HTTP Server
// -----------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(u.pathname);

  // 1. API ROUTES (Untuk Terjemahin_Aja & fitur ekosistem)
  try {
    if (pathname === '/api/versi') return sendJson(res, 200, { versi: 3, platform: 'RisetKu' });

    if (pathname === '/api/translate' && req.method === 'POST') {
      const { texts, sl = 'auto', tl = 'id' } = JSON.parse((await readBody(req)).toString('utf8'));
      if (!Array.isArray(texts)) return sendJson(res, 400, { error: 'texts harus berupa array' });
      const stats = {};
      const out = await translateTexts(texts, sl, tl, stats);
      const detected = Object.keys(stats).sort((a, b) => stats[b] - stats[a])[0] || null;
      return sendJson(res, 200, { texts: out, detected });
    }

    if (pathname === '/api/grammar' && req.method === 'POST') {
      const { text, language = 'auto' } = JSON.parse((await readBody(req)).toString('utf8'));
      const r = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        body: new URLSearchParams({ text, language })
      });
      if (!r.ok) return sendJson(res, r.status, { error: 'LanguageTool: HTTP ' + r.status });
      return sendJson(res, 200, await r.json());
    }

    if (pathname === '/api/crossref') {
      const doi = u.searchParams.get('doi'), title = u.searchParams.get('title') || '';
      const url = doi
        ? 'https://api.crossref.org/works/' + encodeURIComponent(doi)
        : 'https://api.crossref.org/works?rows=5&query.bibliographic=' + encodeURIComponent(title);
      const r = await fetch(url, { headers: { 'User-Agent': 'RisetKu/1.0 (mailto:admin@risetku.com)' } });
      if (!r.ok) return sendJson(res, r.status, { error: 'Crossref: HTTP ' + r.status });
      return sendJson(res, 200, await r.json());
    }

    if (pathname === '/api/simpan' && req.method === 'POST') {
      const p = uniquePath(TERJEMAHIN_OUT_DIR, safeName(u.searchParams.get('name')));
      fs.writeFileSync(p, await readBody(req));
      return sendJson(res, 200, { file: path.basename(p), folder: TERJEMAHIN_OUT_DIR });
    }

    if (pathname === '/api/masukan') {
      const files = fs.readdirSync(TERJEMAHIN_IN_DIR).filter(f => fs.statSync(path.join(TERJEMAHIN_IN_DIR, f)).isFile());
      return sendJson(res, 200, { files, folder: TERJEMAHIN_IN_DIR });
    }

    if (pathname === '/api/masukan/file') {
      const p = path.join(TERJEMAHIN_IN_DIR, safeName(u.searchParams.get('name')));
      if (!fs.existsSync(p)) return sendJson(res, 404, { error: 'File tidak ditemukan' });
      return serveStaticFile(res, p);
    }

    if (pathname === '/api/buka-folder') {
      const which = u.searchParams.get('folder') === 'masukan' ? TERJEMAHIN_IN_DIR : TERJEMAHIN_OUT_DIR;
      exec(`explorer "${which}"`);
      return sendJson(res, 200, { ok: true });
    }
  } catch (apiErr) {
    console.error('API Error:', apiErr);
    return sendJson(res, 500, { error: apiErr.message });
  }

  // 2. MODUL 2: CEK-IN (/cekin/)
  if (pathname === '/cekin') {
    res.writeHead(301, { Location: '/cekin/' });
    return res.end();
  }
  if (pathname.startsWith('/cekin/')) {
    let subPath = pathname.slice('/cekin/'.length);
    if (!subPath || subPath === '') subPath = 'index.html';
    const filePath = path.join(CEKIN_DIR, path.normalize(subPath));
    return serveStaticFile(res, filePath);
  }

  // 3. MODUL 3: SLR-IN AJA (/slr/)
  if (pathname === '/slr') {
    res.writeHead(301, { Location: '/slr/' });
    return res.end();
  }
  if (pathname.startsWith('/slr/')) {
    let subPath = pathname.slice('/slr/'.length);
    if (!subPath || subPath === '') subPath = 'index.html';
    const filePath = path.join(SLR_DIR, path.normalize(subPath));
    return serveStaticFile(res, filePath);
  }

  // 4. MODUL 4: TERJEMAHIN_AJA (/terjemahin/)
  if (pathname === '/terjemahin') {
    res.writeHead(301, { Location: '/terjemahin/' });
    return res.end();
  }
  if (pathname.startsWith('/terjemahin/')) {
    let subPath = pathname.slice('/terjemahin/'.length);
    if (!subPath || subPath === '') subPath = 'index.html';
    const filePath = path.join(TERJEMAHIN_APP_DIR, path.normalize(subPath));
    return serveStaticFile(res, filePath);
  }

  // 5. MODUL 5: ANALISIS-AJA (/analisis/)
  if (pathname === '/analisis') {
    res.writeHead(301, { Location: '/analisis/' });
    return res.end();
  }
  if (pathname.startsWith('/analisis/')) {
    let subPath = pathname.slice('/analisis/'.length);
    if (!subPath || subPath === '') subPath = 'index.html';
    const filePath = path.join(ANALISIS_DIR, path.normalize(subPath));
    return serveStaticFile(res, filePath);
  }

  // 6. MODUL 6: THINK A LOUD-IN (/thinkaloud/ & /think/)
  if (pathname === '/thinkaloud' || pathname === '/think') {
    res.writeHead(301, { Location: '/thinkaloud/' });
    return res.end();
  }
  if (pathname.startsWith('/thinkaloud/') || pathname.startsWith('/think/')) {
    let subPath = pathname.startsWith('/thinkaloud/') ? pathname.slice('/thinkaloud/'.length) : pathname.slice('/think/'.length);
    if (!subPath || subPath === '') subPath = 'index.html';
    const filePath = path.join(THINKALOUD_DIR, path.normalize(subPath));
    return serveStaticFile(res, filePath);
  }

  // 7. PORTAL UTAMA: RISETKU (/)
  let subPath = pathname;
  if (subPath === '/' || subPath === '') subPath = '/index.html';
  const filePath = path.join(PORTFOLIO_DIR, path.normalize(subPath));
  serveStaticFile(res, filePath);
});

// Menjalankan Server
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[!] Port ${PORT} sedang dipakai aplikasi lain.`);
    console.log(`[i] Mencoba port alternatif ${Number(PORT) + 1}...`);
    server.listen(Number(PORT) + 1);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  const activePort = server.address().port;
  console.log(`\n================================================================`);
  console.log(`  🌟 RISETKU LAB - EKOSISTEM RISET AKADEMIK TERPADU AKTIF 🌟`);
  console.log(`  🌐 Domain Resmi : www.riset-ku-lab.my.id`);
  console.log(`================================================================`);
  console.log(`  🔗 Portal Utama : http://localhost:${activePort}/`);
  console.log(`  --------------------------------------------------------------`);
  console.log(`  🚀 1. MADEL-5C       : https://madel5c.com`);
  console.log(`  🚀 2. Cek-In         : http://localhost:${activePort}/cekin/`);
  console.log(`  🚀 3. SLR-In Aja     : http://localhost:${activePort}/slr/`);
  console.log(`  🚀 4. Terjemahin_Aja : http://localhost:${activePort}/terjemahin/`);
  console.log(`  🚀 5. Analisis-Aja   : http://localhost:${activePort}/analisis/`);
  console.log(`  🚀 6. Think A Loud-In: http://localhost:${activePort}/thinkaloud/`);
  console.log(`================================================================`);
  console.log(`  Tekan Ctrl+C di terminal ini untuk menghentikan server.\n`);
});

