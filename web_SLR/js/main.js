/* Telaah SLR — inisialisasi, navigasi, dan penanganan event */
'use strict';

const RENDER = { project: renderProject, import: renderImport, work: renderWork, meta: renderMeta, quality: renderQuality, frameworks: renderFrameworks, biblio: renderBiblio, report: renderReport, prisma: renderPrisma, checklist: renderChecklist, export: renderExport };

function show(view) {
  UI.view = view;
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + view));
  document.body.classList.toggle('is-work', view === 'work');
  syncAs();
  RENDER[view]();
  try { localStorage.setItem('telaah-view', view); } catch (e) { /* abaikan */ }
}

function refreshChrome() {
  $('#typePill').textContent = TYPE_LABEL[S.project.type];
  $('#typePill').dataset.type = S.project.type;
  syncAs();
  $('#sampleBanner').hidden = !S.isSample;
  $('#tabMeta').classList.toggle('dim', S.project.type !== 'meta');
}

// Pilihan "Bekerja sebagai" hanya tampil bila tahap yang terbuka memakai dua reviewer
function syncAs() {
  const one = solo();
  if (one) UI.as = 'r1';
  const sel = $('#asSelect'), w = $('.as-wrap');
  if (sel) sel.value = UI.as;
  if (w) w.hidden = one;
}

function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  ks.slice(0, -1).forEach(k => { if (o[k] == null) o[k] = {}; o = o[k]; });
  o[ks[ks.length - 1]] = val;
}

async function loadState(st) {
  S = st;
  UI.textCache = {}; UI.pdfCache = {}; UI.sel = null; UI.importDraft = null;
  refreshChrome();
  touch();
}

/* ---------- Impor file ---------- */
async function handleFiles(files) {
  const source = (UI.importSource || '').trim() || 'Tidak diketahui';
  const cat = UI.importCat || 'database';
  const auto = UI.importAuto !== false;
  const pick = (fileName, text, headers) => {
    const d = auto ? Sources.detect({ fileName, text, headers }) : null;
    if (!d) return { source, cat, auto: null };
    addProjDb(d.name, d.cat);
    return { source: d.name, cat: d.cat, auto: d.why };
  };
  const match = $('#impMatch') ? $('#impMatch').checked : true;
  UI.importMatch = match;
  const prog = $('#dropProgress');
  const pdfs = [];
  // Daftar berkas (CSV dengan kolom nama berkas PDF + judul/DOI) di folder yang sama dipakai untuk mencocokkan PDF, bukan diimpor sebagai rekaman
  const manifest = new Map(), manFiles = new Set();
  let bestDr = null; // CSV keputusan terlengkap di folder
  if (files.some(f => /.pdf$/i.test(f.name))) {
    for (const f of files.filter(f => /.(csv|tsv)$/i.test(f.name))) {
      try {
        const { headers, rows } = Parsers.parseCSV(await f.text());
        const hi = headers.findIndex(h => /nama.?berkas|file.?name|filename|berkas.?pdf|pdf.?file|^file$|^pdf$/i.test(h));
        if (hi < 0) continue;
        const ti = headers.findIndex(h => /^(judul|title|article title|document title)$/i.test(h.trim()));
        const di = headers.findIndex(h => /^doi$/i.test(h.trim()));
        const cell = (row, i) => i < 0 ? '' : String((Array.isArray(row) ? row[i] : row[headers[i]]) || '').trim();
        rows.forEach(row => { const fn = cell(row, hi).toLowerCase(); if (fn) manifest.set(fn.replace(/^.*[\/]/, ''), { title: cell(row, ti), doi: di >= 0 ? normDoi(cell(row, di)) : '' }); });
        manFiles.add(f);
        const dr = typeof decParse === 'function' ? decParse(headers, rows, f.name) : null;
        if (dr && !(bestDr && bestDr.items.length > dr.items.length)) UI.decDraft = bestDr = dr;
      } catch (e) { /* bukan daftar berkas */ }
    }
  }
  for (const f of files) {
    const ext = f.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'pdf') { pdfs.push(f); continue; }
      if (manFiles.has(f)) continue;
      const text = await f.text();
      if (ext === 'ris' || (ext === 'txt' && /^TY  - /m.test(text))) { const s = pick(f.name, text, []); addBatch(s.source, s.cat, f.name, Parsers.parseRIS(text), s.auto); }
      else if (ext === 'nbib' || ext === 'medline' || (ext === 'txt' && /^(PMID|OWN)\s*- /m.test(text))) { const s = pick(f.name, text, []); addBatch(s.source, s.cat, f.name, Parsers.parseMedline(text), s.auto); }
      else if (ext === 'bib') { const s = pick(f.name, text, []); addBatch(s.source, s.cat, f.name, Parsers.parseBib(text), s.auto); }
      else {
        const { headers, rows } = Parsers.parseCSV(text);
        if (!headers.length) { toast(f.name + ': kolom tidak terbaca.', 'bad'); continue; }
        const s = pick(f.name, text, headers);
        UI.importDraft = { file: f.name, headers, rows, map: Parsers.guessMapping(headers), source: s.source, cat: s.cat, auto: s.auto };
        renderImport();
        return; // satu CSV dipetakan dulu
      }
    } catch (e) {
      console.error(e);
      toast(f.name + ': ' + e.message, 'bad');
    }
  }
  if (pdfs.length) {
    const recs = [];
    let attached = 0;
    UI.lastPdf = [];
    const batch = { id: uid('b'), name: source, cat, file: pdfs.length + ' PDF', count: 0, date: today() };
    const idx = dupIndex();
    let skipped = 0, manHit = 0;
    for (let i = 0; i < pdfs.length; i++) {
      if (prog) prog.textContent = `Membaca PDF ${i + 1} dari ${pdfs.length}: ${pdfs[i].name}${skipped ? ` · ${skipped} duplikat dikeluarkan` : ''}`;
      try {
        const hash = await fileHash(pdfs[i]);
        const same = idx.get('h:' + hash);
        if (same) { logSkipped({ title: pdfs[i].name, fileName: pdfs[i].name }, 'file PDF identik', same, source, cat, batch.id); skipped++; continue; }
        const parsed = await Parsers.readPDF(pdfs[i]);
        parsed.rec.fileHash = hash;
        const man = manifest.get(pdfs[i].name.toLowerCase());
        if (man) { if (man.doi) parsed.rec.doi = man.doi; if (man.title) parsed.rec.title = man.title; manHit++; }
        let existing = match ? Parsers.matchRecord(parsed, S.records) : null;
        if (match && !existing && man && man.title) { const nt = normTitle(man.title); existing = S.records.find(x => !x.duplicateOf && x.title && normTitle(x.title) === nt) || null; }
        if (existing && existing.archived) { logSkipped(parsed.rec, 'sudah dibersihkan (Exclude)', existing, source, cat, batch.id); skipped++; continue; }
        if (existing) { existing.fileHash = hash; if (!existing.fileName) existing.fileName = pdfs[i].name; mergeMeta(existing, parsed.rec); await storePdf(existing, pdfs[i], parsed); dupAdd(idx, existing); attached++; UI.lastPdf.push(existing.id); continue; }
        const dup = dupFind(idx, parsed.rec);
        if (dup) { mergeMeta(dup.rec, parsed.rec); logSkipped(parsed.rec, dup.by, dup.rec, source, cat, batch.id); skipped++; continue; }
        const r = makeRecord({ ...parsed.rec, source, sourceCat: cat, batch: batch.id });
        await storePdf(r, pdfs[i], parsed);
        dupAdd(idx, r);
        recs.push(r); UI.lastPdf.push(r.id);
      } catch (e) {
        console.error(e);
        toast(pdfs[i].name + ': ' + e.message, 'bad');
      }
    }
    batch.skipped = skipped;
    if (recs.length || skipped) { batch.count = recs.length; S.batches.push(batch); S.records.push(...recs); }
    const nd = runDedup();
    // saringan teks lengkap: buang PDF yang kriteria wajibnya tidak ada di seluruh teks
    let ftOut = 0, ftKeep = 0, freed = 0;
    if (typeof ftAutoOn === 'function' && ftAutoOn() && boardRv()) {
      for (const id of UI.lastPdf) {
        const r = rec(id); if (!r) continue;
        const res = ftAutoScreen(r);
        if (res === 'keep') ftKeep++;
        else if (res === 'exclude') { ftOut++; freed += await archiveRec(r, 'ft'); }
      }
    }
    touch();
    if (recs.length) { UI.stage = 'ta'; UI.filter = 'all'; UI.q = ''; }
    toast(`${recs.length} PDF menjadi rekaman baru di tahap Judul & abstrak, ${attached} dilampirkan ke rekaman yang ada${skipped + nd ? `, ${skipped + nd} duplikat dikeluarkan (tidak disimpan)` : ''}.${ftOut + ftKeep ? ` Saringan teks lengkap: ${ftOut} tidak memenuhi kriteria wajib, langsung Exclude & dibuang${freed ? ` (${(freed / 1048576).toFixed(1)} MB dibebaskan)` : ''}; ${ftKeep} lolos untuk dibaca.` : ''}${manifest.size ? ` Daftar berkas ${[...manFiles].map(f => f.name).join(', ')} dipakai untuk mencocokkan ${manHit} PDF.` : ''}`, 'ok');
  }
  if (prog) prog.textContent = '';
  renderImport();
}

function addBatch(source, cat, file, items, auto) {
  if (!items.length) { toast(file + ': tidak ada rekaman terbaca.', 'bad'); return; }
  const b = { id: uid('b'), name: source, cat, file, count: 0, date: today() };
  if (auto) b.auto = auto;
  const idx = dupIndex();
  let skipped = 0;
  items.forEach(x => {
    const dup = dupFind(idx, x);
    if (dup) { mergeMeta(dup.rec, x); logSkipped(x, dup.by, dup.rec, source, cat, b.id); skipped++; return; }
    const r = makeRecord({ ...x, source, sourceCat: cat, batch: b.id });
    dupAdd(idx, r); S.records.push(r); b.count++;
  });
  b.skipped = skipped;
  S.batches.push(b);
  runDedup();
  touch();
  toast(`${b.count} rekaman diimpor dari ${file} sebagai ${source}${auto ? ' (terdeteksi otomatis)' : ''}${skipped ? ` · ${skipped} duplikat dikeluarkan (tidak disimpan)` : ''}.`, 'ok');
}

/* ---------- Ekspor ---------- */
function delim() { return UI.delim || ','; }

function exportScreening() {
  const head = ['id', 'judul', 'penulis', 'tahun', 'jurnal', 'doi', 'sumber', 'kategori', 'duplikat', 'eksklusi_otomatis', 'penanda_kata_kunci',
    'TA_R1', 'TA_R2', 'TA_final', 'FT_R1', 'FT_R2', 'FT_final', 'alasan_eksklusi_FT', 'tidak_diperoleh', 'catatan_R1', 'catatan_R2'];
  const rows = S.records.map(r => {
    const t = r.screen.ta, f = r.screen.ft;
    return [r.id, r.title, r.authors, r.year, r.journal, r.doi, r.source, r.sourceCat, r.duplicateOf ? 'ya' : '', r.autoExcluded ? 'ya' : '', FLAG_META[flagOf(r).flag].label,
      t.r1?.d || '', t.r2?.d || '', effective(r, 'ta') || stageStatus(r, 'ta'), f.r1?.d || '', f.r2?.d || '', inFT(r) ? (effective(r, 'ft') || stageStatus(r, 'ft')) : '',
      effective(r, 'ft') === 'exclude' ? finalReason(r, 'ft') : '', r.notRetrieved ? 'ya' : '',
      [t.r1?.note, f.r1?.note].filter(Boolean).join(' | '), [t.r2?.note, f.r2?.note].filter(Boolean).join(' | ')];
  });
  downloadText(toCSV([head, ...rows], delim()), slug(S.project.title) + '-skrining.csv', 'text/csv');
}

function exportExtraction(which) {
  const inc = S.records.filter(inExtraction);
  const fl = S.fields.filter(f => f.group !== 'ma' || S.project.type === 'meta');
  let head = ['id', 'judul', 'penulis', 'tahun', 'doi'];
  if (which === 'final') head = head.concat(fl.map(f => f.label), ['status_final']);
  else head = head.concat(fl.flatMap(f => [f.label + ' [R1]', f.label + ' [R2]', f.label + ' [final]']));
  const rows = inc.map(r => {
    const base = [r.id, r.title, r.authors, r.year, r.doi];
    if (which === 'final') return base.concat(fl.map(f => exFinal(r)[f.id] ?? ''), [exDone(r) ? 'selesai' : 'belum']);
    return base.concat(fl.flatMap(f => [r.extract.r1[f.id] ?? '', r.extract.r2[f.id] ?? '', r.extract.final[f.id] ?? '']));
  });
  downloadText(toCSV([head, ...rows], delim()), slug(S.project.title) + '-ekstraksi-' + which + '.csv', 'text/csv');
}

function exportRIS() {
  const inc = S.records.filter(inExtraction);
  const ris = inc.map(r => ['TY  - JOUR', 'TI  - ' + r.title, ...String(r.authors || '').split(/;\s*/).filter(Boolean).map(a => 'AU  - ' + a), r.year && 'PY  - ' + r.year, r.journal && 'JO  - ' + r.journal, r.doi && 'DO  - ' + r.doi, r.abstract && 'AB  - ' + r.abstract, 'ER  - '].filter(Boolean).join('\r\n')).join('\r\n\r\n');
  downloadText(ris, slug(S.project.title) + '-studi-inklusi.ris', 'application/x-research-info-systems');
}

async function blobToDataURL(b) {
  return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
}

async function backup() {
  const withPdf = $('#bkPdf') && $('#bkPdf').checked;
  const texts = {};
  const pdfs = {};
  for (const r of S.records) {
    if (r.hasText) { const t = await DB.get('texts', r.id); if (t) texts[r.id] = t; }
    if (withPdf && r.hasPdf) { const b = await DB.get('pdfs', r.id); if (b) pdfs[r.id] = await blobToDataURL(b); }
  }
  const data = { app: 'telaah-slr', exported: new Date().toISOString(), state: S, texts, pdfs };
  downloadText(JSON.stringify(data), slug(S.project.title) + '-cadangan-' + today() + '.json', 'application/json');
  toast('Cadangan diunduh.', 'ok');
}

function pickFile(accept, cb) {
  const inp = $('#hiddenFile');
  inp.value = '';
  inp.accept = accept;
  inp.onchange = () => { if (inp.files[0]) cb(inp.files[0]); };
  inp.click();
}

/* Baca ulang PDF tersimpan untuk rekaman yang judulnya berupa kode file */
async function fixTitles() {
  const todo = S.records.filter(r => r.hasPdf && Parsers.junkTitle(r.title));
  const prog = $('#fixProg');
  let n = 0;
  for (let i = 0; i < todo.length; i++) {
    const r = todo[i];
    if (prog) prog.textContent = `Membaca ulang ${i + 1} dari ${todo.length}…`;
    try {
      const blob = await DB.get('pdfs', r.id);
      if (!blob) continue;
      const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
      const t = Parsers.titleFromPage(await (await pdf.getPage(1)).getTextContent());
      if (t) { if (!r.fileName) r.fileName = r.title; r.title = t.slice(0, 300); n++; }
      pdf.destroy();
    } catch (e) { console.warn(e); }
  }
  runDedup(); touch(); renderImport();
  toast(`${n} dari ${todo.length} judul diperbaiki. Sisanya bisa diedit manual di panel ekstraksi.`, n ? 'ok' : 'warn');
}

/* ---------- Pengaturan proyek (tanpa rekaman) ---------- */
function presetExport() {
  const { project, reasons, criteria, fields } = S;
  downloadText(JSON.stringify({ app: 'telaah-slr-preset', project, reasons, criteria, fields }, null, 2), slug(project.title) + '-pengaturan.json', 'application/json');
}

/* Terapkan pengaturan (sebagian boleh): hanya bagian yang ada di file yang diganti */
function applySettings(p) {
  if (p.project) {
    const { framework, ...rest } = p.project;
    Object.assign(S.project, rest, { created: S.project.created });
    if (framework) S.project.framework = Object.assign({}, S.project.framework, framework);
  }
  if (Array.isArray(p.reasons) && p.reasons.length) S.reasons = p.reasons.slice();
  if (p.criteria) {
    const mk = list => (list || []).map(c => ({ id: uid('c'), label: c.label || '', terms: c.terms || '' }));
    if (p.criteria.mode) S.criteria.mode = p.criteria.mode === 'any' ? 'any' : 'all';
    if (p.criteria.lang) S.criteria.lang = Object.assign({}, S.criteria.lang, p.criteria.lang);
    if (p.criteria.include) S.criteria.include = mk(p.criteria.include);
    if (p.criteria.exclude) S.criteria.exclude = mk(p.criteria.exclude);
  }
  if (Array.isArray(p.fields) && p.fields.length) S.fields = p.fields.map(f => Object.assign({ id: uid('f'), type: 'text' }, f));
  S.isSample = false;
  UI.as = S.project.single ? 'r1' : 'both';
  touch(); refreshChrome();
}

async function presetImport(file) {
  try {
    let p;
    if (/\.json$/i.test(file.name)) {
      p = JSON.parse(await file.text());
      if (!p || p.app !== 'telaah-slr-preset') throw new Error('File ini bukan pengaturan Telaah SLR.');
    } else {
      toast('Membaca ' + file.name + '…');
      p = SettingsIO.parseTables(await SettingsIO.tablesFromFile(file));
    }
    const sum = SettingsIO.summary(p);
    if (!sum.length) throw new Error('Tidak ada bagian yang dikenali. Pakai templat dari tombol "Unduh templat" agar judul kolomnya sesuai.');
    UI.settingsDraft = { p, sum, name: file.name };
    renderProject();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) { toast('Gagal membaca pengaturan: ' + e.message, 'bad'); }
}

async function templateDownload(kind) {
  try {
    const data = { project: Object.assign({}, S.project, { databases: projDbs() }), criteria: S.criteria, reasons: S.reasons, fields: S.fields };
    const base = 'templat-pengaturan-' + slug(S.project.title || 'telaah-slr').slice(0, 40);
    if (kind === 'xlsx') {
      const XLSX = await SettingsIO.loadLib('XLSX');
      const out = XLSX.write(SettingsIO.buildXlsx(XLSX, data), { bookType: 'xlsx', type: 'array' });
      downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), base + '.xlsx');
    } else {
      const JSZip = await SettingsIO.loadLib('JSZip');
      const zip = await SettingsIO.buildDocx(JSZip, data);
      downloadBlob(await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), base + '.docx');
    }
    toast('Templat diunduh, sudah berisi pengaturan proyek saat ini sebagai contoh.', 'ok');
  } catch (e) { toast('Gagal membuat templat: ' + e.message, 'bad'); }
}

async function readBackup(file) {
  const data = JSON.parse(await file.text());
  if (!data || !data.state || !Array.isArray(data.state.records)) throw new Error('File ini bukan cadangan Telaah SLR.');
  return data;
}

async function restore(file) {
  try {
    const data = await readBackup(file);
    await DB.clear('texts'); await DB.clear('pdfs');
    for (const [id, t] of Object.entries(data.texts || {})) await DB.put('texts', id, t);
    for (const [id, url] of Object.entries(data.pdfs || {})) { const b = await (await fetch(url)).blob(); await DB.put('pdfs', id, b); }
    data.state.records.forEach(r => { if (r.hasPdf && !(data.pdfs || {})[r.id]) r.hasPdf = false; });
    await loadState(Object.assign(defaultState(data.state.project.type), data.state));
    show('work');
    toast(`Proyek dipulihkan: ${S.records.length} rekaman.`, 'ok');
  } catch (e) { toast('Gagal memulihkan: ' + e.message, 'bad'); }
}

async function merge(file, rv) {
  try {
    const data = await readBackup(file);
    const other = data.state.records;
    const byId = new Map(other.map(r => [r.id, r]));
    let n = 0;
    S.records.forEach(r => {
      const o = byId.get(r.id) || other.find(x => (r.doi && x.doi === r.doi) || (normTitle(x.title) === normTitle(r.title) && normTitle(r.title).length > 20));
      if (!o) return;
      let changed = false;
      ['ta', 'ft'].forEach(st => { if (o.screen[st][rv]) { r.screen[st][rv] = o.screen[st][rv]; changed = true; } });
      if (o.extract && Object.keys(o.extract[rv] || {}).length) { r.extract[rv] = o.extract[rv]; r.extract.done[rv] = o.extract.done[rv]; changed = true; }
      if (changed) n++;
    });
    touch();
    toast(`Data ${revName(rv)} digabung ke ${n} rekaman.`, 'ok');
    show('work');
  } catch (e) { toast('Gagal menggabung: ' + e.message, 'bad'); }
}

function svgToPng(svgText, scale = 2) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width * scale; c.height = img.height * scale;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(res, 'image/png');
    };
    img.onerror = rej;
    img.src = url;
  });
}

/* ---------- Event: klik ---------- */
document.addEventListener('click', async e => {
  const tab = e.target.closest('.tabs button');
  if (tab) { show(tab.dataset.view); return; }
  const a = e.target.closest('[data-action]');
  if (!a || a.disabled) return;
  const act = a.dataset.action;
  const r = rec(UI.sel);
  switch (act) {
    case 'goto': show(a.dataset.view); break;
    case 'new-empty': await DB.clear('texts'); await DB.clear('pdfs'); await loadState(defaultState(S.project.type)); show('project'); toast('Proyek kosong siap. Mulai dari kriteria dan impor.', 'ok'); break;
    case 'load-sample': await DB.clear('texts'); await DB.clear('pdfs'); await loadState(sampleState()); show('work'); break;
    case 'reset-ask': UI.confirmReset = true; renderExport(); break;
    case 'reset-no': UI.confirmReset = false; renderExport(); break;
    case 'reset-yes': UI.confirmReset = false; await DB.clear('texts'); await DB.clear('pdfs'); await loadState(defaultState(S.project.type)); show('project'); toast('Proyek dikosongkan.', 'ok'); break;

    /* proyek */
    case 'set-type': {
      const t = a.dataset.type;
      if (t === S.project.type) break;
      S.project.type = t;
      touch(); refreshChrome(); renderProject();
      const note = $('#typeNote');
      note.hidden = false;
      note.innerHTML = `Jenis review diubah ke <b>${TYPE_LABEL[t]}</b>. Formulir ekstraksi dan alasan eksklusi belum berubah. <button class="btn sm" data-action="apply-template">Pakai templat ${TYPE_LABEL[t]}</button>`;
      break;
    }
    case 'apply-template': S.fields = templateFields(S.project.type); S.reasons = DEFAULT_REASONS[S.project.type].slice(); touch(); renderProject(); toast('Templat formulir & alasan eksklusi diterapkan.', 'ok'); break;
    case 'crit-add': S.criteria[a.dataset.kind].push({ id: uid('c'), label: '', terms: '' }); touch(); renderProject(); break;
    case 'crit-del': S.criteria[a.dataset.kind] = S.criteria[a.dataset.kind].filter(c => c.id !== a.dataset.cid); touch(); renderProject(); break;
    case 'field-add': S.fields.push({ id: uid('f'), label: 'Kolom baru', type: 'text' }); touch(); renderProject(); break;
    case 'field-del': S.fields.splice(+a.dataset.i, 1); touch(); renderProject(); break;
    case 'field-move': {
      const i = +a.dataset.i, j = i + +a.dataset.dir;
      if (j < 0 || j >= S.fields.length) break;
      [S.fields[i], S.fields[j]] = [S.fields[j], S.fields[i]]; touch(); renderProject(); break;
    }
    case 'field-reset': S.fields = templateFields(S.project.type); touch(); renderProject(); break;

    /* impor */
    case 'imp-cat': {
      UI.importCat = a.dataset.cat;
      const d = projDbs().find(x => x.name === UI.importSource);
      if (d && d.cat !== a.dataset.cat) { S.project.databases = projDbs().slice(); d.cat = a.dataset.cat; touch(); }
      renderImport(); break;
    }
    case 'imp-src': { const d = projDbs().find(x => x.name === a.dataset.name); if (d) { UI.importSource = d.name; UI.importCat = d.cat; } renderImport(); break; }
    case 'db-add': {
      const inp = $('#dbNew'); const raw = inp && inp.value.trim();
      if (!raw) { if (inp) inp.focus(); break; }
      const d = addProjDb(Sources.canon(raw));
      UI.importSource = d.name; UI.importCat = d.cat; touch(); renderImport();
      toast('Basis data ditambahkan: ' + d.name, 'ok');
      const n = $('#dbNew'); if (n) n.focus();
      break;
    }
    case 'db-del': {
      S.project.databases = projDbs().filter(x => x.name !== a.dataset.name);
      if (UI.importSource === a.dataset.name) UI.importSource = '';
      touch(); renderImport(); break;
    }
    case 'map-import': {
      const d = UI.importDraft;
      $$('[data-map]').forEach(s => { d.map[s.dataset.map] = s.value; });
      UI.importDraft = null;
      addBatch(d.source, d.cat, d.file, Parsers.rowsToRecords(d.rows, d.map), d.auto);
      renderImport(); break;
    }
    case 'map-cancel': UI.importDraft = null; renderImport(); break;
    case 'batch-ask': UI.confirmBatch = a.dataset.id; renderImport(); break;
    case 'batch-cancel': UI.confirmBatch = null; renderImport(); break;
    case 'batch-del': {
      const id = a.dataset.id;
      const gone = S.records.filter(x => x.batch === id);
      for (const x of gone) { await DB.del('texts', x.id); await DB.del('pdfs', x.id); }
      S.records = S.records.filter(x => x.batch !== id);
      S.batches = S.batches.filter(b => b.id !== id);
      S.skipped = (S.skipped || []).filter(x => x.batch !== id);
      UI.confirmBatch = null; runDedup(); touch(); renderImport(); toast(`${gone.length} rekaman dihapus.`); break;
    }
    case 'dedup': { const n = runDedup(); touch(); renderImport(); toast(`${n} duplikat terdeteksi.`); break; }
    case 'not-dup': { const x = rec(a.dataset.id); x.notDuplicate = true; x.duplicateOf = null; runDedup(); touch(); renderImport(); break; }
    case 'auto-apply': { let n = 0; S.records.forEach(x => { if (!x.duplicateOf && !x.autoExcluded && flagOf(x).flag === 'exclude') { x.autoExcluded = true; n++; } }); touch(); renderImport(); toast(`${n} rekaman ditandai tidak layak oleh otomasi.`, 'ok'); break; }
    case 'auto-undo': S.records.forEach(x => { x.autoExcluded = false; }); touch(); renderImport(); break;

    /* ruang kerja */
    case 'stage': UI.stage = a.dataset.stage; UI.filter = 'all'; UI.panelTab = 'doc'; if (UI.stage === 'ex' && UI.docMode === 'cons') UI.docMode = 'abs'; renderWork(); break;
    case 'select': selectRec(a.dataset.id); if (window.innerWidth < 900) { UI.mobilePanel = 'a'; $('.work-grid').dataset.mp = 'a'; $$('.mobile-switch button').forEach(b => b.classList.toggle('on', b.dataset.p === 'a')); } break;
    case 'prev': move(-1); break;
    case 'next': move(1); break;
    case 'toggle-list': UI.listOpen = !UI.listOpen; renderWork(); break;
    case 'mpanel': UI.mobilePanel = a.dataset.p; $('.work-grid').dataset.mp = a.dataset.p; $$('.mobile-switch button').forEach(b => b.classList.toggle('on', b.dataset.p === a.dataset.p)); break;
    case 'decide': decide(a.dataset.rv, a.dataset.d); break;
    case 'reveal': UI.reveal[a.dataset.rv] = true; renderReviewer(a.dataset.rv); break;
    case 'docmode':
      if (a.dataset.mode === 'cons') { UI.panelTab = 'cons'; } else { UI.panelTab = 'doc'; UI.docMode = a.dataset.mode; }
      renderPanelA(); break;
    case 'find-next': case 'find-prev': {
      const n = $$('#docContent mark.hl-find').length;
      if (!n) break;
      UI.findIdx = (UI.findIdx + (act === 'find-next' ? 1 : -1) + n) % n; updateFind(); break;
    }
    case 'find-term': UI.find = a.dataset.term; UI.findIdx = 0; UI.hitsOpen = true; renderPanelA().then(() => updateFind()); break;
    case 'attach-pdf': if (r) pickFile('.pdf', f => attachPdf(f, r)); break;
    case 'final': {
      if (!r) break;
      const reason = $('#finalReason') ? $('#finalReason').value : '';
      if (UI.stage === 'ft' && a.dataset.d === 'exclude' && !reason) { toast('Pilih alasan eksklusi final dulu (diperlukan untuk diagram PRISMA).', 'warn'); $('#finalReason').focus(); break; }
      r.screen[UI.stage].final = { d: a.dataset.d, reason, by: 'konsensus', ts: Date.now() };
      touch(); renderList(); renderPanels(); refreshStageCounts(); break;
    }
    case 'final-clear': if (r) { r.screen[UI.stage].final = null; touch(); renderList(); renderPanels(); refreshStageCounts(); } break;
    case 'quote': quoteTo(a.dataset.rv); break;
    case 'prefill': {
      if (!r) break;
      if (r.hasText) await loadText(r.id);
      const got = metaPrefill(r, a.dataset.rv);
      touch(); renderReviewer(a.dataset.rv);
      toast(got.length ? got.length + ' kolom terisi dan tersimpan otomatis: ' + got.join(', ') + '. Periksa, lengkapi, lalu centang "Ekstraksi selesai".' : 'Tidak ada kolom kosong yang bisa diisi dari metadata (kolom yang sudah terisi tidak ditimpa).', got.length ? 'ok' : 'warn');
      break;
    }
    case 'cons-pick': if (r) { r.extract.final[a.dataset.f] = r.extract[a.dataset.from][a.dataset.f]; touch(); renderPanelA(); } break;
    case 'cons-fill': if (r) {
      let n = 0;
      S.fields.forEach(f => { const x = r.extract.r1[f.id], y = r.extract.r2[f.id]; if (x && consSame(x, y) && !r.extract.final[f.id]) { r.extract.final[f.id] = x; n++; } });
      touch(); renderPanelA(); toast(n + ' kolom diisi otomatis.');
    } break;

    /* meta, prisma, checklist, ekspor */
    case 'ma-csv': {
      const st = MA.studies().filter(s => s.ok);
      const res = MA.pool(st, S.meta.model);
      const rows = [['studi', 'data', 'yi (skala analisis)', 'vi', 'efek', 'ci_bawah', 'ci_atas', 'bobot_%']].concat(st.map((s, i) => {
        const se = Math.sqrt(s.v);
        return [s.name, s.desc, s.y, s.v, MA.tx(s.y), MA.tx(s.y - 1.96 * se), MA.tx(s.y + 1.96 * se), res.weights[i]];
      }));
      rows.push(['GABUNGAN', S.meta.model, res.mu, res.se * res.se, MA.tx(res.mu), MA.tx(res.lo), MA.tx(res.hi), 100]);
      downloadText(toCSV(rows, delim()), slug(S.project.title) + '-meta-analisis.csv', 'text/csv'); break;
    }
    case 'prisma-svg': downloadText(prismaSVG(), slug(S.project.title) + '-prisma2020.svg', 'image/svg+xml'); break;
    case 'prisma-png': { const b = await svgToPng(prismaSVG(), 3); downloadBlob(b, slug(S.project.title) + '-prisma2020.png'); break; }
    case 'checklist-csv': {
      const cl = activeChecklist();
      const rows = [['bagian', 'no', 'item', 'deskripsi', 'selesai', 'lokasi']].concat(cl.items.map(([s, n, t, d]) => { const v = S.checklist[cl.name + n] || {}; return [s, n, t, d, v.ok ? 'ya' : '', v.loc || '']; }));
      downloadText(toCSV(rows, delim()), slug(S.project.title) + '-checklist.csv', 'text/csv'); break;
    }
    case 'exp-screen': exportScreening(); break;
    case 'exp-extract': exportExtraction(a.dataset.which); break;
    case 'preset-export': presetExport(); break;
    case 'lang-add-reason': { const L = S.criteria.lang; if (L && L.label && !S.reasons.includes(L.label)) S.reasons.push(L.label); touch(); renderProject(); toast('Alasan ditambahkan: ' + L.label, 'ok'); break; }
    case 'pr-style': S.prisma.style = a.dataset.k; delete S.prisma.accent; delete S.prisma.font; delete S.prisma.excl; delete S.prisma.radius; touch(); renderPrisma(); break;
    case 'nw-ask': UI.nwAsk = true; UI.nwBacked = false; renderWork(); break;
    case 'nw-cancel': UI.nwAsk = false; renderWork(); break;
    case 'nw-backup': await backup(); UI.nwBacked = true; renderWork(); break;
    case 'nw-go': if (UI.nwBacked) await newWorkGo(!!a.dataset.keep); break;
    case 'ft-reset-ask': UI.ftResetAsk = true; renderWork(); break;
    case 'ft-reset-cancel': UI.ftResetAsk = false; renderWork(); break;
    case 'ft-reset-go': ftResetGo(a.dataset.scope); refreshChrome(); renderWork(); break;
    case 'ft-reset-undo': ftResetUndo(); refreshChrome(); renderWork(); break;
    case 'ft-reset-forget': delete S.ftUndo; touch(); renderWork(); break;
    case 'pr-box-reset': if (S.prisma.boxes) delete S.prisma.boxes[a.dataset.k]; UI.prBox = a.dataset.k; touch(); renderPrisma(); break;
    case 'pr-box-reset-all': S.prisma.boxes = {}; touch(); renderPrisma(); toast('Semua kotak kembali ke teks dan ukuran otomatis.', 'ok'); break;
    case 'pr-style-reset': delete S.prisma.accent; delete S.prisma.font; delete S.prisma.excl; delete S.prisma.radius; touch(); renderPrisma(); break;
    case 'sec-toggle': { UI.secOpen = UI.secOpen || {}; const k = a.dataset.k; const cur = k === 'todo' ? UI.secOpen.todo !== false : !!UI.secOpen[k]; UI.secOpen[k] = !cur; renderList(); break; }
    case 'unlock': if (r) { UI.unlock = UI.unlock || {}; UI.unlock[r.id + UI.stage + a.dataset.rv] = true; renderReviewer(a.dataset.rv); } break;
    case 'dup-purge-ask': UI.confirmPurge = true; renderImport(); break;
    case 'dup-purge-cancel': UI.confirmPurge = false; renderImport(); break;
    case 'dup-purge': {
      const gone = S.records.filter(x => x.duplicateOf);
      for (const x of gone) {
        const keep = rec(x.duplicateOf);
        if (keep) mergeMeta(keep, x);
        logSkipped(x, 'dikeluarkan dari data tersimpan', keep, x.source, x.sourceCat, x.batch);
        await DB.del('texts', x.id); await DB.del('pdfs', x.id);
        delete UI.textCache[x.id]; delete UI.pdfCache[x.id];
      }
      S.records = S.records.filter(x => !x.duplicateOf);
      UI.confirmPurge = false; touch(); renderImport();
      toast(`${gone.length} duplikat dikeluarkan beserta PDF-nya. Jumlahnya tetap tercatat di PRISMA.`, 'ok');
      break;
    }
    case 'fix-titles': fixTitles(); break;
    case 'ex-pick': UI.exPick = { fid: a.dataset.fid, val: a.dataset.val }; renderReport(); break;
    case 'ex-pick-clear': UI.exPick = null; renderReport(); break;
    case 'rep-filter': UI.repFilter = a.dataset.f; renderReport(); break;
    case 'rep-csv': exportReport(); break;
    case 'open-rec': {
      const x = rec(a.dataset.id);
      if (!x) break;
      UI.stage = a.dataset.stage || (inExtraction(x) ? 'ex' : inFT(x) && (x.sourceCat === 'other' || effective(x, 'ta')) ? 'ft' : 'ta');
      UI.workMode = 'panel';
      UI.filter = 'all'; UI.q = ''; UI.sel = x.id; UI.docMode = x.hasText ? 'txt' : 'abs';
      show('work'); break;
    }
    case 'preset-import': pickFile('.xlsx,.xls,.docx,.json', presetImport); break;
    case 'tpl-xlsx': templateDownload('xlsx'); break;
    case 'tpl-docx': templateDownload('docx'); break;
    case 'settings-apply': if (UI.settingsDraft) { const sd = UI.settingsDraft; UI.settingsDraft = null; applySettings(sd.p); renderProject(); toast('Pengaturan dari ' + sd.name + ' diterapkan.', 'ok'); } break;
    case 'settings-cancel': UI.settingsDraft = null; renderProject(); break;
    case 'exp-ris': exportRIS(); break;
    case 'backup': backup(); break;
    case 'restore': pickFile('.json', restore); break;
    case 'merge': pickFile('.json', f => merge(f, a.dataset.rv)); break;
  }
});

/* ---------- Event: input & change ---------- */
const rerenderCrit = debounce(() => { if (UI.view === 'project') { updateCritTest(); } }, 250);

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.bind) {
    setPath(S, t.dataset.bind, t.type === 'checkbox' ? t.checked : t.value);
    touch();
    if (t.dataset.bind.startsWith('criteria')) rerenderCrit();
    if (t.dataset.bind.startsWith('meta.')) renderMeta();
    if (t.dataset.bind === 'prisma.accent' || t.dataset.bind === 'prisma.radius') {
      // perbarui diagram saja agar pemilih warna/penggeser tidak tertutup saat digeser
      const paper = $('#prismaPaper'); if (paper) paper.innerHTML = prismaSVG();
      const th = $('.pr-thumb.on .pr-thumb-img'); if (th) th.innerHTML = prismaSVG({ style: S.prisma.style || 'klasik' });
      const lab = t.closest('.fld') && t.closest('.fld').querySelector('span'); if (lab && t.dataset.bind === 'prisma.radius') lab.textContent = 'Sudut kotak: ' + t.value + 'px';
      return;
    }
    if (t.dataset.bind.startsWith('prisma.')) renderPrismaKeepFocus(t.id);
    if (t.dataset.bind === 'project.blind' || t.dataset.bind.startsWith('project.reviewers')) refreshChrome();
    if (t.dataset.bind === 'criteria.lang.on') {
      const L = S.criteria.lang;
      if (!L.allowed) L.allowed = ['en'];
      if (L.label === undefined) { const nums = S.reasons.map(x => (critCode(x).match(/^E(\d+)/i) || [])[1]).filter(Boolean).map(Number); L.label = 'E' + ((nums.length ? Math.max(...nums) : 0) + 1) + ' – Bahasa bukan ' + L.allowed.map(k => LANG_NAMES[k]).join('/'); }
      renderProject(); return;
    }
    if (t.dataset.bind === 'project.single') { if (!t.checked) UI.as = 'both'; refreshChrome(); renderProject(); }
    return;
  }
  if (t.dataset.crit) {
    const c = S.criteria[t.dataset.crit].find(x => x.id === t.closest('[data-cid]').dataset.cid);
    c[t.dataset.key] = t.value; touch(); rerenderCrit(); return;
  }
  if (t.id === 'critTest') { UI.critTest = t.value; rerenderCrit(); return; }
  if (t.dataset.actionInput === 'reasons') { S.reasons = t.value.split('\n').map(s => s.trim()).filter(Boolean); touch(); return; }
  if (t.dataset.field !== undefined) {
    const f = S.fields[+t.dataset.field];
    if (t.dataset.key === 'options') f.options = t.value.split(',').map(s => s.trim()).filter(Boolean);
    else if (t.dataset.key === 'group') { if (f.group !== 'ma') f.group = t.value.trim(); }
    else f[t.dataset.key] = t.value;
    touch();
    if (t.dataset.key === 'type') renderProject();
    return;
  }
  if (t.dataset.map) { UI.importDraft.map[t.dataset.map] = t.value; return; }
  if (t.dataset.prbox) {
    const k = t.dataset.prbox, f = t.dataset.prf;
    S.prisma.boxes = S.prisma.boxes || {};
    const b = S.prisma.boxes[k] = S.prisma.boxes[k] || {};
    if (t.value === '') delete b[f]; else b[f] = f === 'text' ? t.value : Number(t.value);
    UI.prBox = k; touch();
    const paper = $('#prismaPaper'); if (paper) paper.innerHTML = prismaSVG();
    return;
  }
  if (t.dataset.ov) { S.prisma.ov = S.prisma.ov || {}; S.prisma.ov[t.dataset.ov] = t.value; touch(); renderPrismaKeepFocus(t.id); return; }
  if (t.dataset.cl) {
    const k = t.dataset.cl;
    S.checklist[k] = S.checklist[k] || {};
    S.checklist[k][t.dataset.key] = t.type === 'checkbox' ? t.checked : t.value;
    touch();
    if (t.type === 'checkbox') renderChecklist();
    return;
  }
  if (t.dataset.multi) {
    const box = t.closest('.multi');
    const r = rec(box.dataset.rid);
    r.extract[box.dataset.rv][box.dataset.fid] = $$('input:checked', box).map(x => x.value).join('; ');
    touch(); return;
  }
  if (t.dataset.fid && t.dataset.rv) {
    const r = rec(t.dataset.rid);
    r.extract[t.dataset.rv][t.dataset.fid] = t.value;
    touch();
    if (t.dataset.fid === 'ma_type' && t.dataset.rv !== 'final') renderReviewer(t.dataset.rv);
    return;
  }
  if (t.dataset.note) {
    const r = rec(t.dataset.rid);
    const s = r.screen[UI.stage];
    if (!s[t.dataset.note]) s[t.dataset.note] = { d: null, reason: '', note: '', ts: Date.now() };
    s[t.dataset.note].note = t.value;
    touch(); return;
  }
  if (t.id === 'repQ') { UI.repQ = t.value; repDebounced(); return; }
  if (t.id === 'wq') { UI.q = t.value; if (UI.workMode === 'board') boardSearchDebounced(); else renderListDebounced(); return; }
  if (t.id === 'findInput') { UI.find = t.value; UI.findIdx = 0; findDebounced(); return; }
  if (t.id === 'csvDelim') { UI.delim = t.value; return; }
});

const repDebounced = debounce(() => { renderReport(); const el = $('#repQ'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 200);
const boardSearchDebounced = debounce(() => { renderBoard(); const el = $('#wq'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 200);
const renderListDebounced = debounce(() => { renderList(); }, 150);
const findDebounced = debounce(() => {
  const r = rec(UI.sel);
  if (!r) return;
  const mode = UI.stage === 'ex' && UI.panelTab === 'cons' ? 'cons' : UI.docMode;
  if (mode === 'pdf') return;
  renderDocContent(r, UI.textCache[r.id], mode);
  updateFind();
}, 200);

function renderPrismaKeepFocus(id) {
  const pos = $('#' + id) && $('#' + id).selectionStart;
  renderPrisma();
  const el = $('#' + id);
  if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) { /* number input */ } }
}

document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'asSelect') { UI.as = t.value; UI.reveal = { r1: false, r2: false }; if (UI.view === 'work') renderWork(); return; }
  if (t.dataset.srcRename !== undefined) {
    const from = t.dataset.srcRename, to = t.value.trim();
    if (!to || to === from) { t.value = from; return; }
    const merged = S.records.some(r => r.source === to) || (S.skipped || []).some(x => x.source === to);
    S.records.forEach(r => { if (r.source === from && r.sourceCat !== 'other') r.source = to; });
    (S.skipped || []).forEach(x => { if (x.source === from && x.cat !== 'other') x.source = to; });
    S.batches.forEach(b => { if (b.name === from && b.cat !== 'other') b.name = to; });
    touch(); renderPrisma();
    toast(merged ? `"${from}" digabung ke "${to}".` : `Nama sumber diganti: "${from}" → "${to}".`, 'ok');
    return;
  }
  if (t.dataset.srcCat !== undefined) {
    const name = t.dataset.srcCat, cat = t.value;
    S.records.forEach(r => { if (r.source === name && r.sourceCat !== 'other') r.sourceCat = cat; });
    (S.skipped || []).forEach(x => { if (x.source === name && x.cat !== 'other') x.cat = cat; });
    S.batches.forEach(b => { if (b.name === name && b.cat !== 'other') b.cat = cat; });
    touch(); renderPrisma(); toast(`"${name}" sekarang dihitung sebagai ${cat === 'register' ? 'register' : 'basis data'}.`, 'ok');
    return;
  }
  if (t.dataset.langAllow) {
    const L = S.criteria.lang = S.criteria.lang || { on: true, allowed: ['en'], label: '' };
    const k = t.dataset.langAllow;
    L.allowed = (L.allowed || []).filter(x => x !== k).concat(t.checked ? [k] : []);
    touch(); renderProject(); return;
  }
  if (t.id === 'ftAuto') { S.project.ftAuto = t.checked; touch(); return; }
  if (t.id === 'ftMin') { S.project.ftMinHits = Math.max(1, Math.min(50, parseInt(t.value, 10) || 5)); touch(); return; }
  if (t.id === 'impAuto') { UI.importAuto = t.checked; try { localStorage.setItem('telaah-srcauto', t.checked ? '1' : '0'); } catch (x) { /* abaikan */ } return; }
  if (t.dataset.draftSrc !== undefined && UI.importDraft) {
    const d = projDbs().find(x => x.name === t.value);
    Object.assign(UI.importDraft, { source: t.value, cat: d ? d.cat : UI.importDraft.cat, auto: null });
    renderImport(); return;
  }
  if (t.dataset.batchSrc) {
    const b = S.batches.find(x => x.id === t.dataset.batchSrc);
    if (!b) return;
    const to = t.value, d = projDbs().find(x => x.name === to);
    const cat = d && b.cat !== 'other' && d.cat !== 'other' ? d.cat : b.cat;
    S.records.forEach(r => { if (r.batch === b.id) { r.source = to; r.sourceCat = cat; } });
    (S.skipped || []).forEach(x => { if (x.batch === b.id) { x.source = to; x.cat = cat; } });
    const from = b.name;
    Object.assign(b, { name: to, cat }); delete b.auto;
    touch(); renderImport(); toast(`${b.file}: sumber diganti "${from}" → "${to}". Diagram PRISMA ikut diperbarui.`, 'ok');
    return;
  }
  if (t.id === 'autoNext') { UI.autoNext = t.checked; try { localStorage.setItem('telaah-autonext', t.checked ? '1' : '0'); } catch (x) { /* abaikan */ } return; }
  if (t.id === 'wfilter') { UI.filter = t.value; renderWork(); return; }
  if (t.id === 'wsort') { UI.sort = t.value; renderWork(); return; }
  if (t.id === 'fileInput') { handleFiles(Array.from(t.files)); return; }
  if (t.id === 'impMatch') { UI.importMatch = t.checked; return; }
  if (t.id === 'csvDelim') { UI.delim = t.value; return; }
  if (t.id === 'exDual') {
    S.project.exDual = t.checked; touch();
    UI.as = t.checked ? 'both' : 'r1';
    syncAs(); if (UI.view === 'work') renderWork(); else renderProject();
    toast(t.checked ? 'Ekstraksi oleh 2 reviewer: pilih "Bekerja sebagai" di kanan atas, lalu tetapkan nilai final di tab Konsensus.' : 'Ekstraksi kembali oleh satu reviewer.', 'ok');
    return;
  }
  const ac = t.dataset.actionChange;
  const r = rec(UI.sel);
  if (!ac || !r) return;
  if (ac === 'reason') {
    r.screen[UI.stage][t.dataset.rv].reason = t.value; touch();
    if (t.value && UI.stage === 'ft' && r.screen.ft[t.dataset.rv].d === 'exclude') { advanceAfterDecision(r); renderList(); renderPanels(); }
    else { renderReviewer(t.dataset.rv); renderPanelA(); }
  }
  if (ac === 'not-retrieved') { r.notRetrieved = t.checked; touch(); refreshStageCounts(); }
  if (ac === 'ex-done') { r.extract.done[t.dataset.rv] = t.checked; touch(); renderList(); renderPanels(); }
  if (ac === 'cons-done') { r.extract.done.final = t.checked; touch(); renderList(); renderPanelA(); refreshStageCounts(); }
});

document.addEventListener('toggle', e => { if (e.target.dataset && e.target.dataset.actionToggle === 'hits') UI.hitsOpen = e.target.open; }, true);

document.addEventListener('focusin', e => {
  const t = e.target;
  if (t.dataset.fid && (t.dataset.rv === 'r1' || t.dataset.rv === 'r2')) {
    UI.activeField[t.dataset.rv] = t.dataset.fid;
    $$(`#panel-${t.dataset.rv} [data-fwrap]`).forEach(w => w.classList.toggle('active', w.dataset.fwrap === t.dataset.fid));
  }
});

/* ---------- Seleksi teks → bilah kutip ---------- */
document.addEventListener('mouseup', e => {
  if (e.target.closest('#selbar')) return;
  setTimeout(() => {
    const sel = window.getSelection();
    const bar = $('#selbar');
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { bar.hidden = true; return; }
    const anc = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentNode);
    const inAp = !!(anc && anc.closest('#apRBody'));
    if (!anc || !(inAp || anc.closest('#docContent'))) { bar.hidden = true; return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    UI.selText = sel.toString().trim().slice(0, 4000);
    bar.hidden = false;
    $$('#selbar [data-rv]').forEach(b => { b.textContent = revName(b.dataset.rv); b.disabled = !canEdit(b.dataset.rv); b.hidden = inAp || (solo() && b.dataset.rv === 'r2'); });
    // di pembaca Penilaian kualitas: kutipan menjadi bukti butir MMAT
    $$('#selbar .sb-ex').forEach(el => { if (!el.dataset.rv) el.hidden = inAp; });
    $$('#selbar .sb-ap').forEach(el => { el.hidden = !inAp; });
    if (inAp) { const pg = anc.closest('.page-txt'); UI.selPage = pg ? (pg.querySelector('.pg-no') || {}).textContent || '' : ''; }
    const bw = bar.offsetWidth;
    bar.style.left = Math.max(8, Math.min(window.innerWidth - bw - 8, rect.left + rect.width / 2 - bw / 2)) + 'px';
    bar.style.top = Math.max(8, rect.top - bar.offsetHeight - 8) + 'px';
  }, 10);
});
document.addEventListener('scroll', () => { $('#selbar').hidden = true; }, true);

/* ---------- Tooltip grafik ---------- */
document.addEventListener('mousemove', e => {
  const g = e.target.closest && e.target.closest('[data-tip]');
  const tip = $('#tooltip');
  if (!g) { tip.hidden = true; return; }
  tip.textContent = g.dataset.tip;
  tip.hidden = false;
  tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 14) + 'px';
  tip.style.top = (e.clientY + 14) + 'px';
});

/* ---------- Seret & lepas file ---------- */
document.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('#dropZone'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('#dropZone'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', e => {
  const z = e.target.closest && e.target.closest('#dropZone');
  if (!z) return;
  e.preventDefault(); z.classList.remove('over');
  const entries = Array.from(e.dataTransfer.items || []).map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (entries.some(x => x.isDirectory)) filesFromEntries(entries).then(fs => { if (!fs.length) toast('Folder tidak berisi file yang bisa diimpor.', 'warn'); else handleFiles(fs); });
  else handleFiles(Array.from(e.dataTransfer.files));
});
// Seret folder: baca semua file di dalamnya (termasuk subfolder)
const IMPORT_EXT = /\.(csv|tsv|txt|ris|nbib|medline|bib|pdf)$/i;
async function filesFromEntries(entries) {
  const out = [];
  const walk = async en => {
    if (en.isFile) { const f = await new Promise((ok, no) => en.file(ok, no)).catch(() => null); if (f && IMPORT_EXT.test(f.name)) out.push(f); return; }
    if (!en.isDirectory) return;
    const rd = en.createReader();
    for (;;) {
      const batch = await new Promise((ok, no) => rd.readEntries(ok, no)).catch(() => []);
      if (!batch.length) break;
      for (const x of batch) await walk(x);
    }
  };
  for (const en of entries) await walk(en);
  return out;
}
document.addEventListener('change', e => {
  if (e.target.id !== 'folderInput') return;
  const fs = Array.from(e.target.files || []).filter(f => IMPORT_EXT.test(f.name));
  e.target.value = '';
  if (!fs.length) { toast('Folder tidak berisi file yang bisa diimpor.', 'warn'); return; }
  handleFiles(fs);
});

/* ---------- Pintasan keyboard ---------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'dbNew') { e.preventDefault(); const b = $('[data-action="db-add"]'); if (b) b.click(); return; }
  if (UI.view !== 'work' || UI.workMode === 'board') return;
  const t = e.target;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) {
    if (e.key === 'Enter' && t.id === 'findInput') { e.preventDefault(); const n = $$('#docContent mark.hl-find').length; if (n) { UI.findIdx = (UI.findIdx + (e.shiftKey ? -1 : 1) + n) % n; updateFind(); } }
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'j' || k === 'arrowdown') { e.preventDefault(); move(1); }
  else if (k === 'k' || k === 'arrowup') { e.preventDefault(); move(-1); }
  else if (k === '/') { e.preventDefault(); const f = $('#findInput'); if (f) f.focus(); }
  else if ((UI.as !== 'both' || solo()) && UI.stage !== 'ex' && ['i', 'e', 'm'].includes(k)) decide(UI.as, { i: 'include', e: 'exclude', m: 'maybe' }[k]);
});

/* ---------- Sistem Lisensi SLR-In Aja ---------- */
let slrUser = null;
try { slrUser = JSON.parse(localStorage.getItem('slr-user') || 'null'); } catch (e) { slrUser = null; }

let slrLicense = null;
try {
  if (new URLSearchParams(window.location.search).has('reset') || new URLSearchParams(window.location.search).has('ganti')) {
    localStorage.removeItem('slr-license');
    localStorage.removeItem('slr-user');
    slrLicense = null;
    slrUser = null;
  } else {
    slrLicense = JSON.parse(localStorage.getItem('slr-license') || 'null');
  }
} catch (e) { slrLicense = null; }

function verifySLRLic() {
  if (!window.SLRLicense) return { active: false, message: 'Modul lisensi belum siap.' };
  return window.SLRLicense.checkLicenseStatus(slrLicense);
}

function applySLRLicUI() {
  const licStatus = verifySLRLic();
  const hasValidLic = licStatus && licStatus.active;
  const isUnlocked = !!(slrUser && hasValidLic);

  const modal = $('#licModal');
  const badge = $('#licBadge');
  const badgeText = $('#licBadgeText');

  if (modal) {
    modal.style.display = isUnlocked ? 'none' : 'flex';
    if (!isUnlocked && slrUser) {
      if ($('#licName') && !$('#licName').value) $('#licName').value = slrUser.nama || '';
      if ($('#licEmail') && !$('#licEmail').value) $('#licEmail').value = slrUser.email || '';
    }
  }

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
      if (slrUser && !hasValidLic && $('#licErr')) {
        $('#licErr').style.display = 'block';
        $('#licErr').textContent = licStatus.expired 
          ? 'Masa berlaku lisensi SLR-In Aja Anda telah habis. Silakan hubungi pemilik untuk perpanjangan.' 
          : 'Kunci lisensi SLR-In Aja belum aktif.';
      }
    }
  }
}

const btnDeactLic = $('#btnDeactLic');
if (btnDeactLic) {
  btnDeactLic.addEventListener('click', () => {
    if (confirm('Apakah Anda ingin mengganti kunci lisensi SLR-In Aja dengan kunci lain?')) {
      slrLicense = null;
      localStorage.removeItem('slr-license');
      applySLRLicUI();
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

    if (!window.SLRLicense) {
      if (errEl) { errEl.textContent = 'Modul lisensi sedang memuat. Coba lagi.'; errEl.style.display = 'block'; }
      return;
    }

    const valResult = window.SLRLicense.validateLicense(key);
    if (!valResult.valid) {
      if (errEl) { errEl.textContent = valResult.message || 'Kunci lisensi tidak valid.'; errEl.style.display = 'block'; }
      $('#licKey')?.focus();
      return;
    }

    slrLicense = {
      key: valResult.key,
      activatedAt: new Date().toISOString(),
      label: valResult.label,
      days: valResult.days,
      durationCode: valResult.durationCode,
      isMaster: !!valResult.isMaster
    };
    localStorage.setItem('slr-license', JSON.stringify(slrLicense));

    slrUser = { nama, email, loginAt: new Date().toISOString() };
    localStorage.setItem('slr-user', JSON.stringify(slrUser));

    applySLRLicUI();
    toast('Lisensi SLR-In Aja berhasil diaktifkan!', 'ok');
  });
}

/* ---------- Mulai ---------- */
(async function init() {
  applySLRLicUI();
  await DB.open();
  let st = null;
  try { st = await DB.get('kv', 'state'); } catch (e) { console.warn(e); }
  const fresh = !st;
  if (fresh) st = sampleState();
  S = Object.assign(defaultState(st.project ? st.project.type : 'slr'), st);
  refreshChrome();
  setSaved(DB.db ? 'Tersimpan di peramban' : 'Mode memori (tidak tersimpan)', !DB.db);
  if (fresh) touch();
  let v = 'work';
  try { v = localStorage.getItem('telaah-view') || 'work'; UI.workMode = localStorage.getItem('telaah-wmode') || 'panel'; UI.autoNext = localStorage.getItem('telaah-autonext') !== '0'; UI.importAuto = localStorage.getItem('telaah-srcauto') !== '0'; UI.lang = Tr.pref(); } catch (e) { /* abaikan */ }
  show(RENDER[v] ? v : 'work');
  // PDF/teks milik studi Exclude yang sudah dibersihkan (atau rekaman yang sudah dihapus) dibuang dari penyimpanan
  await storageSweep().then(s => { if (s.pdfs + s.texts) toast(`Penyimpanan dirapikan: ${s.pdfs} PDF dan ${s.texts} teks dari studi Exclude dihapus${s.bytes ? ` (${mb(s.bytes)})` : ''}.`, 'ok'); }).catch(e => console.warn(e));
  preloadTexts().then(n => { if (n && UI.view === 'work') renderList(); }).then(backfillHashes);
  if (!window.pdfjsLib) toast('PDF.js gagal dimuat. Fitur PDF butuh koneksi internet.', 'warn');
})();

// Klik kotak di diagram PRISMA: buka editornya
document.addEventListener('click', e => {
  const g = e.target.closest && e.target.closest('#prismaPaper [data-box]');
  if (!g) return;
  const k = g.getAttribute('data-box'), d = $('#prb-' + k);
  UI.prBox = k;
  if (!d) return;
  $$('.pr-box[open]').forEach(x => { if (x !== d) x.open = false; });
  d.open = true;
  d.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const ta = $('#prt-' + k); if (ta) ta.focus({ preventScroll: true });
});
