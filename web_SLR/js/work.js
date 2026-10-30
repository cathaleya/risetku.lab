/* Telaah SLR — ruang kerja 3 panel: Ekstraksi | Reviewer 1 | Reviewer 2 */
'use strict';

const DEC = {
  include: { label: 'Include', id: 'Inklusi', icon: '✓', cls: 'd-inc' },
  maybe: { label: 'Ragu', id: 'Ragu', icon: '?', cls: 'd-may' },
  exclude: { label: 'Exclude', id: 'Eksklusi', icon: '✕', cls: 'd-exc' }
};
const STAGES = [['ta', 'Judul & abstrak'], ['ft', 'Teks lengkap'], ['ex', 'Ekstraksi data']];

function canEdit(rv) { return solo() ? rv === 'r1' : UI.as === 'both' || UI.as === rv; }
function isMasked(rv, r) {
  if (solo() || !S.project.blind || UI.as === 'both' || UI.as === rv || UI.reveal[rv]) return false;
  if (UI.stage === 'ex') return !(r.extract.done.r1 && r.extract.done.r2);
  return !(hasDec(r, UI.stage, 'r1') && hasDec(r, UI.stage, 'r2'));
}

/* Lampu indikator: satu lampu per kriteria inklusi (warna sama dengan sorotan), merah bila ada kata eksklusi */
function critLamps(ev, big) {
  const lamp = (c, cls) => `<span class="lamp ${c.n ? 'on' : ''} ${cls}" title="${esc(c.label)}: ${c.n ? c.n + ' kecocokan' : 'tidak terdeteksi'}">${big ? `<i></i><b>${esc(c.label)}</b><em>${c.n}</em>` : ''}</span>`;
  const excHit = ev.exc.filter(c => c.n);
  const exc = big ? excHit.map(c => lamp(c, 'lexc')).join('')
    : excHit.length ? `<span class="lamp on lexc" title="Kata eksklusi: ${esc(excHit.map(c => c.label).join(', '))}"></span>` : '';
  return `<span class="lamps ${big ? 'lamps-lg' : ''}">${ev.inc.map(c => lamp(c, 'lc' + (c.idx % 6))).join('')}${exc}</span>`;
}

function indicatorBlock(ev, r, fromText) {
  if (ev.flag === 'nocrit') return `<div class="indicator"><span class="muted small">Kriteria belum diisi. Tambahkan di tab Proyek &amp; Kriteria agar indikator menyala.</span></div>`;
  return `<div class="indicator">
    <div class="ind-head">
      <span class="ind-count"><b>${ev.incMatched}</b> dari ${ev.total} kriteria terdeteksi</span>
      <span class="flag ${FLAG_META[ev.flag].cls}">${FLAG_META[ev.flag].label}</span>
      ${ev.lang ? `<span class="pill ${ev.langOut ? 'no' : ''}" title="Bahasa terdeteksi">Bahasa: ${LANG_NAMES[ev.lang] || ev.lang}</span>` : ''}
      <span class="muted small">${fromText ? `dibaca dari teks lengkap PDF${r.pages ? ' · ' + r.pages + ' hlm.' : ''}` : 'dibaca dari judul &amp; abstrak' + (r.hasText ? '' : ' · lampirkan PDF untuk deteksi teks lengkap')}</span>
    </div>
    ${critLamps(ev, true)}
  </div>`;
}

function renderWork() {
  if (typeof syncAs === 'function') syncAs();
  if (UI.workMode !== 'board' && typeof taAutoLow === 'function') taAutoLow();
  if (UI.workMode === 'board' && typeof renderBoard === 'function') { renderBoard(); return; }
  if (UI.workMode === 'saran' && typeof renderSuggest === 'function') { renderSuggest(); return; }
  const list = filteredRecords();
  if (!UI.sel || !list.find(r => r.id === UI.sel)) { const first = orderedList(list)[0]; UI.sel = first ? first.id : null; autoDocMode(first); }
  const pr = stageProgress(UI.stage);
  const counts = { ta: stageRecords('ta').length, ft: stageRecords('ft').length, ex: stageRecords('ex').length };
  const single = solo();
  const filters = single
    ? (UI.stage === 'ex'
      ? [['all', 'Semua'], ['undecided', 'Belum selesai'], ['include', 'Selesai']]
      : [['all', 'Semua'], ['undecided', 'Belum diputuskan'], ['maybe', 'Ragu'], ['include', 'Include'], ['exclude', 'Exclude']])
    : UI.stage === 'ex'
    ? [['all', 'Semua'], ['undecided', 'Belum selesai'], ['conflict', 'Perlu konsensus'], ['include', 'Konsensus selesai']]
    : [['all', 'Semua'], ['undecided', UI.as === 'both' ? 'Belum lengkap' : 'Belum saya putuskan'], ['conflict', 'Konflik'], ['maybe', 'Ada "Ragu"'], ['include', 'Disepakati include'], ['exclude', 'Disepakati exclude']];
  const flagFilters = [['flag:include', 'Penanda: memenuhi kriteria'], ['flag:mixed', 'Penanda: perlu cek'], ['flag:partial', 'Penanda: sebagian'], ['flag:exclude', 'Penanda: kata eksklusi'], ['flag:none', 'Penanda: tidak cocok']];
  $('#view-work').innerHTML = `
  <div class="work-bar">
    ${workModeSeg()}
    <div class="seg stage-seg" role="tablist" aria-label="Tahap">
      ${STAGES.map(([k, l]) => `<button role="tab" aria-selected="${UI.stage === k}" class="${UI.stage === k ? 'on' : ''}" data-action="stage" data-stage="${k}">${l} <span class="n">${counts[k]}</span></button>`).join('')}
    </div>
    <div class="work-progress" title="Selesai: ${pr.done} dari ${pr.total}">
      <div class="bar"><i style="width:${pr.total ? pr.done / pr.total * 100 : 0}%"></i></div>
      <span><b>${pr.done}</b>/${pr.total} selesai${pr.conflict ? ` · <span class="txt-conf">${pr.conflict} konflik</span>` : ''}</span>
    </div>
    <div class="work-filters">
      <input type="search" id="wq" placeholder="Cari judul, penulis, DOI…" value="${esc(UI.q)}" aria-label="Cari rekaman">
      <select id="wfilter" aria-label="Filter">${filters.map(([v, l]) => opt(v, l, UI.filter)).join('')}<optgroup label="Penanda otomatis">${flagFilters.map(([v, l]) => opt(v, l, UI.filter)).join('')}</optgroup></select>
      <select id="wsort" aria-label="Urutan">${opt('default', 'Urutan impor', UI.sort)}${opt('score', 'Skor kata kunci tertinggi', UI.sort)}${opt('year', 'Tahun terbaru', UI.sort)}${opt('title', 'Judul A–Z', UI.sort)}</select>
      ${UI.stage === 'ta' && typeof boardRv === 'function' && boardRv() ? autoLowCtl() : ''}
      ${typeof ftResetCtl === 'function' ? ftResetCtl() : ''}
      ${UI.stage === 'ex' && isSingle() ? `<label class="check sm" title="Skrining tetap satu reviewer; ekstraksi diisi Reviewer 1 dan Reviewer 2 lalu disepakati di tab Konsensus"><input type="checkbox" id="exDual" ${S.project.exDual ? 'checked' : ''}> <span>Ekstraksi oleh 2 reviewer</span></label>` : ''}
      ${UI.stage === 'ex' ? '<button class="btn sm ghost" data-action="nw-ask" title="Kosongkan rekaman setelah ekstraksi selesai agar bisa memulai review baru">Reset untuk kerja baru…</button>' : ''}
    </div>
  </div>
  ${typeof ftResetBanner === 'function' ? ftResetBanner() : ''}
  ${typeof stageTransitionBanner === 'function' ? stageTransitionBanner() : ''}
  ${UI.stage === 'ex' ? newWorkBanner(pr) : ''}
  <div class="mobile-switch seg" role="tablist">
    ${[['list', 'Daftar'], ['a', 'Ekstraksi'], ['r1', 'R1'], ['r2', 'R2']].filter(([k]) => !(single && k === 'r2')).map(([k, l]) => `<button class="${UI.mobilePanel === k ? 'on' : ''}" data-action="mpanel" data-p="${k}">${l}</button>`).join('')}
  </div>
  <div class="work-grid ${UI.listOpen ? '' : 'list-closed'} ${single ? 'single' : ''}" data-mp="${UI.mobilePanel}">
    <aside class="rec-list" id="recList" aria-label="Daftar rekaman"></aside>
    <section class="panel panel-a" id="panelA" aria-label="Panel ekstraksi"></section>
    <section class="panel panel-r" id="panel-r1" data-rv="r1" aria-label="Panel reviewer 1"></section>
    ${single ? '' : '<section class="panel panel-r" id="panel-r2" data-rv="r2" aria-label="Panel reviewer 2"></section>'}
  </div>`;
  renderList(list);
  renderPanels();
}

/* Banner transisi alur kerja: Judul & Abstrak -> Teks Lengkap -> Ekstraksi Data */
function stageTransitionBanner() {
  const counts = { ta: stageRecords('ta').length, ft: stageRecords('ft').length, ex: stageRecords('ex').length };
  const single = isSingle();

  // 1. Jika di tahap Judul & Abstrak (ta)
  if (UI.stage === 'ta') {
    const pr = stageProgress('ta');
    if (pr.total > 0 && pr.done === pr.total) {
      if (counts.ft > 0) {
        return `<div class="cbanner ok" style="background:#ecfdf5;border:1.5px solid #a7f3d0;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-radius:10px">
          <div>
            <h4 style="margin:0 0 4px 0;color:#065f46;font-size:14px;display:flex;align-items:center;gap:6px"><i class="fa-solid fa-circle-check"></i> Skrining Judul &amp; Abstrak Selesai!</h4>
            <span style="font-size:12.5px;color:#047857">Sebanyak <b>${counts.ft} studi</b> lolos seleksi awal. Sesuai alur PRISMA 2020, langkah berikutnya adalah <b>membaca teks lengkap (PDF)</b> untuk menilai kelayakan akhir sebelum mengekstraksi data.</span>
          </div>
          <div class="cb-actions" style="margin:0">
            <button class="btn sm" data-action="stage" data-stage="ft" style="background:#059669;color:#fff;font-weight:700;padding:8px 16px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(5,150,105,0.25)">
              Lanjut ke Tahap 2: Teks Lengkap (${counts.ft} studi) <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>`;
      } else {
        if (!single && S.records.some(r => r.screen.ta && r.screen.ta.r1 && r.screen.ta.r1.d === 'include')) {
          return `<div class="cbanner conf" style="background:#fffbeb;border:1.5px solid #fde68a;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-radius:10px">
            <div>
              <h4 style="margin:0 0 4px 0;color:#92400e;font-size:14px;display:flex;align-items:center;gap:6px"><i class="fa-solid fa-user-group"></i> Menunggu Keputusan Reviewer 2</h4>
              <span style="font-size:12.5px;color:#78350f">Studi di-Include oleh Reviewer 1 namun belum diputuskan oleh Reviewer 2. Dalam mode 2 reviewer, studi baru lolos bila disepakati kedua reviewer. Bekerja sendiri? Klik tombol di samping untuk beralih ke <b>Mode 1 Reviewer</b>.</span>
            </div>
            <div class="cb-actions" style="margin:0">
              <button class="btn sm" data-action="go-single" style="background:#b45309;color:#fff;font-weight:700;padding:8px 16px;border-radius:8px;white-space:nowrap">
                Aktifkan Mode 1 Reviewer
              </button>
            </div>
          </div>`;
        }
      }
    }
    return '';
  }

  // 2. Jika di tahap Teks Lengkap (ft)
  if (UI.stage === 'ft') {
    const pr = stageProgress('ft');
    if (counts.ft === 0) {
      return `<div class="cbanner warn" style="background:#fffbeb;border:1.5px solid #fde68a;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-radius:10px">
        <div>
          <h4 style="margin:0 0 4px 0;color:#92400e;font-size:14px;display:flex;align-items:center;gap:6px"><i class="fa-solid fa-triangle-exclamation"></i> Belum Ada Studi di Tahap Teks Lengkap</h4>
          <span style="font-size:12.5px;color:#78350f">Studi akan masuk ke tahap ini setelah diputuskan <b>Include</b> pada skrining <b>Judul &amp; Abstrak</b>.</span>
        </div>
        <div class="cb-actions" style="margin:0">
          <button class="btn sm" data-action="stage" data-stage="ta" style="background:#b45309;color:#fff;font-weight:700;padding:8px 16px;border-radius:8px;white-space:nowrap">
            <i class="fa-solid fa-filter"></i> Buka Skrining Judul &amp; Abstrak
          </button>
        </div>
      </div>`;
    }
    if (pr.total > 0 && pr.done === pr.total && counts.ex > 0) {
      return `<div class="cbanner ok" style="background:#ecfdf5;border:1.5px solid #a7f3d0;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-radius:10px">
        <div>
          <h4 style="margin:0 0 4px 0;color:#065f46;font-size:14px;display:flex;align-items:center;gap:6px"><i class="fa-solid fa-circle-check"></i> Telaah Teks Lengkap Selesai!</h4>
          <span style="font-size:12.5px;color:#047857">Sebanyak <b>${counts.ex} studi</b> resmi disepakati sebagai <b>Studi Inklusi Final</b> dan siap untuk diisi formulir ekstraksi datanya.</span>
        </div>
        <div class="cb-actions" style="margin:0">
          <button class="btn sm" data-action="stage" data-stage="ex" style="background:#059669;color:#fff;font-weight:700;padding:8px 16px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(5,150,105,0.25)">
            Lanjut ke Tahap 3: Ekstraksi Data (${counts.ex} studi) <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>`;
    }
    return `<div class="cbanner" style="background:#eff6ff;border:1.5px solid #bfdbfe;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-radius:10px">
      <div>
        <h4 style="margin:0 0 4px 0;color:#1e40af;font-size:14px;display:flex;align-items:center;gap:6px"><i class="fa-solid fa-book-open"></i> Tahap 2: Telaah Teks Lengkap (${counts.ft} studi)</h4>
        <span style="font-size:12.5px;color:#1e3a8a">Baca teks lengkap atau lampirkan PDF di panel tengah. Putuskan <b>Include</b> untuk meloloskan studi ke tahap <b>Ekstraksi Data</b>, atau <b>Exclude</b> (pilih alasan eksklusi untuk PRISMA).</span>
      </div>
      ${counts.ex > 0 ? `
      <div class="cb-actions" style="margin:0">
        <button class="btn sm ghost" data-action="stage" data-stage="ex" style="color:#2563eb;border-color:#93c5fd;font-weight:600;padding:6px 14px;white-space:nowrap">
          Lihat Ekstraksi (${counts.ex} studi) →
        </button>
      </div>` : ''}
    </div>`;
  }

  // 3. Jika di tahap Ekstraksi Data (ex)
  if (UI.stage === 'ex' && counts.ex === 0) {
    return `<div class="cbanner warn" style="background:#fffbeb;border:1.5px solid #fde68a;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-radius:10px">
      <div>
        <h4 style="margin:0 0 6px 0;color:#92400e;font-size:14px;display:flex;align-items:center;gap:6px"><i class="fa-solid fa-circle-info"></i> Formulir Ekstraksi Menunggu Studi Inklusi Final</h4>
        <p style="margin:0;font-size:12.5px;color:#78350f;line-height:1.5">
          Sesuai alur PRISMA 2020, <b>formulir ekstraksi data</b> hanya diisi untuk studi yang telah disetujui <b>"Include" pada tahap Teks Lengkap</b>.<br>
          ${counts.ft > 0 ? `Saat ini ada <b>${counts.ft} studi</b> yang lolos seleksi awal dan sedang menunggu telaah teks lengkap.` : `Saat ini belum ada studi yang lolos dari seleksi awal judul &amp; abstrak.`}
        </p>
      </div>
      <div class="cb-actions" style="margin:0">
        ${counts.ft > 0 ? `
        <button class="btn sm" data-action="stage" data-stage="ft" style="background:#b45309;color:#fff;font-weight:700;padding:9px 18px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(180,83,9,0.25)">
          <i class="fa-solid fa-book-open"></i> Buka Tahap Teks Lengkap (${counts.ft} studi)
        </button>` : `
        <button class="btn sm" data-action="stage" data-stage="ta" style="background:#b45309;color:#fff;font-weight:700;padding:9px 18px;border-radius:8px;white-space:nowrap">
          <i class="fa-solid fa-filter"></i> Buka Skrining Judul &amp; Abstrak
        </button>`}
      </div>
    </div>`;
  }

  return '';
}

/* Reset untuk kerja baru: muncul di akhir Ekstraksi data. Tidak menghapus apa pun sebelum cadangan diunduh dan dikonfirmasi. */
function newWorkBanner(pr) {
  const allDone = pr.total > 0 && pr.done === pr.total;
  if (!UI.nwAsk) {
    return allDone ? `<div class="cbanner ok"><span><b>Semua ${pr.total} studi selesai diekstraksi.</b> Bila review ini sudah tuntas, unduh cadangan lalu reset untuk memulai kerja baru.</span>
      <span class="cb-actions"><button class="btn sm" data-action="nw-ask">Reset untuk kerja baru…</button></span></div>` : '';
  }
  const left = pr.total - pr.done;
  const ok = UI.nwBacked ? '' : 'disabled title="Unduh cadangan dulu"';
  return `<div class="cbanner conf"><span><b>Reset untuk kerja baru?</b> ${left ? `<span class="txt-conf">Masih ${left} dari ${pr.total} studi belum selesai diekstraksi${solo() ? '' : '/dikonsensuskan'}.</span> ` : ''}Reset menghapus semua rekaman, keputusan skrining, ekstraksi, penilaian kualitas, PDF, dan teks dari peramban ini. Proyek lama hanya bisa dikembalikan lewat <b>Pulihkan dari cadangan</b> di tab Ekspor.<br>
    <b>1.</b> <label class="check sm" style="display:inline-flex"><input type="checkbox" id="bkPdf"> <span>Sertakan PDF</span></label> <button class="btn sm" data-action="nw-backup">Unduh cadangan</button> ${UI.nwBacked ? '<span class="pill ok">Cadangan diunduh</span>' : ''}
    <b>2.</b> Pilih jenis reset.</span>
    <span class="cb-actions"><button class="btn sm" data-action="nw-go" data-keep="1" ${ok}>Reset, pertahankan kriteria &amp; formulir</button><button class="btn sm danger" data-action="nw-go" ${ok}>Reset total</button><button class="btn sm ghost" data-action="nw-cancel">Batal</button></span></div>`;
}

async function newWorkGo(keep) {
  const s = defaultState(S.project.type);
  if (keep) {
    Object.assign(s, { criteria: S.criteria, reasons: S.reasons, fields: S.fields });
    s.project = Object.assign({}, S.project, { created: today() });
    if (S.cframeCustom) s.cframeCustom = S.cframeCustom;
  }
  UI.nwAsk = false; UI.nwBacked = false; UI.stage = 'ta'; UI.filter = 'all';
  await DB.clear('texts'); await DB.clear('pdfs');
  await loadState(s);
  show(keep ? 'import' : 'project');
  toast(keep ? 'Proyek direset. Kriteria, alasan, dan formulir dipertahankan; silakan impor rekaman baru.' : 'Proyek dikosongkan. Mulai dari Proyek & Kriteria.', 'ok');
}

/* Kelompok daftar: yang belum diputuskan di atas; yang sudah diputuskan pindah ke kotak masing-masing */
function myRv() { return solo() ? 'r1' : UI.as === 'both' ? null : UI.as; }
function recGroup(r, st = UI.stage) {
  const me = myRv();
  if (st === 'ex') return (me ? r.extract.done[me] : exDone(r)) ? 'done' : 'todo';
  const d = me ? r.screen[st][me] && r.screen[st][me].d : effective(r, st);
  return d === 'include' ? 'inc' : d === 'exclude' ? 'exc' : 'todo';
}
function listGroups(list, st = UI.stage) {
  const defs = st === 'ex'
    ? [['todo', 'Belum selesai diekstraksi'], ['done', 'Ekstraksi selesai']]
    : [['todo', myRv() || solo() ? 'Belum diputuskan' : 'Belum disepakati'], ['inc', 'Include'], ['exc', 'Exclude']];
  return defs.map(([k, label]) => ({ k, label, items: list.filter(r => recGroup(r, st) === k) }));
}
function orderedList(list = filteredRecords()) { return listGroups(list).flatMap(g => g.items); }
function nextTodo(fromId) {
  const ord = orderedList();
  const todo = ord.filter(r => recGroup(r) === 'todo' && r.id !== fromId);
  if (!todo.length) return null;
  const all = filteredRecords();
  const i = all.findIndex(r => r.id === fromId);
  return todo.find(r => all.indexOf(r) > i) || todo[0];
}
// Pindah otomatis ke rekaman berikutnya yang belum diputuskan
function advanceAfterDecision(r) {
  if (UI.autoNext === false || recGroup(r) === 'todo') return;
  const n = nextTodo(r.id);
  if (n) { UI.sel = n.id; UI.reveal = { r1: false, r2: false }; UI.findIdx = 0; autoDocMode(n); }
  else {
    const counts = { ta: stageRecords('ta').length, ft: stageRecords('ft').length, ex: stageRecords('ex').length };
    if (UI.stage === 'ta' && counts.ft > 0) {
      toast(`Semua rekaman Judul & Abstrak selesai! ${counts.ft} studi lolos ke tahap Teks Lengkap.`, 'ok');
    } else if (UI.stage === 'ft' && counts.ex > 0) {
      toast(`Semua rekaman Teks Lengkap selesai! ${counts.ex} studi lolos ke tahap Ekstraksi Data.`, 'ok');
    } else {
      toast('Semua rekaman di tahap ini sudah diputuskan.', 'ok');
    }
  }
}

function renderList(list = filteredRecords()) {
  const el = $('#recList');
  if (!el) return;
  const st = UI.stage;
  const badge = (r, rv) => {
    const masked = isMasked(rv, r);
    const d = decisionOf(r, rv);
    if (masked && d) return `<i class="b ${rv} hidden-d" title="${revName(rv)}: disembunyikan">•</i>`;
    if (st === 'ex') return `<i class="b ${rv} ${d === 'done' ? 'd-inc' : d ? 'd-may' : ''}" title="${revName(rv)}: ${d === 'done' ? 'selesai' : d ? 'draf' : 'belum'}">${d === 'done' ? '✓' : d ? '…' : ''}</i>`;
    return `<i class="b ${rv} ${d ? DEC[d].cls : ''}" title="${revName(rv)}: ${d ? DEC[d].id : 'belum'}">${d ? DEC[d].icon : ''}</i>`;
  };
  const status = r => {
    if (st === 'ex') return exDone(r) ? '<span class="pill ok">Final</span>' : (exNeedsCons(r) ? '<span class="pill conf">Konsensus</span>' : '');
    const s = stageStatus(r, st);
    if (s === 'conflict' && !(isMasked('r1', r) || isMasked('r2', r))) return '<span class="pill conf">Konflik</span>';
    if (s === 'include') return '<span class="pill ok">Include</span>';
    if (s === 'exclude') return '<span class="pill no">Exclude</span>';
    return '';
  };
  const item = r => {
      const f = evalBest(r);
      return `<button class="rec-item ${r.id === UI.sel ? 'sel' : ''}" data-action="select" data-id="${r.id}">
        <span class="flag-dot ${FLAG_META[f.flag].cls}" title="${FLAG_META[f.flag].label}"></span>
        <span class="ri-main"><span class="ri-title">${esc(r.title || '(tanpa judul)')}</span>
        <span class="ri-meta">${esc((r.authors || '').split(/[;,]/)[0])}${r.year ? ' · ' + esc(r.year) : ''}${r.hasText ? ' · <b class="pdf-tag">PDF</b>' : ''}${r.tier ? ` · <span class="pill tier">Tier ${esc(r.tier)}</span>` : ''}</span>
        <span class="ri-foot">${critLamps(f)}${badge(r, 'r1')}${solo() ? '' : badge(r, 'r2')}${status(r)}</span></span>
      </button>`;
  };
  UI.secOpen = UI.secOpen || {};
  const groups = listGroups(list);
  el.innerHTML = `<div class="list-head"><span>${list.length} rekaman</span>
      <label class="check sm" title="Setelah memutuskan, langsung buka rekaman berikutnya yang belum diputuskan"><input type="checkbox" id="autoNext" ${UI.autoNext !== false ? 'checked' : ''}> <span>Lanjut otomatis</span></label>
      <button class="icon-btn" data-action="toggle-list" aria-label="Ciutkan daftar" title="Ciutkan daftar">⟨</button></div>
    <div class="list-body">${!list.length ? `<p class="empty pad">${emptyListText()}</p>` : groups.map(g => {
      const open = g.k === 'todo' ? UI.secOpen.todo !== false : !!UI.secOpen[g.k] || g.items.some(r => r.id === UI.sel);
      return `<div class="lsec lsec-${g.k}">
        <button class="lsec-head" data-action="sec-toggle" data-k="${g.k}" aria-expanded="${open}"><span class="lsec-caret">${open ? '▾' : '▸'}</span><span class="lsec-dot"></span><b>${g.label}</b><span class="n">${g.items.length}</span></button>
        ${g.k === 'exc' && UI.stage !== 'ex' ? cleanTools(UI.stage) : ''}
        ${open ? (g.items.map(item).join('') || `<p class="lsec-empty">${g.k === 'todo' ? '✓ Semua sudah diputuskan.' : 'Kosong.'}</p>`) : ''}
      </div>`;
    }).join('')}</div>`;
  const sel = el.querySelector('.rec-item.sel');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function emptyListText() {
  if (!S.records.length) return 'Belum ada rekaman. Impor file di tab Impor.';
  if (UI.stage === 'ft') return 'Belum ada rekaman yang lolos skrining judul/abstrak. Pastikan studi disetujui (Include).';
  if (UI.stage === 'ex') return 'Belum ada studi yang lolos skrining teks lengkap. Putuskan "Include" pada tahap Teks lengkap terlebih dahulu.';
  return 'Tidak ada rekaman yang cocok dengan filter.';
}

function renderPanels() {
  renderPanelA();
  renderReviewer('r1');
  if (!solo()) renderReviewer('r2');
}

/* ---------- Panel A: dokumen & ekstraksi ---------- */
async function renderPanelA() {
  const el = $('#panelA');
  if (!el) return;
  const r = rec(UI.sel);
  if (!r) {
    const counts = { ta: stageRecords('ta').length, ft: stageRecords('ft').length, ex: stageRecords('ex').length };
    if (UI.stage === 'ex' && counts.ex === 0) {
      el.innerHTML = `<div class="panel-empty" style="padding:48px 24px;text-align:center">
        <div style="font-size:42px;margin-bottom:12px">📋</div>
        <h3 style="margin-bottom:8px;color:#1e293b">Formulir Ekstraksi Menunggu Studi Inklusi Final</h3>
        <p style="max-width:520px;margin:0 auto 16px auto;color:#64748b;font-size:13px;line-height:1.6">
          Sesuai standar alur PRISMA 2020: <b>1. Skrining Judul &amp; Abstrak</b> → <b>2. Telaah Teks Lengkap (PDF)</b> → <b>3. Ekstraksi Data</b>.<br>
          Studi akan muncul di formulir ekstraksi setelah Anda memutuskan <b>Include</b> pada tahap <b>Teks lengkap</b>.
        </p>
        ${counts.ft > 0 ? `<button class="btn" data-action="stage" data-stage="ft" style="background:#2563eb;color:#fff;font-weight:700;padding:9px 20px;border-radius:8px">
          <i class="fa-solid fa-book-open"></i> Buka Tahap Teks Lengkap (${counts.ft} studi)
        </button>` : `<button class="btn" data-action="stage" data-stage="ta" style="background:#059669;color:#fff;font-weight:700;padding:9px 20px;border-radius:8px">
          <i class="fa-solid fa-filter"></i> Buka Skrining Judul &amp; Abstrak
        </button>`}
      </div>`;
      return;
    }
    el.innerHTML = `<div class="panel-empty"><h3>Belum ada rekaman dipilih</h3><p>${emptyListText()}</p><button class="btn" data-action="goto" data-view="import">Buka Impor</button></div>`;
    return;
  }
  const list = filteredRecords();
  const idx = list.findIndex(x => x.id === r.id);
  const text = r.hasText ? await loadText(r.id) : null;
  if (UI.sel !== r.id) return;
  const ev = text ? flagFT(r) : flagOf(r);
  const mode = UI.stage === 'ex' && UI.panelTab === 'cons' && !solo() ? 'cons' : UI.docMode;
  const tabs = [['abs', 'Abstrak'], ['txt', 'Teks lengkap' + (r.pages ? ` · ${r.pages} hlm.` : '')], ['pdf', 'PDF']];
  el.innerHTML = `
    <div class="pa-head">
      <div class="pa-nav">
        <span class="panel-tag">Panel ekstraksi</span>
        <span class="muted small">${idx + 1} / ${list.length}</span>
        <button class="icon-btn" data-action="prev" aria-label="Sebelumnya" title="Sebelumnya (K)">↑</button>
        <button class="icon-btn" data-action="next" aria-label="Berikutnya" title="Berikutnya (J)">↓</button>
        ${!UI.listOpen ? '<button class="btn sm ghost" data-action="toggle-list">Daftar</button>' : ''}
      </div>
      <h2 class="doc-title">${Criteria.highlight(r.title || '(tanpa judul)', S.criteria)}</h2>
      <p class="doc-meta">${esc(r.authors || 'Penulis tidak diketahui')}${r.year ? ' · ' + esc(r.year) : ''}${r.journal ? ' · <i>' + esc(r.journal) + '</i>' : ''}</p>
      <p class="doc-meta small">${r.doi ? `<a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener">doi:${esc(r.doi)}</a> · ` : ''}<span class="src-chip">${esc(r.source)}</span></p>
      ${indicatorBlock(ev, r, !!text)}
    </div>
    ${consensusBanner(r)}
    <div class="pa-tools">
      <div class="seg sm">
        ${tabs.map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-action="docmode" data-mode="${k}" ${k !== 'abs' && !r.hasText && !(k === 'pdf' && r.hasPdf) ? 'disabled title="Belum ada PDF"' : ''}>${l}</button>`).join('')}
        ${UI.stage === 'ex' && !solo() ? `<button class="${mode === 'cons' ? 'on' : ''}" data-action="docmode" data-mode="cons">Konsensus</button>` : ''}
      </div>
      ${mode === 'abs' || mode === 'txt' ? `<div class="seg sm lang-seg" role="group" aria-label="Bahasa baca">${[['orig', 'Asli'], ['bi', 'Dwibahasa'], ['id', 'Indonesia']].map(([k, l]) => `<button class="${(UI.lang || 'orig') === k ? 'on' : ''}" data-action="lang" data-lang="${k}" title="${k === 'orig' ? 'Teks asli dengan sorotan kata kunci' : k === 'bi' ? 'Paragraf asli + terjemahan Indonesia di bawahnya' : 'Hanya terjemahan Indonesia'}">${l}</button>`).join('')}</div>` : ''}
      ${mode !== 'cons' ? `<div class="find">
        <input type="search" id="findInput" placeholder="Cari di dokumen ( / )" value="${esc(UI.find)}" aria-label="Cari di dokumen">
        <span class="find-n" id="findN"></span>
        <button class="icon-btn" data-action="find-prev" aria-label="Hasil sebelumnya">‹</button><button class="icon-btn" data-action="find-next" aria-label="Hasil berikutnya">›</button>
      </div>` : ''}
      <div class="pa-actions">
        <button class="btn sm ghost" data-action="attach-pdf">${r.hasText ? 'Ganti PDF' : 'Lampirkan PDF'}</button>
        ${UI.stage !== 'ta' ? `<label class="check sm"><input type="checkbox" id="notRetr" data-action-change="not-retrieved" ${r.notRetrieved ? 'checked' : ''}> <span>Tidak dapat diperoleh</span></label>` : ''}
      </div>
    </div>
    <div class="doc-content" id="docContent" tabindex="0"></div>`;
  renderDocContent(r, text, mode);
}

function consensusBanner(r) {
  const st = UI.stage;
  if (st === 'ex' && solo()) {
    return r.extract.done.r1 ? '<div class="cbanner ok"><b>Ekstraksi selesai.</b> Isian Reviewer 1 dipakai sebagai data final.</div>'
      : '<div class="cbanner"><span>Menunggu ekstraksi ' + esc(revName('r1')) + '</span></div>';
  }
  if (st !== 'ex' && solo()) {
    const d = r.screen[st].r1 && r.screen[st].r1.d;
    const name = st === 'ta' ? 'judul/abstrak' : 'teks lengkap';
    if (!d) return `<div class="cbanner"><span>Skrining ${name}: belum diputuskan</span></div>`;
    if (d === 'maybe') return `<div class="cbanner conf"><span>Skrining ${name}: <b>Ragu</b>. Putuskan Include atau Exclude agar rekaman bisa lanjut.</span></div>`;
    return `<div class="cbanner ${d === 'include' ? 'ok' : 'no'}"><b>Keputusan: ${DEC[d].id}</b>${d === 'exclude' && r.screen[st].r1.reason ? ' · ' + esc(r.screen[st].r1.reason) : ''}</div>`;
  }
  if (st === 'ex') {
    const d = r.extract.done;
    if (d.final) return `<div class="cbanner ok"><b>Ekstraksi final tersimpan.</b> <button class="link" data-action="docmode" data-mode="cons">Lihat konsensus</button></div>`;
    if (d.r1 && d.r2) return `<div class="cbanner conf"><b>Kedua reviewer selesai.</b> Bandingkan isian dan tetapkan nilai final. <button class="btn sm" data-action="docmode" data-mode="cons">Buka konsensus</button></div>`;
    return `<div class="cbanner"><span>Menunggu ekstraksi: ${['r1', 'r2'].filter(x => !d[x]).map(revName).map(esc).join(' dan ')}</span></div>`;
  }
  const s = r.screen[st];
  const masked = isMasked('r1', r) || isMasked('r2', r);
  const status = stageStatus(r, st);
  const name = st === 'ta' ? 'judul/abstrak' : 'teks lengkap';
  if (status === 'pending' || status === 'partial' || masked) {
    const waiting = ['r1', 'r2'].filter(x => !hasDec(r, st, x)).map(revName).map(esc);
    return `<div class="cbanner"><span>Skrining ${name}: ${waiting.length ? 'menunggu ' + waiting.join(' dan ') : 'menunggu kedua reviewer'}</span></div>`;
  }
  if (s.final) {
    return `<div class="cbanner ${s.final.d === 'include' ? 'ok' : 'no'}"><b>Keputusan konsensus: ${DEC[s.final.d].id}</b>${s.final.reason ? ' · ' + esc(s.final.reason) : ''} <button class="link" data-action="final-clear">Ubah</button></div>`;
  }
  if (status === 'include' || status === 'exclude') {
    return `<div class="cbanner ${status === 'include' ? 'ok' : 'no'}"><b>Kedua reviewer sepakat: ${DEC[status].id}</b>${status === 'exclude' && st === 'ft' ? ' · ' + esc(finalReason(r, st)) : ''}</div>`;
  }
  const canResolve = UI.as === 'both';
  return `<div class="cbanner conf">
    <span><b>Konflik.</b> ${esc(revName('r1'))}: ${DEC[s.r1.d].id} · ${esc(revName('r2'))}: ${DEC[s.r2.d].id}</span>
    ${canResolve ? `<span class="cb-actions">Keputusan akhir:
      <button class="btn sm d-inc" data-action="final" data-d="include">Include</button>
      <button class="btn sm d-exc" data-action="final" data-d="exclude">Exclude</button>
      ${st === 'ft' ? `<select id="finalReason" aria-label="Alasan eksklusi final">${opt('', 'Alasan eksklusi…', '')}${S.reasons.map(x => opt(x, x, '')).join('')}</select>` : ''}
    </span>` : '<span class="muted small">Diselesaikan dalam mode "Kedua reviewer".</span>'}
  </div>`;
}

function renderDocContent(r, text, mode) {
  const el = $('#docContent');
  if (!el) return;
  if (mode === 'cons') { el.innerHTML = consensusTable(r); return; }
  const lang = UI.lang || 'orig';
  if (lang !== 'orig' && (mode === 'abs' || (mode === 'txt' && text))) { Tr.render(el, r, text, mode, lang); return; }
  if (mode === 'abs') {
    el.innerHTML = `<article class="doc-text" data-page="abs">
      <h4 class="doc-sub">Abstrak</h4>
      <p>${r.abstract ? Criteria.highlight(r.abstract, S.criteria, UI.find).replace(/\n/g, '<br>') : '<span class="muted">Abstrak tidak tersedia. Lampirkan PDF untuk membaca teks lengkap.</span>'}</p>
      ${r.keywords ? `<h4 class="doc-sub">Kata kunci</h4><p>${Criteria.highlight(r.keywords, S.criteria, UI.find)}</p>` : ''}
    </article>${termHitsBlock(tiabText(r))}`;
  } else if (mode === 'txt') {
    if (!text) { el.innerHTML = '<p class="empty pad">Belum ada teks lengkap. Klik "Lampirkan PDF".</p>'; return; }
    el.innerHTML = termHitsBlock(text.join('\n')) + text.map((p, i) => `<article class="doc-text page-txt" data-page="${i + 1}"><span class="pg-no">Hlm. ${i + 1}</span><p>${Criteria.highlight(p, S.criteria, UI.find).replace(/\n/g, '<br>')}</p></article>`).join('');
  } else if (mode === 'pdf') {
    el.innerHTML = '<div class="pdf-pages" id="pdfPages"><p class="muted pad">Memuat PDF…</p></div>';
    renderPdf(r);
    return;
  }
  updateFind(false);
}

function termHitsBlock(text) {
  const th = Criteria.termHits(text, S.criteria);
  if (!th.length) return '';
  return `<details class="term-hits" ${UI.hitsOpen ? 'open' : ''} data-action-toggle="hits"><summary>Kata kunci terdeteksi</summary>
    <div class="th-grid">${th.map(c => `<div class="th-group"><span class="th-label"><i class="crit-swatch ${c.kind === 'inc' ? 'hl-c' + (c.idx % 6) : 'hl-exc'}"></i>${esc(c.label)}</span>
      ${c.terms.map(t => `<button class="th-term ${t.n ? 'on' : ''}" data-action="find-term" data-term="${esc(t.t)}">${esc(t.t)} <b>${t.n}</b></button>`).join('')}</div>`).join('')}</div></details>`;
}

async function renderPdf(r) {
  const wrap = $('#pdfPages');
  try {
    let pdf = UI.pdfCache[r.id];
    if (!pdf) {
      const blob = await DB.get('pdfs', r.id);
      if (!blob) { wrap.innerHTML = '<p class="empty pad">File PDF asli tidak tersimpan (mungkin dipulihkan dari cadangan tanpa PDF). Pakai tab Teks lengkap.</p>'; return; }
      pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
      UI.pdfCache[r.id] = pdf;
    }
    if (UI.sel !== r.id) return;
    wrap.innerHTML = `<p class="hint pad">Sorotan kata kunci digambar di atas halaman. Untuk menyalin kutipan, pakai tab <b>Teks lengkap</b>.</p>`;
    const C = Criteria.compiled(S.criteria);
    const width = Math.min(wrap.clientWidth - 8, 900);
    const colors = getComputedStyle(document.documentElement);
    const hlCol = i => colors.getPropertyValue('--hl' + i).trim() || 'rgba(255,220,0,.4)';
    const max = Math.min(pdf.numPages, UI.pdfMore === r.id ? pdf.numPages : 25);
    for (let p = 1; p <= max; p++) {
      if (UI.sel !== r.id || UI.docMode !== 'pdf') return;
      const page = await pdf.getPage(p);
      const vp0 = page.getViewport({ scale: 1 });
      const scale = width / vp0.width;
      const vp = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
      const box = document.createElement('div');
      box.className = 'pdf-page';
      box.dataset.page = p;
      const cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      cv.style.width = width + 'px';
      box.appendChild(cv);
      const lbl = document.createElement('span'); lbl.className = 'pg-no'; lbl.textContent = 'Hlm. ' + p; box.appendChild(lbl);
      wrap.appendChild(box);
      const ctx = cv.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      // sorotan kata kunci di atas kanvas
      const tc = await page.getTextContent();
      ctx.globalCompositeOperation = 'multiply';
      tc.items.forEach(it => {
        if (!it.str) return;
        const groups = [...C.exc.map(c => ({ c, col: 'rgba(230,60,50,.35)' })), ...C.inc.map(c => ({ c, col: hlCol(c.idx % 6) }))];
        groups.forEach(({ c, col }) => {
          c.re.lastIndex = 0;
          let m;
          while ((m = c.re.exec(it.str))) {
            const tx = pdfjsLib.Util.transform(vp.transform, it.transform);
            const fh = Math.hypot(tx[2], tx[3]);
            const w = it.width * vp.scale;
            const x0 = tx[4] + w * (m.index / it.str.length);
            const ww = w * (m[0].length / it.str.length);
            ctx.fillStyle = col;
            ctx.fillRect(x0, tx[5] - fh * 0.85, ww, fh * 1.05);
            if (!m[0]) c.re.lastIndex++;
          }
        });
      });
      ctx.globalCompositeOperation = 'source-over';
    }
    if (max < pdf.numPages) {
      const b = document.createElement('button');
      b.className = 'btn ghost'; b.textContent = `Tampilkan ${pdf.numPages - max} halaman lagi`;
      b.onclick = () => { UI.pdfMore = r.id; renderPanelA(); };
      wrap.appendChild(b);
    }
  } catch (e) {
    console.error(e);
    wrap.innerHTML = `<p class="empty pad">PDF gagal ditampilkan: ${esc(e.message)}</p>`;
  }
}

/* ---------- Konsensus ekstraksi ---------- */
function consensusTable(r) {
  const ex = r.extract;
  const canFinal = UI.as === 'both';
  const fields = visibleFields(Object.assign({}, ex.r1, ex.r2, ex.final));
  const unionType = ex.final.ma_type || ex.r1.ma_type || ex.r2.ma_type;
  const fl = S.fields.filter(f => {
    if (f.group === 'ma' && S.project.type !== 'meta') return false;
    if (f.showIf && f.showIf.length) return [ex.r1.ma_type, ex.r2.ma_type, ex.final.ma_type, unionType].some(t => f.showIf.includes(t));
    return true;
  });
  const same = fl.filter(f => consSame(ex.r1[f.id], ex.r2[f.id])).length;
  return `<div class="cons">
    <div class="cons-head">
      <div><b>${same}</b> dari ${fl.length} kolom sama. ${!(ex.done.r1 && ex.done.r2) ? '<span class="txt-conf">Belum semua reviewer menandai selesai.</span>' : ''}</div>
      ${canFinal ? `<div class="btn-row"><button class="btn sm ghost" data-action="cons-fill">Isi otomatis kolom yang sama</button>
        <label class="check sm"><input type="checkbox" id="consDone" data-action-change="cons-done" ${ex.done.final ? 'checked' : ''}> <span>Final selesai</span></label></div>` : '<span class="muted small">Konsensus diisi dalam mode "Kedua reviewer".</span>'}
    </div>
    <div class="table-wrap"><table class="tbl cons-tbl">
      <thead><tr><th>Kolom</th><th><i class="dot r1"></i> ${esc(revName('r1'))}</th><th><i class="dot r2"></i> ${esc(revName('r2'))}</th><th>Final</th></tr></thead>
      <tbody>${fl.map(f => {
        const a = ex.r1[f.id] || '', b = ex.r2[f.id] || '', fin = ex.final[f.id] ?? '';
        const diff = !consSame(a, b), loose = !diff && a.trim() !== b.trim();
        return `<tr class="${diff ? 'diff' : ''}"><td><b>${esc(f.label)}</b>${diff ? '<span class="pill conf">beda</span>' : loose ? '<span class="pill" title="Isi sama, hanya beda tanda baca, huruf besar/kecil, spasi, atau urutan pilihan">beda format</span>' : ''}</td>
          <td>${esc(a) || '<span class="muted">—</span>'}${canFinal && a ? `<button class="link sm" data-action="cons-pick" data-f="${f.id}" data-from="r1">pakai</button>` : ''}</td>
          <td>${esc(b) || '<span class="muted">—</span>'}${canFinal && b ? `<button class="link sm" data-action="cons-pick" data-f="${f.id}" data-from="r2">pakai</button>` : ''}</td>
          <td>${canFinal ? fieldInput(f, fin, 'final', r.id) : esc(fin)}</td></tr>`;
      }).join('')}</tbody></table></div>
  </div>`;
}

/* ---------- Panel reviewer ---------- */
function fieldInput(f, val, rv, rid, disabled) {
  const id = `f-${rv}-${f.id}`;
  const common = `id="${id}" data-rv="${rv}" data-fid="${f.id}" data-rid="${rid}" ${disabled ? 'disabled' : ''}`;
  if (f.type === 'textarea') return `<textarea ${common} rows="2">${esc(val)}</textarea>`;
  if (f.type === 'multi') {
    const sel = String(val || '').split(';').map(s => s.trim()).filter(Boolean);
    const opts = (f.options || []).concat(sel.filter(s => !(f.options || []).includes(s)));
    return `<div class="multi" id="${id}" role="group" data-rv="${rv}" data-fid="${f.id}" data-rid="${rid}">${opts.map((o, i) => `<label class="check sm"><input type="checkbox" id="${id}-${i}" data-multi="1" value="${esc(o)}" ${sel.includes(o) ? 'checked' : ''} ${disabled ? 'disabled' : ''}> <span>${esc(o)}</span></label>`).join('')}</div>`;
  }
  if (f.type === 'select') return `<select ${common}>${opt('', '—', val)}${(f.options || []).map(o => opt(o, o, val)).join('')}${val && !(f.options || []).includes(val) ? opt(val, val, val) : ''}</select>`;
  return `<input type="${f.type === 'number' ? 'text' : 'text'}" ${f.type === 'number' ? 'inputmode="decimal"' : ''} ${common} value="${esc(val)}">`;
}

function renderReviewer(rv) {
  const el = $('#panel-' + rv);
  if (!el) return;
  const r = rec(UI.sel);
  const editable = canEdit(rv);
  const head = `<div class="rv-head ${rv}">
    <span class="rv-dot"></span><div class="rv-name"><b>${esc(revName(rv))}</b><span>Reviewer ${rv === 'r1' ? 1 : 2}${editable ? '' : ' · hanya baca'}</span></div>
    ${r ? rvStatus(r, rv) : ''}</div>`;
  if (!r) {
    if (UI.stage === 'ex' && stageRecords('ex').length === 0) {
      const cFt = stageRecords('ft').length;
      el.innerHTML = head + `<div class="panel-empty small" style="padding:24px 16px;text-align:center">
        <p style="color:#64748b;margin-bottom:10px">Formulir ekstraksi (${esc(revName(rv))}) akan otomatis aktif untuk setiap studi yang lolos tahap Teks Lengkap.</p>
        ${cFt > 0 ? `<button class="btn sm ghost" data-action="stage" data-stage="ft"><i class="fa-solid fa-book-open"></i> Buka Teks Lengkap (${cFt})</button>` : ''}
      </div>`;
      return;
    }
    el.innerHTML = head + '<div class="panel-empty small"><p>Pilih rekaman di daftar.</p></div>';
    return;
  }
  if (isMasked(rv, r)) {
    el.innerHTML = head + `<div class="masked"><div class="mask-icon" aria-hidden="true"></div><b>Disembunyikan (mode blind)</b>
      <p>Keputusan ${esc(revName(rv))} terbuka setelah kedua reviewer selesai pada rekaman ini.</p>
      <button class="btn sm ghost" data-action="reveal" data-rv="${rv}">Tetap tampilkan</button></div>`;
    return;
  }
  if (UI.stage === 'ex') { el.innerHTML = head + extractForm(r, rv, editable); return; }
  const st = UI.stage;
  const d = r.screen[st][rv] || {};
  const reasonReq = st === 'ft' && d.d === 'exclude';
  el.innerHTML = head + `
    <div class="rv-body">
      <p class="rv-q">${st === 'ta' ? 'Apakah judul & abstrak memenuhi kriteria?' : 'Apakah teks lengkap memenuhi kriteria kelayakan?'}</p>
      ${isLocked(r, st, rv) ? `<div class="locked ${d.d === 'include' ? 'ok' : 'no'}">
        <span class="locked-i">${DEC[d.d].icon}</span>
        <div><b>Sudah diputuskan: ${DEC[d.d].id}</b><span class="muted small">${d.auto ? 'dari saran otomatis · ' : ''}${new Date(d.ts || Date.now()).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Dihitung satu kali di PRISMA.</span></div>
        ${editable ? `<button class="btn sm ghost" data-action="unlock" data-rv="${rv}">Ubah keputusan</button>` : ''}
      </div>` : `<div class="decide">
        ${Object.entries(DEC).map(([k, v]) => `<button class="dec ${v.cls} ${d.d === k ? 'on' : ''}" data-action="decide" data-rv="${rv}" data-d="${k}" ${editable ? '' : 'disabled'} aria-pressed="${d.d === k}">
          <span class="dec-i">${v.icon}</span><span>${v.label}</span>${UI.as === rv || (solo() && rv === 'r1') ? `<kbd>${{ include: 'I', maybe: 'M', exclude: 'E' }[k]}</kbd>` : ''}</button>`).join('')}
      </div>`}
      ${d.d === 'exclude' ? `<label class="fld"><span>Alasan eksklusi${reasonReq ? ' <b class="req">wajib untuk PRISMA</b>' : ' (opsional)'}</span>
        <select id="reason-${rv}" data-action-change="reason" data-rv="${rv}" ${editable ? '' : 'disabled'} class="${reasonReq && !d.reason ? 'need' : ''}">${opt('', 'Pilih alasan…', d.reason || '')}${S.reasons.map(x => opt(x, x, d.reason || '')).join('')}</select></label>` : ''}
      <label class="fld"><span>Catatan &amp; kutipan</span>
        <textarea id="note-${rv}" rows="6" data-note="${rv}" data-rid="${r.id}" ${editable ? '' : 'disabled'} placeholder="Blok teks di panel ekstraksi lalu klik 'Kutip ke' untuk menyalin bukti beserta nomor halaman.">${esc(d.note || '')}</textarea></label>
      ${st === 'ta' ? rvOtherStage(r, rv) : rvOtherStage(r, rv, 'ta')}
    </div>`;
}

function rvStatus(r, rv) {
  if (UI.stage === 'ex') return r.extract.done[rv] ? '<span class="pill ok">Selesai</span>' : '<span class="pill">Draf</span>';
  const d = r.screen[UI.stage][rv];
  return d && d.d ? `<span class="pill ${d.d === 'include' ? 'ok' : d.d === 'exclude' ? 'no' : 'warn'}">${DEC[d.d].id}</span>` : '<span class="pill">Belum</span>';
}

function rvOtherStage(r, rv, which) {
  if (!which) return '';
  const d = r.screen[which][rv];
  return d && d.d ? `<p class="muted small">Judul/abstrak: <b>${DEC[d.d].id}</b>${d.note ? ' · ' + esc(d.note.slice(0, 80)) : ''}</p>` : '';
}

/* Grup kolom formulir sesuai urutan kemunculan; '' = Karakteristik studi, 'ma' = Data efek */
function fieldGroups(fields) {
  const seen = [];
  fields.forEach(f => { const g = f.group || ''; if (!seen.includes(g)) seen.push(g); });
  return seen.map(g => [g, g === '' ? 'Karakteristik studi' : g === 'ma' ? 'Data efek (meta-analisis)' : g]);
}

function extractForm(r, rv, editable) {
  const vals = r.extract[rv] || {};
  const fields = visibleFields(vals);
  const groups = fieldGroups(fields);
  return `<div class="rv-body ex-body">
    <div class="ex-top">
      <label class="check"><input type="checkbox" id="done-${rv}" data-action-change="ex-done" data-rv="${rv}" ${r.extract.done[rv] ? 'checked' : ''} ${editable ? '' : 'disabled'}> <span>Ekstraksi selesai</span></label>
      ${editable ? `<button class="btn sm ghost" data-action="prefill" data-rv="${rv}" title="Isi ID studi, tahun, dan sampel dari metadata">Isi dari metadata</button>` : ''}
      <span class="muted small">Isian tersimpan otomatis.</span>
    </div>
    ${groups.map(([g, title]) => {
      const fl = fields.filter(f => (f.group || '') === g);
      if (!fl.length) return '';
      return `<fieldset class="ex-group"><legend>${esc(title)}</legend>${fl.map(f => { const tag = f.type === 'multi' ? 'div' : 'label'; return `<${tag} class="fld ${UI.activeField[rv] === f.id ? 'active' : ''}" data-fwrap="${f.id}"><span>${esc(f.label)}</span>${fieldInput(f, vals[f.id] ?? '', rv, r.id, !editable)}</${tag}>`; }).join('')}</fieldset>`;
    }).join('')}
  </div>`;
}

/* ---------- Aksi ---------- */
function isLocked(r, st, rv) {
  const d = r.screen[st][rv];
  return !!(d && (d.d === 'include' || d.d === 'exclude')) && !(UI.unlock && UI.unlock[r.id + st + rv]);
}

function decide(rv, d) {
  const r = rec(UI.sel);
  if (!r || !canEdit(rv)) return;
  if (isLocked(r, UI.stage, rv)) { toast('Rekaman ini sudah diputuskan. Klik "Ubah keputusan" bila memang ingin mengganti.', 'warn'); return; }
  const s = r.screen[UI.stage];
  const prev = s[rv] || {};
  s[rv] = prev.d === d
    ? (prev.note ? { d: null, reason: '', note: prev.note, ts: Date.now() } : null)
    : { d, reason: d === 'exclude' ? (prev.reason || '') : '', note: prev.note || '', ts: Date.now() };
  if (s.final && s.r1 && s.r2 && s.r1.d === s.r2.d && s.r1.d !== 'maybe') s.final = null;
  touch();
  if (UI.unlock) delete UI.unlock[r.id + UI.stage + rv];
  const now = stageStatus(r, UI.stage);
  if (s[rv] && s[rv].d === d) {
    if (now === 'include') toast(UI.stage === 'ta' ? 'Include: rekaman masuk tahap Teks lengkap.' : 'Include: studi masuk tahap Ekstraksi data dan dihitung sebagai studi inklusi.', 'ok');
    else if (now === 'exclude') toast(UI.stage === 'ft' && !s[rv].reason && !(s.final && s.final.reason) ? 'Exclude tercatat. Pilih alasan eksklusi agar muncul di Laporan dan PRISMA.' : 'Exclude tercatat di Laporan dan PRISMA.', UI.stage === 'ft' ? 'warn' : 'ok');
    else if (now === 'conflict') toast('Keputusan kedua reviewer berbeda: selesaikan konflik.', 'warn');
    else if (now === 'partial') toast(`${revName(rv)}: ${DEC[d].id}. Menunggu keputusan ${revName(rv === 'r1' ? 'r2' : 'r1')} (mode 2 reviewer).`, 'ok');
  }
  const needReason = UI.stage === 'ft' && s[rv] && s[rv].d === 'exclude' && !s[rv].reason;
  if (s[rv] && s[rv].d === d && !needReason) advanceAfterDecision(r);
  refreshStageCounts();
  renderList(); renderPanels();
}

function refreshStageCounts() {
  const counts = { ta: stageRecords('ta').length, ft: stageRecords('ft').length, ex: stageRecords('ex').length };
  $$('.stage-seg button').forEach(b => { const n = b.querySelector('.n'); if (n) n.textContent = counts[b.dataset.stage]; });
  const pr = stageProgress(UI.stage);
  const wp = $('.work-progress');
  if (wp) wp.innerHTML = `<div class="bar"><i style="width:${pr.total ? pr.done / pr.total * 100 : 0}%"></i></div><span><b>${pr.done}</b>/${pr.total} selesai${pr.conflict ? ` · <span class="txt-conf">${pr.conflict} konflik</span>` : ''}</span>`;
}

function move(delta) {
  const list = orderedList();
  const i = list.findIndex(r => r.id === UI.sel);
  const n = list[Math.max(0, Math.min(list.length - 1, i + delta))];
  if (n) selectRec(n.id);
}

// Rekaman ber-PDF langsung dibuka di teks lengkap (tampilan PDF asli tetap dipertahankan); tanpa PDF -> abstrak
function autoDocMode(r) {
  if (!r) return;
  if (UI.stage === 'ex' && UI.panelTab === 'cons') return;
  if (r.hasText) { if (UI.docMode !== 'pdf') UI.docMode = 'txt'; }
  else if (r.hasPdf && UI.docMode === 'pdf') { /* PDF tanpa teks: tetap PDF */ }
  else UI.docMode = 'abs';
}
function selectRec(id) {
  UI.sel = id;
  const tp = $('#trPop'); if (tp) tp.hidden = true;
  UI.reveal = { r1: false, r2: false };
  UI.findIdx = 0;
  const r = rec(id);
  autoDocMode(r);
  $$('.rec-item').forEach(b => b.classList.toggle('sel', b.dataset.id === id));
  const sel = $('.rec-item.sel');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
  renderPanels();
}

function updateFind(scroll = true) {
  const marks = $$('#docContent mark.hl-find');
  const n = $('#findN');
  if (n) n.textContent = UI.find ? (marks.length ? `${Math.min(UI.findIdx + 1, marks.length)}/${marks.length}` : '0') : '';
  marks.forEach((m, i) => m.classList.toggle('cur', i === UI.findIdx));
  if (scroll && marks[UI.findIdx]) marks[UI.findIdx].scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function quoteTo(rv) {
  const r = rec(UI.sel);
  const sel = window.getSelection();
  const txt = sel ? sel.toString().replace(/\s+/g, ' ').trim() : '';
  if (!r || !txt) return;
  if (!canEdit(rv)) { toast('Anda sedang bekerja sebagai reviewer lain. Ubah di "Bekerja sebagai".', 'warn'); return; }
  let node = sel.anchorNode;
  while (node && node.nodeType !== 1) node = node.parentNode;
  const pg = node && node.closest('[data-page]');
  const page = pg && pg.dataset.page !== 'abs' ? ` (hlm. ${pg.dataset.page})` : (pg ? ' (abstrak)' : '');
  const q = `"${txt}"${page}${node && node.closest('.tr-out') ? ' [terjemahan mesin]' : ''}`;
  if (UI.stage === 'ex') {
    const fid = UI.activeField[rv] || (S.fields.find(f => f.type === 'textarea') || S.fields[0]).id;
    const cur = r.extract[rv][fid] || '';
    r.extract[rv][fid] = cur ? cur + '\n' + q : q;
    UI.activeField[rv] = fid;
    toast('Kutipan masuk ke ' + revName(rv) + ' → ' + (S.fields.find(f => f.id === fid) || {}).label);
  } else {
    const s = r.screen[UI.stage];
    if (!s[rv]) s[rv] = { d: null, reason: '', note: '', ts: Date.now() };
    s[rv].note = s[rv].note ? s[rv].note + '\n' + q : q;
    toast('Kutipan masuk ke catatan ' + revName(rv));
  }
  touch();
  renderReviewer(rv);
  $('#selbar').hidden = true;
  sel.removeAllRanges();
}

async function attachPdf(file, r) {
  try {
    toast('Membaca PDF…');
    const parsed = await Parsers.readPDF(file);
    await storePdf(r, file, parsed);
    if (!r.abstract && parsed.rec.abstract) r.abstract = parsed.rec.abstract;
    if (!r.doi && parsed.rec.doi) r.doi = parsed.rec.doi;
    touch();
    UI.docMode = 'txt';
    renderWork();
    const ev = flagFT(r);
    toast(`PDF terbaca (${parsed.numPages} hlm.) · ${ev.incMatched} dari ${ev.total} kriteria terdeteksi${ev.excMatched ? ' · ada kata eksklusi' : ''}`, ev.flag === 'include' ? 'ok' : 'warn');
  } catch (e) {
    console.error(e);
    toast('PDF gagal dibaca: ' + e.message, 'bad');
  }
}

async function storePdf(r, file, parsed) {
  if (r.archived) return; // studi Exclude yang sudah dibersihkan tidak menyimpan PDF lagi
  await DB.put('texts', r.id, parsed.pages);
  await DB.put('pdfs', r.id, file);
  UI.textCache[r.id] = parsed.pages;
  delete UI.pdfCache[r.id];
  r.hasText = true; r.hasPdf = true; r.pages = parsed.numPages;
}

/* ---------- Isi dari metadata ----------
   Mengenali kolom formulir dari ID/labelnya (bukan hanya id bawaan), lalu mengisi yang masih kosong dari
   metadata rekaman, abstrak, dan halaman awal PDF. Isian yang sudah ada tidak ditimpa. */
const PF_POP = [
  [/doktor|doctoral/i, /\b(?:doctoral|ph\.?\s?d\.?|doctorate|doktor\w*)\b/gi],
  [/pascasarjana|postgrad|master|magister/i, /\b(?:post-?graduate|graduate students?|master'?s|magister|pascasarjana)\b/gi],
  [/dosen|lecturer|faculty/i, /\b(?:faculty members?|lecturers?|academic staff|academics|teaching staff|dosen|professors?)\b/gi],
  [/peneliti|researcher/i, /\b(?:early[- ]career researchers?|researchers?|research staff|peneliti)\b/gi, 2] // "researchers" sering dipakai umum, jadi perlu >= 2 sebutan
];
const PF_DESIGN = {
  cs: /survei|survey|potong lintang|cross/i, prev: /survei|survey|potong lintang|prevalen/i, qual: /kualitatif|qualitative/i,
  mixed: /campuran|mixed/i, rct: /\bRCT\b|acak|random/i, quasi: /kuasi|quasi/i, cohort: /kohort|cohort/i, cc: /kasus-kontrol|case-control/i,
  sr: /review|tinjauan/i, text: /opini|opinion/i
};
function pfCite(r) {
  const au = String(r.authors || '').split(';').map(s => s.trim()).filter(Boolean);
  const sur = a => (a.includes(',') ? a.split(',')[0] : a.split(/\s+/)[0]).trim();
  if (!au.length) return '';
  const who = au.length === 1 ? sur(au[0]) : au.length === 2 ? sur(au[0]) + ' & ' + sur(au[1]) : sur(au[0]) + ' et al.';
  return who + ', ' + (r.year || 't.t.');
}
function pfSample(txt) {
  const num = s => s.replace(/[.,](?=\d{3}\b)/g, '');
  let m = txt.match(/\b[Nn]\s*=\s*(\d{1,3}(?:[.,]\d{3})+|\d{2,6})\b/);
  if (m) return num(m[1]);
  m = txt.match(/\b(\d{1,3}(?:[.,]\d{3})+|\d{2,6})\s+(?:\w+[- ]){0,3}?(?:participants|respondents|students|lecturers|academics|researchers|candidates|scholars|faculty members|teachers|informants|interviewees|responden|mahasiswa|dosen|peserta)\b/i);
  return m ? num(m[1]) : '';
}
function pfOption(f, re) { return (f.options || []).find(o => re.test(o)) || ''; }
function metaPrefill(r, rv) {
  const v = r.extract[rv] = r.extract[rv] || {};
  const pages = UI.textCache[r.id] || [];
  const abs = cleanAbs(r.abstract || '');
  const head = [r.title, abs, r.keywords].join('\n');
  const body = head + '\n' + pages.slice(0, 4).join('\n');
  const done = [];
  const put = (f, val) => { if (val === '' || val == null || String(v[f.id] ?? '').trim()) return; v[f.id] = String(val); done.push(f.label); };
  S.fields.forEach(f => {
    const k = (f.id + ' ' + f.label).toLowerCase();
    if (/kode studi|stu_/.test(k)) put(f, ((r.fileName || '') + ' ' + (r.sid || '')).match(/STU[_-]?\d{3,5}/i)?.[0].toUpperCase().replace('-', '_') || '');
    else if (/id studi|study_id|id sumber|penulis.*tahun/.test(k)) put(f, pfCite(r));
    else if (/^judul|\btitle\b/.test(k)) put(f, r.title);
    else if (/^tahun|\byear\b/.test(k)) put(f, r.year);
    else if (/jurnal|journal/.test(k)) put(f, r.journal);
    else if (/\bdoi\b/.test(k)) put(f, r.doi);
    else if (/^penulis|\bauthor/.test(k)) put(f, r.authors);
    else if (/negara|country/.test(k) && typeof bbCountriesIn === 'function') {
      // negara yang disebut di judul/abstrak (lokasi studi), kalau tidak ada: afiliasi penulis di halaman awal PDF
      let c = bbCountriesIn(head, true);
      if (!c.length && pages.length) c = bbCountriesIn(bbAffText(pages), true);
      put(f, c.slice(0, 3).join('; '));
    }
    else if (/sampel|sample|\(n\)/.test(k) && f.type !== 'select') put(f, pfSample(abs) || pfSample(pages.slice(0, 6).join('\n')));
    else if (/desain|design|metodologi/.test(k) && f.type === 'select') {
      let o = '';
      const n = re => (body.match(re) || []).length;
      if (n(/\b(?:instrument|scale|questionnaire|measure) (?:development|validation)|validat\w+ (?:of )?(?:the |an? )?(?:instrument|scale|questionnaire)|psychometric|confirmatory factor/gi) >= 2) o = pfOption(f, /validasi|pengembangan|validation|development/i);
      if (!o && /\bcase stud(?:y|ies)\b/i.test(head)) o = pfOption(f, /studi kasus|case study/i);
      if (!o && typeof apSuggest === 'function') { const s = apSuggest(r); if (s.key && PF_DESIGN[s.key]) o = pfOption(f, PF_DESIGN[s.key]); }
      put(f, o);
    }
    else if (/populasi|partisipan|population|participant/.test(k) && f.type === 'select') {
      const hits = PF_POP.filter(([opt]) => pfOption(f, opt)).map(([opt, re, min]) => [pfOption(f, opt), (head.match(re) || []).length, min || 1]).filter(x => x[1] >= x[2]);
      const mix = pfOption(f, /campuran|mixed/i);
      put(f, hits.length > 1 && mix ? mix : hits.length ? hits.sort((a, b) => b[1] - a[1])[0][0] : '');
    }
  });
  return done;
}
