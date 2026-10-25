/* Telaah SLR — diagram alir PRISMA 2020 & checklist */
'use strict';

const PRISMA_KEYS = [
  ['db', 'Rekaman dari basis data'], ['reg', 'Rekaman dari register'], ['dup', 'Duplikat dihapus'],
  ['auto', 'Ditandai tidak layak oleh alat otomasi'], ['removedOther', 'Dihapus karena alasan lain'],
  ['screened', 'Rekaman diskrining'], ['taExcl', 'Rekaman dieksklusi (judul/abstrak)'],
  ['sought', 'Laporan dicari'], ['notRetr', 'Laporan tidak diperoleh'], ['assessed', 'Laporan dinilai kelayakannya'],
  ['ftExcl', 'Laporan dieksklusi (teks lengkap)'], ['included', 'Studi diinklusi'], ['reports', 'Laporan dari studi yang diinklusi'],
  ['maIncluded', 'Studi dalam meta-analisis'],
  ['o_ident', 'Metode lain: rekaman teridentifikasi'], ['o_sought', 'Metode lain: laporan dicari'],
  ['o_notRetr', 'Metode lain: tidak diperoleh'], ['o_assessed', 'Metode lain: dinilai'], ['o_ftExcl', 'Metode lain: dieksklusi']
];

function prismaComputed() {
  const R = S.records;
  const main = R.filter(r => r.sourceCat !== 'other');
  const oth = R.filter(r => r.sourceCat === 'other');
  const c = {};
  const bySource = {};
  const skip = (S.skipped || []).filter(x => x.cat !== 'other');
  [...main.map(r => [r.source, r.sourceCat]), ...skip.map(x => [x.source, x.cat])].forEach(([src, cat]) => { const k = src || 'Tidak diketahui'; bySource[k] = bySource[k] || { n: 0, cat }; bySource[k].n++; });
  c.sources = bySource;
  c.db = main.filter(r => r.sourceCat !== 'register').length + skip.filter(x => x.cat !== 'register').length;
  c.reg = main.filter(r => r.sourceCat === 'register').length + skip.filter(x => x.cat === 'register').length;
  c.dup = main.filter(r => r.duplicateOf).length + skip.length;
  c.auto = main.filter(r => !r.duplicateOf && r.autoExcluded).length;
  c.removedOther = 0;
  const scr = main.filter(inScreening);
  c.screened = scr.length;
  const taR = scr.filter(r => effective(r, 'ta') === 'exclude');
  c.taExcl = taR.length;
  c.taReasons = {};
  taR.forEach(r => { const k = finalReason(r, 'ta'); c.taReasons[k] = (c.taReasons[k] || 0) + 1; });
  const sought = scr.filter(r => effective(r, 'ta') === 'include');
  c.sought = sought.length;
  c.notRetr = sought.filter(r => r.notRetrieved).length;
  const assessed = sought.filter(r => !r.notRetrieved);
  c.assessed = assessed.length;
  const exR = assessed.filter(r => effective(r, 'ft') === 'exclude');
  c.ftExcl = exR.length;
  c.ftReasons = {};
  exR.forEach(r => { const k = finalReason(r, 'ft'); c.ftReasons[k] = (c.ftReasons[k] || 0) + 1; });
  // metode lain
  const oScr = oth.filter(inScreening);
  c.oSources = {};
  oth.forEach(r => { const k = r.source || 'Lainnya'; c.oSources[k] = (c.oSources[k] || 0) + 1; });
  c.o_ident = oth.length;
  c.o_sought = oScr.length;
  c.o_notRetr = oScr.filter(r => r.notRetrieved).length;
  const oAss = oScr.filter(r => !r.notRetrieved);
  c.o_assessed = oAss.length;
  const oEx = oAss.filter(r => effective(r, 'ft') === 'exclude');
  c.o_ftExcl = oEx.length;
  c.oReasons = {};
  oEx.forEach(r => { const k = finalReason(r, 'ft'); c.oReasons[k] = (c.oReasons[k] || 0) + 1; });
  const inc = R.filter(inExtraction);
  c.included = inc.length;
  c.reports = inc.length;
  c.maIncluded = typeof MA !== 'undefined' ? MA.studies().filter(s => s.ok).length : 0;
  // yang belum selesai
  c.pendingTA = scr.filter(r => !effective(r, 'ta')).length;
  c.pendingFT = assessed.filter(r => !effective(r, 'ft')).length + oAss.filter(r => !effective(r, 'ft')).length;
  return c;
}

/* Pemeriksaan: setiap rekaman dihitung tepat satu kali di setiap tingkat diagram */
function prismaIntegrity() {
  const c = prismaComputed();
  const main = S.records.filter(r => r.sourceCat !== 'other');
  const ta = { inc: 0, exc: 0, pend: 0 };
  main.filter(inScreening).forEach(r => { const e = effective(r, 'ta'); ta[e === 'include' ? 'inc' : e === 'exclude' ? 'exc' : 'pend']++; });
  const ids = S.records.map(r => r.id);
  const doubleIds = ids.length - new Set(ids).size;
  const checks = [
    ['Teridentifikasi = duplikat + otomasi + disaring', c.db + c.reg, c.dup + c.auto + c.screened],
    ['Disaring = eksklusi judul/abstrak + dicari teks lengkap + belum diputuskan', c.screened, c.taExcl + c.sought + c.pendingTA],
    ['Satu keputusan judul/abstrak per rekaman', c.screened, ta.inc + ta.exc + ta.pend],
    ['Dicari = tidak diperoleh + dinilai', c.sought, c.notRetr + c.assessed],
    ['Dinilai (semua jalur) = eksklusi teks lengkap + inklusi + belum diputuskan', c.assessed + c.o_assessed, c.ftExcl + c.o_ftExcl + c.included + c.pendingFT],
    ['Jumlah alasan eksklusi = jumlah eksklusi teks lengkap', c.ftExcl, Object.values(c.ftReasons).reduce((a, b) => a + b, 0)],
    ['Tidak ada ID rekaman ganda', 0, doubleIds]
  ];
  return checks.map(([label, a, b]) => ({ label, a, b, ok: a === b }));
}

function prismaCounts() {
  const c = prismaComputed();
  const ov = S.prisma.ov || {};
  const v = {};
  PRISMA_KEYS.forEach(([k]) => { v[k] = ov[k] !== undefined && ov[k] !== '' ? Number(ov[k]) : c[k]; });
  if ((ov.screened === undefined || ov.screened === '') && v.removedOther) v.screened = Math.max(0, c.screened - v.removedOther);
  return { v, c };
}

const PL = {
  en: {
    hMain: 'Identification of studies via databases and registers',
    hOther: 'Identification of studies via other methods',
    ident: 'Identification', screen: 'Screening', incl: 'Included',
    recId: 'Records identified from:', dbs: 'Databases', regs: 'Registers',
    removed: 'Records removed before screening:', dup: 'Duplicate records removed', auto: 'Records marked as ineligible by automation tools', other: 'Records removed for other reasons',
    screened: 'Records screened', excluded: 'Records excluded', sought: 'Reports sought for retrieval', notRetr: 'Reports not retrieved',
    assessed: 'Reports assessed for eligibility', repExcl: 'Reports excluded:', included: 'Studies included in review', reports: 'Reports of included studies',
    includedScR: 'Sources of evidence included in review', ma: 'Studies included in meta-analysis',
    oIdent: 'Records identified from:', websites: 'Websites', orgs: 'Organisations', citation: 'Citation searching'
  },
  id: {
    hMain: 'Identifikasi studi melalui basis data dan register',
    hOther: 'Identifikasi studi melalui metode lain',
    ident: 'Identifikasi', screen: 'Skrining', incl: 'Diinklusi',
    recId: 'Rekaman teridentifikasi dari:', dbs: 'Basis data', regs: 'Register',
    removed: 'Rekaman dihapus sebelum skrining:', dup: 'Rekaman duplikat dihapus', auto: 'Rekaman ditandai tidak layak oleh alat otomasi', other: 'Rekaman dihapus karena alasan lain',
    screened: 'Rekaman diskrining', excluded: 'Rekaman dieksklusi', sought: 'Laporan dicari untuk diperoleh', notRetr: 'Laporan tidak diperoleh',
    assessed: 'Laporan dinilai kelayakannya', repExcl: 'Laporan dieksklusi:', included: 'Studi diinklusi dalam review', reports: 'Laporan dari studi yang diinklusi',
    includedScR: 'Sumber bukti diinklusi dalam review', ma: 'Studi diinklusi dalam meta-analisis',
    oIdent: 'Rekaman teridentifikasi dari:', websites: 'Situs web', orgs: 'Organisasi', citation: 'Penelusuran sitasi'
  }
};

function wrapText(s, maxChars) {
  const words = String(s).split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach(w => {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  });
  if (cur) lines.push(cur);
  return lines;
}

/* ---------- Model visual bagan (struktur & isi tetap PRISMA 2020) ---------- */
const PRISMA_FONTS = {
  arial: ['Arial', 'Arial, Helvetica, sans-serif', 6.5],
  calibri: ['Calibri', 'Calibri, Carlito, "Segoe UI", sans-serif', 6.1],
  times: ['Times New Roman', '"Times New Roman", Times, serif', 6.0],
  georgia: ['Georgia', 'Georgia, "Times New Roman", serif', 6.7],
  segoe: ['Segoe UI', '"Segoe UI", Roboto, Helvetica, sans-serif', 6.5]
};
const PRISMA_STYLES = {
  klasik: { name: 'Klasik', desc: 'Mengikuti templat resmi PRISMA 2020', font: 'arial', accent: '#2d5f7a', radius: 3, phase: 'bar', head: 'tint', box: 'plain', excl: 'plain', stroke: 1.2 },
  jurnal: { name: 'Jurnal hitam-putih', desc: 'Siap cetak, tanpa warna, huruf serif', font: 'times', accent: '#111111', radius: 0, phase: 'line', head: 'outline', box: 'plain', excl: 'plain', stroke: 1, mono: true },
  modern: { name: 'Modern', desc: 'Sudut membulat, warna per tahap', font: 'segoe', accent: '#2563eb', phases: ['#2563eb', '#0e7490', '#15803d'], radius: 10, phase: 'pill', head: 'solid', box: 'phase', excl: 'tint', stroke: 0.8 },
  kontras: { name: 'Kontras', desc: 'Judul gelap, garis aksen di kotak', font: 'calibri', accent: '#0f3b57', radius: 4, phase: 'bar', head: 'solid', box: 'stripe', excl: 'stripe', stroke: 1.2 },
  pastel: { name: 'Pastel', desc: 'Lembut, cocok untuk poster/presentasi', font: 'calibri', accent: '#0d9488', phases: ['#0d9488', '#6d5bd0', '#c2410c'], radius: 12, phase: 'bar', head: 'tint', box: 'phase', excl: 'dash', stroke: 1 },
  garis: { name: 'Garis tipis', desc: 'Minimalis, kotak eksklusi putus-putus', font: 'georgia', accent: '#7c3aed', radius: 2, phase: 'text', head: 'outline', box: 'plain', excl: 'dash', stroke: 0.9 }
};
// Campur warna hex dengan putih (t = 0..1 bagian putih)
function tint(hex, t) {
  const n = parseInt(String(hex).replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const ch = s => Math.round(((n >> s) & 255) * (1 - t) + 255 * t);
  return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
}
function shade(hex, t) {
  const n = parseInt(String(hex).replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return '#' + [16, 8, 0].map(s => Math.round(((n >> s) & 255) * (1 - t)).toString(16).padStart(2, '0')).join('');
}
function prismaStyle(key) {
  const base = PRISMA_STYLES[key || S.prisma.style] || PRISMA_STYLES.klasik;
  const own = !key || key === S.prisma.style;
  const st = Object.assign({}, base);
  if (own && S.prisma.accent) st.accent = S.prisma.accent;
  if (own && S.prisma.font && PRISMA_FONTS[S.prisma.font]) st.font = S.prisma.font;
  if (own && S.prisma.excl) st.excl = S.prisma.excl;
  if (own && S.prisma.radius !== undefined && S.prisma.radius !== '') st.radius = Number(S.prisma.radius);
  const a = st.accent;
  // warna per tahap: identifikasi, skrining, inklusi
  st.phaseCol = st.mono ? ['#111111', '#111111', '#111111'] : own && S.prisma.accent && base.phases ? [a, mixHue(a, 1), mixHue(a, 2)] : base.phases || [a, a, a];
  st.ink = st.mono ? '#000000' : '#1b2a33';
  return st;
}
// Variasi tahap tanpa hue baru yang tak terduga: geser kecerahan/saturasi warna aksen
function mixHue(hex, i) { return i === 1 ? shade(hex, 0.12) : shade(hex, 0.28); }

/* Kotak yang bisa diedit: nama dan kolomnya (m utama, r eksklusi, o/or metode lain) */
const PRISMA_BOXES = {
  ident: ['Rekaman teridentifikasi', 'm'], removed: ['Rekaman dihapus sebelum skrining', 'r'],
  screened: ['Rekaman diskrining', 'm'], taExcl: ['Rekaman dieksklusi (judul/abstrak)', 'r'],
  sought: ['Laporan dicari', 'm'], notRetr: ['Laporan tidak diperoleh', 'r'],
  assessed: ['Laporan dinilai kelayakannya', 'm'], ftExcl: ['Laporan dieksklusi (teks lengkap)', 'r'],
  included: ['Studi diinklusi', 'm'],
  oIdent: ['Metode lain: teridentifikasi', 'o'], oSought: ['Metode lain: laporan dicari', 'o'], oNotRetr: ['Metode lain: tidak diperoleh', 'or'],
  oAssessed: ['Metode lain: dinilai', 'o'], oFtExcl: ['Metode lain: dieksklusi', 'or']
};
const PRISMA_COLW = { m: 290, r: 270, o: 230, or: 216 };
function prBox(k) { return (S.prisma.boxes || {})[k] || {}; }
// Teks kotak per baris; baris berawalan spasi, -, – atau • dibuat menjorok. {kunci} diganti angka otomatis (mis. {screened})
function prItemsToText(items) { return items.map(it => (it.indent ? '   ' : '') + it.t).join('\n'); }
function prTextToItems(txt, v) {
  return String(txt).split(/\r?\n/).filter(l => l.trim()).map(l => ({
    t: l.trim().replace(/\{(\w+)\}/g, (m, k) => v[k] !== undefined ? v[k] : m),
    indent: /^(\s|[-–•])/.test(l) ? 1 : 0
  }));
}

// Isi bawaan setiap kotak (belum dibungkus per baris)
function prismaItems() {
  const { v, c } = prismaCounts();
  const L = PL[S.prisma.lang] || PL.en;
  const type = S.project.type;
  const showOther = S.prisma.showOther === 'yes' || (S.prisma.showOther === 'auto' && (v.o_ident > 0 || S.prisma.otherWebsites || S.prisma.otherOrgs || S.prisma.otherCitation));
  const n = x => '(n = ' + (x ?? 0) + ')';
  const lines = items => items;
  const dbLines = Object.entries(c.sources).filter(([, o]) => o.cat !== 'register');
  const regLines = Object.entries(c.sources).filter(([, o]) => o.cat === 'register');
  const B = {};
  B.ident = lines([{ t: L.recId }, { t: L.dbs + ' ' + n(v.db), indent: 1 },
    ...(dbLines.length > 1 || (dbLines.length && S.prisma.listSources !== false) ? dbLines.map(([k, o]) => ({ t: '– ' + k + ' ' + n(o.n), indent: 1 })) : []),
    { t: L.regs + ' ' + n(v.reg), indent: 1 },
    ...(regLines.length > 1 || (regLines.length && S.prisma.listSources !== false) ? regLines.map(([k, o]) => ({ t: '– ' + k + ' ' + n(o.n), indent: 1 })) : [])]);
  B.removed = lines([{ t: L.removed }, { t: L.dup + ' ' + n(v.dup), indent: 1 }, { t: L.auto + ' ' + n(v.auto), indent: 1 }, { t: L.other + ' ' + n(v.removedOther), indent: 1 }]);
  B.screened = lines([{ t: L.screened + ' ' + n(v.screened) }]);
  const taRs = Object.entries(c.taReasons || {}).sort((a, b) => b[1] - a[1]);
  const showTaR = S.prisma.taReasons !== false && taRs.some(([k]) => k !== 'Alasan tidak dicatat');
  B.taExcl = lines([{ t: L.excluded + ' ' + n(v.taExcl) }, ...(showTaR ? taRs.map(([k, x]) => ({ t: (k === 'Alasan tidak dicatat' ? 'Tanpa alasan' : k) + ' ' + n(x), indent: 1 })) : [])]);
  B.sought = lines([{ t: L.sought + ' ' + n(v.sought) }]);
  B.notRetr = lines([{ t: L.notRetr + ' ' + n(v.notRetr) }]);
  B.assessed = lines([{ t: L.assessed + ' ' + n(v.assessed) }]);
  const reasons = Object.entries(c.ftReasons);
  B.ftExcl = lines([{ t: L.repExcl + ' ' + n(v.ftExcl) }, ...reasons.map(([k, x]) => ({ t: k + ' ' + n(x), indent: 1 }))]);
  const incItems = [{ t: (type === 'scoping' ? L.includedScR : L.included) + ' ' + n(v.included) }, { t: L.reports + ' ' + n(v.reports) }];
  if (type === 'meta') incItems.push({ t: L.ma + ' ' + n(v.maIncluded) });
  B.included = lines(incItems);
  if (showOther) {
    const oItems = [{ t: L.oIdent }];
    const oS = Object.entries(c.oSources);
    if (oS.length) oS.forEach(([k, x]) => oItems.push({ t: k + ' ' + n(x), indent: 1 }));
    if (S.prisma.otherWebsites !== '') oItems.push({ t: L.websites + ' ' + n(S.prisma.otherWebsites), indent: 1 });
    if (S.prisma.otherOrgs !== '') oItems.push({ t: L.orgs + ' ' + n(S.prisma.otherOrgs), indent: 1 });
    if (S.prisma.otherCitation !== '') oItems.push({ t: L.citation + ' ' + n(S.prisma.otherCitation), indent: 1 });
    if (oItems.length === 1) oItems.push({ t: n(v.o_ident), indent: 1 });
    B.oIdent = lines(oItems);
    B.oSought = lines([{ t: L.sought + ' ' + n(v.o_sought) }]);
    B.oNotRetr = lines([{ t: L.notRetr + ' ' + n(v.o_notRetr) }]);
    B.oAssessed = lines([{ t: L.assessed + ' ' + n(v.o_assessed) }]);
    B.oFtExcl = lines([{ t: L.repExcl + ' ' + n(v.o_ftExcl) }, ...Object.entries(c.oReasons).map(([k, x]) => ({ t: k + ' ' + n(x), indent: 1 }))]);
  }
  return { B, v, c, L, showOther };
}

function prismaSVG(opt = {}) {
  const ST = prismaStyle(opt.style);
  const { B: I, v, L, showOther } = prismaItems();
  const FONT = PRISMA_FONTS[ST.font] || PRISMA_FONTS.arial;
  const LH = 16, PAD = ST.box === 'stripe' ? 14 : 11, CW = FONT[2];
  const fit = S.prisma.fitH !== false;
  const bw = k => Math.max(120, Number(prBox(k).w) || PRISMA_COLW[PRISMA_BOXES[k][1]]);
  // lebar kolom = kotak terlebar di kolom itu; posisi kolom berikutnya menyesuaikan
  const colW = cl => Math.max(0, ...Object.keys(I).filter(k => PRISMA_BOXES[k][1] === cl).map(bw));
  const col = { mx: 64, mw: colW('m') };
  col.rx = col.mx + col.mw + 30; col.rw = colW('r');
  col.ox = col.rx + col.rw + 50; col.ow = colW('o');
  col.orx = col.ox + col.ow + 30; col.orw = colW('or');
  const W = showOther ? col.orx + col.orw + 16 : col.rx + col.rw + 16;
  const lines = (items, w) => {
    const out = [];
    items.forEach(it => {
      const indent = it.indent ? 12 : 0;
      wrapText(it.t, Math.floor((w - 2 * PAD - indent) / CW)).forEach((ln, i) => out.push({ t: ln, b: it.b && i === 0, indent }));
    });
    return out;
  };
  const B = {};
  Object.keys(I).forEach(k => { const own = prBox(k).text; B[k] = lines(own !== undefined && own !== '' ? prTextToItems(own, v) : I[k], bw(k)); });
  const h = ls => ls.length * LH + PAD * 2;
  const boxH = k => Math.max(h(B[k]), Number(prBox(k).h) || 0);
  const rowsDef = [
    ['ident', 'removed', 'oIdent'],
    ['screened', 'taExcl'],
    ['sought', 'notRetr', 'oSought', 'oNotRetr'],
    ['assessed', 'ftExcl', 'oAssessed', 'oFtExcl'],
    ['included']
  ];
  const GAP = 34, TOP = 50;
  let y = TOP;
  const pos = {};
  const rowY = [];
  rowsDef.forEach(row => {
    const rh = Math.max(...row.filter(k => B[k]).map(boxH));
    rowY.push([y, rh]);
    // tinggi kotak menyesuaikan teksnya (dipusatkan di baris) atau sama tinggi satu baris
    row.forEach(k => { if (B[k]) { const bh = fit || prBox(k).h ? boxH(k) : rh; pos[k] = { y: y + (rh - bh) / 2, rh: bh, h: h(B[k]) }; } });
    y += rh + GAP;
  });
  const H = y - GAP + 16;
  // kolom utama dan "metode lain" dipusatkan (panah vertikal tetap di tengah); kolom eksklusi rata kiri
  const X = {};
  Object.keys(B).forEach(k => {
    const cl = PRISMA_BOXES[k][1], w = bw(k);
    X[k] = cl === 'm' ? [col.mx + (col.mw - w) / 2, w] : cl === 'o' ? [col.ox + (col.ow - w) / 2, w] : [cl === 'r' ? col.rx : col.orx, w];
  });
  const ink = ST.ink, sw = ST.stroke, R = ST.radius;
  const PHASE_OF = { ident: 0, removed: 0, oIdent: 0, included: 2 };
  const EXCL = { removed: 1, taExcl: 1, notRetr: 1, ftExcl: 1, oNotRetr: 1, oFtExcl: 1 };
  const pc = k => ST.phaseCol[PHASE_OF[k] ?? 1];
  const aid = 'ah' + (opt.style || 'x');
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family='${FONT[1]}' font-size="12.5" role="img" aria-label="PRISMA 2020 flow diagram">`;
  svg += `<defs><marker id="${aid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${ink}"/></marker></defs>`;
  svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`;
  // judul kolom
  const header = (x0, x1, label) => {
    const fill = ST.head === 'solid' ? ST.accent : ST.head === 'tint' ? tint(ST.accent, 0.86) : '#ffffff';
    const txt = ST.head === 'solid' ? '#ffffff' : ink;
    svg += `<rect x="${x0}" y="10" width="${x1 - x0}" height="28" rx="${Math.min(R + 1, 14)}" fill="${fill}" stroke="${ST.head === 'solid' ? fill : ink}" stroke-width="${sw}"/>`;
    svg += `<text x="${(x0 + x1) / 2}" y="28.5" text-anchor="middle" font-weight="bold" fill="${txt}">${esc(label)}</text>`;
  };
  header(col.mx, col.rx + col.rw, L.hMain);
  if (showOther) header(col.ox, col.orx + col.orw, L.hOther);
  // penanda fase
  const phaseBar = (y0, y1, label, i) => {
    const cy = (y0 + y1) / 2;
    const fsz = Math.max(8, Math.min(12.5, (y1 - y0 - 10) / (String(label).length * 0.62)));
    const col0 = ST.phaseCol[i];
    if (ST.phase === 'bar' || ST.phase === 'pill') {
      svg += `<rect x="12" y="${y0}" width="30" height="${y1 - y0}" rx="${ST.phase === 'pill' ? 15 : Math.min(R + 1, 6)}" fill="${col0}"/>`;
      svg += `<text x="27" y="${cy}" fill="#ffffff" font-weight="bold" font-size="${fsz}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 27 ${cy})">${esc(label)}</text>`;
    } else if (ST.phase === 'line') {
      svg += `<line x1="40" y1="${y0}" x2="40" y2="${y1}" stroke="${ink}" stroke-width="1.4"/><line x1="36" y1="${y0}" x2="40" y2="${y0}" stroke="${ink}"/><line x1="36" y1="${y1}" x2="40" y2="${y1}" stroke="${ink}"/>`;
      svg += `<text x="25" y="${cy}" fill="${ink}" font-weight="bold" font-size="${fsz}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 25 ${cy})">${esc(label)}</text>`;
    } else {
      svg += `<text x="27" y="${cy}" fill="${col0}" font-weight="bold" font-size="${fsz}" font-style="italic" letter-spacing=".5" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 27 ${cy})">${esc(label)}</text>`;
    }
  };
  phaseBar(rowY[0][0], rowY[0][0] + rowY[0][1], L.ident, 0);
  phaseBar(rowY[1][0], rowY[3][0] + rowY[3][1], L.screen, 1);
  phaseBar(rowY[4][0], rowY[4][0] + rowY[4][1], L.incl, 2);
  // kotak
  const drawBox = k => {
    if (!B[k]) return;
    const [x, w] = X[k];
    const p = pos[k];
    const bh = p.rh;
    const ex = !!EXCL[k];
    const mode = ex ? ST.excl : ST.box;
    let fill = '#ffffff', stroke = ink, dash = '';
    if (mode === 'phase') { fill = tint(pc(k), 0.9); stroke = pc(k); }
    if (mode === 'tint') { fill = ST.mono ? '#f2f2f2' : '#fdf1f0'; stroke = ST.mono ? ink : '#c2453a'; }
    if (mode === 'dash') { dash = ' stroke-dasharray="5 3"'; stroke = ST.mono ? ink : shade(pc(k), 0.1); }
    if (mode === 'stripe') { stroke = tint(ink, 0.55); }
    svg += `<g data-box="${k}"><rect x="${x}" y="${p.y}" width="${w}" height="${bh}" rx="${R}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>`;
    if (mode === 'stripe') svg += `<rect x="${x}" y="${p.y}" width="5" height="${bh}" rx="${Math.min(R, 2)}" fill="${ex ? (ST.mono ? '#555' : '#c2453a') : pc(k)}"/>`;
    const ty = p.y + (bh - B[k].length * LH) / 2 + LH - 4;
    B[k].forEach((ln, i) => {
      svg += `<text x="${x + PAD + ln.indent}" y="${ty + i * LH}" fill="${ink}"${ln.b ? ' font-weight="bold"' : ''}>${esc(ln.t)}</text>`;
    });
    svg += '</g>';
  };
  Object.keys(B).forEach(drawBox);
  // panah
  const arrow = (x1, y1, x2, y2) => { svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="${sw}" marker-end="url(#${aid})"/>`; };
  const midY = k => pos[k].y + pos[k].rh / 2;
  const bottom = k => pos[k].y + pos[k].rh;
  const cx = col.mx + col.mw / 2;
  arrow(cx, bottom('ident'), cx, pos.screened.y);
  arrow(cx, bottom('screened'), cx, pos.sought.y);
  arrow(cx, bottom('sought'), cx, pos.assessed.y);
  arrow(cx, bottom('assessed'), cx, pos.included.y);
  const right = k => X[k][0] + X[k][1];
  [['ident', 'removed'], ['screened', 'taExcl'], ['sought', 'notRetr'], ['assessed', 'ftExcl']].forEach(([a, b]) => arrow(right(a), midY(a), col.rx, midY(b)));
  if (showOther) {
    const ocx = col.ox + col.ow / 2;
    arrow(ocx, bottom('oIdent'), ocx, pos.oSought.y);
    arrow(ocx, bottom('oSought'), ocx, pos.oAssessed.y);
    arrow(right('oSought'), midY('oSought'), col.orx, midY('oNotRetr'));
    arrow(right('oAssessed'), midY('oAssessed'), col.orx, midY('oFtExcl'));
    const yI = midY('included');
    svg += `<polyline points="${ocx},${bottom('oAssessed')} ${ocx},${yI}" fill="none" stroke="${ink}" stroke-width="${sw}"/>`;
    arrow(ocx, yI, right('included'), yI);
  }
  svg += '</svg>';
  return svg;
}

/* ---------- Checklist ---------- */
const CHECKLIST_PRISMA2020 = [
  ['JUDUL', '1', 'Judul', 'Identifikasi laporan sebagai systematic review.'],
  ['ABSTRAK', '2', 'Abstrak', 'Lihat checklist PRISMA 2020 for Abstracts.'],
  ['PENDAHULUAN', '3', 'Rasional', 'Jelaskan rasional review dalam konteks pengetahuan yang ada.'],
  ['PENDAHULUAN', '4', 'Tujuan', 'Nyatakan secara eksplisit tujuan atau pertanyaan yang dijawab review.'],
  ['METODE', '5', 'Kriteria kelayakan', 'Tetapkan kriteria inklusi dan eksklusi serta bagaimana studi dikelompokkan untuk sintesis.'],
  ['METODE', '6', 'Sumber informasi', 'Sebutkan semua basis data, register, situs web, organisasi, daftar referensi, dan sumber lain beserta tanggal terakhir dicari.'],
  ['METODE', '7', 'Strategi pencarian', 'Sajikan strategi pencarian lengkap untuk semua basis data, register, dan situs web, termasuk filter dan batasan.'],
  ['METODE', '8', 'Proses seleksi', 'Jelaskan metode penentuan kelayakan: berapa reviewer per rekaman/laporan, apakah independen, dan alat otomasi yang dipakai.'],
  ['METODE', '9', 'Proses pengumpulan data', 'Jelaskan metode pengumpulan data: jumlah reviewer, independensi, konfirmasi data ke peneliti, dan alat otomasi.'],
  ['METODE', '10a', 'Item data', 'Daftarkan dan definisikan semua outcome yang dicari serta cara memilih hasil yang kompatibel.'],
  ['METODE', '10b', 'Item data', 'Daftarkan dan definisikan variabel lain (karakteristik partisipan & intervensi, sumber dana) dan asumsi untuk informasi yang hilang.'],
  ['METODE', '11', 'Penilaian risiko bias studi', 'Jelaskan alat penilaian risiko bias, jumlah reviewer, independensi, dan alat otomasi.'],
  ['METODE', '12', 'Ukuran efek', 'Untuk setiap outcome, sebutkan ukuran efek (mis. risk ratio, mean difference).'],
  ['METODE', '13a', 'Metode sintesis', 'Jelaskan proses penentuan studi yang layak untuk setiap sintesis.'],
  ['METODE', '13b', 'Metode sintesis', 'Jelaskan persiapan data untuk penyajian/sintesis (statistik hilang, konversi data).'],
  ['METODE', '13c', 'Metode sintesis', 'Jelaskan metode tabulasi atau tampilan visual hasil studi dan sintesis.'],
  ['METODE', '13d', 'Metode sintesis', 'Jelaskan metode sintesis dan alasannya; untuk meta-analisis: model, metode heterogenitas, dan perangkat lunak.'],
  ['METODE', '13e', 'Metode sintesis', 'Jelaskan metode eksplorasi penyebab heterogenitas (analisis subgrup, meta-regresi).'],
  ['METODE', '13f', 'Metode sintesis', 'Jelaskan analisis sensitivitas untuk menilai ketangguhan hasil.'],
  ['METODE', '14', 'Penilaian bias pelaporan', 'Jelaskan metode menilai risiko bias akibat hasil yang hilang (bias pelaporan).'],
  ['METODE', '15', 'Penilaian kepastian', 'Jelaskan metode menilai kepastian bukti (mis. GRADE).'],
  ['HASIL', '16a', 'Seleksi studi', 'Jelaskan hasil pencarian dan seleksi, idealnya dengan diagram alir.'],
  ['HASIL', '16b', 'Seleksi studi', 'Sebutkan studi yang tampak memenuhi kriteria tetapi dieksklusi, beserta alasannya.'],
  ['HASIL', '17', 'Karakteristik studi', 'Kutip setiap studi yang diinklusi dan sajikan karakteristiknya.'],
  ['HASIL', '18', 'Risiko bias studi', 'Sajikan penilaian risiko bias untuk setiap studi yang diinklusi.'],
  ['HASIL', '19', 'Hasil studi individual', 'Untuk semua outcome, sajikan statistik ringkasan per kelompok dan estimasi efek beserta presisinya.'],
  ['HASIL', '20a', 'Hasil sintesis', 'Ringkas karakteristik dan risiko bias studi yang berkontribusi pada setiap sintesis.'],
  ['HASIL', '20b', 'Hasil sintesis', 'Sajikan hasil semua sintesis statistik; untuk meta-analisis: estimasi gabungan, presisi, dan heterogenitas.'],
  ['HASIL', '20c', 'Hasil sintesis', 'Sajikan hasil investigasi penyebab heterogenitas.'],
  ['HASIL', '20d', 'Hasil sintesis', 'Sajikan hasil analisis sensitivitas.'],
  ['HASIL', '21', 'Bias pelaporan', 'Sajikan penilaian risiko bias akibat hasil yang hilang.'],
  ['HASIL', '22', 'Kepastian bukti', 'Sajikan penilaian kepastian bukti untuk setiap outcome.'],
  ['DISKUSI', '23a', 'Diskusi', 'Berikan interpretasi umum hasil dalam konteks bukti lain.'],
  ['DISKUSI', '23b', 'Diskusi', 'Bahas keterbatasan bukti yang diinklusi.'],
  ['DISKUSI', '23c', 'Diskusi', 'Bahas keterbatasan proses review.'],
  ['DISKUSI', '23d', 'Diskusi', 'Bahas implikasi bagi praktik, kebijakan, dan penelitian ke depan.'],
  ['INFORMASI LAIN', '24a', 'Registrasi & protokol', 'Berikan informasi registrasi (nama & nomor register) atau nyatakan tidak diregistrasi.'],
  ['INFORMASI LAIN', '24b', 'Registrasi & protokol', 'Sebutkan di mana protokol dapat diakses atau nyatakan tidak disusun.'],
  ['INFORMASI LAIN', '24c', 'Registrasi & protokol', 'Jelaskan perubahan dari registrasi atau protokol.'],
  ['INFORMASI LAIN', '25', 'Dukungan', 'Sebutkan sumber dukungan finansial/non-finansial dan peran penyandang dana.'],
  ['INFORMASI LAIN', '26', 'Konflik kepentingan', 'Nyatakan konflik kepentingan penulis review.'],
  ['INFORMASI LAIN', '27', 'Ketersediaan data, kode & materi', 'Sebutkan materi apa yang tersedia untuk publik dan di mana: formulir ekstraksi, data, kode analisis.']
];

const CHECKLIST_SCR = [
  ['JUDUL', '1', 'Judul', 'Identifikasi laporan sebagai scoping review.'],
  ['ABSTRAK', '2', 'Ringkasan terstruktur', 'Latar belakang, tujuan, kriteria kelayakan, sumber bukti, metode charting, hasil, dan kesimpulan.'],
  ['PENDAHULUAN', '3', 'Rasional', 'Jelaskan rasional review dan mengapa pendekatan scoping review dipilih.'],
  ['PENDAHULUAN', '4', 'Tujuan', 'Nyatakan pertanyaan/tujuan dengan elemen kunci (partisipan, konsep, konteks).'],
  ['METODE', '5', 'Protokol & registrasi', 'Sebutkan apakah ada protokol, di mana dapat diakses, dan nomor registrasi bila ada.'],
  ['METODE', '6', 'Kriteria kelayakan', 'Tetapkan karakteristik sumber bukti yang dipakai sebagai kriteria kelayakan beserta rasionalnya.'],
  ['METODE', '7', 'Sumber informasi', 'Sebutkan semua sumber informasi dan tanggal pencarian terakhir.'],
  ['METODE', '8', 'Pencarian', 'Sajikan strategi pencarian elektronik lengkap untuk minimal satu basis data.'],
  ['METODE', '9', 'Seleksi sumber bukti', 'Jelaskan proses seleksi sumber bukti (skrining dan kelayakan).'],
  ['METODE', '10', 'Proses charting data', 'Jelaskan metode charting data, termasuk formulir dan proses konfirmasi data.'],
  ['METODE', '11', 'Item data', 'Daftarkan dan definisikan semua variabel yang dicari beserta asumsinya.'],
  ['METODE', '12', 'Penilaian kritis (opsional)', 'Bila dilakukan, jelaskan metode penilaian kritis sumber bukti dan penggunaannya.'],
  ['METODE', '13', 'Sintesis hasil', 'Jelaskan metode penanganan dan peringkasan data yang di-chart.'],
  ['HASIL', '14', 'Seleksi sumber bukti', 'Sajikan jumlah sumber yang diskrining, dinilai, dan diinklusi beserta alasan eksklusi, idealnya dengan diagram alir.'],
  ['HASIL', '15', 'Karakteristik sumber bukti', 'Sajikan karakteristik setiap sumber bukti yang datanya di-chart, beserta sitasinya.'],
  ['HASIL', '16', 'Penilaian kritis (opsional)', 'Bila dilakukan, sajikan hasil penilaian kritis.'],
  ['HASIL', '17', 'Hasil sumber individual', 'Sajikan data yang di-chart dari setiap sumber terkait pertanyaan review.'],
  ['HASIL', '18', 'Sintesis hasil', 'Ringkas dan/atau sajikan hasil charting terkait pertanyaan dan tujuan review.'],
  ['DISKUSI', '19', 'Ringkasan bukti', 'Ringkas temuan utama dan kaitkan dengan konsep, tema, serta jenis bukti.'],
  ['DISKUSI', '20', 'Keterbatasan', 'Bahas keterbatasan proses scoping review.'],
  ['DISKUSI', '21', 'Kesimpulan', 'Berikan interpretasi umum terkait pertanyaan review serta implikasi dan langkah berikutnya.'],
  ['PENDANAAN', '22', 'Pendanaan', 'Jelaskan sumber dana sumber bukti yang diinklusi dan pendanaan scoping review ini.']
];

function activeChecklist() {
  return S.project.type === 'scoping' ? { name: 'PRISMA-ScR (Tricco et al., 2018)', items: CHECKLIST_SCR } : { name: 'PRISMA 2020 (Page et al., 2021)', items: CHECKLIST_PRISMA2020 };
}
