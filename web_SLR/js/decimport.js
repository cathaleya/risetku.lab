/* Telaah SLR — impor keputusan skrining dari CSV (mis. Skrining_PDF_MMAT.csv: Judul, DOI, Keputusan_Final_Penulis, Catatan) */
'use strict';

const DEC_COL = /keputusan|decision|status.?akhir|final.?decision|^include$/i;
const DEC_NOTE_COL = /catatan|note|alasan|reason|komentar|comment/i;

function decKind(v) {
  const s = String(v || '').toLowerCase();
  if (/perlu|cek|manual|ragu|maybe|unclear|konfirmasi/.test(s)) return 'maybe';
  if (/eksklusi|exclu|keluar|tolak|reject|^no$|^tidak/.test(s)) return 'exclude';
  if (/inklusi|inclu|masuk|terima|accept|^yes$|^ya$/.test(s)) return 'include';
  return null;
}

// Mengembalikan draf bila CSV punya kolom keputusan + judul/DOI; selain itu null
function decParse(headers, rows, file) {
  const H = headers.map(h => String(h).trim());
  const find = re => H.findIndex(h => re.test(h));
  const di = H.findIndex(h => DEC_COL.test(h) && !/duplikat|dokumen/i.test(h));
  const ti = find(/^(judul|title|article title|document title)$/i);
  const oi = find(/^doi$/i);
  if (di < 0 || (ti < 0 && oi < 0)) return null;
  const ni = H.findIndex((h, i) => i !== di && DEC_NOTE_COL.test(h));
  const si = find(/^(study.?id|id.?studi|kode)$/i);
  const cell = (row, i) => i < 0 ? '' : String((Array.isArray(row) ? row[i] : row[headers[i]]) || '').trim();
  const items = rows.map(row => {
    const raw = cell(row, di), dec = decKind(raw);
    if (!dec) return null;
    const tier = (raw.match(/tier\s*([a-z0-9]+)/i) || [])[1];
    const note = cell(row, ni);
    return { title: cell(row, ti), doi: oi >= 0 ? normDoi(cell(row, oi)) : '', raw, dec, tier: tier ? tier.toUpperCase() : '', note, sid: cell(row, si), code: (note.match(/\b(E\d{1,2})\b/i) || [])[1] || '',
      authors: cell(row, find(/^(penulis|authors?)$/i)), year: cell(row, find(/^(tahun|year)$/i)),
      _row: row, mmat: decMmat(row, cell, H) };
  }).filter(Boolean);
  if (!items.length) return null;
  const exCols = decExCols(H, rows, cell, [di, ni, ti, oi, si]);
  items.forEach(it => { it.ex = Object.fromEntries(exCols.map(c => [c.h, cell(it._row, c.i)])); delete it._row; });
  return { file, col: H[di], items, overwrite: false, exCols, doEx: exCols.length > 0, doAp: items.some(it => it.mmat), rows: items.length };
}

/* ---------- Kolom ekstraksi & MMAT ---------- */
// Kolom identitas, kriteria, dan MMAT tidak masuk formulir ekstraksi
const DEC_SKIP = /^(study.?id|id.?studi|kode|nama.?berkas.*|file.?name|berkas.*|judul|title|penulis|authors?|tahun|year|jurnal|journal|source|doi|jenis.?dokumen|document.?type|status.?duplikat|i\d+(_.*)?|mmat.*|desain.?mmat|skor.*mmat.*|skor.?kualitas.*|keputusan.*|catatan.*)$/i;
function decSlug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40); }
function decExCols(H, rows, cell, used) {
  return H.map((h, i) => ({ h, i })).filter(c => !used.includes(c.i) && c.h && !DEC_SKIP.test(c.h)).map(c => {
    const vals = rows.map(r => cell(r, c.i)).filter(Boolean);
    if (!vals.length) return null;
    const parts = vals.flatMap(v => v.split(';').map(s => s.trim()).filter(Boolean));
    const uniq = [...new Set(parts)], uniqV = new Set(vals);
    const avg = vals.reduce((n, v) => n + v.length, 0) / vals.length;
    let type = 'text';
    if (vals.filter(v => v.includes(';')).length >= vals.length * 0.1 && uniq.length <= 40) type = 'multi';
    else if (uniqV.size <= 12 && vals.length >= 20 && !vals.some(v => /=/.test(v))) type = 'select';
    else if (avg > 60) type = 'textarea';
    const label = c.h.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    const target = decTarget(c.h, label);
    return { h: c.h, i: c.i, label, type, options: type === 'multi' ? uniq : type === 'select' ? [...uniqV] : null, target };
  }).filter(Boolean);
}
// Kolom yang punya padanan di templat formulir; selain itu dibuat kolom baru
function decTarget(h, label) {
  const own = S.fields.find(f => f.id === 'csv_' + decSlug(h) || normTitle(f.label) === normTitle(label));
  if (own) return own.id;
  if (/temuan|finding/i.test(h)) return S.fields.find(f => f.id === 'findings' || f.id === 'key_findings') ? (S.fields.find(f => f.id === 'findings') || S.fields.find(f => f.id === 'key_findings')).id : null;
  return null;
}
function decMmat(row, cell, H) {
  const col = re => cell(row, H.findIndex(h => re.test(h)));
  const des = col(/^desain.?mmat$|^mmat.?(design|category|kategori)$/i), sc = col(/skor.*mmat|mmat.*(skor|score)/i);
  const cat = (des.match(/^\s*([1-5])\b/) || [])[1] || '';
  if (!cat && !sc) return null;
  const yn = v => /^(ya|yes|y)$/i.test(v) ? 'y' : /^(tidak|no|n)$/i.test(v) ? 'n' : v ? 'u' : '';
  const m = sc.match(/(\d+)\s*\/\s*(\d+)/);
  return { cat, design: des, s1: yn(col(/mmat.?s1/i)), s2: yn(col(/mmat.?s2/i)), score: m ? { yes: +m[1], of: +m[2] } : null, raw: sc };
}
const DEC_DESIGN = { 1: 'Kualitatif', 2: 'RCT', 3: 'Kuasi-eksperimen', 4: 'Potong lintang', 5: 'Metode campuran' };
function decCite(it) {
  const a = (it.authors || '').split(';')[0].trim().split(/[\s,]+/)[0];
  const many = (it.authors || '').split(';').filter(s => s.trim()).length > 1;
  return a ? `${a}${many ? ' dkk.' : ''}${it.year ? ', ' + it.year : ''}` : '';
}
// Tambah kolom formulir yang belum ada; opsi pilihan digabung
function decEnsureFields(dr) {
  let added = 0;
  dr.exCols.forEach(c => {
    if (!c.target) {
      const id = 'csv_' + decSlug(c.h);
      let f = S.fields.find(x => x.id === id);
      if (!f) { f = { id, label: c.label, type: c.type, group: 'Dari ' + dr.file.replace(/\.[^.]+$/, '') }; if (c.options) f.options = c.options.slice(); S.fields.push(f); added++; }
      c.target = id;
    }
    const f = S.fields.find(x => x.id === c.target);
    if (f && c.options && (f.type === 'multi' || f.type === 'select')) f.options = [...new Set([...(f.options || []), ...c.options])];
  });
  return added;
}
function decFillEx(r, it, dr, rv) {
  const put = (o, id, v) => { if (v && (dr.overwrite || !String(o[id] || '').trim())) { o[id] = v; return 1; } return 0; };
  const tgt = [r.extract[rv] = r.extract[rv] || {}];
  if (!exSolo()) tgt.push(r.extract.final = r.extract.final || {});
  let n = 0;
  tgt.forEach(o => {
    dr.exCols.forEach(c => { n += put(o, c.target, it.ex[c.h]); });
    if (S.fields.some(f => f.id === 'study_id')) put(o, 'study_id', decCite(it));
    const smp = S.fields.find(f => f.id === 'sample'), nv = dr.exCols.find(c => /sampel|sample/i.test(c.h));
    if (smp && nv) { const m = String(it.ex[nv.h] || '').match(/N\s*=\s*([\d.,]+)/i); if (m) put(o, 'sample', m[1].replace(/[.,](?=\d{3}\b)/g, '')); }
    const des = S.fields.find(f => f.id === 'design');
    if (des && it.mmat && DEC_DESIGN[it.mmat.cat]) put(o, 'design', DEC_DESIGN[it.mmat.cat]);
  });
  r.extract.done[rv] = true;
  if (!exSolo()) r.extract.done.final = true;
  return n > 0;
}
function decFillAp(r, it, dr) {
  const m = it.mmat;
  if (!m || !m.cat) return false;
  const s = apStore()[r.id] = apStore()[r.id] || {};
  const rater = isSingle() ? 'r1' : 'final';
  const cur = s[rater];
  if (cur && !dr.overwrite && (cur.done || Object.keys(cur.ans || {}).length) && !cur.imp) return false;
  const a = { tool: 'mmat', cat: m.cat, qcomp: m.cat === '5' ? '4' : '', ans: {}, notes: {}, done: true, imp: dr.file };
  if (m.s1) a.ans.S1 = m.s1;
  if (m.s2) a.ans.S2 = m.s2;
  const core = MMAT_CATS[m.cat].items;
  // Skor penuh atau nol menentukan setiap butir; skor antara disimpan apa adanya (butir mana yang gagal tidak tercatat di CSV)
  if (m.score && m.score.of === core.length && (m.score.yes === core.length || m.score.yes === 0)) core.forEach(([k]) => { a.ans[k] = m.score.yes ? 'y' : 'n'; });
  else if (m.score) a.csvScore = m.score;
  a.comment = `Impor dari ${dr.file}: ${m.design || 'MMAT ' + m.cat}, skor ${m.raw || '—'}.` + (a.csvScore ? ' Rincian per butir belum diisi.' : '');
  s[rater] = a;
  return true;
}

function decMatch(it) {
  const nt = it.title ? normTitle(it.title) : '';
  return S.records.find(r => !r.duplicateOf && ((it.doi && r.doi && normDoi(r.doi) === it.doi) || (nt && r.title && normTitle(r.title) === nt))) || null;
}

function decManual(d) { return d && d.d && !d.auto; }
// Bentrok hanya bila keputusan Anda sendiri berbeda dengan CSV
function decClash(r, it, rv) {
  const ta = r.screen.ta[rv], ft = r.screen.ft[rv];
  return (decManual(ta) && ta.d !== 'include') || (decManual(ft) && ft.d !== it.dec);
}
// Beberapa baris bisa menunjuk studi yang sama (mis. berkas duplikat E6): Include > Perlu cek > Exclude, duplikat paling lemah
const DEC_RANK = { include: 3, maybe: 2, exclude: 1 };
function decPlan(dr) {
  const rv = boardRv() || 'r1';
  const p = { include: 0, exclude: 0, maybe: 0, none: 0, manual: 0, archived: 0, dupRows: 0, tiers: {}, rows: [], stray: [] };
  const best = new Map();
  dr.items.forEach(it => {
    const r = decMatch(it);
    if (!r) { p.none++; return; }
    const rank = it.code.toUpperCase() === 'E6' ? 0 : DEC_RANK[it.dec];
    const cur = best.get(r.id);
    if (cur) p.dupRows++;
    if (!cur || rank > cur.rank) best.set(r.id, { r, it, rank });
  });
  best.forEach(({ r, it }) => {
    p[it.dec]++;
    if (it.tier) p.tiers[it.tier] = (p.tiers[it.tier] || 0) + 1;
    if (decClash(r, it, rv)) p.manual++;
    if (r.archived) p.archived++;
    p.rows.push({ r, it });
  });
  // Include otomatis di Judul & abstrak yang tidak ada di CSV
  p.stray = stageRecords('ft').filter(r => !best.has(r.id) && !r.archived && r.screen.ta[rv] && r.screen.ta[rv].auto && !(r.screen.ft[rv] && r.screen.ft[rv].d));
  return p;
}

function decReason(it) {
  if (it.code) { const hit = S.reasons.find(x => critCode(x) === it.code.toUpperCase()); if (hit) return hit; }
  return (it.note || '').replace(/^dikeluarkan:\s*/i, '').slice(0, 160) || 'Dikeluarkan (impor keputusan)';
}

function decApply(dr) {
  const rv = boardRv() || 'r1';
  const p = decPlan(dr);
  const n = { include: 0, exclude: 0, maybe: 0, kept: 0 };
  const put = (r, st, d, opt) => {
    setDecision(r, st, rv, d, opt);
    const x = r.screen[st][rv];
    x.imp = dr.file;
    if (!isSingle()) r.screen[st].final = Object.assign({}, x);
    return x;
  };
  p.rows.forEach(({ r, it }) => {
    if (!dr.overwrite && decClash(r, it, rv)) { n.kept++; return; }
    if (r.archived) delete r.archived;
    r.taLowSeen = 1;
    if (it.tier) r.tier = it.tier; else delete r.tier;
    const lab = it.raw + (it.note ? ' — ' + it.note : '');
    const ta = put(r, 'ta', 'include', {});
    ta.note = 'Impor keputusan: ' + it.raw;
    if (it.dec === 'include') { const f = put(r, 'ft', 'include', {}); f.note = lab; }
    else if (it.dec === 'exclude') { const f = put(r, 'ft', 'exclude', { reason: decReason(it) }); f.note = lab; f.sent = Date.now(); }
    else { r.screen.ft[rv] = { d: 'maybe', reason: '', note: lab, ts: Date.now(), imp: dr.file }; if (!isSingle()) r.screen.ft.final = null; }
    n[it.dec]++;
  });
  if (dr.stray) p.stray.forEach(r => { setDecision(r, 'ta', rv, null); r.taLowSeen = 1; n.stray = (n.stray || 0) + 1; });
  // Ekstraksi & MMAT hanya untuk studi Include
  const inc = p.rows.filter(({ r, it }) => it.dec === 'include' && r.screen.ft[rv] && r.screen.ft[rv].d === 'include');
  if (dr.doEx && dr.exCols.length) { n.fields = decEnsureFields(dr); n.ex = inc.filter(({ r, it }) => decFillEx(r, it, dr, rv)).length; }
  if (dr.doAp) n.ap = inc.filter(({ r, it }) => decFillAp(r, it, dr)).length;
  UI.sgModel = null;
  touch();
  return { n, none: p.none };
}

function decExtraOpts(dr, p) {
  const inc = p.include;
  const out = [];
  if (dr.exCols.length) {
    const fresh = dr.exCols.filter(c => !c.target && !S.fields.some(f => f.id === 'csv_' + decSlug(c.h))).length;
    out.push(`<label class="check"><input type="checkbox" id="decEx" ${dr.doEx ? 'checked' : ''}> <span>Isi <b>formulir Ekstraksi</b> untuk ${inc} studi Include dari ${dr.exCols.length} kolom (${dr.exCols.map(c => esc(c.label)).join(', ')})${fresh ? `; ${fresh} kolom baru ditambahkan ke formulir` : ''}. Isian yang sudah ada tidak ditimpa.</span></label>`);
  }
  const nm = dr.items.filter(it => it.mmat && it.mmat.cat).length;
  if (nm) out.push(`<label class="check"><input type="checkbox" id="decAp" ${dr.doAp ? 'checked' : ''}> <span>Isi <b>Penilaian kualitas MMAT</b>: kategori desain, S1/S2, dan skor. Skor 5/5 mengisi semua butir Ya; skor lain disimpan sebagai skor saja karena CSV tidak mencatat butir mana yang tidak terpenuhi.</span></label>`);
  return out.join('');
}

function decCard() {
  const dr = UI.decDraft;
  const pick = `<label class="btn sm ghost"><input type="file" id="decInput" accept=".csv,.tsv,.txt" hidden>Impor keputusan dari CSV…</label>`;
  if (!dr) return `<section class="card dec-card"><div class="card-head"><div><h2>Impor keputusan skrining</h2>
    <p class="hint">Punya hasil skrining dari luar aplikasi, misalnya CSV dengan kolom Judul/DOI dan <i>Keputusan_Final_Penulis</i> (Inklusi Tier A/B, Eksklusi, Perlu cek manual)? Impor di sini supaya keputusan, tier, dan alasan eksklusinya langsung tercatat. CSV seperti ini di dalam folder PDF juga terbaca otomatis.</p></div>${pick}</div></section>`;
  const p = decPlan(dr);
  const tiers = Object.entries(p.tiers).sort().map(([k, v]) => `Tier ${esc(k)}: ${v}`).join(' · ');
  return `<section class="card dec-card"><div class="card-head"><div><h2>Impor keputusan dari ${esc(dr.file)}</h2>
    <p class="hint">Kolom keputusan: <b>${esc(dr.col)}</b> · ${dr.items.length} baris. Studi dicocokkan lewat DOI atau judul. Studi yang cocok ditetapkan <b>Include di Judul &amp; abstrak</b>, lalu keputusan teks lengkapnya mengikuti CSV. Tanda otomatis diganti.</p></div></div>
    <div class="dec-grid">
      <div class="stat"><span class="stat-l">Include (teks lengkap)</span><span class="stat-v">${p.include}</span><span class="stat-s">${tiers || '&nbsp;'}</span></div>
      <div class="stat"><span class="stat-l">Exclude (teks lengkap)</span><span class="stat-v">${p.exclude}</span><span class="stat-s">alasan dari kode E di catatan</span></div>
      <div class="stat"><span class="stat-l">Perlu cek manual</span><span class="stat-v">${p.maybe}</span><span class="stat-s">ditandai Ragu di Teks lengkap</span></div>
      <div class="stat"><span class="stat-l">Tidak ditemukan</span><span class="stat-v">${p.none}</span><span class="stat-s">tidak diubah</span></div>
    </div>
    ${p.dupRows ? `<p class="small muted">${p.dupRows} baris menunjuk studi yang sama (mis. berkas duplikat E6); dipakai keputusan terkuat: Include, lalu Perlu cek, lalu Exclude.</p>` : ''}
    ${p.stray.length ? `<label class="check"><input type="checkbox" id="decStray" ${dr.stray ? 'checked' : ''}> <span><b>${p.stray.length} studi</b> masuk Teks lengkap hanya karena Tandai otomatis dan tidak ada di CSV ini. Kembalikan ke <b>Belum diperiksa</b> di Judul &amp; abstrak supaya Teks lengkap hanya berisi studi dari CSV.</span></label>` : ''}
    ${p.archived ? `<p class="small">${p.archived} studi sudah dibersihkan dari papan dan akan dikembalikan.</p>` : ''}
    ${decExtraOpts(dr, p)}
    ${p.manual ? `<label class="check"><input type="checkbox" id="decOver" ${dr.overwrite ? 'checked' : ''}> <span>Timpa juga ${p.manual} studi yang keputusan Anda di aplikasi berbeda dengan CSV (bila tidak dicentang, keputusan Anda dipertahankan).</span></label>` : ''}
    <div class="btn-row"><button class="btn" data-action="dec-apply">Terapkan keputusan (${p.include + p.exclude + p.maybe - (dr.overwrite ? 0 : p.manual)})</button><button class="btn ghost" data-action="dec-cancel">Batal</button></div>
  </section>`;
}

document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'decOver' && UI.decDraft) { UI.decDraft.overwrite = t.checked; renderImport(); return; }
  if (t.id === 'decEx' && UI.decDraft) { UI.decDraft.doEx = t.checked; return; }
  if (t.id === 'decAp' && UI.decDraft) { UI.decDraft.doAp = t.checked; return; }
  if (t.id === 'decStray' && UI.decDraft) { UI.decDraft.stray = t.checked; renderImport(); return; }
  if (t.id !== 'decInput' || !t.files || !t.files[0]) return;
  const f = t.files[0]; t.value = '';
  try {
    const { headers, rows } = Parsers.parseCSV(await f.text());
    const dr = decParse(headers, rows, f.name);
    if (!dr) { toast(f.name + ': tidak ada kolom keputusan (mis. Keputusan) beserta Judul atau DOI.', 'warn'); return; }
    UI.decDraft = dr; renderImport();
  } catch (x) { console.error(x); toast(f.name + ': ' + x.message, 'bad'); }
});

document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  if (a.dataset.action === 'dec-cancel') { UI.decDraft = null; renderImport(); }
  else if (a.dataset.action === 'dec-apply' && UI.decDraft) {
    const file = UI.decDraft.file;
    const { n, none } = decApply(UI.decDraft);
    UI.decDraft = null; renderImport();
    toast(`Keputusan dari ${file} diterapkan: ${n.include} Include, ${n.exclude} Exclude, ${n.maybe} perlu cek${n.kept ? `, ${n.kept} keputusan Anda dipertahankan` : ''}${n.stray ? `, ${n.stray} Include otomatis dikembalikan ke Belum diperiksa` : ''}${n.ex ? `, ${n.ex} formulir ekstraksi terisi${n.fields ? ` (${n.fields} kolom baru)` : ''}` : ''}${n.ap ? `, ${n.ap} penilaian MMAT` : ''}${none ? `, ${none} tidak ditemukan` : ''}.`, 'ok');
  }
});
