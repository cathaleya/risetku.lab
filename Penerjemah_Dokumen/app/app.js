// Penerjemah Dokumen: file dibaca di peramban, teksnya diterjemahkan lewat server lokal
// sambil dibaca, bisa diedit dan diperiksa tata bahasanya, lalu disimpan ke Hasil_Terjemahan bila perlu.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = s => esc(s).replace(/\n/g, '<br>');
const LS = {
  get(k, d) { try { const v = localStorage.getItem('pd_' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pd_' + k, v); } catch (e) {} },
};
const opt = () => ({ sl: $('#sl').value, tl: $('#tl').value, pdfOut: $('#pdfOut').value, csvMode: $('#csvMode').value, bilingual: $('#bilingual').checked, which: $('#exWhich').value });
const LANG_NAME = { id: 'Indonesia', en: 'Inggris' };
const IMG = /\.(png|jpe?g|bmp|webp|gif)$/i;
const TYPE = { pdf: 'PDF', docx: 'Word', pptx: 'PowerPoint', xlsx: 'Excel', csv: 'CSV', tsv: 'TSV', txt: 'Teks', md: 'Markdown', srt: 'Subtitle', vtt: 'Subtitle', html: 'HTML', htm: 'HTML', json: 'JSON' };
const baseName = n => n.replace(/\.[^.]+$/, '');
const extOf = n => (n.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
const isText = v => typeof v === 'string' && /\p{L}/u.test(v) && !/^\s*(https?:\/\/|www\.|doi:|10\.\d{4,}\/)\S*\s*$/i.test(v) && !/^\s*\S+@\S+\.\S+\s*$/.test(v);
const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

const UI = { sel: LS.get('sel', null), view: 'read', lang: LS.get('lang', 'id'), edit: false, hits: [], hit: -1, gram: null };
const docs = new Map();

// ---------- Penyimpanan di peramban (IndexedDB) ----------
const DB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((ok, fail) => {
    const r = indexedDB.open('penerjemah-dokumen', 2);
    r.onupgradeneeded = () => {
      for (const name of ['docs', 'files', 'quotes']) if (!r.result.objectStoreNames.contains(name)) r.result.createObjectStore(name, { keyPath: 'id' });
    };
    // Tab aplikasi versi lama yang masih terbuka menahan pembaruan penyimpanan.
    r.onblocked = () => banner('Ada tab Penerjemah Dokumen lain yang masih terbuka. Tutup tab lain itu, lalu muat ulang halaman ini (F5).');
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => { db.close(); banner('Aplikasi diperbarui di tab lain. Muat ulang halaman ini (F5).'); };
      ok(db);
    };
    r.onerror = () => fail(r.error);
  }));
  const tx = async (store, mode, fn) => {
    const db = await open();
    return new Promise((ok, fail) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => ok(req && req.result);
      t.onerror = () => fail(t.error);
    });
  };
  return {
    get: (s, id) => tx(s, 'readonly', o => o.get(id)),
    put: (s, v) => tx(s, 'readwrite', o => o.put(v)),
    del: (s, id) => tx(s, 'readwrite', o => o.delete(id)),
    all: s => tx(s, 'readonly', o => o.getAll()),
  };
})();
const saveTimers = {};
function save(doc, now) {
  clearTimeout(saveTimers[doc.id]);
  if (now) return DB.put('docs', doc).catch(e => toast('Gagal menyimpan: ' + e.message));
  saveTimers[doc.id] = setTimeout(() => DB.put('docs', doc).catch(e => toast('Gagal menyimpan: ' + e.message)), 400);
}
const cur = () => docs.get(UI.sel);

// ---------- Memasukkan file ----------
const readQueue = [];
let reading = false;

async function addFiles(files) {
  let first = null;
  if (files.length) toast(`Memasukkan ${files.length} file…`);
  for (const f of files) {
    const same = [...docs.values()].find(d => d.name === f.name && d.size === f.size);
    if (same) { first = first || same.id; continue; }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const doc = { id, name: f.name, ext: extOf(f.name), size: f.size, added: Date.now(), status: 'reading', units: [], loc: [], sections: [], tr: {} };
    try {
      await DB.put('files', { id, blob: f });
      await DB.put('docs', doc);
    } catch (e) {
      console.error(e);
      banner(`Gagal memasukkan "${f.name}": ${e.message || e}. Coba tutup tab lain aplikasi ini lalu muat ulang (F5).`);
      continue;
    }
    docs.set(id, doc);
    readQueue.push(id);
    first = first || id;
  }
  renderLib();
  if (first) select(first);
  pumpRead();
}

async function pumpRead() {
  if (reading) return;
  reading = true;
  while (readQueue.length) {
    const doc = docs.get(readQueue.shift());
    if (!doc) continue;
    try {
      const rec = await DB.get('files', doc.id);
      const res = await extract(doc, rec.blob, msg => { doc.msg = msg; renderLib(); if (UI.sel === doc.id) $('#docContent').innerHTML = `<p class="muted pad">${esc(msg)}</p>`; });
      Object.assign(doc, res, { status: 'ready', msg: '' });
    } catch (e) {
      console.error(e);
      Object.assign(doc, { status: 'error', error: e.message });
    }
    await save(doc, true);
    renderLib();
    if (UI.sel === doc.id) renderDoc();
    pumpTr();
    if (doc.status === 'ready') resolveMeta(doc);
  }
  reading = false;
}

// ---------- Ekstraksi isi dokumen ----------
// Hasil: sections [{title, blocks}], blocks merujuk ke units (teks yang diterjemahkan) lewat {u} atau {raw}.
function Builder() {
  const units = [], loc = [], sections = [];
  let sec = null;
  return {
    units, loc, sections,
    section(title, page) { sec = { title, blocks: [] }; if (page) sec.page = page; sections.push(sec); },
    unit(text, where) {
      text = String(text ?? '');
      if (!isText(text)) return { raw: text };
      units.push(text); loc.push(where ?? null);
      return { u: units.length - 1 };
    },
    block(b) { if (!sec) this.section(''); sec.blocks.push(b); },
  };
}

async function extract(doc, blob, say) {
  const B = Builder();
  const ext = doc.ext;
  say('Membaca file…');
  let info = '';
  if (ext === 'pdf') info = await extractPdf(blob, B, say);
  else if (ext === 'docx') info = await extractDocx(blob, B);
  else if (ext === 'pptx') info = await extractPptx(blob, B);
  else if (ext === 'xlsx') info = await extractXlsx(blob, B);
  else if (ext === 'csv' || ext === 'tsv') info = await extractCsv(blob, B);
  else if (['txt', 'md', 'srt', 'vtt'].includes(ext)) info = await extractText(blob, B, ext);
  else if (ext === 'html' || ext === 'htm') info = await extractHtml(blob, B);
  else if (ext === 'json') info = await extractJson(blob, B);
  else if (IMG.test(doc.name)) info = await extractImage(blob, B, say);
  else if (ext === 'doc') throw new Error('Format .doc lama: buka di Word lalu Simpan Sebagai .docx');
  else if (ext === 'xls') throw new Error('Format .xls lama: buka di Excel lalu Simpan Sebagai .xlsx');
  else if (ext === 'ppt') throw new Error('Format .ppt lama: buka di PowerPoint lalu Simpan Sebagai .pptx');
  else throw new Error('Jenis file .' + ext + ' belum didukung');
  if (!B.units.length && !B.sections.some(s => s.blocks.length)) throw new Error('Tidak ada teks yang bisa dibaca dari file ini');
  return { sections: B.sections, units: B.units, loc: B.loc, info, tr: {}, titleGuess: B.titleGuess || '' };
}

async function readText(blob) {
  const buf = await blob.arrayBuffer();
  let t = new TextDecoder('utf-8').decode(buf);
  if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf);
  return t.replace(/^﻿/, '');
}
const parseXml = s => new DOMParser().parseFromString(s, 'application/xml');

// PDF
async function extractPdf(blob, B, say) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  let ocrPages = 0;
  for (let n = 1; n <= pdf.numPages; n++) {
    say(`Membaca halaman ${n}/${pdf.numPages}…`);
    const page = await pdf.getPage(n);
    let paras = paragraphsFromText(await page.getTextContent());
    let ocr = false;
    if (paras.map(p => p.text).join('').replace(/\s/g, '').length < 15) {
      say(`Halaman ${n} berupa gambar, membaca dengan OCR…`);
      paras = (await ocrCanvas(await renderPage(page, 2))).map(text => ({ text, h: 0 }));
      ocr = true; ocrPages++;
    }
    if (n === 1 && !ocr) {
      const big = paras.filter(p => p.text.length >= 15 && p.text.length <= 300).sort((a, b) => b.h - a.h)[0];
      if (big) B.titleGuess = big.text;
    }
    B.section('Halaman ' + n + (ocr ? ' · OCR' : ''), n);
    const hs = paras.filter(p => p.h).map(p => p.h).sort((a, b) => a - b);
    const med = hs[Math.floor(hs.length / 2)] || 0;
    for (const p of paras) B.block({ t: med && p.h > med * 1.2 && p.text.length < 200 ? 'h' : 'p', ...B.unit(p.text) });
  }
  return pdf.numPages + ' halaman' + (ocrPages ? ` (${ocrPages} dibaca dengan OCR)` : '');
}

function paragraphsFromText(tc) {
  // Potongan teks digabung menjadi baris, lalu baris menjadi paragraf.
  const lines = [];
  let cur = null;
  for (const it of tc.items) {
    if (it.str === undefined) continue;
    const x = it.transform[4], y = it.transform[5];
    const h = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
    if (cur && Math.abs(y - cur.y) > h * 0.5) { lines.push(cur); cur = null; }
    if (!cur) cur = { text: '', y, h, endX: x };
    else if (it.str && !/\s$/.test(cur.text) && !/^\s/.test(it.str) && x - cur.endX > h * 0.15) cur.text += ' ';
    cur.text += it.str;
    cur.endX = x + (it.width || 0);
    cur.h = Math.max(cur.h, h);
    if (it.hasEOL) { lines.push(cur); cur = null; }
  }
  if (cur) lines.push(cur);

  const paras = [];
  let para = null, prev = null;
  for (const ln of lines) {
    const text = ln.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const gap = prev ? prev.y - ln.y : 0;
    if (!para || gap <= 0 || gap > prev.h * 1.8 || Math.abs(ln.h - prev.h) > 1.5) {
      if (para) paras.push(para);
      para = { text, h: ln.h };
    } else if (/[a-z]-$/i.test(para.text) && /^\p{Ll}/u.test(text)) para.text = para.text.slice(0, -1) + text;
    else para.text += ' ' + text;
    prev = ln;
  }
  if (para) paras.push(para);
  return paras;
}

async function renderPage(page, scale) {
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = vp.width; c.height = vp.height;
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  return c;
}

// OCR untuk PDF hasil scan dan gambar
const OCR_LANG = { auto: 'eng', en: 'eng', 'zh-CN': 'chi_sim', ar: 'ara', ja: 'jpn', ko: 'kor', de: 'deu', fr: 'fra', es: 'spa', pt: 'por', ru: 'rus', nl: 'nld', ms: 'msa' };
let ocrWorker = null, ocrLang = null;
async function ocrCanvas(canvas) {
  if (!window.Tesseract) await new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = ok; s.onerror = () => fail(new Error('Gagal memuat OCR (cek internet)'));
    document.head.appendChild(s);
  });
  const lang = OCR_LANG[opt().sl] || 'eng';
  if (!ocrWorker || ocrLang !== lang) {
    if (ocrWorker) await ocrWorker.terminate();
    ocrWorker = await Tesseract.createWorker(lang);
    ocrLang = lang;
  }
  const { data } = await ocrWorker.recognize(canvas);
  return data.text.split(/\n\s*\n/).map(p => p.replace(/-\n(?=\p{Ll})/gu, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
}

async function extractImage(blob, B, say) {
  const img = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  say('Membaca teks gambar (OCR)…');
  B.section('Teks dari gambar · OCR');
  for (const t of await ocrCanvas(c)) B.block({ t: 'p', ...B.unit(t) });
  return `gambar ${img.width}×${img.height}`;
}

// Word: setiap paragraf diberi nomor urut w:p di document.xml supaya hasil edit bisa ditulis balik.
const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  s: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
};

function ownTexts(p, ns, paraTag, textTag, skipTag) {
  // Elemen teks milik paragraf ini saja (bukan paragraf di dalam kotak teks).
  return [...p.getElementsByTagNameNS(ns, textTag)].filter(t => {
    for (let n = t.parentNode; n; n = n.parentNode) {
      if (n.namespaceURI === ns && n.localName === skipTag) return false;
      if (n.namespaceURI === ns && n.localName === paraTag) return n === p;
    }
    return false;
  });
}
const wText = p => ownTexts(p, NS.w, 'p', 't').map(t => t.textContent).join('');

async function extractDocx(blob, B) {
  const zip = await JSZip.loadAsync(blob);
  const xdoc = parseXml(await zip.file('word/document.xml').async('string'));
  const index = new Map([...xdoc.getElementsByTagNameNS(NS.w, 'p')].map((p, i) => [p, i]));
  const body = xdoc.getElementsByTagNameNS(NS.w, 'body')[0];
  let paras = 0, tables = 0;
  B.section('');
  const walk = parent => {
    for (const el of parent.children) {
      if (el.namespaceURI !== NS.w) continue;
      if (el.localName === 'p') {
        const text = wText(el);
        if (!text.trim()) continue;
        const st = el.getElementsByTagNameNS(NS.w, 'pStyle')[0]?.getAttributeNS(NS.w, 'val') || '';
        const t = /^(title|judul)$/i.test(st) ? 'title' : /heading|judul|^\d$/i.test(st) ? 'h' : el.getElementsByTagNameNS(NS.w, 'numPr').length ? 'li' : 'p';
        B.block({ t, ...B.unit(text, index.get(el)) });
        paras++;
      } else if (el.localName === 'tbl') {
        const rows = [...el.children].filter(r => r.localName === 'tr').map(tr => [...tr.children].filter(c => c.localName === 'tc')
          .map(tc => [...tc.getElementsByTagNameNS(NS.w, 'p')].filter(p => wText(p).trim()).map(p => B.unit(wText(p), index.get(p)))));
        B.block({ t: 'table', rows });
        tables++;
      } else if (el.localName === 'sdt') {
        const c = el.getElementsByTagNameNS(NS.w, 'sdtContent')[0];
        if (c) walk(c);
      }
    }
  };
  walk(body);
  const fn = zip.file('word/footnotes.xml');
  if (fn) {
    const notes = [...parseXml(await fn.async('string')).getElementsByTagNameNS(NS.w, 'footnote')]
      .map(f => [...f.getElementsByTagNameNS(NS.w, 'p')].map(wText).join(' ').trim()).filter(Boolean);
    if (notes.length) { B.section('Catatan kaki'); notes.forEach(t => B.block({ t: 'p', small: true, ...B.unit(t) })); }
  }
  return `${paras} paragraf` + (tables ? ` · ${tables} tabel` : '');
}

async function extractPptx(blob, B) {
  const zip = await JSZip.loadAsync(blob);
  const num = n => +n.match(/(\d+)\.xml$/)[1];
  const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b));
  for (const name of slides) {
    B.section('Slide ' + num(name));
    const x = parseXml(await zip.file(name).async('string'));
    for (const p of x.getElementsByTagNameNS(NS.a, 'p')) {
      const text = ownTexts(p, NS.a, 'p', 't').map(t => t.textContent).join('');
      if (!text.trim()) continue;
      let sp = p.parentNode;
      while (sp && sp.localName !== 'sp') sp = sp.parentNode;
      const ph = sp?.getElementsByTagNameNS(NS.p, 'ph')[0]?.getAttribute('type');
      B.block({ t: ph === 'title' || ph === 'ctrTitle' ? 'h' : 'p', ...B.unit(text) });
    }
  }
  return slides.length + ' slide';
}

async function extractXlsx(blob, B) {
  const zip = await JSZip.loadAsync(blob);
  const read = async n => zip.file(n) ? parseXml(await zip.file(n).async('string')) : null;
  const wb = await read('xl/workbook.xml'), rels = await read('xl/_rels/workbook.xml.rels'), ssx = await read('xl/sharedStrings.xml');
  const rel = {};
  for (const r of rels.getElementsByTagName('Relationship')) rel[r.getAttribute('Id')] = r.getAttribute('Target');
  const ss = ssx ? [...ssx.getElementsByTagNameNS(NS.s, 'si')].map(si => ownTexts(si, NS.s, 'si', 't', 'rPh').map(t => t.textContent).join('')) : [];
  const col = ref => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const sheets = [...wb.getElementsByTagNameNS(NS.s, 'sheet')];
  for (const sh of sheets) {
    const target = rel[sh.getAttributeNS(NS.r, 'id')] || '';
    const x = await read(target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, ''));
    if (!x) continue;
    const grid = [];
    let width = 0;
    for (const row of [...x.getElementsByTagNameNS(NS.s, 'row')].slice(0, 5000)) {
      const cells = [];
      for (const c of row.getElementsByTagNameNS(NS.s, 'c')) {
        const j = c.getAttribute('r') ? col(c.getAttribute('r')) : cells.length;
        const t = c.getAttribute('t'), v = c.getElementsByTagNameNS(NS.s, 'v')[0]?.textContent;
        cells[j] = t === 's' ? ss[+v] : t === 'inlineStr' ? [...c.getElementsByTagNameNS(NS.s, 't')].map(e => e.textContent).join('') : (v ?? '');
      }
      if (cells.some(v => v !== undefined && v !== '')) { grid.push(cells); width = Math.max(width, cells.length); }
    }
    B.section('Lembar: ' + sh.getAttribute('name'));
    if (grid.length) B.block({ t: 'table', head: true, rows: grid.map(r => Array.from({ length: width }, (_, j) => B.unit(r[j] ?? ''))) });
  }
  return sheets.length + ' lembar';
}

async function extractCsv(blob, B) {
  const rows = Papa.parse(await readText(blob), { skipEmptyLines: true }).data;
  B.section('');
  B.block({ t: 'table', head: true, rows: rows.map(r => r.map(v => B.unit(v))) });
  return `${Math.max(0, rows.length - 1)} baris · ${rows[0]?.length || 0} kolom`;
}

async function extractText(blob, B, ext) {
  const lines = (await readText(blob)).split(/\r?\n/);
  B.section('');
  if (ext === 'srt' || ext === 'vtt') {
    for (const l of lines) {
      if (!l.trim()) continue;
      if (/-->/.test(l) || /^\s*\d+\s*$/.test(l) || /^WEBVTT/.test(l)) B.block({ t: 'meta', raw: l });
      else B.block({ t: 'p', ...B.unit(l.trim()) });
    }
    return lines.length + ' baris';
  }
  let para = [], fence = null;
  const flush = () => { if (para.length) B.block({ t: 'p', ...B.unit(para.join(' ')) }); para = []; };
  for (const l of lines) {
    if (ext === 'md' && /^\s*```/.test(l)) {
      if (fence) { B.block({ t: 'code', raw: fence.join('\n') }); fence = null; } else { flush(); fence = []; }
      continue;
    }
    if (fence) { fence.push(l); continue; }
    if (!l.trim()) { flush(); continue; }
    if (ext === 'md' && /^#{1,6}\s/.test(l)) { flush(); B.block({ t: 'h', ...B.unit(l.replace(/^#+\s*/, '')) }); continue; }
    if (ext === 'md' && /^\s*([-*+]|\d+\.)\s/.test(l)) { flush(); B.block({ t: 'li', ...B.unit(l.replace(/^\s*([-*+]|\d+\.)\s+/, '')) }); continue; }
    para.push(l.trim());
  }
  flush();
  return lines.length + ' baris';
}

async function extractHtml(blob, B) {
  const d = new DOMParser().parseFromString(await readText(blob), 'text/html');
  d.querySelectorAll('script,style,noscript,template').forEach(e => e.remove());
  const SEL = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,dt,dd,td,th,pre,caption';
  B.section('');
  if (d.title.trim()) B.block({ t: 'title', ...B.unit(d.title.trim()) });
  const els = [...d.body.querySelectorAll(SEL)].filter(e => !e.querySelector(SEL));
  for (const e of els) {
    const t = e.textContent.replace(/\s+/g, ' ').trim();
    if (t) B.block({ t: /^H\d$/.test(e.tagName) ? 'h' : e.tagName === 'LI' ? 'li' : 'p', ...B.unit(t) });
  }
  if (!els.length) d.body.textContent.split(/\n\s*\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).forEach(t => B.block({ t: 'p', ...B.unit(t) }));
  return els.length + ' bagian';
}

async function extractJson(blob, B) {
  const data = JSON.parse(await readText(blob));
  const rows = [[{ raw: 'Kunci' }, { raw: 'Nilai' }]];
  (function walk(o, path) {
    if (Array.isArray(o)) o.forEach((v, i) => walk(v, path + '[' + i + ']'));
    else if (o && typeof o === 'object') for (const k of Object.keys(o)) walk(o[k], path ? path + '.' + k : k);
    else rows.push([{ raw: path }, typeof o === 'string' ? B.unit(o) : { raw: String(o) }]);
  })(data, '');
  B.section('');
  B.block({ t: 'table', head: true, rows });
  return rows.length - 1 + ' nilai';
}

// ---------- Penerjemahan bertahap ----------
let knownTr = new Map();   // teks asli → terjemahan yang sudah ada (dipakai saat menyimpan file)

// Utama: Google Translate lewat server lokal. Cadangan: penerjemah bawaan Chrome (di perangkat, tanpa kuota)
// saat Google membatasi permintaan atau tidak bisa dihubungi.
let googleBlockedUntil = 0, chromeNotice = false;
const chromeTr = {};
async function requestTranslate(texts, tl = opt().tl, sl = opt().sl, meta = {}) {
  let why = 'Google Translate sedang membatasi permintaan';
  if (Date.now() >= googleBlockedUntil) {
    let res = null;
    try {
      const r = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, sl, tl }),
      });
      res = { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
    } catch (e) {
      why = 'Server penerjemah tidak bisa dihubungi';
    }
    if (res && res.ok) { meta.detected = res.data.detected; return res.data.texts; }
    if (res && res.status !== 429 && res.status < 500) throw new Error(res.data.error || 'Penerjemah tidak merespons (HTTP ' + res.status + ')');
    if (res) {
      why = res.data.error || why;
      if (res.status === 429) googleBlockedUntil = Date.now() + 5 * 60 * 1000;
    }
  }
  const out = await chromeTranslate(texts, sl, tl, meta);
  if (out) {
    if (!chromeNotice) { chromeNotice = true; toast(why + '. Sementara memakai penerjemah bawaan Chrome.'); }
    return out;
  }
  throw new Error(why + '. Coba lagi beberapa menit lagi' + ('Translator' in self ? '' : ', atau buka aplikasi di Chrome versi terbaru'));
}

async function chromeTranslate(texts, sl, tl, meta) {
  if (!('Translator' in self)) return null;
  const code = c => String(c || '').split('-')[0];
  let src = sl === 'auto' ? meta.srcHint || '' : sl;
  if (!src && 'LanguageDetector' in self) {
    try { src = (await (await LanguageDetector.create()).detect(texts.join(' ').slice(0, 3000)))[0]?.detectedLanguage; } catch (e) {}
  }
  if (!src || src === 'und') return null;
  src = code(src);
  const dst = code(tl);
  meta.detected = src;
  if (src === dst) return texts.slice();
  const key = src + '>' + dst;
  try {
    if (!chromeTr[key]) {
      if (await Translator.availability({ sourceLanguage: src, targetLanguage: dst }) === 'unavailable') return null;
      chromeTr[key] = await Translator.create({ sourceLanguage: src, targetLanguage: dst });
    }
    const out = [];
    for (const t of texts) out.push(t.trim() ? await chromeTr[key].translate(t) : t);
    return out;
  } catch (e) {
    console.warn(e);
    return null;
  }
}

async function translateAll(texts, onProgress = () => {}) {
  const out = texts.map(t => knownTr.get(t) ?? null);
  const need = out.map((v, i) => (v == null ? i : -1)).filter(i => i >= 0);
  let i = 0;
  while (i < need.length) {
    let j = i, len = 0;
    while (j < need.length && j - i < 80 && (j === i || len + texts[need[j]].length < 15000)) { len += texts[need[j]].length; j++; }
    const res = await requestTranslate(need.slice(i, j).map(k => texts[k]));
    need.slice(i, j).forEach((k, n) => { out[k] = res[n]; });
    i = j;
    onProgress(i / need.length);
  }
  return out;
}

const trOf = (doc, tl = opt().tl) => doc.tr[tl] || (doc.tr[tl] = new Array(doc.units.length).fill(null));
const doneCount = doc => trOf(doc).filter(v => v != null).length;

let trBusy = false;
async function pumpTr() {
  if (trBusy) return;
  trBusy = true;
  try {
    for (;;) {
      const cand = [...docs.values()].filter(d => d.status === 'ready' && !d.trError && doneCount(d) < d.units.length);
      if (!cand.length) break;
      const doc = cand.find(d => d.id === UI.sel) || cand.sort((a, b) => a.added - b.added)[0];
      const arr = trOf(doc), idx = [];
      let len = 0;
      for (let i = 0; i < doc.units.length && idx.length < 40; i++) {
        if (arr[i] != null) continue;
        if (idx.length && len + doc.units[i].length > 12000) break;
        idx.push(i); len += doc.units[i].length;
      }
      try {
        const meta = { srcHint: doc.srcLang };
        const res = await requestTranslate(idx.map(i => doc.units[i]), undefined, undefined, meta);
        idx.forEach((i, k) => { arr[i] = res[k]; });
        if (meta.detected && !doc.srcLang) doc.srcLang = meta.detected;
      } catch (e) {
        doc.trError = e.message;
      }
      save(doc);
      updateUnits(doc, idx);
      renderLib();
      if (UI.sel === doc.id) updateTrBar(doc);
    }
  } finally {
    trBusy = false;
  }
}

// ---------- Daftar dokumen ----------
function statusOf(doc) {
  if (doc.status === 'reading') return ['', doc.msg || 'Menunggu dibaca…', null];
  if (doc.status === 'error') return ['err', 'Gagal: ' + doc.error, null];
  const n = doc.units.length, d = doneCount(doc);
  if (doc.trError) return ['err', `Terjemahan berhenti (${d}/${n})`, d / n];
  if (!n) return ['ok', 'Siap dibaca (tidak ada teks)', null];
  if (d < n) return ['', `Menerjemahkan ${Math.floor(d / n * 100)}%`, d / n];
  return ['ok', '✓ Siap dibaca', null];
}

function renderLib() {
  const list = [...docs.values()].sort((a, b) => b.added - a.added);
  $('#libCount').textContent = list.length ? '(' + list.length + ')' : '';
  $('#lib').innerHTML = list.length ? list.map(d => {
    const [cls, txt, p] = statusOf(d);
    return `<li data-id="${d.id}" class="${d.id === UI.sel && UI.page !== 'quotes' ? 'on' : ''}" title="${esc(d.name)}">
      <div class="nm"><span>${esc(d.name)}</span><button class="x" data-del="${d.id}" title="Hapus dokumen ini dari aplikasi" aria-label="Hapus ${esc(d.name)}">×</button></div>
      <div class="st ${cls}"><span class="chip">${esc(d.ext)}</span>${esc(txt)}</div>
      ${p != null ? `<div class="mini-bar"><span style="width:${Math.round(p * 100)}%"></span></div>` : ''}
    </li>`;
  }).join('') : '<li class="muted small" style="cursor:default">Belum ada dokumen.</li>';
}

function select(id) {
  if (UI.sel !== id) { UI.view = 'read'; UI.gram = null; }
  UI.page = 'doc';
  UI.sel = id;
  LS.set('sel', id);
  renderLib();
  renderDoc();
  pumpTr();
}

// ---------- Panel baca ----------
function unitInner(doc, u, mode = UI.lang) {
  const orig = doc.units[u], tr = trOf(doc)[u];
  const ed = (kind, text, lang) => UI.edit
    ? `<span class="ed" contenteditable="plaintext-only" spellcheck="true" lang="${lang}" data-ed="${kind}">${fmt(text)}</span>`
    : fmt(text);
  const tl = opt().tl, sl = opt().sl === 'auto' ? '' : opt().sl;
  if (mode === 'orig') {
    const restore = UI.edit && doc.orig0 && doc.orig0[u] != null
      ? `<button class="restore" data-act="restore" data-u="${u}" title="Kembalikan teks asli semula">↺</button>` : '';
    return ed('orig', orig, doc.srcLang || sl) + restore;
  }
  if (tr == null) return `<span class="pending">${UI.lang === 'bi' ? 'menerjemahkan…' : fmt(orig)}</span>`;
  return ed('tr', tr, tl);
}
const refHTML = (doc, ref, mode) => Array.isArray(ref) ? ref.map(r => refHTML(doc, r, mode)).join('')
  : ref.u != null ? `<span class="u" data-u="${ref.u}" data-m="${mode}">${unitInner(doc, ref.u, mode)}</span>` : fmt(ref.raw ?? '');

function blockHTML(doc, b, mode = UI.lang) {
  if (b.t === 'table') {
    return `<div class="tbl-wrap"><table class="tbl">${b.rows.map((r, i) => {
      const tag = b.head && i === 0 ? 'th' : 'td';
      return `<tr>${r.map(c => `<${tag}>${refHTML(doc, c, mode)}</${tag}>`).join('')}</tr>`;
    }).join('')}</table></div>`;
  }
  if (b.t === 'meta') return `<div class="blk meta">${fmt(b.raw)}</div>`;
  if (b.t === 'code') return `<pre class="code">${esc(b.raw)}</pre>`;
  return `<div class="blk ${b.t}${b.small ? ' small' : ''}">${refHTML(doc, b, mode)}</div>`;
}

function updateUnits(doc, idx) {
  if (UI.sel !== doc.id || UI.view !== 'read') return;
  const c = $('#docContent');
  for (const i of idx) c.querySelectorAll(`.u[data-u="${i}"]`).forEach(el => {
    if (!el.contains(document.activeElement)) el.innerHTML = unitInner(doc, i, el.dataset.m);
  });
}

function renderDoc() {
  const doc = cur();
  const qp = UI.page === 'quotes';
  $('#quotesView').hidden = !qp;
  $('#quotesBtn').classList.toggle('on', qp);
  $('#empty').hidden = qp || !!doc;
  $('#docView').hidden = qp || !doc;
  if (qp) { renderQuotes(); return; }
  if (!doc) return;
  $('#docTitle').textContent = doc.name;
  renderRefLine(doc);
  $('#docMeta').textContent = [TYPE[doc.ext] || (IMG.test(doc.name) ? 'Gambar' : doc.ext.toUpperCase()), kb(doc.size), doc.info, doc.units.length ? doc.units.length + ' bagian teks' : ''].filter(Boolean).join(' · ');
  const canOrig = doc.ext === 'pdf' || IMG.test(doc.name);
  if (!canOrig && UI.view === 'orig') UI.view = 'read';
  const vb = $('#viewSeg [data-view="orig"]');
  vb.hidden = !canOrig;
  vb.textContent = IMG.test(doc.name) ? 'Gambar asli' : 'PDF asli';
  $('#viewSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.view === UI.view));
  $('#langSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.lang === UI.lang));
  $('#langSeg [data-lang="id"]').textContent = LANG_NAME[opt().tl] || opt().tl;
  $('#langSeg').hidden = UI.view === 'orig';
  $('#editBtn').hidden = $('#gramBtn').hidden = UI.view === 'orig';
  $('#editBtn').classList.toggle('on', UI.edit);
  $('#syncLbl').hidden = !(UI.edit && UI.lang === 'bi' && UI.view === 'read');
  $('#exportPop').hidden = true;
  renderGram();

  const c = $('#docContent');
  c.classList.toggle('editing', UI.edit);
  if (doc.status === 'reading') { c.innerHTML = `<p class="muted pad">${esc(doc.msg || 'Membaca file…')}</p>`; return; }
  if (doc.status === 'error') { c.innerHTML = `<p class="err pad">${esc(doc.error)}</p>`; return; }
  if (UI.view === 'orig') { renderOriginal(doc, c); return; }
  const secTitle = s => s.title ? `<div class="sec-title">${esc(s.title)}</div>` : '';
  c.innerHTML = '<div class="tr-bar" id="trBar"></div>' + (UI.lang === 'bi'
    ? `<div class="doc-text bi"><div class="bi-row bi-head"><div>Asli${doc.srcLang ? ' (' + esc(doc.srcLang) + ')' : ''}</div><div>Terjemahan (${esc(LANG_NAME[opt().tl] || opt().tl)})</div></div>${doc.sections.map(s =>
        `<section class="sec">${secTitle(s)}${s.blocks.map(b => `<div class="bi-row"><div class="bi-l">${blockHTML(doc, b, 'orig')}</div><div class="bi-r">${blockHTML(doc, b, 'id')}</div></div>`).join('')}</section>`).join('')}</div>`
    : `<div class="doc-text">${doc.sections.map(s => `<section class="sec">${secTitle(s)}${s.blocks.map(b => blockHTML(doc, b)).join('')}</section>`).join('')}</div>`);
  updateTrBar(doc);
  if ($('#find').value.trim()) runFind(false);
}

function updateTrBar(doc) {
  const bar = $('#trBar');
  if (!bar) return;
  const n = doc.units.length, d = doneCount(doc), name = LANG_NAME[opt().tl] || opt().tl;
  bar.classList.toggle('err', !!doc.trError);
  if (!n) { bar.innerHTML = '<span class="tr-status">Tidak ada teks yang perlu diterjemahkan.</span>'; return; }
  if (doc.trError) {
    bar.innerHTML = `<span class="tr-status">Terjemahan berhenti di ${d}/${n}: ${esc(doc.trError)}</span><button class="link" data-act="retry">Coba lagi</button>`;
  } else if (d < n) {
    bar.innerHTML = `<span class="tr-status">Menerjemahkan ke bahasa ${name}… ${d}/${n} bagian. Bagian yang sudah selesai bisa langsung dibaca.</span><div class="bar"><span style="width:${d / n * 100}%"></span></div>`;
  } else {
    bar.innerHTML = `<span class="tr-status">Terjemahan mesin selesai (${n} bagian).${UI.edit ? ' Mode edit aktif: klik teks untuk mengubah, perubahan tersimpan otomatis.' : ''}</span><button class="link" data-act="retranslate">Terjemahkan ulang</button>`;
  }
}

let pdfCache = { id: null, pdf: null };
async function renderOriginal(doc, c) {
  c.innerHTML = '<p class="muted pad">Memuat…</p>';
  const { blob } = await DB.get('files', doc.id);
  if (UI.sel !== doc.id || UI.view !== 'orig') return;
  if (IMG.test(doc.name)) { c.innerHTML = `<img class="orig-img" alt="${esc(doc.name)}" src="${URL.createObjectURL(blob)}">`; return; }
  if (pdfCache.id !== doc.id) pdfCache = { id: doc.id, pdf: await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise };
  const pdf = pdfCache.pdf;
  const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
  c.innerHTML = '<div class="pdf-pages"></div>';
  const wrap = c.firstChild;
  const io = new IntersectionObserver(entries => entries.forEach(async e => {
    if (!e.isIntersecting || e.target.dataset.done) return;
    e.target.dataset.done = 1;
    const page = await pdf.getPage(+e.target.dataset.n);
    const scale = (e.target.clientWidth * (window.devicePixelRatio || 1)) / page.getViewport({ scale: 1 }).width;
    const canvas = await renderPage(page, scale);
    e.target.style.aspectRatio = '';
    e.target.prepend(canvas);
  }), { root: c, rootMargin: '600px' });
  for (let n = 1; n <= pdf.numPages; n++) {
    const d = document.createElement('div');
    d.className = 'pdf-page'; d.dataset.n = n;
    d.style.aspectRatio = first.width + ' / ' + first.height;
    d.innerHTML = `<span class="pg">${n}</span>`;
    wrap.appendChild(d);
    io.observe(d);
  }
}

// ---------- Edit langsung ----------
function commitEdit(el) {
  const doc = cur(), uEl = el.closest('.u');
  if (!doc || !uEl) return;
  const u = +uEl.dataset.u;
  const text = el.innerText.replace(/ /g, ' ').replace(/\n+$/, '');
  if (el.dataset.ed === 'orig') {
    if (text === doc.units[u]) return;
    keepOrig(doc, u);
    doc.units[u] = text;
    for (const k in doc.tr) doc.tr[k][u] = null;   // teks asli berubah: terjemahkan ulang bagian ini
    doc.trError = null;
    save(doc);
    pumpTr();
  } else {
    const arr = trOf(doc);
    if (text === arr[u]) return;
    arr[u] = text;
    save(doc);
    if (UI.lang === 'bi' && $('#syncChk').checked) syncOriginal(doc, u, text);
  }
}
function keepOrig(doc, u) {
  doc.orig0 = doc.orig0 || {};
  if (doc.orig0[u] == null) doc.orig0[u] = doc.units[u];
}
const leftOf = u => document.querySelector(`#docContent .u[data-u="${u}"][data-m="orig"]`);
async function syncOriginal(doc, u, text) {
  const src = opt().sl !== 'auto' ? opt().sl : doc.srcLang;
  if (!src || src === opt().tl) { toast('Bahasa asal belum diketahui. Pilih bahasanya di "Dari" agar teks asli bisa disesuaikan.'); return; }
  leftOf(u)?.classList.add('syncing');
  try {
    const [back] = await requestTranslate([text], src, opt().tl, { srcHint: opt().tl });
    if (trOf(doc)[u] !== text) return;          // sudah diedit lagi; hasil berikutnya yang dipakai
    keepOrig(doc, u);
    doc.units[u] = back;
    save(doc);
    updateUnits(doc, [u]);
    const l = leftOf(u);
    if (l) { l.classList.remove('flash'); void l.offsetWidth; l.classList.add('flash'); }
  } catch (e) {
    toast('Gagal menyesuaikan teks asli: ' + e.message);
  } finally {
    leftOf(u)?.classList.remove('syncing');
  }
}
const editTimers = new WeakMap();
$('#docContent').addEventListener('input', e => {
  const el = e.target.closest?.('.ed');
  if (!el) return;
  clearTimeout(editTimers.get(el));
  editTimers.set(el, setTimeout(() => commitEdit(el), 700));
});
$('#docContent').addEventListener('focusout', e => { const el = e.target.closest?.('.ed'); if (el) commitEdit(el); });

// ---------- Periksa tata bahasa ----------
// Bahasa Indonesia: aturan KBBI/PUEBI yang sering salah (LanguageTool belum mendukung bahasa Indonesia).
// Bahasa lain: LanguageTool lewat server lokal.
const BAKU = [...`aktifitas>aktivitas analisa>analisis apotik>apotek atlit>atlet praktek>praktik praktekkan>praktikkan resiko>risiko sistim>sistem
kwalitas>kualitas kwantitas>kuantitas kwalitatif>kualitatif kwantitatif>kuantitatif obyek>objek subyek>subjek obyektif>objektif subyektif>subjektif
merubah>mengubah dirubah>diubah perubah>pengubah mempengaruhi>memengaruhi dipengaruhi>dipengaruhi menterjemahkan>menerjemahkan diterjemahkan>diterjemahkan
mensukseskan>menyukseskan mentaati>menaati terlanjur>telanjur ijin>izin ijasah>ijazah jaman>zaman jadual>jadwal nasehat>nasihat kreatifitas>kreativitas
produktifitas>produktivitas efektifitas>efektivitas sensitifitas>sensitivitas validitas>validitas sekedar>sekadar hutang>utang himbau>imbau himbauan>imbauan
karir>karier komplit>komplet standarisasi>standardisasi tehnik>teknik tehnologi>teknologi teoritis>teoretis frekwensi>frekuensi konkrit>konkret
lembab>lembap nafas>napas silahkan>silakan antri>antre detil>detail diagnosa>diagnosis hipotesa>hipotesis metoda>metode prosentase>persentase
propinsi>provinsi sintesa>sintesis trampil>terampil ketrampilan>keterampilan faham>paham fikir>pikir berfikir>berpikir pemikiran>pemikiran beaya>biaya
kadaluarsa>kedaluwarsa kadaluwarsa>kedaluwarsa menyolok>mencolok pengrusakan>perusakan merubah>mengubah tranportasi>transportasi transportasi>transportasi
akte>akta azas>asas cidera>cedera dipungkiri>dimungkiri ekstrim>ekstrem gubug>gubuk hakekat>hakikat ilmiawan>ilmuwan jenasah>jenazah
kongkrit>konkret kualitet>kualitas legalisir>legalisasi mengkonsumsi>mengonsumsi mengkoordinasi>mengoordinasi mengkoordinasikan>mengoordinasikan
mengkritik>mengkritik memparkir>memarkir mempesona>memesona mentolerir>menoleransi milyar>miliar nampak>tampak nampaknya>tampaknya obat-obatan>obat-obatan
paska>pasca pasien>pasien penatalaksanaan>penatalaksanaan photo>foto relijius>religius rejeki>rezeki sertifikat>sertifikat
sistimatis>sistematis spesifikasi>spesifikasi survei>survei survey>survei tauladan>teladan telor>telur terlantar>telantar varietas>varietas walikota>wali kota
diantara>di antara diantaranya>di antaranya dimana>di mana kemana>ke mana darimana>dari mana disini>di sini disana>di sana disitu>di situ kesini>ke sini
kesana>ke sana dibawah>di bawah diatas>di atas didalam>di dalam diluar>di luar kedalam>ke dalam disamping>di samping didepan>di depan dibelakang>di belakang
diakhir>di akhir diawal>di awal ditengah>di tengah dirumah>di rumah disekolah>di sekolah dikampus>di kampus dikelas>di kelas diantar>diantar
`.matchAll(/(\S+)>(\S+(?: (?!\S*>)\S+)?)/g)].map(m => [m[1], m[2]]).filter(([a, b]) => a !== b);
const ABBR = /(?<![\p{L}.])(dkk|al|hlm|mis|dll|dsb|dst|vs|no|vol|ed|eds|cf|yth|sdr|bpk|prof|dr|drs|ir|st|jl|tel|tlp|kab|kec|kel|pt|cv|tbk|fig|eq|ref|etc|e\.g|i\.e|\p{L})\.\s+$/iu;
const cap = (s, like) => /^\p{Lu}/u.test(like) ? s[0].toUpperCase() + s.slice(1) : s;

function checkLocal(text) {
  const out = [];
  const add = (off, len, reps, msg) => out.push({ off, len, bad: text.substr(off, len), reps, msg });
  for (const [w, r] of BAKU) {
    const re = new RegExp(`(?<![\\p{L}\\-])${w.replace(/[.]/g, '\\.')}(?![\\p{L}\\-])`, 'giu');
    for (const m of text.matchAll(re)) add(m.index, m[0].length, [cap(r, m[0])], /^(di|ke|dari)/i.test(w) && / /.test(r) ? 'Kata depan "di/ke/dari" ditulis terpisah dari kata yang mengikutinya' : 'Bentuk baku menurut KBBI: ' + r);
  }
  for (const m of text.matchAll(/(?<![\p{L}])di (gunakan|lakukan|temukan|berikan|sebut|sebutkan|buat|tulis|ambil|pakai|terima|kembangkan|terapkan|analisis|jelaskan|bahas|lihat|ketahui|harapkan|peroleh|laporkan|ukur|uji|teliti|kaji|tentukan|pilih|identifikasi|klasifikasikan|kumpulkan|susun|nilai)(?![\p{L}])/giu))
    add(m.index, m[0].length, [m[0].replace(' ', '')], 'Awalan di- pada kata kerja pasif ditulis serangkai');
  for (const m of text.matchAll(/(?<![\p{L}-])(\p{L}{2,}) \1(?![\p{L}-])/giu))
    add(m.index, m[0].length, [m[1] + '-' + m[1], m[1]], 'Kata ulang memakai tanda hubung, atau ada kata ganda');
  for (const m of text.matchAll(/ {2,}/g)) add(m.index, m[0].length, [' '], 'Spasi ganda');
  for (const m of text.matchAll(/ +([,.;:!?])(?!\d)/g)) add(m.index, m[0].length, [m[1]], 'Tidak perlu spasi sebelum tanda baca');
  for (const m of text.matchAll(/([,;:])(?=\p{L})/gu)) add(m.index, 1, [m[1] + ' '], 'Perlu spasi setelah tanda baca');
  for (const m of text.matchAll(/([.!?]["”)]?\s+)(\p{Ll})/gu)) {
    if (ABBR.test(text.slice(0, m.index + m[1].length))) continue;
    add(m.index + m[1].length, 1, [m[2].toUpperCase()], 'Awal kalimat memakai huruf kapital');
  }
  return out.sort((a, b) => a.off - b.off).filter((x, i, a) => !i || x.off >= a[i - 1].off + a[i - 1].len);
}

async function checkLT(units, get, language) {
  const issues = [];
  let i = 0;
  while (i < units.length) {
    const starts = [];
    let text = '';
    while (i < units.length && (text.length + get(units[i]).length < 15000 || !starts.length)) {
      starts.push([units[i], text.length]);
      text += get(units[i]) + '\n\n';
      i++;
    }
    const r = await fetch('/api/grammar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, language }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
    for (const m of data.matches || []) {
      let k = starts.length - 1;
      while (k > 0 && starts[k][1] > m.offset) k--;
      const [u, s] = starts[k], off = m.offset - s;
      if (off + m.length > get(u).length) continue;
      issues.push({ u, off, len: m.length, bad: get(u).substr(off, m.length), reps: m.replacements.slice(0, 4).map(x => x.value), msg: m.message });
    }
    if (i < units.length) await new Promise(r => setTimeout(r, 3000));
  }
  return issues;
}

async function runGrammar() {
  const doc = cur();
  if (!doc || doc.status !== 'ready') return;
  const { sl, tl } = opt();
  const target = UI.lang === 'orig' ? 'orig' : 'tr';
  const get = u => (target === 'orig' ? doc.units[u] : trOf(doc)[u]) || '';
  const units = doc.units.map((_, u) => u).filter(u => get(u));
  const lang = target === 'orig' ? sl : tl;
  UI.gram = { target, issues: [], busy: true };
  if (!UI.edit) { UI.edit = true; renderDoc(); } else renderGram();
  try {
    UI.gram.issues = lang === 'id' || lang === 'ms'
      ? units.flatMap(u => checkLocal(get(u)).map(x => ({ ...x, u })))
      : await checkLT(units, get, lang === 'auto' ? 'auto' : lang === 'en' ? 'en-US' : lang);
    UI.gram.lang = lang;
  } catch (e) {
    UI.gram.error = e.message;
  }
  UI.gram.busy = false;
  renderGram();
}

function renderGram() {
  const p = $('#gramPanel'), g = UI.gram, doc = cur();
  p.hidden = !g || !doc;
  if (p.hidden) return;
  const which = g.target === 'orig' ? 'teks asli' : 'terjemahan';
  const engine = g.lang === 'id' || g.lang === 'ms' ? 'aturan KBBI/PUEBI' : 'LanguageTool';
  const get = u => (g.target === 'orig' ? doc.units[u] : trOf(doc)[u]) || '';
  let html = `<div class="gram-head"><b>${g.busy ? 'Memeriksa ' + which + '…' : g.error ? 'Pemeriksaan gagal: ' + esc(g.error) : g.issues.length ? `${g.issues.length} saran untuk ${which} (${engine})` : `Tidak ada kesalahan yang ditemukan di ${which} (${engine}).`}</b>`;
  if (g.issues.some(x => x.reps.length)) html += '<button class="btn sm ghost" data-g="all">Terapkan semua saran pertama</button>';
  html += '<button class="btn sm ghost" data-g="again">Periksa lagi</button><button class="btn sm ghost" data-g="close">Tutup</button></div>';
  html += g.issues.slice(0, 300).map((x, i) => {
    const t = get(x.u);
    const a = Math.max(0, x.off - 40), b = Math.min(t.length, x.off + x.len + 40);
    return `<div class="gi"><div class="gi-ctx" data-g="go" data-i="${i}">${a ? '…' : ''}${esc(t.slice(a, x.off))}<mark>${esc(t.substr(x.off, x.len)) || '&nbsp;'}</mark>${esc(t.slice(x.off + x.len, b))}${b < t.length ? '…' : ''}</div>
      <div class="gi-msg">${esc(x.msg)}</div>
      <div class="gi-act">${x.reps.map((r, k) => `<button class="rep" data-g="rep" data-i="${i}" data-k="${k}">${esc(r) || '(hapus)'}</button>`).join('')}<button class="link" data-g="skip" data-i="${i}">Abaikan</button></div></div>`;
  }).join('');
  if (g.issues.length > 300) html += `<p class="small muted">Menampilkan 300 saran pertama. Perbaiki lalu klik Periksa lagi.</p>`;
  p.innerHTML = html;
}

function applyIssue(i, k) {
  const g = UI.gram, doc = cur(), x = g.issues[i];
  const arr = g.target === 'orig' ? doc.units : trOf(doc);
  const text = arr[x.u];
  if (text == null || text.substr(x.off, x.len) !== x.bad) { g.issues.splice(i, 1); return; }
  const rep = x.reps[k];
  if (g.target === 'orig') keepOrig(doc, x.u);
  arr[x.u] = text.slice(0, x.off) + rep + text.slice(x.off + x.len);
  const delta = rep.length - x.len;
  for (const y of g.issues) if (y !== x && y.u === x.u && y.off > x.off) y.off += delta;
  g.issues.splice(i, 1);
  if (g.target === 'orig') { for (const t in doc.tr) doc.tr[t][x.u] = null; pumpTr(); }
  save(doc);
  updateUnits(doc, [x.u]);
}

$('#gramPanel').addEventListener('click', e => {
  const b = e.target.closest('[data-g]');
  if (!b) return;
  const g = UI.gram, i = +b.dataset.i;
  if (b.dataset.g === 'close') { UI.gram = null; renderGram(); return; }
  if (b.dataset.g === 'again') { runGrammar(); return; }
  if (b.dataset.g === 'skip') g.issues.splice(i, 1);
  if (b.dataset.g === 'rep') applyIssue(i, +b.dataset.k);
  if (b.dataset.g === 'all') { for (let j = g.issues.length - 1; j >= 0; j--) if (g.issues[j].reps.length) applyIssue(j, 0); }
  if (b.dataset.g === 'go') {
    const el = $(`#docContent .u[data-u="${g.issues[i].u}"][data-m="${g.target === 'orig' ? 'orig' : 'id'}"]`) || $(`#docContent .u[data-u="${g.issues[i].u}"]`);
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    return;
  }
  renderGram();
});

// ---------- Cari di dokumen ----------
function runFind(jump) {
  const c = $('#docContent');
  c.querySelectorAll('mark.f').forEach(m => m.replaceWith(m.textContent));
  c.normalize();
  UI.hits = []; UI.hit = -1;
  const q = $('#find').value.trim();
  if (q.length < 2 || UI.view !== 'read') { $('#findN').textContent = ''; return; }
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (!walker.currentNode.parentElement.closest('#trBar')) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const t = n.nodeValue;
    if (!t.match(re)) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of t.matchAll(re)) {
      frag.append(t.slice(last, m.index));
      const mk = document.createElement('mark');
      mk.className = 'f'; mk.textContent = m[0];
      frag.append(mk); UI.hits.push(mk);
      last = m.index + m[0].length;
    }
    frag.append(t.slice(last));
    n.replaceWith(frag);
  }
  $('#findN').textContent = UI.hits.length ? UI.hits.length + ' hasil' : '0 hasil';
  if (jump) stepFind(1);
}
function stepFind(d) {
  if (!UI.hits.length) return;
  UI.hits[UI.hit]?.classList.remove('cur');
  UI.hit = (UI.hit + d + UI.hits.length) % UI.hits.length;
  const m = UI.hits[UI.hit];
  m.classList.add('cur');
  m.scrollIntoView({ block: 'center' });
  $('#findN').textContent = `${UI.hit + 1}/${UI.hits.length}`;
}
let findTimer;
$('#find').addEventListener('input', () => { clearTimeout(findTimer); findTimer = setTimeout(() => runFind(true), 250); });
$('#find').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); } });
$('#findPrev').addEventListener('click', () => stepFind(-1));
$('#findNext').addEventListener('click', () => stepFind(1));

// ---------- Terjemahkan teks yang diblok ----------
let selText = '';
$('#docContent').addEventListener('mouseup', e => setTimeout(() => {
  if (e.target.closest('.ed:focus')) return;
  const s = getSelection(), t = s.toString().trim();
  const btn = $('#selBtn');
  if (t.length < 2 || t.length > 5000 || !s.rangeCount || !$('#docContent').contains(s.anchorNode)) { btn.hidden = true; return; }
  const r = s.getRangeAt(0).getBoundingClientRect();
  selText = t;
  selInfo = captureSelection(s);
  $('#selQuote').hidden = !selInfo;
  btn.style.left = Math.min(window.innerWidth - 220, r.right) + 'px';
  btn.style.top = Math.min(window.innerHeight - 40, r.bottom + 6) + 'px';
  btn.hidden = false;
}, 10));
$('#selBtn').addEventListener('mousedown', e => e.preventDefault());
$('#selQuote').addEventListener('click', () => quoteSelection());
$('#selTr').addEventListener('click', async () => {
  const btn = $('#selBtn'), pop = $('#trPop');
  pop.style.left = Math.min(window.innerWidth - 390, parseFloat(btn.style.left)) + 'px';
  pop.style.top = btn.style.top;
  btn.hidden = true;
  pop.hidden = false;
  pop.innerHTML = '<p class="muted">Menerjemahkan…</p>';
  try {
    const [t] = await requestTranslate([selText]);
    pop.innerHTML = `<p>${fmt(t)}</p><div class="foot"><button class="btn sm ghost" id="trCopy">Salin</button><button class="btn sm ghost" id="trClose">Tutup</button></div>`;
    $('#trCopy').onclick = () => navigator.clipboard.writeText(t).then(() => toast('Terjemahan disalin'));
  } catch (e) {
    pop.innerHTML = `<p class="err">${esc(e.message)}</p><div class="foot"><button class="btn sm ghost" id="trClose">Tutup</button></div>`;
  }
  $('#trClose').onclick = () => { pop.hidden = true; };
});
document.addEventListener('mousedown', e => {
  if (!e.target.closest('#trPop')) $('#trPop').hidden = true;
  if (!e.target.closest('#selBtn')) $('#selBtn').hidden = true;
  if (!e.target.closest('#exportPop') && !e.target.closest('#saveBtn')) $('#exportPop').hidden = true;
});

// ---------- Simpan file terjemahan ke Hasil_Terjemahan ----------
const suffix = () => '_' + opt().tl.toUpperCase();
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

function setRuns(ts, text) {
  // Teks ditaruh di potongan terpanjang agar format utamanya terbawa; potongan lain dikosongkan.
  if (!ts.length) return;
  let main = ts[0];
  for (const t of ts) if (t.textContent.length > main.textContent.length) main = t;
  for (const t of ts) t.textContent = t === main ? text : '';
  if (main.namespaceURI === NS.w || main.namespaceURI === NS.s) main.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
}

async function translateXmlParts(zip, names, specs, ui, { pre = {}, skip = new Set() } = {}) {
  const parsed = {}, units = [];
  for (const name of names) {
    const doc = pre[name] || parseXml(await zip.file(name).async('string'));
    parsed[name] = doc;
    for (const { ns, paraTag, textTag, skipTag } of specs) {
      for (const p of doc.getElementsByTagNameNS(ns, paraTag)) {
        if (skip.has(p)) continue;
        const ts = ownTexts(p, ns, paraTag, textTag, skipTag);
        const text = ts.map(t => t.textContent).join('');
        if (isText(text)) units.push({ ts, text });
      }
    }
  }
  if (units.length) {
    ui.status(`Menerjemahkan ${units.length} bagian…`);
    const tr = await translateAll(units.map(u => u.text));
    units.forEach((u, i) => setRuns(u.ts, tr[i]));
  }
  for (const name of names) {
    let xml = new XMLSerializer().serializeToString(parsed[name]);
    if (!xml.startsWith('<?xml')) xml = XML_DECL + xml;
    zip.file(name, xml);
  }
}

async function exportDocx(file, doc, ui) {
  const which = opt().which, arr = trOf(doc);
  const zip = await JSZip.loadAsync(file);
  const main = 'word/document.xml';
  const xdoc = parseXml(await zip.file(main).async('string'));
  const ps = [...xdoc.getElementsByTagNameNS(NS.w, 'p')];
  const covered = new Set();
  doc.units.forEach((orig, u) => {
    const p = ps[doc.loc?.[u]];
    const text = which === 'orig' ? orig : arr[u];
    if (!p || text == null) return;
    setRuns(ownTexts(p, NS.w, 'p', 't'), text);
    covered.add(p);
  });
  const names = which === 'orig' ? [main] : Object.keys(zip.files).filter(n => /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/.test(n));
  await translateXmlParts(zip, which === 'orig' ? [] : names, [{ ns: NS.w, paraTag: 'p', textTag: 't' }], ui, { pre: { [main]: xdoc }, skip: covered });
  if (which === 'orig') zip.file(main, XML_DECL + new XMLSerializer().serializeToString(xdoc).replace(/^<\?xml[^>]*\?>\s*/, ''));
  const name = baseName(file.name) + (which === 'orig' ? '_edit' : suffix()) + '.docx';
  return [{ name, blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }) }];
}

async function exportOoxml(file, ui, partRe, ns) {
  const zip = await JSZip.loadAsync(file);
  await translateXmlParts(zip, Object.keys(zip.files).filter(n => partRe.test(n)), [{ ns, paraTag: 'p', textTag: 't' }], ui);
  return [{ name: baseName(file.name) + suffix() + '.' + extOf(file.name), blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }) }];
}

async function exportXlsx(file, ui) {
  const zip = await JSZip.loadAsync(file);
  await translateXmlParts(zip, Object.keys(zip.files).filter(n => /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(n)), [
    { ns: NS.s, paraTag: 'si', textTag: 't', skipTag: 'rPh' },
    { ns: NS.s, paraTag: 'is', textTag: 't', skipTag: 'rPh' },
  ], ui);
  return [{ name: baseName(file.name) + suffix() + '.xlsx', blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }) }];
}

async function exportCsv(file, ui) {
  const parsed = Papa.parse(await readText(file), { skipEmptyLines: false });
  const rows = parsed.data, delimiter = parsed.meta.delimiter || ',';
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  const cells = [];
  rows.forEach((r, i) => r.forEach((v, j) => { if (isText(v)) cells.push([i, j]); }));
  ui.status(`Menyusun ${cells.length} sel…`);
  const tr = await translateAll(cells.map(([i, j]) => rows[i][j]));
  let out;
  if (opt().csvMode === 'replace') {
    out = rows.map(r => r.slice());
    cells.forEach(([i, j], k) => { out[i][j] = tr[k]; });
  } else {
    // Kolom terjemahan ditambahkan tepat di samping kolom yang berisi teks.
    const width = Math.max(...rows.map(r => r.length));
    const textCols = new Set(cells.filter(([i]) => i > 0).map(([, j]) => j));
    const trMap = new Map(cells.map(([i, j], k) => [i + ',' + j, tr[k]]));
    const label = ' (' + (LANG_NAME[opt().tl] || opt().tl) + ')';
    out = rows.map((r, i) => {
      const row = [];
      for (let j = 0; j < width; j++) {
        row.push(r[j] ?? '');
        if (textCols.has(j)) row.push(i === 0 ? (r[j] || 'Kolom ' + (j + 1)) + label : (trMap.get(i + ',' + j) ?? r[j] ?? ''));
      }
      return row;
    });
  }
  const csv = '﻿' + Papa.unparse(out, { delimiter, newline: '\r\n' });
  return [{ name: baseName(file.name) + suffix() + '.' + extOf(file.name), blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }) }];
}

async function exportText(file, ui, ext) {
  const lines = (await readText(file)).split(/\r?\n/);
  const idx = [];
  let fence = false;
  lines.forEach((l, i) => {
    if (/^\s*```/.test(l)) { fence = !fence; return; }
    if (fence || !/\p{L}/u.test(l)) return;
    if ((ext === 'srt' || ext === 'vtt') && (/-->/.test(l) || /^\s*\d+\s*$/.test(l) || /^WEBVTT/.test(l))) return;
    idx.push(i);
  });
  ui.status(`Menyusun ${idx.length} baris…`);
  const tr = await translateAll(idx.map(i => lines[i].trim()));
  const out = lines.slice();
  idx.forEach((i, k) => { out[i] = opt().bilingual ? lines[i] + '\r\n' + tr[k] : tr[k]; });
  return [{ name: baseName(file.name) + suffix() + '.' + ext, blob: new Blob(['﻿' + out.join('\r\n')], { type: 'text/plain;charset=utf-8' }) }];
}

async function exportHtml(file, ui) {
  const doc = new DOMParser().parseFromString(await readText(file), 'text/html');
  const nodes = [];
  const walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement?.closest('script,style,noscript,code,pre') || !/\p{L}/u.test(n.nodeValue) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  while (walker.nextNode()) nodes.push(walker.currentNode);
  if (doc.title && /\p{L}/u.test(doc.title)) nodes.push(doc.querySelector('title').firstChild);
  ui.status(`Menyusun ${nodes.length} potongan teks…`);
  const tr = await translateAll(nodes.map(n => n.nodeValue.replace(/\s+/g, ' ').trim()));
  nodes.forEach((n, i) => {
    const [, lead, , trail] = n.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/);
    n.nodeValue = lead + tr[i] + trail;
  });
  doc.documentElement.setAttribute('lang', opt().tl);
  const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  return [{ name: baseName(file.name) + suffix() + '.html', blob: new Blob([html], { type: 'text/html;charset=utf-8' }) }];
}

async function exportJson(file, ui) {
  const data = JSON.parse(await readText(file));
  const refs = [];
  (function walk(o) {
    if (Array.isArray(o)) o.forEach((v, i) => typeof v === 'string' ? isText(v) && refs.push([o, i]) : walk(v));
    else if (o && typeof o === 'object') for (const k of Object.keys(o)) typeof o[k] === 'string' ? isText(o[k]) && refs.push([o, k]) : walk(o[k]);
  })(data);
  const tr = await translateAll(refs.map(([o, k]) => o[k]));
  refs.forEach(([o, k], i) => { o[k] = tr[i]; });
  return [{ name: baseName(file.name) + suffix() + '.json', blob: new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }) }];
}

async function exportPages(doc, ui) {
  // PDF dan gambar: disusun ulang dari teks yang sudah dibaca (termasuk hasil edit).
  const arr = trOf(doc);
  const missing = doc.units.map((t, i) => (arr[i] == null ? i : -1)).filter(i => i >= 0);
  if (missing.length) {
    ui.status(`Menerjemahkan ${missing.length} bagian yang tersisa…`);
    (await translateAll(missing.map(i => doc.units[i]))).forEach((t, k) => { arr[missing[k]] = t; });
    save(doc);
  }
  const { bilingual, pdfOut } = opt();
  const blocks = [{ type: 'title', text: baseName(doc.name) + ' (terjemahan ' + (LANG_NAME[opt().tl] || opt().tl) + ')' }];
  for (const s of doc.sections) {
    if (doc.sections.length > 1 && s.title) blocks.push({ type: 'h', text: s.title });
    for (const b of s.blocks) {
      if (b.u == null) continue;
      if (bilingual) blocks.push({ type: 'orig', text: doc.units[b.u] });
      blocks.push({ type: b.t === 'h' ? 'sub' : 'p', text: arr[b.u] });
    }
  }
  const outs = [], name = baseName(doc.name) + suffix();
  if (pdfOut !== 'pdf') outs.push({ name: name + '.docx', blob: await buildDocx(blocks) });
  if (pdfOut !== 'docx') outs.push({ name: name + '.pdf', blob: buildPdf(blocks) });
  return outs;
}

async function exportDoc() {
  const doc = cur();
  if (!doc || doc.status !== 'ready') return;
  const msg = $('#exMsg'), go = $('#exGo');
  const ui = { status: t => { msg.textContent = t; } };
  go.disabled = true;
  try {
    const tl = opt().tl, arr = trOf(doc);
    knownTr = new Map(doc.units.map((u, i) => [u, arr[i]]).filter(([, v]) => v != null));
    ui.status('Menyusun file…');
    const { blob } = await DB.get('files', doc.id);
    const file = new File([blob], doc.name);
    const ext = doc.ext;
    let outs;
    if (ext === 'pdf' || IMG.test(doc.name)) outs = await exportPages(doc, ui);
    else if (ext === 'docx') outs = await exportDocx(file, doc, ui);
    else if (ext === 'pptx') outs = await exportOoxml(file, ui, /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+|diagrams\/data\d+)\.xml$/, NS.a);
    else if (ext === 'xlsx') outs = await exportXlsx(file, ui);
    else if (ext === 'csv' || ext === 'tsv') outs = await exportCsv(file, ui);
    else if (['txt', 'md', 'srt', 'vtt'].includes(ext)) outs = await exportText(file, ui, ext);
    else if (ext === 'html' || ext === 'htm') outs = await exportHtml(file, ui);
    else if (ext === 'json') outs = await exportJson(file, ui);
    const saved = [];
    for (const o of outs) {
      const r = await fetch('/api/simpan?name=' + encodeURIComponent(o.name), { method: 'POST', body: o.blob });
      if (!r.ok) throw new Error('Gagal menyimpan ' + o.name);
      saved.push((await r.json()).file);
    }
    $('#exportPop').hidden = true;
    msg.textContent = '';
    toast('Tersimpan di Hasil_Terjemahan: ' + saved.join(', '), 'Buka folder', () => fetch('/api/buka-folder?folder=hasil'));
  } catch (e) {
    console.error(e);
    ui.status('Gagal: ' + e.message);
  } finally {
    knownTr = new Map();
    go.disabled = false;
  }
}

// ---------- Pembuat Word (.docx) dan PDF ----------
const xesc = s => String(s ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function buildDocx(blocks) {
  const run = (props, t) => `<w:r>${props ? '<w:rPr>' + props + '</w:rPr>' : ''}<w:t xml:space="preserve">${xesc(t)}</w:t></w:r>`;
  const para = b => {
    if (b.type === 'title') return `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>${run('', b.text)}</w:p>`;
    if (b.type === 'h') return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>${run('', b.text)}</w:p>`;
    if (b.type === 'sub') return `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>${run('', b.text)}</w:p>`;
    if (b.type === 'orig') return `<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>${run('<w:i/><w:color w:val="6B7280"/><w:sz w:val="20"/>', b.text)}</w:p>`;
    return `<w:p>${run('', b.text)}</w:p>`;
  };
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const heading = (id, name, size, color) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:jc w:val="left"/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr></w:style>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', XML_DECL + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  zip.file('_rels/.rels', XML_DECL + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', XML_DECL + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('word/styles.xml', XML_DECL + `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="left"/><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>${heading('Heading2', 'heading 2', 26, '1F4E79')}${heading('Heading3', 'heading 3', 23, '24292F')}</w:styles>`);
  zip.file('word/document.xml', XML_DECL + `<w:document ${W}><w:body>${blocks.map(para).join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// Huruf standar PDF hanya mendukung huruf Latin; karakter lain diganti agar tidak rusak.
const latin = s => String(s).replace(/[“”„]/g, '"').replace(/[‘’‚]/g, "'").replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[•·]/g, '-')
  .normalize('NFKC').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');

function buildPdf(blocks) {
  const doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  const M = 56, W = doc.internal.pageSize.getWidth() - 2 * M, H = doc.internal.pageSize.getHeight();
  let y = M;
  const style = { title: ['bold', 17, 30, 20], h: ['bold', 13, 22, 31], sub: ['bold', 11.5, 18, 20], orig: ['italic', 9.5, 14, 110], p: ['normal', 11, 16, 20] };
  blocks.forEach((b, i) => {
    const [font, size, lead, gray] = style[b.type];
    if (b.type === 'h' && i > 1) { doc.addPage(); y = M; }
    doc.setFont('helvetica', font); doc.setFontSize(size);
    if (b.type === 'h') doc.setTextColor(31, 78, 121); else doc.setTextColor(gray, gray, gray);
    for (const line of doc.splitTextToSize(latin(b.text), W)) {
      if (y + lead > H - M) { doc.addPage(); y = M; }
      doc.text(line, M, y + size);
      y += lead;
    }
    y += b.type === 'orig' ? 2 : 8;
  });
  return doc.output('blob');
}

// ---------- Notifikasi ----------
function banner(text) {
  const b = $('#banner');
  b.innerHTML = `<span>${esc(text)}</span><button class="link" onclick="location.reload()">Muat ulang</button>`;
  b.hidden = false;
}
let toastTimer;
function toast(text, action, fn) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(text)}</span>${action ? `<button class="link">${esc(action)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = fn;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 7000);
}

// ---------- Tombol & seret-lepas ----------
const drop = $('#drop');
drop.addEventListener('click', e => { if (e.target.id !== 'file') $('#file').click(); });
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') $('#file').click(); });
$('#file').addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
let dragDepth = 0;
document.addEventListener('dragenter', e => { if (e.dataTransfer?.types.includes('Files')) { dragDepth++; document.body.classList.add('dragging'); } });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  dragDepth = 0; document.body.classList.remove('dragging');
  if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]);
});

$('#lib').addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) { deleteDoc(del.dataset.del); return; }
  const li = e.target.closest('li[data-id]');
  if (li) select(li.dataset.id);
});
$('#viewSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) { UI.view = b.dataset.view; renderDoc(); } });
$('#langSeg').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  UI.lang = b.dataset.lang; LS.set('lang', UI.lang);
  if (UI.gram && (UI.gram.target === 'orig') !== (UI.lang === 'orig')) UI.gram = null;
  renderDoc();
});
$('#editBtn').addEventListener('click', () => { UI.edit = !UI.edit; renderDoc(); });
$('#gramBtn').addEventListener('click', runGrammar);
$('#docContent').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const doc = cur();
  if (b.dataset.act === 'restore') {
    const u = +b.dataset.u;
    doc.units[u] = doc.orig0[u];
    delete doc.orig0[u];
    for (const k in doc.tr) doc.tr[k][u] = null;
    save(doc); updateUnits(doc, [u]); pumpTr();
    return;
  }
  if (b.dataset.act === 'retry') { doc.trError = null; renderDoc(); pumpTr(); }
  if (b.dataset.act === 'retranslate' && confirm('Terjemahkan ulang seluruh dokumen? Hasil edit pada terjemahan akan hilang.')) {
    doc.tr[opt().tl] = null; doc.trError = null; save(doc); renderDoc(); renderLib(); pumpTr();
  }
});
$('#saveBtn').addEventListener('click', () => {
  const doc = cur(), pop = $('#exportPop');
  if (!doc || doc.status !== 'ready') return;
  const pages = doc.ext === 'pdf' || IMG.test(doc.name);
  $('#exPdfRow').hidden = !pages;
  $('#exCsvRow').hidden = !['csv', 'tsv'].includes(doc.ext);
  $('#exWhichRow').hidden = doc.ext !== 'docx';
  $('#exBiRow').hidden = !(pages || ['txt', 'md', 'srt', 'vtt'].includes(doc.ext));
  $('#exMsg').textContent = '';
  pop.hidden = !pop.hidden;
});
$('#exGo').addEventListener('click', exportDoc);
$('#exCancel').addEventListener('click', () => { $('#exportPop').hidden = true; });
async function deleteDoc(id) {
  const doc = docs.get(id);
  if (!doc) return;
  const nq = [...quotes.values()].filter(q => q.docId === id).length;
  if (!confirm(`Hapus "${doc.name}" dari aplikasi?${nq ? `\n${nq} kutipan dari dokumen ini tetap tersimpan di Laporan kutipan.` : ''}\nFile di folder Masukan dan Hasil_Terjemahan tidak ikut terhapus.`)) return;
  docs.delete(id);
  await DB.del('docs', id);
  await DB.del('files', id);
  if (pdfCache.id === id) pdfCache = { id: null, pdf: null };
  if (UI.sel === id) {
    const next = [...docs.values()].sort((a, b) => b.added - a.added)[0];
    UI.sel = next ? next.id : null;
    LS.set('sel', UI.sel || '');
  }
  renderLib(); renderDoc();
  toast('Dokumen dihapus dari aplikasi');
}
$('#delBtn').addEventListener('click', () => { if (cur()) deleteDoc(cur().id); });
$('#quotesBtn').addEventListener('click', () => { if (UI.page === 'quotes') { UI.page = 'doc'; renderLib(); renderDoc(); } else showQuotes(); });
$('#openIn').addEventListener('click', () => fetch('/api/buka-folder?folder=masukan'));
$('#openOut').addEventListener('click', () => fetch('/api/buka-folder?folder=hasil'));
$('#fromFolder').addEventListener('click', async () => {
  const { files } = await (await fetch('/api/masukan')).json();
  if (!files.length) { toast('Folder Masukan kosong. Taruh file di sana dulu.', 'Buka folder', () => fetch('/api/buka-folder?folder=masukan')); return; }
  const loaded = [];
  for (const name of files) loaded.push(new File([await (await fetch('/api/masukan/file?name=' + encodeURIComponent(name))).blob()], name));
  addFiles(loaded);
});
document.addEventListener('keydown', e => {
  if (e.key === '/' && !e.target.closest('input,select,textarea,[contenteditable]')) { e.preventDefault(); $('#find').focus(); }
  if (e.key === 'Escape') { $('#trPop').hidden = true; $('#selBtn').hidden = true; $('#exportPop').hidden = true; }
});

// Pengaturan yang diingat di peramban ini
for (const id of ['sl', 'tl', 'pdfOut', 'csvMode', 'bilingual', 'exWhich', 'syncChk']) {
  const el = $('#' + id);
  const v = LS.get(id, null);
  if (v !== null) el.type === 'checkbox' ? (el.checked = v === '1') : (el.value = v);
  el.addEventListener('change', () => {
    LS.set(id, el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value);
    if (id === 'tl') { UI.gram = null; renderLib(); renderDoc(); pumpTr(); }
  });
}

// ---------- Sistem Lisensi Terjemah-IN ----------
let terjemahUser = null;
try { terjemahUser = JSON.parse(localStorage.getItem('terjemahin-user') || 'null'); } catch (e) { terjemahUser = null; }

let terjemahLicense = null;
try {
  if (new URLSearchParams(window.location.search).has('reset') || new URLSearchParams(window.location.search).has('ganti')) {
    localStorage.removeItem('terjemahin-license');
    localStorage.removeItem('terjemahin-user');
  } else {
    terjemahLicense = JSON.parse(localStorage.getItem('terjemahin-license') || 'null');
  }
} catch (e) { terjemahLicense = null; }

function verifyTerjemahLic() {
  if (!window.TerjemahLicense) return { active: false, message: 'Modul lisensi belum siap.' };
  return window.TerjemahLicense.checkLicenseStatus(terjemahLicense);
}

function applyTerjemahLicUI() {
  const licStatus = verifyTerjemahLic();
  const hasValidLic = licStatus && licStatus.active;
  const isUnlocked = !!(terjemahUser && hasValidLic);

  const badge = $('#licBadge');
  const badgeText = $('#licBadgeText');

  if (badge) {
    if (isUnlocked) {
      badge.style.display = 'inline-flex';
      if (badgeText) {
        if (licStatus.isMaster) {
          badgeText.textContent = '👑 Master VIP (Permanen)';
        } else if (licStatus.remainingDays >= 3000) {
          badgeText.textContent = '🛡️ Lisensi Lifetime';
        } else {
          badgeText.textContent = `🛡️ Lisensi: ${licStatus.remainingDays} hari tersisa`;
        }
      }
    } else {
      badge.style.display = 'none';
      if (terjemahUser && !hasValidLic && $('#licErr')) {
        $('#licErr').style.display = 'block';
        $('#licErr').textContent = licStatus.expired 
          ? 'Masa berlaku lisensi Terjemah-IN Anda telah habis. Silakan hubungi pemilik untuk perpanjangan.' 
          : 'Kunci lisensi Terjemah-IN belum aktif.';
      }
    }
  }
}

function openLicModal() {
  const modal = $('#licModal');
  if (modal) {
    modal.style.display = 'flex';
    if (terjemahUser) {
      if ($('#licName') && !$('#licName').value) $('#licName').value = terjemahUser.nama || '';
      if ($('#licEmail') && !$('#licEmail').value) $('#licEmail').value = terjemahUser.email || '';
    }
  }
}

function closeLicModal() {
  const modal = $('#licModal');
  if (modal) modal.style.display = 'none';
}

function showLanding() {
  const landing = $('#transLanding');
  const ws = $('#transWorkspace');
  if (landing) landing.style.display = 'block';
  if (ws) ws.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showWorkspace() {
  const landing = $('#transLanding');
  const ws = $('#transWorkspace');
  if (landing) landing.style.display = 'none';
  if (ws) ws.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleStartTerjemah() {
  const licStatus = verifyTerjemahLic();
  const hasValidLic = licStatus && licStatus.active;
  const isUnlocked = !!(terjemahUser && hasValidLic);
  if (isUnlocked) {
    showWorkspace();
  } else {
    openLicModal();
  }
}

window.showLanding = showLanding;
window.showWorkspace = showWorkspace;
window.openLicModal = openLicModal;
window.closeLicModal = closeLicModal;
window.handleStartTerjemah = handleStartTerjemah;

const btnDeactLic = $('#btnDeactLic');
if (btnDeactLic) {
  btnDeactLic.addEventListener('click', () => {
    if (confirm('Apakah Anda ingin mengganti kunci lisensi Terjemah-IN dengan kunci lain?')) {
      terjemahLicense = null;
      localStorage.removeItem('terjemahin-license');
      applyTerjemahLicUI();
      showLanding();
      openLicModal();
      const licKeyInput = $('#licKey');
      if (licKeyInput) {
        licKeyInput.value = '';
        licKeyInput.focus();
      }
    }
  });
}

const licForm = $('#licForm');
if (licForm) {
  licForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nama = $('#licName') ? $('#licName').value.trim() : '';
    const email = $('#licEmail') ? $('#licEmail').value.trim().toLowerCase() : '';
    const key = $('#licKey') ? $('#licKey').value.trim() : '';
    const errEl = $('#licErr');

    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

    if (nama.length < 3) {
      if (errEl) { errEl.textContent = 'Isi nama lengkap (minimal 3 huruf).'; errEl.style.display = 'block'; }
      $('#licName')?.focus();
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (errEl) { errEl.textContent = 'Masukkan alamat email yang valid.'; errEl.style.display = 'block'; }
      $('#licEmail')?.focus();
      return;
    }

    if (!key) {
      if (errEl) { errEl.textContent = 'Kunci lisensi wajib diisi.'; errEl.style.display = 'block'; }
      $('#licKey')?.focus();
      return;
    }

    if (!window.TerjemahLicense) {
      if (errEl) { errEl.textContent = 'Modul lisensi sedang memuat. Coba lagi.'; errEl.style.display = 'block'; }
      return;
    }

    const valResult = window.TerjemahLicense.validateLicense(key);
    if (!valResult.valid) {
      if (errEl) { errEl.textContent = valResult.message || 'Kunci lisensi tidak valid.'; errEl.style.display = 'block'; }
      $('#licKey')?.focus();
      return;
    }

    terjemahLicense = {
      key: valResult.key,
      activatedAt: new Date().toISOString(),
      label: valResult.label,
      days: valResult.days,
      durationCode: valResult.durationCode,
      isMaster: !!valResult.isMaster
    };
    localStorage.setItem('terjemahin-license', JSON.stringify(terjemahLicense));

    terjemahUser = { nama, email, loginAt: new Date().toISOString() };
    localStorage.setItem('terjemahin-user', JSON.stringify(terjemahUser));

    applyTerjemahLicUI();
    closeLicModal();
    showWorkspace();
    toast('Lisensi Terjemah-IN berhasil diaktifkan!');
  });
}

// ---------- Mulai ----------
(async () => {
  applyTerjemahLicUI();
  for (const d of await DB.all('docs')) {
    docs.set(d.id, d);
    if (d.status === 'reading') readQueue.push(d.id);
    d.trError = null;
  }
  if (!docs.has(UI.sel)) UI.sel = null;
  fetch('/api/versi').then(r => { if (!r.ok) throw 0; }).catch(() => banner('Server aplikasi masih versi lama atau tidak berjalan. Tutup jendela hitam Penerjemah.bat, lalu jalankan Penerjemah.bat lagi.'));
  await loadQuotes();
  renderLib();
  renderDoc();
  pumpRead();
  pumpTr();
  resolveAllMeta();
})();

