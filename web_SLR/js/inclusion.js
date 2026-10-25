/* Telaah SLR — unduhan hasil Inklusi teks lengkap & perapian penyimpanan (PDF/teks yang tidak dipakai lagi) */
'use strict';

/* ---------- Hasil Inklusi teks lengkap ---------- */
// Studi yang lolos teks lengkap (status akhir Inklusi), urut penulis lalu tahun
function incList() {
  return S.records.filter(r => !r.archived && overallStatus(r).k === 'inc')
    .sort((a, b) => String(a.authors).localeCompare(String(b.authors)) || String(a.year).localeCompare(String(b.year)));
}
function incCrit() { return (S.criteria.include || []).filter(c => Criteria.parseTerms(c.terms).length); }
// Teks yang dipakai menghitung kriteria: isi PDF tanpa daftar pustaka; tanpa PDF, judul + abstrak
function incText(r) { return r.hasText && UI.textCache[r.id] ? tiabText(r) + '\n' + ftBody(r) : tiabText(r); }
function incSrc(r) { return r.hasText && UI.textCache[r.id] ? 'Teks lengkap PDF (' + (r.pages || '?') + ' hlm., tanpa daftar pustaka)' : 'Judul + abstrak (PDF tidak tersimpan)'; }
function incNote(r) { return ['r1', 'r2'].map(v => r.screen.ft[v] && r.screen.ft[v].note).filter(Boolean).join(' | '); }
// ID studi dari isian ekstraksi (kolom study_id atau berlabel "ID studi"), selain itu Penulis, Tahun
function incSidField() { return S.fields.find(f => f.id === 'study_id') || S.fields.find(f => /\bid[ _-]?studi|study[ _-]?id/i.test(f.id + ' ' + f.label)); }
function incExVals(r) { const f = exFinal(r) || {}; return exDone(r) ? f : { ...(r.extract.r1 || {}), ...f }; }
function incSid(r) { const f = incSidField(), v = f && incExVals(r)[f.id]; return v || ((String(r.authors || '').split(/;|,/)[0] || 'Anonim').trim() + ', ' + (r.year || 't.t.')); }

/* Tabel karakteristik studi (isian ekstraksi) — acuan langsung untuk tabel di naskah */
function incExFields() { return S.fields.filter(f => f.group !== 'ma' || S.project.type === 'meta'); }
function incExRows() {
  const fl = incExFields();
  const head = ['No', 'ID studi', ...fl.map(f => f.label), 'Status ekstraksi', 'Judul', 'DOI'];
  return [head, ...incList().map((r, i) => { const v = incExVals(r); return [i + 1, incSid(r), ...fl.map(f => v[f.id] ?? ''), exDone(r) ? 'selesai' : 'draf (belum ditandai selesai)', r.title, r.doi]; })];
}
// Rekap pilihan per kolom: n dan % — bahan paragraf hasil ("x dari N studi berdesain ...")
function incExSumRows() {
  const list = incList(), N = list.length, out = [['Kolom', 'Kategori', 'Jumlah studi', '% dari ' + N + ' studi', 'Studi (ID)']];
  incExFields().filter(f => f.type === 'select' || f.type === 'multi').forEach(f => {
    const m = new Map((f.options || []).map(o => [o, []])), empty = [];
    list.forEach(r => {
      const vals = (f.type === 'multi' ? String(incExVals(r)[f.id] || '').split(';') : [String(incExVals(r)[f.id] || '')]).map(x => x.trim()).filter(Boolean);
      if (!vals.length) empty.push(incSid(r));
      vals.forEach(v => { if (!m.has(v)) m.set(v, []); m.get(v).push(incSid(r)); });
    });
    m.forEach((ids, o) => out.push([f.label, o, ids.length, N ? Math.round(ids.length / N * 1000) / 10 : 0, ids.join('; ')]));
    if (empty.length) out.push([f.label, '(belum diisi)', empty.length, N ? Math.round(empty.length / N * 1000) / 10 : 0, empty.join('; ')]);
  });
  return out;
}

function incRows() {
  const crit = incCrit();
  const head = ['No', 'ID studi', 'Penulis', 'Tahun', 'Judul', 'Jurnal', 'DOI', 'Tier', 'Sumber basis data', 'PDF tersimpan',
    ...crit.map(c => c.label + ' (sebutan)'), 'Kriteria inklusi terpenuhi', 'Kata eksklusi ditemukan', 'Penanda', 'Dasar penghitungan', 'Catatan teks lengkap',
    ...(typeof apReportCell === 'function' ? ['Penilaian kualitas'] : []), 'Nama file PDF'];
  const rows = incList().map((r, i) => {
    const ev = Criteria.evaluate(incText(r), { ...S.criteria, include: crit });
    const exc = ev.exc.filter(x => x.n).map(x => x.label + ' ' + x.n + '×').join('; ');
    return [i + 1, incSid(r), r.authors, r.year, r.title, r.journal, r.doi, r.tier ? 'Tier ' + r.tier : '', r.source, r.hasPdf ? 'ya' : 'tidak',
      ...ev.inc.map(x => x.n), ev.incMatched + '/' + ev.total, exc, FLAG_META[ev.flag] ? FLAG_META[ev.flag].label : ev.flag, incSrc(r), incNote(r),
      ...(typeof apReportCell === 'function' ? [apReportCell(r)] : []), r.hasPdf ? incPdfName(r, i) : ''];
  });
  return [head, ...rows];
}

// Rincian per istilah: istilah mana yang muncul dan berapa kali, per studi per kriteria
function incTermRows() {
  const crit = incCrit(), out = [['No', 'ID studi', 'Kriteria', 'Istilah yang ditemukan (jumlah)', 'Total sebutan']];
  incList().forEach((r, i) => {
    const C = { ...S.criteria, include: crit }, txt = incText(r), ev = Criteria.evaluate(txt, C);
    // total = sebutan kriteria (istilah yang tumpang-tindih, mis. "type 2 diabetes" dan diabet*, dihitung sekali)
    Criteria.termHits(txt, C).filter(c => c.kind === 'inc').forEach((c, k) => {
      const hit = c.terms.filter(t => t.n).sort((a, b) => b.n - a.n);
      out.push([i + 1, incSid(r), c.label, hit.map(t => t.t + ' (' + t.n + ')').join('; ') || '— tidak ditemukan', ev.inc[k].n]);
    });
  });
  return out;
}

// Rekap per kriteria: berapa studi inklusi yang menyebutnya
function incSumRows() {
  const crit = incCrit(), list = incList();
  const evs = list.map(r => Criteria.evaluate(incText(r), { ...S.criteria, include: crit }));
  const out = [['Kriteria inklusi', 'Istilah pencarian', 'Studi yang menyebut', '% dari ' + list.length + ' studi', 'Rata-rata sebutan', 'Wajib']];
  const keys = typeof keyCrit === 'function' ? keyCrit() : [];
  crit.forEach((c, k) => {
    const n = evs.map(e => e.inc[k].n), has = n.filter(x => x > 0).length;
    out.push([c.label, Criteria.parseTerms(c.terms).join(', '), has, list.length ? Math.round(has / list.length * 100) : 0, list.length ? +(n.reduce((a, b) => a + b, 0) / list.length).toFixed(1) : 0, keys.includes(c.label) ? 'ya' : '']);
  });
  const tiers = {};
  list.forEach(r => { const t = r.tier ? 'Tier ' + r.tier : 'Tanpa tier'; tiers[t] = (tiers[t] || 0) + 1; });
  out.push([], ['Jumlah studi inklusi', list.length], ['Dengan PDF tersimpan', list.filter(r => r.hasPdf).length], ...Object.entries(tiers).sort().map(([k, v]) => [k, v]));
  out.push([], ['Dibuat', new Date().toLocaleString('id-ID'), S.project.title]);
  return out;
}

// Nama file PDF di ZIP: 001_Penulis_Tahun_TierA.pdf
function incPdfName(r, i) {
  const au = (String(r.authors || '').split(/;|,/)[0] || 'Anonim').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 30) || 'Anonim';
  return String(i + 1).padStart(3, '0') + '_' + au + '_' + (r.year || 'tt') + (r.tier ? '_Tier' + r.tier : '') + '.pdf';
}

async function incWorkbook() {
  const XLSX = await SettingsIO.loadLib('XLSX');
  const wb = XLSX.utils.book_new();
  const add = (name, aoa, cols) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = cols.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
  const main = incRows();
  const ex = incExRows();
  add('Karakteristik studi', ex, ex[0].map((h, i) => i === 0 ? 5 : i === 1 ? 24 : i >= ex[0].length - 2 ? 40 : 22));
  add('Rekap ekstraksi', incExSumRows(), [30, 36, 12, 12, 70]);
  add('Studi inklusi', main, main[0].map((h, i) => [5, 22, 30, 7, 60, 28, 26, 9, 18, 9].concat(Array(main[0].length).fill(14))[i] || 14));
  add('Rincian istilah', incTermRows(), [5, 22, 40, 70, 10]);
  add('Rekap kriteria', incSumRows(), [40, 60, 14, 12, 14, 8]);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

async function exportInclusion(fmt) {
  const list = incList();
  if (!list.length) { toast('Belum ada studi berstatus Inklusi setelah teks lengkap.', 'warn'); return; }
  const base = slug(S.project.title).slice(0, 40) + '-inklusi-teks-lengkap-' + today();
  try {
    toast('Menyiapkan hasil inklusi (' + list.length + ' studi)…');
    await preloadTexts();
    if (fmt === 'csv') { downloadText(toCSV(incRows(), delim()), base + '.csv', 'text/csv'); return; }
    if (fmt === 'xlsx') {
      downloadBlob(new Blob([await incWorkbook()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), base + '.xlsx');
      toast('Excel diunduh: Studi inklusi, Rincian istilah, Rekap kriteria.', 'ok');
      return;
    }
    // ZIP: Excel + semua PDF studi inklusi yang masih tersimpan
    const JSZip = await SettingsIO.loadLib('JSZip');
    const zip = new JSZip();
    zip.file(base + '.xlsx', await incWorkbook());
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r.hasPdf) continue;
      const b = await DB.get('pdfs', r.id);
      if (b) { zip.file('PDF/' + incPdfName(r, i), b); n++; }
    }
    downloadBlob(await zip.generateAsync({ type: 'blob' }), base + '.zip');
    toast(`ZIP diunduh: Excel ${list.length} studi + ${n} PDF${list.length - n ? ` (${list.length - n} studi tanpa PDF tersimpan)` : ''}.`, 'ok');
  } catch (e) { console.error(e); toast('Gagal membuat unduhan: ' + e.message + (fmt === 'csv' ? '' : '. Coba unduh CSV.'), 'bad'); }
}

function inclusionCard() {
  const list = incList(), pdf = list.filter(r => r.hasPdf).length, dis = list.length ? '' : 'disabled';
  return `<section class="card inc-card">
    <h2>Hasil Inklusi teks lengkap</h2>
    <p class="hint">Hanya studi yang lolos pembacaan teks lengkap (<b>${list.length} studi</b>, ${pdf} dengan PDF). Tiap studi memuat jumlah sebutan setiap kriteria inklusi di teks lengkap (tanpa daftar pustaka), kata eksklusi yang ditemukan, tier, dan catatan Anda. Excel berisi lima lembar: <b>Karakteristik studi</b> (isian ekstraksi data per studi, siap jadi tabel naskah), <b>Rekap ekstraksi</b> (jumlah &amp; % per kategori), Studi inklusi, Rincian istilah, Rekap kriteria.</p>
    <div class="btn-row">
      <button class="btn" data-action="exp-inc" data-fmt="xlsx" ${dis}>Unduh Excel</button>
      <button class="btn ghost" data-action="exp-inc" data-fmt="zip" ${dis} title="Excel + semua PDF studi inklusi dalam satu ZIP">Excel + PDF (ZIP)</button>
      <button class="btn ghost" data-action="exp-inc" data-fmt="csv" ${dis}>CSV</button>
    </div>
  </section>`;
}

/* ---------- Perapian penyimpanan ---------- */
// PDF, teks, dan terjemahan hanya boleh ada untuk rekaman yang masih aktif (belum dibersihkan).
// Sisanya (rekaman Exclude yang sudah dibersihkan, rekaman yang sudah dihapus) dibuang dari IndexedDB.
function liveIds() { return new Set(S.records.filter(r => !r.archived).map(r => r.id)); }
async function storageStray() {
  const live = liveIds(), out = { pdfs: [], texts: [] };
  for (const st of ['pdfs', 'texts']) {
    let keys = [];
    try { keys = await DB.keys(st); } catch (e) { console.warn(e); }
    out[st] = keys.filter(k => !live.has(String(k).split('|')[0]));
  }
  return out;
}
async function storageSweep() {
  const s = await storageStray();
  let bytes = 0;
  for (const k of s.pdfs) { try { const b = await DB.get('pdfs', k); if (b && b.size) bytes += b.size; } catch (e) { /* abaikan */ } await DB.del('pdfs', k); }
  for (const k of s.texts) await DB.del('texts', k);
  const ids = new Set([...s.pdfs, ...s.texts].map(k => String(k).split('|')[0]));
  let fixed = 0;
  S.records.forEach(r => {
    if (!r.archived) return;
    if (ids.has(r.id)) { delete UI.textCache[r.id]; delete UI.pdfCache[r.id]; if (UI.trCache) delete UI.trCache[r.id]; }
    if (r.hasPdf || r.hasText) { r.hasPdf = false; r.hasText = false; fixed++; }
  });
  if (fixed) touch();
  return { pdfs: s.pdfs.length, texts: s.texts.length, bytes, fixed };
}
// Abstrak rekaman yang sudah dibersihkan masih dipakai model ✨ Saran selama Judul & abstrak belum selesai
function absSlimOk() { return !stageRecords('ta').some(r => !r.archived && !effective(r, 'ta')); }
function absSlim() {
  if (!absSlimOk()) return 0;
  let n = 0;
  S.records.forEach(r => { if (r.archived && r.abstract) { r.abstract = ''; n++; } });
  if (n) { UI.absClean = null; UI.flagMemo = null; touch(); }
  return n;
}
async function storageInfo() {
  const out = { pdf: 0, text: 0, usage: null };
  try { out.pdf = (await DB.keys('pdfs')).length; out.text = (await DB.keys('texts')).filter(k => !String(k).includes('|')).length; } catch (e) { /* abaikan */ }
  try { if (navigator.storage && navigator.storage.estimate) out.usage = (await navigator.storage.estimate()).usage; } catch (e) { /* abaikan */ }
  out.stray = await storageStray();
  out.absArch = S.records.filter(r => r.archived && r.abstract).length;
  return out;
}
function mb(b) { return (b / 1048576).toFixed(1) + ' MB'; }
function storageCard() {
  return `<section class="card" id="storageCard">
    <h2>Penyimpanan</h2>
    <div id="storageInfo" class="small muted">Menghitung…</div>
  </section>`;
}
async function renderStorageInfo() {
  const el = $('#storageInfo');
  if (!el) return;
  const i = await storageInfo();
  const stray = i.stray.pdfs.length + i.stray.texts.length;
  const slim = i.absArch && absSlimOk();
  el.classList.remove('muted');
  el.innerHTML = `<p>${i.usage != null ? 'Dipakai aplikasi di peramban ini: <b>' + mb(i.usage) + '</b> · ' : ''}${i.pdf} PDF dan ${i.text} teks lengkap tersimpan.</p>
    ${stray ? `<p class="txt-conf"><b>${i.stray.pdfs.length} PDF dan ${i.stray.texts.length} teks/terjemahan</b> milik studi yang sudah di-Exclude dan dibersihkan (atau sudah dihapus) masih tersimpan.</p>` : '<p class="txt-ok">✓ Tidak ada PDF atau teks dari studi Exclude yang tersisa.</p>'}
    ${i.absArch ? `<p class="small">${i.absArch} rekaman Exclude yang sudah dibersihkan masih menyimpan abstrak. ${slim ? 'Abstraknya ikut dihapus saat dirapikan.' : 'Abstrak itu masih dipakai model ✨ Saran, jadi baru dihapus setelah semua Judul &amp; abstrak diputuskan.'}</p>` : ''}
    <p class="small muted">Judul, keputusan, dan alasan rekaman Exclude tetap disimpan (beberapa KB) agar angka PRISMA dan Laporan benar, dan agar studi itu tidak masuk lagi saat impor ulang.</p>
    <div class="btn-row"><button class="btn ${stray || slim ? '' : 'ghost'}" data-action="storage-sweep" ${stray || slim ? '' : 'disabled'}>🧹 Rapikan penyimpanan</button></div>`;
}
async function storageTidy() {
  const btn = $('[data-action="storage-sweep"]'); if (btn) { btn.disabled = true; btn.textContent = 'Merapikan…'; }
  const s = await storageSweep(), a = absSlim();
  await renderStorageInfo();
  toast(s.pdfs + s.texts + a ? `Dihapus dari penyimpanan: ${s.pdfs} PDF, ${s.texts} teks/terjemahan${a ? `, abstrak ${a} rekaman Exclude` : ''}${s.bytes ? ` · ${mb(s.bytes)} dibebaskan` : ''}.` : 'Penyimpanan sudah rapi.', 'ok');
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  if (a.dataset.action === 'exp-inc') exportInclusion(a.dataset.fmt);
  else if (a.dataset.action === 'storage-sweep') storageTidy();
});

/* ---------- Reset keputusan Teks lengkap (bisa dibatalkan) ---------- */
// Rekaman aktif di tahap Teks lengkap yang sudah punya keputusan; scope 'inc' = hanya yang berstatus Include
function ftResetList(scope) {
  return S.records.filter(r => !r.archived && inFT(r) && (scope === 'inc' ? effective(r, 'ft') === 'include' : ['r1', 'r2', 'final'].some(k => r.screen.ft[k])));
}
function ftResetCtl() {
  return UI.stage === 'ft' ? `<button class="btn sm ghost" data-action="ft-reset-ask" title="Kosongkan keputusan teks lengkap agar studi bisa disaring ulang dengan PDF">Reset teks lengkap…</button>` : '';
}
function ftResetBanner() {
  const U = S.ftUndo;
  if (UI.ftResetAsk) {
    const inc = ftResetList('inc').length, all = ftResetList('all').length;
    return `<div class="cbanner conf"><span><b>Reset keputusan Teks lengkap?</b> Studi kembali ke "belum diputuskan" di tahap Teks lengkap sehingga bisa disaring ulang (mis. setelah PDF diunggah). Keputusan Judul &amp; abstrak dan isian ekstraksi tidak dihapus. Rekaman Exclude yang sudah dibersihkan tidak ikut. Reset bisa dibatalkan.</span>
      <span class="cb-actions"><button class="btn sm" data-action="ft-reset-go" data-scope="inc" ${inc ? '' : 'disabled'}>Hanya yang Include (${inc})</button><button class="btn sm ghost" data-action="ft-reset-go" data-scope="all" ${all ? '' : 'disabled'}>Semua keputusan (${all})</button><button class="btn sm ghost" data-action="ft-reset-cancel">Batal</button></span></div>`;
  }
  if (U && UI.stage === 'ft') return `<div class="cbanner"><span>Keputusan teks lengkap <b>${U.n} studi</b> direset pada ${esc(U.date)}. Unggah PDF di <b>Impor</b> (centang pencocokan ke rekaman yang ada), lalu saring ulang di sini.</span>
      <span class="cb-actions"><button class="btn sm ghost" data-action="ft-reset-undo">Batalkan reset</button><button class="btn sm ghost" data-action="ft-reset-forget" title="Sembunyikan pesan ini; reset tidak bisa dibatalkan lagi">Tutup</button></span></div>`;
  return '';
}
function ftResetGo(scope) {
  const list = ftResetList(scope);
  const data = {};
  list.forEach(r => {
    data[r.id] = { ft: JSON.parse(JSON.stringify(r.screen.ft)), auto: r.ftAutoRes };
    r.screen.ft = { r1: null, r2: null, final: null };
    delete r.ftAutoRes;
  });
  S.ftUndo = { date: new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), n: list.length, scope, data };
  UI.ftResetAsk = false; UI.filter = 'all';
  touch();
  toast(list.length + ' studi kembali ke "belum diputuskan" di Teks lengkap.', 'ok');
}
function ftResetUndo() {
  const U = S.ftUndo; if (!U) return;
  let n = 0;
  Object.entries(U.data).forEach(([id, o]) => { const r = rec(id); if (!r) return; r.screen.ft = o.ft; if (o.auto) r.ftAutoRes = o.auto; n++; });
  delete S.ftUndo; touch();
  toast('Reset dibatalkan: keputusan teks lengkap ' + n + ' studi dikembalikan.', 'ok');
}
