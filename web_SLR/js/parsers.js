/* Telaah SLR — pembaca CSV, RIS, BibTeX, dan PDF */
'use strict';

const FIELD_ALIASES = {
  title: ['title', 'article title', 'document title', 'ti', 't1', 'judul', 'primary title'],
  abstract: ['abstract', 'ab', 'abstrak', 'abstract note', 'n2'],
  authors: ['authors', 'author', 'author full names', 'au', 'author(s)', 'penulis', 'author names'],
  year: ['year', 'publication year', 'py', 'tahun', 'pubyear', 'publication date', 'date', 'create date'],
  journal: ['source title', 'journal', 'journal/book', 'so', 'publication title', 'source', 'jurnal', 'journal title', 'secondary title'],
  doi: ['doi', 'di', 'doi link'],
  keywords: ['author keywords', 'keywords', 'index keywords', 'de', 'mesh terms', 'kata kunci', 'manual tags']
};
const TARGETS = [['title', 'Judul'], ['abstract', 'Abstrak'], ['authors', 'Penulis'], ['year', 'Tahun'], ['journal', 'Jurnal / sumber'], ['doi', 'DOI'], ['keywords', 'Kata kunci']];

const Parsers = {
  guessMapping(headers) {
    const map = {};
    const norm = headers.map(h => String(h).trim().toLowerCase().replace(/^﻿/, ''));
    TARGETS.forEach(([k]) => {
      const aliases = FIELD_ALIASES[k];
      let idx = -1;
      for (const a of aliases) { idx = norm.indexOf(a); if (idx >= 0) break; }
      if (idx < 0) idx = norm.findIndex(h => aliases.some(a => a.length > 3 && h.includes(a)));
      map[k] = idx >= 0 ? headers[idx] : '';
    });
    return map;
  },

  parseCSV(text) {
    const res = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: h => h.replace(/^﻿/, '').trim() });
    return { headers: res.meta.fields || [], rows: res.data };
  },

  rowsToRecords(rows, map) {
    return rows.map(r => {
      const g = k => (map[k] ? String(r[map[k]] ?? '').trim() : '');
      const yr = (g('year').match(/(19|20)\d{2}/) || [''])[0];
      return { title: g('title'), abstract: g('abstract'), authors: g('authors'), year: yr, journal: g('journal'), doi: normDoi(g('doi')), keywords: g('keywords') };
    }).filter(r => r.title || r.abstract);
  },

  parseRIS(text) {
    const out = [];
    let cur = null;
    const push = (k, v) => { cur[k] = cur[k] ? cur[k] + (k === 'abstract' ? ' ' : '; ') + v : v; };
    text.split(/\r?\n/).forEach(line => {
      const m = line.match(/^([A-Z][A-Z0-9])  -\s?(.*)$/);
      if (!m) { if (cur && cur._last && line.trim()) push(cur._last, line.trim()); return; }
      const [, tag, val] = m;
      const v = val.trim();
      if (tag === 'TY') { cur = { title: '', abstract: '', authors: '', year: '', journal: '', doi: '', keywords: '' }; return; }
      if (!cur) return;
      if (tag === 'ER') { delete cur._last; out.push(cur); cur = null; return; }
      const key = { TI: 'title', T1: 'title', AB: 'abstract', N2: 'abstract', AU: 'authors', A1: 'authors', PY: 'year', Y1: 'year', DA: 'year', JO: 'journal', JF: 'journal', T2: 'journal', JA: 'journal', DO: 'doi', KW: 'keywords' }[tag];
      if (!key) { cur._last = null; return; }
      if (key === 'year') { if (!cur.year) cur.year = (v.match(/(19|20)\d{2}/) || [''])[0]; return; }
      if (key === 'journal' && cur.journal) return;
      if (key === 'title' && cur.title) return;
      push(key, v);
      cur._last = key;
    });
    return out.map(r => ({ ...r, doi: normDoi(r.doi) }));
  },

  // Format MEDLINE/NBIB (PubMed, ERIC): tag rata kiri hingga 4 huruf, baris lanjutan diawali spasi
  parseMedline(text) {
    const out = [];
    text.replace(/^﻿/, '').replace(/\r/g, '').split(/\n\s*\n(?=[A-Z][A-Z0-9]{1,3}\s*- )/).forEach(block => {
      const f = {};
      let last = null;
      block.split('\n').forEach(line => {
        const m = line.match(/^([A-Z][A-Z0-9]{1,3})\s*- ?(.*)$/);
        if (m) { last = m[1]; (f[last] = f[last] || []).push(m[2].trim()); }
        else if (last && line.trim()) { const a = f[last]; a[a.length - 1] += ' ' + line.trim(); }
      });
      const one = k => (f[k] || [])[0] || '';
      const title = one('TI') || one('BTI');
      if (!title) return;
      const doi = [...(f.AID || []), ...(f.LID || []), ...(f.DOI || [])].map(x => (x.match(/10\.\d{4,9}\/\S+/) || [''])[0]).find(Boolean) || '';
      out.push({
        title, abstract: (f.AB || []).join(' '),
        authors: (f.AU || f.FAU || []).join('; '),
        year: (one('DP').match(/(19|20)\d{2}/) || one('DEP').match(/(19|20)\d{2}/) || [''])[0],
        journal: one('JT') || one('TA') || one('SO').split(/[.,;]/)[0],
        doi: normDoi(doi.replace(/[.;,]$/, '')),
        keywords: [...(f.OT || []), ...(f.MH || [])].join('; ')
      });
    });
    return out;
  },

  parseBib(text) {
    const out = [];
    let i = 0;
    while ((i = text.indexOf('@', i)) >= 0) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const type = text.slice(i + 1, open).trim().toLowerCase();
      let depth = 0, j = open;
      for (; j < text.length; j++) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') { depth--; if (depth === 0) break; }
      }
      const body = text.slice(open + 1, j);
      i = j + 1;
      if (['comment', 'preamble', 'string'].includes(type)) continue;
      const fields = {};
      const comma = body.indexOf(',');
      let k = comma + 1;
      while (k < body.length) {
        const eq = body.indexOf('=', k);
        if (eq < 0) break;
        const name = body.slice(k, eq).replace(/[\s,]/g, '').toLowerCase();
        let p = eq + 1;
        while (/\s/.test(body[p])) p++;
        let val = '';
        if (body[p] === '{') {
          let d = 0, q = p;
          for (; q < body.length; q++) { if (body[q] === '{') d++; else if (body[q] === '}') { d--; if (d === 0) break; } }
          val = body.slice(p + 1, q); k = q + 1;
        } else if (body[p] === '"') {
          const q = body.indexOf('"', p + 1); val = body.slice(p + 1, q); k = q + 1;
        } else {
          const q = body.indexOf(',', p); val = body.slice(p, q < 0 ? body.length : q); k = q < 0 ? body.length : q;
        }
        fields[name] = val.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
        const nc = body.indexOf(',', k); k = nc < 0 ? body.length : nc + 1;
      }
      out.push({
        title: fields.title || '', abstract: fields.abstract || '', authors: (fields.author || '').replace(/\s+and\s+/g, '; '),
        year: (String(fields.year || fields.date || '').match(/(19|20)\d{2}/) || [''])[0],
        journal: fields.journal || fields.booktitle || fields.publisher || '', doi: normDoi(fields.doi), keywords: fields.keywords || ''
      });
    }
    return out.filter(r => r.title || r.abstract);
  },

  // Judul yang sebenarnya kode file/ID, mis. "STU_0004", "s10639-025-13622-5", "AAOUJ-10-2023-0126_proof 1..13"
  junkTitle(t) {
    t = String(t || '').trim();
    if (t.length < 12) return true;
    if (!/\s/.test(t)) return true;
    if (/\d+\.\.\d+/.test(t)) return true;
    if (/^(untitled|microsoft word|doi|layout|document|manuscript|\d)/i.test(t)) return true;
    if (/(_proof|_chapter|\.indd|\.docx?|\.pdf)\b/i.test(t)) return true;
    if (/^(r e s e a r c h|research article|original article|open access)/i.test(t)) return true;
    const words = t.split(/\s+/).filter(w => /[A-Za-zÀ-ÿ\u0400-\u04FF\u0600-\u06FF]{2,}/.test(w));
    return words.length < 3;
  },

  // Tebak judul dari halaman pertama: baris berhuruf terbesar yang bukan kepala jurnal
  titleFromPage(tc) {
    const items = tc.items.filter(it => it.str.trim());
    const h = it => Math.round((Math.abs(it.transform[3]) || it.height || 0) * 10) / 10;
    const header = /(open access|journal|vol(ume)?\.?\s*\d|issn|doi|copyright|©|received|accepted|published|r e s e a r c h|research article|original (article|research)|www\.|http|elsevier|springer|taylor|emerald|wiley|cite this|downloaded)/i;
    const sizes = [...new Set(items.map(h))].sort((a, b) => b - a);
    for (const size of sizes.slice(0, 6)) {
      const txt = items.filter(it => Math.abs(h(it) - size) <= size * 0.06).map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
      if (txt.length >= 15 && txt.length <= 400 && !header.test(txt) && !this.junkTitle(txt)) return txt;
    }
    return '';
  },

  async readPDF(file) {
    if (!window.pdfjsLib) throw new Error('Pustaka PDF.js belum termuat. Periksa koneksi internet lalu muat ulang halaman.');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
    const pages = [];
    let titleGuess = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      let s = '';
      tc.items.forEach(it => { s += it.str + (it.hasEOL ? '\n' : (it.str.endsWith(' ') ? '' : ' ')); });
      pages.push(s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim());
      if (p === 1) titleGuess = this.titleFromPage(tc);
    }
    let meta = {};
    try { meta = (await pdf.getMetadata()).info || {}; } catch (e) { /* tanpa metadata */ }
    const head = pages.slice(0, 2).join('\n');
    const metaTitle = (meta.Title || '').trim();
    const fileName = file.name || '';
    const title = !this.junkTitle(metaTitle) ? metaTitle : titleGuess ? titleGuess.slice(0, 300) : fileName.replace(/\.pdf$/i, '');
    const abs = head.match(/\babstract\b[:.\s—-]*([\s\S]{80,3000}?)(?=\n\s*(keywords?|key words|introduction|background|1\.?\s+introduction|kata kunci|pendahuluan)\b)/i)
      || head.match(/\babstrak\b[:.\s—-]*([\s\S]{80,3000}?)(?=\n\s*(kata kunci|pendahuluan|keywords?)\b)/i);
    const doi = (head.match(/10\.\d{4,9}\/[-._;()/:a-z0-9]+[a-z0-9]/i) || [''])[0];
    const year = (head.match(/\b(19[89]\d|20[0-4]\d)\b/) || [''])[0];
    return {
      pages, numPages: pdf.numPages,
      rec: { fileName, title, abstract: abs ? abs[1].replace(/\s+/g, ' ').trim() : '', authors: (meta.Author || '').trim(), year, journal: '', doi: normDoi(doi), keywords: (meta.Keywords || '').trim() }
    };
  },

  // Cocokkan PDF dengan rekaman yang sudah ada (DOI atau judul di halaman awal)
  matchRecord(parsed, records) {
    const doi = parsed.rec.doi;
    if (doi) {
      const r = records.find(x => x.doi && normDoi(x.doi) === doi && !x.duplicateOf);
      if (r) return r;
    }
    const head = normTitle(parsed.pages.slice(0, 2).join(' '));
    return records.find(x => !x.duplicateOf && !x.hasText && x.title && normTitle(x.title).length > 25 && head.includes(normTitle(x.title))) || null;
  }
};
