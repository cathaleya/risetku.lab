/*
 * Parser naskah: mengubah .docx atau .pdf menjadi daftar "blok" (paragraf/baris)
 * yang seragam, ditambah informasi format halaman bila tersedia.
 *
 * Blok: { text, norm, words, level, bold, numbered, inTable, isToc,
 *         font, size, spacing, page }
 */
(function (global) {
  'use strict';

  const TWIP_PER_CM = 566.93;

  function normalize(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9&]+/g, ' ')
      .trim();
  }

  function countWords(s) {
    const m = (s || '').match(/[A-Za-zÀ-ɏ0-9]+(?:[-'’][A-Za-zÀ-ɏ0-9]+)*/g);
    return m ? m.length : 0;
  }

  function makeBlock(text, extra) {
    const t = (text || '').replace(/ /g, ' ').replace(/[   ]+/g, ' ').trim();
    return Object.assign({
      text: t, norm: normalize(t), words: countWords(t),
      level: null, bold: false, numbered: false, inTable: false, isToc: false,
      font: null, size: null, spacing: null, page: null,
    }, extra || {});
  }

  // ------------------------------------------------------------------ DOCX

  function child(el, name) {
    if (!el) return null;
    for (const c of el.children) if (c.nodeName === name) return c;
    return null;
  }
  function attr(el, name) { return el ? el.getAttribute(name) : null; }
  function isOn(el) {
    if (!el) return null;
    const v = attr(el, 'w:val');
    return !(v === 'false' || v === '0' || v === 'none');
  }

  function readRPr(rPr, theme) {
    if (!rPr) return {};
    const o = {};
    const f = child(rPr, 'w:rFonts');
    if (f) {
      const theme_ = attr(f, 'w:asciiTheme') || attr(f, 'w:hAnsiTheme');
      // Atribut tema mengalahkan nama font eksplisit (perilaku Word).
      o.font = (theme_ ? (theme_.startsWith('major') ? theme.major : theme.minor) : null) || attr(f, 'w:ascii') || attr(f, 'w:hAnsi');
    }
    const sz = child(rPr, 'w:sz');
    if (sz) o.size = parseInt(attr(sz, 'w:val'), 10) / 2;
    const b = child(rPr, 'w:b');
    if (b) o.bold = isOn(b);
    return o;
  }

  function readPPr(pPr) {
    if (!pPr) return {};
    const o = {};
    const sp = child(pPr, 'w:spacing');
    if (sp && attr(sp, 'w:line')) {
      const line = parseInt(attr(sp, 'w:line'), 10);
      const rule = attr(sp, 'w:lineRule') || 'auto';
      o.spacing = rule === 'auto' ? Math.round((line / 240) * 100) / 100 : null;
      if (rule !== 'auto') o.spacingExact = line / 20;
    }
    const ol = child(pPr, 'w:outlineLvl');
    if (ol) o.level = parseInt(attr(ol, 'w:val'), 10);
    if (child(pPr, 'w:numPr')) o.numbered = true;
    return o;
  }

  function parseStyles(stylesDoc, theme) {
    const map = {};
    const defaults = { r: {}, p: {} };
    if (!stylesDoc) return { map, defaults, resolve: () => ({}) };
    let defaultPara = null;
    const dd = stylesDoc.getElementsByTagName('w:docDefaults')[0];
    if (dd) {
      const rd = dd.getElementsByTagName('w:rPr')[0];
      const pd = dd.getElementsByTagName('w:pPr')[0];
      defaults.r = readRPr(rd, theme);
      defaults.p = readPPr(pd);
    }
    for (const s of stylesDoc.getElementsByTagName('w:style')) {
      const id = attr(s, 'w:styleId');
      const nameEl = child(s, 'w:name');
      const name = nameEl ? attr(nameEl, 'w:val') : id;
      const basedOn = child(s, 'w:basedOn');
      const p = readPPr(child(s, 'w:pPr'));
      const r = readRPr(child(s, 'w:rPr'), theme);
      const m = /^heading\s*(\d)$/i.exec(name || '');
      if (m && p.level == null) p.level = parseInt(m[1], 10) - 1;
      if (/^title$/i.test(name || '') && p.level == null) p.level = 0;
      map[id] = { id, name, type: attr(s, 'w:type'), basedOn: basedOn ? attr(basedOn, 'w:val') : null, p, r };
      if (attr(s, 'w:type') === 'paragraph' && /^(1|true|on)$/.test(attr(s, 'w:default') || '')) defaultPara = id;
    }
    const cache = {};
    function resolve(id) {
      // Paragraf tanpa pStyle memakai style paragraf default (biasanya "Normal").
      if (!id && defaultPara) id = defaultPara;
      if (!id || !map[id]) return { p: {}, r: {}, name: id || '' };
      if (cache[id]) return cache[id];
      const st = map[id];
      const parent = st.basedOn && st.basedOn !== id ? resolve(st.basedOn) : { p: {}, r: {} };
      const res = { name: st.name, p: Object.assign({}, parent.p, st.p), r: Object.assign({}, parent.r, st.r) };
      cache[id] = res;
      return res;
    }
    return { map, defaults, resolve };
  }

  function parseTheme(themeDoc) {
    const t = { major: null, minor: null };
    if (!themeDoc) return t;
    const maj = themeDoc.getElementsByTagName('a:majorFont')[0];
    const min = themeDoc.getElementsByTagName('a:minorFont')[0];
    const lat = (el) => { const l = el && el.getElementsByTagName('a:latin')[0]; return l ? l.getAttribute('typeface') : null; };
    t.major = lat(maj); t.minor = lat(min);
    return t;
  }

  function readSect(sectPr) {
    const pgSz = child(sectPr, 'w:pgSz');
    const pgMar = child(sectPr, 'w:pgMar');
    const pgNum = child(sectPr, 'w:pgNumType');
    const cm = (v) => (v == null ? null : Math.round((parseInt(v, 10) / TWIP_PER_CM) * 100) / 100);
    return {
      width: cm(attr(pgSz, 'w:w')), height: cm(attr(pgSz, 'w:h')),
      orient: attr(pgSz, 'w:orient') || 'portrait',
      top: cm(attr(pgMar, 'w:top')), bottom: cm(attr(pgMar, 'w:bottom')),
      left: cm(attr(pgMar, 'w:left')), right: cm(attr(pgMar, 'w:right')),
      gutter: cm(attr(pgMar, 'w:gutter')),
      numFmt: attr(pgNum, 'w:fmt'),
      footerRefs: Array.from(sectPr.children).filter((c) => c.nodeName === 'w:footerReference').length,
    };
  }

  async function parseDocx(buf) {
    const zip = await JSZip.loadAsync(buf);
    const xml = async (p) => { const f = zip.file(p); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
    const doc = await xml('word/document.xml');
    if (!doc) throw new Error('Berkas .docx tidak valid (word/document.xml tidak ditemukan).');
    const theme = parseTheme(await xml('word/theme/theme1.xml'));
    const styles = parseStyles(await xml('word/styles.xml'), theme);
    const settings = await xml('word/settings.xml');

    const blocks = [];
    const sections = [];
    const body = doc.getElementsByTagName('w:body')[0];

    function paraBlock(p, ctx) {
      const pPr = child(p, 'w:pPr');
      const ps = child(pPr, 'w:pStyle');
      const st = styles.resolve(ps ? attr(ps, 'w:val') : null);
      const pp = Object.assign({}, styles.defaults.p, st.p, readPPr(pPr));
      const baseR = Object.assign({}, styles.defaults.r, st.r);

      let text = '';
      let boldChars = 0, totalChars = 0;
      const fontChars = {}, sizeChars = {};
      let hasPageRef = false;
      for (const instr of p.getElementsByTagName('w:instrText')) if (/PAGEREF|TOC/.test(instr.textContent)) hasPageRef = true;
      for (const fs of p.getElementsByTagName('w:fldSimple')) if (/PAGEREF/.test(attr(fs, 'w:instr') || '')) hasPageRef = true;
      for (const h of p.getElementsByTagName('w:hyperlink')) if (/^_Toc/.test(attr(h, 'w:anchor') || '')) hasPageRef = true;

      for (const r of p.getElementsByTagName('w:r')) {
        const rPr = child(r, 'w:rPr');
        const rs = child(rPr, 'w:rStyle');
        const cst = rs ? styles.resolve(attr(rs, 'w:val')) : { r: {} };
        const rp = Object.assign({}, baseR, cst.r, readRPr(rPr, theme));
        let rt = '';
        for (const c of r.children) {
          if (c.nodeName === 'w:t') rt += c.textContent;
          else if (c.nodeName === 'w:tab') rt += '\t';
          else if (c.nodeName === 'w:br' || c.nodeName === 'w:cr') rt += ' ';
        }
        if (!rt) continue;
        text += rt;
        const n = rt.replace(/\s/g, '').length;
        totalChars += n;
        if (rp.bold) boldChars += n;
        if (rp.font) fontChars[rp.font] = (fontChars[rp.font] || 0) + n;
        if (rp.size) sizeChars[rp.size] = (sizeChars[rp.size] || 0) + n;
      }
      const top = (o) => { let k = null, v = -1; for (const x in o) if (o[x] > v) { v = o[x]; k = x; } return k; };
      const b = makeBlock(text, {
        level: pp.level != null && pp.level < 9 ? pp.level : null,
        bold: totalChars > 0 && boldChars / totalChars > 0.6,
        numbered: !!pp.numbered,
        inTable: ctx.inTable,
        isToc: ctx.inToc || /^toc|^daftar isi|table of figures/i.test(st.name || '') || hasPageRef,
        style: st.name || '',
        font: top(fontChars), size: top(sizeChars) ? parseFloat(top(sizeChars)) : null,
        spacing: pp.spacing != null ? pp.spacing : null,
        chars: totalChars, fontChars, sizeChars,
      });
      b.rawText = text;
      return b;
    }

    // Gambar (drawing/pict) dicatat pada blok teks berikutnya sebagai imagesBefore.
    let pendingImages = 0, tableCount = 0;
    function walk(el, ctx) {
      for (const c of el.children) {
        if (c.nodeName === 'w:p') {
          const b = paraBlock(c, ctx);
          b.section = sections.length;
          const imgs = c.getElementsByTagName('w:drawing').length + c.getElementsByTagName('w:pict').length;
          if (ctx.tableId) Object.assign(b, { tableId: ctx.tableId, row: ctx.row, col: ctx.col });
          if (b.text) {
            b.imagesBefore = pendingImages;
            b.hasImage = imgs > 0;
            pendingImages = 0;
            blocks.push(b);
          } else if (imgs && !ctx.inTable) pendingImages += imgs;
          const sp = child(child(c, 'w:pPr'), 'w:sectPr');
          if (sp) sections.push(readSect(sp));
        } else if (c.nodeName === 'w:tbl') {
          const tableId = ++tableCount;
          let r = 0;
          for (const tr of c.children) {
            if (tr.nodeName !== 'w:tr') continue;
            let col = 0;
            for (const tc of tr.children) {
              if (tc.nodeName !== 'w:tc') continue;
              walk(tc, Object.assign({}, ctx, { inTable: true, tableId, row: r, col }));
              col++;
            }
            r++;
          }
        } else if (c.nodeName === 'w:sdt') {
          const gal = c.getElementsByTagName('w:docPartGallery')[0];
          const isToc = gal && /Table of Contents/i.test(attr(gal, 'w:val') || '');
          const content = child(c, 'w:sdtContent');
          if (content) walk(content, Object.assign({}, ctx, { inToc: ctx.inToc || isToc }));
        } else if (c.nodeName === 'w:sectPr') {
          sections.push(readSect(c));
        } else if (c.children && c.children.length && c.nodeName !== 'w:tc') {
          walk(c, ctx);
        }
      }
    }
    walk(body, { inTable: false, inToc: false });

    // Footer berisi field PAGE => penomoran halaman ada.
    let footerHasPage = false;
    for (const name of Object.keys(zip.files)) {
      if (/^word\/footer\d*\.xml$/.test(name)) {
        const s = await zip.file(name).async('string');
        if (/PAGE/.test(s)) footerHasPage = true;
      }
    }
    const mirror = settings ? !!settings.getElementsByTagName('w:mirrorMargins')[0] : false;

    return {
      kind: 'docx', blocks,
      format: { sections, footerHasPage, mirror, defaultFont: styles.defaults.r.font, theme },
    };
  }

  // ------------------------------------------------------------------- PDF

  async function parsePdf(buf, onProgress) {
    if (global.pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    }
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const blocks = [];
    const pageSizes = [];
    const leftMargins = [], rightMargins = [], topMargins = [], bottomMargins = [];
    const fontNames = {};
    const sampleEvery = Math.max(1, Math.floor(pdf.numPages / 15));
    let textChars = 0;

    for (let pn = 1; pn <= pdf.numPages; pn++) {
      const page = await pdf.getPage(pn);
      const [x0, y0, x1, y1] = page.view;
      const pw = x1 - x0, ph = y1 - y0;
      pageSizes.push([pw, ph]);
      const tc = await page.getTextContent();

      // Contoh nama font sebenarnya dari sebagian halaman.
      if (pn % sampleEvery === 0 || pn === 1) {
        try {
          await page.getOperatorList();
          const seen = new Set(tc.items.map((i) => i.fontName));
          for (const fn of seen) {
            try {
              const f = page.commonObjs.get(fn);
              const nm = (f && (f.name || f.loadedName)) || fn;
              const n = tc.items.filter((i) => i.fontName === fn).reduce((a, i) => a + i.str.length, 0);
              const clean = String(nm).replace(/^[A-Z]{6}\+/, '');
              fontNames[clean] = (fontNames[clean] || 0) + n;
            } catch (e) { /* font belum termuat */ }
          }
        } catch (e) { /* abaikan */ }
      }

      const items = tc.items.filter((i) => i.str && i.str.trim() !== '' || (i.str === ' '));
      items.sort((a, b) => (b.transform[5] - a.transform[5]) || (a.transform[4] - b.transform[4]));
      const lines = [];
      for (const it of items) {
        const x = it.transform[4], y = it.transform[5];
        const h = Math.abs(it.transform[3]) || it.height || 10;
        let ln = lines.length ? lines[lines.length - 1] : null;
        if (!ln || Math.abs(ln.y - y) > h * 0.5) {
          ln = { y, h, items: [] };
          lines.push(ln);
        }
        ln.items.push({ x, w: it.width, str: it.str, h });
      }
      const pageLines = [];
      for (const ln of lines) {
        ln.items.sort((a, b) => a.x - b.x);
        let s = '', lastEnd = null;
        for (const it of ln.items) {
          if (lastEnd != null && it.x - lastEnd > ln.h * 0.15 && !/\s$/.test(s) && !/^\s/.test(it.str)) s += ' ';
          s += it.str;
          lastEnd = it.x + it.w;
        }
        s = s.replace(/\s+/g, ' ').trim();
        if (!s) continue;
        const minX = ln.items[0].x, maxX = Math.max(...ln.items.map((i) => i.x + i.w));
        pageLines.push({ text: s, y: ln.y, h: ln.h, minX, maxX });
      }
      // buang nomor halaman yang berdiri sendiri
      const content = pageLines.filter((l) => !/^([ivxlc]{1,7}|\d{1,4})$/i.test(l.text));
      if (content.length) {
        leftMargins.push(Math.min(...content.map((l) => l.minX)) - x0);
        rightMargins.push(x1 - Math.max(...content.map((l) => l.maxX)));
        topMargins.push(y1 - Math.max(...content.map((l) => l.y + l.h)));
        bottomMargins.push(Math.min(...pageLines.map((l) => l.y)) - y0);
      }
      const maxW = content.length ? Math.max(...content.map((l) => l.maxX - l.minX)) : pw;
      const leftEdge = content.length ? Math.min(...content.map((l) => l.minX)) : 0;

      // Gabungkan baris lanjutan paragraf.
      let cur = null;
      for (const l of content) {
        textChars += l.text.length;
        const startsNew = /^(BAB\s+[IVX\d]+|[A-H]\.\s|\d+(\.\d+)*\.?\s|[a-h]\)\s|\d\)\s|•|-\s)/.test(l.text);
        const indented = l.minX - leftEdge > 15;
        if (cur && !startsNew && !indented && cur.lastWidth > maxW * 0.8 && Math.abs(cur.lastY - l.y) < l.h * 2.2) {
          cur.text += (/-$/.test(cur.text) ? '' : ' ') + l.text;
          cur.lastWidth = l.maxX - l.minX; cur.lastY = l.y;
        } else {
          if (cur) blocks.push(makeBlock(cur.text, { page: pn, size: cur.size }));
          cur = { text: l.text, lastWidth: l.maxX - l.minX, lastY: l.y, size: Math.round(l.h * 10) / 10 };
        }
      }
      if (cur) blocks.push(makeBlock(cur.text, { page: pn, size: cur.size }));
      if (onProgress) onProgress(pn, pdf.numPages);
      page.cleanup();
    }

    const median = (a) => { if (!a.length) return null; const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
    const ptcm = (v) => (v == null ? null : Math.round((v / 72) * 2.54 * 100) / 100);
    return {
      kind: 'pdf', blocks, numPages: pdf.numPages,
      scanned: textChars < pdf.numPages * 50,
      format: {
        pageSizes,
        pageCm: pageSizes.length ? [ptcm(median(pageSizes.map((p) => p[0]))), ptcm(median(pageSizes.map((p) => p[1])))] : null,
        margins: { left: ptcm(median(leftMargins)), right: ptcm(median(rightMargins)), top: ptcm(median(topMargins)), bottom: ptcm(median(bottomMargins)) },
        fontNames,
      },
    };
  }

  async function parseFile(file, onProgress) {
    const buf = await file.arrayBuffer();
    const name = file.name.toLowerCase();
    if (name.endsWith('.docx')) return parseDocx(buf);
    if (name.endsWith('.pdf')) return parsePdf(buf, onProgress);
    if (name.endsWith('.doc')) throw new Error('Format .doc (Word 97-2003) tidak didukung. Simpan ulang sebagai .docx atau .pdf.');
    throw new Error('Format berkas tidak didukung. Gunakan .docx atau .pdf.');
  }

  // Pengurutan pintar untuk multi-berkas (misal Bab 1, Bab 2, Bab 3, dst.)
  function extractFileOrder(name) {
    const n = (name || '').toLowerCase();
    const romanMap = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
    // Pola bab / chapter
    const mBab = /(?:bab|ch(?:apter)?)\s*[-_]?\s*([ivx]+|\d+)/i.exec(n);
    if (mBab) {
      const val = mBab[1].toLowerCase();
      if (romanMap[val]) return romanMap[val] * 10;
      const num = parseInt(val, 10);
      if (!isNaN(num)) return num * 10;
    }
    // Pola angka di awal nama (misal 1_Bab1.docx, 01_Pendahuluan.docx)
    const mNum = /^(\d+)[-_. ]/i.exec(n);
    if (mNum) return parseInt(mNum[1], 10) * 10;
    // Berkas depan / cover / sampul
    if (/cover|sampul|judul|abstrak|abstract|daftar/i.test(n)) return 1;
    // Berkas pustaka / rujukan
    if (/pustaka|referensi|reference|dafpus/i.test(n)) return 900;
    // Berkas lampiran
    if (/lampiran|appendix/i.test(n)) return 950;
    return 500;
  }

  async function parseFiles(files, onProgress) {
    if (!files || !files.length) throw new Error('Tidak ada berkas yang dipilih.');
    if (files.length === 1) return parseFile(files[0], onProgress);

    // Urutkan berkas berdasarkan nama bab / urutan logis
    const sortedFiles = [...files].sort((a, b) => {
      const orderA = extractFileOrder(a.name);
      const orderB = extractFileOrder(b.name);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    const allBlocks = [];
    let combinedKind = 'docx';
    let combinedFormat = null;
    let totalNumPages = 0;
    let hasScanned = false;

    for (let fIdx = 0; fIdx < sortedFiles.length; fIdx++) {
      const f = sortedFiles[fIdx];
      if (onProgress) onProgress(fIdx + 1, sortedFiles.length, f.name);
      const parsed = await parseFile(f);
      if (parsed.kind === 'pdf') combinedKind = 'pdf';
      if (!combinedFormat && parsed.format) combinedFormat = parsed.format;
      if (parsed.numPages) totalNumPages += parsed.numPages;
      if (parsed.scanned) hasScanned = true;

      // Berikan penanda sumber berkas pada setiap blok
      if (parsed.blocks && parsed.blocks.length) {
        parsed.blocks.forEach((b) => {
          b.sourceFileName = f.name;
        });
        allBlocks.push(...parsed.blocks);
      }
    }

    return {
      kind: combinedKind,
      blocks: allBlocks,
      numPages: totalNumPages || undefined,
      scanned: hasScanned,
      format: combinedFormat || {},
      multiFiles: sortedFiles.map((f) => f.name),
    };
  }

  global.Parser = { parseFile, parseFiles, normalize, countWords };
})(window);
