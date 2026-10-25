/* Telaah SLR — pencocokan kata kunci kriteria inklusi/eksklusi & penyorotan */
'use strict';

const Criteria = {
  _cache: null,
  _key: '',

  parseTerms(str) {
    const out = [];
    // spasi sebelum tanda kutip dilewati; kutip lurus maupun lengkung (“ ” ‘ ’) dibuang dari istilah
    const re = /\s*(?:["“”]([^"“”]+)["“”]|([^,;\n]+))/g;
    let m;
    while ((m = re.exec(str || ''))) {
      if (!m[0]) { re.lastIndex++; continue; }
      const t = (m[1] || m[2] || '').trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
      if (t) out.push(t);
    }
    return out;
  },

  termSrc(t) {
    return t.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[\\p{L}\\p{N}-]*')
      .replace(/\s+/g, '[\\s-]+');
  },

  // Bangun regex per kriteria (di-cache sampai kriteria berubah)
  compiled(crit) {
    const key = JSON.stringify(crit);
    if (this._cache && key === this._key) return this._cache;
    const B = '(?<![\\p{L}\\p{N}])', E = '(?![\\p{L}\\p{N}])';
    const build = (c, kind, i) => {
      const terms = this.parseTerms(c.terms);
      if (!terms.length) return null;
      return {
        id: c.id, label: c.label || (kind === 'inc' ? 'Kriteria ' + (i + 1) : 'Eksklusi ' + (i + 1)), kind, idx: i, terms,
        re: new RegExp(B + '(?:' + terms.map(t => this.termSrc(t)).join('|') + ')' + E, 'giu'),
        termRes: terms.map(t => ({ t, re: new RegExp(B + this.termSrc(t) + E, 'giu') }))
      };
    };
    const inc = crit.include.map((c, i) => build(c, 'inc', i)).filter(Boolean);
    const exc = crit.exclude.map((c, i) => build(c, 'exc', i)).filter(Boolean);
    this._cache = { inc, exc, mode: crit.mode };
    this._key = key;
    return this._cache;
  },

  // Evaluasi teks → status penanda otomatis
  evaluate(text, crit) {
    const C = this.compiled(crit);
    const txt = text || '';
    const hits = c => { c.re.lastIndex = 0; const m = txt.match(c.re); return m ? m.length : 0; };
    const inc = C.inc.map(c => ({ id: c.id, label: c.label, idx: c.idx, n: hits(c) }));
    const exc = C.exc.map(c => ({ id: c.id, label: c.label, idx: c.idx, n: hits(c) }));
    const incMatched = inc.filter(x => x.n > 0).length;
    const excMatched = exc.filter(x => x.n > 0).length;
    const total = inc.length;
    let flag = 'none';
    if (!total && !exc.length) flag = 'nocrit';
    else {
      const incOk = total > 0 && (C.mode === 'any' ? incMatched > 0 : incMatched === total);
      if (incOk && !excMatched) flag = 'include';
      else if (incOk && excMatched) flag = 'mixed';
      else if (excMatched) flag = 'exclude';
      else if (incMatched) flag = 'partial';
    }
    const score = (total ? incMatched / total : 0) - (excMatched ? 0.5 : 0);
    return { flag, inc, exc, incMatched, total, excMatched, score };
  },

  // Rincian hit per istilah (untuk panel "kata kunci terdeteksi")
  termHits(text, crit) {
    const C = this.compiled(crit);
    const txt = text || '';
    return [...C.inc, ...C.exc].map(c => ({
      label: c.label, kind: c.kind, idx: c.idx,
      terms: c.termRes.map(({ t, re }) => { re.lastIndex = 0; const m = txt.match(re); return { t, n: m ? m.length : 0 }; })
    }));
  },

  // Sorot teks (mengembalikan HTML aman)
  highlight(text, crit, find = '') {
    const C = this.compiled(crit);
    const parts = [];
    if (find && find.trim()) parts.push({ cls: 'hl-find', src: find.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), raw: true });
    C.exc.forEach(c => parts.push({ cls: 'hl-exc', src: c.terms.map(t => this.termSrc(t)).join('|'), title: c.label }));
    C.inc.forEach(c => parts.push({ cls: 'hl-inc hl-c' + (c.idx % 6), src: c.terms.map(t => this.termSrc(t)).join('|'), title: c.label }));
    const s = String(text || '');
    if (!parts.length) return esc(s);
    const B = '(?<![\\p{L}\\p{N}])', E = '(?![\\p{L}\\p{N}])';
    const re = new RegExp(parts.map(p => p.raw ? '(' + p.src + ')' : '(' + B + '(?:' + p.src + ')' + E + ')').join('|'), 'giu');
    let out = '', last = 0, m;
    while ((m = re.exec(s))) {
      if (!m[0]) { re.lastIndex++; continue; }
      const gi = m.findIndex((g, i) => i > 0 && g !== undefined) - 1;
      const p = parts[gi];
      out += esc(s.slice(last, m.index)) + '<mark class="' + p.cls + '"' + (p.title ? ' title="' + esc(p.title) + '"' : '') + '>' + esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
    }
    return out + esc(s.slice(last));
  }
};

const FLAG_META = {
  include: { label: 'Memenuhi kriteria', short: 'Memenuhi', cls: 'flag-inc' },
  mixed: { label: 'Memenuhi + ada kata eksklusi', short: 'Perlu cek', cls: 'flag-mix' },
  partial: { label: 'Sebagian kriteria', short: 'Sebagian', cls: 'flag-part' },
  exclude: { label: 'Terdeteksi kata eksklusi', short: 'Eksklusi', cls: 'flag-exc' },
  none: { label: 'Tidak ada kata kunci', short: 'Tidak cocok', cls: 'flag-none' },
  nocrit: { label: 'Kriteria belum diisi', short: '—', cls: 'flag-none' }
};
