/* Antarmuka versi website: unggah naskah, laporan bertab, salin catatan. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const R = window.RULES;

  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const GROUP = {
    awal: 'Bagian awal', sistematika: 'Sistematika bab', isi: 'Isi & substansi', koherensi: 'Koherensi',
    dimensi: 'Dimensi konseptual', paradigma: 'Paradigma & grand theory', statistik: 'Analisis data & statistik', tabel: 'Tabel & gambar',
    kuantitas: 'Kuantitas kata', rujukan: 'Rujukan & sitasi', lampiran: 'Lampiran', format: 'Format penulisan',
  };
  const ICON = { ok: '✓', warn: '!', miss: '✕', info: 'i', na: '–' };
  const LABEL = { ok: 'Sesuai', warn: 'Perlu dicek', miss: 'Belum ada', info: 'Info', na: 'Tidak berlaku' };

  let fileName = '', parsed = null, result = null, scores = null, tab = 'catatan';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const badge = (st) => '<span class="badge b-' + st + '" title="' + LABEL[st] + '" aria-label="' + LABEL[st] + '">' + ICON[st] + '</span>';
  const tone = (p) => (p >= 80 ? 'var(--ok)' : p >= 60 ? 'var(--warn)' : 'var(--miss)');
  const fmt = (n) => Number(n).toLocaleString('id-ID');

  // ------------------------------------------------------------ unggah
  let pendingFiles = [];
  const drop = $('drop');
  $('file').addEventListener('change', (e) => pick(Array.from(e.target.files)));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      pick(Array.from(e.dataTransfer.files));
    }
  });

  function pick(files) {
    if (!files || !files.length) return;
    pendingFiles = files;
    if (files.length === 1) {
      const f = files[0];
      $('filename').textContent = f.name + ' · ' + (f.size / 1048576).toFixed(1) + ' MB';
    } else {
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      $('filename').innerHTML = '<b>' + files.length + ' berkas bab terpilih:</b><br><small style="color:var(--text-dim)">' +
        files.map((f) => esc(f.name)).join(', ') + ' (' + (totalSize / 1048576).toFixed(1) + ' MB total)</small>';
    }
    $('run').disabled = false;
    $('progress').textContent = '';
  }

  $('run').addEventListener('click', async () => {
    if (!pendingFiles || !pendingFiles.length) return;
    await load(pendingFiles);
  });
  ['jenjang', 'tahap', 'jenis', 'judul', 'skipAwal', 'skipLampiran'].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener('change', () => { if (parsed) analyze(); });
  });

  async function load(files) {
    $('run').disabled = true;
    $('progress').textContent = 'Membaca ' + files.length + ' berkas naskah…';
    try {
      parsed = await window.Parser.parseFiles(files, (curr, total, name) => {
        $('progress').textContent = 'Membaca berkas ' + curr + ' dari ' + total + ' (' + name + ')…';
      });
      if (files.length === 1) {
        fileName = files[0].name;
      } else {
        fileName = files.length + ' Berkas Gabungan (' + files.map((f) => f.name).join(', ') + ')';
      }
      $('progress').textContent = 'Selesai membaca.';
      analyze();
      if (window.matchMedia('(max-width: 900px)').matches) $('report').scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      console.error(e);
      $('progress').textContent = 'Berkas tidak dapat dibaca: ' + e.message;
    } finally {
      $('run').disabled = !pendingFiles || !pendingFiles.length;
    }
  }

  function resetAll() {
    pendingFiles = [];
    parsed = null;
    result = null;
    scores = null;
    fileName = '';
    tab = 'catatan';
    ai.saved = {};
    if ($('file')) $('file').value = '';
    if ($('filename')) $('filename').textContent = '';
    if ($('progress')) $('progress').textContent = '';
    if ($('run')) $('run').disabled = true;
    if ($('judul')) $('judul').value = '';
    if ($('jenis')) $('jenis').value = 'auto';
    if ($('jenjang')) $('jenjang').value = 'auto';
    if ($('tahap')) $('tahap').value = 'auto';
    if ($('skipAwal')) $('skipAwal').checked = false;
    if ($('skipLampiran')) $('skipLampiran').checked = false;
    if ($('filled')) $('filled').hidden = true;
    if ($('empty')) $('empty').hidden = false;
    if ($('alerts')) $('alerts').innerHTML = '';
    if ($('panel')) $('panel').innerHTML = '';
    if ($('miniBab')) $('miniBab').innerHTML = '';
    try {
      sessionStorage.removeItem('cekin-last-file');
      sessionStorage.removeItem('cekin-last-result');
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const btnReset = $('btnReset');
  if (btnReset) btnReset.addEventListener('click', resetAll);
  const btnResetReport = $('btnResetReport');
  if (btnResetReport) btnResetReport.addEventListener('click', resetAll);

  function analyze() {
    result = window.Analyzer.analyze(parsed, {
      jenjang: $('jenjang').value,
      tahap: $('tahap').value,
      jenis: $('jenis').value,
      judul: $('judul').value,
      skipAwal: $('skipAwal') ? $('skipAwal').checked : false,
      skipLampiran: $('skipLampiran') ? $('skipLampiran').checked : false,
    });
    scores = window.Analyzer.score(result.groups);
    summary();
    render();
  }

  // -------------------------------------------------------- ringkasan
  function summary() {
    const r = result;
    $('empty').hidden = true;
    $('filled').hidden = false;
    const ring = $('ring');
    ring.style.setProperty('--p', scores.total);
    ring.style.setProperty('--c', tone(scores.total));
    $('scoreVal').textContent = scores.total;
    $('sumTitle').textContent = fileName;
    const auto = (id) => ($(id).value === 'auto' ? ' (otomatis)' : '');
    const tahapLabel = r.isSingleBab
      ? ('Khusus Bab ' + ['I', 'II', 'III', 'IV', 'V'][r.singleBabNum - 1])
      : (r.tahap === 'proposal' ? 'Proposal Bab I–III' : 'Naskah lengkap');
    const facts = [
      ['Jenis penelitian', R.JENIS[r.jenisId].label.split(' (')[0] + auto('jenis')],
      ['Jenjang', (r.jenjangId === 'tesis' ? 'Tesis · KKNI 8' : 'Disertasi · KKNI 9') + auto('jenjang')],
      ['Tahap / Cakupan', tahapLabel + auto('tahap')],
      ['Bab terbaca', r.S.chapters.length + (r.isSingleBab ? ' (Fokus Bab ' + ['I', 'II', 'III', 'IV', 'V'][r.singleBabNum - 1] + ')' : '')],
      ['Kata isi', fmt(r.bodyWords)],
      ['Entri pustaka', r.refInfo.refs.length],
    ];
    if (r.skipAwal) facts.push(['Bagian awal', 'Dilewati (fokus isi)']);
    if (r.skipLampiran) facts.push(['Lampiran', 'Dilewati (fokus Bab 1–5 & Pustaka)']);
    if (parsed && parsed.multiFiles && parsed.multiFiles.length > 1) {
      facts.unshift(['Berkas digabung', parsed.multiFiles.length + ' file (' + parsed.multiFiles.join(', ') + ')']);
    }
    $('facts').innerHTML = facts.map(([k, v]) => '<div class="fact-item"><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('');
    $('bars').innerHTML = Object.keys(GROUP).filter((g) => scores[g] != null).map((g) =>
      '<div class="bar"><div class="lbl"><span>' + GROUP[g] + '</span><b>' + scores[g] + '%</b></div><div class="track"><div class="fill" style="width:' + scores[g] + '%;background:' + tone(scores[g]) + '"></div></div></div>').join('');
    if ($('miniBab')) $('miniBab').innerHTML = miniBabDistribution();

    const al = [];
    if (r.scanned) al.push(['miss', 'PDF ini hasil pindai (gambar) sehingga teksnya tidak terbaca. Unggah .docx atau PDF hasil ekspor dari Word.']);
    if (!r.S.chapters.length) al.push(['miss', 'Judul bab tidak terbaca. Pastikan setiap bab diawali baris seperti "BAB I PENDAHULUAN".']);
    if ($('jenis').value === 'auto') {
      const top = r.det.ranked.slice(0, 3).filter(([, s]) => s > 0).map(([j, s]) => R.JENIS[j].label.split(' (')[0] + ' (' + s + ')');
      al.push(['info', 'Jenis penelitian ditebak dari kata kunci di Bab I–III: ' + (top.join(', ') || 'tidak ada indikator kuat') + '. Bila keliru, ganti di menu Jenis penelitian; laporan langsung diperbarui.']);
    }
    if (!r.jenjangPasti && !r.skipAwal) al.push(['warn', 'Jenjang ditebak sebagai ' + (r.jenjangId === 'tesis' ? 'tesis' : 'disertasi') + ' karena naskah tidak memuat halaman sampul/judul. Pilih jenjang yang benar di panel kiri, karena batas jumlah kata dan rujukan bergantung padanya.']);
    if (!r.judul && !r.skipAwal) al.push(['info', 'Judul tidak terbaca dari naskah. Ketik judul di panel kiri agar koherensi judul ikut diperiksa' + (r.jenjangId === 'tesis' ? ' (dan batas 12 kata untuk tesis).' : '.') + '']);
    if (r.skipAwal) al.push(['info', '⚡ Mode Fokus Aktif: Bagian awal (sampul, abstrak, pengantar) dilewati sehingga skor berfokus murni pada Bab 1–5 & Daftar Pustaka.']);
    if (r.skipLampiran) al.push(['info', '⚡ Mode Fokus Aktif: Lampiran dilewati dari penilaian skor.']);
    if (r.kind === 'pdf') al.push(['warn', 'Untuk PDF, pemeriksaan huruf, spasi, dan nomor halaman terbatas. Gunakan .docx untuk hasil format yang lengkap.']);
    $('alerts').innerHTML = al.map(([c, t]) => '<div class="alert ' + c + '">' + esc(t) + '</div>').join('');
    const n = notes().reduce((a, [, l]) => a + l.length, 0);
    $('nCat').textContent = n ? n : '';
  }

  // ---------------------------------------------------------------- tab
  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.tab;
    for (const x of $('tabs').children) x.setAttribute('aria-selected', String(x === b));
    try { localStorage.setItem('unj-tab', tab); } catch (err) { /* abaikan */ }
    render();
  });
  try {
    const t = localStorage.getItem('unj-tab');
    if (t) { const b = $('tabs').querySelector('[data-tab="' + t + '"]'); if (b) { tab = t; for (const x of $('tabs').children) x.setAttribute('aria-selected', String(x === b)); } }
  } catch (err) { /* abaikan */ }

  const legend = () => '<div class="legend">' + ['ok', 'warn', 'miss', 'info'].map((s) => '<span>' + badge(s) + LABEL[s] + '</span>').join('') + '</div>';

  function list(items, title, loc) {
    if (!items.length) return '';
    return (title ? '<h3>' + esc(title) + '</h3>' : '') + '<ul class="items">' + items.map((it) => {
      let lokBadge = '';
      if (it.lokasi) {
        const lokLower = it.lokasi.toLowerCase();
        const isB3 = lokLower.includes('bab iii');
        const isB4 = lokLower.includes('bab iv');
        const cls = isB3 && isB4 ? 'b3 b4' : isB4 ? 'b4' : isB3 ? 'b3' : '';
        lokBadge = '<span class="tag-lokasi ' + cls + '" title="Lokasi bab naskah">📍 ' + esc(it.lokasi) + '</span>';
      }
      return '<li class="' + (it.sub ? 'sub' : '') + '">' + badge(it.status) +
        '<div style="min-width:0;width:100%">' +
          '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
            '<div><span class="nm">' + esc(it.nama) + '</span>' + lokBadge + '</div>' +
            (it.hal ? '<span class="hal">hal. ' + esc(it.hal) + '</span>' : '') +
          '</div>' +
          '<div class="dt">' + esc(it.detail) + '</div>' +
          ((it.status === 'miss' || it.status === 'warn') && it.saran ? '<div class="sv">→ <b>Saran:</b> ' + esc(it.saran) + '</div>' : '') +
          (it.bukti ? '<div class="ev">' + esc(it.bukti) + '</div>' : '') +
        '</div>' +
      '</li>';
    }).join('') + '</ul>';
  }

  const BAB_ORDER = ['I', 'II', 'III', 'IV', 'V', 'awal', 'pustaka', 'lampiran', 'umum'];
  const BAB_META = {
    'I': { num: 'I', label: 'Bab I — Pendahuluan', icon: '1', desc: 'Latar belakang, identifikasi & pembatasan masalah, rumusan masalah, tujuan, dan manfaat penelitian.' },
    'II': { num: 'II', label: 'Bab II — Kajian Teori & Kerangka Berpikir', icon: '2', desc: 'Deskripsi konseptual variabel, grand theory, sintesis teori, kerangka berpikir, dan hipotesis.' },
    'III': { num: 'III', label: 'Bab III — Metodologi Penelitian', icon: '3', desc: 'Desain penelitian, populasi/sampel, instrumen & uji psikometri, serta rencana teknik analisis data.' },
    'IV': { num: 'IV', label: 'Bab IV — Hasil Penelitian & Pembahasan', icon: '4', desc: 'Deskripsi data, pengujian hipotesis/statistik (CFI, RMSEA, Alpha, dll.), dan pembahasan mendalam.' },
    'V': { num: 'V', label: 'Bab V — Kesimpulan, Implikasi & Saran', icon: '5', desc: 'Simpulan jawaban rumusan masalah, implikasi teoretis/praktis, keterbatasan, dan saran riset.' },
    'awal': { num: 'Awal', label: 'Bagian Awal Naskah', icon: 'A', desc: 'Sampul, persetujuan, orisinalitas, abstrak (bilingual), kata pengantar, dan daftar isi/tabel/gambar.' },
    'pustaka': { num: 'Pustaka', label: 'Daftar Pustaka', icon: 'D', desc: 'Format APA 7th, proporsi jurnal bereputasi 80%, rujukan 10 tahun terakhir, dan kelengkapan DOI.' },
    'lampiran': { num: 'Lampiran', label: 'Lampiran & Instrumen', icon: 'L', desc: 'Kisi-kisi instrumen, kuesioner, output komputasi software, surat izin, dan dokumen riwayat.' },
    'umum': { num: 'Umum', label: 'Umum & Format Naskah', icon: 'U', desc: 'Tata letak naskah, batas margin (4-4-3-3), jenis font, spasi 1.5, dan aturan format umum.' }
  };

  let activeBabFilter = 'all';

  function notes() {
    const out = [];
    const seen = new Set();
    for (const [g, items] of Object.entries(result.groups)) {
      const filtered = [];
      const l = items.filter((it) => it.status === 'miss' || it.status === 'warn').sort((a, b) => (a.status === 'miss' ? 0 : 1) - (b.status === 'miss' ? 0 : 1));
      for (const it of l) {
        const key = (it.nama || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!key) continue;
        if (!seen.has(key)) {
          seen.add(key);
          filtered.push(it);
        }
      }
      if (filtered.length) out.push([g, filtered]);
    }
    return out;
  }

  function notesByBab() {
    const rawNotes = notes();
    const buckets = {};
    BAB_ORDER.forEach((k) => { buckets[k] = []; });

    for (const [g, items] of rawNotes) {
      for (const it of items) {
        const babs = babOf(it, g);
        for (const b of babs) {
          if (!buckets[b]) buckets[b] = [];
          if (!buckets[b].some((x) => x.nama === it.nama)) {
            buckets[b].push(it);
          }
        }
      }
    }

    const res = [];
    for (const k of BAB_ORDER) {
      const list = buckets[k] || [];
      if (list.length > 0) {
        res.push({
          key: k,
          meta: BAB_META[k] || { label: 'Bab ' + k, icon: k, desc: '' },
          items: list
        });
      }
    }
    return res;
  }

  function render() {
    const P = $('panel'), g = result.groups;
    if (tab === 'catatan') {
      const babGroups = notesByBab();
      const totalNotes = babGroups.reduce((acc, bg) => acc + bg.items.length, 0);
      const totalMiss = babGroups.reduce((acc, bg) => acc + bg.items.filter((x) => x.status === 'miss').length, 0);

      if (!babGroups.length) {
        P.innerHTML = '<p>Tidak ada catatan. Semua kriteria yang dapat diperiksa otomatis sudah terpenuhi.</p>';
        return;
      }

      // Filter chips
      let filterBtnsHtml = '<button class="bab-filter-btn ' + (activeBabFilter === 'all' ? 'active' : '') + '" data-filter-bab="all">' +
        '<span>Semua Bab</span><span class="badge-pill">' + totalNotes + '</span></button>';

      babGroups.forEach((bg) => {
        const count = bg.items.length;
        const missCount = bg.items.filter((x) => x.status === 'miss').length;
        const isActive = activeBabFilter === bg.key;
        const labelShort = bg.key === 'awal' ? 'Bagian Awal' : bg.key === 'pustaka' ? 'Daftar Pustaka' : bg.key === 'lampiran' ? 'Lampiran' : bg.key === 'umum' ? 'Format' : 'Bab ' + bg.key;
        filterBtnsHtml += '<button class="bab-filter-btn ' + (isActive ? 'active' : '') + '" data-filter-bab="' + bg.key + '">' +
          '<span>' + labelShort + '</span>' +
          (missCount > 0 ? '<span class="badge-pill m" title="' + missCount + ' belum ada">' + missCount + '</span>' : '') +
          '<span class="badge-pill">' + count + '</span></button>';
      });

      const filterBarHtml = '<div class="bab-filter-container">' +
        '<div style="font-size:0.75rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em">Saring Catatan Berdasarkan Bab:</div>' +
        '<div class="bab-filter-bar">' + filterBtnsHtml + '</div>' +
      '</div>';

      // Render cards
      let cardsHtml = '<div class="bab-notes-list">';
      babGroups.forEach((bg) => {
        if (activeBabFilter !== 'all' && activeBabFilter !== bg.key) return;

        const missInBab = bg.items.filter((x) => x.status === 'miss').length;
        const warnInBab = bg.items.length - missInBab;
        const isB3 = bg.key === 'III';
        const isB4 = bg.key === 'IV';
        const cardHl = isB3 ? 'b-highlight-3' : isB4 ? 'b-highlight-4' : activeBabFilter === bg.key ? 'b-highlight-all' : '';
        const iconCls = isB3 ? 'b3' : isB4 ? 'b4' : '';

        cardsHtml += '<div class="bab-note-card ' + cardHl + '">' +
          '<div class="bab-note-card-header">' +
            '<div class="bab-note-card-title">' +
              '<div class="bab-icon-circle ' + iconCls + '">' + bg.meta.icon + '</div>' +
              '<div>' +
                '<h3>' + esc(bg.meta.label) + '</h3>' +
              '</div>' +
            '</div>' +
            '<div class="bab-note-counts">' +
              (missInBab ? '<span class="prop-badge miss">' + missInBab + ' belum ada</span>' : '') +
              (warnInBab ? '<span class="prop-badge warn">' + warnInBab + ' perlu dicek</span>' : '') +
            '</div>' +
          '</div>' +
          (bg.meta.desc ? '<div class="bab-subdesc">' + esc(bg.meta.desc) + '</div>' : '') +
          list(bg.items, null) +
        '</div>';
      });
      cardsHtml += '</div>';

      P.innerHTML = '<div class="notes-head">' +
        '<span class="count">' + totalNotes + ' catatan perbaikan: <b class="m">' + totalMiss + ' belum ada</b>, <b class="w">' + (totalNotes - totalMiss) + ' perlu dicek</b></span>' +
        '<button class="btn" id="copy">Salin catatan lengkap</button>' +
      '</div>' +
      filterBarHtml +
      cardsHtml;

      const c = $('copy'); if (c) c.addEventListener('click', copyNotes);

      // Bind filter buttons
      P.querySelectorAll('[data-filter-bab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeBabFilter = btn.dataset.filterBab;
          render();
        });
      });
    } else if (tab === 'sistematika') {
      const singleBanner = result.isSingleBab
        ? '<div style="margin-bottom:14px;padding:12px 16px;background:rgba(6,182,212,0.12);border:1px solid #06b6d4;border-radius:10px;font-size:.88rem;color:#0e7490;display:flex;align-items:center;gap:8px;">' +
          '<span style="font-size:1.1rem">🎯</span><span><b>Mode Periksa Sistematika Per Bab Aktif:</b> Mengevaluasi kelengkapan subbab khusus <b>Bab ' + ['I', 'II', 'III', 'IV', 'V'][result.singleBabNum - 1] + '</b> secara otomatis tanpa menuntut bab lain yang belum diunggah.</span></div>'
        : '';
      P.innerHTML = legend() + singleBanner + '<div class="babgrid">' + result.babResults.map((b) => {
        const ch = b.chapter;
        return '<div class="bab"><h4>' + esc(b.bab + ' ' + b.judulHarapan) + '</h4><div class="found">' +
          (ch ? 'Terbaca: ' + esc(ch.raw.slice(0, 60)) + ' · ' + fmt(ch.words) + ' kata' : '<span style="color:var(--miss)">Bab tidak ditemukan</span>') + '</div><ul>' +
          b.subs.map((s) => '<li class="l' + s.level + '">' + badge(s.status) + '<span>' + esc(s.nama) + (s.status !== 'ok' ? '<small>' + esc(s.detail) + '</small>' : '') + '</span></li>').join('') + '</ul></div>';
      }).join('') + '</div>' + list(g.sistematika.filter((x) => !x.sub), 'Bab dan bagian akhir') +
        '<p class="muted" style="font-size:.8rem;margin-top:12px">Acuan: sistematika ' + esc(R.JENIS[result.jenisId].label) + ', panduan hal. ' + esc(R.JENIS[result.jenisId].hal) + '.</p>';
    } else if (tab === 'koherensi') P.innerHTML = matrix() + list(g.koherensi, 'Pemeriksaan keterkaitan');
    else if (tab === 'perbab') { P.innerHTML = perBab(); bindPerBab(); }
    else if (tab === 'dimensi') P.innerHTML = dimensiTab();
    else if (tab === 'analisis') P.innerHTML = analisisTab();
    else if (tab === 'konsep') { P.innerHTML = konsepTab(); bindKonsep(); }
    else if (tab === 'ai') { P.innerHTML = aiTab(); bindAi(); }
    else if (tab === 'isi') P.innerHTML = legend() + list(g.isi, null, true);
    else if (tab === 'awal') P.innerHTML = legend() + list(g.awal, 'Bagian awal') + (g.lampiran.length ? list(g.lampiran, 'Lampiran') : '<p class="muted">Lampiran hanya diperiksa pada naskah lengkap.</p>');
    else if (tab === 'rujukan') P.innerHTML = legend() + distribusiBabTable(true) + list(g.kuantitas, 'Kuantitas kata') + list(g.rujukan, 'Rujukan & sitasi') + refLists();
    else if (tab === 'format') P.innerHTML = legend() + list(g.format, 'Format penulisan (hal. 3–4)');
    else P.innerHTML = outline();
  }

  function matrix() {
    const k = result.koherensi;
    if (!k || !k.rows.length) return '<p class="muted" style="margin-top:0">Matriks belum dapat dibuat: judul atau rumusan masalah (kalimat tanya di Bab I) tidak terbaca. Isi kolom Judul di panel kiri bila perlu.</p>';
    const head = '<tr><th scope="col">Unsur</th>' + k.cols.map((c, i) => '<th scope="col">' + c + '<small>' + colRole(i, k) + '</small></th>').join('') + '</tr>';
    const body = k.rows.map((r) => '<tr class="' + r.kind + '"><th scope="row">' + (r.kind === 'judul' ? '<span class="kind">Judul</span>' : '<span class="kind rm">Rumusan ' + (r.label.match(/^RM (\d+)/) || [, ''])[1] + '</span>') + esc(r.label.replace(/^RM \d+: /, '')) + '</th>' +
      r.cells.map((c) => '<td>' + badge(c.st) + (c.st !== 'na' ? '<small>' + Math.round(c.c * 100) + '%' + (c.where ? ' · ' + c.where : '') + '</small>' : '') + '</td>').join('') + '</tr>').join('');
    return '<p class="muted" style="margin-top:0">Setiap unsur judul dan setiap rumusan masalah dilacak ke tiap bab. Persentase = bagian istilah kuncinya yang ditemukan. Bab II dan hasil dinilai ketat: hijau jika istilahnya menjadi subjudul. Bab terakhir diperiksa pada bagian Simpulan.</p>' +
      legend() + '<div class="mx-wrap"><table class="mx">' + head + body + '</table></div>';
  }
  function colRole(i, k) {
    const kual = result.jenisId === 'kualitatif';
    if (i === k.lastIdx) return 'simpulan';
    return ['latar & rumusan', 'kajian pustaka', 'metodologi', kual ? 'hasil' : 'hasil & pembahasan', kual ? 'pembahasan' : 'simpulan', 'simpulan'][i] || '';
  }

  // Matriks umum: baris × kolom berisi sel { st, c, where }.
  function grid(cols, rows, first, cellText) {
    if (!rows.length) return '';
    return '<div class="mx-wrap"><table class="mx"><tr><th scope="col">' + esc(first) + '</th>' + cols.map((c) => '<th scope="col">' + esc(c) + '</th>').join('') + '</tr>' +
      rows.map((r) => '<tr><th scope="row">' + esc(r.label) + (r.src ? '<small>' + esc(r.src) + '</small>' : '') + '</th>' +
        r.cells.map((c) => '<td>' + badge(c.st) + (c.st !== 'na' && cellText ? '<small>' + esc(cellText(c)) + '</small>' : '') + '</td>').join('') + '</tr>').join('') + '</table></div>';
  }

  // ------------------------------------------------------- per bab
  const ROMAN_RE = /\bBab (VI|IV|V|I{1,3})\b/gi;
  function babOf(it, g) {
    if (g === 'awal') return ['awal'];
    if (g === 'rujukan') return ['pustaka'];
    if (g === 'lampiran') return ['lampiran'];
    if (g === 'format') return ['umum'];
    if (g === 'kuantitas' && /judul|abstra/i.test(it.nama)) return ['awal'];
    if (g === 'statistik') {
      const txt = ((it.nama || '') + ' ' + (it.lokasi || '')).toLowerCase();
      if (txt.includes('bab iii') && txt.includes('bab iv')) return ['III', 'IV'];
      if (txt.includes('bab iii')) return ['III'];
      return ['IV'];
    }
    if (g === 'tabel') {
      const txt = ((it.nama || '') + ' ' + (it.lokasi || '')).toLowerCase();
      if (/awal|lampiran/i.test(txt)) return ['awal'];
      return ['IV'];
    }
    const hits = new Set();
    const haystack = (it.nama || '') + ' ' + (it.lokasi || '') + ' ' + (it.detail || '');
    for (const m of haystack.matchAll(ROMAN_RE)) {
      hits.add(m[1].toUpperCase());
    }
    return hits.size ? [...hits] : ['umum'];
  }
  function miniBabDistribution() {
    const distList = result.distribusiBab || (R.DISTRIBUSI_BAB && R.DISTRIBUSI_BAB[result.tahap === 'proposal' ? 'proposal' : 'lengkap']) || [];
    if (!distList || !distList.length || !result.S.chapters.length) return '';
    const bodyWords = Math.max(1, result.bodyWords || 0);
    const jenjangId = result.jenjangId || 'tesis';

    const segments = distList.map((d) => {
      const ch = result.S.chapters.find((c) => c.num === d.num);
      const words = ch ? ch.words : 0;
      const pct = Math.round((words / bodyWords) * 100);
      const [kMin, kMax] = d[jenjangId] || [0, 0];
      const statusClass = !ch ? 'miss' : (words < kMin * 0.75 ? 'warn' : (words <= kMax * 1.25 ? 'ok' : 'info'));
      return '<div class="mini-bab-seg ' + statusClass + '" style="flex:' + Math.max(pct, 6) + '" title="Bab ' + d.rom + ' (' + esc(d.nama) + '): ' + fmt(words) + ' kata (' + pct + '% isi) · Target: ' + fmt(kMin) + '–' + fmt(kMax) + ' kata">' +
        '<span>Bab ' + d.rom + '</span><b>' + (words ? pct + '%' : '–') + '</b></div>';
    }).join('');

    return '<div class="mini-bab-wrap">' +
      '<div class="mini-bab-header">' +
        '<small>Distribusi Kata Per Bab vs Acuan</small>' +
        '<small class="mini-bab-legend"><span class="dot-legend ok"></span>Sesuai <span class="dot-legend warn"></span>Ringkas <span class="dot-legend info"></span>Mendalam <span class="dot-legend miss"></span>Belum Ada</small>' +
      '</div>' +
      '<div class="mini-bab-bar">' + segments + '</div>' +
    '</div>';
  }

  function distribusiBabTable(showNote) {
    const distList = result.distribusiBab || (R.DISTRIBUSI_BAB && R.DISTRIBUSI_BAB[result.tahap === 'proposal' ? 'proposal' : 'lengkap']) || [];
    if (!distList || !distList.length) return '';
    const jenjangId = result.jenjangId || 'tesis';
    const bodyWords = result.bodyWords || 0;
    const chapters = result.S.chapters || [];
    const isLeng = result.tahap !== 'proposal';

    let rowsHtml = '';
    distList.forEach((d) => {
      const ch = chapters.find((c) => c.num === d.num);
      const [kMin, kMax] = d[jenjangId] || [0, 0];
      const actualWords = ch ? ch.words : 0;
      const actualPct = bodyWords ? Math.round((actualWords / bodyWords) * 100) : 0;

      let badgeHtml = '';
      if (!ch) {
        badgeHtml = '<span class="prop-badge miss">Belum Terdeteksi</span>';
      } else if (actualWords < kMin * 0.75) {
        badgeHtml = '<span class="prop-badge warn">Terlalu Ringkas ⚠️</span>';
      } else if (actualWords >= kMin * 0.75 && actualWords <= kMax * 1.25) {
        badgeHtml = '<span class="prop-badge ok">Proporsional ✓</span>';
      } else {
        badgeHtml = '<span class="prop-badge info">Mendalam / Ekstensif</span>';
      }

      const barWidth = Math.min(100, Math.round((actualWords / Math.max(kMax, 1)) * 100));
      const barColor = actualWords < kMin * 0.75 ? 'var(--warn)' : actualWords <= kMax * 1.25 ? 'var(--ok)' : 'var(--info)';

      rowsHtml += '<tr>' +
        '<td style="font-weight:900;color:var(--navy);white-space:nowrap;font-size:0.92rem">Bab ' + d.rom + '</td>' +
        '<td>' +
          '<div style="font-weight:800;color:var(--ink)">' + esc(d.nama) + '</div>' +
          '<small style="color:var(--muted);font-size:0.75rem;display:block;margin-top:3px;line-height:1.4">' + esc(d.deskripsi) + '</small>' +
        '</td>' +
        '<td style="text-align:center;font-weight:800;color:var(--navy);white-space:nowrap">' +
          d.pct[0] + '% – ' + d.pct[1] + '%' +
          '<small style="color:var(--muted);font-weight:400;display:block">ideal: ±' + d.idealPct + '%</small>' +
        '</td>' +
        '<td style="text-align:center;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap">' +
          fmt(kMin) + ' – ' + fmt(kMax) +
          '<small style="color:var(--muted);font-weight:400;display:block">kata</small>' +
        '</td>' +
        '<td style="text-align:center;font-variant-numeric:tabular-nums;min-width:130px">' +
          (ch ? '<b style="font-size:0.95rem;color:var(--navy)">' + fmt(actualWords) + ' kata</b><br><span style="font-size:0.78rem;font-weight:800;color:var(--accent)">(' + actualPct + '% dari isi)</span>' : '<span style="color:var(--muted)">–</span>') +
          (ch ? '<div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin-top:5px" title="' + actualPct + '% dari total isi"><div style="height:100%;width:' + barWidth + '%;background:' + barColor + ';border-radius:3px"></div></div>' : '') +
        '</td>' +
        '<td style="text-align:center;white-space:nowrap">' + badgeHtml + '</td>' +
      '</tr>';
    });

    const noteHtml = showNote ? (
      '<div class="guide-box-callout">' +
        '<div style="display:flex;align-items:flex-start;gap:12px">' +
          '<div style="font-size:1.4rem;line-height:1;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;width:34px;height:34px;border-radius:8px;display:grid;place-items:center;flex:none">📚</div>' +
          '<div>' +
            '<b style="font-size:0.88rem;color:var(--navy)">Ketentuan Resmi Buku Panduan Pascasarjana UNJ 2025 (hal. 2):</b>' +
            '<div style="margin:6px 0 0;font-size:0.82rem;color:#334155;line-height:1.6">' +
              '<div>• <b>Ketentuan Total Kata Isi (Bab I–V):</b> ' + (jenjangId === 'tesis' ? 'Tesis S2 (30.000 – 50.000 kata)' : 'Disertasi S3 (50.000 – 80.000 kata)') + ' untuk naskah lengkap, atau 15.000 – 20.000 kata untuk naskah proposal (di luar bagian awal &amp; lampiran).</div>' +
              '<div>• <b>Proporsi Pembahasan (Bab IV):</b> Panduan mewajibkan porsi pembahasan berkisar <b>±40% dari total isi naskah</b>.</div>' +
              '<div>• <b>Mengapa per bab berupa rentang rekomendasi?</b> Panduan sengaja tidak mengunci angka kaku per bab agar metodologi (kuantitatif, kualitatif, R&amp;D) tetap leluasa. Namun secara konvensi akademik pascasarjana, naskah tidak boleh timpang sehingga proporsi Bab I (10–15%), Bab II (20–25%), Bab III (10–15%), Bab IV (40–45%), dan Bab V (5–8%) menjadi acuan keseimbangan yang sehat.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    ) : '';

    return '<div class="distribusi-card">' +
      '<div class="distribusi-head">' +
        '<div>' +
          '<span class="eyebrow" style="margin-bottom:6px"><i></i> Pedoman Proporsi &amp; Distribusi Kata Per Bab</span>' +
          '<h3 style="font-size:1.05rem;font-weight:900;color:var(--navy);margin:2px 0 0">Distribusi Estimasi Kata Per Bab (' + (jenjangId === 'tesis' ? 'Tesis S2' : 'Disertasi S3') + ' · ' + (isLeng ? 'Naskah Lengkap' : 'Proposal') + ')</h3>' +
        '</div>' +
        '<div style="text-align:right" class="distribusi-target">' +
          '<span style="font-size:0.74rem;color:var(--muted);text-transform:uppercase;font-weight:700">Target Total Isi Naskah:</span><br>' +
          '<b style="font-size:0.95rem;color:var(--accent)">' + (isLeng ? (jenjangId === 'tesis' ? '30.000 – 50.000 kata' : '50.000 – 80.000 kata') : '15.000 – 20.000 kata') + '</b>' +
        '</div>' +
      '</div>' +
      '<div class="mx-wrap" style="margin-top:12px">' +
        '<table class="mx bab-table-dist">' +
          '<thead>' +
            '<tr>' +
              '<th scope="col" style="width:75px">Bab</th>' +
              '<th scope="col">Fokus &amp; Nama Bab</th>' +
              '<th scope="col" style="text-align:center;width:125px">Proporsi Acuan</th>' +
              '<th scope="col" style="text-align:center;width:140px">Target Rekomendasi</th>' +
              '<th scope="col" style="text-align:center;width:160px">Realisasi Naskah</th>' +
              '<th scope="col" style="text-align:center;width:145px">Status Proporsi</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>' +
      noteHtml +
    '</div>';
  }

  function perBab() {
    const L = result.lanjut || {};
    const buckets = {};
    for (const [g, items] of Object.entries(result.groups)) for (const it of items) for (const k of babOf(it, g)) (buckets[k] = buckets[k] || []).push(it);
    const sections = [['awal', 'Bagian awal', null]];
    for (const pb of L.perBab || []) sections.push([['', 'I', 'II', 'III', 'IV', 'V', 'VI'][pb.num], pb.label + (pb.judul ? ' · ' + pb.judul : ''), pb]);
    sections.push(['pustaka', 'Daftar pustaka', null], ['lampiran', 'Lampiran', null], ['umum', 'Umum (seluruh naskah & format)', null]);

    const distList = result.distribusiBab || (R.DISTRIBUSI_BAB && R.DISTRIBUSI_BAB[result.tahap === 'proposal' ? 'proposal' : 'lengkap']) || [];
    const stats = (pb) => {
      const dist = distList.find((d) => d.num === pb.num);
      const [kMin, kMax] = dist ? (dist[result.jenjangId || 'tesis'] || [0, 0]) : [0, 0];
      const targetStr = kMin ? (fmt(kMin) + '–' + fmt(kMax) + ' kata (' + dist.pct[0] + '%–' + dist.pct[1] + '%)') : '–';
      let statusBadge = '';
      if (kMin) {
        if (pb.words < kMin * 0.75) statusBadge = '<span class="prop-badge warn" style="margin-left:6px;font-size:0.65rem">Ringkas ⚠️</span>';
        else if (pb.words <= kMax * 1.25) statusBadge = '<span class="prop-badge ok" style="margin-left:6px;font-size:0.65rem">Proporsional ✓</span>';
        else statusBadge = '<span class="prop-badge info" style="margin-left:6px;font-size:0.65rem">Mendalam</span>';
      }
      return '<div class="babstats">' + [
        ['Kata Naskah', fmt(pb.words) + ' (' + pb.pct + '%) ' + statusBadge],
        ['Target Rekomendasi', targetStr],
        ['Subjudul', pb.headings],
        ['Tabel', pb.tabel],
        ['Gambar', pb.gambar],
        ['Sitasi', pb.sitasi + ' (' + pb.sitasiUnik + ' unik)'],
        ['Sitasi / 1.000 kata', String(pb.per1000).replace('.', ',')]
      ].map(([k, v]) => '<span><small>' + k + '</small><b>' + v + '</b></span>').join('') + '</div>';
    };

    babCopy = {};
    return '<div class="howto"><b>Cara memakai tab ini</b><ol><li>Baca catatan tiap bab; yang <b>Belum ada</b> paling penting.</li><li>Klik <b>Salin catatan bab</b> untuk menempel daftar revisi ke Word/WhatsApp, atau <b>Salin prompt AI</b> lalu tempel (Ctrl+V) di Gemini/ChatGPT untuk telaah isi bab.</li><li>Jawaban AI dapat ditempel di tab <b>Masukan AI</b> agar ikut ke laporan unduhan.</li></ol></div>' +
      distribusiBabTable(true) +
      legend() +
      sections.map(([k, title, pb]) => {
        const items = buckets[k] || [];
        if (!items.length && !pb) return '';
        const bad = items.filter((x) => x.status === 'miss' || x.status === 'warn').sort((a, b) => (a.status === 'miss' ? 0 : 1) - (b.status === 'miss' ? 0 : 1));
        const good = items.filter((x) => !(x.status === 'miss' || x.status === 'warn'));
        const nm = bad.filter((x) => x.status === 'miss').length;
        babCopy[k] = { title, bad, pb };
        return '<section class="babsec"><div class="babhead"><h3>' + esc(title) + '</h3><span class="count">' + (bad.length ? '<b class="m">' + nm + ' belum ada</b> · <b class="w">' + (bad.length - nm) + ' perlu dicek</b>' : '<b style="color:var(--ok)">Tidak ada catatan</b>') + '</span></div>' +
          '<div class="copyrow"><button class="btn" data-copy-bab="' + esc(k) + '">Salin catatan bab</button>' + (pb ? '<button class="btn primary" data-copy-ai="' + pb.num + '">Salin prompt AI bab ini</button>' : '') + '</div>' +
          (pb ? stats(pb) : '') + list(bad, null) +
          (good.length ? '<details class="list"><summary>' + good.length + ' kriteria sesuai / info</summary>' + list(good, null) + '</details>' : '') + '</section>';
      }).join('');
  }
  let babCopy = {};
  function babText(k) {
    const s = babCopy[k];
    let t = 'CATATAN REVISI — ' + s.title.toUpperCase() + '\n' + (user ? user.nama + ' <' + user.email + '>\n' : '') + 'Berkas: ' + fileName + '\n';
    if (s.pb) t += 'Statistik: ' + fmt(s.pb.words) + ' kata (' + s.pb.pct + '% isi), ' + s.pb.headings + ' subjudul, ' + s.pb.tabel + ' tabel, ' + s.pb.gambar + ' gambar, ' + s.pb.sitasi + ' sitasi\n';
    if (!s.bad.length) return t + '\nTidak ada catatan perbaikan untuk bagian ini.\n';
    s.bad.forEach((it, i) => { t += '\n' + (i + 1) + '. [' + LABEL[it.status] + '] ' + it.nama + '\n   Temuan: ' + it.detail + (it.saran ? '\n   Saran: ' + it.saran : '') + (it.hal ? '\n   Panduan hal. ' + it.hal : '') + '\n   [ ] Sudah direvisi\n'; });
    return t;
  }
  function bindPerBab() {
    document.querySelectorAll('[data-copy-bab]').forEach((b) => b.addEventListener('click', () => copyText(babText(b.dataset.copyBab), b, 'Salin catatan bab')));
    document.querySelectorAll('[data-copy-ai]').forEach((b) => b.addEventListener('click', () => {
      const prev = ai.scope; ai.scope = 'bab' + b.dataset.copyAi;
      const p = buildPrompt(); ai.scope = prev;
      copyText(p, b, 'Salin prompt AI bab ini');
    }));
  }

  // ------------------------------------------- dimensi & paradigma
  function dimensiTab() {
    const L = result.lanjut || {}, g = result.groups;
    let h = '<h3>Dimensi konseptual</h3><p class="muted">Dimensi diambil dari subjudul "Dimensi …" atau kalimat "terdiri atas n dimensi, yaitu …" di Bab II/III, lalu dilacak ke definisi operasional, tabel kisi-kisi, hasil, dan simpulan.</p>';
    if (L.dimensi && L.dimensi.rows.length) h += legend() + grid(L.dimensi.cols, L.dimensi.rows, 'Dimensi', (c) => (c.st === 'ok' ? 'tampak' : Math.round(c.c * 100) + '% kata'));
    h += list(g.dimensi, null);
    h += '<h3>Paradigma, pendekatan, dan grand theory</h3>';
    if (L.paradigma) h += '<div class="chips">' + (L.paradigma.stated.length ? L.paradigma.stated.map((p) => '<span class="chip">' + esc(p.label) + ' · ' + p.n + '×</span>').join('') : '<span class="chip">Paradigma tidak disebut</span>') + '<span class="chip">Pendekatan: ' + esc(L.paradigma.pendekatan) + '</span></div>';
    h += list(g.paradigma, null);
    if (L.teori && L.teori.rows.length) h += '<h3>Penggunaan teori per bab</h3><p class="muted">Hijau: teori menjadi subjudul atau disebut ≥ 3 kali di bab itu. Panduan hal. 26–29 meminta teori acuan tampak sejak das sollen di latar belakang hingga pembahasan.</p>' + grid(L.teori.cols, L.teori.rows, 'Teori', (c) => c.where || '');
    return h;
  }

  // ----------------------------------------- analisis data & tabel
  function analisisTab() {
    const L = result.lanjut || {}, g = result.groups;
    let h = '<h3>Teknik analisis: Bab III ↔ hasil</h3>';
    if (L.teknik && L.teknik.length) h += '<div class="mx-wrap"><table class="mx"><tr><th>Teknik</th><th>Bab III (rencana)</th><th>Hasil (dilaksanakan)</th></tr>' + L.teknik.map((t) => '<tr><th scope="row">' + esc(t.nama) + '</th><td>' + badge(t.b3 ? 'ok' : 'miss') + '</td><td>' + badge(t.b4 ? 'ok' : 'miss') + '</td></tr>').join('') + '</table></div>';
    else h += '<p class="muted">Hanya diperiksa pada naskah lengkap.</p>';
    h += '<h3>Nilai statistik yang dilaporkan ↔ kriteria buku acuan</h3><p class="muted">Nilai dibaca dari teks dan tabel hasil dengan pola seperti "CFI = 0,95" atau kolom tabel berjudul CFI/RMSEA/MNSQ. Angka yang didahului ≥, ≤, "minimal", atau "kriteria" dianggap kriteria, bukan hasil.</p>';
    if (L.stat && L.stat.length) h += '<div class="mx-wrap"><table class="mx"><tr><th>Indeks</th><th>Nilai terbaca</th><th>Kriteria</th><th>Sumber</th></tr>' + L.stat.map((s) => '<tr><th scope="row">' + badge(s.status) + ' ' + esc(s.nama) + '</th><td style="text-align:left">' + esc(s.nilai.slice(0, 12).join('; ') + (s.nilai.length > 12 ? '; … (' + s.nilai.length + ' nilai)' : '')) + '</td><td style="text-align:left">' + esc(s.kriteria) + '</td><td style="text-align:left"><small>' + esc(s.sumber) + '</small></td></tr>').join('') + '</table></div>';
    h += list(g.statistik, null);
    h += '<h3>Tabel dan gambar</h3>' + list(g.tabel, null);
    const T = L.tabel;
    if (T && T.mismatch && T.mismatch.length) h += '<details class="list" open><summary>Angka di teks yang tidak ditemukan di tabel yang dirujuk (' + T.mismatch.length + ')</summary><ul>' + T.mismatch.map((m) => '<li>' + esc(m) + '</li>').join('') + '</ul><p class="muted" style="font-size:.78rem">Bisa berupa salah kutip, pembulatan berbeda, salah nomor tabel, atau angka kriteria. Periksa satu per satu.</p></details>';
    if (T && T.caps && T.caps.length) h += '<details class="list"><summary>Daftar tabel & gambar terbaca (' + T.caps.length + ')</summary><ul>' + T.caps.map((c) => '<li>' + esc(c.id) + ' — ' + esc(c.judul.slice(0, 90)) + ' · dirujuk ' + c.disebut + '×</li>').join('') + '</ul></details>';
    return h;
  }

  // ----------------------------------------- konsep penyajian monograf
  function konsepTab() {
    const jenjangLabel = (result.jenjangId || 'disertasi').toUpperCase();
    const jenisLabel = (R.JENIS[result.jenisId] && R.JENIS[result.jenisId].label) || result.jenisId;
    const bodyWordsFmt = fmt(result.bodyWords || 0);

    let h = '';

    // 1. Banner
    h += '<div class="konsep-banner">' +
      '<h3>🎓 Konsep Penyajian Monograf Disertasi & Tesis</h3>' +
      '<p>Pedoman arsitektur penulisan monograf tingkat lanjut (Standar Doktoral Pascasarjana UNJ 2025 & Scopus Q1/Sinta 1). Fokus pada kekuatan argumen (<i>funneling</i>), sintesis literatur anti-parade, rigor metodologis, dan konsistensi benang merah penelitian (<i>The Golden Thread</i>).</p>' +
      '</div>';

    // 2. Real-time Diagnostic on Current Upload
    h += '<div class="konsep-section-title">' +
      '<span>📊 Diagnostik Real-Time Naskah Aktif</span>' +
      '<span style="font-size:0.8rem;font-weight:600;color:var(--muted)">Terbaca otomatis dari file yang sedang dianalisis</span>' +
      '</div>';

    h += '<div class="konsep-live-box">' +
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:12px;">' +
        '<div><strong>Judul:</strong> ' + esc(result.title || 'Belum terdeteksi di lembar judul') + '</div>' +
        '<div><span class="konsep-tag">' + esc(jenjangLabel) + '</span><span class="konsep-tag">' + esc(jenisLabel) + '</span><span class="konsep-tag">' + esc((result.tahap || 'lengkap').toUpperCase()) + '</span><span class="konsep-tag">' + bodyWordsFmt + ' Kata Batang Tubuh</span></div>' +
      '</div>' +
      distribusiBabTable(true) +
      '</div>';

    // 3. 5 Pillars Architecture
    h += '<div class="konsep-section-title">' +
      '<span>🏛️ 5 Pilar Arsitektur & Penyajian Ilmiah Monograf</span>' +
      '</div>';

    h += '<div class="konsep-pillar-grid">' +
      '<div class="konsep-pillar">' +
        '<h4><span>Pilar 1</span> Pendahuluan & Funneling Argumentatif (Bab I)</h4>' +
        '<p>Struktur piramida terbalik (Makro &rarr; Meso &rarr; Mikro). Dimulai dari tren/urgensi global, didukung data statistik empiris terkini, identifikasi <i>research gap</i> (kesenjangan pengetahuan), urgensi masalah, hingga perumusan <i>research questions</i> yang spesifik dan operasional.</p>' +
        '<div><span class="konsep-tag">Funneling Logic</span><span class="konsep-tag">Empirical Gap</span><span class="konsep-tag">Clear Research Questions</span></div>' +
      '</div>' +
      '<div class="konsep-pillar">' +
        '<h4><span>Pilar 2</span> Kajian Pustaka & Anti-Parade Synthesis (Bab II)</h4>' +
        '<p><b>Bukan parade kliping nama pengarang</b> (menolak pola monoton "A menyatakan X. B menyatakan Y"). Wajib berbentuk sintesis tematik konseptual integratif, memetakan kontradiksi temuan terdahulu (<i>State-of-the-Art</i>), dan merumuskan kerangka alur pikir (<i>conceptual framework</i>) yang kokoh.</p>' +
        '<div><span class="konsep-tag">Anti-Parade Rhetoric</span><span class="konsep-tag">State-of-the-Art (SotA)</span><span class="konsep-tag">Kerangka Konseptual</span></div>' +
      '</div>' +
      '<div class="konsep-pillar">' +
        '<h4><span>Pilar 3</span> Metodologi & Epistemological Rigor (Bab III)</h4>' +
        '<p>Justifikasi epistemologis pemilihan paradigma dan desain penelitian. Kalibrasi instrumen yang teruji (validitas isi pakar, kalibrasi Rasch/CFA, reliabilitas komposit, atau keabsahan triangulasi data kualitatif), serta transparansi alur analisis data yang dapat direplikasi (<i>reproducibility</i>).</p>' +
        '<div><span class="konsep-tag">Epistemological Justification</span><span class="konsep-tag">Psychometric/Method Rigor</span><span class="konsep-tag">Reproducible Protocol</span></div>' +
      '</div>' +
      '<div class="konsep-pillar">' +
        '<h4><span>Pilar 4</span> Penyajian Temuan Bersih Standar APA 7 (Bab IV)</h4>' +
        '<p>Tabel disajikan bersih sesuai APA 7th Edition (tanpa garis batas vertikal, 3 garis horizontal utama, angka terbaca jelas). Penyajian temuan menjawab rumusan masalah secara berurutan, mengintegrasikan visualisasi bermakna serta kutipan bukti data lapangan yang transparan.</p>' +
        '<div><span class="konsep-tag">APA 7th Clean Tables</span><span class="konsep-tag">Sequential Answering</span><span class="konsep-tag">Triangulated Evidence</span></div>' +
      '</div>' +
      '<div class="konsep-pillar" style="grid-column: 1 / -1">' +
        '<h4><span>Pilar 5</span> Pembahasan Mendalam, Novelty & Implikasi (Bab IV/V)</h4>' +
        '<p>Menjawab pertanyaan <b>"So What?"</b>. Tidak sekadar mengulang angka hasil statistik atau deskripsi kualitatif, melainkan mengonfrontasi temuan dengan literatur global bereputasi (sejalan vs berlawanan beserta argumentasi dialektisnya), mengkristalisasi <b>kebaruan (novelty)</b>, dan merumuskan implikasi teoretis, praktis, serta rekomendasi kebijakan.</p>' +
        '<div><span class="konsep-tag">The "So What?" Question</span><span class="konsep-tag">International Literature Dialogue</span><span class="konsep-tag">Novelty Articulation</span><span class="konsep-tag">Policy & Practical Implications</span></div>' +
      '</div>' +
    '</div>';

    // 4. Matriks Benang Merah (The Golden Thread Alignment)
    h += '<div class="konsep-section-title">' +
      '<span>🧶 Matriks Benang Merah (The Golden Thread Alignment)</span>' +
      '<button type="button" class="konsep-copy-btn" id="btnCopyGoldenThread">📋 Salin Format Matriks Markdown</button>' +
      '</div>';

    h += '<p class="muted" style="margin-top:0">Setiap rumusan masalah harus memiliki tautan lurus 1:1 tanpa deviasi menuju landasan teori, instrumen metodologi, sajian temuan, dan bahasan novelty.</p>' +
      '<div class="mx-wrap"><table class="mx">' +
      '<thead><tr><th>No</th><th>Rumusan Masalah (Bab I)</th><th>Tujuan Penelitian</th><th>Konstruk Teori (Bab II)</th><th>Instrumen & Analisis (Bab III)</th><th>Temuan Utama (Bab IV)</th><th>Pembahasan & Novelty (Bab IV/V)</th></tr></thead>' +
      '<tbody>' +
      '<tr><td>1</td><td>Sejauh mana efektivitas model X terhadap kompetensi Y?</td><td>Menganalisis efektivitas model X terhadap peningkatan kompetensi Y.</td><td>Teori Konstruktivisme Sosial, Taksonomi Hasil Belajar, Indikator Kompetensi Y.</td><td>Kuesioner skala Likert terkalibrasi Rasch Model, Uji Wilcoxon/t-test.</td><td>Peningkatan signifikan skor kompetensi Y (p &lt; .001, effect size d = 0.82).</td><td>Mengonfirmasi teori Z dan melengkapi keterbatasan riset Smith (2023) dalam konteks blended.</td></tr>' +
      '<tr><td>2</td><td>Bagaimana dinamika interaksi partisipan dalam mengadopsi model X?</td><td>Mendeskripsikan dinamika interaksi partisipan selama implementasi model X.</td><td>Model Difusi Inovasi (Rogers), Kerangka Interaksi Kolaboratif.</td><td>Wawancara semi-terstruktur, observasi partisipatif berkode tematik.</td><td>Teridentifikasi 3 fase adaptasi: <i>hesitation, scaffolding, autonomous mastery</i>.</td><td>Menghasilkan proposisi baru mengenai pentingnya mediasi mentor dalam mitigasi resistensi.</td></tr>' +
      '</tbody></table></div>';

    // 5. Bank Frasa Akademik Doktoral (Academic Phrasebank / Sentence Stems)
    h += '<div class="konsep-section-title">' +
      '<span>✍️ Bank Frasa Akademik Doktoral (Sentence Stems Terkalibrasi)</span>' +
      '</div>';

    const stems = [
      {
        kategori: '1. Merumuskan Kesenjangan Penelitian (Establishing a Niche)',
        en: 'While extensive literature has examined [Topic X], empirical investigations regarding [Topic Y] in the context of [Context Z] remain conspicuously scarce.',
        id: 'Meskipun literatur terdahulu telah banyak menelaah [Topik X], investigasi empiris mengenai [Topik Y] dalam konteks [Konteks Z] masih sangat terbatas dan belum terpetakan secara komprehensif.'
      },
      {
        kategori: '2. Sintesis Pustaka Konseptual Anti-Parade (Thematic Synthesis)',
        en: 'A critical synthesis of recent scholarship reveals a theoretical divergence between [Perspective A] (e.g., Author, 2022) and [Perspective B] (e.g., Author, 2024), particularly concerning [Core Mechanism].',
        id: 'Sintesis kritis terhadap literatur terkini mengungkap divergensi teoretis antara [Perspektif A] dan [Perspektif B], khususnya terkait mekanisme fundamental [Mekanisme Kunci].'
      },
      {
        kategori: '3. Mengartikulasikan Kebaruan & Kontribusi (Articulating Novelty)',
        en: 'The primary theoretical contribution of this monograph lies in bridging the conceptual gap between [Construct 1] and [Construct 2], providing a validated structural model previously unaddressed in the literature.',
        id: 'Kontribusi teoretis utama monograf ini terletak pada penjembatanan kesenjangan konseptual antara [Konstruk 1] dan [Konstruk 2], menghasilkan model struktural terverifikasi yang sebelumnya belum terjawab dalam literatur.'
      },
      {
        kategori: '4. Membahas Temuan Tidak Terduga / Kontradiktif (Dialectical Discussion)',
        en: 'Contrary to initial hypotheses and earlier findings by [Author (Year)], the present analysis indicates that [Finding]. This discrepancy can plausibly be attributed to [Contextual/Methodological Factor].',
        id: 'Berlawanan dengan hipotesis awal dan temuan terdahulu oleh [Peneliti (Tahun)], analisis riset ini mengindikasikan bahwa [Temuan]. Diskrepansi ini dapat dijelaskan secara rasional melalui faktor [Konteks/Metodologis].'
      },
      {
        kategori: '5. Menegaskan Implikasi Praktis & Rekomendasi Kebijakan (Practical Implications)',
        en: 'Beyond theoretical advancement, these empirical insights offer actionable blueprints for policy makers and practitioners seeking to optimize [Target Outcome] through [Intervention].',
        id: 'Di luar kemajuan teoretis, wawasan empiris ini menawarkan cetak biru aplikatif bagi para pengambil kebijakan dan praktisi untuk mengoptimalkan [Target Luaran] melalui [Bentuk Intervensi].'
      }
    ];

    stems.forEach((s, idx) => {
      h += '<div class="konsep-stem-card">' +
        '<div class="konsep-stem-header">' +
          '<span class="konsep-stem-title">' + esc(s.kategori) + '</span>' +
          '<button type="button" class="konsep-copy-btn btn-copy-stem" data-stem-idx="' + idx + '">📋 Salin Frasa</button>' +
        '</div>' +
        '<div class="konsep-stem-en">“' + esc(s.en) + '”</div>' +
        '<div class="konsep-stem-id"><b>Padanan Bahasa Indonesia:</b> ' + esc(s.id) + '</div>' +
      '</div>';
    });

    // 6. Tombol Salin Seluruh Blueprint
    h += '<div style="margin-top:24px;text-align:center;">' +
      '<button type="button" class="btn primary" id="btnCopyMonografBlueprint" style="padding:10px 24px;font-size:0.95rem;font-weight:800;">📑 Salin Seluruh Kerangka & Blueprint Monograf (Markdown)</button>' +
      '</div>';

    return h;
  }

  function bindKonsep() {
    const btnGT = $('btnCopyGoldenThread');
    if (btnGT) {
      btnGT.addEventListener('click', () => {
        const text = '| No | Rumusan Masalah (Bab I) | Tujuan Penelitian | Landasan Teori (Bab II) | Metode & Instrumen (Bab III) | Temuan Utama (Bab IV) | Pembahasan & Kebaruan (Bab IV/V) |\n' +
          '|---|---|---|---|---|---|---|\n' +
          '| 1 | [Tuliskan Rumusan Masalah 1] | [Tuliskan Tujuan 1] | [Konstruk & Teori Rujukan] | [Desain, Populasi/Sampel, Uji Validitas] | [Temuan Kunci / Angka / Tema] | [Konfirmasi Literatur & Novelty] |\n' +
          '| 2 | [Tuliskan Rumusan Masalah 2] | [Tuliskan Tujuan 2] | [Konstruk & Teori Rujukan] | [Desain, Populasi/Sampel, Uji Validitas] | [Temuan Kunci / Angka / Tema] | [Konfirmasi Literatur & Novelty] |\n';
        navigator.clipboard.writeText(text).then(() => {
          btnGT.textContent = '✓ Format Tersalin!';
          setTimeout(() => { btnGT.textContent = '📋 Salin Format Matriks Markdown'; }, 2000);
        });
      });
    }

    document.querySelectorAll('.btn-copy-stem').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.konsep-stem-card');
        if (!card) return;
        const en = card.querySelector('.konsep-stem-en') ? card.querySelector('.konsep-stem-en').textContent : '';
        const id = card.querySelector('.konsep-stem-id') ? card.querySelector('.konsep-stem-id').textContent : '';
        const textToCopy = en.replace(/^“|”$/g, '') + '\n\n' + id;
        navigator.clipboard.writeText(textToCopy).then(() => {
          const oldText = btn.textContent;
          btn.textContent = '✓ Tersalin!';
          setTimeout(() => { btn.textContent = oldText; }, 2000);
        });
      });
    });

    const btnBP = $('btnCopyMonografBlueprint');
    if (btnBP) {
      btnBP.addEventListener('click', () => {
        const title = result.title || 'JUDUL DISERTASI / TESIS';
        const jenjang = (result.jenjangId || 'disertasi').toUpperCase();
        const jenis = (R.JENIS[result.jenisId] && R.JENIS[result.jenisId].label) || 'Kuantitatif / Kualitatif';
        const bp = '# BLUEPRINT & ARSITEKTUR MONOGRAF ' + jenjang + '\n' +
          'Judul: ' + title + '\n' +
          'Jenis Pendekatan: ' + jenis + '\n' +
          'Pedoman: Standar Pascasarjana UNJ 2025 & Scopus Q1\n\n' +
          '---\n\n' +
          '## BAB I: PENDAHULUAN (Funneling Argumentatif)\n' +
          '- **1.1 Latar Belakang Masalah**:\n' +
          '  * Makro: Tantangan global, data tren, urgensi konseptual.\n' +
          '  * Meso: Kebijakan nasional, realitas empiris di Indonesia.\n' +
          '  * Mikro: Kesenjangan spesifik lapangan dan kesenjangan riset terdahulu (Research Gap).\n' +
          '- **1.2 Identifikasi & Pembatasan Masalah**\n' +
          '- **1.3 Rumusan Masalah (Research Questions)**: Disusun terfokus dan bernomor.\n' +
          '- **1.4 Tujuan Penelitian**: Koheren 1:1 dengan rumusan masalah.\n' +
          '- **1.5 Manfaat / Signifikansi Penelitian**: Teoretis, praktis, dan kebijakan.\n\n' +
          '## BAB II: KAJIAN TEORI & KERANGKA KONSEPTUAL (Anti-Parade)\n' +
          '- **2.1 Kajian Teori Konstruk/Variabel Utama**: Sintesis integratif tematik (bukan kliping pengarang).\n' +
          '- **2.2 State-of-the-Art & Penelitian Terkait**: Matriks komparasi riset internasional 5 tahun terakhir.\n' +
          '- **2.3 Kerangka Alur Pikir / Konseptual**: Diagram hubungan konstruk yang dilengkapi premis ilmiah.\n' +
          '- **2.4 Hipotesis Penelitian / Pertanyaan Pengarah**\n\n' +
          '## BAB III: METODOLOGI PENELITIAN (Epistemological Rigor)\n' +
          '- **3.1 Desain & Pendekatan Penelitian**: Justifikasi epistemologis desain yang dipilih.\n' +
          '- **3.2 Subjek / Populasi & Sampel**: Teknik penarikan, kriteria inklusi & eksklusi.\n' +
          '- **3.3 Pengembangan & Validasi Instrumen**: Validitas isi pakar, kalibrasi Rasch/CFA/reliabilitas.\n' +
          '- **3.4 Prosedur Pengumpulan Data & Etika Penelitian**\n' +
          '- **3.5 Teknik Analisis Data**: Protokol analisis data yang transparan dan dapat direplikasi.\n\n' +
          '## BAB IV: HASIL & PEMBAHASAN (APA 7 & Novelty)\n' +
          '- **4.1 Deskripsi Data & Uji Prasyarat**\n' +
          '- **4.2 Penyajian Temuan Penelitian**: Tabel bersih APA 7th, runut menjawab tiap rumusan masalah.\n' +
          '- **4.3 Pembahasan Mendalam (The So What Question)**:\n' +
          '  * Makna substantif temuan.\n' +
          '  * Dialog dengan literatur global (mengonfirmasi atau membantah temuan terdahulu).\n' +
          '  * Artikulasi Novelty (Kebaruan Teoretis/Model/Praksis).\n' +
          '- **4.4 Keterbatasan Penelitian**\n\n' +
          '## BAB V: PENUTUP\n' +
          '- **5.1 Simpulan**: Menjawab tuntas seluruh rumusan masalah tanpa repetisi angka statistik mentah.\n' +
          '- **5.2 Implikasi**: Teoretis, metodologis, dan manajerial.\n' +
          '- **5.3 Saran / Rekomendasi Terapan**\n';
        navigator.clipboard.writeText(bp).then(() => {
          btnBP.textContent = '✓ Blueprint Berhasil Disalin ke Clipboard!';
          setTimeout(() => { btnBP.textContent = '📑 Salin Seluruh Kerangka & Blueprint Monograf (Markdown)'; }, 2500);
        });
      });
    }
  }

  function refLists() {
    const ri = result.refInfo; let h = '';
    if (ri.missingRef && ri.missingRef.length) h += '<details class="list"><summary>Sitasi tanpa entri daftar pustaka (' + ri.missingRef.length + ')</summary><ul>' + ri.missingRef.map((c) => '<li>' + esc(c.raw) + '</li>').join('') + '</ul></details>';
    if (ri.draft && ri.draft.length) h += '<details class="list" open><summary>Entri pustaka yang belum lengkap (' + ri.draft.length + ')</summary><ul>' + ri.draft.map((r) => '<li>' + esc(r.text.slice(0, 200)) + '</li>').join('') + '</ul></details>';
    if (ri.uncited && ri.uncited.length) h += '<details class="list"><summary>Entri pustaka yang tidak disitasi (' + ri.uncited.length + ')</summary><ul>' + ri.uncited.map((r) => '<li>' + esc(r.text.slice(0, 160)) + '</li>').join('') + '</ul></details>';
    if (ri.refs.length) h += '<details class="list"><summary>Seluruh entri pustaka terbaca (' + ri.refs.length + ')</summary><ul>' + ri.refs.map((r) => '<li>[' + (r.isJournal ? 'Jurnal' : r.isBook ? 'Buku' : 'Lain') + ', ' + (r.year || '?') + '] ' + esc(r.text.slice(0, 180)) + '</li>').join('') + '</ul></details>';
    return h;
  }

  function outline() {
    const S = result.S, out = [];
    S.chapters.forEach((c) => {
      out.push('<div class="ch">' + esc(c.raw + (c.titleIdx !== c.idx ? ' ' + parsed.blocks[c.titleIdx].text : '')) + ' <span class="muted">· ' + fmt(c.words) + ' kata</span></div>');
      for (const h of c.headings) out.push('<div style="padding-left:' + (h.level ? 10 + h.level * 14 : 16) + 'px">' + esc(h.text.slice(0, 120)) + (h.page ? ' <span class="muted">· hlm ' + h.page + '</span>' : '') + '</div>');
    });
    if (S.refStart >= 0) out.push('<div class="end">DAFTAR PUSTAKA · ' + result.refInfo.refs.length + ' entri</div>');
    if (S.lampStart >= 0) out.push('<div class="end">LAMPIRAN</div>');
    return '<p class="muted" style="margin-top:0">Kerangka yang dibaca dari naskah. Bila judul bab atau subbab tidak muncul di sini, gunakan style Heading di Word atau penomoran seperti A., B., 1.1.</p><div class="outline">' + (out.join('') || 'Tidak ada struktur terbaca.') + '</div>';
  }

  // --------------------------------------------------------- salin
  function notesText() {
    const r = result;
    let t = '==================================================\n' +
      'CATATAN PERBAIKAN PER BAB (TESIS/DISERTASI)\n' +
      'Panduan Penulisan SPs UNJ 2025\n' +
      '==================================================\n\n';
    if (user) t += 'Penulis: ' + user.nama + ' (' + user.email + ')\n';
    t += 'Berkas: ' + fileName + '\nJenis: ' + R.JENIS[r.jenisId].label + '\nJenjang: ' + R.JENJANG[r.jenjangId].label + '\nTahap: ' + (r.tahap === 'proposal' ? 'Proposal' : 'Naskah lengkap') + '\nSkor kesesuaian: ' + scores.total + '%\n';

    const bGroups = notesByBab();
    for (const bg of bGroups) {
      t += '\n--------------------------------------------------\n';
      t += '📌 ' + bg.meta.label.toUpperCase() + '\n';
      t += '--------------------------------------------------\n';
      bg.items.forEach((it, i) => {
        const lok = it.lokasi ? ' [Lokasi: ' + it.lokasi + ']' : '';
        t += (i + 1) + '. [' + LABEL[it.status] + ']' + lok + ' ' + it.nama + '\n' +
             '   Temuan : ' + it.detail + (it.hal ? ' (Panduan hal. ' + it.hal + ')' : '') + '\n' +
             (it.saran ? '   Saran  : ' + it.saran + '\n' : '') +
             '   [ ] Sudah diperbaiki / direvisi\n\n';
      });
    }
    return t;
  }

  function copyText(text, btn, label) {
    const done = (msg) => { if (btn) { btn.textContent = msg; setTimeout(() => { btn.textContent = label; }, 2200); } };
    const fallback = () => {
      const ta = $('copyBuf'); ta.value = text; ta.select();
      try { done(document.execCommand('copy') ? 'Tersalin' : 'Tekan Ctrl+C untuk menyalin'); } catch (e) { done('Tekan Ctrl+C untuk menyalin'); }
    };
    try { navigator.clipboard.writeText(text).then(() => done('Tersalin'), fallback); } catch (e) { fallback(); }
  }
  function copyNotes() { copyText(notesText(), $('copy'), 'Salin catatan'); }

  // ===================================================== MASUKAN AI
  // Dua cara tanpa API milik pengelola web:
  //  1. salin prompt → tempel ke AI milik mahasiswa (Gemini, ChatGPT, dll.)
  //  2. API key milik mahasiswa sendiri, dipanggil langsung dari browser.
  // Halaman claude.ai memblokir koneksi ke server lain, jadi cara 2 hanya
  // berfungsi di versi yang di-hosting sendiri atau dibuka offline.
  const SANDBOX = /claude/i.test(location.hostname);
  const PROVIDERS = {
    gemini: { label: 'Google Gemini (AI Studio)', model: 'gemini-2.5-flash', keyUrl: 'https://aistudio.google.com/apikey' },
    openai: { label: 'OpenAI (ChatGPT API)', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys' },
    openrouter: { label: 'OpenRouter (banyak model)', model: 'openrouter/auto', keyUrl: 'https://openrouter.ai/keys' },
    groq: { label: 'Groq', model: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys' },
  };
  const CHAT_LINKS = [['Gemini', 'https://gemini.google.com/app'], ['ChatGPT', 'https://chatgpt.com/'], ['Copilot', 'https://copilot.microsoft.com/'], ['DeepSeek', 'https://chat.deepseek.com/'], ['Claude', 'https://claude.ai/new']];
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* abaikan */ } } };
  const ai = {
    scope: 'ringkas', depth: 'sedang',
    provider: store.get('unj-ai-provider') || 'gemini',
    model: store.get('unj-ai-model') || '',
    key: store.get('unj-ai-key') || '',
    remember: !!store.get('unj-ai-key'),
    saved: {}, // jawaban AI per cakupan, ikut ke laporan unduhan
    last: '',
  };
  const DEPTH = { ringkas: 6000, sedang: 20000, penuh: 120000 };

  function scopes() {
    const list = [['ringkas', 'Seluruh naskah (ringkasan + semua catatan)'], ['koherensi', 'Fokus: koherensi judul–rumusan masalah–simpulan'], ['analisis', 'Fokus: analisis data, tabel, dan statistik'], ['teori', 'Fokus: paradigma, grand theory, dan dimensi']];
    for (const c of result.S.chapters) list.push(['bab' + c.num, 'Bab ' + ROMAN[c.num] + ' — ' + chapterTitle(c)]);
    return list;
  }
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const chapterTitle = (c) => (c.titleIdx !== c.idx ? parsed.blocks[c.titleIdx].text : c.raw.replace(/^BAB\s+\S+\s*/i, '')).slice(0, 60);

  // Teks bab dengan penanda subjudul dan baris tabel, dipotong sampai batas karakter.
  function chapterText(c, max) {
    const out = []; let row = null, rowKey = '';
    for (const b of c.blocks) {
      if (b._toc) continue;
      if (b.tableId) {
        const k = b.tableId + ':' + b.row;
        if (k !== rowKey) { if (row) out.push('| ' + row.join(' | ') + ' |'); row = []; rowKey = k; }
        row.push(b.text);
        continue;
      }
      if (row) { out.push('| ' + row.join(' | ') + ' |'); row = null; rowKey = ''; }
      out.push(c.headings.includes(b) ? '\n## ' + b.text : b.text);
    }
    if (row) out.push('| ' + row.join(' | ') + ' |');
    let t = out.join('\n');
    if (t.length > max) t = t.slice(0, max) + '\n[… teks dipotong pada ' + fmt(max) + ' karakter …]';
    return t;
  }

  function findingsFor(pred) {
    const lines = [];
    for (const [g, items] of Object.entries(result.groups)) for (const it of items) {
      if (!(it.status === 'miss' || it.status === 'warn') || !pred(it, g)) continue;
      lines.push('- [' + LABEL[it.status] + '] ' + it.nama + ': ' + it.detail + (it.saran ? ' Saran: ' + it.saran : ''));
    }
    return lines.join('\n') || '- (tidak ada catatan otomatis untuk cakupan ini)';
  }

  function buildPrompt() {
    const r = result, L = r.lanjut || {}, max = DEPTH[ai.depth];
    const jen = R.JENIS[r.jenisId];
    const sistem = jen.bab.map((b, i) => 'Bab ' + ROMAN[i + 1] + ' ' + b.judul[0].toUpperCase() + ': ' + b.sub.map((s) => s.nama).join('; ')).join('\n');
    const rm = r.koherensi && r.koherensi.questions.length ? r.koherensi.questions.map((q, i) => (i + 1) + '. ' + q.text).join('\n') : '(tidak terbaca)';
    const dims = L.dimensi && L.dimensi.rows.length ? L.dimensi.rows.map((d) => d.label).join('; ') : '(tidak terbaca)';
    let head = 'Anda adalah penelaah ' + (r.jenjangId === 'disertasi' ? 'disertasi (program doktor, KKNI level 9)' : 'tesis (program magister, KKNI level 8)') + ' di Sekolah Pascasarjana Universitas Negeri Jakarta. ' +
      'Telaah naskah berikut berdasarkan Panduan Penulisan Tesis & Disertasi SPs UNJ 2025 dan kaidah metodologi yang lazim. Jawab dalam bahasa Indonesia akademik.\n\n' +
      '# Identitas naskah\n- Jenis penelitian: ' + jen.label + '\n- Tahap: ' + (r.tahap === 'proposal' ? 'proposal (Bab I–III)' : 'naskah lengkap') + '\n- Judul: ' + (r.judul || '(tidak terbaca)') + '\n- Rumusan masalah:\n' + rm + '\n- Dimensi konseptual terbaca: ' + dims + '\n\n' +
      '# Sistematika yang diminta panduan (hal. ' + jen.hal + ')\n' + sistem + '\n\n' +
      '# Ketentuan panduan yang relevan\n- Latar belakang memuat das sollen, das sein (lokal, nasional, internasional), kesenjangan, state of the art, research gap, dan novelty (hal. 26–27).\n- Paradigma menentukan alur berpikir (positivisme → kuantitatif; post-positivisme → kualitatif) (hal. 27).\n- Kajian pustaka adalah kajian kritis, bukan kumpulan definisi; kebaruan dipertegas lebih rinci (hal. 28–29).\n- Hasil disusun sesuai rumusan masalah; pembahasan mengonfirmasi temuan dengan teori dan penelitian terdahulu, porsi ±40% (hal. 2, 30).\n- Simpulan menjawab rumusan masalah; rekomendasi spesifik dan teknis (hal. 31).\n\n';
    let body = '', task = '';
    if (ai.scope === 'ringkas') {
      body = '# Catatan pemeriksaan otomatis\n' + findingsFor(() => true) + '\n\n# Cuplikan setiap bab\n' + r.S.chapters.map((c) => '\n### BAB ' + ROMAN[c.num] + ' ' + chapterTitle(c) + '\n' + chapterText(c, Math.round(max / Math.max(1, r.S.chapters.length)))).join('\n');
      task = 'Berikan telaah menyeluruh: (1) lima kelemahan paling penting beserta lokasinya, (2) penilaian koherensi judul–rumusan masalah–metode–hasil–simpulan, (3) prioritas revisi berurutan.';
    } else if (ai.scope === 'koherensi') {
      const parts = [0, 2].map((k) => r.S.chapters[k]).filter(Boolean);
      const last = r.S.chapters[r.S.chapters.length - 1];
      body = '# Catatan koherensi otomatis\n' + findingsFor((it, g) => g === 'koherensi') + '\n\n' + parts.concat(last && !parts.includes(last) ? [last] : []).map((c) => '### BAB ' + ROMAN[c.num] + ' ' + chapterTitle(c) + '\n' + chapterText(c, Math.round(max / 3))).join('\n\n');
      task = 'Periksa keselarasan judul, rumusan masalah, tujuan, metode, dan simpulan. Untuk setiap rumusan masalah, nilai apakah tujuan, teknik analisis, dan simpulannya menjawab rumusan tersebut. Usulkan perbaikan rumusan kalimat bila perlu.';
    } else if (ai.scope === 'analisis') {
      const c3 = r.S.chapters.find((c) => c.num === 3), c4 = r.S.chapters.find((c) => c.num === 4);
      const stat = (L.stat || []).map((s) => '- ' + s.nama + ': ' + s.nilai.slice(0, 15).join('; ') + ' (kriteria ' + s.kriteria + '; ' + s.sumber + ')').join('\n') || '- (tidak ada nilai terbaca)';
      body = '# Nilai statistik terbaca dan kriteria buku acuan\n' + stat + '\n\n# Catatan otomatis analisis data & tabel\n' + findingsFor((it, g) => g === 'statistik' || g === 'tabel') + '\n\n' + [c3, c4].filter(Boolean).map((c) => '### BAB ' + ROMAN[c.num] + ' ' + chapterTitle(c) + '\n' + chapterText(c, Math.round(max / 2))).join('\n\n');
      task = 'Telaah kesesuaian teknik analisis dengan rumusan masalah, kelengkapan pelaporan (asumsi, indeks, kriteria, rujukan kriteria), ketepatan interpretasi nilai statistik terhadap kriteria (Hair et al., 2010; Irwing et al., 2018; Downing & Haladyna, 2006), dan keselarasan angka di teks dengan tabel. Tunjukkan nilai yang perlu dibahas atau ditindaklanjuti.';
    } else if (ai.scope === 'teori') {
      const p = L.paradigma ? 'Paradigma terbaca: ' + (L.paradigma.stated.map((x) => x.label + ' (' + x.n + '×)').join(', ') || 'tidak disebut') + '; pendekatan: ' + L.paradigma.pendekatan + '.' : '';
      const c2 = r.S.chapters.find((c) => c.num === 2), c1 = r.S.chapters.find((c) => c.num === 1), c3 = r.S.chapters.find((c) => c.num === 3);
      body = '# Temuan otomatis\n' + p + '\n' + findingsFor((it, g) => g === 'paradigma' || g === 'dimensi') + '\n\n' + [c1, c2, c3].filter(Boolean).map((c) => '### BAB ' + ROMAN[c.num] + ' ' + chapterTitle(c) + '\n' + chapterText(c, Math.round(max / 3))).join('\n\n');
      task = 'Nilai keselarasan paradigma penelitian, pendekatan/metode, grand theory, dan konstruk/dimensi yang diukur. Periksa apakah setiap dimensi diturunkan dari teori secara jelas (definisi konseptual → operasional → indikator → butir). Tunjukkan bagian yang tidak konsisten dan usulkan perbaikannya.';
    } else {
      const num = +ai.scope.replace('bab', '');
      const c = r.S.chapters.find((x) => x.num === num);
      const spec = jen.bab[num - 1];
      body = '# Komponen yang diminta panduan untuk Bab ' + ROMAN[num] + '\n' + (spec ? spec.sub.map((s) => '- ' + s.nama).join('\n') : '(di luar sistematika)') +
        '\n\n# Catatan otomatis untuk bab ini\n' + findingsFor((it, g) => babOf(it, g).includes(ROMAN[num])) + '\n\n# Teks Bab ' + ROMAN[num] + '\n' + chapterText(c, max);
      task = 'Telaah Bab ' + ROMAN[num] + ': kelengkapan komponen panduan, kedalaman dan ketajaman argumen, keterkaitan dengan rumusan masalah, ketepatan penggunaan rujukan, serta kejelasan bahasa.';
    }
    return head + body + '\n\n# Tugas\n' + task + '\n\nSajikan jawaban sebagai tabel Markdown dengan kolom: No | Bagian/subbab | Masalah | Alasan (rujuk panduan atau literatur) | Saran revisi konkret (beri contoh kalimat bila perlu) | Prioritas (Tinggi/Sedang/Rendah). Setelah tabel, tulis ringkasan tiga kalimat. Jangan mengarang isi yang tidak ada di naskah; jika informasi tidak cukup, katakan demikian.';
  }

  function aiTab() {
    const prompt = buildPrompt();
    const P = PROVIDERS[ai.provider];
    const saved = Object.entries(ai.saved);
    return '<p class="muted" style="margin-top:0">Dapatkan telaah substansi dari AI yang Anda miliki: Gemini, ChatGPT, Copilot, DeepSeek, Claude, atau lainnya. Web ini tidak menyediakan AI sendiri; pilih salah satu cara di bawah.</p>' +
      '<div class="privacy-ai">Saat memakai AI, cuplikan naskah Anda dikirim ke penyedia AI yang Anda pilih dan tunduk pada kebijakan privasi mereka.</div>' +
      '<div class="ai-grid"><div class="field"><label for="aiScope">Cakupan telaah</label><select id="aiScope">' + scopes().map(([v, l]) => '<option value="' + v + '"' + (v === ai.scope ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="aiDepth">Panjang cuplikan naskah</label><select id="aiDepth">' + [['ringkas', 'Ringkas (±6.000 karakter)'], ['sedang', 'Sedang (±20.000 karakter)'], ['penuh', 'Penuh (hingga 120.000 karakter)']].map(([v, l]) => '<option value="' + v + '"' + (v === ai.depth ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div></div>' +

      '<div class="ai-box"><h4>Cara 1 — Salin prompt ke AI Anda (gratis, tanpa API key)</h4><p>Klik "Salin prompt", buka AI pilihan Anda, tempel (Ctrl+V), lalu kirim. Untuk naskah panjang, pilih cuplikan "Ringkas" bila AI menolak karena teks terlalu panjang.</p>' +
      '<div class="row"><button class="btn primary" id="aiCopy">Salin prompt</button><span class="muted" style="font-size:.8rem">' + fmt(prompt.length) + ' karakter (±' + fmt(Math.round(prompt.length / 4)) + ' token)</span></div>' +
      '<div class="ai-links">' + CHAT_LINKS.map(([n, u]) => '<a href="' + u + '" target="_blank" rel="noopener">Buka ' + n + ' ↗</a>').join('') + '</div>' +
      '<details><summary class="muted" style="cursor:pointer;font-size:.82rem">Lihat isi prompt</summary><textarea class="ai" readonly id="aiPrompt" style="min-height:220px">' + esc(prompt) + '</textarea></details>' +
      '<label for="aiPaste" style="font-size:.8rem;font-weight:600;color:var(--muted)">Tempel jawaban AI di sini agar ikut masuk laporan unduhan</label><textarea class="ai" id="aiPaste" placeholder="Tempel jawaban dari Gemini/ChatGPT/AI lain…"></textarea>' +
      '<div class="row"><button class="btn" id="aiSavePaste">Simpan ke laporan</button></div></div>' +

      '<div class="ai-box"><h4>Cara 2 — Pakai API key milik Anda sendiri</h4>' +
      (SANDBOX ? '<p><b>Tidak tersedia di halaman claude.ai</b> karena halaman ini memblokir koneksi ke server AI lain. Gunakan versi web kampus atau versi offline (berkas index.html) untuk cara ini; Cara 1 tetap bisa dipakai di sini.</p>' :
        '<p>Key tersimpan hanya di browser Anda dan dikirim langsung ke penyedia AI, tidak melalui server web ini. Gemini menyediakan key gratis dengan kuota harian di Google AI Studio.</p>' +
        '<div class="ai-grid"><div class="field"><label for="aiProv">Penyedia</label><select id="aiProv">' + Object.entries(PROVIDERS).map(([k, p]) => '<option value="' + k + '"' + (k === ai.provider ? ' selected' : '') + '>' + p.label + '</option>').join('') + '</select></div>' +
        '<div class="field"><label for="aiModel">Model</label><input type="text" id="aiModel" value="' + esc(ai.model || P.model) + '"></div>' +
        '<div class="field"><label for="aiKey">API key (<a href="' + P.keyUrl + '" target="_blank" rel="noopener">buat key ↗</a>)</label><input type="password" id="aiKey" autocomplete="off" value="' + esc(ai.key) + '"></div></div>' +
        '<label style="font-size:.8rem;display:flex;gap:6px;align-items:center"><input type="checkbox" id="aiRemember"' + (ai.remember ? ' checked' : '') + '> Ingat key di browser ini (jangan dicentang di komputer bersama)</label>' +
        '<div class="row"><button class="btn primary" id="aiRun">Minta masukan AI</button><span class="muted" id="aiStatus" role="status" style="font-size:.82rem"></span></div>' +
        '<div class="ai-out" id="aiOut"' + (ai.last ? '' : ' hidden') + '>' + esc(ai.last) + '</div>') + '</div>' +

      (saved.length ? '<h3>Masukan AI tersimpan (ikut laporan unduhan)</h3><div class="ai-saved">' + saved.map(([k, v]) => '<details><summary>' + esc(v.label) + ' · ' + esc(v.sumber) + '</summary><div class="ai-out">' + esc(v.text) + '</div><button class="btn" data-del="' + esc(k) + '" style="margin-top:8px">Hapus</button></details>').join('') + '</div>' : '');
  }

  function scopeLabel() { return (scopes().find(([v]) => v === ai.scope) || [, ai.scope])[1]; }

  function bindAi() {
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    on('aiScope', 'change', (e) => { ai.scope = e.target.value; render(); });
    on('aiDepth', 'change', (e) => { ai.depth = e.target.value; render(); });
    on('aiCopy', 'click', (e) => copyText(buildPrompt(), e.target, 'Salin prompt'));
    on('aiSavePaste', 'click', (e) => {
      const t = $('aiPaste').value.trim();
      if (!t) { e.target.textContent = 'Kolom masih kosong'; setTimeout(() => { e.target.textContent = 'Simpan ke laporan'; }, 2000); return; }
      ai.saved[ai.scope + ':tempel'] = { label: scopeLabel(), sumber: 'ditempel dari AI pilihan pengguna', text: t };
      render();
    });
    on('aiProv', 'change', (e) => { ai.provider = e.target.value; ai.model = ''; store.set('unj-ai-provider', ai.provider); render(); });
    on('aiModel', 'change', (e) => { ai.model = e.target.value.trim(); store.set('unj-ai-model', ai.model || null); });
    on('aiKey', 'change', (e) => { ai.key = e.target.value.trim(); if (ai.remember) store.set('unj-ai-key', ai.key); });
    on('aiRemember', 'change', (e) => { ai.remember = e.target.checked; store.set('unj-ai-key', ai.remember ? ai.key : null); });
    on('aiRun', 'click', runAi);
    document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { delete ai.saved[b.dataset.del]; render(); }));
  }

  async function callAi(provider, key, model, prompt) {
    if (provider === 'gemini') {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data.error && data.error.message) || 'HTTP ' + res.status);
      const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
      return parts.map((p) => p.text || '').join('');
    }
    const url = { openai: 'https://api.openai.com/v1/chat/completions', openrouter: 'https://openrouter.ai/api/v1/chat/completions', groq: 'https://api.groq.com/openai/v1/chat/completions' }[provider];
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && (data.error.message || data.error)) || 'HTTP ' + res.status);
    return ((data.choices || [])[0] || {}).message ? data.choices[0].message.content : '';
  }

  async function runAi() {
    const key = ($('aiKey').value || '').trim(), model = ($('aiModel').value || '').trim() || PROVIDERS[ai.provider].model;
    ai.key = key; if (ai.remember) store.set('unj-ai-key', key);
    if (!key) { $('aiStatus').textContent = 'Isi API key terlebih dahulu.'; return; }
    $('aiRun').disabled = true;
    $('aiStatus').textContent = 'Menunggu jawaban ' + PROVIDERS[ai.provider].label + '…';
    try {
      const text = await callAi(ai.provider, key, model, buildPrompt());
      ai.last = text || '(jawaban kosong)';
      ai.saved[ai.scope + ':' + ai.provider] = { label: scopeLabel(), sumber: PROVIDERS[ai.provider].label + ' · ' + model, text: ai.last };
      render();
      $('aiStatus').textContent = 'Selesai. Jawaban disimpan ke laporan.';
    } catch (e) {
      $('aiStatus').textContent = 'Gagal: ' + e.message + '. Periksa key, nama model, atau kuota; Cara 1 tetap bisa dipakai.';
      $('aiRun').disabled = false;
    }
  }

  // ======================================================= UNDUHAN
  const htmlEsc = esc;
  function reportHtml() {
    const r = result;
    const buckets = {};
    for (const [g, items] of Object.entries(r.groups)) for (const it of items) for (const k of babOf(it, g)) (buckets[k] = buckets[k] || []).push(it);
    const order = [['awal', 'Bagian awal']].concat(r.S.chapters.map((c) => [ROMAN[c.num], 'Bab ' + ROMAN[c.num] + ' ' + chapterTitle(c)]), [['pustaka', 'Daftar pustaka'], ['lampiran', 'Lampiran'], ['umum', 'Umum dan format']]);
    let h = '<h1>Laporan Pemeriksaan ' + (r.jenjangId === 'disertasi' ? 'Disertasi' : 'Tesis') + '</h1><p class="sub">Berdasarkan Panduan Penulisan Tesis &amp; Disertasi Sekolah Pascasarjana UNJ 2025</p>' +
      '<table class="meta">' + (user ? '<tr><td>Nama</td><td>' + htmlEsc(user.nama) + '</td></tr><tr><td>Email</td><td>' + htmlEsc(user.email) + '</td></tr>' : '') + '<tr><td>Berkas</td><td>' + htmlEsc(fileName) + '</td></tr><tr><td>Judul</td><td>' + htmlEsc(r.judul || '–') + '</td></tr><tr><td>Jenis penelitian</td><td>' + htmlEsc(R.JENIS[r.jenisId].label) + '</td></tr><tr><td>Tahap</td><td>' + (r.tahap === 'proposal' ? 'Proposal' : 'Naskah lengkap') + '</td></tr><tr><td>Tanggal pemeriksaan</td><td>' + new Date().toLocaleDateString('id-ID', { dateStyle: 'long' }) + '</td></tr><tr><td>Skor kesesuaian</td><td>' + scores.total + '%</td></tr></table>' +
      '<h2>Ringkasan skor</h2><table><tr><th>Aspek</th><th>Skor</th></tr>' + Object.keys(GROUP).filter((g) => scores[g] != null).map((g) => '<tr><td>' + GROUP[g] + '</td><td>' + scores[g] + '%</td></tr>').join('') + '</table>' +
      '<h2>Catatan revisi per bab</h2><p class="sub">Kolom "Sudah direvisi" dan "Tanggapan" diisi mahasiswa saat merevisi; dapat diserahkan kepada pembimbing/promotor.</p>';
    for (const [k, title] of order) {
      const seenInBucket = new Set();
      const rawItems = (buckets[k] || []).filter((x) => x.status === 'miss' || x.status === 'warn').sort((a, b) => (a.status === 'miss' ? 0 : 1) - (b.status === 'miss' ? 0 : 1));
      const items = [];
      for (const it of rawItems) {
        const key = (it.nama || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!key || seenInBucket.has(key)) continue;
        seenInBucket.add(key);
        items.push(it);
      }
      if (!items.length) continue;
      h += '<h3>' + htmlEsc(title) + '</h3><table><tr><th style="width:4%">No</th><th style="width:10%">Status</th><th style="width:20%">Kriteria</th><th style="width:26%">Temuan</th><th style="width:22%">Saran perbaikan</th><th style="width:6%">Hal.</th><th style="width:5%">Sudah direvisi</th><th style="width:7%">Tanggapan</th></tr>' +
        items.map((it, i) => '<tr><td>' + (i + 1) + '</td><td class="' + it.status + '">' + LABEL[it.status] + '</td><td>' + htmlEsc(it.nama) + '</td><td>' + htmlEsc(it.detail) + '</td><td>' + htmlEsc(it.saran || '') + '</td><td>' + htmlEsc(it.hal || '') + '</td><td style="text-align:center">☐</td><td></td></tr>').join('') + '</table>';
    }
    const saved = Object.values(ai.saved);
    if (saved.length) h += '<h2>Masukan AI</h2><p class="sub">Dihasilkan oleh AI pilihan pengguna; periksa kembali sebelum dipakai.</p>' + saved.map((v) => '<h3>' + htmlEsc(v.label) + '</h3><p class="sub">Sumber: ' + htmlEsc(v.sumber) + '</p><pre>' + htmlEsc(v.text) + '</pre>').join('');
    const ri = r.refInfo, L = r.lanjut || {};
    const app = [];
    if (ri.draft && ri.draft.length) app.push(['Entri daftar pustaka yang belum lengkap', ri.draft.map((x) => x.text)]);
    if (ri.missingRef && ri.missingRef.length) app.push(['Sitasi tanpa entri daftar pustaka', ri.missingRef.map((c) => c.raw)]);
    if (ri.uncited && ri.uncited.length) app.push(['Entri daftar pustaka yang tidak disitasi', ri.uncited.map((x) => x.text)]);
    if (L.tabel && L.tabel.mismatch && L.tabel.mismatch.length) app.push(['Angka di teks yang tidak ditemukan di tabel yang dirujuk', L.tabel.mismatch]);
    if (L.stat && L.stat.length) app.push(['Nilai statistik terbaca dan kriteria', L.stat.map((s) => '[' + LABEL[s.status] + '] ' + s.nama + ': ' + s.nilai.slice(0, 20).join('; ') + ' — kriteria ' + s.kriteria + ' (' + s.sumber + ')')]);
    if (app.length) h += '<h2>Lampiran rincian</h2>' + app.map(([t, l]) => '<h3>' + htmlEsc(t) + ' (' + l.length + ')</h3><ol>' + l.map((x) => '<li>' + htmlEsc(x) + '</li>').join('') + '</ol>').join('');
    h += '<p class="sub">Pemeriksaan otomatis bersifat indikatif; keputusan akhir pada pembimbing/promotor.</p>';
    const css = '@page{size:29.7cm 21cm;margin:2cm}body{font-family:"Times New Roman",serif;font-size:11pt}h1{font-size:16pt;margin:0}h2{font-size:13pt;margin-top:16pt}h3{font-size:12pt;margin-top:12pt}.sub{color:#555;font-size:10pt}table{border-collapse:collapse;width:100%;margin:6pt 0}td,th{border:1px solid #999;padding:4pt;vertical-align:top;font-size:10pt}th{background:#e8eee9;text-align:left}.meta td:first-child{width:22%;font-weight:bold}.miss{color:#b0261d;font-weight:bold}.warn{color:#8a5800;font-weight:bold}pre{white-space:pre-wrap;font-family:"Times New Roman",serif;font-size:10.5pt;border:1px solid #ccc;padding:6pt}';
    return '<html><head><meta charset="utf-8"><title>Laporan Pemeriksaan</title><style>' + css + '</style></head><body>' + h + '</body></html>';
  }

  function download(name, type, content) {
    const blob = new Blob(['﻿', content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  const baseName = () => 'Pemeriksaan_' + fileName.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_').slice(0, 60);
  $('dlDoc').addEventListener('click', () => download(baseName() + '.doc', 'application/msword', reportHtml()));
  $('dlTxt').addEventListener('click', () => {
    let t = notesText();
    for (const v of Object.values(ai.saved)) t += '\n\nMASUKAN AI — ' + v.label + ' (' + v.sumber + ')\n' + v.text;
    download(baseName() + '.txt', 'text/plain;charset=utf-8', t);
  });
  $('dlPrint').addEventListener('click', () => {
    const prev = tab; tab = 'perbab'; render();
    setTimeout(() => { window.print(); tab = prev; render(); }, 50);
  });
  if (SANDBOX) { ['dlDoc', 'dlTxt', 'dlPrint'].forEach((id) => { $(id).hidden = true; }); $('dlNote').hidden = false; }

  // ================================ IDENTITAS PENGGUNA (nama + email UNJ)
  // Tanpa kata sandi dan tanpa server: hanya identifikasi. Format email
  // dibatasi ke domain unj.ac.id (termasuk subdomain seperti mhs.unj.ac.id),
  // tetapi kepemilikan email tidak diverifikasi.
  const EMAIL_UNJ = /^[a-z0-9._%+-]+@([a-z0-9-]+\.)*unj\.ac\.id$/i;
  const EMAIL_VALID = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // ================================ SISTEM LISENSI EKSKLUSIF & PENGGUNA
  let user = null;
  try { user = JSON.parse(store.get('cekin-user') || 'null'); } catch (e) { user = null; }

  let currentLicense = null;
  try { currentLicense = JSON.parse(store.get('cekin-license') || 'null'); } catch (e) { currentLicense = null; }

  // Verifikasi lisensi melalui LicenseEngine
  function verifyActiveLicense() {
    if (!window.LicenseEngine) return { active: false, message: 'LicenseEngine belum siap.' };
    return window.LicenseEngine.checkLicenseStatus(currentLicense);
  }

  const initials = (n) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  function applyUser() {
    const licStatus = verifyActiveLicense();
    const hasValidLicense = licStatus && licStatus.active;

    // Pengguna hanya bisa masuk ke alat periksa bila data user lengkap DAN lisensi masih aktif
    const on = !!(user && hasValidLicense);

    $('loginPage').hidden = on;
    $('tool').hidden = !on;
    $('navMasuk').hidden = on;
    $('navUser').hidden = !on;

    if (on) {
      $('navNama').textContent = $('meNama').textContent = user.nama;
      $('navEmail').textContent = $('meEmail').textContent = user.email;
      $('navAvatar').textContent = $('meAvatar').textContent = initials(user.nama);
      $('helloNama').textContent = user.nama.split(/\s+/)[0];

      // Update License Badge di header workspace
      const badgeText = $('licBadgeText');
      if (badgeText) {
        if (licStatus.isMaster) {
          badgeText.textContent = '👑 Master VIP (Permanen)';
        } else if (licStatus.remainingDays >= 3000) {
          badgeText.textContent = '🛡️ Lisensi Lifetime';
        } else {
          badgeText.textContent = `🛡️ Lisensi Aktif: ${licStatus.remainingDays} hari tersisa`;
        }
      }
    } else if (user && !hasValidLicense) {
      // Ada user tapi lisensi kedaluwarsa atau belum ada
      if ($('uErr')) {
        $('uErr').textContent = licStatus.expired 
          ? 'Masa berlaku lisensi Cek-In Anda telah habis. Silakan hubungi pemilik untuk perpanjangan.' 
          : 'Kunci lisensi Cek-In belum aktif. Silakan masukkan kunci lisensi yang valid.';
      }
    }
    window.scrollTo(0, 0);
  }

  // Tombol Ganti Lisensi di header
  const btnDeactLic = $('btnDeactLic');
  if (btnDeactLic) {
    btnDeactLic.addEventListener('click', () => {
      if (confirm('Apakah Anda ingin mengganti kunci lisensi Cek-In dengan kunci lain?')) {
        currentLicense = null;
        store.set('cekin-license', null);
        applyUser();
        if ($('uLicense')) {
          $('uLicense').value = '';
          $('uLicense').focus();
        }
      }
    });
  }

  // Submit Formulir Aktivasi Lisensi & Masuk
  $('login').addEventListener('submit', (e) => {
    e.preventDefault();
    const nama = $('uNama').value.replace(/\s+/g, ' ').trim();
    const email = $('uEmail').value.trim().toLowerCase();
    const licInput = $('uLicense') ? $('uLicense').value.trim() : '';

    if (nama.length < 3) { $('uErr').textContent = 'Isi nama lengkap (minimal 3 huruf).'; $('uNama').focus(); return; }
    if (!EMAIL_VALID.test(email)) { $('uErr').textContent = 'Masukkan alamat email yang valid.'; $('uEmail').focus(); return; }
    
    if (!licInput) {
      $('uErr').textContent = 'Kunci lisensi wajib diisi. Silakan minta kunci ke Pemilik lewat WhatsApp.';
      if ($('uLicense')) $('uLicense').focus();
      return;
    }

    if (!window.LicenseEngine) {
      $('uErr').textContent = 'Modul lisensi sedang memuat. Coba lagi.';
      return;
    }

    // Validasi kunci secara kriptografis
    const valResult = window.LicenseEngine.validateLicense(licInput);
    if (!valResult.valid) {
      $('uErr').textContent = valResult.message || 'Kunci lisensi tidak valid.';
      if ($('uLicense')) $('uLicense').focus();
      return;
    }

    // Lisensi valid! Simpan ke store
    currentLicense = {
      key: valResult.key,
      activatedAt: new Date().toISOString(),
      label: valResult.label,
      days: valResult.days,
      durationCode: valResult.durationCode,
      isMaster: !!valResult.isMaster
    };
    store.set('cekin-license', JSON.stringify(currentLicense));

    $('uErr').textContent = '';
    user = { nama, email, masuk: new Date().toISOString() };
    store.set('cekin-user', JSON.stringify(user));
    applyUser();
  });

  const btnGuest = $('btnGuest');
  if (btnGuest) {
    btnGuest.addEventListener('click', () => {
      // Demo guest tetap butuh aktivasi master atau input lisensi
      if ($('uLicense') && !$('uLicense').value) {
        $('uLicense').value = 'CEKIN-BIMA-DISERTASI-MASTER';
      }
      $('login').dispatchEvent(new Event('submit'));
    });
  }

  $('logout').addEventListener('click', () => {
    user = null; store.set('cekin-user', null);
    parsed = null; result = null; pending = null;
    $('filled').hidden = true; $('empty').hidden = false;
    $('filename').textContent = ''; $('run').disabled = true; $('progress').textContent = '';
    $('uNama').value = ''; $('uEmail').value = '';
    applyUser();
  });

  // ============================================ LOGIN OPENROUTER (OAuth PKCE)
  // Mahasiswa masuk ke akun OpenRouter miliknya; OpenRouter mengembalikan
  // API key pribadi ke halaman ini. Butuh https atau localhost (crypto.subtle).
  const canLogin = !SANDBOX && window.isSecureContext && /^https?:$/.test(location.protocol) && !!(window.crypto && crypto.subtle);
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const here = () => location.origin + location.pathname;

  function acctUi() {
    const box = $('acct');
    box.hidden = !canLogin;
    if (!canLogin) return;
    const on = ai.provider === 'openrouter' && !!ai.key && store.get('unj-or-login') === '1';
    box.classList.toggle('on', on);
    $('acctStatus').textContent = on ? 'Terhubung ke OpenRouter. Masukan AI siap dipakai di tab "Masukan AI".' : 'Belum terhubung. Masuk sebelum mengunggah naskah, karena halaman dimuat ulang setelah login.';
    $('orLogin').hidden = on;
    $('orLogout').hidden = !on;
  }

  $('orLogin').addEventListener('click', async () => {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    try { sessionStorage.setItem('unj-or-verifier', verifier); } catch (e) { /* abaikan */ }
    location.href = 'https://openrouter.ai/auth?callback_url=' + encodeURIComponent(here()) + '&code_challenge=' + challenge + '&code_challenge_method=S256';
  });
  $('orLogout').addEventListener('click', () => {
    ai.key = ''; store.set('unj-ai-key', null); store.set('unj-or-login', null);
    acctUi(); if (result && tab === 'ai') render();
  });

  (async () => {
    const code = new URLSearchParams(location.search).get('code');
    if (!code || !canLogin) { acctUi(); return; }
    history.replaceState(null, '', here());
    let verifier = null;
    try { verifier = sessionStorage.getItem('unj-or-verifier'); sessionStorage.removeItem('unj-or-verifier'); } catch (e) { /* abaikan */ }
    $('acctStatus').textContent = 'Menyelesaikan login OpenRouter…';
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.key) throw new Error((data.error && (data.error.message || data.error)) || 'HTTP ' + res.status);
      ai.provider = 'openrouter'; ai.key = data.key; ai.model = ai.model || PROVIDERS.openrouter.model; ai.remember = true;
      store.set('unj-ai-provider', 'openrouter'); store.set('unj-ai-key', data.key); store.set('unj-or-login', '1');
      acctUi();
    } catch (e) {
      acctUi();
      $('acctStatus').textContent = 'Login OpenRouter gagal: ' + e.message + '. Coba lagi, atau pakai API key/Cara 1.';
    }
  })();

})();
