/*
 * Analyzer: mencocokkan blok naskah dengan RULES dan menghasilkan
 * daftar temuan berstatus: ok | warn | miss | info | na.
 */
(function (global) {
  'use strict';
  const { normalize, countWords } = global.Parser;
  const R = global.RULES;

  const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  const ROMAN_OUT = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  const pad = (s) => ' ' + s + ' ';
  const has = (norm, phrase) => pad(norm).includes(pad(normalize(phrase)));

  function looksToc(b) {
    if (b.isToc) return true;
    const t = b.rawText || b.text;
    if (/(\.\s?){4,}|…{2,}|·{3,}|_{4,}/.test(t)) return true;
    if (/\t\s*([0-9]{1,3}|[ivxlcdm]{1,7})\s*$/i.test(t)) return true;
    if (b.words <= 16 && b.words > 2 && /\s([0-9]{1,3}|[ivxlc]{1,6})\s*$/i.test(b.text) && !/\b(19|20)\d{2}\s*$/.test(b.text) && !/^(bab|siklus|tahap|tabel|gambar)\s+\S+$/i.test(b.text)) return true;
    return false;
  }

  function isHeadingCand(b) {
    if (b.inTable || b._toc || !b.words || b.words > 16) return false;
    const t = b.text.trim();
    if (/\?$/.test(t)) return false;
    if (b.level != null) return true;
    if (b.bold && b.words <= 14) return true;
    if (/^([A-Ha-h]|\d{1,2}(\.\d{1,2}){0,3}|[IVX]{1,4})[.)]\s+\S/.test(t) && !/[.;,:]$/.test(t)) return true;
    if (/^(\d{1,2}\.\d{1,2}(\.\d{1,2})*)\s+\S/.test(t) && !/[.;,:]$/.test(t)) return true;
    if (b.numbered && b.words <= 12 && !/[.;,:]$/.test(t)) return true;
    if (b.words <= 8 && /^[A-Z0-9]/.test(t) && !/[.;,:]$/.test(t)) return true;
    return false;
  }

  // ------------------------------------------------------------ struktur

  function locateStructure(blocks) {
    blocks.forEach((b, i) => { b.i = i; b._toc = looksToc(b); });
    const cands = [];
    blocks.forEach((b, i) => {
      if (b._toc || b.inTable || b.words > 12) return;
      // Jangan anggap subbab (berawalan A., B., 1., 2., a., b.) sebagai judul bab
      if (/^[a-z0-9][.)]/i.test(b.text.trim())) return;

      let num = null;
      let title = '';
      let titleIdx = i;

      // 1. Pola standar: BAB I, BAB 1, CHAPTER 1, BAB I: PENDAHULUAN
      const m = /^(?:bab|chapter)\s*([ivx]+|\d{1,2})\b\s*[:.\-–—]?\s*(.*)$/.exec(b.norm);
      if (m) {
        num = ROMAN[m[1]] || parseInt(m[1], 10);
        title = m[2] || '';
      } else if (b.words <= 6) {
        // 2. Fallback tematik judul bab murni (bukan subbab):
        if (/^(?:pendahuluan)$/.test(b.norm)) {
          num = 1; title = b.norm;
        } else if (/^(?:kajian pustaka|kajian teoretis|kajian teori|tinjauan pustaka|landasan teori)$/.test(b.norm)) {
          num = 2; title = b.norm;
        } else if (/^(?:metodologi penelitian|metode penelitian|prosedur pengembangan)$/.test(b.norm)) {
          num = 3; title = b.norm;
        } else if (/^(?:hasil penelitian dan pembahasan|hasil dan pembahasan|analisis data dan pembahasan)$/.test(b.norm)) {
          num = 4; title = b.norm;
        } else if (/^(?:kesimpulan dan saran|simpulan dan saran)$/.test(b.norm)) {
          num = 5; title = b.norm;
        }
      }

      if (!num || num > 10) return;
      if (!title) {
        for (let k = i + 1; k < Math.min(i + 3, blocks.length); k++) {
          if (blocks[k].words && blocks[k].words <= 12 && !looksToc(blocks[k])) { title = blocks[k].norm; titleIdx = k; break; }
        }
      }
      cands.push({ num, idx: i, titleIdx, title: title || '', raw: b.text });
    });

    const refHeads = [];
    blocks.forEach((b, i) => {
      if (b._toc || b.words > 5) return;
      if (/^(daftar pustaka|daftar rujukan|daftar referensi|referensi|references|bibliografi|bibliography|reference list)$/.test(b.norm)) refHeads.push(i);
    });

    // Hitung jumlah kata setelah tiap kandidat hingga pemberhentian berikutnya
    const stops = [...cands.map((c) => c.idx), ...refHeads, blocks.length].sort((a, b) => a - b);
    const wordsUntilNext = (idx) => {
      const next = stops.find((s) => s > idx);
      let w = 0;
      for (let k = idx + 1; k < (next == null ? blocks.length : next); k++) if (!blocks[k]._toc) w += blocks[k].words;
      return w;
    };
    cands.forEach((c) => { c.wordsNext = wordsUntilNext(c.titleIdx); });

    // Saring kandidat nyata: harus memiliki isi teks (minimal 35 kata)
    const real = cands.filter((c) => c.wordsNext >= 35);

    // KUNCI PENTING: Setiap nomor bab (1, 2, 3, 4, 5) HANYA BOLEH ADA TEPAT SATU!
    // Tidak boleh ada bab duplikat (misal Bab I dua kali karena daftar isi dan isi).
    // Pilih kandidat dengan kata isi terbanyak.
    const byNum = new Map();
    for (const c of real) {
      if (!byNum.has(c.num)) {
        byNum.set(c.num, c);
      } else {
        const existing = byNum.get(c.num);
        if (c.wordsNext > existing.wordsNext) {
          byNum.set(c.num, c);
        }
      }
    }

    // Urutkan bab sesuai nomor dan posisi indeks dalam naskah
    const chapters = [...byNum.values()].sort((a, b) => a.num - b.num);

    const bodyStart = chapters.length ? chapters[0].idx : 0;
    const lastCh = chapters.length ? chapters[chapters.length - 1].idx : 0;
    let refStart = refHeads.find((i) => i > lastCh);
    if (refStart == null) refStart = -1;

    let lampStart = -1;
    if (refStart >= 0) {
      for (let i = refStart + 1; i < blocks.length; i++) {
        const b = blocks[i];
        if (!b._toc && b.words <= 12 && /^(lampiran|lampiran lampiran|daftar lampiran)\b/.test(b.norm)) { lampStart = i; break; }
      }
    }
    const bodyEnd = refStart >= 0 ? refStart : blocks.length;

    chapters.forEach((c, k) => {
      c.start = c.idx;
      c.end = k + 1 < chapters.length ? chapters[k + 1].idx : bodyEnd;
      c.blocks = blocks.slice(c.start, c.end);
      c.norm = c.blocks.map((b) => b.norm).join(' ');
      c.words = c.blocks.reduce((a, b) => a + (b._toc ? 0 : b.words), 0);
      c.headings = c.blocks.filter((b) => b.i !== c.idx && b.i !== c.titleIdx && isHeadingCand(b));
    });

    return {
      chapters,
      front: blocks.slice(0, bodyStart),
      body: blocks.slice(bodyStart, bodyEnd),
      refs: refStart >= 0 ? blocks.slice(refStart + 1, lampStart >= 0 ? lampStart : blocks.length) : [],
      lamp: lampStart >= 0 ? blocks.slice(lampStart) : [],
      refStart, lampStart,
    };
  }

  // ------------------------------------------------------- deteksi jenis

  function detectJenis(text) {
    const n = pad(text);
    const scores = {};
    for (const [j, kws] of Object.entries(R.DETEKSI_JENIS)) {
      let s = 0;
      for (const kw of kws) {
        const p = pad(normalize(kw));
        let c = 0, pos = n.indexOf(p);
        while (pos >= 0 && c < 6) { c++; pos = n.indexOf(p, pos + 1); }
        s += c;
      }
      scores[j] = s;
    }
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return { best: ranked[0][1] > 0 ? ranked[0][0] : 'asosiatif', ranked };
  }

  // Penanda jenjang ditimbang; bila bagian awal tidak memberi bukti, pakai seluruh naskah.
  function jenjangScore(text) {
    const n = (re) => (pad(text).match(re) || []).length;
    return {
      d: 2 * n(/ disertasi /g) + n(/ doktor(al)? /g) + n(/ promotor /g) + n(/ ko ?promotor /g) + n(/ s3 /g),
      t: 2 * n(/ tesis /g) + n(/ magister /g) + n(/ s2 /g),
    };
  }
  function detectJenjang(frontNorm, allNorm) {
    let s = jenjangScore(frontNorm || '');
    let pasti = s.d !== s.t;
    if (!pasti) { s = jenjangScore(allNorm); pasti = false; }
    return { id: s.d > s.t ? 'disertasi' : 'tesis', pasti };
  }

  // ------------------------------------------------------------- sitasi

  function surnameKey(s) {
    const n = normalize(s).split(' ').filter((w) => w && !/^(dan|and|&|et|al|dkk)$/.test(w));
    return n[0] || '';
  }

  // Pada PDF, baris beberapa entri bisa tergabung dalam satu blok; pisahkan
  // di awal pola "Nama, I. (Tahun)" yang didahului akhir entri sebelumnya.
  function splitRefText(text) {
    const parts = [];
    let from = 0;
    const re = /[A-ZÀ-ſ][A-Za-zÀ-ſ'’\-]+(?: (?:de|van|von|der|da|di|Jr\.))*, (?:[A-Z]\.\s?){1,3}/g;
    let m;
    while ((m = re.exec(text))) {
      if (m.index === 0) continue;
      const before = text.slice(Math.max(0, m.index - 3), m.index);
      if (!/[.\/\w)]\s+$/.test(before) || /\.\s+$/.test(before) && /\b[A-Z]\.\s+$/.test(text.slice(m.index - 4, m.index))) continue;
      const after = text.slice(m.index, m.index + 220);
      const y = after.search(/\(\s*(19|20)\d{2}/);
      if (y < 0 || /\bIn\s/.test(after.slice(0, y))) continue;
      parts.push(text.slice(from, m.index).trim());
      from = m.index;
    }
    parts.push(text.slice(from).trim());
    return parts.filter(Boolean);
  }

  function parseReferences(refBlocks, kind) {
    const entries = [];
    const startRe = /^\s*[A-ZÀ-ſ][^()]{0,200}?\(\s*((19|20)\d{2}[a-z]?|n\.\s?d\.|t\.\s?t\.|in press)/;
    for (const b of refBlocks) {
      if (!b.words) continue;
      for (const piece of kind === 'pdf' ? splitRefText(b.text) : [b.text]) {
        if (startRe.test(piece) || !entries.length) entries.push({ text: piece });
        else entries[entries.length - 1].text += ' ' + piece;
      }
    }
    const now = new Date().getFullYear();
    return entries.map((e) => {
      const ym = /\(\s*((19|20)\d{2})/.exec(e.text);
      const year = ym ? parseInt(ym[1], 10) : null;
      const authorPart = e.text.split('(')[0];
      const key = surnameKey(authorPart.split(',')[0]);
      const t = e.text;
      const isJournal = /\b\d+\s*\(\s*\d+[-–]?\d*\s*\)\s*,?\s*\d*|\bjournal\b|\bjurnal\b|\bvol\.|\bvolume\b|\bdoi\b|doi\.org|\be\d{5,}/i.test(t) && !/\b(press|publisher|penerbit|publishing|thesis|dissertation|disertasi|tesis)\b/i.test(t.slice(0, 400)) || /\bjournal\b|\bjurnal\b/i.test(t);
      const isBook = !isJournal && /\b(press|publisher|penerbit|publishing|publications|edition|ed\.\)|eds\.\)|\(ed\.|isbn|routledge|springer|sage|wiley|pearson|mcgraw|elsevier|rajawali|alfabeta|rineka|kencana|remaja rosdakarya|bumi aksara|erlangga)\b/i.test(t);
      const banned = R.SUMBER_TERLARANG.filter((s) => s.pola.test(t)).map((s) => s.nama);
      return { text: t, year, key, isJournal, isBook, banned, age: year ? now - year : null };
    });
  }

  function extractCitations(bodyBlocks) {
    const cites = [];
    const ignore = /^(tabel|gambar|lampiran|pasal|ayat|nomor|no|uu|pp|tahun|hal|h|p|pp|n|r|sig|df|mean|sd|lihat|see|cf|ibid|sumber|catatan)$/i;
    for (const b of bodyBlocks) {
      if (b._toc) continue;
      const t = b.text;
      // parenthetical: (Nama, 2019; Nama & Nama, 2020)
      for (const m of t.matchAll(/\(([^()]{2,400}?(?:19|20)\d{2}[a-z]?[^()]*?)\)/g)) {
        for (const part of m[1].split(';')) {
          const pm = /^\s*(?:e\.g\.,?|misalnya|lihat|see|dalam|in)?\s*([A-ZÀ-ſ][^,]{1,120}?)\s*,\s*((?:19|20)\d{2})[a-z]?/.exec(part.trim());
          if (!pm) continue;
          const key = surnameKey(pm[1]);
          if (!key || ignore.test(key) || key.length < 2) continue;
          cites.push({ key, year: parseInt(pm[2], 10), raw: part.trim().slice(0, 80) });
        }
      }
      // naratif: Nama (2019), Nama et al. (2019), Nama dan Nama (2019)
      for (const m of t.matchAll(/([A-ZÀ-ſ][A-Za-zÀ-ſ'’\-]+(?:\s+(?:Jr\.|de|van|von|der|da|di))?(?:\s*(?:et al\.?|dkk\.?|(?:dan|and|&)\s+[A-ZÀ-ſ][A-Za-zÀ-ſ'’\-]+))?)\s*\(\s*((?:19|20)\d{2})[a-z]?\s*[,)]/g)) {
        const key = surnameKey(m[1]);
        if (!key || ignore.test(key) || key.length < 2) continue;
        if (/^(tahun|year|pada|sejak|hingga|sampai|akhir|awal|periode|dalam|bulan)$/i.test(key)) continue;
        cites.push({ key, year: parseInt(m[2], 10), raw: m[0].slice(0, 80) });
      }
    }
    return cites;
  }

  // ------------------------------------------------------------ helpers

  function findInBlocks(blocks, kws) {
    const found = [];
    let evidence = null;
    for (const kw of kws) {
      const p = pad(normalize(kw));
      const blk = blocks.find((b) => !b._toc && pad(b.norm).includes(p));
      if (blk) {
        found.push(kw);
        if (!evidence) evidence = snippet(blk.text, kw);
      }
    }
    return { found, evidence };
  }

  function snippet(text, kw) {
    const low = text.toLowerCase();
    const i = low.indexOf(kw.toLowerCase().split(' ')[0]);
    const s = Math.max(0, i - 60);
    return (s > 0 ? '…' : '') + text.slice(s, s + 200) + (text.length > s + 200 ? '…' : '');
  }

  function wordsOf(blocks) { return blocks.reduce((a, b) => a + (b._toc ? 0 : b.words), 0); }

  function frontSection(front, alts, all) {
    const heads = front.filter((b) => !b._toc && b.words && b.words <= 10);
    for (const b of heads) for (const a of alts) {
      const na = normalize(a);
      if (b.norm === na || b.norm.startsWith(na + ' ') || (b.words <= 6 && has(b.norm, a))) return { status: 'ok', block: b };
    }
    // Hanya tercantum di daftar isi?
    for (const b of front) if (b._toc) for (const a of alts) if (has(b.norm, a)) return { status: 'toc', block: b };
    if (all) for (const b of all) if (!b._toc && b.words <= 10) for (const a of alts) if (b.norm === normalize(a)) return { status: 'elsewhere', block: b };
    return { status: 'miss' };
  }

  function regionAfter(blocks, startBlock, maxBlocks, stopRe) {
    const i0 = blocks.indexOf(startBlock);
    const out = [];
    for (let k = i0 + 1; k < blocks.length && out.length < maxBlocks; k++) {
      const b = blocks[k];
      if (b.words <= 8 && stopRe.test(b.norm) && out.length) break;
      out.push(b);
    }
    return out;
  }

  // -------------------------------------------------------------- utama

  function analyze(parsed, opts) {
    const blocks = parsed.blocks;
    const S = locateStructure(blocks);
    const allNorm = blocks.map((b) => b.norm).join(' ');
    const bodyNorm = S.body.map((b) => b.norm).join(' ');
    const frontNorm = S.front.map((b) => b.norm).join(' ');

    const det = detectJenis(S.chapters.slice(0, 3).map((c) => c.norm).join(' ') || allNorm);
    const jenisId = opts.jenis === 'auto' ? det.best : opts.jenis;
    const jDet = detectJenjang(frontNorm, allNorm);
    const jenjangId = opts.jenjang === 'auto' ? jDet.id : opts.jenjang;
    const jenjangPasti = opts.jenjang !== 'auto' || jDet.pasti;

    // Deteksi mode per bab: baik via pilihan user (bab1, bab2, ...) atau otomatis saat hanya 1 bab terdeteksi
    const isSingleBab = /^bab[1-5]$/.test(opts.tahap) || (opts.tahap === 'auto' && S.chapters.length === 1);
    const singleBabNum = /^bab[1-5]$/.test(opts.tahap)
      ? parseInt(opts.tahap.replace('bab', ''), 10)
      : (S.chapters.length === 1 ? S.chapters[0].num : 1);

    const tahap = isSingleBab ? ('bab' + singleBabNum) : (opts.tahap === 'auto' ? (S.chapters.length && S.chapters.length <= 3 ? 'proposal' : 'lengkap') : opts.tahap);
    const jenis = R.JENIS[jenisId];
    const jenjang = R.JENJANG[jenjangId];
    const lengkap = tahap === 'lengkap';
    const babSpec = isSingleBab
      ? [jenis.bab[singleBabNum - 1] || jenis.bab[0]]
      : (lengkap ? jenis.bab : jenis.bab.slice(0, 3));

    const groups = { awal: [], sistematika: [], isi: [], koherensi: [], dimensi: [], paradigma: [], tabel: [], statistik: [], kuantitas: [], rujukan: [], format: [], lampiran: [] };
    const addedKeys = new Map();
    const add = (g, item) => {
      if (!groups[g]) groups[g] = [];
      const cleanName = (item.nama || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const k = g + '::' + cleanName;
      if (addedKeys.has(k)) {
        const idx = addedKeys.get(k);
        const existing = groups[g][idx];
        const rank = { miss: 3, warn: 2, ok: 1, info: 0, na: -1 };
        if ((rank[item.status] || 0) > (rank[existing.status] || 0)) {
          groups[g][idx] = item;
        }
        return;
      }
      addedKeys.set(k, groups[g].length);
      groups[g].push(item);
    };

    // ===== Bagian Awal =====
    for (const it of R.BAGIAN_AWAL) {
      if (isSingleBab && singleBabNum !== 1) continue; // Lewati tuntutan bagian awal jika sedang periksa bab 2, 3, 4, 5
      if (it.lengkapSaja && !lengkap) continue;
      if (it.cara === 'judul') {
        const first = S.front.slice(0, 60).map((b) => b.norm).join(' ') || allNorm.slice(0, 3000);
        const okUnj = has(first, 'universitas negeri jakarta');
        const okJenis = has(first, 'tesis') || has(first, 'disertasi') || has(first, 'proposal');
        add('awal', {
          nama: it.nama, hal: it.hal,
          status: okUnj && okJenis ? 'ok' : 'warn',
          detail: okUnj && okJenis ? 'Halaman sampul/judul memuat identitas naskah dan Universitas Negeri Jakarta.' : 'Halaman sampul/judul belum lengkap: ' + [!okJenis && 'kata "Tesis/Disertasi"', !okUnj && '"Universitas Negeri Jakarta"'].filter(Boolean).join(' dan ') + ' tidak ditemukan.',
          saran: 'Ikuti format halaman sampul dan judul pada Lampiran 1–4 panduan.',
        });
        continue;
      }
      const r = frontSection(S.front, it.alt, blocks);
      const wajib = it.wajib !== false;
      const st = r.status === 'ok' ? 'ok' : r.status === 'toc' ? 'warn' : r.status === 'elsewhere' ? 'warn' : (wajib ? 'miss' : 'warn');
      const detail = {
        ok: 'Ditemukan: "' + r.block?.text.slice(0, 60) + '".',
        toc: 'Hanya tercantum di Daftar Isi; halamannya tidak ditemukan dalam naskah.',
        elsewhere: 'Ditemukan di luar bagian awal (posisinya perlu dipindah ke bagian awal).',
        miss: 'Tidak ditemukan.',
      }[r.status];
      add('awal', { nama: it.nama, hal: it.hal, status: st, detail, saran: 'Tambahkan halaman ' + it.nama + ' sesuai format panduan (hal ' + it.hal + ').', wajib });
    }

    // Abstrak: jumlah kata, kata kunci, komponen (hanya bila periksa naskah lengkap/proposal atau Bab I)
    if (!isSingleBab || singleBabNum === 1) {
      const stopFront = /^(abstrak|abstract|kata pengantar|prakata|daftar isi|daftar tabel|daftar gambar|daftar lampiran|pernyataan|lembar|halaman|riwayat|ringkasan|summary|bab)\b/;
      for (const [id, label, kwRe, lang] of [['abstrak', 'Abstrak', /\bkata\s*kunci\b/i, 'id'], ['abstract', 'Abstract', /\bkey\s*words?\b/i, 'en']]) {
        const r = frontSection(S.front, [id], null);
        if (r.status !== 'ok') continue;
        const reg = regionAfter(S.front, r.block, 80, stopFront);
        const w = wordsOf(reg);
        const regText = reg.map((b) => b.text).join(' ');
        const regNorm = normalize(regText);
        add('kuantitas', {
          nama: 'Jumlah kata ' + label, hal: '2',
          status: w >= 200 && w <= 400 ? 'ok' : (w >= 170 && w <= 450 ? 'warn' : 'miss'),
          detail: w + ' kata (ketentuan 200–400 kata). Perhitungan termasuk baris judul/nama/kata kunci di sekitar abstrak, jadi anggap sebagai perkiraan.',
          saran: 'Sesuaikan panjang ' + label.toLowerCase() + ' menjadi 200–400 kata.',
        });
        add('awal', {
          nama: label + ': kata kunci / keywords', hal: '25',
          status: kwRe.test(regText) ? 'ok' : 'miss',
          detail: kwRe.test(regText) ? 'Kata kunci ditemukan.' : 'Kata kunci tidak ditemukan di bawah ' + label.toLowerCase() + '.',
          saran: 'Tambahkan ' + (lang === 'id' ? '"Kata kunci:" berbahasa Indonesia' : '"Keywords:" berbahasa Inggris') + ' di bagian bawah ' + label.toLowerCase() + '.',
        });
        const komp = lang === 'id'
          ? [['permasalahan/tujuan', ['tujuan', 'bertujuan', 'masalah']], ['metode', ['metode', 'pendekatan', 'desain', 'sampel', 'responden', 'partisipan', 'informan']], ['hasil', ['hasil', 'menunjukkan', 'temuan', 'ditemukan']], ['simpulan', ['simpulan', 'kesimpulan', 'disimpulkan', 'implikasi', 'rekomendasi', 'dengan demikian']]]
          : [['problem/objective', ['objective', 'aim', 'purpose', 'aims', 'problem']], ['method', ['method', 'approach', 'design', 'sample', 'respondents', 'participants', 'informants']], ['results', ['result', 'results', 'show', 'showed', 'shows', 'findings', 'found', 'indicate', 'indicated']], ['conclusion', ['conclusion', 'conclude', 'concluded', 'implication', 'implications', 'recommend', 'recommended', 'therefore']]];
        const kurang = komp.filter(([, kws]) => !kws.some((k) => has(regNorm, k))).map(([n]) => n);
        add('isi', {
          nama: label + ' memuat permasalahan, tujuan, metode, hasil, dan simpulan', hal: '24',
          status: kurang.length === 0 ? 'ok' : kurang.length === 1 ? 'warn' : 'miss',
          detail: kurang.length ? 'Komponen yang belum terdeteksi: ' + kurang.join(', ') + '.' : 'Semua komponen terdeteksi.',
          saran: 'Lengkapi ' + label.toLowerCase() + ' dengan: ' + kurang.join(', ') + '.',
        });
        if (parsed.kind === 'docx') {
          const sp = reg.map((b) => b.spacing).filter((x) => x != null);
          if (sp.length) {
            const single = sp.filter((x) => x <= 1.15).length / sp.length;
            add('format', { nama: 'Spasi ' + label + ' tunggal (1)', hal: '3, 25', status: single >= 0.7 ? 'ok' : 'warn', detail: Math.round(single * 100) + '% paragraf ' + label.toLowerCase() + ' berspasi tunggal.', saran: 'Ubah spasi ' + label.toLowerCase() + ' menjadi 1 (single).' });
          }
        }
      }
    }

    // ===== Sistematika bab =====
    const found = S.chapters;
    if (!found.length) {
      add('sistematika', { nama: 'Judul bab terdeteksi', status: 'miss', hal: '32–39', detail: 'Tidak ada judul bab berpola "BAB I …" atau judul bab standar yang terdeteksi. Pemeriksaan sistematika dan isi per bab tidak dapat dilakukan dengan akurat.', saran: 'Tulis judul bab dengan pola "BAB I PENDAHULUAN", "BAB II KAJIAN PUSTAKA", dst. (gunakan style Heading 1 di Word).' });
    } else if (isSingleBab) {
      const activeSpec = jenis.bab[singleBabNum - 1] || jenis.bab[0];
      const activeJudul = activeSpec.judul[0].toUpperCase();
      add('sistematika', {
        nama: 'Pemeriksaan Khusus Bab ' + ROMAN_OUT[singleBabNum], hal: jenis.hal,
        status: 'ok',
        detail: 'Mode periksa sistematika per bab aktif: Fokus mengevaluasi Bab ' + ROMAN_OUT[singleBabNum] + ' (' + activeJudul + ') secara otomatis.',
        saran: 'Pastikan seluruh subbab wajib Bab ' + ROMAN_OUT[singleBabNum] + ' telah tercantum sesuai sistematika ' + jenis.label + '.',
      });
    } else {
      add('sistematika', {
        nama: 'Jumlah bab', hal: jenis.hal,
        status: found.length === babSpec.length ? 'ok' : found.length < babSpec.length ? 'miss' : 'warn',
        detail: found.length + ' bab terdeteksi (' + found.map((c) => 'Bab ' + ROMAN_OUT[c.num]).join(', ') + '); sistematika ' + jenis.label + (lengkap ? '' : ' (proposal)') + ' meminta ' + babSpec.length + ' bab.',
        saran: found.length < babSpec.length ? 'Lengkapi bab yang belum ada sesuai sistematika ' + jenis.label + '.' : 'Periksa kembali pembagian bab; jumlahnya melebihi sistematika panduan.',
      });
    }

    const babResults = [];
    babSpec.forEach((spec, k) => {
      const realBabNum = isSingleBab ? singleBabNum : k + 1;
      const ch = found.find((c) => c.num === realBabNum) || (isSingleBab && found.length === 1 ? found[0] : null);
      const babName = 'Bab ' + ROMAN_OUT[realBabNum];
      const res = { bab: babName, judulHarapan: spec.judul[0].toUpperCase(), chapter: ch || null, subs: [] };
      if (!ch) {
        add('sistematika', { nama: babName + ' ' + spec.judul[0].toUpperCase(), hal: jenis.hal, status: 'miss', detail: 'Bab tidak ditemukan.', saran: 'Tambahkan ' + babName + ' ' + spec.judul[0].toUpperCase() + ' beserta subbabnya.' });
      } else {
        const okTitle = spec.judul.some((j) => has(ch.title, j) || has(normalize(ch.raw), j));
        add('sistematika', {
          nama: babName + ' ' + spec.judul[0].toUpperCase(), hal: jenis.hal,
          status: okTitle ? 'ok' : 'warn',
          detail: 'Judul terdeteksi: "' + (ch.raw + (ch.titleIdx !== ch.idx && blocks[ch.titleIdx] ? ' ' + blocks[ch.titleIdx].text : '')).slice(0, 90) + '" (' + ch.words.toLocaleString('id-ID') + ' kata).',
          saran: 'Sesuaikan judul ' + babName + ' menjadi "' + spec.judul[0].toUpperCase() + '" sesuai sistematika ' + jenis.label + '.',
        });
      }
      for (const sub of spec.sub) {
        const wajib = sub.wajib !== false;
        let status = 'miss', detail = 'Tidak ditemukan.', where = null;
        if (ch) {
          // Utamakan frasa alternatif pertama (paling spesifik).
          let h = null;
          for (const a of sub.alt) { h = ch.headings.find((b) => has(b.norm, a)); if (h) break; }
          if (h) { status = 'ok'; detail = 'Subjudul: "' + h.text.slice(0, 80) + '".'; }
          else if (sub.alt.some((a) => has(ch.norm, a))) { status = 'warn'; detail = 'Istilahnya disebut di dalam teks ' + babName + ', tetapi tidak sebagai subjudul tersendiri.'; }
        }
        if (status === 'miss') {
          const other = found.find((c) => c !== ch && c.headings.some((b) => sub.alt.some((a) => has(b.norm, a))));
          if (other) { status = 'warn'; where = 'Bab ' + ROMAN_OUT[other.num]; detail = 'Ditemukan sebagai subjudul di ' + where + ', bukan di ' + babName + '.'; }
        }
        if (!wajib && status === 'miss') status = 'warn';
        res.subs.push({ nama: sub.nama, status, detail, level: sub.level || 1 });
        add('sistematika', {
          nama: babName + ' › ' + sub.nama, hal: jenis.hal, status, detail, sub: true,
          saran: status === 'miss' ? 'Tambahkan subbab "' + sub.nama + '" pada ' + babName + '.' : 'Jadikan "' + sub.nama + '" subjudul tersendiri di ' + babName + '.',
        });
      }
      babResults.push(res);
    });

    // Bagian akhir
    for (const it of R.BAGIAN_AKHIR) {
      if (isSingleBab && singleBabNum < (lengkap ? 5 : 3)) continue;
      if (it.lengkapSaja && !lengkap) continue;
      const ok = it.id === 'pustaka' ? S.refStart >= 0 : S.lampStart >= 0;
      add('sistematika', { nama: it.nama, hal: it.hal, status: ok ? 'ok' : 'miss', detail: ok ? 'Ditemukan setelah bab terakhir.' : 'Tidak ditemukan setelah bab terakhir.', saran: 'Tambahkan ' + it.nama + ' setelah bab terakhir (hal ' + it.hal + ').' });
    }

    // ===== Kriteria isi =====
    const chap = (k) => found.find((c) => c.num === k + 1);
    const scopeBlocks = (bab) => {
      if (bab === 'any') return S.body.length ? S.body : blocks;
      const arr = Array.isArray(bab) ? bab : [bab];
      const out = [];
      for (const k of arr) { const c = chap(k); if (c) out.push(...c.blocks); }
      return out;
    };
    const babLabel = (bab) => bab === 'any' ? 'seluruh naskah' : (Array.isArray(bab) ? bab : [bab]).map((k) => 'Bab ' + ROMAN_OUT[k + 1]).join('/');

    let rmCount = 0;
    for (const kr of R.KRITERIA_ISI) {
      if (kr.untuk && !kr.untuk.includes(jenisId)) continue;
      if (kr.tahap === 'lengkap' && !lengkap) continue;
      let bab = kr.bab;
      // Kualitatif punya 6 bab: pembahasan Bab V, simpulan Bab VI.
      if (jenisId === 'kualitatif' && Array.isArray(bab) && bab.includes(4)) bab = bab.map((x) => x + 1);

      // Saring kriteria agar bab lain tidak berulang kali memunculkan catatan 'tidak terdeteksi'
      if (isSingleBab) {
        const arr = Array.isArray(bab) ? bab : [bab];
        const match = arr.includes('any') || arr.includes(singleBabNum - 1);
        if (!match) continue;
      }
      if (!lengkap && !isSingleBab) {
        const arr = Array.isArray(bab) ? bab : [bab];
        if (!arr.includes('any') && arr.every((b) => b >= 3)) continue;
      }

      const sc = scopeBlocks(bab);
      const item = { nama: kr.nama, hal: kr.hal, saran: kr.saran, wajib: kr.wajib !== false, lokasi: babLabel(bab) };
      if (!sc.length && bab !== 'any') {
        if (isSingleBab) continue;
        add('isi', Object.assign(item, { status: 'miss', detail: babLabel(bab) + ' tidak terdeteksi sehingga kriteria ini tidak dapat diperiksa.' }));
        continue;
      }
      if (kr.khusus === 'kalimatTanya') {
        const c0 = chap(0);
        let reg = [];
        if (c0) {
          const h = c0.headings.find((b) => /rumusan masalah|perumusan masalah|pertanyaan penelitian/.test(b.norm));
          if (h) reg = regionAfter(c0.blocks, h, 40, /^([a-h]|\d+(\s\d+)*)?\s*(kegunaan|manfaat|tujuan|signifikansi|fokus|pembatasan|state|kebaruan|road)/);
          if (!reg.length) reg = c0.blocks;
        }
        const qs = reg.reduce((a, b) => a + (b.text.match(/\?/g) || []).length, 0);
        rmCount = qs;
        add('isi', Object.assign(item, {
          status: qs > 0 ? 'ok' : 'miss',
          detail: qs > 0 ? qs + ' kalimat tanya terdeteksi pada bagian rumusan masalah/pertanyaan penelitian.' : 'Tidak ada kalimat tanya (tanda "?") pada bagian rumusan masalah.',
        }));
        continue;
      }
      if (kr.khusus === 'hasilSesuaiRM') {
        const c = chap(3);
        const hs = c ? c.headings.length : 0;
        const mentions = c ? ['rumusan masalah', 'pertanyaan penelitian', 'hipotesis pertama', 'hipotesis kedua', 'fokus pertama', 'subfokus'].filter((k) => has(c.norm, k)).length : 0;
        let status = 'info';
        let detail = 'Rumusan masalah: ' + (rmCount || '?') + ' pertanyaan; Bab IV: ' + hs + ' subjudul.';
        if (rmCount && hs && hs < rmCount) { status = 'warn'; detail += ' Jumlah subjudul hasil lebih sedikit dari jumlah rumusan masalah.'; }
        else if (rmCount && hs >= rmCount) status = mentions ? 'ok' : 'info';
        add('isi', Object.assign(item, { status, detail: detail + ' Periksa manual bahwa urutan hasil mengikuti rumusan masalah.' }));
        continue;
      }
      if (kr.khusus === 'sitasiPembahasan') {
        const n = extractCitations(sc).length;
        add('isi', Object.assign(item, { status: n >= 10 ? 'ok' : n >= 3 ? 'warn' : 'miss', detail: n + ' sitasi terdeteksi di ' + babLabel(bab) + '.' }));
        continue;
      }
      if (kr.khusus === 'etikaRentan') {
        const rentan = findInBlocks(blocks, ['anak usia dini', 'siswa sekolah dasar', 'peserta didik sd', 'anak berkebutuhan khusus', 'abk', 'lansia', 'lanjut usia', 'disabilitas', 'tunarungu', 'tunanetra', 'autis', 'paud', 'taman kanak kanak']);
        if (!rentan.found.length) { add('isi', Object.assign(item, { status: 'na', detail: 'Tidak terdeteksi pelibatan partisipan rentan.' })); continue; }
        const bukti = findInBlocks(S.lamp.length ? S.lamp : blocks, ['izin orang tua', 'persetujuan orang tua', 'izin wali', 'surat izin', 'bebas kriminal', 'skck', 'catatan kepolisian', 'pernyataan tanggung jawab', 'informed consent', 'consent form']);
        add('isi', Object.assign(item, {
          status: bukti.found.length >= 2 ? 'ok' : 'warn', wajib: true,
          detail: 'Terdeteksi partisipan rentan (' + rentan.found.slice(0, 3).join(', ') + '). Bukti etika ditemukan: ' + (bukti.found.join(', ') || 'belum ada') + '.',
        }));
        continue;
      }
      const r = findInBlocks(sc, kr.kw);
      const min = kr.min || 1;
      let status = r.found.length >= min ? 'ok' : r.found.length > 0 ? 'warn' : (kr.wajib === false ? 'warn' : 'miss');
      // Tidak ada di bab seharusnya, tetapi ada di bab lain: tandai posisinya.
      let elsewhere = '';
      if (!r.found.length && bab !== 'any') {
        const other = found.find((c) => findInBlocks(c.blocks, kr.kw).found.length);
        if (other) { status = 'warn'; elsewhere = ' Ditemukan di Bab ' + ROMAN_OUT[other.num] + '; panduan menempatkannya di ' + babLabel(bab) + '.'; }
      }
      add('isi', Object.assign(item, {
        status,
        detail: r.found.length ? 'Indikator ditemukan di ' + babLabel(bab) + ': ' + r.found.slice(0, 5).map((x) => '"' + x + '"').join(', ') + (min > 1 ? ' (' + r.found.length + '/' + min + ' indikator minimal)' : '') + '.' : 'Tidak ada indikator yang ditemukan di ' + babLabel(bab) + '.' + elsewhere,
        bukti: r.evidence,
      }));
    }

    // Instrumen dikembangkan sendiri (hal 9)
    {
      const r = findInBlocks(S.body.length ? S.body : blocks, ['dikembangkan sendiri', 'dikembangkan oleh peneliti', 'disusun oleh peneliti', 'dikembangkan peneliti', 'instrumen dikembangkan', 'mengembangkan instrumen', 'menyusun instrumen', 'penyusunan instrumen', 'pengembangan instrumen']);
      if (jenisId !== 'kualitatif') add('isi', {
        nama: 'Minimal 1 instrumen dikembangkan sendiri oleh mahasiswa, divalidasi & disetujui pembimbing/promotor', hal: '9',
        status: r.found.length ? 'ok' : 'warn', wajib: true, lokasi: 'seluruh naskah',
        detail: r.found.length ? 'Indikator: ' + r.found.slice(0, 3).map((x) => '"' + x + '"').join(', ') + '.' : 'Tidak ditemukan pernyataan bahwa instrumen dikembangkan sendiri oleh peneliti.',
        saran: 'Panduan mewajibkan minimal satu instrumen observasi/pengukuran dikembangkan sendiri, divalidasi, dan disetujui pembimbing/promotor (dibuktikan lembar persetujuan & bukti uji coba).',
        bukti: r.evidence,
      });
    }

    // ===== Kuantitas =====
    const judulBlk = guessTitle(S.front.length ? S.front : blocks.slice(0, 40));
    const judul = opts.judul ? opts.judul.trim() : (judulBlk || '');
    // Batas 12 kata hanya diterapkan pada tesis; judul disertasi boleh lebih panjang.
    if (jenjangId === 'disertasi') {
      if (judul) add('kuantitas', { nama: 'Jumlah kata judul', hal: '2', status: 'na', detail: countWords(judul) + ' kata. Batas 12 kata tidak diterapkan pada disertasi.', saran: '' });
    } else if (judul) {
      const wj = countWords(judul);
      add('kuantitas', { nama: 'Jumlah kata judul', hal: '2', status: wj <= 12 ? 'ok' : 'miss', detail: wj + ' kata (maks. 12 kata): "' + judul.slice(0, 160) + '"' + (opts.judul ? '' : ' — judul ditebak otomatis; isi kolom Judul bila keliru.'), saran: 'Ringkas judul menjadi paling banyak 12 kata.' });
    } else {
      add('kuantitas', { nama: 'Jumlah kata judul', hal: '2', status: 'info', detail: 'Judul tidak dapat ditebak otomatis. Isi kolom Judul untuk memeriksa batas 12 kata (khusus tesis).', saran: '' });
    }

    const bodyWords = wordsOf(S.body);
    const [wmin, wmax] = jenjang.kata[lengkap ? 'lengkap' : 'proposal'];
    add('kuantitas', {
      nama: 'Jumlah kata isi (' + (lengkap ? jenjangId : 'proposal') + ')', hal: '2',
      status: bodyWords >= wmin && bodyWords <= wmax ? 'ok' : bodyWords >= wmin * 0.85 && bodyWords <= wmax * 1.15 ? 'warn' : 'miss',
      detail: bodyWords.toLocaleString('id-ID') + ' kata dari Bab I sampai sebelum Daftar Pustaka (ketentuan ' + wmin.toLocaleString('id-ID') + '–' + wmax.toLocaleString('id-ID') + ' kata; tidak termasuk bagian depan & lampiran).',
      saran: bodyWords < wmin ? 'Naskah terlalu pendek; perdalam kajian dan pembahasan.' : 'Naskah melebihi batas; ringkas bagian yang berulang.',
    });

    if (lengkap) {
      let pemWords = 0;
      if (jenisId === 'kualitatif') { const c = chap(4); pemWords = c ? c.words : 0; }
      else {
        const c = chap(3);
        if (c) {
          const h = c.headings.find((b) => has(b.norm, 'pembahasan') && !has(b.norm, 'hasil penelitian dan pembahasan') && !/^bab/.test(b.norm));
          if (h) pemWords = wordsOf(c.blocks.slice(c.blocks.indexOf(h)));
        }
      }
      const pct = bodyWords ? Math.round((pemWords / bodyWords) * 100) : 0;
      add('kuantitas', {
        nama: 'Proporsi pembahasan ±40% dari isi', hal: '2',
        status: pemWords === 0 ? 'warn' : pct >= 35 ? 'ok' : pct >= 25 ? 'warn' : 'miss',
        detail: pemWords ? 'Pembahasan ≈ ' + pemWords.toLocaleString('id-ID') + ' kata (' + pct + '% dari isi).' : 'Bagian pembahasan tidak dapat dipisahkan otomatis (subjudul "Pembahasan" tidak ditemukan).',
        saran: 'Panduan meminta jumlah kata pembahasan sekitar 40% dari keseluruhan isi.',
      });
    }

    // ===== Rujukan & sitasi =====
    const refs = parseReferences(S.refs, parsed.kind);
    const cites = extractCitations(S.body);
    const refInfo = { refs, cites };
    if (S.refStart < 0) {
      add('rujukan', { nama: 'Daftar pustaka', hal: '15, 31', status: 'miss', detail: 'Daftar pustaka tidak ditemukan sehingga rujukan tidak dapat dianalisis.', saran: 'Tambahkan Daftar Pustaka setelah bab terakhir.' });
    } else {
      const nowY = new Date().getFullYear();
      const jurnal = refs.filter((r) => r.isJournal);
      const buku = refs.filter((r) => r.isBook);
      add('rujukan', { nama: 'Jumlah rujukan minimal', hal: '31', status: refs.length >= jenjang.minRujukan ? 'ok' : 'miss', detail: refs.length + ' entri daftar pustaka (minimal ' + jenjang.minRujukan + ' untuk ' + jenjangId + ').', saran: 'Tambah rujukan hingga minimal ' + jenjang.minRujukan + ' entri.' });
      add('rujukan', { nama: 'Jumlah rujukan jurnal minimal', hal: '5', status: jurnal.length >= jenjang.minJurnal ? 'ok' : jurnal.length >= jenjang.minJurnal * 0.8 ? 'warn' : 'miss', detail: jurnal.length + ' entri terdeteksi sebagai artikel jurnal (minimal ' + jenjang.minJurnal + '). Deteksi berdasarkan pola volume(nomor)/DOI/kata "journal".', saran: 'Tambah rujukan artikel jurnal (diutamakan jurnal bereputasi internasional) hingga minimal ' + jenjang.minJurnal + '.' });
      const j10 = jurnal.filter((r) => r.age != null && r.age <= 10);
      const j5 = jurnal.filter((r) => r.age != null && r.age <= 5);
      const old = jurnal.filter((r) => r.age != null && r.age > 10);
      add('rujukan', { nama: 'Jurnal terbit ≤10 tahun terakhir', hal: '5', status: jurnal.length && old.length === 0 ? 'ok' : jurnal.length && j10.length / jurnal.length >= 0.8 ? 'warn' : 'miss', detail: j10.length + ' dari ' + jurnal.length + ' jurnal terbit ' + (nowY - 10) + '–' + nowY + '.' + (old.length ? ' Jurnal lama: ' + old.slice(0, 5).map((r) => r.text.slice(0, 50) + '…').join(' | ') : ''), saran: 'Ganti rujukan jurnal yang lebih dari 10 tahun dengan terbitan terbaru.' });
      add('rujukan', { nama: 'Artikel terbit ≤5 tahun terakhir (mayoritas)', hal: '31', status: jurnal.length && j5.length / jurnal.length >= 0.5 ? 'ok' : 'warn', detail: j5.length + ' dari ' + jurnal.length + ' jurnal (' + (jurnal.length ? Math.round((j5.length / jurnal.length) * 100) : 0) + '%) terbit ' + (nowY - 5) + '–' + nowY + '.', saran: 'Perbanyak artikel terbaru (5 tahun terakhir) sesuai bidang kajian.' });
      const bOld = buku.filter((r) => r.age != null && r.age > 10);
      add('rujukan', { nama: 'Buku terbit ≤10 tahun terakhir', hal: '31', status: bOld.length === 0 ? 'ok' : 'warn', detail: buku.length + ' buku terdeteksi; ' + bOld.length + ' terbit lebih dari 10 tahun lalu' + (bOld.length ? ' (mis. ' + bOld.slice(0, 3).map((r) => r.text.slice(0, 45) + '…').join(' | ') + ')' : '') + '. Buku klasik/grand theory dapat dipertahankan bila relevan.', saran: 'Gunakan buku terbitan 10 tahun terakhir kecuali karya klasik/grand theory.' });
      const banned = refs.filter((r) => r.banned.length);
      add('rujukan', { nama: 'Tidak merujuk Wikipedia / blog pribadi', hal: '15', status: banned.length ? 'miss' : 'ok', detail: banned.length ? banned.length + ' rujukan terlarang: ' + banned.slice(0, 4).map((r) => r.banned[0] + ': ' + r.text.slice(0, 50) + '…').join(' | ') : 'Tidak ditemukan.', saran: 'Hapus rujukan dari Wikipedia dan blog pribadi; ganti dengan sumber primer.' });
      // Urutan alfabetis
      let inv = 0; const invEx = [];
      for (let k = 1; k < refs.length; k++) {
        if (refs[k].key && refs[k - 1].key && refs[k].key.localeCompare(refs[k - 1].key, 'id') < 0) { inv++; if (invEx.length < 3) invEx.push(refs[k - 1].key + ' → ' + refs[k].key); }
      }
      add('rujukan', { nama: 'Daftar pustaka urut alfabetis (nama belakang)', hal: '15', status: inv === 0 ? 'ok' : inv <= 2 ? 'warn' : 'miss', detail: inv ? inv + ' pasangan tidak urut, mis. ' + invEx.join('; ') + '.' : 'Urutan alfabetis sesuai.', saran: 'Urutkan daftar pustaka secara alfabetis berdasarkan nama belakang penulis pertama.' });
      const noYear = refs.filter((r) => !r.year);
      if (noYear.length) add('rujukan', { nama: 'Format APA: tahun terbit dalam kurung', hal: '15–20', status: 'warn', detail: noYear.length + ' entri tanpa pola "(Tahun)": ' + noYear.slice(0, 3).map((r) => r.text.slice(0, 50) + '…').join(' | '), saran: 'Gunakan format APA 7: Nama, I. (Tahun). Judul. Sumber. DOI.' });

      // Entri yang belum lengkap: placeholder atau tanpa judul/sumber.
      const draft = refs.filter((r) => /\[\s*(lengkapi|isi|tambahkan|cek|todo|tbd|\.{3}|…)|\b(todo|xxx)\b|\?\?/i.test(r.text));
      const thin = refs.filter((r) => !draft.includes(r) && r.year && countWords(r.text.split(/\)\s*\.?/).slice(1).join(' ')) < 4);
      add('rujukan', {
        nama: 'Entri daftar pustaka lengkap (judul, sumber, DOI)', hal: '15–20',
        status: draft.length + thin.length === 0 ? 'ok' : draft.length + thin.length <= 2 ? 'warn' : 'miss',
        detail: draft.length + thin.length === 0 ? 'Tidak ditemukan entri yang belum lengkap.'
          : (draft.length ? draft.length + ' entri masih berisi catatan/placeholder, mis. ' + draft.slice(0, 3).map((r) => '"' + r.text.slice(0, 70) + '…"').join(' | ') + '. ' : '') +
            (thin.length ? thin.length + ' entri tanpa judul/sumber, mis. ' + thin.slice(0, 2).map((r) => '"' + r.text.slice(0, 60) + '"').join(' | ') + '.' : ''),
        saran: 'Lengkapi setiap entri sesuai APA 7: penulis, tahun, judul, nama jurnal/penerbit, volume(nomor), halaman, dan DOI.',
      });
      refInfo.draft = draft.concat(thin);

      // Silang sitasi–pustaka (singkatan lembaga dalam [..] juga dipakai sebagai kunci)
      const alias = [];
      for (const r of refs) {
        const m = /\[([A-Za-z][\w.&-]{1,20})\]/.exec(r.text.split('(')[0]);
        if (m) alias.push({ key: normalize(m[1]).split(' ')[0], year: r.year, ref: r });
      }
      const refKeys = new Set(refs.map((r) => r.key + '|' + r.year).concat(alias.map((a) => a.key + '|' + a.year)));
      const refKeyOnly = new Set(refs.map((r) => r.key).concat(alias.map((a) => a.key)));
      const uniqCites = new Map();
      for (const c of cites) uniqCites.set(c.key + '|' + c.year, c);
      const missingRef = [...uniqCites.values()].filter((c) => !refKeys.has(c.key + '|' + c.year));
      const missingRefStrict = missingRef.filter((c) => !refKeyOnly.has(c.key));
      const citeKeys = new Set([...uniqCites.values()].map((c) => c.key + '|' + c.year));
      const citeKeyOnly = new Set([...uniqCites.values()].map((c) => c.key));
      const aliasOf = new Map(alias.map((a) => [a.ref, a.key]));
      const uncited = refs.filter((r) => r.key && r.year && !citeKeys.has(r.key + '|' + r.year) && !citeKeyOnly.has(r.key) && !(aliasOf.has(r) && citeKeyOnly.has(aliasOf.get(r))));
      refInfo.missingRef = missingRef; refInfo.uncited = uncited;
      add('rujukan', { nama: 'Setiap sitasi dalam teks ada di daftar pustaka', hal: '15', status: missingRefStrict.length === 0 && missingRef.length <= 2 ? 'ok' : missingRefStrict.length <= 3 ? 'warn' : 'miss', detail: uniqCites.size + ' sitasi unik terdeteksi; ' + missingRef.length + ' tidak cocok dengan daftar pustaka (' + missingRefStrict.length + ' nama penulis sama sekali tidak ada).' + (missingRef.length ? ' Contoh: ' + missingRef.slice(0, 8).map((c) => c.raw).join('; ') : ''), saran: 'Tambahkan entri daftar pustaka untuk setiap sitasi, atau perbaiki nama/tahun yang tidak konsisten.' });
      add('rujukan', { nama: 'Setiap entri daftar pustaka disitasi dalam teks', hal: '15', status: uncited.length === 0 ? 'ok' : uncited.length <= 3 ? 'warn' : 'miss', detail: uncited.length + ' entri tidak ditemukan sitasinya di Bab I–akhir.' + (uncited.length ? ' Contoh: ' + uncited.slice(0, 5).map((r) => r.text.slice(0, 45) + '…').join(' | ') : ''), saran: 'Hapus entri yang tidak disitasi atau tambahkan sitasinya di teks.' });
      const dkk = (bodyNorm.match(/ dkk /g) || []).length;
      if (dkk) add('rujukan', { nama: 'Gaya sitasi APA 7 ("et al." untuk ≥3 penulis)', hal: '12–14', status: 'warn', detail: 'Ditemukan ' + dkk + ' penggunaan "dkk". Contoh pada panduan menggunakan "et al.".', saran: 'Gunakan "et al." sesuai APA 7.' });
      add('rujukan', { nama: 'Menggunakan reference manager (Mendeley/Zotero/EndNote)', hal: '15, 31', status: 'info', detail: parsed.kind === 'docx' ? (blocks.some((b) => /ADDIN (ZOTERO|EN\.CITE|CSL_CITATION|Mendeley)/i.test(b.rawText || '')) ? 'Terdeteksi field reference manager.' : 'Tidak dapat dipastikan dari teks; pastikan sitasi dibuat dengan reference manager.') : 'Tidak dapat diperiksa dari PDF.', saran: '' });
    }

    // ===== Lampiran =====
    if (lengkap) {
      const lampBlocks = S.lamp.length ? S.lamp : S.front.filter((b) => /lampiran/.test(b.norm));
      for (const it of R.ISI_LAMPIRAN) {
        if (it.id === 'validasi' && jenisId === 'kualitatif') continue;
        const r = findInBlocks(lampBlocks, it.alt);
        add('lampiran', { nama: it.nama, hal: it.hal, status: r.found.length ? 'ok' : (S.lamp.length ? 'miss' : 'warn'), detail: r.found.length ? 'Indikator: ' + r.found.slice(0, 3).map((x) => '"' + x + '"').join(', ') + '.' : (S.lamp.length ? 'Tidak ditemukan di bagian lampiran.' : 'Bagian lampiran tidak terdeteksi; pengecekan memakai Daftar Lampiran.'), saran: 'Lampirkan ' + it.nama + '.' });
      }
    }

    // ===== Koherensi judul – rumusan masalah – bab =====
    const koherensi = coherence({ S, chap, jenisId, judul, lengkap, add });

    // ===== Analisis lanjutan (dimensi, paradigma, tabel/gambar, statistik, per bab) =====
    const lanjut = global.Lanjut ? global.Lanjut.run({ S, blocks, chap, jenisId, lengkap, add, H: { normalize, countWords, has, pad, extractCitations, ROMAN_OUT } }) : {};

    // ===== Format =====
    formatChecks(parsed, S, add);

    return { S, groups, jenisId, jenjangId, jenjangPasti, tahap, det, judul, bodyWords, babResults, refInfo, koherensi, lanjut, kind: parsed.kind, numPages: parsed.numPages, scanned: parsed.scanned, isSingleBab, singleBabNum };
  }

  // ---------------------------------------------------------- koherensi

  // Kata umum yang tidak membawa isi variabel/fokus penelitian.
  const STOP = new Set(('apakah bagaimana mengapa seberapa sejauh mana manakah apa siapa kapan dimana terdapat ada adakah ' +
    'pengaruh berpengaruh hubungan perbedaan efektivitas efektif kontribusi peran dampak analisis studi kajian penelitian ' +
    'yang dan atau di ke dari pada terhadap dengan dalam untuk oleh bagi sebagai secara antara melalui serta juga ini itu tersebut ' +
    'langsung tidak signifikan positif negatif besar tinggi rendah lebih kurang baik setelah sebelum antar para setiap tiap ' +
    'mengetahui menganalisis mendeskripsikan menguji mengembangkan menemukan memperoleh menghasilkan tingkat kondisi ' +
    'kelompok dimiliki diberi diajar menggunakan penggunaan penerapan implementasi upaya meningkatkan peningkatan ' +
    'bab tujuan rumusan masalah pertanyaan hipotesis').split(' '));

  function terms(text) {
    return normalize(text).split(' ').filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
  }
  const uniq = (a) => [...new Set(a)];

  // Potong judul menjadi frasa isi (variabel/konteks) pada kata hubung.
  function titleChunks(judul) {
    // Frasa setelah "di/pada" dianggap konteks (lokasi/subjek), bukan variabel.
    const words = normalize(judul).split(' ');
    const out = []; let cur = [], ctx = false, prev = '';
    for (const w of words) {
      if (STOP.has(w) || w.length <= 2 || /^\d+$/.test(w)) {
        if (cur.length) out.push({ c: cur, ctx });
        cur = [];
        if (w === 'di' || w === 'pada') ctx = true;
        else if (!['dan', 'atau', 'serta'].includes(w)) ctx = false;
      } else {
        if (!cur.length && (prev === 'di' || prev === 'pada')) ctx = true;
        cur.push(w);
      }
      prev = w;
    }
    if (cur.length) out.push({ c: cur, ctx });
    return out.map((o) => ({ label: o.c.join(' '), words: o.c, konteks: o.ctx }));
  }

  // Cari blok di bawah subjudul yang cocok sampai subjudul berikutnya.
  function regionOf(ch, headRe) {
    if (!ch) return [];
    const h = ch.headings.find((b) => headRe.test(b.norm));
    if (!h) return [];
    const i0 = ch.blocks.indexOf(h);
    const out = [];
    for (let k = i0 + 1; k < ch.blocks.length; k++) {
      const b = ch.blocks[k];
      if (ch.headings.includes(b) && (!b.numbered || b.level != null || b.bold) && !/\?$/.test(b.text.trim()) && !/^\d+[.)]/.test(b.text)) break;
      out.push(b);
    }
    return out;
  }

  function coverage(words, norm) {
    if (!words.length) return 0;
    const n = pad(norm);
    return words.filter((w) => n.includes(' ' + w)).length / words.length;
  }
  const level = (c, okAt, warnAt) => (c >= okAt ? 'ok' : c >= warnAt ? 'warn' : 'miss');

  function countItems(blocks) {
    const numbered = blocks.filter((b) => /^\s*(\d{1,2}|[a-h])[.)]\s+\S/.test(b.text) || b.numbered).length;
    return numbered || blocks.filter((b) => b.words >= 6).length;
  }

  function coherence({ S, chap, jenisId, judul, lengkap, add }) {
    const kual = jenisId === 'kualitatif';
    const nBab = lengkap ? (kual ? 6 : 5) : 3;
    const chs = Array.from({ length: nBab }, (_, k) => chap(k));
    const chNorm = chs.map((c) => (c ? c.norm : ''));
    const headNorm = chs.map((c) => (c ? c.headings.map((h) => h.norm).join(' ') : ''));

    // Rumusan masalah → daftar pertanyaan
    const rmBlocks = regionOf(chs[0], /rumusan masalah|perumusan masalah|pertanyaan penelitian/);
    const rmText = rmBlocks.map((b) => b.text).join(' ');
    // Hanya potongan yang diakhiri "?", dimulai dari awal kalimat terakhir.
    const questions = [];
    for (const b of rmBlocks) {
      const parts = b.text.split('?');
      parts.pop();
      for (let p of parts) {
        const cut = p.split(/[.:;]\s+(?=[A-Z])/);
        p = cut[cut.length - 1].replace(/^\s*(\d{1,2}|[a-h])[.)]\s*/i, '').trim();
        if (countWords(p) >= 3) questions.push({ text: p + '?', words: uniq(terms(p)) });
      }
    }

    // Bagian pembanding
    const tujuanBlocks = regionOf(chs[0], /tujuan penelitian/).length ? regionOf(chs[0], /tujuan penelitian/) : regionOf(chs[2], /tujuan penelitian/);
    const tujuanNorm = tujuanBlocks.map((b) => b.norm).join(' ');
    const hipBlocks = regionOf(chs[1], /hipotesis/);
    const hipNorm = hipBlocks.map((b) => b.norm).join(' ');
    const lastIdx = lengkap ? nBab - 1 : -1;
    const simBlocks = lastIdx >= 0 ? regionOf(chs[lastIdx], /^([a-h]|\d+(\s\d+)*)?\s*(kesimpulan|simpulan)/) : [];
    const simNorm = simBlocks.length ? simBlocks.map((b) => b.norm).join(' ') : (lastIdx >= 0 ? chNorm[lastIdx] : '');

    const cols = chs.map((c, k) => 'Bab ' + ROMAN_OUT[k + 1]);
    const chunks = judul ? titleChunks(judul) : [];
    const kuant = ['asosiatif', 'eksperimen'].includes(jenisId);

    // Matriks: judul & setiap rumusan masalah × bab
    // Bab II & IV dinilai lebih ketat: ok jika istilah muncul di subjudul.
    const cell = (words, k) => {
      if (!chs[k]) return { st: 'na', c: 0 };
      if (k === 1 || k === 3 || (kual && k === 4)) {
        const ch = coverage(words, headNorm[k]);
        if (ch >= 0.6) return { st: 'ok', c: ch, where: 'subjudul' };
        const ct = coverage(words, chNorm[k]);
        return { st: ct >= 0.8 ? 'warn' : 'miss', c: ct, where: 'teks' };
      }
      if (k === lastIdx) {
        const c = coverage(words, simNorm);
        return { st: level(c, 0.75, 0.5), c, where: simBlocks.length ? 'simpulan' : 'bab' };
      }
      const c = coverage(words, chNorm[k]);
      return { st: level(c, 0.8, 0.5), c };
    };
    const rows = [];
    // Unsur konteks tidak dituntut hadir di kajian pustaka dan simpulan.
    for (const t of chunks) rows.push({ kind: 'judul', label: t.label + (t.konteks ? ' (konteks)' : ''), words: t.words, cells: chs.map((_, k) => (t.konteks && (k === 1 || k === lastIdx) ? { st: 'na', c: 0 } : cell(t.words, k))) });
    questions.forEach((q, i) => rows.push({ kind: 'rm', label: 'RM ' + (i + 1) + ': ' + q.text, words: q.words, cells: chs.map((_, k) => cell(q.words, k)) }));

    const hal = '26–31';
    // 1. Judul ↔ rumusan masalah
    if (!judul) add('koherensi', { nama: 'Judul ↔ rumusan masalah', hal, status: 'info', detail: 'Judul tidak terbaca. Isi kolom Judul agar keterkaitan judul dapat diperiksa.', saran: '' });
    else if (!questions.length) add('koherensi', { nama: 'Judul ↔ rumusan masalah', hal, status: 'miss', detail: 'Rumusan masalah berbentuk kalimat tanya tidak ditemukan di Bab I.', saran: 'Tulis rumusan masalah sebagai kalimat tanya di bawah subjudul "Rumusan Masalah".' });
    else {
      const rmNorm = normalize(rmText);
      const lost = chunks.filter((t) => coverage(t.words, rmNorm) < 0.5).map((t) => t.label);
      add('koherensi', {
        nama: 'Judul ↔ rumusan masalah', hal,
        status: lost.length === 0 ? 'ok' : lost.length < chunks.length / 2 ? 'warn' : 'miss',
        detail: lost.length ? 'Unsur judul yang tidak muncul di rumusan masalah: ' + lost.map((x) => '"' + x + '"').join(', ') + '.' : 'Semua unsur judul (' + chunks.map((t) => '"' + t.label + '"').join(', ') + ') muncul di rumusan masalah.',
        saran: 'Pastikan setiap variabel/fokus dan konteks pada judul diturunkan ke rumusan masalah, dan sebaliknya.',
      });
      const extra = uniq(questions.flatMap((q) => q.words)).filter((w) => !pad(normalize(judul)).includes(' ' + w.slice(0, 5)));
      if (extra.length > 6) add('koherensi', { nama: 'Rumusan masalah tidak melebar dari judul', hal, status: 'warn', detail: 'Istilah di rumusan masalah yang tidak ada di judul: ' + extra.slice(0, 8).join(', ') + '.', saran: 'Periksa apakah rumusan masalah memuat variabel/fokus baru yang tidak tercermin di judul.' });
    }

    // 2. Judul mencerminkan jenis penelitian
    if (judul) {
      const nj = normalize(judul);
      const harap = { rnd: ['pengembangan', 'model', 'produk', 'media', 'modul'], instrumen: ['pengembangan', 'instrumen', 'skala', 'tes', 'asesmen'], eksperimen: ['pengaruh', 'efektivitas', 'perbedaan', 'eksperimen', 'penerapan'], asosiatif: ['pengaruh', 'hubungan', 'determinan', 'faktor', 'kontribusi', 'peran'], evaluasi: ['evaluasi'], kebijakan: ['kebijakan', 'implementasi'], tindakan: ['peningkatan', 'meningkatkan', 'upaya', 'tindakan', 'penerapan'], kualitatif: ['studi', 'analisis', 'fenomenologi', 'etnografi', 'kasus', 'makna', 'pengalaman', 'strategi', 'praktik', 'konstruksi'] }[jenisId] || [];
      const hit = harap.filter((w) => has(nj, w));
      add('koherensi', { nama: 'Judul mencerminkan jenis penelitian (' + R.JENIS[jenisId].label.split(' (')[0] + ')', hal: '6–7, 32–39', status: hit.length ? 'ok' : 'warn', detail: hit.length ? 'Kata penanda di judul: ' + hit.join(', ') + '.' : 'Judul tidak memuat kata penanda yang lazim (' + harap.join(', ') + ').', saran: 'Sesuaikan judul agar menunjukkan jenis penelitian dan luarannya.', wajib: false });
    }

    if (questions.length) {
      // 3. Rumusan masalah ↔ tujuan
      if (!tujuanBlocks.length) add('koherensi', { nama: 'Rumusan masalah ↔ tujuan penelitian', hal, status: 'miss', detail: 'Subbagian Tujuan Penelitian tidak ditemukan di Bab I maupun Bab III.', saran: 'Tambahkan tujuan penelitian yang menjawab setiap rumusan masalah.' });
      else {
        const weak = questions.map((q, i) => [i + 1, coverage(q.words, tujuanNorm)]).filter(([, c]) => c < 0.6);
        const nT = countItems(tujuanBlocks);
        add('koherensi', {
          nama: 'Rumusan masalah ↔ tujuan penelitian', hal,
          status: weak.length === 0 && nT >= questions.length ? 'ok' : weak.length <= 1 ? 'warn' : 'miss',
          detail: questions.length + ' rumusan masalah, ±' + nT + ' butir tujuan. ' + (weak.length ? 'Rumusan yang istilahnya tidak muncul di tujuan: RM ' + weak.map(([i]) => i).join(', RM ') + '.' : 'Setiap rumusan masalah punya padanan tujuan.'),
          saran: 'Rumuskan satu tujuan untuk setiap rumusan masalah dengan istilah variabel/fokus yang sama.',
        });
      }
      // 4. Rumusan masalah ↔ Bab II
      if (chs[1]) {
        const weak = questions.map((q, i) => [i + 1, cell(q.words, 1).st]).filter(([, s]) => s !== 'ok');
        add('koherensi', { nama: 'Rumusan masalah ↔ kajian pustaka (Bab II)', hal: '28–29', status: weak.length === 0 ? 'ok' : weak.length < questions.length ? 'warn' : 'miss', detail: weak.length ? 'Variabel/fokus RM ' + weak.map(([i]) => i).join(', ') + ' tidak menjadi subjudul kajian di Bab II.' : 'Variabel/fokus setiap rumusan masalah dikaji sebagai subjudul di Bab II.', saran: 'Kaji setiap variabel/fokus yang ada di rumusan masalah dalam subbab tersendiri di Bab II.' });
      }
      // 5. Rumusan masalah ↔ hipotesis
      if (kuant && chs[1]) {
        const nH = hipBlocks.filter((b) => /terdapat|berpengaruh|pengaruh|hubungan|perbedaan|lebih tinggi|lebih baik|interaksi/.test(b.norm)).length;
        add('koherensi', { nama: 'Rumusan masalah ↔ hipotesis penelitian', hal: '29', status: !hipBlocks.length ? 'miss' : nH >= questions.length ? 'ok' : 'warn', detail: hipBlocks.length ? questions.length + ' rumusan masalah, ±' + nH + ' pernyataan hipotesis.' : 'Bagian hipotesis tidak ditemukan di Bab II.', saran: 'Rumuskan satu hipotesis untuk setiap rumusan masalah yang diuji.' });
      }
      // 6. Rumusan masalah ↔ metodologi (Bab III)
      if (chs[2]) {
        const weak = questions.map((q, i) => [i + 1, coverage(q.words, chNorm[2])]).filter(([, c]) => c < 0.8);
        add('koherensi', { nama: 'Rumusan masalah ↔ metodologi (Bab III)', hal: '30', status: weak.length === 0 ? 'ok' : 'warn', detail: weak.length ? 'Istilah RM ' + weak.map(([i]) => i).join(', ') + ' kurang tampak di Bab III (definisi operasional, instrumen, atau teknik analisis).' : 'Setiap rumusan masalah dioperasionalkan di Bab III.', saran: 'Pastikan setiap variabel/fokus punya definisi operasional, instrumen, dan teknik analisis di Bab III.' });
      }
      if (lengkap) {
        // 7. Rumusan masalah ↔ hasil
        const hasilIdx = 3;
        if (chs[hasilIdx]) {
          const weak = questions.map((q, i) => [i + 1, cell(q.words, hasilIdx).st]).filter(([, s]) => s !== 'ok');
          add('koherensi', { nama: 'Rumusan masalah ↔ hasil penelitian (Bab IV)', hal: '30', status: weak.length === 0 ? 'ok' : weak.length < questions.length ? 'warn' : 'miss', detail: weak.length ? 'Hasil untuk RM ' + weak.map(([i]) => i).join(', ') + ' tidak tampak sebagai subjudul Bab IV.' : 'Setiap rumusan masalah punya bagian hasil sendiri.', saran: 'Susun hasil penelitian per rumusan masalah, dengan subjudul yang memakai istilah yang sama.' });
        }
        // 8. Rumusan masalah ↔ simpulan
        if (chs[lastIdx]) {
          const weak = questions.map((q, i) => [i + 1, coverage(q.words, simNorm)]).filter(([, c]) => c < 0.6);
          const nS = countItems(simBlocks);
          add('koherensi', { nama: 'Rumusan masalah ↔ simpulan', hal: '31', status: weak.length === 0 ? 'ok' : weak.length < questions.length ? 'warn' : 'miss', detail: (simBlocks.length ? '±' + nS + ' butir simpulan. ' : 'Subbagian Simpulan tidak terbaca; diperiksa di seluruh bab. ') + (weak.length ? 'Simpulan belum menjawab RM ' + weak.map(([i]) => i).join(', ') + '.' : 'Setiap rumusan masalah terjawab di simpulan.'), saran: 'Tulis simpulan sebagai jawaban langsung atas setiap rumusan masalah (dan hasil uji hipotesis).' });
        }
      }
      // 9. Unsur judul di seluruh bab
      if (chunks.length) {
        const gaps = [];
        rows.filter((r) => r.kind === 'judul').forEach((r) => r.cells.forEach((c, k) => { if (c.st === 'miss') gaps.push('"' + r.label + '" di ' + cols[k]); }));
        add('koherensi', { nama: 'Unsur judul konsisten di setiap bab', hal, status: gaps.length === 0 ? 'ok' : gaps.length <= 2 ? 'warn' : 'miss', detail: gaps.length ? 'Tidak tampak: ' + gaps.slice(0, 6).join('; ') + (gaps.length > 6 ? '; …' : '') + '.' : 'Setiap unsur judul muncul di semua bab.', saran: 'Gunakan istilah variabel/fokus yang sama dengan judul secara konsisten di setiap bab.' });
      }
    }

    return { cols, rows, questions, chunks, lastIdx };
  }

  function guessTitle(front) {
    const skip = /^(tesis|disertasi|proposal|universitas|program|sekolah|diajukan|disusun|oleh|nim|nama|jakarta|untuk|sebagai|promotor|pembimbing|kementerian|lembar|halaman|abstrak|abstract)/;
    for (const b of front.slice(0, 25)) {
      if (b.words >= 4 && b.words <= 40 && !skip.test(b.norm) && !/^\d+$/.test(b.norm) && !b._toc && b.text === b.text.toUpperCase()) {
        // judul bisa terpecah ke beberapa baris
        let t = b.text; const i = front.indexOf(b);
        for (let k = i + 1; k < Math.min(i + 4, front.length); k++) {
          const n = front[k];
          if (n.words && n.text === n.text.toUpperCase() && !skip.test(n.norm) && n.words <= 20 && !/^\(/.test(n.text)) t += ' ' + n.text; else break;
        }
        return t;
      }
    }
    return null;
  }

  function formatChecks(parsed, S, add) {
    const near = (v, t, tol) => v != null && Math.abs(v - t) <= tol;
    if (parsed.kind === 'docx') {
      const f = parsed.format;
      const bodyBlocks = S.body.filter((b) => !b.inTable && !b._toc);
      const fontTot = {}, sizeTot = {};
      let tot = 0;
      for (const b of bodyBlocks) {
        for (const [k, v] of Object.entries(b.fontChars || {})) fontTot[k] = (fontTot[k] || 0) + v;
        for (const [k, v] of Object.entries(b.sizeChars || {})) sizeTot[k] = (sizeTot[k] || 0) + v;
        tot += b.chars || 0;
      }
      const tnr = Object.entries(fontTot).filter(([k]) => /times new roman/i.test(k)).reduce((a, [, v]) => a + v, 0);
      const fontKnown = Object.values(fontTot).reduce((a, v) => a + v, 0);
      const topFonts = Object.entries(fontTot).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + Math.round((v / (fontKnown || 1)) * 100) + '%').join(', ');
      add('format', { nama: 'Huruf Times New Roman', hal: '3', status: fontKnown === 0 ? 'info' : tnr / fontKnown >= 0.9 ? 'ok' : tnr / fontKnown >= 0.7 ? 'warn' : 'miss', detail: fontKnown ? 'Komposisi huruf isi: ' + topFonts + '.' : 'Jenis huruf tidak tercatat eksplisit pada dokumen.', saran: 'Gunakan Times New Roman untuk seluruh naskah termasuk judul dan nomor halaman.' });
      const s12 = sizeTot['12'] || 0;
      const sizeKnown = Object.values(sizeTot).reduce((a, v) => a + v, 0);
      add('format', { nama: 'Ukuran huruf 12 pt', hal: '3', status: sizeKnown === 0 ? 'info' : s12 / sizeKnown >= 0.85 ? 'ok' : s12 / sizeKnown >= 0.6 ? 'warn' : 'miss', detail: sizeKnown ? Math.round((s12 / sizeKnown) * 100) + '% teks isi berukuran 12 pt.' : 'Ukuran huruf tidak tercatat.', saran: 'Gunakan ukuran 12 pt untuk teks isi.' });
      const sp = bodyBlocks.filter((b) => b.spacing != null && b.words > 15);
      const sp15 = sp.filter((b) => near(b.spacing, 1.5, 0.08)).length;
      add('format', { nama: 'Spasi 1,5 pada isi', hal: '3', status: !sp.length ? 'info' : sp15 / sp.length >= 0.85 ? 'ok' : sp15 / sp.length >= 0.6 ? 'warn' : 'miss', detail: sp.length ? Math.round((sp15 / sp.length) * 100) + '% paragraf isi berspasi 1,5.' : 'Spasi tidak tercatat.', saran: 'Atur spasi paragraf isi menjadi 1,5 (kecuali abstrak & daftar pustaka spasi 1).' });

      const sec = f.sections.length ? f.sections[f.sections.length - 1] : null;
      if (sec) {
        const a4 = near(Math.min(sec.width, sec.height), 21, 0.2) && near(Math.max(sec.width, sec.height), 29.7, 0.2);
        add('format', { nama: 'Kertas A4 (21 × 29,7 cm)', hal: '3', status: a4 ? 'ok' : 'miss', detail: 'Ukuran halaman: ' + sec.width + ' × ' + sec.height + ' cm.', saran: 'Atur ukuran kertas A4.' });
        const m = sec;
        const mOk = near(m.top, 3, 0.15) && near(m.right, 3, 0.15) && near(m.bottom, 3, 0.15) && near(m.left + (m.gutter || 0), 4, 0.15);
        add('format', { nama: 'Margin atas 3, kanan 3, bawah 3, kiri 4 cm', hal: '3', status: mOk ? 'ok' : 'miss', detail: 'Margin: atas ' + m.top + ', kanan ' + m.right + ', bawah ' + m.bottom + ', kiri ' + m.left + (m.gutter ? ' (+gutter ' + m.gutter + ')' : '') + ' cm' + (f.mirror ? '; mode mirror margins aktif' : '') + '.', saran: 'Atur margin: atas 3 cm, kanan 3 cm, bawah 3 cm, kiri 4 cm.' });
        const roman = f.sections.some((s) => /roman/i.test(s.numFmt || ''));
        add('format', { nama: 'Penomoran halaman: romawi kecil (bagian awal) & arab (isi)', hal: '3–4', status: !f.footerHasPage ? 'miss' : roman ? 'ok' : 'warn', detail: !f.footerHasPage ? 'Tidak ditemukan field nomor halaman di footer.' : roman ? 'Ditemukan section bernomor romawi dan nomor halaman di footer.' : 'Nomor halaman ada, tetapi tidak ditemukan section bernomor romawi untuk bagian awal.', saran: 'Gunakan i, ii, iii… untuk bagian awal dan 1, 2, 3… untuk isi (pojok bawah kanan/kiri; tengah pada halaman judul bab).' });
      }
      const pustSp = S.refs.filter((b) => b.spacing != null);
      if (pustSp.length) {
        const single = pustSp.filter((b) => b.spacing <= 1.15).length / pustSp.length;
        add('format', { nama: 'Daftar pustaka spasi 1', hal: '15, 31', status: single >= 0.8 ? 'ok' : 'warn', detail: Math.round(single * 100) + '% entri berspasi tunggal.', saran: 'Atur daftar pustaka berspasi 1, rata kiri, baris kedua menjorok 1,27 cm.' });
      }
    } else {
      const f = parsed.format;
      if (f.pageCm) {
        const a4 = near(f.pageCm[0], 21, 0.3) && near(f.pageCm[1], 29.7, 0.3);
        add('format', { nama: 'Kertas A4 (21 × 29,7 cm)', hal: '3', status: a4 ? 'ok' : 'miss', detail: 'Ukuran halaman (median): ' + f.pageCm[0] + ' × ' + f.pageCm[1] + ' cm.', saran: 'Atur ukuran kertas A4.' });
      }
      const m = f.margins;
      if (m.left != null) {
        const ok = near(m.left, 4, 0.5) && near(m.right, 3, 0.6) && near(m.top, 3, 0.7);
        add('format', { nama: 'Margin (perkiraan dari posisi teks)', hal: '3', status: ok ? 'ok' : 'warn', detail: 'Perkiraan: kiri ' + m.left + ', kanan ' + m.right + ', atas ' + m.top + ', bawah ' + m.bottom + ' cm (dari tepi teks; header/footer dapat memengaruhi).', saran: 'Pastikan margin atas 3, kanan 3, bawah 3, kiri 4 cm.' });
      }
      const fn = Object.entries(f.fontNames || {});
      if (fn.length) {
        const tot = fn.reduce((a, [, v]) => a + v, 0);
        const tnr = fn.filter(([k]) => /times/i.test(k)).reduce((a, [, v]) => a + v, 0);
        add('format', { nama: 'Huruf Times New Roman', hal: '3', status: tnr / tot >= 0.85 ? 'ok' : tnr / tot >= 0.6 ? 'warn' : 'miss', detail: 'Sampel font: ' + fn.sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + Math.round((v / tot) * 100) + '%').join(', ') + '.', saran: 'Gunakan Times New Roman di seluruh naskah.' });
      }
      add('format', { nama: 'Spasi, ukuran huruf, penomoran halaman', hal: '3–4', status: 'info', detail: 'Tidak dapat diperiksa akurat dari PDF. Unggah versi .docx untuk pemeriksaan format lengkap.', saran: '' });
    }
  }

  function score(groups) {
    const res = {};
    let tOk = 0, tAll = 0;
    for (const [g, items] of Object.entries(groups)) {
      let ok = 0, all = 0;
      for (const it of items) {
        if (it.status === 'na' || it.status === 'info') continue;
        const w = it.wajib === false ? 0.5 : 1;
        all += w;
        ok += w * (it.status === 'ok' ? 1 : it.status === 'warn' ? 0.5 : 0);
      }
      res[g] = all ? Math.round((ok / all) * 100) : null;
      tOk += ok; tAll += all;
    }
    res.total = tAll ? Math.round((tOk / tAll) * 100) : 0;
    return res;
  }

  global.Analyzer = { analyze, score, ROMAN_OUT };
})(window);
