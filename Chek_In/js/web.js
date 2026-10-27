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
  ['jenjang', 'tahap', 'jenis', 'judul'].forEach((id) => $(id).addEventListener('change', () => { if (parsed) analyze(); }));

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
    if ($('filled')) $('filled').hidden = true;
    if ($('empty')) $('empty').hidden = false;
    if ($('alerts')) $('alerts').innerHTML = '';
    if ($('panel')) $('panel').innerHTML = '';
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
    result = window.Analyzer.analyze(parsed, { jenjang: $('jenjang').value, tahap: $('tahap').value, jenis: $('jenis').value, judul: $('judul').value });
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
    if (parsed && parsed.multiFiles && parsed.multiFiles.length > 1) {
      facts.unshift(['Berkas digabung', parsed.multiFiles.length + ' file (' + parsed.multiFiles.join(', ') + ')']);
    }
    $('facts').innerHTML = facts.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('');
    $('bars').innerHTML = Object.keys(GROUP).filter((g) => scores[g] != null).map((g) =>
      '<div class="bar"><div class="lbl"><span>' + GROUP[g] + '</span><b>' + scores[g] + '%</b></div><div class="track"><div class="fill" style="width:' + scores[g] + '%;background:' + tone(scores[g]) + '"></div></div></div>').join('');

    const al = [];
    if (r.scanned) al.push(['miss', 'PDF ini hasil pindai (gambar) sehingga teksnya tidak terbaca. Unggah .docx atau PDF hasil ekspor dari Word.']);
    if (!r.S.chapters.length) al.push(['miss', 'Judul bab tidak terbaca. Pastikan setiap bab diawali baris seperti "BAB I PENDAHULUAN".']);
    if ($('jenis').value === 'auto') {
      const top = r.det.ranked.slice(0, 3).filter(([, s]) => s > 0).map(([j, s]) => R.JENIS[j].label.split(' (')[0] + ' (' + s + ')');
      al.push(['info', 'Jenis penelitian ditebak dari kata kunci di Bab I–III: ' + (top.join(', ') || 'tidak ada indikator kuat') + '. Bila keliru, ganti di menu Jenis penelitian; laporan langsung diperbarui.']);
    }
    if (!r.jenjangPasti) al.push(['warn', 'Jenjang ditebak sebagai ' + (r.jenjangId === 'tesis' ? 'tesis' : 'disertasi') + ' karena naskah tidak memuat halaman sampul/judul. Pilih jenjang yang benar di panel kiri, karena batas jumlah kata dan rujukan bergantung padanya.']);
    if (!r.judul) al.push(['info', 'Judul tidak terbaca dari naskah. Ketik judul di panel kiri agar koherensi judul ikut diperiksa' + (r.jenjangId === 'tesis' ? ' (dan batas 12 kata untuk tesis).' : '.') + '']);
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
    return (title ? '<h3>' + esc(title) + '</h3>' : '') + '<ul class="items">' + items.map((it) =>
      '<li class="' + (it.sub ? 'sub' : '') + '">' + badge(it.status) + '<span class="nm">' + esc(it.nama) + '</span><span class="hal">' + (it.hal ? 'hal. ' + esc(it.hal) : '') + '</span>' +
      '<span class="dt">' + (loc && it.lokasi ? 'Diperiksa di ' + esc(it.lokasi) + '. ' : '') + esc(it.detail) + '</span>' +
      ((it.status === 'miss' || it.status === 'warn') && it.saran ? '<span class="sv">→ ' + esc(it.saran) + '</span>' : '') +
      (it.bukti ? '<span class="ev">' + esc(it.bukti) + '</span>' : '') + '</li>').join('') + '</ul>';
  }

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

  function render() {
    const P = $('panel'), g = result.groups;
    if (tab === 'catatan') {
      const n = notes();
      const total = n.reduce((a, [, l]) => a + l.length, 0);
      const miss = n.reduce((a, [, l]) => a + l.filter((x) => x.status === 'miss').length, 0);
      P.innerHTML = total
        ? '<div class="notes-head"><span class="count">' + total + ' catatan: <b class="m">' + miss + ' belum ada</b>, <b class="w">' + (total - miss) + ' perlu dicek</b></span><button class="btn" id="copy">Salin catatan</button></div>' +
          n.map(([grp, l]) => list(l, GROUP[grp])).join('')
        : '<p>Tidak ada catatan. Semua kriteria yang dapat diperiksa otomatis sudah terpenuhi.</p>';
      const c = $('copy'); if (c) c.addEventListener('click', copyNotes);
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
    else if (tab === 'ai') { P.innerHTML = aiTab(); bindAi(); }
    else if (tab === 'isi') P.innerHTML = legend() + list(g.isi, null, true);
    else if (tab === 'awal') P.innerHTML = legend() + list(g.awal, 'Bagian awal') + (g.lampiran.length ? list(g.lampiran, 'Lampiran') : '<p class="muted">Lampiran hanya diperiksa pada naskah lengkap.</p>');
    else if (tab === 'rujukan') P.innerHTML = legend() + list(g.kuantitas, 'Kuantitas kata') + list(g.rujukan, 'Rujukan & sitasi') + refLists();
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
  const ROMAN_RE = /\bBab (VI|IV|V|I{1,3})\b/g;
  function babOf(it, g) {
    if (g === 'awal') return ['awal'];
    if (g === 'rujukan') return ['pustaka'];
    if (g === 'lampiran') return ['lampiran'];
    if (g === 'format') return ['umum'];
    if (g === 'kuantitas' && /judul|abstra/i.test(it.nama)) return ['awal'];
    const hits = new Set();
    for (const m of ((it.nama || '') + ' ' + (it.lokasi || '')).matchAll(ROMAN_RE)) hits.add(m[1]);
    return hits.size ? [...hits] : ['umum'];
  }
  function perBab() {
    const L = result.lanjut || {};
    const buckets = {};
    for (const [g, items] of Object.entries(result.groups)) for (const it of items) for (const k of babOf(it, g)) (buckets[k] = buckets[k] || []).push(it);
    const sections = [['awal', 'Bagian awal', null]];
    for (const pb of L.perBab || []) sections.push([['', 'I', 'II', 'III', 'IV', 'V', 'VI'][pb.num], pb.label + (pb.judul ? ' · ' + pb.judul : ''), pb]);
    sections.push(['pustaka', 'Daftar pustaka', null], ['lampiran', 'Lampiran', null], ['umum', 'Umum (seluruh naskah & format)', null]);
    const stats = (pb) => '<div class="babstats">' + [['Kata', fmt(pb.words) + ' (' + pb.pct + '%)'], ['Subjudul', pb.headings], ['Tabel', pb.tabel], ['Gambar', pb.gambar], ['Sitasi', pb.sitasi + ' (' + pb.sitasiUnik + ' unik)'], ['Sitasi / 1.000 kata', String(pb.per1000).replace('.', ',')]].map(([k, v]) => '<span><small>' + k + '</small><b>' + v + '</b></span>').join('') + '</div>';
    babCopy = {};
    return '<div class="howto"><b>Cara memakai tab ini</b><ol><li>Baca catatan tiap bab; yang <b>Belum ada</b> paling penting.</li><li>Klik <b>Salin catatan bab</b> untuk menempel daftar revisi ke Word/WhatsApp, atau <b>Salin prompt AI</b> lalu tempel (Ctrl+V) di Gemini/ChatGPT untuk telaah isi bab.</li><li>Jawaban AI dapat ditempel di tab <b>Masukan AI</b> agar ikut ke laporan unduhan.</li></ol></div>' + legend() +
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
    let t = 'CATATAN PEMERIKSAAN TESIS/DISERTASI\nPanduan Penulisan SPs UNJ 2025\n\n';
    if (user) t += 'Nama: ' + user.nama + '\nEmail: ' + user.email + '\n';
    t += 'Berkas: ' + fileName + '\nJenis: ' + R.JENIS[r.jenisId].label + '\nJenjang: ' + R.JENJANG[r.jenjangId].label + '\nTahap: ' + (r.tahap === 'proposal' ? 'Proposal' : 'Naskah lengkap') + '\nSkor kesesuaian: ' + scores.total + '%\n';
    for (const [g, l] of notes()) {
      t += '\n' + GROUP[g].toUpperCase() + '\n';
      l.forEach((it, i) => { t += (i + 1) + '. [' + LABEL[it.status] + '] ' + it.nama + (it.saran ? ' — ' + it.saran : '') + '\n   ' + it.detail + (it.hal ? ' (panduan hal. ' + it.hal + ')' : '') + '\n'; });
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
