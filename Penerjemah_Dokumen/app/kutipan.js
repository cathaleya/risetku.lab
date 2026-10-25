// Kutipan & referensi APA 7: data bibliografi dari DOI/judul (Crossref) atau metadata file,
// kutipan dari teks yang diblok, laporan kutipan yang bisa diunduh (Word/CSV).
const quotes = new Map();

// ---------- Metadata bibliografi ----------
const DOI_RE = /\b(10\.\d{4,9}\/[^\s"<>]+)/i;
const cleanDoi = d => d ? d.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').replace(/[.,;:)\]]+$/, '').trim() : '';
const stripTags = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function crossref(params) {
  const r = await fetch('/api/crossref?' + new URLSearchParams(params));
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Crossref: HTTP ' + r.status);
  return d.message;
}

const CR_TYPE = {
  'journal-article': 'journal', book: 'book', monograph: 'book', 'edited-book': 'book', 'reference-book': 'book',
  'book-chapter': 'chapter', 'book-section': 'chapter', 'book-part': 'chapter', 'proceedings-article': 'proceedings',
  report: 'report', dissertation: 'thesis', 'posted-content': 'report',
};
function fromCrossref(m) {
  const person = a => a.family ? { family: a.family, given: a.given || '' } : { family: a.name || '', given: '' };
  const dp = (m.issued || m['published-print'] || m['published-online'] || m.created || {})['date-parts']?.[0];
  return {
    type: CR_TYPE[m.type] || 'journal',
    authors: (m.author || []).map(person), editors: (m.editor || []).map(person),
    year: dp && dp[0] ? String(dp[0]) : '', title: stripTags((m.title || [])[0]),
    container: stripTags((m['container-title'] || [])[0]), volume: m.volume || '', issue: m.issue || '',
    pages: m.page || '', publisher: m.publisher || '', doi: m.DOI || '', url: '',
  };
}

function parseNames(str) {
  str = String(str || '').trim();
  if (!str) return [];
  const parts = str.includes(';') ? str.split(';') : str.split(/\s*(?:,|&|\band\b|\bdan\b)\s*/i);
  return parts.map(s => s.trim()).filter(Boolean).map(s => {
    if (s.includes(',')) { const [f, g] = s.split(','); return { family: f.trim(), given: (g || '').trim() }; }
    const w = s.split(/\s+/);
    return w.length > 1 ? { family: w.pop(), given: w.join(' ') } : { family: s, given: '' };
  });
}

function similar(a, b) {
  const tok = s => new Set(String(s).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 2));
  const A = tok(a), B = tok(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.max(A.size, B.size);
}

async function readFileMeta(doc) {
  const rec = await DB.get('files', doc.id);
  if (!rec) return {};
  const junk = t => !t || t.length < 8 || /\.(docx?|pdf|tex|indd)$|^microsoft word|^untitled|^document\d*$/i.test(t);
  if (doc.ext === 'pdf') {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await rec.blob.arrayBuffer()) }).promise;
    const { info = {}, metadata } = await pdf.getMetadata();
    const get = k => { try { const v = metadata?.get(k); return Array.isArray(v) ? v.join('; ') : v || ''; } catch (e) { return ''; } };
    const title = get('dc:title') || info.Title || '';
    const date = get('prism:coverdate') || get('prism:publicationdate') || info.CreationDate || '';
    return {
      title: junk(title) ? '' : title, author: get('dc:creator') || info.Author || '',
      year: (String(date).match(/(19|20)\d\d/) || [''])[0], doi: get('prism:doi') || get('pdfx:doi') || '',
      container: get('prism:publicationname'), volume: get('prism:volume'), issue: get('prism:number'),
    };
  }
  if (doc.ext === 'docx') {
    const zip = await JSZip.loadAsync(rec.blob);
    const core = zip.file('docProps/core.xml');
    if (!core) return {};
    const x = parseXml(await core.async('string'));
    const tag = n => x.getElementsByTagName(n)[0]?.textContent || '';
    const title = tag('dc:title');
    return { title: junk(title) ? '' : title, author: tag('dc:creator'), year: (tag('dcterms:created').match(/(19|20)\d\d/) || [''])[0] };
  }
  return {};
}

const resolving = new Map();
function resolveMeta(doc, force) {
  if (!doc || doc.status !== 'ready' || (doc.meta && !force)) return Promise.resolve();
  if (!resolving.has(doc.id)) resolving.set(doc.id, doResolve(doc).finally(() => resolving.delete(doc.id)));
  return resolving.get(doc.id);
}
async function doResolve(doc) {
  let fm = {};
  try { fm = await readFileMeta(doc); } catch (e) { console.warn(e); }
  const early = doc.sections.slice(0, 3).flatMap(s => s.blocks).map(b => (b.u != null ? doc.units[b.u] : '')).join(' ');
  const doi = cleanDoi(fm.doi || (early.match(DOI_RE) || [])[1]);
  const guess = fm.title || doc.titleGuess || '';
  let meta = null, source = '';
  if (doi) {
    try { meta = fromCrossref(await crossref({ doi })); source = 'Crossref, lewat DOI'; } catch (e) { console.warn(e); }
  }
  if (!meta && guess.length > 12) {
    try {
      const items = (await crossref({ title: guess })).items || [];
      const hit = items.find(it => similar(guess, (it.title || [])[0] || '') >= 0.8);
      if (hit) { meta = fromCrossref(hit); source = 'Crossref, lewat judul (periksa)'; }
    } catch (e) { console.warn(e); }
  }
  if (!meta) {
    meta = {
      type: 'journal', authors: parseNames(fm.author), editors: [], year: fm.year || '', title: guess || baseName(doc.name),
      container: fm.container || '', volume: fm.volume || '', issue: fm.issue || '', pages: '', publisher: '', doi, url: '',
    };
    source = 'Dari isi file, belum lengkap (periksa)';
  }
  doc.meta = meta;
  doc.metaSource = source;
  save(doc);
  if (UI.sel === doc.id) renderRefLine(doc);
}
async function resolveAllMeta() {
  for (const d of [...docs.values()]) if (d.status === 'ready' && !d.meta) await resolveMeta(d);
}

// ---------- Format APA 7 ----------
const KEEP = new Set('indonesia indonesian english asia asian europe european africa african america american australia covid-19 covid internet google facebook youtube twitter islam islamic muslim java javanese jakarta bali sumatra malaysia china chinese japan japanese korea korean india indian arab arabic unesco oecd oer'.split(' '));
// APA: huruf kapital di awal judul dan awal anak judul (setelah titik dua, tanda tanya, tanda seru, atau tanda pisah)
const capSub = t => t.replace(/^(\s*["'“‘(]?)(\p{Ll})/u, (_, a, b) => a + b.toUpperCase()).replace(/([:?!—]\s+["'“‘(]?)(\p{Ll})/gu, (_, a, b) => a + b.toUpperCase());
function sentenceCase(t) {
  const words = t.split(/(\s+)/);
  const caps = words.filter(w => /^\p{L}{4,}/u.test(w));
  if (!caps.length || caps.filter(w => /^\p{Lu}/u.test(w)).length / caps.length < 0.6) return capSub(t);   // sudah sentence case
  let start = true;
  return words.map(w => {
    if (/^\s+$/.test(w)) return w;
    const bare = w.replace(/[^\p{L}\p{N}-]/gu, '');
    let out = w;
    if (!start && !/\p{Lu}.*\p{Lu}/u.test(bare) && !/\d/.test(bare) && !KEEP.has(bare.toLowerCase())) out = w.toLowerCase();
    else if (start) out = w[0].toUpperCase() + w.slice(1);
    start = /[:?!.—]$/.test(w);
    return out;
  }).join('').replace(/^./, c => c.toUpperCase());
}
const initials = g => String(g || '').split(/\s+/).filter(Boolean).map(w => w.split('-').filter(Boolean).map(p => p[0].toUpperCase() + '.').join('-')).join(' ');
const apaName = a => a.given ? `${a.family}, ${initials(a.given)}` : a.family;
function authorsAPA(list) {
  const n = list.map(apaName).filter(Boolean);
  if (n.length <= 1) return n[0] || '';
  if (n.length === 2) return `${n[0]}, & ${n[1]}`;
  if (n.length <= 20) return n.slice(0, -1).join(', ') + ', & ' + n[n.length - 1];
  return n.slice(0, 19).join(', ') + ', . . . ' + n[n.length - 1];
}
function editorsAPA(list) {
  const n = list.map(a => (a.given ? initials(a.given) + ' ' : '') + a.family).filter(Boolean);
  if (n.length <= 2) return n.join(' & ');
  return n.slice(0, -1).join(', ') + ', & ' + n[n.length - 1];
}
const endDot = s => /[.?!]$/.test(s) ? s : s + '.';

function formatAPA(m) {
  const T = m.title ? sentenceCase(stripTags(m.title)) : '[Tanpa judul]';
  const italic = ['book', 'report', 'thesis', 'web'].includes(m.type);
  let titleHTML = italic ? `<i>${esc(T)}</i>` : esc(T);
  if (m.type === 'thesis') titleHTML += ` [${esc(m.issue || 'Thesis')}${m.publisher ? ', ' + esc(m.publisher) : ''}]`;
  const titlePart = /[.?!]$/.test(T) && m.type !== 'thesis' ? titleHTML : titleHTML + '.';
  const au = authorsAPA(m.authors || []);
  const yr = `(${esc(m.year || 'n.d.')}).`;
  const pages = m.pages ? esc(String(m.pages).replace(/\s*[-‐‑–—]+\s*/g, '–')) : '';
  const parts = au ? [esc(endDot(au)), yr, titlePart] : [titlePart, yr];
  if (m.type === 'journal') {
    if (m.container) parts.push(`<i>${esc(m.container)}</i>${m.volume ? `, <i>${esc(m.volume)}</i>` : ''}${m.issue ? `(${esc(m.issue)})` : ''}${pages ? ', ' + pages : ''}.`);
  } else if (m.type === 'chapter' || m.type === 'proceedings') {
    if (m.container) {
      const eds = editorsAPA(m.editors || []);
      parts.push(`In ${eds ? esc(eds) + ` (${m.editors.length > 1 ? 'Eds.' : 'Ed.'}), ` : ''}<i>${esc(m.container)}</i>${pages ? ` (pp. ${pages})` : ''}.`);
    }
    if (m.publisher) parts.push(esc(endDot(m.publisher)));
  } else if (m.type !== 'thesis' && m.publisher) {
    parts.push(esc(endDot(m.publisher)));
  }
  const link = m.doi ? 'https://doi.org/' + esc(cleanDoi(m.doi)) : esc(m.url || '');
  if (link) parts.push(link);
  return parts.join(' ');
}

function citeNames(m) {
  const a = (m.authors || []).filter(x => x.family);
  if (!a.length) { const t = sentenceCase(stripTags(m.title || 'Tanpa judul')).split(/\s+/).slice(0, 4).join(' '); return ['journal', 'chapter', 'proceedings'].includes(m.type) ? `"${t}"` : t; }
  if (a.length === 1) return a[0].family;
  if (a.length === 2) return `${a[0].family} & ${a[1].family}`;
  return `${a[0].family} et al.`;
}
function citeAPA(m, page) {
  const names = citeNames(m), year = m.year || 'n.d.', p = page ? `, p. ${page}` : '';
  return { paren: `(${names}, ${year}${p})`, narr: `${names.replace(' & ', ' and ')} (${year})${page ? ` ... (p. ${page})` : ''}` };
}

// Nomor halaman cetak: bila rentang halaman jurnal cocok dengan jumlah halaman PDF.
function pageFor(doc, meta, pdfPage) {
  if (!pdfPage) return '';
  const total = doc ? doc.sections.filter(s => s.page || /^Halaman \d+/.test(s.title)).length : 0;
  const m = String(meta.pages || '').match(/^(\d+)\s*[-‐‑–—]+\s*(\d+)$/);
  if (m && total) {
    const span = +m[2] - +m[1] + 1;
    if (span === total) return String(+m[1] + pdfPage - 1);
    if (span === total - 1 && pdfPage > 1) return String(+m[1] + pdfPage - 2);   // halaman sampul dari penerbit
  }
  return String(pdfPage);
}

// ---------- Baris referensi di kepala dokumen ----------
function renderRefLine(doc) {
  const el = $('#docRef');
  if (!el) return;
  if (doc.status !== 'ready') { el.innerHTML = ''; return; }
  if (!doc.meta) { el.innerHTML = '<span class="badge">APA 7</span> <span class="muted">Mencari data referensi…</span>'; return; }
  el.innerHTML = `<span class="badge">APA 7</span> <span class="ref">${formatAPA(doc.meta)}</span>
    <span class="ref-src">${esc(doc.metaSource || '')}</span>
    <button class="link" data-ref="copy">Salin</button> <button class="link" data-ref="edit">Edit referensi</button>`;
}
$('#docRef').addEventListener('click', e => {
  const b = e.target.closest('[data-ref]'), doc = cur();
  if (!b || !doc?.meta) return;
  if (b.dataset.ref === 'copy') copyRich(formatAPA(doc.meta), 'Referensi disalin');
  if (b.dataset.ref === 'edit') openRefModal(doc.meta, meta => applyMeta(doc.id, meta));
});

function applyMeta(docId, meta, fromQuotes) {
  const doc = docs.get(docId);
  if (doc) { doc.meta = meta; doc.metaSource = 'Diedit'; save(doc); if (UI.sel === docId) renderRefLine(doc); }
  for (const q of quotes.values()) if (q.docId === docId) { refreshQuote(q, doc, meta); DB.put('quotes', q); }
  if (UI.page === 'quotes') renderQuotes();
}

// ---------- Membuat kutipan dari teks yang diblok ----------
let selInfo = null;
function captureSelection(s) {
  const c = $('#docContent'), range = s.getRangeAt(0), doc = cur();
  if (!doc || UI.view !== 'read') return null;
  const anchor = (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
  const aU = anchor.closest('.u');
  const mode = aU?.dataset.m || (UI.lang === 'orig' ? 'orig' : 'id');
  const units = [...new Set([...c.querySelectorAll(`.u[data-m="${mode}"]`)].filter(el => range.intersectsNode(el)).map(el => +el.dataset.u))];
  const secs = [...c.querySelectorAll('.sec')];
  const sec = doc.sections[secs.indexOf(anchor.closest('.sec'))];
  const pdfPage = sec ? sec.page || +(sec.title.match(/^Halaman (\d+)/) || [])[1] || 0 : 0;
  const text = s.toString().replace(/↺/g, '').replace(/\s+/g, ' ').trim();
  return { docId: doc.id, mode, units, pdfPage, text };
}

function refreshQuote(q, doc, meta) {
  q.meta = JSON.parse(JSON.stringify(meta || doc?.meta || q.meta || { type: 'journal', authors: [], title: q.docName }));
  q.ref = formatAPA(q.meta);
  q.page = pageFor(doc, q.meta, q.pdfPage);
  q.cite = citeAPA(q.meta, q.page);
}

async function quoteSelection() {
  const info = selInfo;
  $('#selBtn').hidden = true;
  if (!info || !info.text) return;
  const doc = docs.get(info.docId);
  if (!doc.meta) { toast('Mencari data referensi…'); await resolveMeta(doc); }
  const q = {
    id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    docId: doc.id, docName: doc.name, text: info.text, lang: info.mode === 'orig' ? 'orig' : 'tr', tl: opt().tl,
    origText: info.mode === 'orig' ? '' : info.units.map(u => doc.units[u]).join('\n'),
    pdfPage: info.pdfPage, added: Date.now(), note: '',
  };
  refreshQuote(q, doc);
  quotes.set(q.id, q);
  await DB.put('quotes', q);
  updateQuotesBtn();
  getSelection().removeAllRanges();
  toast(`Kutipan disimpan ${q.cite.paren}`, 'Lihat laporan', showQuotes);
}

// ---------- Laporan kutipan ----------
async function loadQuotes() {
  for (const q of await DB.all('quotes')) quotes.set(q.id, q);
  updateQuotesBtn();
}
function updateQuotesBtn() { $('#quotesN').textContent = quotes.size ? `(${quotes.size})` : ''; }
function showQuotes() { UI.page = 'quotes'; renderLib(); renderDoc(); }

function groupQuotes() {
  const groups = new Map();
  for (const q of [...quotes.values()].sort((a, b) => a.added - b.added)) {
    const key = q.docId + '|' + q.ref;
    if (!groups.has(key)) groups.set(key, { docId: q.docId, ref: q.ref, meta: q.meta, name: q.docName, items: [] });
    groups.get(key).items.push(q);
  }
  return [...groups.values()];
}
const plain = html => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; };
// APA: tanda titik akhir kalimat dipindah ke belakang sitasi
const qBody = q => q.text.replace(/[.,;:]+$/, '');
const quoteLine = q => `“${qBody(q)}” ${q.cite.paren}.`;

function renderQuotes() {
  const v = $('#quotesView');
  const groups = groupQuotes();
  v.innerHTML = `<div class="pa-head q-head">
      <h2 class="doc-title">Laporan kutipan</h2>
      <p class="doc-meta">${quotes.size} kutipan dari ${groups.length} sumber · blok teks di dokumen lalu klik <b>❝ Kutip</b> untuk menambah</p>
      <div class="q-actions">
        <button class="btn sm" data-q="docx" ${quotes.size ? '' : 'disabled'}>Unduh Word (.docx)</button>
        <button class="btn sm ghost" data-q="csv" ${quotes.size ? '' : 'disabled'}>Unduh CSV / Excel</button>
        <button class="btn sm ghost" data-q="refs" ${quotes.size ? '' : 'disabled'}>Salin daftar pustaka</button>
        <button class="btn sm ghost danger" data-q="clear" ${quotes.size ? '' : 'disabled'}>Hapus semua</button>
      </div>
    </div>
    <div class="doc-content q-list">${groups.length ? groups.map((g, gi) => `
      <section class="q-group">
        <div class="q-ref"><span class="ref">${g.ref}</span>
          <div class="q-ref-act"><button class="link" data-q="copyref" data-g="${gi}">Salin referensi</button>
          <button class="link" data-q="editref" data-g="${gi}">Edit referensi</button>
          ${docs.has(g.docId) ? `<button class="link" data-q="open" data-g="${gi}">Buka dokumen</button>` : '<span class="muted small">dokumen sudah dihapus</span>'}</div></div>
        ${g.items.map(q => `<div class="q-card" data-id="${q.id}">
          <blockquote>“${esc(qBody(q))}” <span class="q-cite">${esc(q.cite.paren)}</span>.</blockquote>
          <div class="q-meta">Naratif: ${esc(q.cite.narr)}${q.lang === 'tr' ? ' · <span class="badge warn" title="Menurut APA 7, kutipan yang Anda terjemahkan sendiri dianggap parafrase. Cantumkan tetap halamannya, dan periksa terjemahan mesin terhadap teks asli.">dari terjemahan mesin</span>' : ''}${q.pdfPage ? ` · hlm. PDF ${q.pdfPage}` : ''}</div>
          ${q.origText ? `<details><summary>Teks asli</summary><p>${fmt(q.origText)}</p></details>` : ''}
          <textarea class="q-note" placeholder="Catatan (opsional)" rows="1">${esc(q.note)}</textarea>
          <div class="q-act"><button class="btn sm ghost" data-q="copy">Salin kutipan</button><button class="btn sm ghost" data-q="copyfull">Salin kutipan + referensi</button>${docs.has(q.docId) ? '<button class="btn sm ghost" data-q="goto">Lihat di dokumen</button>' : ''}<button class="btn sm ghost danger" data-q="del">Hapus</button></div>
        </div>`).join('')}
      </section>`).join('') : `<div class="welcome"><p>Belum ada kutipan.</p><p>Buka dokumen, blok kalimat yang ingin dikutip, lalu klik <b>❝ Kutip</b>. Kutipan tersimpan di sini lengkap dengan sitasi dan referensi APA 7.</p></div>`}</div>`;
}

$('#quotesView').addEventListener('click', async e => {
  const b = e.target.closest('[data-q]');
  if (!b) return;
  const groups = groupQuotes(), g = groups[+b.dataset.g];
  const q = quotes.get(b.closest('.q-card')?.dataset.id);
  const act = b.dataset.q;
  if (act === 'docx') download('Laporan_Kutipan.docx', await quotesDocx());
  if (act === 'csv') download('Laporan_Kutipan.csv', quotesCsv());
  if (act === 'refs') {
    const refs = [...new Set([...quotes.values()].map(x => x.ref))].sort((a, b) => plain(a).localeCompare(plain(b)));
    copyRich(refs.map(r => `<p>${r}</p>`).join(''), `${refs.length} referensi disalin (urut abjad)`, refs.map(plain).join('\n'));
  }
  if (act === 'clear' && confirm(`Hapus semua ${quotes.size} kutipan?`)) {
    for (const id of quotes.keys()) await DB.del('quotes', id);
    quotes.clear(); updateQuotesBtn(); renderQuotes();
  }
  if (act === 'copyref') copyRich(g.ref, 'Referensi disalin');
  if (act === 'editref') openRefModal(g.meta, meta => applyMeta(g.docId, meta));
  if (act === 'open') select(g.docId);
  if (act === 'copy') copyRich(esc(quoteLine(q)), 'Kutipan disalin', quoteLine(q));
  if (act === 'copyfull') copyRich(`<p>${esc(quoteLine(q))}</p><p>${q.ref}</p>`, 'Kutipan dan referensi disalin', quoteLine(q) + '\n\n' + plain(q.ref));
  if (act === 'del') { quotes.delete(q.id); await DB.del('quotes', q.id); updateQuotesBtn(); renderQuotes(); }
  if (act === 'goto') {
    select(q.docId);
    UI.lang = q.lang === 'orig' ? 'orig' : 'id';
    renderDoc();
    $('#find').value = q.text.slice(0, 60);
    runFind(true);
  }
});
$('#quotesView').addEventListener('input', e => {
  const t = e.target.closest('.q-note');
  if (!t) return;
  const q = quotes.get(t.closest('.q-card').dataset.id);
  q.note = t.value;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => DB.put('quotes', q), 400);
});

async function copyRich(html, msg, text) {
  text = text ?? plain(html);
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
  } catch (e) {
    await navigator.clipboard.writeText(text);
  }
  toast(msg);
}
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Diunduh: ' + name);
}

function quotesCsv() {
  const head = ['No', 'Siap tempel', 'Kutipan', 'Sitasi (dalam kurung)', 'Sitasi (naratif)', 'Halaman', 'Dari', 'Teks asli', 'Referensi APA 7', 'Catatan', 'File sumber', 'Tanggal'];
  const rows = groupQuotes().flatMap(g => g.items).map((q, i) => [i + 1, quoteLine(q), q.text, q.cite.paren, q.cite.narr, q.page, q.lang === 'orig' ? 'Teks asli' : 'Terjemahan mesin', q.origText, plain(q.ref), q.note, q.docName, new Date(q.added).toLocaleString('id-ID')]);
  return new Blob(['﻿' + Papa.unparse([head, ...rows], { newline: '\r\n' })], { type: 'text/csv;charset=utf-8' });
}

async function quotesDocx() {
  // Paragraf Word dari HTML sederhana (<i> untuk miring)
  const runs = (html, props = '') => html.split(/(<\/?i>)/).reduce((acc, part) => {
    if (part === '<i>') acc.i = true; else if (part === '</i>') acc.i = false;
    else if (part) acc.x += `<w:r><w:rPr>${props}${acc.i ? '<w:i/>' : ''}</w:rPr><w:t xml:space="preserve">${xesc(plain(part))}</w:t></w:r>`;
    return acc;
  }, { i: false, x: '' }).x;
  const P = (html, ppr = '', rpr = '') => `<w:p>${ppr ? '<w:pPr>' + ppr + '</w:pPr>' : ''}${runs(html, rpr)}</w:p>`;
  const hang = '<w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:ind w:left="720" w:hanging="720"/><w:jc w:val="left"/>';
  let body = P('Laporan Kutipan', '<w:pStyle w:val="Title"/>');
  body += P(esc(`${quotes.size} kutipan · dibuat ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`), '', '<w:color w:val="6B7280"/>');
  let n = 0;
  for (const g of groupQuotes()) {
    body += P(esc(sentenceCase(stripTags(g.meta.title || g.name))), '<w:pStyle w:val="Heading2"/>');
    body += P(g.ref, hang);
    for (const q of g.items) {
      n++;
      body += P(`${n}. ${esc(quoteLine(q))}`, '<w:spacing w:before="120" w:after="60"/><w:ind w:left="360"/>');
      const extra = [`Naratif: ${q.cite.narr}`];
      if (q.lang === 'tr') extra.push('Dari terjemahan mesin (APA 7: terjemahan sendiri = parafrase)');
      body += P(esc(extra.join(' · ')), '<w:spacing w:after="40"/><w:ind w:left="360"/>', '<w:color w:val="6B7280"/><w:sz w:val="18"/>');
      if (q.origText) body += P('Teks asli: ' + esc(q.origText), '<w:spacing w:after="40"/><w:ind w:left="360"/>', '<w:i/><w:color w:val="6B7280"/><w:sz w:val="18"/>');
      if (q.note) body += P('Catatan: ' + esc(q.note), '<w:spacing w:after="40"/><w:ind w:left="360"/>', '<w:sz w:val="18"/>');
    }
  }
  body += P('Daftar Pustaka', '<w:pStyle w:val="Heading2"/><w:pageBreakBefore/>');
  for (const r of [...new Set([...quotes.values()].map(q => q.ref))].sort((a, b) => plain(a).localeCompare(plain(b)))) body += P(r, hang);

  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const zip = new JSZip();
  zip.file('[Content_Types].xml', XML_DECL + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  zip.file('_rels/.rels', XML_DECL + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', XML_DECL + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('word/styles.xml', XML_DECL + `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style></w:styles>`);
  zip.file('word/document.xml', XML_DECL + `<w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ---------- Form edit referensi ----------
let refSave = null;
const RF = ['Type', 'Year', 'Authors', 'Title', 'Container', 'Volume', 'Issue', 'Pages', 'Publisher', 'Editors', 'Doi', 'Url'];
const namesToText = list => (list || []).map(a => a.given ? `${a.family}, ${a.given}` : a.family).join('\n');
const textToNames = t => t.split('\n').map(s => s.trim()).filter(Boolean).map(s => { const [f, ...g] = s.split(','); return { family: f.trim(), given: g.join(',').trim() }; });
function formMeta() {
  const v = k => $('#rf' + k).value.trim();
  return { type: v('Type'), year: v('Year'), authors: textToNames($('#rfAuthors').value), title: v('Title'), container: v('Container'), volume: v('Volume'), issue: v('Issue'), pages: v('Pages'), publisher: v('Publisher'), editors: textToNames($('#rfEditors').value), doi: cleanDoi(v('Doi')), url: v('Url') };
}
function fillForm(m) {
  for (const k of RF) {
    const key = k[0].toLowerCase() + k.slice(1);
    $('#rf' + k).value = k === 'Authors' || k === 'Editors' ? namesToText(m[key]) : (m[key] ?? '');
  }
  if (!$('#rfType').value) $('#rfType').value = 'journal';
  rfPreview();
}
function rfPreview() {
  const m = formMeta();
  const t = m.type;
  $('#rfContainerL').firstChild.textContent = t === 'journal' ? 'Nama jurnal' : t === 'chapter' ? 'Judul buku' : t === 'proceedings' ? 'Nama prosiding' : 'Nama situs / seri (opsional)';
  $('#rfIssueL').firstChild.textContent = t === 'thesis' ? 'Jenis (mis. Doctoral dissertation, Master\'s thesis)' : 'Nomor';
  $('#rfEditorsL').hidden = !(t === 'chapter' || t === 'proceedings');
  $('#rfPreview').innerHTML = `<span class="badge">Pratinjau</span> ${formatAPA(m)}<br><span class="muted small">Sitasi: ${esc(citeAPA(m, '').paren)} · ${esc(citeAPA(m, '').narr)}</span>`;
}
function openRefModal(meta, onSave) {
  refSave = onSave;
  fillForm(meta || {});
  $('#rfMsg').textContent = '';
  $('#refModal').hidden = false;
  $('#rfTitle').focus();
}
$('#refModal').addEventListener('input', rfPreview);
$('#rfCancel').addEventListener('click', () => { $('#refModal').hidden = true; });
$('#refModal').addEventListener('mousedown', e => { if (e.target.id === 'refModal') $('#refModal').hidden = true; });
$('#rfSave').addEventListener('click', () => { const m = formMeta(); $('#refModal').hidden = true; refSave && refSave(m); });
$('#rfLookup').addEventListener('click', async () => {
  const m = formMeta(), msg = $('#rfMsg');
  msg.textContent = 'Mencari…';
  try {
    let hit = null;
    if (m.doi) hit = await crossref({ doi: m.doi });
    else if (m.title) hit = ((await crossref({ title: m.title + ' ' + m.authors.map(a => a.family).join(' ') })).items || []).find(it => similar(m.title, (it.title || [])[0] || '') >= 0.6);
    if (!hit) { msg.textContent = 'Tidak ditemukan. Isi manual.'; return; }
    fillForm(fromCrossref(hit));
    msg.textContent = 'Ditemukan di Crossref, periksa lalu Simpan.';
  } catch (e) {
    msg.textContent = 'Gagal: ' + e.message;
  }
});
