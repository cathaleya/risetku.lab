/* Telaah SLR — tampilan: Proyek, Impor, Meta-analisis, PRISMA, Checklist, Ekspor */
'use strict';

const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(label)}</option>`;
const SOURCE_SUGGEST = SOURCE_CATALOG.map(c => c.name);
const CAT_LABEL = { database: 'Basis data', register: 'Register', other: 'Metode lain' };
function srcOptions(cur) {
  const names = projDbs().map(d => d.name);
  if (cur && !names.includes(cur)) names.unshift(cur);
  return names.map(n => opt(n, n, cur)).join('');
}

/* =================== PROYEK & KRITERIA =================== */
function renderProject() {
  const p = S.project;
  const fw = FRAMEWORK[p.type];
  const crit = S.criteria;
  const flagCounts = {};
  S.records.filter(inScreening).forEach(r => { const f = flagOf(r).flag; flagCounts[f] = (flagCounts[f] || 0) + 1; });
  const critRow = (c, kind, i) => `
    <div class="crit-row ${kind}" data-cid="${c.id}">
      <span class="crit-swatch ${kind === 'include' ? 'hl-c' + (i % 6) : 'hl-exc'}" aria-hidden="true"></span>
      <div class="crit-fields">
        <input type="text" id="crit-l-${c.id}" class="crit-label" value="${esc(c.label)}" placeholder="${kind === 'include' ? 'Nama kriteria, mis. Populasi: lansia' : 'Nama, mis. Studi hewan'}" data-crit="${kind}" data-key="label">
        <textarea id="crit-t-${c.id}" rows="2" placeholder='Kata kunci dipisah koma. Frasa pakai tanda kutip, wildcard pakai *, mis. "older adult*", elderly, lansia' data-crit="${kind}" data-key="terms">${esc(c.terms)}</textarea>
      </div>
      <button class="icon-btn" data-action="crit-del" data-kind="${kind}" data-cid="${c.id}" aria-label="Hapus kriteria">×</button>
    </div>`;
  const fieldRow = (f, i) => `
    <tr data-fid="${f.id}">
      <td><input type="text" id="fl-${f.id}" value="${esc(f.label)}" data-field="${i}" data-key="label"></td>
      <td><select id="ft-${f.id}" data-field="${i}" data-key="type">${[['text', 'Teks singkat'], ['textarea', 'Paragraf'], ['number', 'Angka'], ['select', 'Pilihan'], ['multi', 'Pilihan (banyak)']].map(([v, l]) => opt(v, l, f.type)).join('')}</select></td>
      <td><input type="text" id="fo-${f.id}" value="${esc((f.options || []).join(', '))}" data-field="${i}" data-key="options" placeholder="${f.type === 'select' || f.type === 'multi' ? 'Opsi dipisah koma' : '—'}" ${f.type === 'select' || f.type === 'multi' ? '' : 'disabled'}></td>
      <td>${f.group === 'ma' ? '<span class="muted small">Data efek</span>' : `<input type="text" id="fg-${f.id}" class="grp-input" value="${esc(f.group || '')}" data-field="${i}" data-key="group" placeholder="Karakteristik studi" list="grpList">`}</td>
      <td class="row-actions">
        <button class="icon-btn" data-action="field-move" data-i="${i}" data-dir="-1" aria-label="Naikkan">↑</button>
        <button class="icon-btn" data-action="field-move" data-i="${i}" data-dir="1" aria-label="Turunkan">↓</button>
        <button class="icon-btn" data-action="field-del" data-i="${i}" aria-label="Hapus kolom">×</button>
      </td>
    </tr>`;

  $('#view-project').innerHTML = `
  <div class="page">
    <div class="page-head">
      <div>
        <p class="eyebrow">Langkah 1</p>
        <h1>Proyek &amp; kriteria kelayakan</h1>
        <p class="lede">Tetapkan jenis review, pertanyaan penelitian, dan kata kunci kriteria. Kata kunci dipakai untuk menandai rekaman secara otomatis dan menyorot teks di panel ekstraksi.</p>
      </div>
      <div class="btn-row">
        <button class="btn" data-action="preset-import" title="Baca kriteria & pengaturan dari templat Excel (.xlsx), Word (.docx), CSV, atau JSON. Rekaman tidak terhapus."><i class="fa-solid fa-file-import"></i> Impor Templat (Excel / Word / CSV)</button>
        <button class="btn ghost" data-action="tpl-xlsx" title="Templat Excel dinamis berisi pengaturan proyek saat ini"><i class="fa-solid fa-file-excel text-emerald-600"></i> Unduh Templat Excel</button>
        <button class="btn ghost" data-action="tpl-docx" title="Templat Word dinamis berisi pengaturan proyek saat ini"><i class="fa-solid fa-file-word text-blue-600"></i> Unduh Templat Word</button>
        <a href="templates/Templat-Pengaturan-Telaah-SLR.xlsx" download class="btn ghost" style="text-decoration:none" title="Unduh berkas templat Excel standar baku bawaan"><i class="fa-solid fa-download"></i> Templat Baku (.xlsx)</a>
        <button class="btn ghost" data-action="preset-export" title="Unduh pengaturan proyek tanpa rekaman (JSON)">Ekspor JSON</button>
      </div>
    </div>

    ${UI.settingsDraft ? `<section class="card settings-draft" style="border: 2px solid #10b981; background: #f0fdf4;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div>
          <h2 style="color:#065f46;margin:0;font-size:1.15rem;display:flex;align-items:center;gap:8px">
            <i class="fa-solid fa-circle-check text-emerald-600"></i>
            <span>Templat Siap Diterapkan: <b>${esc(UI.settingsDraft.name)}</b></span>
          </h2>
          <p class="hint" style="color:#047857;margin:4px 0 0 0">
            Berikut ringkasan kriteria &amp; pengaturan yang berhasil dibaca dari berkas Anda. Klik <b>"Terapkan Sekarang"</b> agar kriteria langsung masuk ke formulir dan evaluasi skrining.
          </p>
        </div>
        <div class="btn-row" style="margin:0">
          <button class="btn" data-action="settings-apply" style="background:#059669;color:#fff;font-weight:bold;padding:9px 18px;box-shadow:0 4px 12px rgba(5,150,105,0.3)"><i class="fa-solid fa-check"></i> Terapkan Sekarang</button>
          <button class="btn ghost" data-action="settings-cancel" style="color:#64748b">Batal</button>
        </div>
      </div>
      <dl class="sd-list" style="background:#ffffff;border-radius:10px;padding:12px 16px;border:1px solid #d1fae5">${UI.settingsDraft.sum.map(([k, v]) => `<dt style="font-weight:700;color:#1e293b">${esc(k)}</dt><dd style="color:#334155">${esc(v)}</dd>`).join('')}</dl>
    </section>` : ''}

    <div class="grid-2">
      <section class="card">
        <h2>Jenis review</h2>
        <div class="seg seg-lg" role="radiogroup" aria-label="Jenis review">
          ${['slr', 'scoping', 'meta'].map(t => `<button role="radio" aria-checked="${p.type === t}" class="${p.type === t ? 'on' : ''}" data-action="set-type" data-type="${t}"><b>${TYPE_LABEL[t]}</b><small>${t === 'scoping' ? 'PRISMA-ScR · kerangka PCC' : t === 'meta' ? 'PRISMA 2020 · PICOS + data efek' : 'PRISMA 2020 · kerangka PICO'}</small></button>`).join('')}
        </div>
        <div class="type-switch-note" id="typeNote" hidden></div>
        <label class="fld"><span>Judul proyek</span><input type="text" id="p-title" data-bind="project.title" value="${esc(p.title)}"></label>
        <label class="fld"><span>Pertanyaan review</span><textarea id="p-question" rows="3" data-bind="project.question">${esc(p.question)}</textarea></label>
        <div class="fw-grid">
          ${fw.map(([k, l], i) => `<label class="fld"><span><b class="fw-key">${k}</b> ${l}</span><input type="text" id="fw-${i}" data-bind="project.framework.${k}${p.type === 'scoping' && i === 2 ? 'x' : ''}" value="${esc(p.framework[k + (p.type === 'scoping' && i === 2 ? 'x' : '')] || '')}"></label>`).join('')}
        </div>
      </section>

      <section class="card">
        <h2>Reviewer</h2>
        <div class="rev-names">
          <label class="fld"><span><i class="dot r1"></i> Reviewer 1</span><input type="text" id="rev1" data-bind="project.reviewers.0" value="${esc(p.reviewers[0])}"></label>
          ${p.single ? '' : `<label class="fld"><span><i class="dot r2"></i> Reviewer 2</span><input type="text" id="rev2" data-bind="project.reviewers.1" value="${esc(p.reviewers[1])}"></label>`}
        </div>
        <label class="check"><input type="checkbox" id="p-single" data-bind="project.single" ${p.single ? 'checked' : ''}> <span><b>Satu reviewer saja.</b> Panel Reviewer 2 disembunyikan, keputusan Reviewer 1 langsung menjadi keputusan akhir, dan kappa tidak dihitung.</span></label>
        ${p.single ? `<label class="check"><input type="checkbox" id="exDual" ${p.exDual ? 'checked' : ''}> <span><b>Ekstraksi data tetap oleh 2 reviewer.</b> Skrining satu reviewer, tetapi di tahap Ekstraksi data panel Reviewer 1 dan Reviewer 2 tampil, pilihan "Bekerja sebagai" muncul, dan nilai final ditetapkan di tab Konsensus.</span></label>` : ''}
        ${p.single ? '' : `<label class="check"><input type="checkbox" id="p-blind" data-bind="project.blind" ${p.blind ? 'checked' : ''}> <span><b>Mode blind.</b> Saat bekerja sebagai satu reviewer, keputusan reviewer lain ditutup sampai keduanya memutuskan.</span></label>`}
        <h3>Alasan eksklusi</h3>
        <p class="hint">Satu alasan per baris. Dipakai di skrining teks lengkap dan muncul di diagram PRISMA.</p>
        <textarea id="reasons" rows="7" data-action-input="reasons">${esc(S.reasons.join('\n'))}</textarea>
      </section>
    </div>

    <section class="card">
      <div class="card-head">
        <div>
          <h2>Kriteria inklusi &amp; kata kunci penanda otomatis</h2>
          <p class="hint">Setiap kriteria berisi sinonim (OR). Antar-kriteria digabung sesuai aturan di kanan. Rekaman yang memenuhi diberi penanda <span class="flag flag-inc">Memenuhi</span>.</p>
        </div>
        <label class="fld inline"><span>Aturan</span>
          <select id="crit-mode" data-bind="criteria.mode">${opt('all', 'Semua kriteria harus cocok (AND)', crit.mode)}${opt('any', 'Minimal satu kriteria cocok (OR)', crit.mode)}</select>
        </label>
      </div>
      <div class="crit-cols">
        <div>
          <h3 class="inc-h">Inklusi</h3>
          <div class="crit-list">${crit.include.map((c, i) => critRow(c, 'include', i)).join('') || '<p class="empty">Belum ada kriteria inklusi.</p>'}</div>
          <button class="btn ghost" data-action="crit-add" data-kind="include">+ Tambah kriteria inklusi</button>
        </div>
        <div>
          <h3 class="exc-h">Kata kunci eksklusi</h3>
          <div class="crit-list">${crit.exclude.map((c, i) => critRow(c, 'exclude', i)).join('') || '<p class="empty">Belum ada kata kunci eksklusi.</p>'}</div>
          <button class="btn ghost" data-action="crit-add" data-kind="exclude">+ Tambah kata kunci eksklusi</button>
        </div>
      </div>

      <div class="crit-bar-actions" style="margin-top:16px;padding:12px 16px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <b style="font-size:12.5px;color:#0f172a;display:flex;align-items:center;gap:6px">
            <i class="fa-solid fa-file-excel text-emerald-600"></i>
            <span>Ingin memasukkan kriteria dari berkas templat?</span>
          </b>
          <span class="muted small" style="font-size:11.5px;display:block;margin-top:2px">
            Unggah templat Excel (.xlsx), Word (.docx), atau CSV untuk memasukkan seluruh kriteria dan kata kunci sekaligus secara otomatis.
          </span>
        </div>
        <div class="btn-row" style="margin:0">
          <button class="btn sm" data-action="preset-import" title="Unggah file templat kriteria"><i class="fa-solid fa-upload"></i> Unggah / Impor Templat</button>
          <a href="templates/Templat-Pengaturan-Telaah-SLR.xlsx" download class="btn sm ghost" style="text-decoration:none" title="Unduh format templat Excel"><i class="fa-solid fa-download"></i> Unduh Format Templat (.xlsx)</a>
        </div>
      </div>
      ${(() => {
        const L = S.criteria.lang || {};
        const allowed = L.allowed || ['en'];
        const code = (L.label || '').match(/^\s*([A-Za-z]{1,3}\d{1,2})/);
        const hasReason = code && S.reasons.some(x => critCode(x) === code[1].toUpperCase());
        const cnt = {};
        if (L.on) S.records.filter(inScreening).forEach(r => { const c = Lang.of(r); cnt[c] = (cnt[c] || 0) + 1; });
        return `<div class="lang-crit ${L.on ? 'on' : ''}">
          <label class="check"><input type="checkbox" id="lang-on" data-bind="criteria.lang.on" ${L.on ? 'checked' : ''}> <span><b>Kriteria bahasa publikasi.</b> Bahasa tiap artikel dideteksi otomatis (halaman awal PDF, atau judul + abstrak). Artikel berbahasa lain diberi lampu merah dan penanda Eksklusi.</span></label>
          ${L.on ? `<div class="lang-grid">${LANG_CHOICES.map(k => `<label class="check sm"><input type="checkbox" data-lang-allow="${k}" ${allowed.includes(k) ? 'checked' : ''}> <span>${LANG_NAMES[k]}${cnt[k] ? ` <b class="muted">${cnt[k]}</b>` : ''}</span></label>`).join('')}</div>
            <label class="fld"><span>Label &amp; kode alasan (kode yang sama dengan daftar alasan dipakai untuk mengisi alasan otomatis)</span><input type="text" id="lang-label" data-bind="criteria.lang.label" value="${esc(L.label || '')}" placeholder="mis. E9 – Bahasa bukan Inggris"></label>
            ${L.label && !hasReason ? `<button class="btn sm ghost" data-action="lang-add-reason">Tambahkan "${esc(L.label)}" ke alasan eksklusi</button>` : ''}
            <p class="hint">Terdeteksi pada rekaman: ${Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${LANG_NAMES[k] || k} ${n}`).join(' · ') || '—'}. "Tidak terdeteksi" tidak pernah dieksklusi otomatis.</p>` : ''}
        </div>`;
      })()}
      <div class="tester">
        <div>
          <h3>Uji kata kunci</h3>
          <textarea id="critTest" rows="4" placeholder="Tempel judul atau abstrak di sini untuk melihat penyorotan dan penanda.">${esc(UI.critTest || '')}</textarea>
        </div>
        <div class="tester-out" id="critTestOut"></div>
      </div>
      <div class="flag-summary">
        <span class="muted">Penanda pada ${S.records.filter(inScreening).length} rekaman:</span>
        ${['include', 'mixed', 'partial', 'exclude', 'none'].map(f => `<span class="flag ${FLAG_META[f].cls}">${FLAG_META[f].short} · ${flagCounts[f] || 0}</span>`).join('')}
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <div>
          <h2>Formulir ekstraksi data</h2>
          <p class="hint">Kolom ini muncul di panel Reviewer 1 dan Reviewer 2 pada tahap ekstraksi. ${p.type === 'meta' ? 'Kolom "Data efek" dipakai oleh tab Meta-analisis.' : ''}</p>
        </div>
        <div class="btn-row">
          <button class="btn ghost" data-action="field-add">+ Tambah kolom</button>
          <button class="btn ghost" data-action="field-reset">Pakai templat ${TYPE_LABEL[p.type]}</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tbl fields-tbl">
          <thead><tr><th>Label</th><th>Tipe</th><th>Opsi</th><th>Grup</th><th></th></tr></thead>
          <tbody>${S.fields.map(fieldRow).join('')}</tbody>
        </table>
        <datalist id="grpList">${[...new Set(S.fields.map(f => f.group).filter(g => g && g !== 'ma'))].map(g => `<option value="${esc(g)}">`).join('')}</datalist>
      </div>
    </section>
  </div>`;
  updateCritTest();
}

function updateCritTest() {
  const out = $('#critTestOut');
  if (!out) return;
  const t = UI.critTest || '';
  if (!t.trim()) { out.innerHTML = '<p class="empty">Hasil uji muncul di sini.</p>'; return; }
  const ev = Criteria.evaluate(t, S.criteria);
  out.innerHTML = `<div class="flag ${FLAG_META[ev.flag].cls}">${FLAG_META[ev.flag].label}</div>
    <div class="crit-chips">${ev.inc.map(c => `<span class="chip ${c.n ? 'on' : ''}"><i class="crit-swatch hl-c${c.idx % 6}"></i>${esc(c.label)} · ${c.n}</span>`).join('')}${ev.exc.map(c => `<span class="chip ${c.n ? 'on exc' : ''}"><i class="crit-swatch hl-exc"></i>${esc(c.label)} · ${c.n}</span>`).join('')}</div>
    <div class="doc-text small">${Criteria.highlight(t, S.criteria)}</div>`;
}

/* =================== IMPOR =================== */
function renderImport() {
  const d = UI.importDraft;
  const dups = S.records.filter(r => r.duplicateOf);
  const autoCand = S.records.filter(r => !r.duplicateOf && !r.autoExcluded && flagOf(r).flag === 'exclude');
  const autoDone = S.records.filter(r => r.autoExcluded).length;
  const lastPdf = (UI.lastPdf || []).map(rec).filter(Boolean);
  const junk = S.records.filter(r => r.hasPdf && Parsers.junkTitle(r.title)).length;
  const dbs = projDbs();
  if (!UI.importSource || !dbs.some(x => x.name === UI.importSource)) { UI.importSource = (dbs[0] || {}).name || ''; UI.importCat = (dbs[0] || {}).cat || 'database'; }
  const cur = UI.importSource;
  const ic = UI.importCat || 'database';
  $('#view-import').innerHTML = `
  <div class="page">
    <div class="page-head"><div>
      <p class="eyebrow">Langkah 2 · Identifikasi</p>
      <h1>Impor rekaman &amp; teks lengkap</h1>
      <p class="lede">Unggah ekspor dari basis data (CSV, RIS, BibTeX) atau file PDF. Setiap unggahan dicatat sebagai sumber dan dihitung otomatis di diagram PRISMA.</p>
    </div></div>

    <section class="card">
      <div class="import-grid">
        <div class="import-meta">
          <div class="fld"><span>Basis data / sumber <span class="muted small">· klik untuk memilih</span></span>
            <div class="db-chips">${dbs.map(x => { const n = S.records.filter(r => r.source === x.name).length + (S.skipped || []).filter(s => s.source === x.name).length; return `<span class="db-chip ${x.name === cur ? 'on' : ''}">
              <button data-action="imp-src" data-name="${esc(x.name)}" aria-pressed="${x.name === cur}">${esc(x.name)}${n ? ` <small>${n}</small>` : ''}${x.cat !== 'database' ? ` <small>${CAT_LABEL[x.cat]}</small>` : ''}</button>
              <button class="db-x" data-action="db-del" data-name="${esc(x.name)}" aria-label="Hapus ${esc(x.name)} dari daftar" title="Hapus dari daftar (rekaman tidak terhapus)">×</button></span>`; }).join('')}</div>
            <div class="db-add"><input type="text" id="dbNew" list="srcList" placeholder="Tambah basis data, mis. ERIC, SINTA, Dimensions" aria-label="Nama basis data baru"><button class="btn sm ghost" data-action="db-add">Tambah</button></div>
            <datalist id="srcList">${SOURCE_SUGGEST.filter(s => !dbs.some(x => x.name === s)).map(s => `<option value="${esc(s)}">`).join('')}</datalist>
          </div>
          <label class="check"><input type="checkbox" id="impAuto" ${UI.importAuto !== false ? 'checked' : ''}> <span><b>Deteksi basis data otomatis</b> dari isi file ekspor CSV/RIS/BibTeX (kolom dan tautan khas Scopus, Web of Science, PubMed, Google Scholar/Publish or Perish, Garuda, IEEE, Dimensions, dll.). Bila tidak terdeteksi, dipakai pilihan di atas. PDF selalu memakai pilihan di atas.</span></label>
          <fieldset class="fld"><legend>Kategori PRISMA</legend>
            <div class="seg">
              ${[['database', 'Basis data'], ['register', 'Register'], ['other', 'Metode lain']].map(([v, l]) => `<button class="${ic === v ? 'on' : ''}" data-action="imp-cat" data-cat="${v}">${l}</button>`).join('')}
            </div>
            <p class="hint">${ic === 'other' ? 'Situs web, organisasi, atau penelusuran sitasi. Rekaman ini langsung masuk tahap teks lengkap sesuai PRISMA 2020.' : ic === 'register' ? 'Register uji klinis seperti ClinicalTrials.gov atau WHO ICTRP.' : 'Basis data bibliografi seperti Scopus, PubMed, atau Garuda.'}</p>
          </fieldset>
          <label class="check"><input type="checkbox" id="impMatch" ${UI.importMatch !== false ? 'checked' : ''}> <span>Cocokkan PDF dengan rekaman yang sudah ada (lewat DOI atau judul) dan lampirkan sebagai teks lengkap.</span></label>
          <label class="check"><input type="checkbox" id="ftAuto" ${S.project.ftAuto !== false ? 'checked' : ''}> <span><b>Saring teks lengkap otomatis.</b> PDF untuk studi di tahap Teks lengkap dibaca seluruhnya. Kalau kriteria wajib (${esc((typeof keyCrit === 'function' ? keyCrit() : []).join(', '))}) disebut kurang dari <input type="number" id="ftMin" class="ft-min" min="1" max="50" value="${typeof ftMin === 'function' ? ftMin() : 5}" aria-label="Batas sebutan"> kali di isi teks (daftar pustaka tidak dihitung), studi langsung di-Exclude dengan alasannya dan PDF-nya dibuang dari penyimpanan. Tetap tercatat di Laporan dan PRISMA.</span></label>
        </div>
        <label class="drop" id="dropZone" for="fileInput">
          <input type="file" id="fileInput" multiple accept=".csv,.tsv,.txt,.ris,.nbib,.medline,.bib,.pdf,.xlsx,.xls,.docx,.json" hidden>
          <span class="drop-icon" aria-hidden="true">⇪</span>
          <b>Seret file ke sini atau klik untuk memilih</b>
          <span class="muted">CSV/TSV (Scopus, WoS, PubMed, Rayyan), RIS, NBIB/MEDLINE, BibTeX, PDF · berkas templat (.xlsx/.docx) otomatis dialihkan ke Proyek &amp; Kriteria</span>
          <span class="drop-progress" id="dropProgress"></span>
        </label>
        <label class="btn sm ghost folder-btn"><input type="file" id="folderInput" webkitdirectory multiple hidden>📁 Pilih folder PDF…</label>
      </div>
      ${d ? renderMapping(d) : ''}
    </section>

    ${junk ? `<section class="card cbanner conf"><span><b>${junk} PDF</b> judulnya terbaca sebagai kode file (mis. "STU_0004"). Judul dipakai untuk deteksi duplikat dan laporan.</span>
      <span class="cb-actions"><button class="btn sm" data-action="fix-titles">Baca ulang judul dari halaman pertama</button><span class="muted small" id="fixProg"></span></span></section>` : ''}

    ${typeof decCard === 'function' ? decCard() : ''}

    ${lastPdf.length ? `<section class="card">
      <div class="card-head"><div><h2>Hasil deteksi PDF</h2>
        <p class="hint">Setiap lampu adalah satu kriteria inklusi dengan warna yang sama seperti sorotan di teks. Lampu merah berarti ada kata eksklusi. Klik judul untuk membuka di ruang kerja.</p></div>
        <span class="lamp-legend">${Criteria.compiled(S.criteria).inc.map(c => `<span><i class="lamp on lc${c.idx % 6}"></i>${esc(c.label)}</span>`).join('')}<span><i class="lamp on lexc"></i>Kata eksklusi</span></span></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>PDF</th><th>Indikator</th><th class="num">Kriteria</th><th>Penanda</th><th>Saringan teks lengkap</th></tr></thead>
        <tbody>${lastPdf.map(r => { const ev = evalBest(r); return `<tr>
          <td><button class="link" data-action="open-rec" data-id="${r.id}">${esc((r.title || '(tanpa judul)').slice(0, 110))}</button><span class="muted small"> · ${r.pages || '?'} hlm.</span></td>
          <td>${critLamps(ev)}</td><td class="num"><b>${ev.incMatched}</b>/${ev.total}</td>
          <td><span class="flag ${FLAG_META[ev.flag].cls}">${FLAG_META[ev.flag].short}</span></td>
          <td>${ftResCell(r)}</td></tr>`; }).join('')}</tbody></table></div>
    </section>` : ''}

    <section class="card">
      <h2>Riwayat impor</h2>
      ${S.batches.length ? `<div class="table-wrap"><table class="tbl">
        <thead><tr><th>Sumber</th><th>Kategori</th><th>File</th><th class="num">Rekaman</th><th class="num">Duplikat dikeluarkan</th><th>Tanggal</th><th></th></tr></thead>
        <tbody>${S.batches.map(b => `<tr>
          <td><select class="bsrc" id="bsrc-${b.id}" data-batch-src="${b.id}" aria-label="Basis data untuk ${esc(b.file)}">${srcOptions(b.name)}</select>${b.auto ? ` <span class="pill ok" title="Terdeteksi dari ${esc(b.auto)}">otomatis</span>` : ''}</td><td>${CAT_LABEL[b.cat]}</td>
          <td class="muted">${esc(b.file)}</td><td class="num">${S.records.filter(r => r.batch === b.id).length}</td><td class="num muted">${(S.skipped || []).filter(x => x.batch === b.id).length + S.records.filter(r => r.batch === b.id && r.duplicateOf).length || '—'}</td><td class="muted">${esc(b.date)}</td>
          <td class="row-actions">${UI.confirmBatch === b.id
            ? `<span class="confirm">Hapus ${S.records.filter(r => r.batch === b.id).length} rekaman? <button class="btn sm danger" data-action="batch-del" data-id="${b.id}">Hapus</button><button class="btn sm ghost" data-action="batch-cancel">Batal</button></span>`
            : `<button class="btn sm ghost" data-action="batch-ask" data-id="${b.id}">Hapus</button>`}</td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="empty">Belum ada impor. Unggah file di atas untuk memulai.</p>'}
    </section>

    <div class="grid-2">
      <section class="card">
        <div class="card-head"><div>
          <h2>Duplikat <span class="count">${dups.length + (S.skipped || []).length}</span></h2>
          <p class="hint">Dicocokkan lewat DOI, judul + tahun, atau file PDF identik. Saat diunggah, duplikat langsung dikeluarkan: PDF dan teksnya tidak disimpan, hanya dicatat di bawah agar angka PRISMA tetap benar.</p>
        </div><button class="btn ghost" data-action="dedup">Deteksi ulang</button></div>
        ${dups.length ? `<div class="cbanner conf"><span><b>${dups.length} duplikat masih tersimpan</b> (dari unggahan sebelum fitur ini). ${UI.confirmPurge ? 'Keluarkan beserta PDF-nya? Rekaman aslinya tetap.' : 'Keluarkan untuk menghemat penyimpanan.'}</span>
          <span class="cb-actions">${UI.confirmPurge ? '<button class="btn sm danger" data-action="dup-purge">Ya, keluarkan</button><button class="btn sm ghost" data-action="dup-purge-cancel">Batal</button>' : '<button class="btn sm" data-action="dup-purge-ask">Keluarkan duplikat tersimpan</button>'}</span></div>` : ''}
        <div class="mini-list">${dups.slice(0, 60).map(r => {
          const o = rec(r.duplicateOf);
          return `<div class="mini-item"><div><b>${esc(r.title || '(tanpa judul)')}</b><span class="muted small">${esc(r.source)} · duplikat dari ${esc(o ? o.source : '?')}</span></div><button class="btn sm ghost" data-action="not-dup" data-id="${r.id}">Bukan duplikat</button></div>`;
        }).join('')}${(S.skipped || []).slice().reverse().slice(0, 80).map(x => `<div class="mini-item"><div><b>${esc(x.title || x.file || '(tanpa judul)')}</b><span class="muted small">dikeluarkan · ${esc(x.by)}${x.dupTitle ? ' dengan "' + esc(x.dupTitle.slice(0, 70)) + '"' : ''} · ${esc(x.date)}</span></div></div>`).join('')}${!dups.length && !(S.skipped || []).length ? '<p class="empty">Tidak ada duplikat terdeteksi.</p>' : ''}</div>
      </section>
      <section class="card">
        <h2>Eksklusi otomatis <span class="count">${autoDone}</span></h2>
        <p class="hint">Rekaman yang mengandung kata kunci eksklusi dan tidak memenuhi kriteria inklusi dapat ditandai tidak layak sebelum skrining. PRISMA 2020 mencatatnya sebagai <i>records marked as ineligible by automation tools</i>. Periksa daftarnya dulu sebelum menerapkan.</p>
        <div class="mini-list">${autoCand.slice(0, 40).map(r => `<div class="mini-item"><div><b>${esc(r.title)}</b><span class="muted small">${flagOf(r).exc.filter(x => x.n).map(x => esc(x.label)).join(', ')}</span></div></div>`).join('') || '<p class="empty">Tidak ada kandidat baru.</p>'}</div>
        <div class="btn-row">
          <button class="btn" data-action="auto-apply" ${autoCand.length ? '' : 'disabled'}>Tandai ${autoCand.length} rekaman tidak layak</button>
          <button class="btn ghost" data-action="auto-undo" ${autoDone ? '' : 'disabled'}>Batalkan semua (${autoDone})</button>
        </div>
      </section>
    </div>
  </div>`;
}

function renderMapping(d) {
  return `<div class="mapping">
    <div class="card-head"><div><h3>Petakan kolom: ${esc(d.file)}</h3><p class="hint">${d.rows.length} baris terbaca. Kolom ditebak otomatis; ubah bila perlu.</p></div>
      <label class="fld map-src"><span>Basis data${d.auto ? ` <span class="pill ok" title="${esc(d.auto)}">terdeteksi otomatis</span>` : ''}</span><select id="draftSrc" data-draft-src>${srcOptions(d.source)}</select></label></div>
    <div class="map-grid">${TARGETS.map(([k, l]) => `<label class="fld"><span>${l}</span><select data-map="${k}" id="map-${k}">${opt('', '— tidak ada —', d.map[k])}${d.headers.map(h => opt(h, h, d.map[k])).join('')}</select></label>`).join('')}</div>
    <div class="table-wrap"><table class="tbl small"><thead><tr><th>Judul</th><th>Penulis</th><th>Tahun</th><th>DOI</th></tr></thead><tbody>
      ${d.rows.slice(0, 3).map(r => `<tr><td>${esc((r[d.map.title] || '').slice(0, 90))}</td><td>${esc((r[d.map.authors] || '').slice(0, 40))}</td><td>${esc(r[d.map.year] || '')}</td><td>${esc(r[d.map.doi] || '')}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="btn-row"><button class="btn" data-action="map-import">Impor ${d.rows.length} rekaman</button><button class="btn ghost" data-action="map-cancel">Batal</button></div>
  </div>`;
}

/* =================== META-ANALISIS =================== */
function renderMeta() {
  const el = $('#view-meta');
  if (S.project.type !== 'meta') {
    el.innerHTML = `<div class="page"><div class="page-head"><div><p class="eyebrow">Sintesis kuantitatif</p><h1>Meta-analisis</h1>
      <p class="lede">Tab ini aktif untuk review berjenis Meta-analisis. Jenis proyek saat ini: ${TYPE_LABEL[S.project.type]}.</p></div></div>
      <section class="card"><p>Ubah jenis review di tab <b>Proyek &amp; Kriteria</b>, lalu pakai templat formulir Meta-analisis agar kolom data efek (event, mean, SD, N, atau efek + CI) muncul di panel reviewer.</p>
      <button class="btn" data-action="goto" data-view="project">Buka Proyek &amp; Kriteria</button></section></div>`;
    return;
  }
  const m = S.meta;
  const outs = MA.outcomes();
  const all = MA.studies().filter(s => !s.skip);
  const ok = all.filter(s => s.ok);
  const res = ok.length ? MA.pool(ok, m.model) : null;
  const eg = ok.length >= 3 ? MA.egger(ok) : null;
  const log = MEASURES[m.measure].log;
  const f = x => fmt(MA.tx(x), 2);
  let interp = '';
  if (res) {
    const sig = res.p < 0.05;
    const nullV = log ? 1 : 0;
    interp = `Dari ${res.k} studi, estimasi gabungan ${MEASURES[m.measure].label.split(' (')[0].toLowerCase()} adalah <b>${f(res.mu)}</b> (CI 95% ${f(res.lo)} sampai ${f(res.hi)}; p = ${fmtP(res.p)}). ` +
      (sig ? `Interval kepercayaan tidak mencakup ${nullV}, sehingga efeknya signifikan secara statistik. ` : `Interval kepercayaan mencakup ${nullV}, sehingga efeknya belum signifikan secara statistik. `) +
      `Heterogenitas ${res.I2 < 25 ? 'rendah' : res.I2 < 50 ? 'sedang-rendah' : res.I2 < 75 ? 'substansial' : 'tinggi'} (I² = ${fmt(res.I2, 0)}%).`;
  }
  el.innerHTML = `
  <div class="page">
    <div class="page-head"><div>
      <p class="eyebrow">Sintesis kuantitatif</p>
      <h1>Meta-analisis</h1>
      <p class="lede">Data diambil dari kolom data efek pada studi yang lolos teks lengkap. Gunakan data final hasil konsensus untuk analisis akhir.</p>
    </div></div>
    <section class="card controls-row">
      <label class="fld"><span>Ukuran efek</span><select id="ma-measure" data-bind="meta.measure">${Object.entries(MEASURES).map(([k, v]) => opt(k, v.label, m.measure)).join('')}</select></label>
      <label class="fld"><span>Model</span><select id="ma-model" data-bind="meta.model">${opt('random', 'Random-effects (DerSimonian–Laird)', m.model)}${opt('fixed', 'Fixed-effect (inverse variance)', m.model)}</select></label>
      <label class="fld"><span>Sumber data</span><select id="ma-source" data-bind="meta.source">${opt('final', 'Final (konsensus)', m.source)}${opt('r1', revName('r1'), m.source)}${opt('r2', revName('r2'), m.source)}</select></label>
      <label class="fld"><span>Outcome</span><select id="ma-outcome" data-bind="meta.outcome">${opt('', 'Semua outcome', m.outcome)}${outs.map(o => opt(o, o, m.outcome)).join('')}</select></label>
    </section>
    ${res ? `
    <section class="stat-row">
      <div class="stat"><span class="stat-l">Estimasi gabungan</span><span class="stat-v">${f(res.mu)}</span><span class="stat-s">CI 95% ${f(res.lo)}; ${f(res.hi)}</span></div>
      <div class="stat"><span class="stat-l">p (uji Z)</span><span class="stat-v">${fmtP(res.p)}</span><span class="stat-s">Z = ${fmt(res.z, 2)}</span></div>
      <div class="stat"><span class="stat-l">I²</span><span class="stat-v">${fmt(res.I2, 0)}%</span><span class="stat-s">τ² = ${fmt(res.tau2, 3)}</span></div>
      <div class="stat"><span class="stat-l">Q Cochran</span><span class="stat-v">${fmt(res.Q, 2)}</span><span class="stat-s">df = ${res.df}, p = ${fmtP(res.pQ)}</span></div>
      <div class="stat"><span class="stat-l">Studi</span><span class="stat-v">${res.k}</span><span class="stat-s">${all.length - ok.length} belum lengkap</span></div>
    </section>
    <section class="card"><h2>Forest plot</h2><div class="plot-wrap">${MA.forestSVG(ok, res)}</div>
      <p class="hint">${interp} *Arah "mendukung" bergantung pada apakah nilai outcome yang lebih rendah berarti lebih baik.</p></section>
    <div class="grid-2">
      <section class="card"><h2>Funnel plot</h2><div class="plot-wrap">${MA.funnelSVG(ok, res)}</div></section>
      <section class="card"><h2>Bias publikasi</h2>
        ${eg ? `<p>Uji regresi Egger: intersep = <b>${fmt(eg.b0, 3)}</b> (SE ${fmt(eg.seb0, 3)}), t = ${fmt(eg.t, 2)}, df = ${eg.df}, p = <b>${fmtP(eg.p)}</b>.</p>` : '<p class="empty">Uji Egger memerlukan minimal 3 studi.</p>'}
        <p class="hint">Cochrane Handbook menyarankan uji asimetri funnel hanya bila ada minimal 10 studi. Dengan jumlah studi lebih sedikit, daya ujinya rendah.</p>
        ${res.pi ? `<p>Interval prediksi 95%: ${f(res.pi[0])} sampai ${f(res.pi[1])}.</p>` : ''}
      </section>
    </div>` : `<section class="card"><p class="empty">Belum ada studi dengan data efek lengkap untuk ukuran ${esc(MEASURES[m.measure].label)}. Isi kolom data efek di tahap Ekstraksi, lalu selesaikan konsensus.</p></section>`}
    <section class="card"><div class="card-head"><h2>Data per studi</h2><button class="btn ghost" data-action="ma-csv" ${ok.length ? '' : 'disabled'}>Unduh CSV</button></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Studi</th><th>Data</th><th class="num">Efek</th><th class="num">CI 95%</th><th class="num">Bobot</th><th>Status</th></tr></thead><tbody>
      ${all.map(s => {
        const i = ok.indexOf(s);
        const se = s.ok ? Math.sqrt(s.v) : 0;
        return `<tr><td><button class="link" data-action="open-rec" data-id="${s.id}" data-stage="ex">${esc(s.name)}</button></td><td class="muted small">${esc(s.desc || '')}</td>
          <td class="num">${s.ok ? f(s.y) : '–'}</td><td class="num">${s.ok ? f(s.y - 1.96 * se) + '; ' + f(s.y + 1.96 * se) : '–'}</td>
          <td class="num">${s.ok && res ? fmt(res.weights[i], 1) + '%' : '–'}</td><td>${s.ok ? '<span class="pill ok">Masuk</span>' : `<span class="pill warn">${esc(s.why)}</span>`}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="empty">Belum ada studi di tahap ekstraksi.</td></tr>'}
      </tbody></table></div></section>
  </div>`;
}

/* =================== PRISMA =================== */
function renderPrisma() {
  const { v, c } = prismaCounts();
  const P = S.prisma;
  const ov = P.ov || {};
  const pairs = st => S.records.filter(r => (st === 'ta' ? inTA(r) : inFT(r)) && hasDec(r, st, 'r1') && hasDec(r, st, 'r2')).map(r => [r.screen[st].r1.d, r.screen[st].r2.d]);
  const kTA = Stat.kappa(pairs('ta')), kFT = Stat.kappa(pairs('ft'));
  const kTile = (name, k) => `<div class="stat"><span class="stat-l">${name}</span><span class="stat-v">${isFinite(k.kappa) ? fmt(k.kappa, 2) : '–'}</span><span class="stat-s">${k.n ? `${Stat.kappaLabel(k.kappa)} · setuju ${fmt(k.po * 100, 0)}% · n = ${k.n}` : 'Belum ada keputusan ganda'}</span></div>`;
  $('#view-prisma').innerHTML = `
  <div class="page">
    <div class="page-head"><div>
      <p class="eyebrow">Pelaporan</p>
      <h1>Diagram alir PRISMA 2020</h1>
      <p class="lede">Angka dihitung langsung dari impor, deduplikasi, dan keputusan skrining. Isi kolom koreksi bila sebagian proses dilakukan di luar aplikasi.</p>
    </div></div>
    ${c.pendingTA || c.pendingFT ? `<div class="notice warn">Skrining belum selesai: ${c.pendingTA} rekaman judul/abstrak dan ${c.pendingFT} laporan teks lengkap belum punya keputusan akhir. Angka di diagram akan berubah.</div>` : ''}
    <section class="card">
      <div class="card-head"><div><h2>Model bagan</h2><p class="hint">Isi dan urutan kotak tetap sesuai templat PRISMA 2020; yang berubah hanya tampilan. Pilih model, lalu sesuaikan warna, huruf, dan sudut di panel kiri.</p></div></div>
      <div class="pr-gallery">${Object.entries(PRISMA_STYLES).map(([k, s]) => `<button class="pr-thumb ${(P.style || 'klasik') === k ? 'on' : ''}" data-action="pr-style" data-k="${k}" aria-pressed="${(P.style || 'klasik') === k}">
        <span class="pr-thumb-img">${prismaSVG({ style: k })}</span><b>${s.name}</b><span class="muted small">${s.desc}</span></button>`).join('')}</div>
    </section>
    <div class="prisma-layout">
      <section class="card prisma-side">
        <h2>Pengaturan</h2>
        <h3>Tampilan</h3>
        <div class="pr-custom">
          <label class="fld"><span>Warna aksen</span><input type="color" id="pr-accent" data-bind="prisma.accent" value="${esc(prismaStyle().accent)}" ${PRISMA_STYLES[P.style || 'klasik'].mono ? 'disabled title="Model hitam-putih"' : ''}></label>
          <label class="fld"><span>Huruf</span><select id="pr-font" data-bind="prisma.font">${Object.entries(PRISMA_FONTS).map(([k, f]) => opt(k, f[0], prismaStyle().font)).join('')}</select></label>
          <label class="fld"><span>Kotak eksklusi</span><select id="pr-excl" data-bind="prisma.excl">${[['plain', 'Sama dengan kotak lain'], ['tint', 'Diberi latar merah muda'], ['dash', 'Garis putus-putus'], ['stripe', 'Garis aksen di kiri']].map(([k, l]) => opt(k, l, prismaStyle().excl)).join('')}</select></label>
          <label class="fld"><span>Sudut kotak: ${prismaStyle().radius}px</span><input type="range" min="0" max="16" step="1" id="pr-radius" data-bind="prisma.radius" value="${prismaStyle().radius}"></label>
        </div>
        ${P.accent || P.font || P.excl || (P.radius !== undefined && P.radius !== '') ? '<button class="btn sm ghost" data-action="pr-style-reset">Kembalikan ke bawaan model</button>' : ''}
        <h3>Nama sumber (basis data/register)</h3>
        <p class="hint">Koreksi ejaan atau satukan nama, mis. "scopus" → "Scopus", "WOS" → "Web of Science". Perubahan berlaku untuk semua rekaman sumber itu, termasuk duplikat yang dikeluarkan, dan ikut ke diagram serta Laporan.</p>
        <div class="src-edit">${Object.entries(c.sources).map(([name, o], i) => `<div class="src-row">
          <input type="text" id="src-${i}" value="${esc(name)}" data-src-rename="${esc(name)}" aria-label="Nama sumber ${esc(name)}">
          <select id="srccat-${i}" data-src-cat="${esc(name)}" aria-label="Kategori ${esc(name)}">${opt('database', 'Basis data', o.cat === 'register' ? 'register' : 'database')}${opt('register', 'Register', o.cat === 'register' ? 'register' : 'database')}</select>
          <span class="num muted small">n = ${o.n}</span></div>`).join('') || '<p class="empty">Belum ada sumber.</p>'}</div>
        <label class="check sm"><input type="checkbox" id="pr-tareasons" data-bind="prisma.taReasons" ${P.taReasons !== false ? 'checked' : ''}> <span>Rincikan alasan eksklusi judul/abstrak (dari "Kirim alasan" di Papan)</span></label>
        <label class="check sm"><input type="checkbox" id="pr-listsrc" data-bind="prisma.listSources" ${P.listSources !== false ? 'checked' : ''}> <span>Tulis nama tiap basis data di kotak identifikasi</span></label>
        <h3>Isi</h3>
        <label class="fld"><span>Bahasa diagram</span><select id="pr-lang" data-bind="prisma.lang">${opt('en', 'English (untuk jurnal internasional)', P.lang)}${opt('id', 'Bahasa Indonesia', P.lang)}</select></label>
        <label class="fld"><span>Kolom "metode lain"</span><select id="pr-other" data-bind="prisma.showOther">${opt('auto', 'Otomatis', P.showOther)}${opt('yes', 'Tampilkan', P.showOther)}${opt('no', 'Sembunyikan', P.showOther)}</select></label>
        <h3>Metode lain (manual)</h3>
        <div class="fw-grid">
          <label class="fld"><span>Situs web</span><input type="number" min="0" id="pr-web" data-bind="prisma.otherWebsites" value="${esc(P.otherWebsites)}"></label>
          <label class="fld"><span>Organisasi</span><input type="number" min="0" id="pr-org" data-bind="prisma.otherOrgs" value="${esc(P.otherOrgs)}"></label>
          <label class="fld"><span>Penelusuran sitasi</span><input type="number" min="0" id="pr-cit" data-bind="prisma.otherCitation" value="${esc(P.otherCitation)}"></label>
        </div>
        <div class="btn-row">
          <button class="btn" data-action="prisma-svg">Unduh SVG</button>
          <button class="btn ghost" data-action="prisma-png">Unduh PNG</button>
        </div>
      </section>
      <section class="paper" id="prismaPaper">${prismaSVG()}</section>
    </div>
    ${prismaBoxEditor()}

    ${(() => { const ck = prismaIntegrity(); const bad = ck.filter(x => !x.ok); const ov = Object.values(S.prisma.ov || {}).some(v => v !== '' && v !== undefined);
      return `<details class="card integrity ${bad.length ? 'bad' : 'ok'}" ${bad.length ? 'open' : ''}><summary><b>${bad.length ? '⚠ ' + bad.length + ' pemeriksaan tidak cocok' : '✓ Semua rekaman dihitung tepat satu kali'}</b> <span class="muted small">Pemeriksaan konsistensi diagram${ov ? ' · angka koreksi manual tidak ikut diperiksa' : ''}</span></summary>
        <table class="tbl"><tbody>${ck.map(x => `<tr><td>${x.ok ? '✓' : '⚠'}</td><td>${esc(x.label)}</td><td class="num">${x.a}</td><td class="num">${x.b}</td></tr>`).join('')}</tbody></table></details>`; })()}
    <section class="stat-row">${S.project.single ? '<div class="stat"><span class="stat-l">Kappa Cohen</span><span class="stat-v">–</span><span class="stat-s">Tidak berlaku: skrining oleh satu reviewer</span></div>' : kTile('Kappa Cohen · judul/abstrak', kTA) + kTile('Kappa Cohen · teks lengkap', kFT)}
      <div class="stat"><span class="stat-l">Studi diinklusi</span><span class="stat-v">${v.included}</span><span class="stat-s">${S.project.type === 'meta' ? v.maIncluded + ' masuk meta-analisis' : 'setelah teks lengkap'}</span></div>
    </section>

    <section class="card">
      <div class="card-head"><div><h2>Angka &amp; koreksi manual</h2><p class="hint">Kosongkan kolom koreksi untuk memakai angka otomatis.</p></div></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Kotak</th><th class="num">Otomatis</th><th>Koreksi</th><th class="num">Dipakai</th></tr></thead><tbody>
        ${PRISMA_KEYS.filter(([k]) => k !== 'maIncluded' || S.project.type === 'meta').map(([k, l]) => `<tr><td>${l}</td><td class="num">${c[k]}</td>
          <td><input type="number" min="0" class="ov-input" id="ov-${k}" data-ov="${k}" value="${esc(ov[k] ?? '')}" placeholder="—"></td><td class="num"><b>${v[k]}</b></td></tr>`).join('')}
      </tbody></table></div>
    </section>
  </div>`;
}

// Editor teks & ukuran tiap kotak PRISMA
function prismaBoxEditor() {
  const { B } = prismaItems();
  const P = S.prisma, own = P.boxes || {};
  const isSet = x => x !== '' && x !== undefined;
  const changed = Object.keys(B).filter(k => own[k] && Object.values(own[k]).some(isSet));
  const box = k => {
    const o = own[k] || {}, mine = isSet(o.text);
    const txt = mine ? o.text : prItemsToText(B[k]);
    return `<details class="pr-box" id="prb-${k}" ${UI.prBox === k ? 'open' : ''}>
      <summary><b>${esc(PRISMA_BOXES[k][0])}</b>${changed.includes(k) ? ' <span class="pill warn">diubah</span>' : ''}</summary>
      <label class="fld"><span>Teks${mine ? '' : ' (otomatis)'}</span><textarea id="prt-${k}" data-prbox="${k}" data-prf="text" rows="${Math.min(10, txt.split('\n').length + 1)}">${esc(txt)}</textarea></label>
      <div class="fw-grid">
        <label class="fld"><span>Lebar (px)</span><input type="number" id="prw-${k}" data-prbox="${k}" data-prf="w" min="120" max="800" step="10" placeholder="${PRISMA_COLW[PRISMA_BOXES[k][1]]}" value="${esc(o.w ?? '')}"></label>
        <label class="fld"><span>Tinggi (px)</span><input type="number" id="prh-${k}" data-prbox="${k}" data-prf="h" min="30" max="800" step="5" placeholder="otomatis" value="${esc(o.h ?? '')}"></label>
      </div>
      ${changed.includes(k) ? `<button class="btn sm ghost" data-action="pr-box-reset" data-k="${k}">Kembalikan otomatis</button>` : ''}
    </details>`;
  };
  return `<section class="card pr-boxes">
    <div class="card-head"><div><h2>Edit kotak</h2>
      <p class="hint">Klik sebuah kotak di diagram, atau buka dari daftar di bawah. Ubah teksnya (satu baris = satu baris di kotak; awali dengan "-" agar menjorok), lalu atur lebar dan tinggi. Tulis <code>{screened}</code>, <code>{taExcl}</code>, <code>{ftExcl}</code>, <code>{included}</code>, dst. agar angka tetap mengikuti hitungan otomatis; angka yang diketik langsung tidak ikut berubah.</p></div>
      ${changed.length ? '<button class="btn sm ghost" data-action="pr-box-reset-all">Kembalikan semua kotak</button>' : ''}</div>
    <label class="check sm"><input type="checkbox" id="pr-fit" data-bind="prisma.fitH" ${P.fitH !== false ? 'checked' : ''}> <span>Tinggi kotak menyesuaikan teksnya (tidak ikut kotak terpanjang di barisnya)</span></label>
    <div class="pr-box-list">${Object.keys(B).map(box).join('')}</div>
  </section>`;
}

/* =================== CHECKLIST =================== */
function renderChecklist() {
  const cl = activeChecklist();
  const st = S.checklist;
  const done = cl.items.filter(it => st[cl.name + it[1]] && st[cl.name + it[1]].ok).length;
  let lastSec = '';
  $('#view-checklist').innerHTML = `
  <div class="page">
    <div class="page-head"><div>
      <p class="eyebrow">Pelaporan</p>
      <h1>Checklist ${esc(cl.name.split(' (')[0])}</h1>
      <p class="lede">Checklist mengikuti jenis review: PRISMA 2020 untuk systematic review dan meta-analisis, PRISMA-ScR untuk scoping review. Catat lokasi setiap item di naskah Anda.</p>
    </div>
    <div class="progress-block"><span class="stat-v">${done}<small>/${cl.items.length}</small></span><div class="bar"><i style="width:${done / cl.items.length * 100}%"></i></div><button class="btn ghost sm" data-action="checklist-csv">Unduh CSV</button></div>
    </div>
    <section class="card">
      <div class="table-wrap"><table class="tbl checklist">
        <thead><tr><th class="c-ok">Selesai</th><th>No.</th><th>Item</th><th>Lokasi di naskah</th></tr></thead>
        <tbody>${cl.items.map(([sec, no, topic, desc]) => {
          const k = cl.name + no;
          const v = st[k] || {};
          const head = sec !== lastSec ? `<tr class="sec-row"><td colspan="4">${esc(sec)}</td></tr>` : '';
          lastSec = sec;
          return head + `<tr class="${v.ok ? 'is-done' : ''}"><td class="c-ok"><input type="checkbox" id="cl-${no}" data-cl="${esc(k)}" data-key="ok" ${v.ok ? 'checked' : ''} aria-label="Item ${no} selesai"></td>
            <td class="num"><b>${no}</b></td><td><b>${esc(topic)}</b><br><span class="muted">${esc(desc)}</span></td>
            <td><input type="text" id="cll-${no}" data-cl="${esc(k)}" data-key="loc" value="${esc(v.loc || '')}" placeholder="mis. Metode, hlm. 5"></td></tr>`;
        }).join('')}</tbody></table></div>
    </section>
  </div>`;
}

/* =================== EKSPOR =================== */
/* =================== LAPORAN SKRINING =================== */
const REPORT_FILTERS = [['all', 'Semua'], ['inc', 'Inklusi'], ['ex-ta', 'Eksklusi judul/abstrak'], ['ex-ft', 'Eksklusi teks lengkap'], ['notret', 'Tidak diperoleh'], ['pend', 'Belum diputuskan'], ['dup', 'Duplikat'], ['auto', 'Eksklusi otomatis']];

function reportRows() {
  return S.records.map((r, i) => ({ r, no: i + 1, st: overallStatus(r), ev: evalBest(r) }));
}

// Duplikat yang dikeluarkan saat unggah (tidak disimpan, hanya dicatat)
function skippedRows(q) {
  return (S.skipped || []).map((x, i) => ({ x, no: S.records.length + i + 1 }))
    .filter(({ x }) => !q || ((x.title || '') + ' ' + (x.file || '') + ' ' + (x.year || '')).toLowerCase().includes(q));
}
function skippedNote(x) { return x.by + (x.dupTitle ? ' dengan "' + x.dupTitle + '"' : ''); }

function decCell(r, st) {
  if (st === 'ta' && r.sourceCat === 'other') return '<span class="muted small">dilewati (metode lain)</span>';
  if (st === 'ft' && !inFT(r)) return '<span class="muted">—</span>';
  const s = stageStatus(r, st);
  const lab = { include: ['ok', 'Include'], exclude: ['no', 'Exclude'], conflict: ['conf', 'Konflik'], partial: ['warn', isSingle() ? 'Ragu' : 'Sebagian'], pending: ['', 'Belum'] }[s];
  const why = s === 'exclude' ? finalReason(r, st) : '';
  const auto = ['r1', 'r2'].some(rv => r.screen[st][rv] && r.screen[st][rv].auto && r.screen[st][rv].d === s);
  return `<span class="pill ${lab[0]}">${lab[1]}</span>${auto ? '<span class="pill" title="Dari saran otomatis, belum dikoreksi">otomatis</span>' : ''}${why && why !== 'Alasan tidak dicatat' ? `<span class="rep-why">${esc(why)}</span>` : s === 'exclude' && st === 'ft' ? '<span class="rep-why txt-conf">alasan belum dipilih</span>' : ''}`;
}

function repNote(r) {
  return [r.screen.ta.r1 && r.screen.ta.r1.note, r.screen.ta.r2 && r.screen.ta.r2.note, r.screen.ft.r1 && r.screen.ft.r1.note, r.screen.ft.r2 && r.screen.ft.r2.note,
    r.archived ? 'dibersihkan dari papan ' + r.archived.date + (r.archived.hadPdf ? ' (PDF dihapus)' : '') : ''].filter(Boolean).join(' | ');
}

/* Rekap hasil ekstraksi: hitungan tiap pilihan pada kolom Pilihan / Pilihan (banyak) */
function extractionSummary() {
  const inc = S.records.filter(inExtraction);
  const done = inc.filter(exDone);
  const fields = S.fields.filter(f => (f.type === 'select' || f.type === 'multi') && (f.group !== 'ma' || S.project.type === 'meta'));
  return {
    total: inc.length, done: done.length,
    fields: fields.map(f => {
      const counts = new Map((f.options || []).map(o => [o, 0]));
      let empty = 0;
      done.forEach(r => {
        const vals = String(exFinal(r)[f.id] || '').split(f.type === 'multi' ? ';' : '\u0000').map(s => s.trim()).filter(Boolean);
        if (!vals.length) empty++;
        vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
      });
      return { f, counts: [...counts], empty };
    })
  };
}
function exHas(r, f, val) {
  const v = String(exFinal(r)[f.id] || '');
  return f.type === 'multi' ? v.split(';').map(s => s.trim()).includes(val) : v.trim() === val;
}

function renderExtractionSummary() {
  const X = extractionSummary();
  if (!X.total) return `<section class="card"><h2>Hasil ekstraksi</h2><p class="empty">Belum ada studi yang lolos teks lengkap. Rekap Tier A/B, lapisan, dan dimensi muncul di sini setelah ekstraksi.</p></section>`;
  const sel = UI.exPick;
  const pf = sel && S.fields.find(f => f.id === sel.fid);
  const list = pf ? S.records.filter(r => inExtraction(r) && exDone(r) && exHas(r, pf, sel.val)) : [];
  const idF = S.fields.find(f => f.id === 'study_id');
  const showCols = S.fields.filter(f => (f.type === 'select' || f.type === 'multi') && f.id !== (pf && pf.id) && f.group !== 'ma').slice(0, 4);
  return `<section class="card ex-sum">
    <div class="card-head"><div><h2>Hasil ekstraksi</h2>
      <p class="hint">Rekap dari isian final (${exSolo() ? 'Reviewer 1' : 'konsensus'}) pada ${X.done} dari ${X.total} studi inklusi yang ekstraksinya ditandai selesai.${X.total > X.done ? ` <span class="txt-conf">${X.total - X.done} studi belum selesai diekstraksi dan belum dihitung.</span>` : ''} Klik sebuah baris untuk melihat daftar studinya.</p></div>
      <button class="btn ghost" data-action="exp-extract" data-which="final">Unduh CSV ekstraksi</button></div>
    <div class="ex-sum-grid">${X.fields.map(({ f, counts, empty }) => {
      const max = Math.max(1, ...counts.map(c => c[1]));
      return `<div class="ex-field"><h3>${esc(f.label)}${f.type === 'multi' ? ' <span class="muted small">(bisa lebih dari satu)</span>' : ''}</h3>
        ${counts.map(([o, n]) => `<button class="ex-bar ${sel && sel.fid === f.id && sel.val === o ? 'on' : ''}" data-action="ex-pick" data-fid="${f.id}" data-val="${esc(o)}" ${n ? '' : 'disabled'}>
          <span class="ex-bar-l">${esc(o)}</span><span class="ex-bar-track"><i style="width:${n / max * 100}%"></i></span><b class="ex-bar-n">${n}</b><span class="ex-bar-p muted">${X.done ? Math.round(n / X.done * 100) : 0}%</span></button>`).join('')}
        ${empty ? `<p class="muted small">Belum diisi: ${empty} studi</p>` : ''}</div>`;
    }).join('') || '<p class="empty">Formulir belum punya kolom bertipe Pilihan.</p>'}</div>
    ${pf ? `<div class="ex-list"><div class="ex-list-head"><b>${esc(pf.label)} = ${esc(sel.val)}</b> <span class="muted">· ${list.length} studi</span><button class="link sm" data-action="ex-pick-clear">tutup</button></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Studi</th>${showCols.map(f => `<th>${esc(f.label)}</th>`).join('')}</tr></thead>
      <tbody>${list.map(r => `<tr><td class="rep-study"><button class="link" data-action="open-rec" data-id="${r.id}">${esc((idF && exFinal(r)[idF.id]) || r.title)}</button><span class="muted small">${esc(r.title.slice(0, 120))}</span></td>${showCols.map(f => `<td class="small">${esc(exFinal(r)[f.id] || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : ''}
  </section>`;
}

function renderReport() {
  const rows = reportRows();
  const cnt = k => rows.filter(x => x.st.k === k).length;
  const f = UI.repFilter || 'all';
  const q = (UI.repQ || '').trim().toLowerCase();
  const shown = rows.filter(x => (f === 'all' || x.st.k === f) && (!q || (x.r.title + ' ' + x.r.authors + ' ' + x.r.year).toLowerCase().includes(q)));
  const tally = (k, st) => { const o = {}; rows.filter(x => x.st.k === k).forEach(x => { const w = finalReason(x.r, st); o[w] = (o[w] || 0) + 1; }); return o; };
  const reasons = tally('ex-ft', 'ft'), taReasons = tally('ex-ta', 'ta');
  const tile = (k, l, sub) => `<button class="stat stat-btn ${f === k ? 'on' : ''}" data-action="rep-filter" data-f="${k}"><span class="stat-l">${l}</span><span class="stat-v">${k === 'all' ? rows.length + skippedCount() : k === 'dup' ? cnt(k) + skippedCount() : cnt(k)}</span><span class="stat-s">${sub}</span></button>`;
  const reasonTable = (obj, title) => Object.keys(obj).length ? `<div><h3>${title}</h3><table class="tbl"><tbody>${Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td>${esc(k)}</td><td class="num"><b>${n}</b></td></tr>`).join('')}</tbody></table></div>` : '';
  $('#view-report').innerHTML = `
  <div class="page">
    <div class="page-head"><div>
      <p class="eyebrow">Pelaporan</p>
      <h1>Laporan skrining</h1>
      <p class="lede">Status setiap rekaman di sepanjang alur: judul &amp; abstrak, lalu teks lengkap, lalu inklusi. Angka di sini sama dengan yang dipakai diagram PRISMA.</p>
    </div>
    <div class="btn-row"><button class="btn" data-action="rep-csv">Unduh tabel ini (CSV)</button><button class="btn ghost" data-action="exp-inc" data-fmt="xlsx" ${cnt('inc') ? '' : 'disabled'} title="Studi yang lolos teks lengkap, dengan jumlah sebutan setiap kriteria inklusi">Unduh hasil Inklusi (Excel)</button><button class="btn ghost" data-action="goto" data-view="prisma">Lihat diagram PRISMA</button></div></div>

    <section class="stat-row rep-tiles">
      ${tile('all', 'Semua rekaman', 'hasil impor')}
      ${tile('inc', 'Inklusi', 'lolos teks lengkap')}
      ${tile('ex-ta', 'Eksklusi judul/abstrak', 'tahap 1')}
      ${tile('ex-ft', 'Eksklusi teks lengkap', 'tahap 2, dengan alasan')}
      ${tile('pend', 'Belum diputuskan', 'masih perlu dibaca')}
      ${tile('dup', 'Duplikat', 'dihapus sebelum skrining')}
    </section>

    ${Object.keys(reasons).length || Object.keys(taReasons).length ? `<section class="card"><h2>Alasan eksklusi</h2><div class="grid-2">${reasonTable(reasons, 'Teks lengkap (dilaporkan di PRISMA)')}${reasonTable(taReasons, 'Judul/abstrak (opsional)')}</div></section>` : ''}

    ${renderExtractionSummary()}

    <section class="card">
      <div class="card-head">
        <div class="seg rep-seg">${REPORT_FILTERS.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-action="rep-filter" data-f="${k}">${l} <span class="n">${k === 'all' ? rows.length + skippedCount() : k === 'dup' ? cnt(k) + skippedCount() : cnt(k)}</span></button>`).join('')}</div>
        <input type="search" id="repQ" placeholder="Cari judul atau penulis…" value="${esc(UI.repQ || '')}" aria-label="Cari di laporan">
      </div>
      <div class="table-wrap"><table class="tbl rep-tbl">
        <thead><tr><th class="num">No</th><th>Studi</th><th>Indikator</th><th>Judul &amp; abstrak</th><th>Teks lengkap</th><th>Status akhir</th><th>Catatan</th></tr></thead>
        <tbody>${shown.map(({ r, no, st, ev }) => `<tr>
          <td class="num muted">${no}</td>
          <td class="rep-study"><button class="link" data-action="open-rec" data-id="${r.id}">${esc(r.title || '(tanpa judul)')}</button>
            <span class="muted small">${esc((r.authors || '').split(/[;,]/)[0])}${r.year ? ' · ' + esc(r.year) : ''}${r.hasText ? ' · PDF' : ''} · ${esc(r.source || '')}</span></td>
          <td class="nowrap">${critLamps(ev)} <span class="muted small">${ev.incMatched}/${ev.total}</span></td>
          <td>${r.duplicateOf || r.autoExcluded ? '<span class="muted">—</span>' : decCell(r, 'ta')}</td>
          <td>${r.duplicateOf || r.autoExcluded ? '<span class="muted">—</span>' : r.notRetrieved ? '<span class="pill no">Tidak diperoleh</span>' : decCell(r, 'ft')}</td>
          <td><span class="pill ${st.cls}">${st.label}</span></td>
          <td class="small rep-note">${esc(repNote(r).slice(0, 160))}</td>
        </tr>`).join('')}${f === 'all' || f === 'dup' ? skippedRows(q).map(({ x, no }) => `<tr class="rep-skip">
          <td class="num muted">${no}</td>
          <td class="rep-study"><b>${esc(x.title || x.file || '(tanpa judul)')}</b>
            <span class="muted small">${x.file && x.file !== x.title ? esc(x.file) + ' · ' : ''}${x.year ? esc(x.year) + ' · ' : ''}${esc(x.source || '')} · diunggah ${esc(x.date)}</span></td>
          <td class="muted">—</td><td class="muted">—</td><td class="muted">—</td>
          <td><span class="pill">Duplikat · dikeluarkan</span></td>
          <td class="small rep-note">${esc(skippedNote(x).slice(0, 160))}</td>
        </tr>`).join('') : ''}${!shown.length && !((f === 'all' || f === 'dup') && skippedRows(q).length) ? '<tr><td colspan="7" class="empty">Tidak ada rekaman pada filter ini.</td></tr>' : ''}</tbody></table></div>
    </section>
  </div>`;
}

function exportReport() {
  const f = UI.repFilter || 'all';
  const rows = reportRows().filter(x => f === 'all' || x.st.k === f);
  const dec = (r, st) => { const s = stageStatus(r, st); return s === 'pending' ? '' : s; };
  const head = ['no', 'judul', 'penulis', 'tahun', 'doi', 'sumber', 'kriteria_terdeteksi', 'penanda', 'keputusan_judul_abstrak', 'alasan_judul_abstrak', 'keputusan_teks_lengkap', 'alasan_teks_lengkap', 'status_akhir', 'catatan', 'bahasa', 'penilaian_kualitas'];
  const data = rows.map(({ r, no, st, ev }) => [no, r.title, r.authors, r.year, r.doi, r.source,
    ev.inc.filter(c => c.n).map(c => c.label).join('; ') + (ev.excMatched ? ' | eksklusi: ' + ev.exc.filter(c => c.n).map(c => c.label).join('; ') : ''),
    FLAG_META[ev.flag].label,
    r.duplicateOf || r.autoExcluded ? '' : dec(r, 'ta'), stageStatus(r, 'ta') === 'exclude' ? finalReason(r, 'ta') : '',
    inFT(r) ? (r.notRetrieved ? 'tidak diperoleh' : dec(r, 'ft')) : '', stageStatus(r, 'ft') === 'exclude' ? finalReason(r, 'ft') : '',
    st.label, repNote(r), LANG_NAMES[Lang.of(r)] || '', apReportCell(r)]);
  if (f === 'all' || f === 'dup') skippedRows('').forEach(({ x, no }) => data.push([no, x.title || x.file, '', x.year, x.doi, x.source, '', '', '', '', '', '', 'Duplikat · dikeluarkan saat unggah', skippedNote(x) + (x.file ? ' · file: ' + x.file : '')]));
  downloadText(toCSV([head, ...data], delim()), slug(S.project.title) + '-laporan-' + f + '.csv', 'text/csv');
}

function renderExport() {
  $('#view-export').innerHTML = `
  <div class="page">
    <div class="page-head"><div>
      <p class="eyebrow">Data</p>
      <h1>Ekspor, cadangan &amp; kolaborasi</h1>
      <p class="lede">Data tersimpan otomatis di peramban ini. Buat cadangan berkala, dan pakai fitur gabung bila Reviewer 2 bekerja di komputer lain.</p>
    </div></div>
    <div class="grid-2">
      <section class="card">
        <h2>Tabel untuk analisis</h2>
        <label class="fld"><span>Pemisah kolom CSV</span><select id="csvDelim">${opt(',', 'Koma (,)', UI.delim || ',')}${opt(';', 'Titik koma (;) untuk Excel berbahasa Indonesia', UI.delim || ',')}</select></label>
        <div class="export-list">
          <button class="btn" data-action="exp-screen">Keputusan skrining (semua rekaman)</button>
          <button class="btn" data-action="exp-extract" data-which="final">Ekstraksi data final (konsensus)</button>
          <button class="btn ghost" data-action="exp-extract" data-which="all">Ekstraksi R1, R2, dan final berdampingan</button>
          <button class="btn ghost" data-action="exp-ris">Studi yang diinklusi (RIS untuk Zotero/Mendeley)</button>
        </div>
      </section>
      ${inclusionCard()}
      ${storageCard()}
      <section class="card">
        <h2>Cadangan proyek</h2>
        <p class="hint">File JSON berisi seluruh proyek: kriteria, rekaman, keputusan, ekstraksi, dan teks lengkap.</p>
        <label class="check"><input type="checkbox" id="bkPdf"> <span>Sertakan file PDF asli (file cadangan jadi lebih besar)</span></label>
        <div class="btn-row">
          <button class="btn" data-action="backup">Unduh cadangan</button>
          <button class="btn ghost" data-action="restore">Pulihkan dari cadangan…</button>
        </div>
      </section>
      <section class="card">
        <h2>Gabungkan kerja reviewer lain</h2>
        <p class="hint">Reviewer 2 mengerjakan salinan proyek di komputernya, lalu mengirim file cadangan. Pilih slot reviewer yang ingin diambil dari file tersebut. Rekaman dicocokkan lewat ID, DOI, atau judul.</p>
        <div class="btn-row">
          <button class="btn" data-action="merge" data-rv="r2">Ambil data Reviewer 2 dari file…</button>
          <button class="btn ghost" data-action="merge" data-rv="r1">Ambil data Reviewer 1 dari file…</button>
        </div>
      </section>
      <section class="card danger-zone">
        <h2>Proyek baru</h2>
        <p class="hint">Menghapus semua rekaman, keputusan, dan PDF di peramban ini. Unduh cadangan dulu bila masih diperlukan.</p>
        ${UI.confirmReset ? `<div class="confirm">Yakin menghapus seluruh proyek? <button class="btn danger" data-action="reset-yes">Ya, hapus semua</button><button class="btn ghost" data-action="reset-no">Batal</button></div>`
          : `<div class="btn-row"><button class="btn danger" data-action="reset-ask">Kosongkan proyek</button><button class="btn ghost" data-action="load-sample">Muat data contoh</button></div>`}
      </section>
    </div>
  </div>`;
  renderStorageInfo();
}

function ftResCell(r) {
  const x = r.ftAutoRes;
  if (!x || !x.counts) return '<span class="muted small">—</span>';
  const cnt = x.counts.map(([l, n]) => esc(l.replace(/s*[–—-].*$/, '')) + ' ' + n + '×').join(' · ');
  return (r.archived ? '<span class="pill no">Dibuang</span>' : '<span class="pill ok">Lolos</span>') + ' <span class="small muted">' + cnt + '</span>';
}
