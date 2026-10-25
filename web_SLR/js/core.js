/* Telaah SLR — state aplikasi & logika alur skrining */
'use strict';

let S = null; // state proyek aktif
const UI = {
  view: 'work', stage: 'ta', sel: null, filter: 'all', sort: 'default', q: '',
  docMode: 'abs', find: '', findIdx: 0, as: 'both', activeField: { r1: null, r2: null },
  panelTab: 'doc', reveal: { r1: false, r2: false }, listOpen: true, mobilePanel: 'a',
  pdfCache: {}, textCache: {}, importDraft: null, workMode: 'panel'
};

const save = debounce(async () => {
  try {
    await DB.put('kv', 'state', S);
    setSaved('Tersimpan ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
  } catch (e) {
    console.error(e);
    setSaved('Gagal menyimpan', true);
  }
}, 400);

function touch() { setSaved('Menyimpan…'); save(); }
function setSaved(t, bad) { const el = $('#saveState'); if (el) { el.textContent = t; el.classList.toggle('bad', !!bad); } }

function rec(id) { return S.records.find(r => r.id === id); }
function revName(r) { return S.project.reviewers[r === 'r1' ? 0 : 1] || (r === 'r1' ? 'Reviewer 1' : 'Reviewer 2'); }

/* ---------- Status skrining ---------- */
function isSingle() { return !!(S && S.project.single); }
// Ekstraksi bisa tetap dua reviewer walau skrining satu reviewer (Proyek & Kriteria / bilah Ekstraksi data)
function exSolo() { return isSingle() && !S.project.exDual; }
// Mode satu reviewer untuk tahap yang sedang dibuka di ruang kerja
function solo() { return UI.view === 'work' && UI.stage === 'ex' ? exSolo() : isSingle(); }
function exDone(r) { return exSolo() ? !!r.extract.done.r1 : !!r.extract.done.final; }
function exFinal(r) { return exSolo() ? r.extract.r1 : r.extract.final; }
function exNeedsCons(r) { return !exSolo() && r.extract.done.r1 && r.extract.done.r2 && !r.extract.done.final; }
// Isian konsensus dianggap sama bila hanya beda tanda baca, huruf besar/kecil, spasi, atau urutan pilihan "a; b"
function consNorm(v) {
  return String(v || '').split(';').map(p => p.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()).filter(Boolean).sort().join('|');
}
function consSame(a, b) { return consNorm(a) === consNorm(b); }

function stageStatus(r, st) {
  const s = r.screen[st];
  if (s.final) return s.final.d;
  if (isSingle()) { const d = s.r1 && s.r1.d; return !d ? 'pending' : d === 'maybe' ? 'partial' : d; }
  const a = s.r1 && s.r1.d, b = s.r2 && s.r2.d;
  if (!a && !b) return 'pending';
  if (!a || !b) return 'partial';
  if (a === b && a !== 'maybe') return a;
  return 'conflict';
}
function hasDec(r, st, rv) { const d = r.screen[st][rv]; return !!(d && d.d); }
function effective(r, st) { const s = stageStatus(r, st); return s === 'include' || s === 'exclude' ? s : null; }
function inScreening(r) { return !r.duplicateOf && !r.autoExcluded; }
function inTA(r) { return inScreening(r) && r.sourceCat !== 'other'; }
function inFT(r) { return inScreening(r) && (r.sourceCat === 'other' || effective(r, 'ta') === 'include'); }
function inExtraction(r) { return inFT(r) && !r.notRetrieved && effective(r, 'ft') === 'include'; }

function finalReason(r, st) {
  const s = r.screen[st];
  if (s.final) return s.final.reason || (s.r1 && s.r1.d === 'exclude' && s.r1.reason) || (s.r2 && s.r2.reason) || 'Alasan tidak dicatat';
  return (s.r1 && s.r1.reason) || (s.r2 && s.r2.reason) || 'Alasan tidak dicatat';
}

/* Status akhir satu rekaman di sepanjang alur PRISMA */
function overallStatus(r) {
  if (r.duplicateOf) return { k: 'dup', label: 'Duplikat', cls: '' };
  if (r.autoExcluded) return { k: 'auto', label: 'Eksklusi otomatis', cls: 'no' };
  if (r.sourceCat !== 'other') {
    const ta = stageStatus(r, 'ta');
    if (ta === 'exclude') return { k: 'ex-ta', label: 'Eksklusi · judul/abstrak', cls: 'no' };
    if (ta !== 'include') return { k: 'pend', label: ta === 'conflict' ? 'Konflik · judul/abstrak' : 'Belum · judul/abstrak', cls: ta === 'conflict' ? 'conf' : 'warn' };
  }
  if (r.notRetrieved) return { k: 'notret', label: 'Teks lengkap tidak diperoleh', cls: 'no' };
  const ft = stageStatus(r, 'ft');
  if (ft === 'exclude') return { k: 'ex-ft', label: 'Eksklusi · teks lengkap', cls: 'no' };
  if (ft === 'include') return { k: 'inc', label: 'Inklusi', cls: 'ok' };
  return { k: 'pend', label: ft === 'conflict' ? 'Konflik · teks lengkap' : 'Belum · teks lengkap', cls: ft === 'conflict' ? 'conf' : 'warn' };
}

/* ---------- Penanda otomatis ---------- */
// Buang catatan hak cipta/lisensi penerbit di abstrak ("Copyright © 2026 … All rights reserved", "open access article
// distributed under …") agar kata seperti copyright/licens*/open access tidak salah menyalakan kriteria
function cleanAbs(s) {
  s = String(s || '');
  const memo = UI.absClean || (UI.absClean = new Map());
  if (memo.has(s)) return memo.get(s);
  let v = !/open access article|distributed under|creative commons|licen[cs]e/i.test(s) ? s : s.replace(/[^.]*\b(?:this is an open access article|distributed under the (?:terms|creative commons)|creative commons attribution|published by [^.]+ under (?:a|the) [^.]*licen[cs]e)[^.]*\.?/gi, ' ');
  const re = /(?:copyright\s*)?(?:©|\(c\)(?=\s*\d{4}))|copyright\s+(?=\d{4})/gi;
  let m;
  while ((m = re.exec(v))) {
    const tail = v.slice(m.index, m.index + 400);
    if (m.index > v.length * 0.7 || /rights reserved|publish|licen[cs]|elsevier|springer|wiley|taylor|emerald|igi global|author\(s\)|ltd|inc\.|press/i.test(tail)) { v = v.slice(0, m.index); break; }
  }
  if (memo.size > 20000) memo.clear();
  memo.set(s, v);
  return v;
}
function tiabText(r) { return [r.title, cleanAbs(r.abstract), r.keywords].join('\n'); }
// Hasil evaluasi judul+abstrak di-cache per rekaman sampai teks atau kriteria berubah
function flagOf(r) {
  const C = Criteria.compiled(S.criteria), txt = tiabText(r);
  const memo = UI.flagMemo || (UI.flagMemo = new Map());
  let m = memo.get(r.id);
  if (!m || m.C !== C || m.txt !== txt) { m = { C, txt, ev: Criteria.evaluate(txt, S.criteria) }; memo.set(r.id, m); }
  return applyLang(m.ev, r);
}
function flagFT(r) {
  const t = UI.textCache[r.id];
  return t ? applyLang(Criteria.evaluate(tiabText(r) + '\n' + t.join('\n'), S.criteria), r) : null;
}
/* Evaluasi terbaik yang tersedia: teks lengkap PDF bila ada, selain itu judul + abstrak */
function evalBest(r) { return r.hasText && UI.textCache[r.id] ? flagFT(r) : flagOf(r); }
async function preloadTexts() {
  const todo = S.records.filter(r => r.hasText && !r.archived && !UI.textCache[r.id]);
  for (const r of todo) await loadText(r.id);
  return todo.length;
}
async function loadText(id) {
  if (UI.textCache[id]) return UI.textCache[id];
  const t = await DB.get('texts', id);
  if (t) UI.textCache[id] = t;
  return t || null;
}

/* ---------- Deduplikasi ---------- */
// Kunci pencocokan: DOI, judul ternormalisasi + tahun, dan sidik file PDF
function dupKeys(r) {
  const keys = [];
  if (r.doi) keys.push('d:' + normDoi(r.doi));
  const t = normTitle(r.title);
  if (t.length > 20 && !(typeof Parsers !== 'undefined' && Parsers.junkTitle(r.title))) keys.push('t:' + t + '|' + (r.year || ''));
  if (r.fileHash) keys.push('h:' + r.fileHash);
  return keys;
}
function dupIndex() {
  const idx = new Map();
  S.records.forEach(r => { if (!r.duplicateOf) dupKeys(r).forEach(k => { if (!idx.has(k)) idx.set(k, r); }); });
  return idx;
}
function dupFind(idx, r) {
  for (const k of dupKeys(r)) if (idx.has(k)) return { rec: idx.get(k), by: k[0] === 'd' ? 'DOI sama' : k[0] === 'h' ? 'file PDF identik' : 'judul + tahun sama' };
  return null;
}
function dupAdd(idx, r) { dupKeys(r).forEach(k => { if (!idx.has(k)) idx.set(k, r); }); }
// Rekaman duplikat tidak disimpan; hanya dicatat agar angka PRISMA tetap benar
function logSkipped(r, by, dupOf, source, cat, batch) {
  S.skipped = S.skipped || [];
  S.skipped.push({ title: r.title || '', file: r.fileName || '', doi: r.doi || '', year: r.year || '', source, cat, batch, by, dupOf: dupOf ? dupOf.id : '', dupTitle: dupOf ? dupOf.title : '', date: today() });
}
// Lengkapi metadata rekaman yang dipertahankan dari duplikatnya
function mergeMeta(keep, dup) {
  ['abstract', 'doi', 'year', 'authors', 'journal', 'keywords'].forEach(k => { if (!keep[k] && dup[k]) keep[k] = dup[k]; });
}
function skippedCount(cat) { return (S.skipped || []).filter(x => !cat || (cat === 'database' ? x.cat !== 'register' && x.cat !== 'other' : x.cat === cat)).length; }
// Sidik file untuk PDF lama yang belum punya (agar unggahan ulang file yang sama langsung dikenali)
async function backfillHashes() {
  let n = 0;
  for (const r of S.records.filter(x => x.hasPdf && !x.fileHash)) {
    const b = await DB.get('pdfs', r.id);
    if (b) { r.fileHash = await fileHash(b); n++; }
  }
  if (n) save();
  return n;
}
async function fileHash(file) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(buf).slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { return 'n:' + file.size + ':' + file.name; }
}

function runDedup() {
  const seen = new Map();
  let n = 0;
  S.records.forEach(r => {
    if (r.notDuplicate) { r.duplicateOf = null; return; }
    const keys = [];
    if (r.doi) keys.push('d:' + normDoi(r.doi));
    const t = normTitle(r.title);
    if (t.length > 20) keys.push('t:' + t + '|' + (r.year || ''));
    let dupOf = null;
    for (const k of keys) if (seen.has(k)) { dupOf = seen.get(k); break; }
    if (dupOf && dupOf !== r.id) { r.duplicateOf = dupOf; n++; }
    else { r.duplicateOf = null; keys.forEach(k => seen.set(k, r.id)); }
  });
  return n;
}

/* ---------- Daftar rekaman untuk ruang kerja ---------- */
function stageRecords(stage = UI.stage) {
  if (stage === 'ta') return S.records.filter(inTA);
  if (stage === 'ft') return S.records.filter(inFT);
  return S.records.filter(inExtraction);
}

function decisionOf(r, rv, stage = UI.stage) {
  if (stage === 'ex') return r.extract.done[rv] ? 'done' : (Object.keys(r.extract[rv] || {}).length ? 'draft' : null);
  const d = r.screen[stage][rv];
  return d && d.d ? d.d : null;
}

function filteredRecords() {
  let list = stageRecords().filter(r => !r.archived);
  const q = UI.q.trim().toLowerCase();
  if (q) list = list.filter(r => (r.title + ' ' + r.authors + ' ' + r.abstract + ' ' + r.doi + ' ' + r.year).toLowerCase().includes(q));
  const me = UI.as === 'both' && !solo() ? null : (solo() ? 'r1' : UI.as);
  const st = UI.stage;
  const f = UI.filter;
  list = list.filter(r => {
    if (f === 'all') return true;
    if (f.startsWith('flag:')) return evalBest(r).flag === f.slice(5);
    if (st === 'ex') {
      if (f === 'undecided') return me ? !r.extract.done[me] : !(r.extract.done.r1 && r.extract.done.r2);
      if (f === 'conflict') return exNeedsCons(r);
      if (f === 'include') return exDone(r);
      return true;
    }
    const s = stageStatus(r, st);
    if (f === 'undecided') return me ? !hasDec(r, st, me) : (s === 'pending' || s === 'partial');
    if (f === 'conflict') return s === 'conflict';
    if (f === 'include') return s === 'include';
    if (f === 'exclude') return s === 'exclude';
    if (f === 'maybe') return [r.screen[st].r1, r.screen[st].r2].some(d => d && d.d === 'maybe');
    return true;
  });
  if (UI.sort === 'score') list = list.slice().sort((a, b) => evalBest(b).score - evalBest(a).score);
  else if (UI.sort === 'year') list = list.slice().sort((a, b) => String(b.year).localeCompare(String(a.year)));
  else if (UI.sort === 'title') list = list.slice().sort((a, b) => a.title.localeCompare(b.title));
  return list;
}

function stageProgress(stage) {
  const list = stageRecords(stage);
  if (stage === 'ex') {
    const done = list.filter(exDone).length;
    return { total: list.length, done, conflict: list.filter(exNeedsCons).length };
  }
  let done = 0, conflict = 0;
  list.forEach(r => { const s = stageStatus(r, stage); if (s === 'include' || s === 'exclude') done++; if (s === 'conflict') conflict++; });
  return { total: list.length, done, conflict };
}

function visibleFields(vals) {
  return S.fields.filter(f => {
    if (f.group === 'ma' && S.project.type !== 'meta') return false;
    if (f.showIf && f.showIf.length) return f.showIf.includes(vals.ma_type);
    return true;
  });
}
