/* Telaah SLR — penyimpanan (IndexedDB), templat formulir, dan data contoh */
'use strict';

const DB = {
  db: null,
  mem: { kv: {}, texts: {}, pdfs: {} }, // cadangan bila IndexedDB tidak tersedia
  async open() {
    try {
      this.db = await new Promise((res, rej) => {
        const req = indexedDB.open('telaah-slr', 1);
        req.onupgradeneeded = () => {
          const d = req.result;
          ['kv', 'texts', 'pdfs'].forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); });
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB tidak tersedia, data hanya disimpan di memori.', e);
      this.db = null;
    }
  },
  tx(store, mode, fn) {
    if (!this.db) return Promise.resolve(fn(null));
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      const r = fn(s);
      if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
    });
  },
  async get(store, key) {
    if (!this.db) return this.mem[store][key];
    return this.tx(store, 'readonly', s => s.get(key));
  },
  async put(store, key, val) {
    if (!this.db) { this.mem[store][key] = val; return; }
    return this.tx(store, 'readwrite', s => s.put(val, key));
  },
  async del(store, key) {
    if (!this.db) { delete this.mem[store][key]; return; }
    return this.tx(store, 'readwrite', s => s.delete(key));
  },
  async clear(store) {
    if (!this.db) { this.mem[store] = {}; return; }
    return this.tx(store, 'readwrite', s => s.clear());
  },
  async keys(store) {
    if (!this.db) return Object.keys(this.mem[store]);
    return this.tx(store, 'readonly', s => s.getAllKeys());
  }
};

/* ---------- Templat formulir ekstraksi ---------- */
const DESIGNS = ['RCT', 'Kuasi-eksperimen', 'Kohort', 'Kasus-kontrol', 'Potong lintang', 'Kualitatif', 'Metode campuran', 'Review', 'Lainnya'];

const FIELD_TEMPLATES = {
  slr: [
    { id: 'study_id', label: 'ID studi (Penulis, Tahun)', type: 'text' },
    { id: 'country', label: 'Negara', type: 'text' },
    { id: 'design', label: 'Desain studi', type: 'select', options: DESIGNS },
    { id: 'setting', label: 'Setting', type: 'text' },
    { id: 'population', label: 'Populasi / partisipan', type: 'textarea' },
    { id: 'sample', label: 'Jumlah sampel (n)', type: 'number' },
    { id: 'intervention', label: 'Intervensi / paparan', type: 'textarea' },
    { id: 'comparator', label: 'Pembanding', type: 'textarea' },
    { id: 'outcomes', label: 'Outcome & alat ukur', type: 'textarea' },
    { id: 'findings', label: 'Temuan utama', type: 'textarea' },
    { id: 'rob', label: 'Risiko bias', type: 'select', options: ['Rendah', 'Beberapa kekhawatiran', 'Tinggi', 'Tidak dinilai'] },
    { id: 'rob_note', label: 'Alasan penilaian risiko bias', type: 'textarea' },
    { id: 'limitations', label: 'Keterbatasan', type: 'textarea' },
    { id: 'notes', label: 'Catatan', type: 'textarea' }
  ],
  scoping: [
    { id: 'study_id', label: 'ID sumber (Penulis, Tahun)', type: 'text' },
    { id: 'country', label: 'Negara', type: 'text' },
    { id: 'source_type', label: 'Jenis sumber bukti', type: 'select', options: ['Artikel empiris', 'Review', 'Laporan / grey literature', 'Dokumen kebijakan', 'Opini / editorial', 'Lainnya'] },
    { id: 'aim', label: 'Tujuan studi', type: 'textarea' },
    { id: 'population', label: 'Partisipan (P)', type: 'textarea' },
    { id: 'concept', label: 'Konsep (C)', type: 'textarea' },
    { id: 'context', label: 'Konteks (C)', type: 'textarea' },
    { id: 'design', label: 'Metodologi / desain', type: 'select', options: DESIGNS },
    { id: 'sample', label: 'Jumlah sampel (n)', type: 'number' },
    { id: 'key_findings', label: 'Temuan terkait pertanyaan review', type: 'textarea' },
    { id: 'gaps', label: 'Kesenjangan & rekomendasi', type: 'textarea' },
    { id: 'notes', label: 'Catatan', type: 'textarea' }
  ],
  meta_extra: [
    { id: 'ma_outcome', label: 'Nama outcome', type: 'text', group: 'ma' },
    { id: 'ma_type', label: 'Jenis data', type: 'select', options: ['Dikotomus', 'Kontinu', 'Efek generik'], group: 'ma' },
    { id: 'ma_e1', label: 'Event — intervensi', type: 'number', group: 'ma', showIf: ['Dikotomus'] },
    { id: 'ma_m1', label: 'Mean — intervensi', type: 'number', group: 'ma', showIf: ['Kontinu'] },
    { id: 'ma_sd1', label: 'SD — intervensi', type: 'number', group: 'ma', showIf: ['Kontinu'] },
    { id: 'ma_n1', label: 'N — intervensi', type: 'number', group: 'ma', showIf: ['Dikotomus', 'Kontinu'] },
    { id: 'ma_e2', label: 'Event — kontrol', type: 'number', group: 'ma', showIf: ['Dikotomus'] },
    { id: 'ma_m2', label: 'Mean — kontrol', type: 'number', group: 'ma', showIf: ['Kontinu'] },
    { id: 'ma_sd2', label: 'SD — kontrol', type: 'number', group: 'ma', showIf: ['Kontinu'] },
    { id: 'ma_n2', label: 'N — kontrol', type: 'number', group: 'ma', showIf: ['Dikotomus', 'Kontinu'] },
    { id: 'ma_es', label: 'Estimasi efek (OR/RR/HR/MD…)', type: 'number', group: 'ma', showIf: ['Efek generik'] },
    { id: 'ma_lo', label: 'CI 95% bawah', type: 'number', group: 'ma', showIf: ['Efek generik'] },
    { id: 'ma_hi', label: 'CI 95% atas', type: 'number', group: 'ma', showIf: ['Efek generik'] },
    { id: 'ma_subgroup', label: 'Subgrup', type: 'text', group: 'ma' }
  ]
};

function templateFields(type) {
  const base = type === 'scoping' ? FIELD_TEMPLATES.scoping : FIELD_TEMPLATES.slr;
  const f = base.map(x => ({ ...x }));
  if (type === 'meta') f.push(...FIELD_TEMPLATES.meta_extra.map(x => ({ ...x })));
  return f;
}

const DEFAULT_REASONS = {
  slr: ['Populasi tidak sesuai', 'Intervensi tidak sesuai', 'Pembanding tidak sesuai', 'Outcome tidak sesuai', 'Desain studi tidak sesuai', 'Bukan bahasa yang ditetapkan', 'Teks lengkap tidak tersedia', 'Publikasi ganda'],
  scoping: ['Partisipan tidak sesuai', 'Konsep tidak sesuai', 'Konteks tidak sesuai', 'Jenis sumber tidak sesuai', 'Bukan bahasa yang ditetapkan', 'Teks lengkap tidak tersedia'],
  meta: ['Populasi tidak sesuai', 'Intervensi tidak sesuai', 'Pembanding tidak sesuai', 'Outcome tidak sesuai', 'Desain studi tidak sesuai', 'Data efek tidak cukup untuk meta-analisis', 'Publikasi ganda', 'Teks lengkap tidak tersedia']
};

const TYPE_LABEL = { slr: 'Systematic Review', scoping: 'Scoping Review', meta: 'Meta-analisis' };
const FRAMEWORK = {
  slr: [['P', 'Populasi'], ['I', 'Intervensi'], ['C', 'Pembanding'], ['O', 'Outcome'], ['S', 'Desain studi']],
  meta: [['P', 'Populasi'], ['I', 'Intervensi'], ['C', 'Pembanding'], ['O', 'Outcome'], ['S', 'Desain studi']],
  scoping: [['P', 'Partisipan'], ['C', 'Konsep'], ['C', 'Konteks']]
};

function emptyScreen() {
  return { ta: { r1: null, r2: null, final: null }, ft: { r1: null, r2: null, final: null } };
}

function makeRecord(o) {
  return {
    id: uid('r'),
    title: '', abstract: '', authors: '', year: '', journal: '', doi: '', keywords: '',
    source: 'Tidak diketahui', sourceCat: 'database', batch: null,
    duplicateOf: null, notDuplicate: false, autoExcluded: false, notRetrieved: false,
    hasPdf: false, hasText: false, pages: 0,
    screen: emptyScreen(),
    extract: { r1: {}, r2: {}, final: {}, done: { r1: false, r2: false, final: false } },
    added: Date.now(),
    ...o
  };
}

function defaultState(type = 'slr') {
  return {
    version: 1,
    project: {
      title: 'Proyek review baru',
      type,
      question: '',
      framework: {},
      reviewers: ['Reviewer 1', 'Reviewer 2'],
      blind: true,
      created: today()
    },
    criteria: { mode: 'all', include: [], exclude: [] },
    reasons: DEFAULT_REASONS[type].slice(),
    fields: templateFields(type),
    batches: [],
    prisma: {
      lang: 'en', showOther: 'auto',
      removedOther: 0, otherRegisterManual: '',
      reportsOverride: '',
      otherWebsites: '', otherOrgs: '', otherCitation: ''
    },
    checklist: {},
    meta: { measure: 'OR', model: 'random', source: 'final', outcome: '' },
    records: [],
    skipped: [],
    isSample: false
  };
}

/* ---------- Data contoh (fiktif, ditandai jelas) ---------- */
function sampleState() {
  const s = defaultState('meta');
  s.isSample = true;
  s.project.title = 'Contoh: Intervensi mHealth & kontrol glikemik DM tipe 2';
  s.project.question = 'Apakah intervensi kesehatan seluler (mHealth) menurunkan HbA1c pada orang dewasa dengan diabetes melitus tipe 2 dibandingkan perawatan biasa?';
  s.project.framework = { P: 'Dewasa dengan DM tipe 2', I: 'Aplikasi ponsel / SMS / telemonitoring', C: 'Perawatan biasa', O: 'HbA1c', S: 'RCT' };
  s.criteria.include = [
    { id: uid('c'), label: 'Populasi: DM tipe 2', terms: '"type 2 diabetes", T2DM, "diabetes mellitus", diabet*' },
    { id: uid('c'), label: 'Intervensi: mHealth', terms: 'mHealth, "mobile health", smartphone, "mobile app*", SMS, "text messag*", telemonitoring' },
    { id: uid('c'), label: 'Outcome: HbA1c', terms: 'HbA1c, "glycated hemoglobin", "glycaemic control", "glycemic control"' },
    { id: uid('c'), label: 'Desain: RCT', terms: 'randomi*, RCT, "controlled trial"' }
  ];
  s.criteria.exclude = [
    { id: uid('c'), label: 'Bukan manusia / bukan studi primer', terms: 'mice, rats, animal, "systematic review", protocol, editorial' }
  ];
  const b = { id: uid('b'), name: 'Contoh — PubMed (fiktif)', cat: 'database', file: 'contoh.csv', count: 8, date: today() };
  const b2 = { id: uid('b'), name: 'Contoh — Penelusuran sitasi', cat: 'other', file: 'manual', count: 1, date: today() };
  s.batches = [b, b2];
  const recs = [
    ['Contoh A, Contoh B', '2021', 'Smartphone app-based self-management for type 2 diabetes: a randomised controlled trial (contoh fiktif)', 'Background: Self-management support is central to type 2 diabetes care. Methods: In this randomised controlled trial, 240 adults with type 2 diabetes were allocated to a smartphone app with glucose logging and feedback or usual care for 6 months. Results: HbA1c decreased more in the app group (mean difference -0.48%). Conclusion: Mobile app support improved glycemic control.', 'Jurnal Contoh Diabetes', '10.0000/contoh.001'],
    ['Contoh C, Contoh D', '2020', 'Text messaging reminders and glycated hemoglobin in adults with diabetes mellitus: a pragmatic RCT (contoh fiktif)', 'We randomized 180 adults with type 2 diabetes to weekly SMS reminders or usual care. Glycated hemoglobin at 12 months was lower in the SMS group. Adherence also improved.', 'Jurnal Contoh Kesehatan Digital', '10.0000/contoh.002'],
    ['Contoh E', '2019', 'Telemonitoring of blood glucose in insulin-treated patients: a controlled trial (contoh fiktif)', 'A controlled trial of telemonitoring in 96 insulin-treated adults with diabetes. HbA1c was measured at baseline and 6 months; randomisation was by clinic.', 'Jurnal Contoh Telemedis', '10.0000/contoh.003'],
    ['Contoh F, Contoh G', '2022', 'Mobile health for diabetes: a systematic review protocol (contoh fiktif)', 'This protocol describes a planned systematic review of mHealth interventions for type 2 diabetes with HbA1c as the primary outcome.', 'Jurnal Contoh Protokol', '10.0000/contoh.004'],
    ['Contoh H', '2018', 'Effects of a glucose-sensing smartphone accessory in diabetic rats (contoh fiktif)', 'We evaluated a smartphone accessory for glucose sensing in diabetic rats. Glycemic control was assessed weekly.', 'Jurnal Contoh Eksperimental', '10.0000/contoh.005'],
    ['Contoh I, Contoh J', '2023', 'Community health worker visits and glycaemic control in rural type 2 diabetes (contoh fiktif)', 'A cluster randomised trial of home visits by community health workers. HbA1c improved modestly. No digital component was used.', 'Jurnal Contoh Kesehatan Masyarakat', '10.0000/contoh.006'],
    ['Contoh K', '2021', 'Gamified mobile app for adolescents with type 1 diabetes (contoh fiktif)', 'Randomised trial of a gamified mobile app in 120 adolescents with type 1 diabetes. HbA1c did not differ between groups.', 'Jurnal Contoh Pediatri', '10.0000/contoh.007'],
    ['Contoh A, Contoh B', '2021', 'Smartphone app-based self-management for type 2 diabetes: a randomised controlled trial (contoh fiktif)', 'Duplikat dari rekaman pertama (diimpor dari basis data lain).', 'Jurnal Contoh Diabetes', '10.0000/contoh.001'],
    ['Contoh L, Contoh M', '2022', 'WhatsApp-based education and HbA1c in type 2 diabetes: randomized trial (contoh fiktif)', 'Adults with type 2 diabetes (n=150) were randomized to WhatsApp education messages or usual care. HbA1c fell by 0.6% in the mHealth arm.', 'Jurnal Contoh Edukasi', '10.0000/contoh.009']
  ];
  s.records = recs.map((r, i) => makeRecord({
    authors: r[0], year: r[1], title: r[2], abstract: r[3], journal: r[4], doi: r[5],
    source: i === 8 ? b2.name : b.name, sourceCat: i === 8 ? 'other' : 'database', batch: i === 8 ? b2.id : b.id
  }));
  const R = s.records;
  R[7].duplicateOf = R[0].id;
  const dec = (d, reason = '') => ({ d, reason, note: '', ts: Date.now() });
  // Skrining judul-abstrak
  [[0, 'include', 'include'], [1, 'include', 'include'], [2, 'include', 'maybe'], [3, 'exclude', 'exclude'], [4, 'exclude', 'exclude'],
   [5, 'exclude', 'include'], [6, 'exclude', 'exclude'], [8, 'include', 'include']].forEach(([i, a, b2]) => {
    R[i].screen.ta.r1 = dec(a); R[i].screen.ta.r2 = dec(b2);
  });
  R[2].screen.ta.final = { d: 'include', by: 'konsensus', ts: Date.now() };
  R[4].screen.ta.r1.reason = R[4].screen.ta.r2.reason = 'Populasi tidak sesuai';
  // Skrining teks lengkap
  [[0, 'include', 'include'], [1, 'include', 'include'], [2, 'exclude', 'exclude'], [8, 'include', 'include']].forEach(([i, a, b2]) => {
    R[i].screen.ft.r1 = dec(a); R[i].screen.ft.r2 = dec(b2);
  });
  R[2].screen.ft.r1.reason = R[2].screen.ft.r2.reason = 'Desain studi tidak sesuai';
  // Ekstraksi
  const ex = (o) => Object.assign({ design: 'RCT', ma_outcome: 'HbA1c', ma_type: 'Kontinu' }, o);
  R[0].extract.r1 = ex({ study_id: 'Contoh A 2021', country: 'Indonesia', sample: '240', ma_m1: '7.42', ma_sd1: '1.10', ma_n1: '120', ma_m2: '7.90', ma_sd2: '1.21', ma_n2: '118', findings: 'HbA1c turun lebih besar pada kelompok aplikasi.' });
  R[0].extract.r2 = ex({ study_id: 'Contoh A 2021', country: 'Indonesia', sample: '240', ma_m1: '7.42', ma_sd1: '1.10', ma_n1: '120', ma_m2: '7.90', ma_sd2: '1.21', ma_n2: '120', findings: 'Aplikasi memperbaiki kontrol glikemik.' });
  R[1].extract.r1 = ex({ study_id: 'Contoh C 2020', country: 'Malaysia', sample: '180', ma_m1: '7.80', ma_sd1: '1.30', ma_n1: '90', ma_m2: '8.10', ma_sd2: '1.25', ma_n2: '88' });
  R[1].extract.r2 = { ...R[1].extract.r1 };
  R[1].extract.final = { ...R[1].extract.r1 };
  R[8].extract.r1 = ex({ study_id: 'Contoh L 2022', country: 'Indonesia', sample: '150', ma_m1: '7.55', ma_sd1: '0.95', ma_n1: '75', ma_m2: '8.12', ma_sd2: '1.05', ma_n2: '74' });
  R[8].extract.r2 = { ...R[8].extract.r1 };
  R[8].extract.final = { ...R[8].extract.r1 };
  R[0].extract.done = { r1: true, r2: true, final: false }; // beda N kontrol → perlu konsensus
  R[1].extract.done = { r1: true, r2: true, final: true };
  R[8].extract.done = { r1: true, r2: true, final: true };
  s.meta.measure = 'MD';
  return s;
}
