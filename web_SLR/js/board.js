/* Telaah SLR — tampilan Papan: Belum diperiksa → Include → Exclude (per tahap skrining) */
'use strict';

const BOARD_COLS = [
  ['todo', 'Belum diperiksa', 'Hasil unggahan yang belum dipetakan'],
  ['include', 'Include', ''],
  ['exclude', 'Exclude', '']
];

// Reviewer yang keputusannya diubah lewat papan
function boardRv() { return isSingle() ? 'r1' : UI.as === 'both' ? null : UI.as; }

function boardCol(r, st, rv) {
  const d = rv ? r.screen[st][rv] && r.screen[st][rv].d : effective(r, st);
  return d === 'include' ? 'include' : d === 'exclude' ? 'exclude' : 'todo';
}

// Satu evaluasi per rekaman per render (papan bisa berisi ribuan kartu)
function evB(r) { const c = UI.evMemo; if (!c) return evalBest(r); let v = c.get(r.id); if (!v) { v = evalBest(r); c.set(r.id, v); } return v; }

// Kode di awal label, mis. "E1 – Populasi..." -> "E1"
function critCode(s) { const m = String(s || '').match(/^\s*([A-Za-z]{1,3}\d{1,2})\b/); return m ? m[1].toUpperCase() : ''; }
function reasonFor(ev) {
  for (const c of ev.exc.filter(x => x.n)) {
    const code = critCode(c.label);
    const hit = code && S.reasons.find(x => critCode(x) === code);
    if (hit) return hit;
  }
  return '';
}

// Alasan otomatis tahap Judul & abstrak, dipetakan dari lampu kriteria
function autoReason(r) {
  const ev = evB(r);
  const hit = reasonFor(ev); if (hit) return hit;
  const ex = ev.exc.filter(x => x.n).map(x => x.label);
  if (ex.length) return 'Memenuhi kriteria eksklusi: ' + ex.join('; ');
  const miss = (ev.inc || []).filter(x => !x.n).map(x => x.label);
  const gen = S.reasons.find(x => /relevan|topik|off.?topic|irrelevan/i.test(x));
  if (miss.length && miss.length < (ev.total || 0)) return 'Tidak memenuhi kriteria inklusi: ' + miss.join('; ');
  return gen || 'Tidak relevan dengan topik (judul/abstrak)';
}
// Rincian syarat yang gagal, mis. "Tidak terpenuhi: I2 Populasi · Kata eksklusi: E1 K-12"
// Bagian yang sudah tersebut di alasan tidak diulang
function autoDetail(r, reason = '') {
  const ev = evB(r);
  const miss = (ev.inc || []).filter(x => !x.n).map(x => x.label).filter(l => !reason.includes(l));
  const ex = (ev.exc || []).filter(x => x.n).map(x => x.label).filter(l => !reason.includes(l));
  return [miss.length ? 'Tidak terpenuhi: ' + miss.join('; ') : '', ex.length ? 'Kata eksklusi: ' + ex.join('; ') : ''].filter(Boolean).join(' · ');
}
function taReason(r, dec) { return dec && dec.reason || autoReason(r); }
function taWhy(r, dec) { return autoDetail(r, taReason(r, dec)); }
function unsentExc(st) {
  const rv = boardRv();
  return rv ? stageRecords(st).filter(r => !r.archived && r.screen[st][rv] && r.screen[st][rv].d === 'exclude' && !r.screen[st][rv].sent) : [];
}

// Tandai otomatis tahap Judul & abstrak berdasarkan kriteria WAJIB:
// semua kriteria wajib menyala dan tanpa kata eksklusi -> Include; ada kriteria wajib yang padam -> Exclude
// (alasan = kriteria wajib yang tidak terpenuhi); wajib terpenuhi tetapi ada kata eksklusi -> tetap untuk dibaca.
function autoLowOn() { return S.project.autoLow !== false; }
function critKey(c) { return c.label || c.id; }
function keyDefault() {
  const inc = S.criteria.include.filter(c => (c.terms || '').trim());
  const k = inc.filter(c => /konstruk|literasi|literacy|populasi|population|desain|design|empiris|empiric/i.test(c.label || '') || /digital literac/i.test(c.terms || ''));
  return (k.length ? k : inc).map(critKey);
}
function keyCrit() { return Array.isArray(S.project.autoKey) ? S.project.autoKey : keyDefault(); }
// Bukti kuat untuk Include otomatis: kriteria disebut >= N kali, atau ada di judul/kata kunci
// Include otomatis ikut ke Teks lengkap hanya bila diaktifkan; bawaan: hanya Exclude otomatis, Include tetap Anda putuskan sendiri
function autoIncOn() { return S.project.autoInc === true; }
function autoEff(r) { const t = autoTag(evB(r), r); return t === 'include' && !autoIncOn() ? null : t; }
function autoMin() { const n = parseInt(S.project.autoMinHits, 10); return n >= 1 ? n : 2; }
function inHead(label, r) {
  const c = Criteria.compiled(S.criteria).inc.find(x => x.label === label);
  if (!c || !r) return false;
  c.re.lastIndex = 0;
  return c.re.test((r.title || '') + '\n' + (r.keywords || ''));
}
function keyStrong(ev, r) { const keys = keyCrit(); return ev.inc.filter(x => keys.includes(x.label)).every(x => x.n >= autoMin() || inHead(x.label, r)); }
function autoTag(ev, r) {
  if (ev.flag === 'nocrit' || !ev.total) return null;
  const keys = keyCrit();
  const req = ev.inc.filter(x => keys.includes(x.label));
  if (!req.length) return null;
  if (req.some(x => !x.n)) return 'exclude';
  // wajib menyala tetapi buktinya tipis (sekali sebut di abstrak) -> tetap untuk dibaca (kelompok Ragu di Saran)
  return ev.excMatched || !keyStrong(ev, r) ? null : 'include';
}
function isLowLamp(ev) { return autoTag(ev) === 'exclude'; }
// Cocokkan "I2 – Konstruk" ke alasan proyek yang memuat kata "Konstruk" (mis. "E2 – Konstruk bukan literasi digital…")
function reasonForMissing(label) {
  const w = String(label).replace(/^\s*[A-Za-z]{1,3}\d{1,2}\s*[–—-]\s*/, '').trim().split(/\s+/)[0];
  return w && w.length > 3 ? S.reasons.find(x => x.toLowerCase().includes(w.toLowerCase())) || '' : '';
}
function keyReason(r) {
  const ev = evB(r), keys = keyCrit();
  const miss = ev.inc.filter(x => keys.includes(x.label) && !x.n);
  for (const m of miss) { const hit = reasonForMissing(m.label); if (hit) return hit; }
  return miss.length ? 'Tidak memenuhi kriteria wajib: ' + miss.map(x => x.label).join('; ') : autoReason(r);
}
// Sidik aturan: berubah bila kriteria wajib, batas bukti, atau istilah kriteria berubah
function autoSig() { return JSON.stringify([keyCrit(), autoMin(), autoIncOn(), S.criteria.include.map(c => [c.label, c.terms]), S.criteria.exclude.map(c => c.terms)]); }
// Tanda otomatis yang masih boleh diperbarui: belum dikirim, bukan impor, dan belum ada pekerjaan teks lengkap
function autoStale(r, rv) {
  const d = r.screen.ta[rv], ft = r.screen.ft || {};
  return !!(d && d.auto && !d.sent && !d.imp && !r.archived && !r.hasText && !(ft[rv] && ft[rv].d) && !(ft.final && ft.final.d));
}
// Hanya rekaman yang belum pernah ditandai otomatis; kartu yang Anda pindahkan sendiri tidak disentuh lagi
function taAutoLow() {
  const rv = boardRv();
  if (!rv || !autoLowOn()) return 0;
  // aturan berubah sejak penandaan terakhir: tanda otomatis yang tidak lagi sesuai dikembalikan, lalu ditandai ulang
  let undone = 0;
  const sig = autoSig();
  if (S.project.autoSig !== sig) {
    stageRecords('ta').forEach(r => {
      delete r.taLowSeen;
      if (autoStale(r, rv) && autoEff(r) !== r.screen.ta[rv].d) { setDecision(r, 'ta', rv, null); undone++; }
    });
    S.project.autoSig = sig;
    S.project.autoRule = 6;
  }
  const n = { include: 0, exclude: 0 };
  stageRecords('ta').forEach(r => {
    if (r.archived || r.taLowSeen) return;
    r.taLowSeen = 1;
    if (boardCol(r, 'ta', rv) !== 'todo') return;
    const tag = autoEff(r);
    if (!tag) return;
    setDecision(r, 'ta', rv, tag, { auto: true, reason: tag === 'exclude' ? keyReason(r) : '' });
    r.screen.ta[rv].low = 1;
    n[tag]++;
  });
  if (n.include + n.exclude + undone) { touch(); toast(`${undone ? `Aturan Tandai otomatis diperbarui: ${undone} tanda lama tidak sesuai lagi dan ditinjau ulang. ` : ''}Tandai otomatis: ${n.include} Include, ${n.exclude} Exclude (kriteria wajib: ${keyCrit().join(', ')}). Kartunya berlabel "otomatis" dan bisa dipindah lagi.`, 'ok'); }
  return n.include + n.exclude + undone;
}
function autoLowCtl() {
  const inc = S.criteria.include.filter(c => (c.terms || '').trim());
  if (!inc.length) return '';
  const keys = keyCrit();
  return `<div class="autolow" role="group" aria-label="Tandai otomatis">
    <label title="Rekaman di Judul &amp; abstrak langsung ditandai: semua kriteria wajib menyala → Include; ada yang padam → Exclude."><input type="checkbox" id="autoLow" ${autoLowOn() ? 'checked' : ''}> <b>Tandai otomatis</b> · wajib:</label>
    <label class="ak-min" title="Include otomatis hanya bila setiap kriteria wajib disebut sebanyak ini di abstrak, atau ada di judul/kata kunci. Yang lebih lemah tetap di Belum diperiksa (kelompok Ragu di Saran).">bukti ≥ <input type="number" id="autoMin" min="1" max="9" value="${autoMin()}" ${autoLowOn() ? '' : 'disabled'}> sebutan</label>
    <label class="ak-inc" title="Bila tidak dicentang, hanya Exclude yang ditandai otomatis. Studi yang memenuhi kriteria wajib tetap di Belum diperiksa (kelompok Kemungkinan Include di ✨ Saran) sampai Anda sendiri meng-Include-nya, sehingga Teks lengkap hanya berisi pilihan Anda."><input type="checkbox" id="autoInc" ${autoIncOn() ? 'checked' : ''} ${autoLowOn() ? '' : 'disabled'}> Include otomatis ke Teks lengkap</label>
    ${inc.map(c => `<label class="ak"><input type="checkbox" data-autokey="${esc(critKey(c))}" ${keys.includes(critKey(c)) ? 'checked' : ''} ${autoLowOn() ? '' : 'disabled'}> ${esc(c.label || critKey(c))}</label>`).join('')}
  </div>`;
}

function setDecision(r, st, rv, d, opt = {}) {
  const s = r.screen[st];
  const prev = s[rv] || {};
  s[rv] = d ? { d, reason: d === 'exclude' ? (opt.reason ?? prev.reason ?? '') : '', note: prev.note || '', ts: Date.now(), auto: !!opt.auto } : (prev.note ? { d: null, reason: '', note: prev.note, ts: Date.now() } : null);
  if (s.final && s.r1 && s.r2 && s.r1.d === s.r2.d && s.r1.d !== 'maybe') s.final = null;
}

// Saran otomatis dari lampu indikator: Memenuhi -> Include; kata eksklusi atau tanpa kecocokan -> Exclude; sisanya tetap untuk dibaca
function autoPlan(st, rv) {
  const plan = { include: [], exclude: [], keep: 0 };
  stageRecords(st).filter(r => boardCol(r, st, rv) === 'todo').forEach(r => {
    const ev = evB(r);
    // Include tidak pernah dipindah massal: Teks lengkap hanya berisi pilihan Anda sendiri
    if (ev.flag === 'exclude' || ev.flag === 'none') plan.exclude.push({ r, reason: st === 'ta' ? autoReason(r) : reasonFor(ev) });
    else plan.keep++;
  });
  return plan;
}

function boardCard(r, st, rv, col) {
  const ev = evB(r);
  const dec = rv && r.screen[st][rv];
  const can = !!rv;
  const needReason = col === 'exclude' && st === 'ft' && !(dec && dec.reason);
  return `<article class="bcard ${needReason ? 'need' : ''}" draggable="${can}" data-bid="${r.id}">
    <div class="bc-top">${critLamps(ev)}<span class="muted small">${ev.incMatched}/${ev.total}</span><span class="flag ${FLAG_META[ev.flag].cls}">${FLAG_META[ev.flag].short}</span>${dec && dec.auto ? '<span class="pill" title="Dipindahkan oleh saran otomatis. Periksa lalu konfirmasi.">otomatis</span>' : ''}</div>
    <button class="bc-title" data-action="board-open" data-id="${r.id}" title="Buka di tampilan 3 panel">${esc(r.title || '(tanpa judul)')}</button>
    <p class="bc-meta">${esc((r.authors || '').split(/[;,]/)[0])}${r.year ? ' · ' + esc(r.year) : ''}${r.hasText ? ` · <b class="pdf-tag">PDF</b> ${r.pages || ''} hlm.` : ''}${r.tier ? ` · <span class="pill tier">Tier ${esc(r.tier)}</span>` : ''}</p>
    ${col === 'exclude' && can && dec && dec.sent ? `<div class="bc-sent"><b>✓ Alasan terkirim</b> <span>${esc(dec.reason || '')}</span>${dec.note ? `<span class="muted small">${esc(dec.note)}</span>` : ''}
      <button class="link sm" data-action="board-unsend" data-id="${r.id}">ubah</button></div>` : ''}
    ${col === 'exclude' && can && !(dec && dec.sent) && st === 'ta' && UI.taEdit !== r.id ? `<div class="bc-auto"><span class="muted small">Alasan${dec && dec.reason ? '' : ' otomatis'}:</span> <span>${esc(taReason(r, dec))}${taWhy(r, dec) ? `<span class="bc-why">${esc(taWhy(r, dec))}</span>` : ''}</span>
      <button class="link sm" data-action="board-ta-edit" data-id="${r.id}">ubah</button></div>` : ''}
    ${col === 'exclude' && can && !(dec && dec.sent) && (st !== 'ta' || UI.taEdit === r.id) ? `<div class="bc-send">
      <select class="bc-reason ${needReason ? 'need' : ''}" id="br-${r.id}" data-breason="${r.id}" aria-label="Alasan eksklusi">${opt('', 'Pilih alasan eksklusi…', dec && dec.reason || '')}${S.reasons.map(x => opt(x, x, dec && dec.reason || '')).join('')}</select>
      <textarea class="bc-note" id="bn-${r.id}" data-bnote="${r.id}" rows="2" placeholder="Komentar / alasan lain (opsional)" aria-label="Komentar eksklusi">${esc(dec && dec.note || '')}</textarea>
      <button class="btn sm d-exc" data-action="board-send" data-id="${r.id}">Kirim alasan</button></div>` : ''}
    ${can && !(dec && dec.sent) ? `<div class="bc-act">
      ${col !== 'include' ? `<button class="btn sm d-inc" data-action="board-move" data-id="${r.id}" data-to="include">✓ Include</button>` : ''}
      ${col !== 'exclude' ? `<button class="btn sm d-exc" data-action="board-move" data-id="${r.id}" data-to="exclude">✕ Exclude</button>` : ''}
      ${col !== 'todo' ? `<button class="btn sm ghost" data-action="board-move" data-id="${r.id}" data-to="">↺ Kembalikan</button>` : ''}
    </div>` : ''}
  </article>`;
}

const BOARD_PAGE = 100;
function boardLim(k) { return (UI.bLim && UI.bLim[k]) || BOARD_PAGE; }
function renderBoard() {
  UI.evMemo = new Map();
  try { renderBoardInner(); } finally { UI.evMemo = null; }
}
// Include di Judul & abstrak dari "Terima semua" di Saran yang belum dibaca di Teks lengkap
function sgUnread(rv) {
  return rv ? stageRecords('ft').filter(r => !r.archived && !r.hasText && r.screen.ta[rv] && r.screen.ta[rv].sg && !(r.screen.ft[rv] && r.screen.ft[rv].d)) : [];
}
function renderBoardInner() {
  const st = UI.stage === 'ex' ? 'ft' : UI.stage;
  UI.stage = st;
  taAutoLow();
  const rv = boardRv();
  const counts = { ta: stageRecords('ta').length, ft: stageRecords('ft').length, ex: stageRecords('ex').length };
  const q = UI.q.trim().toLowerCase();
  let list = stageRecords(st).filter(r => !r.archived);
  if (q) list = list.filter(r => (r.title + ' ' + r.authors + ' ' + r.abstract + ' ' + r.year).toLowerCase().includes(q));
  if (UI.sort === 'score') list = list.slice().sort((a, b) => evB(b).score - evB(a).score);
  else if (UI.sort === 'year') list = list.slice().sort((a, b) => String(b.year).localeCompare(String(a.year)));
  else if (UI.sort === 'title') list = list.slice().sort((a, b) => a.title.localeCompare(b.title));
  const by = { todo: [], include: [], exclude: [] };
  list.forEach(r => by[boardCol(r, st, rv)].push(r));
  const plan = UI.boardConfirm && rv ? autoPlan(st, rv) : null;
  const sendable = rv ? by.exclude.filter(r => { const d = r.screen[st][rv]; return d && !d.sent && d.reason; }) : [];
  const missing = st === 'ft' && rv ? by.exclude.filter(r => !(r.screen.ft[rv] && r.screen.ft[rv].reason)).length : 0;

  $('#view-work').innerHTML = `
  <div class="work-bar">
    ${workModeSeg()}
    <div class="seg stage-seg" role="tablist" aria-label="Tahap">
      ${STAGES.filter(([k]) => k !== 'ex').map(([k, l]) => `<button role="tab" aria-selected="${st === k}" class="${st === k ? 'on' : ''}" data-action="stage" data-stage="${k}">${l} <span class="n">${counts[k]}</span></button>`).join('')}
    </div>
    <div class="work-filters">
      <input type="search" id="wq" placeholder="Cari judul, penulis…" value="${esc(UI.q)}" aria-label="Cari kartu">
      <select id="wsort" aria-label="Urutan">${opt('default', 'Urutan unggah', UI.sort)}${opt('score', 'Skor kata kunci tertinggi', UI.sort)}${opt('year', 'Tahun terbaru', UI.sort)}${opt('title', 'Judul A–Z', UI.sort)}</select>
      ${rv && st === 'ta' ? autoLowCtl() : ''}
      ${typeof ftResetCtl === 'function' ? ftResetCtl() : ''}
      ${rv ? `<button class="btn sm" data-action="board-auto-ask" ${by.todo.length ? '' : 'disabled'}>Saran otomatis</button>` : ''}
    </div>
  </div>
  ${typeof ftResetBanner === 'function' ? ftResetBanner() : ''}
  ${!rv ? `<div class="cbanner conf"><span>Papan memindahkan keputusan satu reviewer. Pilih <b>Bekerja sebagai: Reviewer 1</b> atau <b>Reviewer 2</b> di kanan atas. Kolom di bawah menampilkan keputusan yang sudah disepakati.</span></div>` : ''}
  ${plan ? `<div class="cbanner conf board-confirm"><span><b>Saran otomatis dari lampu indikator:</b> ${plan.exclude.length} ke Exclude (ada kata eksklusi atau tidak ada kriteria yang menyala), ${plan.keep} tetap di Belum diperiksa untuk Anda pilih sendiri. Include tidak dipindah otomatis. Kartu yang dipindahkan diberi label <i>otomatis</i> dan tetap bisa dikembalikan.</span>
    <span class="cb-actions"><button class="btn sm" data-action="board-auto-go" ${plan.include.length + plan.exclude.length ? '' : 'disabled'}>Terapkan</button><button class="btn sm ghost" data-action="board-auto-cancel">Batal</button></span></div>` : ''}
  ${st === 'ft' && stageRecords('ta').some(r => stageStatus(r, 'ta') === 'pending' || stageStatus(r, 'ta') === 'partial') ? `<div class="cbanner"><span><b>${stageRecords('ta').filter(r => ['pending', 'partial'].includes(stageStatus(r, 'ta'))).length} rekaman</b> masih menunggu di tahap Judul &amp; abstrak. PDF yang baru diunggah selalu mulai dari sana.</span> <button class="btn sm" data-action="stage" data-stage="ta">Buka Judul &amp; abstrak</button></div>` : ''}
  ${st === 'ft' && sgUnread(rv).length ? `<div class="cbanner conf"><span><b>${sgUnread(rv).length} kartu</b> di Belum diperiksa masuk lewat <i>Terima semua sebagai Include</i> di ✨ Saran, bukan Anda pilih satu per satu, dan belum punya keputusan teks lengkap. Keputusan Include dan Exclude Anda di sini tidak tersentuh.</span> <span class="cb-actions"><button class="btn sm" data-action="board-sg-back">Kembalikan ke Judul &amp; abstrak</button></span></div>` : ''}
  ${missing ? `<div class="cbanner"><span class="txt-conf">${missing} kartu Exclude belum punya alasan. Alasan teks lengkap wajib untuk diagram PRISMA.</span></div>` : ''}
  <div class="board">
    ${BOARD_COLS.map(([k, l, sub]) => `<section class="bcol bcol-${k}" data-bcol="${k}" aria-label="${l}">
      <header class="bcol-head"><span class="bcol-dot"></span><b>${l}</b><span class="n">${by[k].length}</span>${k === 'todo' ? `<span class="muted small">${sub}</span>` : ''}
        ${k === 'exclude' && st === 'ft' && sendable.length ? `<span class="bcol-tools"><button class="btn sm ghost" data-action="board-send-all">Kirim semua (${sendable.length})</button></span>` : ''}</header>
      ${k === 'exclude' ? cleanTools(st) : ''}
      <div class="bcol-body">${by[k].slice(0, boardLim(k)).map(r => boardCard(r, st, rv, k)).join('')}${by[k].length > boardLim(k) ? `<button class="btn sm ghost bcol-more" data-action="board-more" data-k="${k}">Tampilkan ${Math.min(BOARD_PAGE, by[k].length - boardLim(k))} lagi · ${by[k].length - boardLim(k)} tersembunyi</button>` : ''}${by[k].length ? '' : `<p class="bcol-empty">${k === 'todo' ? (list.length ? '✓ Semua sudah dipetakan.' : emptyListText()) : 'Seret kartu ke sini atau klik tombolnya.'}</p>`}</div>
    </section>`).join('')}
  </div>`;
}

function workModeSeg() {
  return `<div class="seg sm mode-seg" aria-label="Tampilan"><button class="${UI.workMode !== 'board' && UI.workMode !== 'saran' ? 'on' : ''}" data-action="wmode" data-m="panel">3 panel</button><button class="${UI.workMode === 'board' ? 'on' : ''}" data-action="wmode" data-m="board">Papan</button><button class="${UI.workMode === 'saran' ? 'on' : ''}" data-action="wmode" data-m="saran" title="Saran skrining abstrak otomatis">✨ Saran</button></div>`;
}

function boardMove(id, to) {
  const r = rec(id), rv = boardRv();
  if (!r || !rv) return;
  const st = UI.stage;
  setDecision(r, st, rv, to || null);
  touch();
  renderBoard();
  if (to === 'include') toast(st === 'ta' ? 'Include: masuk tahap Teks lengkap.' : 'Include: masuk tahap Ekstraksi data.', 'ok');
  else if (to === 'exclude' && st === 'ft' && !r.screen.ft[rv].reason) toast('Pilih alasan eksklusi pada kartu.', 'warn');
}

// Kunci alasan + komentar; tanpa alasan dari daftar, komentar dipakai sebagai alasan
function boardSend(ids, bulkNote) {
  const rv = boardRv(), st = UI.stage;
  let ok = 0, miss = 0;
  ids.forEach(id => {
    const r = rec(id), d = r && r.screen[st][rv];
    if (!d || d.d !== 'exclude') return;
    const sel = $('#br-' + id), note = $('#bn-' + id);
    if (sel) d.reason = sel.value;
    if (note) d.note = note.value.trim();
    if (!d.reason && st === 'ta') d.reason = autoReason(r);
    if (st === 'ta' && !d.note) d.note = [bulkNote, autoDetail(r, d.reason)].filter(Boolean).join(' · ');
    if (!d.reason && d.note) d.reason = d.note.split('\n')[0].slice(0, 120);
    if (!d.reason) { miss++; return; }
    d.sent = Date.now(); d.auto = false; ok++;
  });
  UI.taEdit = null;
  touch(); renderWork();
  if (miss) toast(`${miss} kartu belum punya alasan: pilih alasan atau tulis komentar dulu.`, 'warn');
  else if (ok) toast(`${ok} alasan terkirim ke Laporan dan PRISMA. Tekan "Bersihkan" untuk mengeluarkan kartunya.`, 'ok');
}

// Siap dibersihkan: keputusan akhir Exclude dan alasannya sudah tercatat
function hasReason(r, st) { return finalReason(r, st) !== 'Alasan tidak dicatat'; }
function cleanState(st) {
  const live = stageRecords(st).filter(r => !r.archived);
  const exc = live.filter(r => effective(r, st) === 'exclude');
  return {
    ready: exc.filter(r => hasReason(r, st)),
    noReason: exc.filter(r => !hasReason(r, st)).length,
    waiting: live.filter(r => effective(r, st) !== 'exclude' && ['r1', 'r2'].some(v => r.screen[st][v] && r.screen[st][v].d === 'exclude')).length,
    archived: stageRecords(st).length - live.length
  };
}
// Tombol + konfirmasi + keterangan, dipakai di Papan dan di daftar 3 panel
function cleanTools(st) {
  const c = cleanState(st);
  const pend = st === 'ta' ? unsentExc(st) : [];
  const bulk = pend.length ? `<div class="bulk-send"><p class="small"><b>${pend.length} kartu Exclude</b> sudah diberi alasan otomatis dari lampu kriteria (tertulis di tiap kartu). Kalau setuju, kirim semuanya sekaligus.</p>
    <input type="text" id="bulkNote" class="bulk-note" placeholder="Komentar untuk semua kartu (opsional)" aria-label="Komentar untuk semua kartu">
    <div class="btn-row"><button class="btn sm d-exc" data-action="board-send-ta">✓ Kirim semua alasan (${pend.length})</button><button class="btn sm" data-action="board-send-ta" data-clean="1">Kirim semua lalu bersihkan</button></div></div>` : '';
  const why = c.ready.length ? '' : pend.length ? 'Kirim alasan dulu, lalu tombol ini aktif.' : c.noReason ? `${c.noReason} kartu Exclude belum punya alasan. ${boardRv() ? 'Pilih alasan lalu tekan Kirim alasan.' : 'Pilih "Bekerja sebagai: Reviewer 1" di kanan atas untuk mengisi alasan.'}` : 'Belum ada kartu Exclude yang siap dibersihkan.';
  return `<div class="clean-tools">${bulk}
    <button class="btn sm clean-btn" data-action="board-clean-ask" ${c.ready.length ? '' : 'disabled'}>🧹 Bersihkan Exclude (${c.ready.length})</button>
    ${why ? `<span class="muted small">${why}</span>` : ''}
    ${c.waiting && !isSingle() ? `<span class="small">${c.waiting} Exclude baru diputuskan satu reviewer, menunggu reviewer lain/konsensus. Bekerja sendiri? <button class="btn sm ghost" data-action="go-single">Aktifkan mode satu reviewer</button></span>` : ''}
    ${c.archived ? `<span class="muted small">${c.archived} sudah dibersihkan · <button class="link sm" data-action="goto" data-view="report">lihat Laporan</button></span>` : ''}
    ${UI.boardClean && c.ready.length ? `<div class="bclean-confirm"><p><b>Bersihkan ${c.ready.length} rekaman Exclude?</b> PDF, teks, dan terjemahannya dihapus dari penyimpanan lokal. Judul, keputusan, alasan, dan komentar tetap tercatat di Laporan dan diagram PRISMA.</p>
      <div class="btn-row"><button class="btn sm danger" data-action="board-clean">Ya, bersihkan</button><button class="btn sm ghost" data-action="board-clean-cancel">Batal</button></div></div>` : ''}
  </div>`;
}

// Hapus PDF/teks/terjemahan satu rekaman; data ringannya tetap untuk Laporan & PRISMA. Mengembalikan ukuran PDF.
async function archiveRec(r, st) {
  let bytes = 0;
  try { const f = await DB.get('pdfs', r.id); if (f && f.size) bytes = f.size; } catch (x) { /* abaikan */ }
  await DB.del('pdfs', r.id); await DB.del('texts', r.id); await DB.del('texts', r.id + '|tr-id');
  delete UI.textCache[r.id]; delete UI.pdfCache[r.id];
  if (UI.trCache) delete UI.trCache[r.id];
  r.archived = { st, date: today(), hadPdf: !!r.hasPdf };
  r.hasPdf = false; r.hasText = false;
  if (UI.sel === r.id) UI.sel = null;
  return bytes;
}

// Saringan teks lengkap otomatis: PDF untuk rekaman di tahap Teks lengkap yang kriteria wajibnya
// tidak ditemukan sama sekali di seluruh teks -> Exclude (alasan terkirim) lalu dibuang dari penyimpanan
function ftAutoOn() { return S.project.ftAuto !== false; }
// Teks isi PDF tanpa daftar pustaka (istilah di judul rujukan tidak dihitung)
function ftBody(r) {
  const t = (UI.textCache[r.id] || []).join('\n');
  const re = /\n\s*(?:\d+\.?\s*)?(?:references|reference list|bibliography|works cited|daftar pustaka|referensi|kepustakaan)\s*\n/gi;
  let m, cut = -1;
  while ((m = re.exec(t))) if (m.index > t.length * 0.5) cut = m.index;
  return cut > 0 ? t.slice(0, cut) : t;
}
function ftMin() { const n = parseInt(S.project.ftMinHits, 10); return n >= 1 ? n : 5; }
function ftAutoScreen(r) {
  const rv = boardRv();
  if (!rv || !r.hasText || !UI.textCache[r.id]) return null;
  if (!stageRecords('ft').includes(r)) return null;
  const d = r.screen.ft[rv];
  if (d && d.d && !d.auto) return null;
  const ev = Criteria.evaluate(ftBody(r), S.criteria);
  if (!ev || !ev.total) return null;
  const keys = keyCrit();
  const req = ev.inc.filter(x => keys.includes(x.label));
  const weak = req.filter(x => x.n < ftMin());
  r.ftAutoRes = { date: today(), counts: req.map(x => [x.label, x.n]), weak: weak.map(x => x.label), min: ftMin() };
  if (!weak.length) return 'keep';
  let reason = '';
  for (const w of weak) { reason = reasonForMissing(w.label); if (reason) break; }
  setDecision(r, 'ft', rv, 'exclude', { auto: true, reason: reason || 'Tidak memenuhi kriteria wajib di teks lengkap: ' + weak.map(x => x.label).join('; ') });
  const f = r.screen.ft[rv];
  f.note = 'Otomatis dari teks lengkap PDF (' + (r.pages || '?') + ' hlm., tanpa daftar pustaka): ' + weak.map(x => x.label + ' hanya ' + x.n + '× (perlu ≥ ' + ftMin() + ')').join('; ');
  f.sent = Date.now(); f.ftAuto = 1;
  return 'exclude';
}

// Hapus PDF/teks/terjemahan; rekaman ringan tetap ada agar Laporan & PRISMA tetap benar
async function boardClean() {
  const st = UI.stage === 'ex' ? 'ft' : UI.stage;
  const list = cleanState(st).ready;
  if (UI.cleaning) return;
  UI.cleaning = true;
  const btn = $('[data-action="board-clean"]'); if (btn) { btn.disabled = true; btn.textContent = 'Membersihkan ' + list.length + ' kartu…'; }
  let bytes = 0;
  for (const r of list) bytes += await archiveRec(r, st);
  UI.boardClean = false; UI.cleaning = false;
  touch(); renderWork();
  toast(`${list.length} kartu dibersihkan${bytes ? ` · ${(bytes / 1048576).toFixed(1)} MB dibebaskan` : ''}. Tetap tercatat di Laporan dan PRISMA.`, 'ok');
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  const ac = a.dataset.action;
  if (ac === 'wmode') { UI.workMode = a.dataset.m; UI.boardConfirm = false; try { localStorage.setItem('telaah-wmode', UI.workMode); } catch (x) { /* abaikan */ } renderWork(); }
  else if (ac === 'board-move') boardMove(a.dataset.id, a.dataset.to);
  else if (ac === 'board-open') { UI.workMode = 'panel'; UI.sel = a.dataset.id; UI.filter = 'all'; UI.docMode = rec(a.dataset.id).hasText ? 'txt' : 'abs'; renderWork(); }
  else if (ac === 'board-send') boardSend([a.dataset.id]);
  else if (ac === 'board-more') { UI.bLim = UI.bLim || {}; UI.bLim[a.dataset.k] = boardLim(a.dataset.k) + BOARD_PAGE; renderBoard(); }
  else if (ac === 'board-ta-edit') { UI.taEdit = a.dataset.id; renderBoard(); }
  else if (ac === 'board-send-ta') {
    const note = (($('#bulkNote') || {}).value || '').trim();
    const ids = unsentExc(UI.stage).map(r => r.id);
    if (a.dataset.clean) { UI.boardClean = true; UI.secOpen = Object.assign(UI.secOpen || {}, { exc: true }); }
    boardSend(ids, note);
  }
  else if (ac === 'board-sg-back') {
    const rv = boardRv(), list = sgUnread(rv);
    list.forEach(r => { setDecision(r, 'ta', rv, null); r.taLowSeen = 1; });
    touch(); renderWork();
    toast(`${list.length} kartu dari Saran dikembalikan ke Belum diperiksa di Judul & abstrak. Teks lengkap kini hanya berisi pilihan Anda.`, 'ok');
  }
  else if (ac === 'board-send-all') {
    const rv = boardRv(), st = UI.stage;
    boardSend(stageRecords(st).filter(r => !r.archived && boardCol(r, st, rv) === 'exclude' && r.screen[st][rv].reason && !r.screen[st][rv].sent).map(r => r.id));
  }
  else if (ac === 'board-unsend') { const r = rec(a.dataset.id), d = r && r.screen[UI.stage][boardRv()]; if (d) { delete d.sent; touch(); renderBoard(); } }
  else if (ac === 'board-clean-ask') { UI.boardClean = true; UI.secOpen = Object.assign(UI.secOpen || {}, { exc: true }); renderWork(); }
  else if (ac === 'board-clean-cancel') { UI.boardClean = false; renderWork(); }
  else if (ac === 'board-clean') boardClean();
  else if (ac === 'go-single') { S.project.single = true; UI.as = 'r1'; touch(); refreshChrome(); renderWork(); toast('Mode satu reviewer aktif: keputusan Reviewer 1 menjadi keputusan akhir. Bisa diubah lagi di Proyek & Kriteria.', 'ok'); }
  else if (ac === 'board-auto-ask') { UI.boardConfirm = true; renderBoard(); }
  else if (ac === 'board-auto-cancel') { UI.boardConfirm = false; renderBoard(); }
  else if (ac === 'board-auto-go') {
    const rv = boardRv(), st = UI.stage;
    const plan = autoPlan(st, rv);
    plan.include.forEach(r => setDecision(r, st, rv, 'include', { auto: true }));
    plan.exclude.forEach(({ r, reason }) => setDecision(r, st, rv, 'exclude', { auto: true, reason }));
    UI.boardConfirm = false;
    touch(); renderBoard();
    toast(`${plan.include.length} dipindah ke Include, ${plan.exclude.length} ke Exclude. Periksa kartu berlabel "otomatis".`, 'ok');
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (!t.dataset || !t.dataset.bnote) return;
  const r = rec(t.dataset.bnote), d = r && r.screen[UI.stage][boardRv()];
  if (d) { d.note = t.value; touch(); }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'autoLow' || t.id === 'autoMin' || t.id === 'autoInc' || (t.dataset && t.dataset.autokey)) {
    if (t.id === 'autoLow') S.project.autoLow = t.checked;
    else if (t.id === 'autoInc') S.project.autoInc = t.checked;
    else if (t.id === 'autoMin') S.project.autoMinHits = Math.max(1, Math.min(9, parseInt(t.value, 10) || 2));
    else {
      const set = new Set(keyCrit());
      t.checked ? set.add(t.dataset.autokey) : set.delete(t.dataset.autokey);
      S.project.autoKey = [...set];
    }
    // aturan berubah: kartu otomatis yang belum dikirim dikembalikan, lalu ditandai ulang
    const rv = boardRv();
    stageRecords('ta').forEach(r => {
      delete r.taLowSeen;
      const d = rv && r.screen.ta[rv];
      if (d && d.low && d.auto && !d.sent && !r.archived && (!autoLowOn() || autoEff(r) !== d.d)) setDecision(r, 'ta', rv, null);
    });
    touch(); renderWork();
    return;
  }
  if (!t.dataset || !t.dataset.breason) return;
  const r = rec(t.dataset.breason), rv = boardRv();
  if (!r || !rv || !r.screen[UI.stage][rv]) return;
  r.screen[UI.stage][rv].reason = t.value;
  touch(); renderBoard();
});

/* Seret kartu antar-kolom */
document.addEventListener('dragstart', e => {
  const c = e.target.closest && e.target.closest('.bcard[draggable="true"]');
  if (!c) return;
  e.dataTransfer.setData('text/x-telaah-id', c.dataset.bid);
  e.dataTransfer.effectAllowed = 'move';
  c.classList.add('dragging');
});
document.addEventListener('dragend', e => { const c = e.target.closest && e.target.closest('.bcard'); if (c) c.classList.remove('dragging'); $$('.bcol.over').forEach(x => x.classList.remove('over')); });
document.addEventListener('dragover', e => {
  const col = e.target.closest && e.target.closest('.bcol');
  if (!col || !e.dataTransfer.types.includes('text/x-telaah-id')) return;
  e.preventDefault();
  $$('.bcol.over').forEach(x => x !== col && x.classList.remove('over'));
  col.classList.add('over');
});
document.addEventListener('drop', e => {
  const col = e.target.closest && e.target.closest('.bcol');
  if (!col) return;
  const id = e.dataTransfer.getData('text/x-telaah-id');
  if (!id) return;
  e.preventDefault();
  col.classList.remove('over');
  const to = col.dataset.bcol;
  boardMove(id, to === 'todo' ? '' : to);
});
