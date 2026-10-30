/* Telaah SLR — templat pengaturan Excel/Word: buat, baca, dan petakan ke proyek.
   Dipakai di peramban (pustaka dimuat saat dibutuhkan) dan di Node (membuat file templat). */
'use strict';

const SettingsIO = {
  // Pustaka lokal vendor sebagai prioritas utama (offline-ready), CDN sebagai cadangan
  LIBS: {
    XLSX: 'vendor/xlsx.full.min.js',
    mammoth: 'vendor/mammoth.browser.min.js',
    JSZip: 'vendor/jszip.min.js'
  },
  CDN_LIBS: {
    XLSX: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    JSZip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
  },
  TYPE_NAMES: { slr: 'Systematic Review', scoping: 'Scoping Review', meta: 'Meta-analisis' },
  FIELD_TYPES: { text: 'Teks singkat', textarea: 'Paragraf', number: 'Angka', select: 'Pilihan', multi: 'Pilihan (banyak)' },

  loadLib(name) {
    if (typeof window !== 'undefined' && window[name]) return Promise.resolve(window[name]);
    if (typeof window === 'undefined') {
      try { return Promise.resolve(require(this.LIBS[name])); } catch (e) { return Promise.reject(e); }
    }
    return new Promise((res, rej) => {
      // 1. Coba muat pustaka lokal dari vendor lebih dulu
      const s = document.createElement('script');
      s.src = this.LIBS[name];
      s.onload = () => window[name] ? res(window[name]) : rej(new Error(name + ' tidak termuat dari lokal vendor'));
      s.onerror = () => {
        // 2. Jika gagal dari vendor, coba muat dari CDN publik
        const sCdn = document.createElement('script');
        sCdn.src = this.CDN_LIBS[name];
        sCdn.onload = () => window[name] ? res(window[name]) : rej(new Error(name + ' tidak termuat dari CDN'));
        sCdn.onerror = () => rej(new Error('Gagal memuat pustaka ' + name + ' (periksa koneksi internet atau keberadaan berkas di web_SLR/vendor/).'));
        document.head.appendChild(sCdn);
      };
      document.head.appendChild(s);
    });
  },

  /* ---------- Data -> baris tabel ---------- */
  FW_ROWS: [
    ['P', 'P – Populasi / Partisipan'],
    ['I', 'I – Intervensi / Fokus'],
    ['C', 'C – Pembanding (SLR/MA) atau Konsep (Scoping)'],
    ['Cx', 'Cx – Konteks (khusus Scoping)'],
    ['O', 'O – Outcome'],
    ['S', 'S – Desain studi']
  ],
  splitCode(label) {
    const m = String(label || '').match(/^\s*([A-Za-z]{1,3}\d{1,2}[a-z]?)\s*[–—:.-]\s*(.*)$/);
    return m ? [m[1], m[2]] : ['', String(label || '')];
  },
  rows(data) {
    const p = data.project || {};
    const fw = p.framework || {};
    const project = [['Isian', 'Nilai'],
      ['Judul proyek', p.title || ''],
      ['Jenis review', this.TYPE_NAMES[p.type] || 'Systematic Review'],
      ['Pertanyaan review', p.question || ''],
      ...this.FW_ROWS.map(([k, l]) => [l, fw[k] || '']),
      ['Reviewer 1', (p.reviewers || [])[0] || 'Reviewer 1'],
      ['Reviewer 2', (p.reviewers || [])[1] || 'Reviewer 2'],
      ['Jumlah reviewer', p.single ? '1' : '2'],
      ['Mode blind', p.blind && !p.single ? 'Ya' : 'Tidak'],
      ['Basis data yang ditelusuri (pisahkan dengan koma)', (p.databases || []).map(d => d.name || d).join(', ')],
      ['Aturan antar-kriteria inklusi', (data.criteria || {}).mode === 'any' ? 'OR (minimal satu cocok)' : 'AND (semua harus cocok)'],
      ['Bahasa yang diizinkan (kosongkan bila tidak dibatasi)', ((data.criteria || {}).lang && data.criteria.lang.on ? data.criteria.lang.allowed || [] : []).map(k => ({ en: 'Inggris', id: 'Indonesia', ms: 'Melayu', es: 'Spanyol', pt: 'Portugis', fr: 'Prancis', de: 'Jerman', it: 'Italia', tr: 'Turki', ru: 'Rusia', ar: 'Arab', zh: 'Mandarin', ja: 'Jepang', ko: 'Korea' }[k] || k)).join(', ')],
      ['Label alasan bahasa', ((data.criteria || {}).lang || {}).label || '']];
    const crit = [['Jenis', 'Kode', 'Nama kriteria', 'Kata kunci']];
    ['include', 'exclude'].forEach(k => ((data.criteria || {})[k] || []).forEach(c => { const [code, name] = this.splitCode(c.label); crit.push([k === 'include' ? 'Inklusi' : 'Eksklusi', code, name, c.terms || '']); }));
    const reasons = [['Kode', 'Alasan eksklusi'], ...(data.reasons || []).map(r => this.splitCode(r))];
    const fields = [['Label', 'Tipe', 'Opsi', 'Grup'], ...(data.fields || []).filter(f => f.group !== 'ma').map(f => [f.label, this.FIELD_TYPES[f.type] || 'Teks singkat', (f.options || []).join(', '), f.group || ''])];
    return { project, crit, reasons, fields };
  },
  GUIDE: [
    'Cara memakai templat ini',
    '1. Isi kolom "Nilai" di bagian Proyek. Baris yang dikosongkan tidak mengubah isian yang sudah ada di aplikasi.',
    '2. Kriteria: satu baris per kriteria. Jenis = Inklusi atau Eksklusi. Kata kunci dipisah koma; frasa pakai "tanda kutip"; wildcard pakai *, mis. "digital literac*", copyright.',
    '3. Alasan eksklusi: kode yang sama dengan kriteria eksklusi (E1, E2, …) dipakai untuk mengisi alasan otomatis di Papan.',
    '4. Formulir ekstraksi: Tipe = Teks singkat, Paragraf, Angka, Pilihan, atau Pilihan (banyak). Opsi dipisah koma. Grup bebas, mis. Pemetaan, Instrumen, Temuan.',
    '5. Jangan ubah judul kolom (baris pertama tiap tabel). Baris boleh ditambah atau dihapus.',
    '6. Di aplikasi: Proyek & Kriteria → Impor pengaturan → pilih file ini → periksa ringkasan → Terapkan.'
  ],

  /* ---------- Excel ---------- */
  buildXlsx(XLSX, data) {
    const R = this.rows(data);
    const wb = XLSX.utils.book_new();
    const add = (name, aoa, cols) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = cols.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
    add('Petunjuk', this.GUIDE.map(x => [x]), [120]);
    add('Proyek', R.project, [38, 110]);
    add('Kriteria', R.crit, [10, 8, 40, 120]);
    add('Alasan', R.reasons, [8, 90]);
    add('Formulir', R.fields, [40, 18, 70, 18]);
    return wb;
  },

  /* ---------- Word (.docx dibangun manual dengan JSZip) ---------- */
  xml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
  wPara(text, o = {}) {
    const rpr = `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>${o.bold ? '<w:b/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}<w:sz w:val="${o.size || 20}"/></w:rPr>`;
    return String(text ?? '').split('\n').map(line => `<w:p><w:pPr><w:spacing w:after="${o.after ?? 60}"/></w:pPr><w:r>${rpr}<w:t xml:space="preserve">${this.xml(line)}</w:t></w:r></w:p>`).join('');
  },
  wTable(rows, widths) {
    const total = widths.reduce((a, b) => a + b, 0);
    const border = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:color="A0AEB4"/>`).join('') + '</w:tblBorders>';
    const tr = (cells, head) => `<w:tr>${head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.map((c, i) => `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="DCE8EC"/>' : ''}</w:tcPr>${this.wPara(c, { bold: head, size: 19, after: 0 })}</w:tc>`).join('')}</w:tr>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${border}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.map((r, i) => tr(r, i === 0)).join('')}</w:tbl>${this.wPara('', { after: 120 })}`;
  },
  async buildDocx(JSZip, data) {
    const R = this.rows(data);
    const H = t => this.wPara(t, { bold: true, size: 26, color: '1F4E5A', after: 80 });
    const body = [
      this.wPara('Templat Pengaturan Telaah SLR', { bold: true, size: 34, color: '1F4E5A', after: 120 }),
      ...this.GUIDE.map((g, i) => this.wPara(g, { bold: i === 0, size: 19 })),
      this.wPara('', {}),
      H('1. Proyek'), this.wTable(R.project, [3300, 6700]),
      H('2. Kriteria inklusi & eksklusi'), this.wTable(R.crit, [1100, 800, 2900, 5200]),
      H('3. Alasan eksklusi'), this.wTable(R.reasons, [900, 9100]),
      H('4. Formulir ekstraksi data'), this.wTable(R.fields, [3300, 1700, 3600, 1400])
    ].join('');
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="950" w:bottom="1000" w:left="950" w:header="600" w:footer="600" w:gutter="0"/></w:sectPr></w:body></w:document>`);
    return zip;
  },

  /* ---------- Membaca file -> tabel ---------- */
  async tablesFromFile(file) {
    const name = (file.name || '').toLowerCase();
    // 1. Format Spreadsheet Excel / OpenDocument
    if (/\.(xlsx|xlsm|xls|ods)$/.test(name)) {
      const XLSX = await this.loadLib('XLSX');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      return wb.SheetNames.map(n => ({
        name: n,
        rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false })
      }));
    }
    // 2. Format Dokumen Word (.docx)
    if (/\.docx$/.test(name)) {
      const mammoth = await this.loadLib('mammoth');
      const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      const doc = new DOMParser().parseFromString(value, 'text/html');
      return [...doc.querySelectorAll('table')].map((t, i) => ({
        name: 'Tabel ' + (i + 1),
        rows: [...t.querySelectorAll('tr')].map(tr => [...tr.children].map(td => {
          const ps = td.querySelectorAll('p, li');
          return ps.length ? [...ps].map(p => p.textContent.trim()).join('\n').trim() : td.textContent.trim();
        }))
      }));
    }
    // 3. Format CSV, TSV, atau TXT
    if (/\.(csv|tsv|txt)$/.test(name)) {
      const text = await file.text();
      if (typeof Papa !== 'undefined') {
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        return [{ name: file.name.replace(/\.[^/.]+$/, ''), rows: parsed.data || [] }];
      } else {
        const lines = text.split(/\r?\n/).filter(Boolean);
        const delim = name.endsWith('.tsv') ? '\t' : (text.includes(';') && !text.includes(',') ? ';' : ',');
        const rows = lines.map(l => l.split(delim).map(c => c.trim().replace(/^"(.*)"$/, '$1')));
        return [{ name: file.name.replace(/\.[^/.]+$/, ''), rows }];
      }
    }
    if (/\.doc$/.test(name)) throw new Error('Format .doc lama belum didukung. Simpan ulang sebagai .docx di Word (File → Save As → Word Document).');
    throw new Error('Format file tidak dikenal. Silakan gunakan .xlsx, .docx, .csv, atau .json.');
  },

  /* ---------- Tabel -> pengaturan ---------- */
  parseTables(tables) {
    const out = {};
    const norm = s => String(s || '').trim().toLowerCase();
    const col = (head, re, not) => head.findIndex(h => re.test(h) && !(not && not.test(h)));

    tables.forEach(({ name, rows }) => {
      rows = rows.filter(r => r.some(c => String(c).trim()));
      if (!rows.length) return;

      // Pemindaian baris header cerdas (toleran terhadap baris judul atau catatan di baris 0)
      let headIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const rowNorm = rows[i].map(norm);
        if (rowNorm.some(h => /kata kunci|keyword|terms?|query|istilah|frasa|pencarian|indikator/i.test(h)) ||
            (rowNorm.some(h => /^alasan|reason/.test(h)) && !rowNorm.some(h => /^tipe$|^type$/.test(h))) ||
            (rowNorm.some(h => /label|kolom|nama kolom/.test(h)) && rowNorm.some(h => /tipe|type/.test(h))) ||
            (rowNorm.length >= 2 && (rowNorm.some(h => /isian|bagian|item|field|komponen/.test(h)) || /proyek|project/.test(norm(name))))) {
          headIdx = i;
          break;
        }
      }
      if (headIdx === -1) headIdx = 0;

      const head = rows[headIdx].map(norm);
      const body = rows.slice(headIdx + 1);
      const sheet = norm(name);

      // A. Tabel Kriteria (Inklusi / Eksklusi)
      if (head.some(h => /kata kunci|keyword|terms?|query|istilah|frasa|pencarian|indikator/i.test(h))) {
        const cj = col(head, /jenis|tipe|kategori|type/);
        const ck = col(head, /^kode|^code|^id$|^no$/);
        const cn = col(head, /nama|kriteria|label|criteri|dimensi|konstruk|variabel/, /kata kunci|keyword|terms?|jenis/);
        const ct = col(head, /kata kunci|keyword|terms?|query|istilah|frasa|pencarian|indikator/);
        const crit = { include: [], exclude: [] };

        body.forEach(r => {
          const code = ck >= 0 ? String(r[ck] || '').trim() : '';
          const nm = cn >= 0 ? String(r[cn] || '').trim() : '';
          const terms = ct >= 0 ? String(r[ct] || '').trim() : '';
          if (!terms && !nm) return;
          const kind = (cj >= 0 && /eks|exc/i.test(r[cj])) || (cj < 0 && /^e\d/i.test(code)) ? 'exclude' : 'include';
          crit[kind].push({
            label: code && nm ? `${code} – ${nm}` : code || nm,
            terms: terms.replace(/[“”]/g, '"')
          });
        });
        out.criteria = Object.assign(out.criteria || {}, crit);
      }
      // B. Tabel Alasan Eksklusi
      else if (head.some(h => /^alasan|reason/.test(h)) && !head.some(h => /^tipe$|^type$/.test(h))) {
        const ck = col(head, /^kode|^code|^id$|^no$/), ca = col(head, /alasan|reason/);
        out.reasons = body.map(r => {
          const c = ck >= 0 ? String(r[ck] || '').trim() : '';
          const a = String(r[ca] || '').trim();
          return !a ? '' : c && !a.startsWith(c) ? `${c} – ${a}` : a;
        }).filter(Boolean);
      }
      // C. Tabel Formulir Ekstraksi
      else if (head.some(h => /label|kolom|nama kolom/.test(h)) && head.some(h => /tipe|type/.test(h))) {
        const cl = col(head, /label|kolom/), ct = col(head, /tipe|type/), co = col(head, /opsi|pilihan|option/, /tipe/), cg = col(head, /grup|group|bagian/);
        const ids = new Set();
        out.fields = body.filter(r => String(r[cl] || '').trim()).map(r => {
          const label = String(r[cl]).trim(), tp = norm(r[ct]);
          const type = /banyak|multi|centang|checkbox/.test(tp) ? 'multi' : /pilih|select|dropdown/.test(tp) ? 'select' : /paragraf|panjang|textarea|long/.test(tp) ? 'textarea' : /angka|number|numer|bilangan/.test(tp) ? 'number' : 'text';
          let id = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'kolom';
          while (ids.has(id)) id += '_';
          ids.add(id);
          const f = { id, label, type, group: cg >= 0 ? String(r[cg] || '').trim() : '' };
          if (type === 'select' || type === 'multi') f.options = String(r[co] || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
          return f;
        });
      }
      // D. Tabel Metadata Proyek & PICO
      else if (head.length >= 2 && (head.some(h => /isian|bagian|item|field|komponen/.test(h)) || /proyek|project/.test(sheet))) {
        const P = { framework: {} };
        const kv = /isian|bagian|item|field|komponen/.test(head[0]) ? body : rows;
        kv.forEach(r => {
          const k = norm(r[0]), v = String(r[1] ?? '').trim();
          if (!k || !v) return;
          if (/judul|title/.test(k)) P.title = v;
          else if (/jenis|type of review/.test(k)) P.type = /scop/i.test(v) ? 'scoping' : /meta/i.test(v) ? 'meta' : 'slr';
          else if (/pertanyaan|question|^rq/.test(k)) P.question = P.question ? P.question + '\n' + v : v;
          else if (/reviewer\s*1/.test(k)) (P.reviewers = P.reviewers || ['Reviewer 1', 'Reviewer 2'])[0] = v;
          else if (/reviewer\s*2/.test(k)) (P.reviewers = P.reviewers || ['Reviewer 1', 'Reviewer 2'])[1] = v;
          else if (/jumlah reviewer|number of reviewer/.test(k)) P.single = /^\s*1\b|satu|single/i.test(v);
          else if (/basis data|database|sumber data/.test(k)) {
            const can = n => (typeof Sources !== 'undefined' ? { name: Sources.canon(n), cat: Sources.catOf(n) } : { name: n, cat: 'database' });
            P.databases = v.split(/[,;\n]/).map(x => x.trim()).filter(Boolean).map(can);
          }
          else if (/blind/.test(k)) P.blind = /^(ya|yes|y|aktif|true|1)/i.test(v);
          else if (/label alasan bahasa/.test(k)) { out.lang = out.lang || {}; out.lang.label = v; }
          else if (/bahasa|language/.test(k)) {
            const map = { inggris: 'en', english: 'en', indonesia: 'id', melayu: 'ms', malay: 'ms', spanyol: 'es', spanish: 'es', portugis: 'pt', portuguese: 'pt', prancis: 'fr', perancis: 'fr', french: 'fr', jerman: 'de', german: 'de', italia: 'it', turki: 'tr', rusia: 'ru', russian: 'ru', arab: 'ar', mandarin: 'zh', chinese: 'zh', jepang: 'ja', japanese: 'ja', korea: 'ko' };
            const al = v.toLowerCase().split(/[,;\/]| dan | and /).map(x => map[x.trim()]).filter(Boolean);
            if (al.length) { out.lang = out.lang || {}; out.lang.on = true; out.lang.allowed = al; }
          }
          else if (/aturan|rule|logika/.test(k)) out.mode = /^\s*or\b|minimal|salah satu|any/i.test(v) ? 'any' : 'all';
          else if (/^cx\b|konteks|context/.test(k)) P.framework.Cx = v;
          else if (/^p\b|populasi|partisipan|population/.test(k)) P.framework.P = v;
          else if (/^i\b|intervensi|intervention|fokus/.test(k)) P.framework.I = v;
          else if (/^c\b|pembanding|comparator|konsep|concept/.test(k)) P.framework.C = v;
          else if (/^o\b|outcome|luaran/.test(k)) P.framework.O = v;
          else if (/^s\b|desain|design|study/.test(k)) P.framework.S = v;
        });
        if (!Object.keys(P.framework).length) delete P.framework;
        if (Object.keys(P).length) out.project = Object.assign(out.project || {}, P);
      }
    });

    if (out.mode) { out.criteria = out.criteria || {}; out.criteria.mode = out.mode; delete out.mode; }
    if (out.lang) { out.criteria = out.criteria || {}; out.criteria.lang = out.lang; delete out.lang; }
    return out;
  },

  summary(p) {
    const s = [];
    if (p.project) {
      const P = p.project;
      if (P.title) s.push(['Judul proyek', P.title]);
      if (P.type) s.push(['Jenis review', this.TYPE_NAMES[P.type]]);
      if (P.question) s.push(['Pertanyaan review', P.question.split('\n').filter(Boolean).length + ' baris']);
      if (P.framework) s.push(['Kerangka (PICO/PCC)', Object.keys(P.framework).join(', ')]);
      if (P.reviewers) s.push(['Reviewer', P.reviewers.join(', ')]);
      if (P.databases) s.push(['Basis data', P.databases.map(d => d.name).join(', ')]);
      if (P.single !== undefined) s.push(['Jumlah reviewer', P.single ? '1 (Reviewer 2 disembunyikan)' : '2']);
    }
    if (p.criteria) {
      if (p.criteria.include && p.criteria.include.length) {
        s.push(['Kriteria inklusi', p.criteria.include.length + ' butir: ' + p.criteria.include.map(c => c.label).slice(0, 3).join(' · ') + (p.criteria.include.length > 3 ? '…' : '')]);
      }
      if (p.criteria.exclude && p.criteria.exclude.length) {
        s.push(['Kata kunci eksklusi', p.criteria.exclude.length + ' butir: ' + p.criteria.exclude.map(c => c.label).slice(0, 3).join(' · ') + (p.criteria.exclude.length > 3 ? '…' : '')]);
      }
      if (p.criteria.mode) s.push(['Aturan kriteria', p.criteria.mode === 'any' ? 'OR (minimal satu cocok)' : 'AND (semua harus cocok)']);
      if (p.criteria.lang && p.criteria.lang.on) s.push(['Kriteria bahasa', (p.criteria.lang.allowed || []).join(', ') + (p.criteria.lang.label ? ' · ' + p.criteria.lang.label : '')]);
    }
    if (p.reasons && p.reasons.length) s.push(['Alasan eksklusi', p.reasons.length + ' alasan']);
    if (p.fields && p.fields.length) s.push(['Formulir ekstraksi', p.fields.length + ' kolom' + (p.fields.length ? ' (' + [...new Set(p.fields.map(f => f.group || 'Umum'))].join(', ') + ')' : '')]);
    return s;
  }
};

if (typeof module !== 'undefined') module.exports = SettingsIO;
