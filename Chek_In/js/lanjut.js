/*
 * Analisis lanjutan:
 *  - dimensi konseptual (Bab II → Bab III/kisi-kisi → Bab IV → simpulan)
 *  - paradigma ↔ pendekatan ↔ grand theory
 *  - tabel & gambar (penomoran, rujukan teks, daftar, angka teks ↔ tabel)
 *  - teknik analisis data Bab III ↔ Bab IV
 *  - nilai statistik yang dilaporkan ↔ kriteria buku acuan (folder buku_babon_psikometri)
 *  - ringkasan per bab
 */
(function (global) {
  'use strict';

  // Kriteria dari buku acuan. `sumber` dicantumkan di laporan.
  const HAIR = 'Hair et al. (2010), Multivariate Data Analysis 7th ed.';
  const WILEY = 'Irwing, Booth & Hughes (2018), Wiley Handbook of Psychometric Testing';
  const DOWNING = 'Downing & Haladyna (2006), Handbook of Test Development';
  const BANDUR = 'Bandur, Analisis Data Kualitatif dengan NVivo (standar Fleiss et al., 2003)';
  const LINACRE = 'Linacre (2002); Bond & Fox (2015) — di luar folder acuan';

  // arah: 'min' (≥ baik) atau 'max' (≤ baik). ok = ambang baik, warn = ambang masih dapat diterima.
  const STAT = [
    { id: 'cfi', nama: 'CFI', re: /\bCFI\b/, arah: 'min', ok: 0.95, warn: 0.90, kriteria: '≥ 0,95 baik; 0,90–0,94 dapat diterima', sumber: HAIR },
    { id: 'tli', nama: 'TLI / NNFI', re: /\b(TLI|NNFI)\b/, arah: 'min', ok: 0.95, warn: 0.90, kriteria: '≥ 0,95 baik; ≥ 0,90 dapat diterima', sumber: HAIR },
    { id: 'gfi', nama: 'GFI', re: /\bA?GFI\b/, arah: 'min', ok: 0.90, warn: 0.85, kriteria: '≥ 0,90', sumber: HAIR },
    { id: 'rmsea', nama: 'RMSEA', re: /\bRMSEA\b/, arah: 'max', ok: 0.05, warn: 0.08, kriteria: '< 0,05 sangat baik; ≤ 0,08 dapat diterima; > 0,10 buruk', sumber: HAIR },
    { id: 'srmr', nama: 'SRMR', re: /\bSRMR\b/, arah: 'max', ok: 0.05, warn: 0.08, kriteria: '< 0,05 baik; < 0,08 dapat diterima', sumber: HAIR },
    { id: 'chidf', nama: 'χ²/df (CMIN/DF)', re: /(χ2|χ²|chi[- ]?square|x2|cmin)\s*\/\s*(df|db)\b|\bCMIN\/DF\b/i, arah: 'max', ok: 3, warn: 5, kriteria: '≤ 3 baik; ≤ 5 dapat diterima', sumber: HAIR },
    { id: 'kmo', nama: 'KMO / MSA', re: /\b(KMO|MSA)\b|kaiser[- ]meyer[- ]olkin/i, arah: 'min', ok: 0.80, warn: 0.60, kriteria: '≥ 0,80 sangat baik; 0,60–0,79 cukup; < 0,50 tidak layak', sumber: HAIR },
    { id: 'ave', nama: 'AVE', re: /\bAVE\b|average variance extracted/i, arah: 'min', ok: 0.50, warn: 0.50, kriteria: '≥ 0,50', sumber: HAIR },
    { id: 'cr', nama: 'Construct Reliability (CR)', re: /\b(CR|construct reliability|composite reliability|reliabilitas konstruk|reliabilitas komposit)\b/i, arah: 'min', ok: 0.70, warn: 0.60, kriteria: '≥ 0,70', sumber: HAIR },
    { id: 'alpha', nama: "Cronbach's alpha", re: /\b(cronbach'?s?\s*)?alpha\b|alfa cronbach|koefisien alfa/i, arah: 'min', ok: 0.70, warn: 0.60, kriteria: '≥ 0,70 (0,60 untuk studi eksploratori)', sumber: HAIR },
    { id: 'omega', nama: 'McDonald’s omega', re: /\b(mcdonald'?s?\s*)?omega\b/i, arah: 'min', ok: 0.70, warn: 0.60, kriteria: '≥ 0,70', sumber: WILEY },
    { id: 'omegah', nama: 'Omega hierarkis (ωh)', re: /omega\s*(hierarchical|hierarkis|h)\b|\bωh\b|\bω_h\b/i, arah: 'min', ok: 0.80, warn: 0.75, kriteria: '≥ 0,80 → skor total didominasi faktor umum', sumber: WILEY },
    { id: 'ecv', nama: 'ECV', re: /\bECV\b|explained common variance/i, arah: 'min', ok: 0.70, warn: 0.60, kriteria: '> 0,70 (bersama ωh > 0,80) → esensial unidimensional', sumber: WILEY },
    { id: 'dcfi', nama: 'ΔCFI (invariansi)', re: /(Δ|delta)\s*CFI\b/i, arah: 'absmax', ok: 0.010, warn: 0.010, kriteria: '|ΔCFI| ≤ 0,010', sumber: WILEY },
    { id: 'drmsea', nama: 'ΔRMSEA (invariansi)', re: /(Δ|delta)\s*RMSEA\b/i, arah: 'absmax', ok: 0.015, warn: 0.015, kriteria: 'ΔRMSEA ≤ 0,015', sumber: WILEY },
    { id: 'vif', nama: 'VIF', re: /\bVIF\b/, arah: 'max', ok: 5, warn: 10, kriteria: '< 5 ideal; < 10 batas', sumber: HAIR },
    { id: 'tol', nama: 'Tolerance', re: /\btolerance\b|\btoleransi\b/i, arah: 'min', ok: 0.20, warn: 0.10, kriteria: '> 0,10 (ideal > 0,20)', sumber: HAIR },
    { id: 'rpbis', nama: 'Korelasi point-biserial', re: /point[- ]?biserial|\br\s?pbis\b|\brpbi\b/i, arah: 'min', ok: 0.30, warn: 0.25, kriteria: '≥ 0,25 (ideal ≥ 0,30); negatif = butir/kunci bermasalah', sumber: DOWNING },
    { id: 'daya', nama: 'Indeks daya beda (D)', re: /daya (beda|pembeda)|discrimination index/i, arah: 'min', ok: 0.30, warn: 0.20, kriteria: '≥ 0,40 sangat baik; 0,30–0,39 baik; 0,20–0,29 revisi; < 0,20 buruk', sumber: DOWNING },
    { id: 'kappa', nama: 'Koefisien kappa / kesepakatan antarpenilai', re: /\b(cohen'?s?\s*|fleiss'?\s*)?kappa\b/i, arah: 'min', ok: 0.75, warn: 0.40, kriteria: '≥ 0,75 sangat baik; 0,40–0,75 cukup–baik; ≤ 0,40 lemah', sumber: BANDUR },
    { id: 'mnsq', nama: 'Infit/Outfit MNSQ (Rasch)', re: /\b(infit|outfit)\s*(MNSQ|mean[- ]?square)?\b|\bMNSQ\b/i, arah: 'range', lo: 0.5, hi: 1.5, kriteria: '0,5–1,5', sumber: LINACRE },
  ];

  const TEKNIK = [
    ['Analisis faktor konfirmatori (CFA)', ['cfa', 'confirmatory factor', 'analisis faktor konfirmatori']],
    ['Analisis faktor eksploratori (EFA)', ['efa', 'exploratory factor', 'analisis faktor eksploratori']],
    ['SEM / analisis jalur', ['sem', 'structural equation', 'analisis jalur', 'path analysis', 'pls sem', 'smartpls']],
    ['Regresi', ['regresi', 'regression']],
    ['Korelasi', ['korelasi pearson', 'product moment', 'spearman', 'analisis korelasi']],
    ['Uji t', ['uji t', 't test', 'independent sample', 'paired sample']],
    ['ANOVA / ANAVA / MANOVA', ['anova', 'anava', 'manova', 'ancova']],
    ['Model Rasch', ['rasch', 'winsteps', 'partial credit model']],
    ['Teori respons butir (IRT)', ['item response theory', 'teori respons butir', '2pl', '3pl', 'graded response']],
    ['Analisis butir klasik (CTT)', ['daya beda', 'daya pembeda', 'tingkat kesukaran', 'point biserial', 'teori tes klasik']],
    ["Aiken's V", ['aiken']],
    ['CVR / CVI (Lawshe)', ['cvr', 'cvi', 'lawshe', 'content validity ratio', 'content validity index']],
    ["Cronbach's alpha", ['cronbach', 'koefisien alpha', 'alfa cronbach']],
    ['Omega McDonald', ['omega']],
    ['DIF (keadilan butir)', ['differential item functioning', 'dif', 'mantel haenszel']],
    ['Invariansi pengukuran', ['invariansi pengukuran', 'measurement invariance', 'invariansi konfigural', 'invariansi metrik', 'invariansi skalar']],
    ['Validitas konvergen/diskriminan', ['validitas konvergen', 'validitas diskriminan', 'fornell', 'htmt']],
    ['Uji normalitas', ['uji normalitas', 'kolmogorov', 'shapiro', 'lilliefors']],
    ['Uji homogenitas', ['uji homogenitas', 'levene', 'bartlett']],
    ['Kesepakatan antarpenilai (kappa/ICC)', ['kappa', 'inter rater', 'antar penilai', 'antarpenilai', 'icc', 'intraclass']],
    ['Analisis tematik', ['analisis tematik', 'thematic analysis']],
    ['Model Miles & Huberman', ['miles', 'huberman', 'kondensasi data', 'reduksi data']],
    ['NVivo / ATLAS.ti', ['nvivo', 'atlas ti']],
    ['System Usability Scale (SUS)', ['system usability scale']],
    ['N-gain', ['n gain', 'normalized gain']],
    ['Statistik deskriptif', ['statistik deskriptif', 'analisis deskriptif']],
  ];

  const PARADIGMA = {
    positivisme: { label: 'Positivisme', kw: ['positivisme', 'positivistik', 'positivism', 'positivist'] },
    postpositivisme: { label: 'Post-positivisme', kw: ['post positivisme', 'postpositivisme', 'pasca positivisme', 'post positivism', 'postpositivism', 'post positivistik'] },
    konstruktivis: { label: 'Konstruktivis/interpretif', kw: ['paradigma konstruktivis', 'paradigma konstruktivisme', 'konstruktivis interpretif', 'interpretif', 'interpretivisme', 'interpretivism', 'interpretivist'] },
    pragmatisme: { label: 'Pragmatisme', kw: ['pragmatisme', 'pragmatism', 'paradigma pragmatis'] },
    kritis: { label: 'Kritis/transformatif', kw: ['paradigma kritis', 'teori kritis', 'paradigma transformatif', 'critical theory'] },
  };

  const TEORI = [
    ['Konstruktivisme sosial (Vygotsky)', ['konstruktivisme sosial', 'social constructivism', 'vygotsky', 'zone of proximal', 'zpd']],
    ['Konstruktivisme (Piaget)', ['konstruktivisme kognitif', 'piaget']],
    ['Activity Theory / CHAT (Engeström)', ['activity theory', 'cultural historical activity', 'chat', 'engestrom', 'teori aktivitas']],
    ['Konektivisme (Siemens)', ['konektivisme', 'connectivism', 'siemens']],
    ['Behaviorisme', ['behaviorisme', 'behaviorism', 'skinner']],
    ['Kognitivisme / teori beban kognitif', ['kognitivisme', 'cognitive load', 'beban kognitif', 'sweller']],
    ['Teori kognitif sosial (Bandura)', ['social cognitive', 'kognitif sosial', 'self efficacy', 'efikasi diri', 'bandura']],
    ['Self-Determination Theory', ['self determination theory', 'deci', 'ryan']],
    ['Theory of Planned Behavior (Ajzen)', ['theory of planned behavior', 'planned behaviour', 'ajzen']],
    ['TAM / UTAUT', ['technology acceptance model', 'utaut', 'davis']],
    ['Teori sistem', ['teori sistem', 'general system', 'bertalanffy']],
    ['Human capital', ['human capital', 'modal manusia']],
    ['Experiential learning (Kolb)', ['experiential learning', 'kolb']],
    ['Situated learning / community of practice', ['situated learning', 'community of practice', 'lave', 'wenger']],
    ['Ekologi Bronfenbrenner', ['bronfenbrenner', 'ekologi perkembangan']],
    ['Difusi inovasi (Rogers)', ['diffusion of innovation', 'difusi inovasi']],
    ['Kepemimpinan transformasional (Bass)', ['kepemimpinan transformasional', 'transformational leadership']],
    ['Teori validitas (Messick/Kane)', ['messick', 'unified validity', 'argument based', 'validitas berbasis argumen', 'kane']],
    ['Teori tes klasik / IRT', ['teori tes klasik', 'classical test theory', 'item response theory', 'teori respons butir']],
    ['TPACK', ['tpack']],
    ['DigComp / kerangka kompetensi digital', ['digcomp', 'kompetensi digital']],
  ];

  const ANGKA = { satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10 };

  function run(ctx) {
    const { S, blocks, chap, jenisId, lengkap, add, H } = ctx;
    const { normalize, countWords, has, pad, extractCitations, ROMAN_OUT } = H;
    const nBab = lengkap ? (jenisId === 'kualitatif' ? 6 : 5) : 3;
    const chs = Array.from({ length: nBab }, (_, k) => chap(k));
    const bab = (k) => 'Bab ' + ROMAN_OUT[k + 1];
    const lastIdx = lengkap ? nBab - 1 : -1;
    const hasilIdx = lengkap ? 3 : -1;
    const out = {};

    // ------------------------------------------------- dimensi konseptual
    {
      const dims = new Map();
      const addDim = (name, src) => {
        let nm = name.replace(/\(([A-Z]{1,3}\d{1,2})\)/, ' ').replace(/[“”"']/g, '').replace(/\s+/g, ' ').trim();
        const code = (/\(([A-Z]{1,3}\d{1,2})\)/.exec(name) || [])[1] || null;
        nm = nm.replace(/[.:;,]+$/, '');
        if (countWords(nm) < 1 || countWords(nm) > 7) return;
        const key = normalize(nm);
        if (!key || /^(yang|ini|tersebut|lain|utama|pertama|kedua)$/.test(key)) return;
        if (!dims.has(key)) dims.set(key, { label: nm, code, words: key.split(' ').filter((w) => w.length > 2), src });
      };
      const scope = [chs[1], chs[2]].filter(Boolean);
      let declared = null;
      for (const ch of scope) {
        for (const h of ch.headings) {
          const m = /^(?:[a-z0-9]{1,3}[.)]\s*)?(?:dimensi|aspek)\s+(?:ke\s?\d+\s*[:.]?\s*)?(.{2,80})$/i.exec(h.text.trim());
          if (m && !/^(yang|dan|dalam)\b/i.test(m[1])) addDim(m[1], bab(ch.num - 1) + ' (subjudul)');
        }
        for (const b of ch.blocks) {
          if (b._toc) continue;
          const m = /terdiri\s+(?:atas|dari)\s+(\w+)\s+(?:dimensi|aspek)\s*,?\s*(?:yaitu|yakni|meliputi|:)?\s*([^.]{5,400})/i.exec(b.text);
          if (m) {
            const n = ANGKA[m[1].toLowerCase()] || parseInt(m[1], 10);
            if (n && !declared) declared = { n, where: bab(ch.num - 1) };
            m[2].split(/;|,|\bdan\b|\(\d+\)|\d\)/).map((s) => s.trim()).filter((s) => s.length > 2).slice(0, 10).forEach((s) => addDim(s, bab(ch.num - 1) + ' (kalimat)'));
          }
        }
      }
      const list = [...dims.values()].slice(0, 12);
      const tableNorm = (k) => (chs[k] ? chs[k].blocks.filter((b) => b.inTable).map((b) => b.norm).join(' ') : '');
      const cell = (d, k, opts = {}) => {
        if (!chs[k]) return { st: 'na', c: 0 };
        const src = opts.table ? tableNorm(k) : chs[k].norm;
        if (!src) return { st: opts.table ? 'na' : 'miss', c: 0 };
        if (has(src, d.label) || (d.code && pad(src).includes(' ' + d.code.toLowerCase() + ' '))) return { st: 'ok', c: 1 };
        const c = d.words.length ? d.words.filter((w) => pad(src).includes(' ' + w)).length / d.words.length : 0;
        return { st: c >= 0.6 ? 'warn' : 'miss', c };
      };
      const cols = [{ label: 'Bab II', k: 1 }, { label: 'Bab III', k: 2 }, { label: 'Kisi-kisi (tabel Bab III)', k: 2, table: true }];
      if (lengkap) cols.push({ label: 'Bab IV', k: hasilIdx }, { label: 'Tabel Bab IV', k: hasilIdx, table: true }, { label: bab(lastIdx), k: lastIdx });
      const rows = list.map((d) => ({ label: d.label + (d.code ? ' (' + d.code + ')' : ''), src: d.src, cells: cols.map((c) => cell(d, c.k, c)) }));
      out.dimensi = { cols: cols.map((c) => c.label), rows, declared };

      if (!list.length) {
        add('dimensi', { nama: 'Dimensi konseptual terbaca', hal: '30, 36', status: 'warn', lokasi: 'Bab II', detail: 'Tidak ada dimensi yang terbaca dari Bab II/III.', saran: 'Tulis dimensi sebagai subjudul (mis. "a. Dimensi Komunikasi") atau dengan kalimat "… terdiri atas lima dimensi, yaitu …" agar dapat dilacak.' });
      } else {
        add('dimensi', { nama: 'Dimensi konseptual terbaca', hal: '30, 36', status: 'ok', lokasi: 'Bab II', detail: list.length + ' dimensi: ' + list.map((d) => d.label).join('; ') + '.', saran: '' });
        if (declared) add('dimensi', { nama: 'Jumlah dimensi yang dinyatakan = yang diuraikan', hal: '30', status: declared.n === list.length ? 'ok' : 'warn', lokasi: declared.where, detail: 'Dinyatakan ' + declared.n + ' dimensi di ' + declared.where + '; terbaca ' + list.length + ' nama dimensi.', saran: 'Samakan jumlah dimensi yang dinyatakan dengan yang diuraikan dan diukur.' });
        const colIdx = (label) => cols.findIndex((c) => c.label === label);
        const miss = (label) => rows.filter((r) => { const c = r.cells[colIdx(label)]; return c && c.st === 'miss'; }).map((r) => r.label);
        const checks = [
          ['Bab II', 'Dimensi diuraikan secara konseptual (Bab II)', 'Uraikan setiap dimensi secara konseptual di Bab II.'],
          ['Bab III', 'Dimensi dioperasionalkan (definisi operasional, Bab III)', 'Setiap dimensi perlu dioperasionalkan di Bab III.'],
          ['Kisi-kisi (tabel Bab III)', 'Dimensi muncul di tabel kisi-kisi', 'Masukkan setiap dimensi ke tabel kisi-kisi beserta indikator dan nomor butir.'],
        ];
        if (lengkap) checks.push(['Bab IV', 'Dimensi dilaporkan di hasil (Bab IV)', 'Laporkan hasil (mis. muatan faktor, reliabilitas, skor) untuk setiap dimensi.'], [bab(lastIdx), 'Dimensi disinggung di simpulan', 'Simpulan perlu menyinggung temuan untuk setiap dimensi.']);
        for (const [label, nama, saran] of checks) {
          if (colIdx(label) < 0) continue;
          if (label.startsWith('Kisi') && !tableNorm(2)) { add('dimensi', { nama, hal: '30', status: 'info', lokasi: 'Bab III', detail: 'Tidak ada tabel terbaca di Bab III (atau berkas PDF).', saran: '' }); continue; }
          const m = miss(label);
          add('dimensi', { nama, hal: '30, 36', status: m.length === 0 ? 'ok' : m.length < rows.length / 2 ? 'warn' : 'miss', lokasi: label.replace(/ \(.*/, '').replace('Kisi-kisi', 'Bab III'), detail: m.length ? 'Tidak tampak: ' + m.join('; ') + '.' : 'Semua dimensi tampak.', saran });
        }
      }
    }

    // --------------------------------------- paradigma ↔ pendekatan ↔ teori
    {
      const all = ' ' + blocks.filter((b) => !b._toc).map((b) => b.norm).join(' ') + ' ';
      const count = (kw) => all.split(' ' + normalize(kw) + ' ').length - 1;
      const found = {};
      for (const [id, p] of Object.entries(PARADIGMA)) found[id] = p.kw.reduce((a, k) => a + count(k), 0);
      // "post positivisme" juga mengandung "positivisme"
      found.positivisme = Math.max(0, found.positivisme - found.postpositivisme);
      const stated = Object.entries(found).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
      const mixed = /mixed method|metode campuran|metode kombinasi|sequential (explanatory|exploratory)|konvergen paralel/.test(all);
      const pendekatan = jenisId === 'kualitatif' ? 'kualitatif' : mixed ? 'campuran' : 'kuantitatif';
      const sentP = blocks.find((b) => !b._toc && /\bparadigma\b/i.test(b.text) && stated.some(([id]) => PARADIGMA[id].kw.some((k) => b.norm.includes(normalize(k)))));
      const lokasiP = sentP ? (S.chapters.find((c) => c.blocks.includes(sentP)) || {}).num : null;
      out.paradigma = { stated: stated.map(([id, n]) => ({ label: PARADIGMA[id].label, n })), pendekatan };

      if (!stated.length) {
        add('paradigma', { nama: 'Paradigma penelitian dinyatakan', hal: '27', status: 'miss', lokasi: 'Bab I/III', detail: 'Tidak ada pernyataan paradigma (positivisme, post-positivisme, konstruktivis/interpretif, pragmatisme, kritis).', saran: 'Nyatakan paradigma penelitian; panduan meminta alur berpikir latar belakang mengikuti paradigma yang dipilih.' });
      } else {
        const main = stated[0][0];
        add('paradigma', { nama: 'Paradigma penelitian dinyatakan', hal: '27', status: 'ok', lokasi: lokasiP ? 'Bab ' + ROMAN_OUT[lokasiP] : 'seluruh naskah', detail: 'Terdeteksi: ' + stated.map(([id, n]) => PARADIGMA[id].label + ' (' + n + '×)').join(', ') + '.', bukti: sentP ? sentP.text.slice(0, 220) : null, saran: '' });
        let st = 'ok', det = '', saran = '';
        if (pendekatan === 'kuantitatif') {
          if (main === 'positivisme') det = 'Positivisme selaras dengan pendekatan kuantitatif (panduan hal. 27).';
          else if (main === 'postpositivisme') { st = 'warn'; det = 'Panduan hal. 27 memasangkan post-positivisme dengan pendekatan kualitatif, sedangkan naskah ini kuantitatif. Sebagian literatur metodologi (mis. Creswell) memasangkan post-positivisme dengan kuantitatif.'; saran = 'Jelaskan alasan memilih post-positivisme untuk penelitian kuantitatif dan rujuk sumbernya, atau sesuaikan dengan panduan.'; }
          else if (main === 'pragmatisme') { st = 'warn'; det = 'Pragmatisme lazim untuk metode campuran, sedangkan pendekatan terbaca kuantitatif.'; saran = 'Pastikan pendekatan (kuantitatif vs. campuran) dan paradigma dinyatakan konsisten.'; }
          else { st = 'miss'; det = PARADIGMA[main].label + ' tidak lazim untuk pendekatan kuantitatif.'; saran = 'Selaraskan paradigma dengan pendekatan kuantitatif (positivisme).'; }
        } else if (pendekatan === 'kualitatif') {
          if (main === 'postpositivisme' || main === 'konstruktivis' || main === 'kritis') det = PARADIGMA[main].label + ' selaras dengan pendekatan kualitatif (panduan hal. 27).';
          else { st = 'miss'; det = PARADIGMA[main].label + ' tidak selaras dengan pendekatan kualitatif.'; saran = 'Gunakan paradigma post-positivisme/konstruktivis sesuai panduan hal. 27.'; }
        } else {
          if (main === 'pragmatisme') det = 'Pragmatisme selaras dengan metode campuran.';
          else { st = 'warn'; det = 'Naskah memakai metode campuran, tetapi paradigma utama terbaca ' + PARADIGMA[main].label + '.'; saran = 'Jelaskan paradigma untuk tiap fase (mis. pragmatisme sebagai payung, positivisme untuk fase kuantitatif).'; }
        }
        add('paradigma', { nama: 'Paradigma selaras dengan pendekatan (' + pendekatan + ')', hal: '27', status: st, lokasi: 'seluruh naskah', detail: det, saran });
        const multi = stated.filter(([, n]) => n >= 2);
        if (multi.length > 1 && pendekatan !== 'campuran') add('paradigma', { nama: 'Satu paradigma yang konsisten', hal: '27', status: 'warn', lokasi: 'seluruh naskah', detail: 'Lebih dari satu paradigma disebut berulang: ' + multi.map(([id]) => PARADIGMA[id].label).join(', ') + '.', saran: 'Pastikan paradigma lain hanya dibahas sebagai pembanding, bukan sebagai paradigma penelitian.' });
      }

      // Grand theory
      const gtBlocks = blocks.filter((b) => !b._toc && /grand theory|teori utama|teori payung|landasan teoretis utama|teori induk/.test(b.norm));
      const gtNorm = gtBlocks.map((b) => b.norm).join(' ');
      const teori = TEORI.map(([label, kws]) => {
        const n = kws.reduce((a, k) => a + count(k), 0);
        return { label, kws, n, grand: kws.some((k) => has(gtNorm, k)) };
      }).filter((t) => t.n >= 3 || t.grand).sort((a, b) => (b.grand - a.grand) || (b.n - a.n)).slice(0, 6);
      const hn = (k) => (chs[k] ? chs[k].headings.map((h) => h.norm).join(' ') : '');
      const tcols = chs.map((_, k) => bab(k));
      const trows = teori.map((t) => ({
        label: t.label + (t.grand ? ' — grand theory' : ''),
        cells: chs.map((c, k) => {
          if (!c) return { st: 'na', c: 0 };
          const n = t.kws.reduce((a, kw) => a + (pad(c.norm).split(pad(normalize(kw))).length - 1), 0);
          const head = t.kws.some((kw) => has(hn(k), kw));
          return { st: head || n >= 3 ? 'ok' : n > 0 ? 'warn' : 'miss', c: n, where: head ? 'subjudul' : n + '×' };
        }),
      }));
      out.teori = { cols: tcols, rows: trows };

      if (!gtBlocks.length) add('paradigma', { nama: 'Grand theory dinyatakan eksplisit', hal: '29', status: teori.length ? 'warn' : 'miss', lokasi: 'Bab II', detail: 'Istilah "grand theory/teori utama" tidak ditemukan.' + (teori.length ? ' Teori yang dominan: ' + teori.map((t) => t.label).join(', ') + '.' : ''), saran: 'Nyatakan secara eksplisit teori/grand theory yang menjadi landasan penelitian (panduan hal. 29).' });
      else add('paradigma', { nama: 'Grand theory dinyatakan eksplisit', hal: '29', status: 'ok', lokasi: 'Bab II', detail: teori.filter((t) => t.grand).map((t) => t.label).join(', ') || 'Disebut, tetapi nama teorinya tidak dikenali otomatis.', bukti: gtBlocks[0].text.slice(0, 220), saran: '' });
      const grand = teori.filter((t) => t.grand);
      const track = grand.length ? grand : teori.slice(0, 1);
      for (const t of track) {
        const row = trows.find((r) => r.label.startsWith(t.label));
        const gaps = row.cells.map((c, k) => (c.st === 'miss' ? bab(k) : null)).filter(Boolean);
        add('paradigma', { nama: 'Grand theory dipakai di setiap bab: ' + t.label, hal: '26–31', status: gaps.length === 0 ? 'ok' : gaps.length === 1 ? 'warn' : 'miss', lokasi: 'seluruh naskah', detail: gaps.length ? 'Tidak disebut di ' + gaps.join(', ') + '.' : 'Disebut di semua bab.', saran: 'Grand theory perlu tampak sebagai das sollen (Bab I), landasan konstruk (Bab II), dasar instrumen/analisis (Bab III), dan rujukan pembahasan (Bab IV/V).' });
      }
      // Teori substantif vs paradigma pengukuran
      if (stated.length && pendekatan !== 'kualitatif' && teori.some((t) => /Konstruktivisme|CHAT|Konektivisme|Situated/.test(t.label)) && ['positivisme', 'postpositivisme'].includes(stated[0][0])) {
        const expl = /teori substantif|landasan substantif|sedangkan paradigma|kerangka pengukuran|secara ontologis|secara epistemologis/.test(all);
        add('paradigma', { nama: 'Teori belajar konstruktivistik × paradigma pengukuran positivistik dijelaskan', hal: '27, 29', status: expl ? 'ok' : 'warn', lokasi: 'Bab II/III', detail: 'Grand theory bercorak konstruktivistik dipakai bersama paradigma ' + PARADIGMA[stated[0][0]].label + '.' + (expl ? ' Ditemukan uraian posisi epistemologis.' : ''), saran: 'Jelaskan bahwa teori konstruktivistik dipakai sebagai landasan substantif konstruk, sedangkan pengukurannya mengikuti paradigma ' + PARADIGMA[stated[0][0]].label + '.' });
      }
    }

    // ------------------------------------------------------ tabel & gambar
    {
      const capRe = /^(tabel|table|gambar|figure|grafik|bagan|diagram)\s+(\d{1,2})[.\-](\d{1,3})\b\.?\s*(.*)$/i;
      const kind = (w) => (/^(tabel|table)$/i.test(w) ? 'Tabel' : 'Gambar');
      const caps = [];
      const body = S.body;
      body.forEach((b, i) => {
        if (b._toc || b.inTable && b.row > 0) return;
        const m = capRe.exec(b.text.trim());
        if (!m || b.words > 40) return;
        if (/^(menunjukkan|memperlihatkan|menyajikan|di atas|berikut|tersebut|dan|merupakan|terlihat|diketahui|menggambarkan|memuat|mendeskripsikan)\b/i.test(m[4])) return;
        const ch = S.chapters.find((c) => c.blocks.includes(b));
        caps.push({ jenis: kind(m[1]), bab: +m[2], no: +m[3], id: kind(m[1]) + ' ' + m[2] + '.' + m[3], judul: m[4], block: b, idx: blocks.indexOf(b), ch: ch ? ch.num : null });
      });
      const capIds = new Map();
      caps.forEach((c) => { capIds.set(c.id, (capIds.get(c.id) || 0) + 1); });
      const mentions = new Map();
      for (const b of body) {
        if (b._toc || caps.some((c) => c.block === b)) continue;
        for (const m of b.text.matchAll(/\b(tabel|table|gambar|figure|grafik|bagan|diagram)\s+(\d{1,2})\.(\d{1,3})\b/gi)) {
          const id = kind(m[1]) + ' ' + m[2] + '.' + m[3];
          if (!mentions.has(id)) mentions.set(id, []);
          mentions.get(id).push(b);
        }
      }
      out.tabel = { caps: caps.map((c) => ({ id: c.id, judul: c.judul, ch: c.ch, disebut: (mentions.get(c.id) || []).length })) };
      const nT = caps.filter((c) => c.jenis === 'Tabel').length, nG = caps.length - nT;
      add('tabel', { nama: 'Keterangan tabel dan gambar terbaca', hal: 'Lampiran 22–24', status: caps.length ? 'info' : 'warn', lokasi: 'seluruh naskah', detail: nT + ' tabel dan ' + nG + ' gambar berketerangan bernomor (format "Tabel 4.1 …").', saran: 'Beri keterangan bernomor per bab, mis. "Tabel 4.1 Judul" dan "Gambar 2.3 Judul".' });

      if (caps.length) {
        const dup = [...capIds.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        add('tabel', { nama: 'Nomor tabel/gambar tidak ganda', hal: 'Lampiran 24', status: dup.length ? 'miss' : 'ok', lokasi: 'seluruh naskah', detail: dup.length ? 'Nomor ganda: ' + dup.slice(0, 8).join(', ') + '.' : 'Tidak ada nomor ganda.', saran: 'Perbaiki penomoran agar setiap tabel/gambar bernomor unik.' });
        const wrongCh = caps.filter((c) => c.ch && c.bab !== c.ch);
        add('tabel', { nama: 'Nomor tabel/gambar sesuai bab', hal: 'Lampiran 24', status: wrongCh.length ? 'warn' : 'ok', lokasi: 'seluruh naskah', detail: wrongCh.length ? wrongCh.slice(0, 6).map((c) => c.id + ' berada di Bab ' + ROMAN_OUT[c.ch]).join('; ') + '.' : 'Semua nomor mengikuti babnya.', saran: 'Keterangan tabel memuat nomor bab tempat tabel berada (mis. Tabel 4.x di Bab IV).' });
        const gaps = [];
        for (const j of ['Tabel', 'Gambar']) {
          const byCh = {};
          caps.filter((c) => c.jenis === j).forEach((c) => { (byCh[c.bab] = byCh[c.bab] || []).push(c.no); });
          for (const [b, nos] of Object.entries(byCh)) {
            const mx = Math.max(...nos);
            for (let n = 1; n <= mx; n++) if (!nos.includes(n)) gaps.push(j + ' ' + b + '.' + n);
            for (let k = 1; k < nos.length; k++) if (nos[k] < nos[k - 1]) gaps.push(j + ' ' + b + '.' + nos[k] + ' (urutan mundur)');
          }
        }
        add('tabel', { nama: 'Penomoran berurutan tanpa loncatan', hal: 'Lampiran 24', status: gaps.length ? 'warn' : 'ok', lokasi: 'seluruh naskah', detail: gaps.length ? 'Loncatan/urutan: ' + gaps.slice(0, 8).join(', ') + (gaps.length > 8 ? ', …' : '') + '.' : 'Berurutan.', saran: 'Perbarui nomor (gunakan Insert Caption Word agar otomatis).' });
        const unref = caps.filter((c) => !mentions.has(c.id));
        add('tabel', { nama: 'Setiap tabel/gambar dirujuk di teks', hal: 'Lampiran 24', status: unref.length === 0 ? 'ok' : unref.length <= Math.max(2, caps.length * 0.1) ? 'warn' : 'miss', lokasi: 'seluruh naskah', detail: unref.length ? unref.length + ' tidak pernah disebut di teks: ' + unref.slice(0, 10).map((c) => c.id).join(', ') + (unref.length > 10 ? ', …' : '') + '.' : 'Semua dirujuk di teks.', saran: 'Rujuk setiap tabel/gambar di teks (mis. "seperti terlihat pada Tabel 4.2") dan bahas isinya.' });
        const dangling = [...mentions.keys()].filter((id) => !capIds.has(id));
        add('tabel', { nama: 'Rujukan di teks mengarah ke tabel/gambar yang ada', hal: 'Lampiran 24', status: dangling.length === 0 ? 'ok' : dangling.length <= 2 ? 'warn' : 'miss', lokasi: 'seluruh naskah', detail: dangling.length ? 'Disebut di teks tetapi keterangannya tidak ada: ' + dangling.slice(0, 10).join(', ') + '.' : 'Semua rujukan cocok.', saran: 'Periksa nomor yang disebut di teks setelah tabel/gambar ditambah atau dihapus.' });

        // Posisi keterangan tabel: di atas tabel (Lampiran 24).
        if (blocks.some((b) => b.tableId)) {
          const below = caps.filter((c) => c.jenis === 'Tabel' && !c.block.inTable).filter((c) => {
            const next = blocks[c.idx + 1], prev = blocks[c.idx - 1];
            return !(next && next.tableId) && prev && prev.tableId;
          });
          add('tabel', { nama: 'Keterangan tabel di atas tabel', hal: 'Lampiran 24', status: below.length ? 'warn' : 'ok', lokasi: 'seluruh naskah', detail: below.length ? 'Keterangan berada di bawah tabel: ' + below.slice(0, 6).map((c) => c.id).join(', ') + '.' : 'Keterangan tabel berada di atas tabel.', saran: 'Letakkan keterangan tabel di atas tabel, rata tengah.' });
          const imgs = S.body.reduce((a, b) => a + (b.imagesBefore || 0) + (b.hasImage ? 1 : 0), 0);
          if (imgs) add('tabel', { nama: 'Setiap gambar memiliki keterangan', hal: 'Lampiran 22', status: imgs <= nG ? 'ok' : 'warn', lokasi: 'seluruh naskah', detail: imgs + ' objek gambar di isi naskah; ' + nG + ' keterangan gambar.', saran: 'Beri setiap gambar keterangan bernomor ("Gambar x.y Judul").' });
        }

        // Daftar Tabel / Daftar Gambar ↔ keterangan
        for (const [j, head] of [['Tabel', 'daftar tabel'], ['Gambar', 'daftar gambar']]) {
          const hi = S.front.findIndex((b) => b.norm === head || b.norm.startsWith(head + ' '));
          if (hi < 0) continue;
          const ids = new Set();
          for (let k = hi + 1; k < S.front.length; k++) {
            const b = S.front[k];
            if (/^daftar\s/.test(b.norm) && k > hi + 1) break;
            const m = capRe.exec(b.text.trim());
            if (m && kind(m[1]) === j) ids.add(j + ' ' + m[2] + '.' + m[3]);
          }
          if (!ids.size) continue;
          const real = new Set(caps.filter((c) => c.jenis === j).map((c) => c.id));
          const notInList = [...real].filter((id) => !ids.has(id));
          const notInBody = [...ids].filter((id) => !real.has(id));
          add('tabel', { nama: 'Daftar ' + j + ' sinkron dengan isi', hal: '25–26', status: notInList.length + notInBody.length === 0 ? 'ok' : 'warn', lokasi: 'Bagian awal', detail: 'Daftar ' + j + ': ' + ids.size + ' entri; di isi: ' + real.size + '.' + (notInList.length ? ' Belum masuk daftar: ' + notInList.slice(0, 6).join(', ') + '.' : '') + (notInBody.length ? ' Ada di daftar tetapi tidak di isi: ' + notInBody.slice(0, 6).join(', ') + '.' : ''), saran: 'Perbarui Daftar ' + j + ' (klik kanan → Update Field di Word).' });
        }

        // Angka di teks ↔ isi tabel
        const tablesById = new Map();
        for (const b of blocks) if (b.tableId) { if (!tablesById.has(b.tableId)) tablesById.set(b.tableId, []); tablesById.get(b.tableId).push(b); }
        const numKey = (s) => { const v = parseFloat(s.replace(',', '.')); return isNaN(v) ? null : v; };
        const numsIn = (t) => [...t.matchAll(/(?<![\d.,])(\d{0,3}[.,]\d{1,4})(?![\d])/g)].map((m) => numKey(m[1])).filter((v) => v != null);
        const mismatch = [];
        let checked = 0;
        for (const c of caps.filter((x) => x.jenis === 'Tabel')) {
          let t = null;
          for (let k = c.idx + 1; k <= c.idx + 3 && k < blocks.length; k++) if (blocks[k].tableId) { t = tablesById.get(blocks[k].tableId); break; }
          if (!t) continue;
          const tv = numsIn(t.map((b) => b.text).join(' '));
          if (!tv.length) continue;
          const close = (v) => tv.some((x) => Math.abs(x - v) < 0.0051 || Math.abs(x * 100 - v) < 0.051 || Math.abs(x - v * 100) < 0.051);
          for (const b of mentions.get(c.id) || []) {
            // Buang nomor tabel/gambar/subbab agar "Tabel 4.2" tidak terbaca sebagai 4,2.
            // Daftar seperti "Tabel 4.13 dan 4.14" juga dibuang.
            const nums = numsIn(b.text
              .replace(/\b(tabel|table|gambar|figure|grafik|bagan|diagram|bab|subbab|lampiran|persamaan|bagian|tahap|fase|langkah)\s+[IVX\d]+(\.\d+)*((\s*(,|dan|&|–|-|hingga|sampai|serta)\s*)\d+\.\d+)*/gi, ' ')
              .replace(/\b\d+\.\d+(\.\d+)+\b/g, ' '));
            if (!nums.length) continue;
            checked++;
            const bad = nums.filter((v) => !close(v));
            if (bad.length && bad.length >= Math.ceil(nums.length / 2)) mismatch.push(c.id + ': ' + bad.slice(0, 4).map((v) => String(v).replace('.', ',')).join(', '));
          }
        }
        out.tabel.mismatch = mismatch;
        if (checked) add('tabel', { nama: 'Angka di teks sesuai isi tabel yang dirujuk', hal: '30', status: mismatch.length === 0 ? 'ok' : mismatch.length <= 2 ? 'warn' : 'miss', lokasi: 'Bab IV', detail: checked + ' paragraf yang merujuk tabel diperiksa.' + (mismatch.length ? ' Angka desimal di teks yang tidak ada di tabelnya — ' + mismatch.slice(0, 6).join('; ') + '.' : ' Angka desimal di teks ditemukan di tabel masing-masing.'), saran: 'Cocokkan angka yang dikutip di teks dengan tabel yang dirujuk (pembulatan, salah nomor tabel, atau nilai lama).' });
      }
    }

    // ------------------------------------------- teknik analisis Bab III ↔ IV
    if (lengkap && chs[2] && chs[3]) {
      const n3 = chs[2].norm, n4 = (chs[3] ? chs[3].norm : '') + ' ' + (jenisId === 'kualitatif' && chs[4] ? chs[4].norm : '');
      const rows = TEKNIK.map(([nama, kws]) => ({ nama, b3: kws.some((k) => has(n3, k)), b4: kws.some((k) => has(n4, k)) })).filter((r) => r.b3 || r.b4);
      out.teknik = rows;
      const planned = rows.filter((r) => r.b3 && !r.b4).map((r) => r.nama);
      const unplanned = rows.filter((r) => !r.b3 && r.b4).map((r) => r.nama);
      add('statistik', { nama: 'Sinkronisasi Teknik Analisis: Bab III (Rencana) ↔ Bab IV (Pelaksanaan)', hal: '30', status: planned.length === 0 ? 'ok' : planned.length <= 1 ? 'warn' : 'miss', lokasi: 'Bab III & Bab IV', detail: planned.length ? 'Direncanakan di Bab III tetapi belum tampak pelaporannya di Bab IV: ' + planned.join(', ') + '.' : rows.filter((r) => r.b3).length + ' teknik di Bab III semuanya tampak di hasil.', saran: 'Laporkan hasil setiap teknik analisis yang direncanakan di Bab IV, atau sederhanakan rencana analisis di Bab III.' });
      add('statistik', { nama: 'Validasi Teknik Analisis: Teknik Bab IV Tercantum di Bab III', hal: '30', status: unplanned.length === 0 ? 'ok' : unplanned.length <= 1 ? 'warn' : 'miss', lokasi: 'Bab III & Bab IV', detail: unplanned.length ? 'Dipakai di hasil Bab IV tetapi belum dijelaskan di Bab III: ' + unplanned.join(', ') + '.' : 'Semua teknik di hasil sudah dijelaskan di Bab III.', saran: 'Uraikan teknik tersebut di bagian Teknik Analisis Data Bab III beserta kriteria rujukannya.' });
    }

    // ------------------------------------------ nilai statistik ↔ kriteria
    if (chs[3] || (!lengkap && chs[2])) {
      const scopeBlocks = (chs[3] || chs[2]).blocks.filter((b) => !b._toc);
      const reports = new Map();
      const push = (s, v, where) => { if (!reports.has(s.id)) reports.set(s.id, []); reports.get(s.id).push({ v, where }); };
      const numRe = /^[\s:=(]*(-?\d{0,3}[.,]\d{1,4}|\d{1,3})(?![\d.,]*\s*%)/;
      const criterionBefore = (txt) => /[≥≤<>]|minimal|maksimal|lebih (dari|besar|kecil)|kurang dari|kriteria|batas|cut[- ]?off|di atas|di bawah|threshold/i.test(txt);
      // Teks
      for (const b of scopeBlocks.filter((x) => !x.inTable)) {
        for (const s of STAT) {
          const re = new RegExp(s.re.source, s.re.flags.includes('i') ? 'gi' : 'g');
          let m;
          while ((m = re.exec(b.text))) {
            // "taraf signifikansi alpha 0,05" bukan koefisien reliabilitas
            if (/signifikan|taraf|significance|level|tingkat kesalahan/i.test(b.text.slice(Math.max(0, m.index - 30), m.index))) continue;
            const tail = b.text.slice(m.index + m[0].length, m.index + m[0].length + 30);
            const pre = tail.slice(0, Math.max(0, tail.search(/\d/)));
            if (criterionBefore(pre)) continue;
            const n = numRe.exec(tail.replace(/^[^\d\-]{0,12}?(?=[-\d.,])/, ''));
            if (!n || (!/[.,]/.test(n[1]) && !['chidf', 'vif'].includes(s.id))) continue;
            const v = parseFloat(n[1].replace(',', '.'));
            if (!isNaN(v)) push(s, v, 'teks');
          }
        }
      }
      // Tabel: label di sel → angka di sel kanan pada baris yang sama
      const grid = new Map();
      for (const b of scopeBlocks.filter((x) => x.tableId)) {
        const g = grid.get(b.tableId) || {};
        const key = b.row + ':' + b.col;
        g[key] = (g[key] ? g[key] + ' ' : '') + b.text;
        grid.set(b.tableId, g);
      }
      for (const g of grid.values()) {
        for (const [key, txt] of Object.entries(g)) {
          const [r, c] = key.split(':').map(Number);
          for (const s of STAT) {
            if (!s.re.test(txt) || txt.length > 40) continue;
            const cellNum = (t) => { if (!t || criterionBefore(t)) return null; const n = /^\s*(-?\d{0,3}[.,]\d{1,4}|\d{1,3})\s*$/.exec(t.replace(/\*+$/, '')); if (!n || (!/[.,]/.test(n[1]) && !['chidf', 'vif'].includes(s.id))) return null; return parseFloat(n[1].replace(',', '.')); };
            let got = false;
            for (let cc = c + 1; cc <= c + 4; cc++) {
              const v = cellNum(g[r + ':' + cc]);
              if (v != null) { push(s, v, 'tabel'); got = true; break; }
            }
            // Label di baris judul kolom: ambil angka di bawahnya (mis. kolom Infit MNSQ).
            if (!got && r <= 1) for (let rr = r + 1; rr < r + 400; rr++) {
              if (!(rr + ':' + c in g) && !(rr + ':0' in g)) break;
              const v = cellNum(g[rr + ':' + c]);
              if (v != null) push(s, v, 'tabel');
            }
          }
        }
      }
      const judge = (s, v) => {
        if (s.arah === 'min') return v >= s.ok ? 'ok' : v >= s.warn ? 'warn' : 'miss';
        if (s.arah === 'max') return v <= s.ok ? 'ok' : v <= s.warn ? 'warn' : 'miss';
        if (s.arah === 'absmax') return Math.abs(v) <= s.ok ? 'ok' : 'miss';
        if (s.arah === 'range') return v >= s.lo && v <= s.hi ? 'ok' : 'warn';
        return 'info';
      };
      const statRows = [];
      for (const s of STAT) {
        const r = reports.get(s.id);
        if (!r) continue;
        // buang nilai yang jelas bukan nilai indeks (mis. derajat bebas)
        const vals = r.filter((x) => (s.id === 'chidf' || s.id === 'vif') ? x.v > 0 && x.v < 100 : Math.abs(x.v) <= 1.5 || s.arah === 'range');
        if (!vals.length) continue;
        const seen = new Set();
        const judged = vals.filter((x) => { const k = x.v.toFixed(4); if (seen.has(k)) return false; seen.add(k); return true; }).map((x) => ({ ...x, st: judge(s, x.v) }));
        const worst = judged.some((x) => x.st === 'miss') ? 'miss' : judged.some((x) => x.st === 'warn') ? 'warn' : 'ok';
        const fmt = (v) => String(Math.round(v * 1000) / 1000).replace('.', ',');
        statRows.push({ nama: s.nama, nilai: judged.map((x) => fmt(x.v)), status: worst, kriteria: s.kriteria, sumber: s.sumber });
        const low = judged.filter((x) => x.st !== 'ok');
        const nOk = judged.length - low.length, nWarn = judged.filter((x) => x.st === 'warn').length, nMiss = judged.filter((x) => x.st === 'miss').length;
        const rincian = s.arah === 'range' || s.arah === 'absmax' ? nOk + ' memenuhi, ' + (nWarn + nMiss) + ' di luar rentang.' : nOk + ' baik, ' + nWarn + ' dapat diterima, ' + nMiss + ' di bawah batas.';
        add('statistik', {
          nama: s.nama + ' — ' + s.kriteria, hal: 'buku acuan', lokasi: lengkap ? 'Bab IV (Hasil Penelitian)' : 'Bab III (Rencana Analisis)',
          status: worst === 'miss' ? 'warn' : worst,
          detail: judged.length + ' nilai berbeda dilaporkan: ' + judged.slice(0, 8).map((x) => fmt(x.v)).join('; ') + (judged.length > 8 ? '; …' : '') + '. ' + rincian + ' Sumber: ' + s.sumber + '.',
          saran: low.length ? 'Bahas nilai ' + s.nama + ' yang di luar kriteria (' + s.kriteria + '): beri justifikasi atau tindak lanjut (revisi butir, modifikasi model, atau kriteria alternatif yang dirujuk).' : '',
        });
      }
      out.stat = statRows;
      if (!statRows.length && ['instrumen', 'asosiatif', 'eksperimen', 'rnd'].includes(jenisId)) {
        add('statistik', {
          nama: 'Pelaporan Nilai Statistik Pengujian (Bab IV: Hasil Penelitian)',
          hal: 'buku acuan',
          status: 'info',
          lokasi: 'Bab IV (Hasil Penelitian)',
          detail: 'Nilai indeks statistik pengujian (seperti CFI, RMSEA, KMO, Cronbach\'s alpha, AVE, VIF, dll.) belum terdeteksi di Bab IV.',
          saran: 'Pada Bab IV (Hasil Penelitian dan Pembahasan), cantumkan tabel dan narasi hasil estimasi statistik pengujian instrumen/model beserta nilai numeriknya (misal: "CFI = 0.96", "RMSEA = 0.04", "Alpha = 0.88") dan bandingkan dengan kriteria buku acuan psikometri (Hair et al., 2010; Wiley Handbook; Downing & Haladyna). Untuk rancangan teknik pengujiannya tetap dijelaskan di Bab III.'
        });
      }
    }

    // ------------------------------------------------------- ringkasan bab
    out.perBab = S.chapters.map((c) => {
      const caps = (out.tabel && out.tabel.caps || []).filter((x) => x.ch === c.num);
      const cites = extractCitations(c.blocks);
      return {
        num: c.num, label: 'Bab ' + ROMAN_OUT[c.num],
        judul: c.titleIdx !== c.idx ? blocks[c.titleIdx].text : c.raw.replace(/^BAB\s+\S+\s*/i, ''),
        words: c.words,
        pct: S.body.length ? Math.round((c.words / Math.max(1, S.chapters.reduce((a, x) => a + x.words, 0))) * 100) : 0,
        headings: c.headings.length,
        tabel: caps.filter((x) => x.id.startsWith('Tabel')).length,
        gambar: caps.filter((x) => x.id.startsWith('Gambar')).length,
        sitasi: cites.length,
        sitasiUnik: new Set(cites.map((x) => x.key + x.year)).size,
        per1000: c.words ? Math.round((cites.length / c.words) * 10000) / 10 : 0,
      };
    });
    return out;
  }

  global.Lanjut = { run, STAT };
})(window);
