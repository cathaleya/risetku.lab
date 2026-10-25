/* Telaah SLR — analisis bibliometrik (produksi tahunan, sumber, penulis, kata kunci, negara, kolaborasi)
   dan jembatan ke Biblioshiny (bibliometrix, R): ekspor CSV berformat Scopus + skrip R peluncur */
'use strict';

const BB_SETS = [
  ['inc', 'Include teks lengkap', r => inExtraction(r)],
  ['ta', 'Lolos judul-abstrak', r => inFT(r)],
  ['all', 'Semua rekaman', r => inScreening(r)]
];
const BB_MODES = [['sum', 'Ringkasan'], ['src', 'Sumber & penulis'], ['kw', 'Jaringan kata kunci'], ['geo', 'Negara & kolaborasi'], ['shiny', 'Biblioshiny']];
const BB_PAL = 8;

function bbSetKey() { return BB_SETS.some(s => s[0] === UI.bbSet) ? UI.bbSet : 'inc'; }
function bbList(k = bbSetKey()) { const s = BB_SETS.find(x => x[0] === k); return S.records.filter(s[2]); }
function bbProj() { if (!S.project.biblio) S.project.biblio = { syn: '', stop: '' }; return S.project.biblio; }
function bbFold(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

/* ---------- Pengurai ---------- */
function bbYear(r) { const m = String(r.year || '').match(/(19|20)\d{2}/); return m ? +m[0] : null; }

// "Alowais M.", "Alowais, Mohammed", "Mohammed Alowais" -> { last, ini, disp, key }
function bbAuthor(raw) {
  const s = raw.replace(/\s+/g, ' ').replace(/^[,.\s]+|[,\s]+$/g, '').trim();
  if (!s) return null;
  let last, given;
  if (s.includes(',')) { [last, given] = [s.split(',')[0], s.split(',').slice(1).join(' ')]; }
  else {
    const m = s.match(/^(.+?)\s+((?:[A-ZÀ-ɏ][a-z]?\.?[\s-]*)+)$/);
    if (m && m[2].replace(/[^A-Za-zÀ-ɏ]/g, '').length <= 4) { last = m[1]; given = m[2]; }
    else { const w = s.split(' '); last = w.pop(); given = w.join(' '); }
  }
  last = last.trim(); given = (given || '').trim();
  const ini = given.split(/[\s.-]+/).filter(Boolean).map(w => w[0].toUpperCase() + '.').join('');
  return { last, ini, disp: (last + ' ' + ini).trim(), key: bbFold(last + ' ' + (ini[0] || '')).replace(/[^a-z ]/g, '').trim() };
}
function bbAuthors(r) {
  const s = String(r.authors || '').trim();
  if (!s) return [];
  const parts = s.includes(';') ? s.split(';') : /\s+and\s+/i.test(s) ? s.split(/\s+and\s+/i) : [s];
  const seen = new Set();
  return parts.map(p => p.trim()).filter(p => p && !/^(et al\.?|anonymous|\[no author name available\])$/i.test(p)).map(bbAuthor)
    .filter(a => a && a.key && !seen.has(a.key) && seen.add(a.key));
}

// Sinonim: satu baris per kelompok, dipisah ";" — semua digabung ke istilah pertama
function bbSynMap() {
  const m = new Map();
  bbProj().syn.split('\n').forEach(line => {
    const t = line.split(/[;,]/).map(x => bbFold(x).replace(/\s+/g, ' ').trim()).filter(Boolean);
    t.slice(1).forEach(x => m.set(x, t[0]));
  });
  return m;
}
function bbStopSet() { return new Set(bbProj().stop.split(/[\n;,]/).map(x => bbFold(x).replace(/\s+/g, ' ').trim()).filter(Boolean)); }
function bbKwRaw(r) {
  const s = String(r.keywords || '');
  return (s.includes(';') ? s.split(';') : s.split(',')).map(x => x.replace(/\s+/g, ' ').replace(/^[\s.*-]+|[\s.]+$/g, '').trim()).filter(x => x && x.length < 80);
}

/* ---------- Negara ---------- */
// [nama baku, pola tambahan]; pola dicocokkan dengan batas kata, tanpa membedakan huruf besar/kecil
const BB_COUNTRIES = [
  ['Afghanistan'], ['Albania'], ['Algeria', 'aljazair'], ['Angola'], ['Argentina'], ['Armenia'], ['Australia'], ['Austria'], ['Azerbaijan'],
  ['Bahrain'], ['Bangladesh'], ['Belarus'], ['Belgium', 'belgia'], ['Benin'], ['Bhutan'], ['Bolivia'], ['Bosnia and Herzegovina', 'bosnia'], ['Botswana'], ['Brazil', 'brasil'], ['Brunei'], ['Bulgaria'], ['Burkina Faso'], ['Burundi'],
  ['Cambodia', 'kamboja'], ['Cameroon', 'kamerun'], ['Canada', 'kanada'], ['Chile', 'cile'], ['China', "people's republic of china|pr china|p\\.r\\. china|tiongkok|cina"], ['Colombia', 'kolombia'], ['Costa Rica'], ['Croatia', 'kroasia'], ['Cuba', 'kuba'], ['Cyprus', 'siprus'], ['Czech Republic', 'czechia|ceko'],
  ['Denmark'], ['Dominican Republic'], ['Ecuador', 'ekuador'], ['Egypt', 'mesir'], ['El Salvador'], ['Estonia'], ['Eswatini', 'swaziland'], ['Ethiopia', 'etiopia'], ['Fiji'], ['Finland', 'finlandia'], ['France', 'prancis|perancis'],
  ['Gabon'], ['Gambia'], ['Germany', 'jerman'], ['Ghana'], ['Greece', 'yunani'], ['Guatemala'], ['Guinea'], ['Haiti'], ['Honduras'], ['Hong Kong'], ['Hungary', 'hongaria'],
  ['Iceland', 'islandia'], ['India'], ['Indonesia'], ['Iran'], ['Iraq', 'irak'], ['Ireland', 'irlandia'], ['Israel'], ['Italy', 'italia'], ['Ivory Coast', "c[oô]te d'ivoire"], ['Jamaica', 'jamaika'], ['Japan', 'jepang'], ['Jordan', 'yordania'],
  ['Kazakhstan'], ['Kenya'], ['Kosovo'], ['Kuwait'], ['Kyrgyzstan'], ['Laos', 'lao pdr'], ['Latvia'], ['Lebanon', 'lebanon|libanon'], ['Lesotho'], ['Liberia'], ['Libya'], ['Lithuania', 'lituania'], ['Luxembourg'],
  ['Macao', 'macau'], ['Madagascar'], ['Malawi'], ['Malaysia'], ['Maldives', 'maladewa'], ['Mali'], ['Malta'], ['Mauritius'], ['Mexico', 'meksiko'], ['Moldova'], ['Mongolia'], ['Montenegro'], ['Morocco', 'maroko'], ['Mozambique', 'mozambik'], ['Myanmar'],
  ['Namibia'], ['Nepal'], ['Netherlands', 'the netherlands|holland|belanda'], ['New Zealand', 'selandia baru'], ['Nicaragua'], ['Niger'], ['Nigeria'], ['North Macedonia', 'macedonia'], ['Norway', 'norwegia'], ['Oman'],
  ['Pakistan'], ['Palestine', 'palestina'], ['Panama'], ['Papua New Guinea', 'papua nugini'], ['Paraguay'], ['Peru'], ['Philippines', 'filipina'], ['Poland', 'polandia'], ['Portugal'], ['Puerto Rico'], ['Qatar'],
  ['Romania', 'rumania'], ['Russia', 'russian federation|rusia'], ['Rwanda'], ['Saudi Arabia', 'kingdom of saudi arabia|ksa|arab saudi'], ['Senegal'], ['Serbia'], ['Sierra Leone'], ['Singapore', 'singapura'], ['Slovakia'], ['Slovenia'], ['Somalia'],
  ['South Africa', 'afrika selatan'], ['South Korea', 'republic of korea|korea selatan|korea'], ['Spain', 'spanyol'], ['Sri Lanka'], ['Sudan'], ['Sweden', 'swedia'], ['Switzerland', 'swiss'], ['Syria', 'suriah'],
  ['Taiwan'], ['Tajikistan'], ['Tanzania'], ['Thailand'], ['Timor-Leste', 'east timor|timor leste'], ['Togo'], ['Trinidad and Tobago'], ['Tunisia'], ['Turkey', 't[uü]rkiye|turki'], ['Turkmenistan'],
  ['Uganda'], ['Ukraine', 'ukraina'], ['United Arab Emirates', 'uae|u\\.a\\.e\\.|uni emirat arab'], ['United Kingdom', 'uk|u\\.k\\.|england|scotland|wales|northern ireland|great britain|inggris'], ['United States', 'usa|u\\.s\\.a\\.|united states of america|amerika serikat'],
  ['Uruguay'], ['Uzbekistan'], ['Venezuela'], ['Vietnam', 'viet nam'], ['Yemen', 'yaman'], ['Zambia'], ['Zimbabwe']
];
const BB_CTRY_RE = BB_COUNTRIES.map(([n, alt]) => [n, new RegExp('(^|[^\\p{L}])(' + [n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')].concat(alt ? [alt] : []).join('|') + ')(?![\\p{L}])', 'iu')]);
// Nama yang juga lazim sebagai nama orang/negara bagian: hanya dipakai dari kolom ekstraksi, tidak dari teks PDF
const BB_AMBIG = new Set(['Jordan', 'Georgia', 'Guinea', 'Mali', 'Niger', 'Oman', 'Chad', 'Peru']);
function bbCountriesIn(text, strict) {
  const out = [];
  BB_CTRY_RE.forEach(([n, re]) => { if (strict && BB_AMBIG.has(n)) return; if (re.test(text)) out.push(n); });
  // "Papua New Guinea"/"South Africa" sudah mencakup nama pendeknya
  if (out.includes('Papua New Guinea') && out.includes('Guinea')) out.splice(out.indexOf('Guinea'), 1);
  return out;
}
function bbCountryField() { return (S.fields || []).find(f => /negara|country|countr/i.test(f.id + ' ' + f.label)); }
function bbExCountries(r) {
  const f = bbCountryField();
  if (!f) return [];
  const v = [exFinal(r), r.extract.r1, r.extract.r2].map(x => x && x[f.id]).find(x => x && String(x).trim());
  return v ? bbCountriesIn(String(v), false) : [];
}
// Baris afiliasi di 2 halaman pertama PDF: bagian sebelum "Abstract", atau baris yang memuat nama lembaga
const BB_AFF = /universit|institut|college|faculty|fakultas|department|departemen|school of|centre|center|academy|akademi|polytechnic|politeknik|hospital|ministry|kementerian|laborator|corresponding author|e-?mail/i;
function bbAffText(pages) {
  if (!pages || !pages.length) return '';
  const p1 = String(pages[0] || ''), cut = p1.search(/\babstract\b|\babstrak\b/i);
  const head = cut > 40 ? p1.slice(0, cut) : '';
  const lines = (p1 + '\n' + (pages[1] || '')).split(/\n/).filter(l => BB_AFF.test(l) && l.length < 400);
  return head + '\n' + lines.join('\n');
}
async function bbScanCountries(list) {
  UI.bbAff = UI.bbAff || {};
  const todo = list.filter(r => r.hasText && !(r.id in UI.bbAff));
  for (const r of todo) { const t = await loadText(r.id); UI.bbAff[r.id] = bbCountriesIn(bbAffText(t), true); }
  return todo.length;
}
function bbGeoSrc(list) {
  const ex = list.filter(r => bbExCountries(r).length).length, aff = list.filter(r => (UI.bbAff || {})[r.id] && UI.bbAff[r.id].length).length;
  const k = UI.bbGeo || (ex >= aff && ex ? 'ex' : 'aff');
  return { k, ex, aff, of: r => k === 'ex' ? bbExCountries(r) : ((UI.bbAff || {})[r.id] || []) };
}

/* ---------- Perhitungan ---------- */
function bbCompute(list) {
  const syn = bbSynMap(), stop = bbStopSet();
  const years = {}, src = new Map(), au = new Map(), kw = new Map();
  let authorsTotal = 0, single = 0, kwDocs = 0;
  const docs = list.map(r => {
    const y = bbYear(r); if (y) years[y] = (years[y] || 0) + 1;
    const j = String(r.journal || '').replace(/\s+/g, ' ').trim();
    if (j) { const k = bbFold(j).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); const o = src.get(k) || { name: j, n: 0, names: {} }; o.n++; o.names[j] = (o.names[j] || 0) + 1; src.set(k, o); }
    const A = bbAuthors(r);
    authorsTotal += A.length; if (A.length === 1) single++;
    A.forEach(a => { const o = au.get(a.key) || { key: a.key, name: a.disp, n: 0, frac: 0, first: 0, years: [] }; o.n++; o.frac += 1 / A.length; if (y) o.years.push(y); au.set(a.key, o); });
    if (A[0]) au.get(A[0].key).first++;
    const K = [...new Set(bbKwRaw(r).map(x => { const f = bbFold(x).replace(/\s+/g, ' ').trim(); return syn.get(f) || f; }).filter(f => f && !stop.has(f)))];
    if (K.length) kwDocs++;
    K.forEach(k => { const o = kw.get(k) || { n: 0, names: {}, years: [] }; o.n++; o.years.push(y); kw.set(k, o); });
    return { r, y, A, K };
  });
  // gabungkan bentuk jamak sederhana ("competencies" -> "competency" bila keduanya ada) dan pilih tampilan
  const pl = k => k.endsWith('ies') ? k.slice(0, -3) + 'y' : k.endsWith('s') && !k.endsWith('ss') ? k.slice(0, -1) : null;
  const merge = new Map();
  [...kw.keys()].forEach(k => { const s = pl(k); if (s && kw.has(s)) merge.set(k, s); });
  merge.forEach((to, from) => { const a = kw.get(from), b = kw.get(to); b.n += a.n; b.years.push(...a.years); kw.delete(from); });
  docs.forEach(d => { d.K = [...new Set(d.K.map(k => merge.get(k) || k))]; });
  kw.forEach(o => { o.n = 0; o.years = []; });
  docs.forEach(d => d.K.forEach(k => { const o = kw.get(k); o.n++; o.years.push(d.y); }));
  list.forEach(r => bbKwRaw(r).forEach(x => { let f = bbFold(x).replace(/\s+/g, ' ').trim(); f = syn.get(f) || f; f = merge.get(f) || f; const o = kw.get(f); if (o) o.names[x] = (o.names[x] || 0) + 1; }));
  const best = names => Object.entries(names).sort((a, b) => b[1] - a[1] || (a[0] === a[0].toLowerCase()) - (b[0] === b[0].toLowerCase()))[0];
  kw.forEach((o, k) => { const b = best(o.names); o.name = b ? b[0] : k; o.key = k; });
  src.forEach(o => { o.name = best(o.names)[0]; });
  const ys = Object.keys(years).map(Number).sort((a, b) => a - b);
  const y0 = ys[0], y1 = ys[ys.length - 1];
  const cagr = ys.length > 1 && years[y0] ? (Math.pow(years[y1] / years[y0], 1 / (y1 - y0)) - 1) * 100 : null;
  return {
    n: list.length, docs, years, y0, y1, cagr,
    sources: [...src.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
    authors: [...au.values()].sort((a, b) => b.n - a.n || b.frac - a.frac || a.name.localeCompare(b.name)),
    keywords: [...kw.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
    authorsTotal, single, kwDocs,
    noAuthor: docs.filter(d => !d.A.length).length, noYear: docs.filter(d => !d.y).length, noKw: docs.filter(d => !d.K.length).length
  };
}

/* ---------- Jaringan: Louvain + tata letak gaya-pegas ---------- */
function bbLouvain(n, edges) {
  let map = [...Array(n).keys()], E = edges.map(e => e.slice()), nodes = n;
  for (let pass = 0; pass < 6; pass++) {
    const adj = Array.from({ length: nodes }, () => new Map()), k = new Array(nodes).fill(0);
    let m2 = 0;
    E.forEach(([i, j, w]) => { adj[i].set(j, (adj[i].get(j) || 0) + w); if (i !== j) adj[j].set(i, (adj[j].get(i) || 0) + w); k[i] += w; k[j] += w; m2 += 2 * w; });
    if (!m2) break;
    const c = [...Array(nodes).keys()], tot = k.slice();
    let moved = true, any = false, it = 0;
    while (moved && it++ < 30) {
      moved = false;
      for (let i = 0; i < nodes; i++) {
        const ci = c[i], nb = new Map();
        adj[i].forEach((w, j) => { if (j !== i) nb.set(c[j], (nb.get(c[j]) || 0) + w); });
        tot[ci] -= k[i];
        let best = ci, bg = (nb.get(ci) || 0) - tot[ci] * k[i] / m2;
        nb.forEach((w, cc) => { const g = w - tot[cc] * k[i] / m2; if (g > bg + 1e-9) { bg = g; best = cc; } });
        tot[best] += k[i];
        if (best !== ci) { c[i] = best; moved = true; any = true; }
      }
    }
    if (!any) break;
    const ids = new Map();
    c.forEach(x => { if (!ids.has(x)) ids.set(x, ids.size); });
    map = map.map(x => ids.get(c[x]));
    const agg = new Map();
    E.forEach(([i, j, w]) => { const a = ids.get(c[i]), b = ids.get(c[j]), key = Math.min(a, b) + ',' + Math.max(a, b); agg.set(key, (agg.get(key) || 0) + w); });
    E = [...agg].map(([key, w]) => key.split(',').map(Number).concat(w));
    nodes = ids.size;
  }
  return map;
}
function bbLayout(N, E, W, H) {
  const n = N.length;
  if (!n) return [];
  // posisi awal deterministik: per klaster di lingkaran, simpul tersebar di sekitarnya
  const P = N.map((d, i) => { const a = (d.cl * 2.399) + i * 0.7, r = 0.18 + 0.3 * ((i * 7919) % 97) / 97; return { x: W / 2 + Math.cos(a) * W * r, y: H / 2 + Math.sin(a) * H * r }; });
  const kk = Math.sqrt(W * H / n) * 0.75, maxw = Math.max(1, ...E.map(e => e[2]));
  let t = W / 10;
  for (let it = 0; it < 420; it++) {
    const D = P.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[i].x - P[j].x, dy = P[i].y - P[j].y; const d = Math.hypot(dx, dy) || 0.01, f = kk * kk / d;
      dx /= d; dy /= d; D[i].x += dx * f; D[i].y += dy * f; D[j].x -= dx * f; D[j].y -= dy * f;
    }
    E.forEach(([i, j, w]) => {
      let dx = P[i].x - P[j].x, dy = P[i].y - P[j].y; const d = Math.hypot(dx, dy) || 0.01, f = d * d / kk * (0.35 + 0.65 * w / maxw) * (N[i].cl === N[j].cl ? 1.2 : 0.8);
      dx /= d; dy /= d; D[i].x -= dx * f; D[i].y -= dy * f; D[j].x += dx * f; D[j].y += dy * f;
    });
    P.forEach((p, i) => { D[i].x += (W / 2 - p.x) * 0.9; D[i].y += (H / 2 - p.y) * 0.9 * (W / H); });
    P.forEach((p, i) => { const d = Math.hypot(D[i].x, D[i].y) || 0.01, s = Math.min(d, t) / d; p.x += D[i].x * s; p.y += D[i].y * s; });
    t = Math.max(0.5, t * 0.985);
  }
  const xs = P.map(p => p.x), ys = P.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), pad = 46;
  return P.map(p => ({ x: pad + (p.x - x0) / ((x1 - x0) || 1) * (W - 2 * pad), y: pad + (p.y - y0) / ((y1 - y0) || 1) * (H - 2 * pad) }));
}
// items: [{key, name, n}] ; sets: array of arrays of keys (per dokumen)
function bbNetwork(items, sets, { min = 2, max = 60, minEdge = 1 } = {}) {
  const pick = items.filter(x => x.n >= min).slice(0, max), idx = new Map(pick.map((x, i) => [x.key, i]));
  const em = new Map();
  sets.forEach(s => {
    const ii = [...new Set(s.map(k => idx.get(k)).filter(i => i != null))].sort((a, b) => a - b);
    for (let a = 0; a < ii.length; a++) for (let b = a + 1; b < ii.length; b++) { const key = ii[a] + ',' + ii[b]; em.set(key, (em.get(key) || 0) + 1); }
  });
  const E = [...em].filter(([, w]) => w >= minEdge).map(([key, w]) => key.split(',').map(Number).concat(w));
  const cm = bbLouvain(pick.length, E);
  const deg = new Array(pick.length).fill(0), str = new Array(pick.length).fill(0);
  E.forEach(([i, j, w]) => { deg[i]++; deg[j]++; str[i] += w; str[j] += w; });
  // klaster diurutkan menurut ukuran; simpul tanpa tautan masuk "tidak terhubung"
  const size = {};
  cm.forEach((c, i) => { if (deg[i]) size[c] = (size[c] || 0) + pick[i].n; });
  const order = Object.keys(size).sort((a, b) => size[b] - size[a]).map(Number), rank = new Map(order.map((c, i) => [c, i]));
  const N = pick.map((x, i) => ({ ...x, i, deg: deg[i], str: str[i], cl: deg[i] ? rank.get(cm[i]) : -1 }));
  return { N, E, clusters: order.length };
}
function bbColor(cl) { return cl < 0 ? 'var(--bcx)' : cl < BB_PAL ? `var(--bc${cl})` : 'var(--bcx)'; }
function bbNetSvg(net, id, { W = 900, H = 560, labels = 40, unit = 'kemunculan' } = {}) {
  const { N, E } = net;
  if (!N.length) return '<p class="empty">Tidak ada simpul yang memenuhi ambang. Turunkan "Minimal kemunculan".</p>';
  const pos = bbLayout(N, E, W, H), fmax = Math.max(...N.map(d => d.n)), wmax = Math.max(1, ...E.map(e => e[2]));
  const rad = d => 4 + 15 * Math.sqrt(d.n / fmax);
  const top = new Set([...N].sort((a, b) => b.n - a.n || b.str - a.str).slice(0, labels).map(d => d.i));
  const edges = E.map(([i, j, w]) => `<line x1="${pos[i].x.toFixed(1)}" y1="${pos[i].y.toFixed(1)}" x2="${pos[j].x.toFixed(1)}" y2="${pos[j].y.toFixed(1)}" stroke="${N[i].cl === N[j].cl ? bbColor(N[i].cl) : 'var(--bcl)'}" stroke-opacity="${(0.25 + 0.45 * w / wmax).toFixed(2)}" stroke-width="${(0.6 + 3.4 * w / wmax).toFixed(1)}" data-a="${i}" data-b="${j}"/>`).join('');
  const nodes = N.map(d => `<circle cx="${pos[d.i].x.toFixed(1)}" cy="${pos[d.i].y.toFixed(1)}" r="${rad(d).toFixed(1)}" fill="${bbColor(d.cl)}" stroke="var(--surface)" stroke-width="2" data-n="${d.i}" data-tip="${esc(`<b>${esc(d.name)}</b><br>${d.n} ${unit} · ${d.deg} tautan${d.cl >= 0 ? ' · klaster ' + (d.cl + 1) : ' · tidak terhubung'}`)}"/>`).join('');
  const texts = N.filter(d => top.has(d.i)).map(d => { const p = pos[d.i], r = rad(d), fs = (10.5 + 3.5 * Math.sqrt(d.n / fmax)).toFixed(1); return `<text x="${p.x.toFixed(1)}" y="${(p.y - r - 4).toFixed(1)}" text-anchor="middle" font-size="${fs}" data-l="${d.i}">${esc(d.name.length > 28 ? d.name.slice(0, 26) + '…' : d.name)}</text>`; }).join('');
  return `<svg class="bb-net" id="${id}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Peta jaringan" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, Segoe UI, sans-serif">
    <rect width="${W}" height="${H}" fill="var(--surface)"/><g class="bb-e">${edges}</g><g class="bb-v">${nodes}</g><g class="bb-t" fill="var(--ink)" paint-order="stroke" stroke="var(--surface)" stroke-width="3" stroke-linejoin="round">${texts}</g></svg>`;
}
function bbLegend(net, nameOf) {
  const cl = Array.from({ length: Math.min(net.clusters, BB_PAL) }, (_, c) => {
    const m = net.N.filter(d => d.cl === c).sort((a, b) => b.n - a.n);
    return `<li><i style="background:${bbColor(c)}"></i><b>Klaster ${c + 1}</b> <span class="muted">(${m.length})</span> ${m.slice(0, 4).map(d => esc(nameOf(d))).join(', ')}${m.length > 4 ? '…' : ''}</li>`;
  });
  const rest = net.N.filter(d => d.cl >= BB_PAL || d.cl < 0).length;
  if (rest) cl.push(`<li><i style="background:var(--bcx)"></i><b>Lainnya</b> <span class="muted">(${rest})</span> klaster kecil atau simpul tanpa tautan</li>`);
  return `<ul class="bb-legend">${cl.join('')}</ul>`;
}

/* ---------- Grafik produksi tahunan ---------- */
function bbYearSvg(c) {
  if (c.y0 == null) return '<p class="empty">Tahun terbit tidak tersedia.</p>';
  const W = 760, H = 260, L = 36, R = 12, T = 18, B = 30, ys = [];
  for (let y = c.y0; y <= c.y1; y++) ys.push(y);
  const max = Math.max(...ys.map(y => c.years[y] || 0));
  const step = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : max <= 60 ? 10 : Math.ceil(max / 50) * 10, top = Math.ceil(max / step) * step;
  const bw = (W - L - R) / ys.length, sy = v => T + (H - T - B) * (1 - v / top);
  const grid = []; for (let v = 0; v <= top; v += step) grid.push(`<line x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line-2)"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${v}</text>`);
  const lblEvery = Math.ceil(ys.length / 14);
  const bars = ys.map((y, i) => {
    const v = c.years[y] || 0, x = L + i * bw + 1, w = Math.max(1, bw - 2), y1 = sy(v), h = H - B - y1, r = Math.min(4, w / 2, h);
    const path = v ? `<path d="M${x},${H - B} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${H - B} Z" fill="var(--accent)"/>` : '';
    return `<g data-tip="<b>${y}</b><br>${v} dokumen">${path}<rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent"/>${i % lblEvery === 0 || i === ys.length - 1 ? `<text x="${x + w / 2}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="var(--muted)">${y}</text>` : ''}</g>`;
  }).join('');
  return `<svg class="bb-chart" id="bbYearSvg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Produksi publikasi per tahun" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, Segoe UI, sans-serif"><rect width="${W}" height="${H}" fill="var(--surface)"/>${grid.join('')}<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="var(--line)"/>${bars}</svg>`;
}

/* ---------- Tabel berbatang ---------- */
function bbBarTable(rows, cols, { max, unit = '' } = {}) {
  if (!rows.length) return '<p class="empty">Tidak ada data.</p>';
  const m = max || Math.max(...rows.map(r => r.v));
  return `<div class="table-wrap"><table class="tbl small bb-tbl"><thead><tr><th class="num">#</th>${cols.map(c => `<th class="${c.num ? 'num' : ''}">${c.h}</th>`).join('')}<th class="bb-barcol" aria-hidden="true"></th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td class="num muted">${i + 1}</td>${cols.map(c => `<td class="${c.num ? 'num' : ''}">${c.f(r)}</td>`).join('')}<td class="bb-barcol"><span class="bb-bar" style="width:${(100 * r.v / m).toFixed(1)}%" title="${r.v}${unit}"></span></td></tr>`).join('')}
  </tbody></table></div>`;
}

/* ---------- Tampilan ---------- */
function renderBiblio() {
  const el = $('#view-biblio');
  const set = bbSetKey(), list = bbList(set), mode = UI.bbMode || 'sum';
  const c = bbCompute(list);
  UI.bbC = c;
  const counts = Object.fromEntries(BB_SETS.map(([k]) => [k, bbList(k).length]));
  el.innerHTML = `<div class="page bb-page">
    <div class="page-head"><div>
      <p class="eyebrow">Bibliometrik</p>
      <h1>Analisis bibliometrik</h1>
      <p class="lede">Profil publikasi studi Anda: produksi tahunan, sumber dan penulis paling produktif, jaringan ko-okurensi kata kunci, negara, dan kolaborasi penulis. Dihitung dari metadata impor (penulis, tahun, jurnal, kata kunci). Untuk analisis lanjutan, kirim data yang sama ke <b>Biblioshiny</b>.</p>
    </div>
    <div class="bb-set"><span class="small muted">Data yang dianalisis</span><div class="seg" role="group" aria-label="Data yang dianalisis">${BB_SETS.map(([k, l]) => `<button class="${set === k ? 'on' : ''}" data-action="bb-set" data-k="${k}" title="${k === 'inc' ? 'Studi yang Anda Include di tahap teks lengkap' : k === 'ta' ? 'Rekaman yang lolos skrining judul-abstrak (masuk tahap teks lengkap)' : 'Semua rekaman hasil impor, setelah duplikat dibuang'}">${l} <span class="bb-n">${counts[k]}</span></button>`).join('')}</div></div></div>
    <div class="bb-bar-row">
      <div class="seg" role="tablist" aria-label="Analisis">${BB_MODES.map(([k, l]) => `<button role="tab" aria-selected="${mode === k}" class="${mode === k ? 'on' : ''}" data-action="bb-mode" data-m="${k}">${l}</button>`).join('')}</div>
      ${list.length ? '<button class="btn sm ghost" data-action="bb-xlsx">Unduh semua tabel (Excel)</button>' : ''}
    </div>
    ${!list.length ? `<section class="card"><p class="empty">${set === 'inc' ? 'Belum ada studi yang di-Include di tahap Teks lengkap. Pilih data lain di atas, atau selesaikan skrining teks lengkap dulu.' : 'Belum ada rekaman. Impor hasil pencarian di tab Impor.'}</p></section>` :
      mode === 'src' ? bbSrcView(c) : mode === 'kw' ? bbKwView(c) : mode === 'geo' ? bbGeoView(list, c) : mode === 'shiny' ? bbShinyView(list, c) : bbSumView(c)}
  </div>
  <div class="bb-tip" id="bbTip" hidden></div>`;
  if (mode === 'geo') bbGeoAsync(list);
}

function bbSumView(c) {
  const f1 = v => v == null ? '–' : fmt(v, 1);
  const span = c.y0 != null ? (c.y0 === c.y1 ? c.y0 : c.y0 + '–' + c.y1) : '–';
  const kwTotal = c.keywords.length;
  const gaps = [c.noYear && c.noYear + ' tanpa tahun', c.noAuthor && c.noAuthor + ' tanpa penulis', c.noKw && c.noKw + ' tanpa kata kunci'].filter(Boolean);
  return `<section class="stat-row">
      <div class="stat"><span class="stat-l">Dokumen</span><span class="stat-v">${c.n}</span><span class="stat-s">${c.sources.length} sumber (jurnal, prosiding)</span></div>
      <div class="stat"><span class="stat-l">Rentang tahun</span><span class="stat-v">${span}</span><span class="stat-s">Pertumbuhan tahunan ${c.cagr == null ? '–' : f1(c.cagr) + '%'}</span></div>
      <div class="stat"><span class="stat-l">Penulis</span><span class="stat-v">${c.authors.length}</span><span class="stat-s">${c.single} dokumen penulis tunggal</span></div>
      <div class="stat"><span class="stat-l">Penulis per dokumen</span><span class="stat-v">${c.n - c.noAuthor ? f1(c.authorsTotal / (c.n - c.noAuthor)) : '–'}</span><span class="stat-s">rata-rata penulis bersama</span></div>
      <div class="stat"><span class="stat-l">Kata kunci penulis</span><span class="stat-v">${kwTotal}</span><span class="stat-s">dari ${c.kwDocs} dokumen berkata kunci</span></div>
    </section>
    <section class="card">
      <div class="card-head"><div><h2>Produksi publikasi per tahun</h2><p class="hint">Jumlah dokumen per tahun terbit. Pertumbuhan tahunan dihitung seperti bibliometrix: ((dokumen tahun terakhir ÷ tahun pertama)^(1 ÷ selisih tahun) − 1) × 100. Tahun berjalan mungkin belum lengkap.</p></div>
        <div class="btn-row"><button class="btn sm ghost" data-action="bb-svg" data-id="bbYearSvg" data-name="produksi-tahunan" data-fmt="png">PNG</button><button class="btn sm ghost" data-action="bb-svg" data-id="bbYearSvg" data-name="produksi-tahunan" data-fmt="svg">SVG</button></div></div>
      <div class="bb-chart-wrap">${bbYearSvg(c)}</div>
      <details class="bb-details"><summary>Tabel data</summary>${bbBarTable(Object.keys(c.years).sort().map(y => ({ y, v: c.years[y] })), [{ h: 'Tahun', f: r => r.y }, { h: 'Dokumen', num: 1, f: r => r.v }])}</details>
      ${gaps.length ? `<p class="hint">Metadata tidak lengkap: ${gaps.join(', ')}. Dokumen itu tidak dihitung pada analisis terkait.</p>` : ''}
    </section>`;
}

function bbSrcView(c) {
  const k = +UI.bbTop || 10;
  const topSel = `<div class="seg sm" role="group" aria-label="Jumlah baris">${[10, 20, 50].map(n => `<button class="${k === n ? 'on' : ''}" data-action="bb-top" data-n="${n}">${n} teratas</button>`).join('')}</div>`;
  const pct = v => fmt(100 * v / c.n, 1) + '%';
  // Hukum Bradford: zona inti = sumber yang bersama-sama memuat ±1/3 dokumen
  let acc = 0;
  const core = new Set(); c.sources.forEach(s => { if (acc < c.n / 3) { core.add(s); } acc += s.n; });
  return `<div class="bb-bar-row">${topSel}</div>
    <div class="grid-2">
      <section class="card"><h2>Sumber paling relevan</h2><p class="hint">Jurnal atau prosiding dengan dokumen terbanyak. <span class="pill">inti</span> menandai zona inti Bradford, yaitu sumber yang bersama-sama memuat sekitar sepertiga dokumen.</p>
        ${bbBarTable(c.sources.slice(0, k).map(s => ({ ...s, v: s.n })), [{ h: 'Sumber', f: s => esc(s.name) + (core.has(s) ? ' <span class="pill">inti</span>' : '') }, { h: 'Dok.', num: 1, f: s => s.n }, { h: '%', num: 1, f: s => pct(s.n) }])}</section>
      <section class="card"><h2>Penulis paling produktif</h2><p class="hint"><b>Dok.</b> = jumlah dokumen. <b>Fraksional</b> = setiap dokumen dibagi rata ke penulisnya (1 ÷ jumlah penulis). <b>Pertama</b> = sebagai penulis pertama. Nama digabung menurut nama belakang + inisial pertama.</p>
        ${bbBarTable(c.authors.slice(0, k).map(a => ({ ...a, v: a.n })), [{ h: 'Penulis', f: a => esc(a.name) }, { h: 'Dok.', num: 1, f: a => a.n }, { h: 'Fraksional', num: 1, f: a => fmt(a.frac, 2) }, { h: 'Pertama', num: 1, f: a => a.first }, { h: 'Tahun', f: a => a.years.length ? Math.min(...a.years) + (Math.max(...a.years) !== Math.min(...a.years) ? '–' + Math.max(...a.years) : '') : '–' }])}</section>
    </div>
    <section class="card"><h2>Hukum Lotka</h2><p class="hint">Sebaran produktivitas penulis: berapa penulis yang menulis 1, 2, 3, … dokumen. Pada literatur yang matang, sebagian besar penulis hanya menulis satu dokumen.</p>
      ${(() => { const L = {}; c.authors.forEach(a => { L[a.n] = (L[a.n] || 0) + 1; }); const rows = Object.keys(L).map(Number).sort((a, b) => a - b).map(n => ({ n, v: L[n] })); return bbBarTable(rows, [{ h: 'Dokumen ditulis', f: r => r.n }, { h: 'Jumlah penulis', num: 1, f: r => r.v }, { h: '% penulis', num: 1, f: r => fmt(100 * r.v / c.authors.length, 1) + '%' }]); })()}
    </section>`;
}

function bbKwOpts() { return { min: Math.max(1, +UI.bbMin || 2), max: Math.max(10, +UI.bbMax || 60) }; }
function bbKwNet(c) { const o = bbKwOpts(); return bbNetwork(c.keywords.map(k => ({ key: k.key, name: k.name, n: k.n })), c.docs.map(d => d.K), o); }
function bbKwView(c) {
  const o = bbKwOpts(), net = bbKwNet(c), P = bbProj();
  UI.bbKwNet = net;
  const clOf = new Map(net.N.map(d => [d.key, d.cl]));
  return `<section class="card">
      <div class="card-head"><div><h2>Jaringan ko-okurensi kata kunci</h2><p class="hint">Setiap lingkaran adalah kata kunci penulis; ukurannya sebanding dengan jumlah dokumen yang memakainya. Garis menghubungkan kata kunci yang muncul bersama dalam satu dokumen; makin tebal, makin sering. Warna menunjukkan klaster tema (algoritme Louvain), seperti di VOSviewer dan Biblioshiny. Arahkan kursor ke lingkaran untuk detail, klik untuk menyorot tetangganya.</p></div>
        <div class="btn-row"><button class="btn sm ghost" data-action="bb-svg" data-id="bbKwSvg" data-name="jaringan-kata-kunci" data-fmt="png">PNG</button><button class="btn sm ghost" data-action="bb-svg" data-id="bbKwSvg" data-name="jaringan-kata-kunci" data-fmt="svg">SVG</button></div></div>
      <div class="bb-ctl">
        <label class="fld inline"><span>Minimal kemunculan</span><input type="number" id="bbMin" min="1" max="50" value="${o.min}"></label>
        <label class="fld inline"><span>Maks. simpul</span><input type="number" id="bbMax" min="10" max="200" step="10" value="${o.max}"></label>
        <span class="small muted">${net.N.length} kata kunci · ${net.E.length} tautan · ${net.clusters} klaster</span>
      </div>
      <div class="bb-net-wrap">${bbNetSvg(net, 'bbKwSvg', { unit: 'dokumen' })}</div>
      ${bbLegend(net, d => d.name)}
    </section>
    <div class="grid-2">
      <section class="card"><h2>Kata kunci paling sering</h2>
        ${bbBarTable(c.keywords.slice(0, +UI.bbTop || 20).map(k => ({ ...k, v: k.n })), [{ h: 'Kata kunci', f: k => { const cl = clOf.get(k.key); return (cl != null ? `<i class="bb-dot" style="background:${bbColor(cl)}" title="${cl >= 0 ? 'Klaster ' + (cl + 1) : 'tidak terhubung'}"></i>` : '') + esc(k.name); } }, { h: 'Dok.', num: 1, f: k => k.n }, { h: 'Tahun rata-rata', num: 1, f: k => { const y = k.years.filter(Boolean); return y.length ? fmt(y.reduce((a, b) => a + b, 0) / y.length, 1) : '–'; } }])}
        <div class="btn-row">${[20, 50, 100].map(n => `<button class="btn sm ghost ${(+UI.bbTop || 20) === n ? 'on' : ''}" data-action="bb-top" data-n="${n}">${n} teratas</button>`).join('')}</div>
      </section>
      <section class="card"><h2>Rapikan kata kunci</h2><p class="hint">Huruf besar/kecil, aksen, dan bentuk jamak sederhana (competencies → competency) sudah digabung otomatis. Di sini Anda bisa menggabungkan sinonim dan membuang istilah yang tidak informatif, misalnya kata kunci pencarian Anda sendiri. Pengaturan ini juga dipakai saat ekspor ke Biblioshiny.</p>
        <label class="fld"><span>Sinonim: satu kelompok per baris, dipisah titik koma; semua digabung ke istilah pertama</span><textarea id="bbSyn" rows="4" placeholder="artificial intelligence; AI; ai&#10;higher education; university; tertiary education">${esc(P.syn)}</textarea></label>
        <label class="fld"><span>Abaikan: dipisah titik koma atau baris baru</span><textarea id="bbStop" rows="3" placeholder="systematic review; literature review">${esc(P.stop)}</textarea></label>
        <div class="btn-row"><button class="btn sm" data-action="bb-kw-apply">Terapkan</button></div>
      </section>
    </div>`;
}

function bbGeoView(list, c) {
  const g = bbGeoSrc(list), cs = list.map(g.of);
  const tally = {}; let multi = 0;
  cs.forEach(a => { a.forEach(n => { tally[n] = (tally[n] || 0) + 1; }); if (a.length > 1) multi++; });
  const withC = cs.filter(a => a.length).length;
  const rows = Object.entries(tally).map(([n, v]) => ({ n, v })).sort((a, b) => b.v - a.v || a.n.localeCompare(b.n));
  const cnet = bbNetwork(rows.map(r => ({ key: r.n, name: r.n, n: r.v })), cs, { min: 1, max: 60 });
  const auNet = bbNetwork(c.authors.map(a => ({ key: a.key, name: a.name, n: a.n })), c.docs.map(d => d.A.map(a => a.key)), { min: +UI.bbAuMin || 1, max: +UI.bbAuMax || 60 });
  // buang penulis tanpa tautan agar peta terbaca (penulis tunggal tidak berkolaborasi)
  const linked = auNet.N.filter(d => d.deg), keep = new Map(linked.map((d, i) => [d.i, i]));
  const auNet2 = { N: linked.map((d, i) => ({ ...d, i })), E: auNet.E.filter(([a, b]) => keep.has(a) && keep.has(b)).map(([a, b, w]) => [keep.get(a), keep.get(b), w]), clusters: auNet.clusters };
  const scanning = UI.bbScanning;
  return `<section class="card">
      <div class="card-head"><div><h2>Sebaran negara</h2>
        <p class="hint">${g.k === 'ex' ? `Diambil dari kolom ekstraksi <b>${esc((bbCountryField() || {}).label || 'Negara')}</b>, yaitu negara tempat studi dilakukan.` : 'Terdeteksi dari baris afiliasi penulis di halaman pertama PDF, yaitu negara lembaga penulis. Ini hasil deteksi otomatis, jadi periksa kembali sebelum dikutip.'} Satu dokumen dapat dihitung di lebih dari satu negara.</p></div>
        <div class="seg sm" role="group" aria-label="Sumber data negara"><button class="${g.k === 'ex' ? 'on' : ''}" data-action="bb-geo" data-k="ex" ${bbCountryField() ? '' : 'disabled title="Formulir ekstraksi tidak punya kolom Negara"'}>Negara studi (ekstraksi) <span class="bb-n">${g.ex}</span></button><button class="${g.k === 'aff' ? 'on' : ''}" data-action="bb-geo" data-k="aff">Afiliasi penulis (PDF) <span class="bb-n">${g.aff}</span></button></div></div>
      ${scanning ? '<p class="hint">Memindai afiliasi di PDF…</p>' : ''}
      <section class="stat-row">
        <div class="stat"><span class="stat-l">Dokumen bernegara</span><span class="stat-v">${withC}<small>/${list.length}</small></span><span class="stat-s">${list.length - withC} tanpa data negara</span></div>
        <div class="stat"><span class="stat-l">Negara</span><span class="stat-v">${rows.length}</span><span class="stat-s">${rows[0] ? 'terbanyak: ' + esc(rows[0].n) : '–'}</span></div>
        <div class="stat"><span class="stat-l">${g.k === 'ex' ? 'Studi multi-negara' : 'Kolaborasi internasional'}</span><span class="stat-v">${withC ? fmt(100 * multi / withC, 1) + '%' : '–'}</span><span class="stat-s">${multi} dokumen dengan ≥2 negara</span></div>
      </section>
      ${bbBarTable(rows.slice(0, 30), [{ h: 'Negara', f: r => esc(r.n) }, { h: 'Dok.', num: 1, f: r => r.v }, { h: '%', num: 1, f: r => fmt(100 * r.v / Math.max(1, withC), 1) + '%' }])}
      ${g.k === 'aff' && !list.some(r => r.hasText) ? '<p class="hint">Belum ada PDF terlampir pada data ini, jadi afiliasi tidak dapat dibaca. Lampirkan PDF di Impor (folder PDF), atau isi kolom Negara di ekstraksi.</p>' : ''}
    </section>
    ${cnet.E.length ? `<section class="card"><div class="card-head"><div><h2>Kolaborasi antarnegara</h2><p class="hint">Dua negara terhubung bila muncul dalam dokumen yang sama.</p></div>
      <div class="btn-row"><button class="btn sm ghost" data-action="bb-svg" data-id="bbCtrySvg" data-name="kolaborasi-negara" data-fmt="png">PNG</button><button class="btn sm ghost" data-action="bb-svg" data-id="bbCtrySvg" data-name="kolaborasi-negara" data-fmt="svg">SVG</button></div></div>
      <div class="bb-net-wrap">${bbNetSvg(cnet, 'bbCtrySvg', { H: 440, unit: 'dokumen' })}</div>${bbLegend(cnet, d => d.name)}</section>` : ''}
    <section class="card">
      <div class="card-head"><div><h2>Jaringan kolaborasi penulis (co-authorship)</h2><p class="hint">Penulis terhubung bila menulis dokumen bersama. Penulis yang tidak punya rekan penulis di data ini tidak ditampilkan. Warna = kelompok kolaborasi (Louvain).</p></div>
        <div class="btn-row"><button class="btn sm ghost" data-action="bb-svg" data-id="bbAuSvg" data-name="kolaborasi-penulis" data-fmt="png">PNG</button><button class="btn sm ghost" data-action="bb-svg" data-id="bbAuSvg" data-name="kolaborasi-penulis" data-fmt="svg">SVG</button></div></div>
      <div class="bb-ctl">
        <label class="fld inline"><span>Minimal dokumen per penulis</span><input type="number" id="bbAuMin" min="1" max="20" value="${+UI.bbAuMin || 1}"></label>
        <label class="fld inline"><span>Maks. penulis</span><input type="number" id="bbAuMax" min="10" max="200" step="10" value="${+UI.bbAuMax || 60}"></label>
        <span class="small muted">${auNet2.N.length} penulis · ${auNet2.E.length} tautan</span>
      </div>
      <div class="bb-net-wrap">${auNet2.N.length ? bbNetSvg(auNet2, 'bbAuSvg', { labels: 30, unit: 'dokumen' }) : '<p class="empty">Belum ada pasangan penulis yang menulis bersama pada ambang ini.</p>'}</div>
      ${auNet2.N.length ? bbLegend(auNet2, d => d.name) : ''}
    </section>`;
}
async function bbGeoAsync(list) {
  if (UI.bbScanning || !list.some(r => r.hasText && !((UI.bbAff || {})[r.id]))) return;
  UI.bbScanning = true;
  try { await bbScanCountries(list); } finally { UI.bbScanning = false; }
  if (UI.view === 'biblio' && (UI.bbMode || 'sum') === 'geo') renderBiblio();
}

/* ---------- Biblioshiny ---------- */
const BB_PORT = 3838;
function bbShinyUrl() { try { return localStorage.getItem('telaah-bbshiny') || 'http://127.0.0.1:' + BB_PORT; } catch (e) { return 'http://127.0.0.1:' + BB_PORT; } }
function bbFileBase() { return slug(S.project.title || 'telaah') + '-' + bbSetKey(); }
function bbShinyView(list, c) {
  const base = bbFileBase(), url = bbShinyUrl();
  return `<section class="card bb-shiny">
      <div class="card-head"><div><h2>Lanjutkan di Biblioshiny</h2><p class="hint">Biblioshiny adalah antarmuka web paket R <b>bibliometrix</b> (Aria &amp; Cuccurullo, 2017). Aplikasi ini berjalan di komputer Anda sendiri lewat R, sehingga tidak bisa disematkan di sini. Telaah SLR menyiapkan datanya dalam format ekspor Scopus (CSV), yang langsung bisa dibaca Biblioshiny.</p></div></div>
      <ol class="bb-steps">
        <li><div><b>Unduh data</b> <span class="muted">${list.length} dokumen dari "${esc(BB_SETS.find(s => s[0] === bbSetKey())[1])}"</span><br>
          <span class="small muted">Kolom: Authors, Title, Year, Source title, DOI, Abstract, Author Keywords (sesudah dirapikan), Affiliations (negara terdeteksi), Document Type, Source.</span></div>
          <div class="btn-row"><button class="btn sm" data-action="bb-scopus">Unduh ${esc(base)}.csv</button></div></li>
        <li><div><b>Jalankan Biblioshiny</b> dengan skrip R berikut (di RStudio: buka file, lalu <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd>). Saat pertama kali dijalankan, skrip memasang bibliometrix dan membuka Biblioshiny di port ${BB_PORT}.</div>
          <pre class="bb-code" id="bbRCode">${esc(bbRScript(base))}</pre>
          <div class="btn-row"><button class="btn sm" data-action="bb-rscript">Unduh skrip R</button><button class="btn sm ghost" data-action="bb-rcopy">Salin skrip</button></div></li>
        <li><div><b>Muat data di Biblioshiny:</b> menu <i>Data</i> → <i>Import or Load files</i> → <i>Import raw file(s)</i> → Database <b>Scopus</b>, format <b>CSV</b> → pilih ${esc(base)}.csv → <i>Start</i>.</div></li>
        <li><div><b>Buka Biblioshiny</b> di alamat yang tampil di konsol R ("Listening on http://127.0.0.1:…").</div>
          <div class="bb-url"><input type="url" id="bbUrl" value="${esc(url)}" aria-label="Alamat Biblioshiny"><a class="btn sm" id="bbOpen" href="${esc(url)}" target="_blank" rel="noopener">Buka Biblioshiny ↗</a></div></li>
      </ol>
      <p class="hint">Catatan: data ini tidak memuat jumlah sitasi dan daftar pustaka, sehingga analisis sitasi dan ko-sitasi di Biblioshiny akan kosong. Untuk analisis itu, ekspor ulang studi inklusi langsung dari Scopus/WoS (lengkap dengan <i>References</i>) dengan memakai DOI di file ini. Rujukan: <a href="https://www.bibliometrix.org" target="_blank" rel="noopener">bibliometrix.org</a> · <a href="https://cran.r-project.org/package=bibliometrix" target="_blank" rel="noopener">CRAN</a>.</p>
    </section>`;
}
function bbRScript(base) {
  return `# Telaah SLR -> Biblioshiny (${today()})
# 1) Pasang bibliometrix bila belum ada
if (!requireNamespace("bibliometrix", quietly = TRUE)) install.packages("bibliometrix")
library(bibliometrix)

# 2) Buka Biblioshiny di browser (http://127.0.0.1:${BB_PORT})
#    Lalu: Data > Import or Load files > Scopus > CSV > pilih "${base}.csv"
biblioshiny(port = ${BB_PORT})

# --- Opsional: analisis langsung di R tanpa Biblioshiny ---
# M <- convert2df("${base}.csv", dbsource = "scopus", format = "csv")
# res <- biblioAnalysis(M); summary(res, k = 10); plot(res, k = 10)
# NetMatrix <- biblioNetwork(M, analysis = "co-occurrences", network = "author_keywords", sep = ";")
# networkPlot(NetMatrix, n = 50, type = "fruchterman", Title = "Ko-okurensi kata kunci", labelsize = 0.8)
`;
}
function bbScopusCsv(list) {
  const syn = bbSynMap(), stop = bbStopSet(), g = bbGeoSrc(list);
  const H = ['Authors', 'Author full names', 'Author(s) ID', 'Title', 'Year', 'Source title', 'Volume', 'Issue', 'Art. No.', 'Page start', 'Page end', 'Page count', 'Cited by', 'DOI', 'Link', 'Affiliations', 'Authors with affiliations', 'Abstract', 'Author Keywords', 'Index Keywords', 'References', 'Correspondence Address', 'Publisher', 'Language of Original Document', 'Abbreviated Source Title', 'Document Type', 'Publication Stage', 'Open Access', 'Source', 'EID'];
  const rows = list.map(r => {
    const A = bbAuthors(r), kw = [...new Set(bbKwRaw(r).filter(x => { const f = bbFold(x).replace(/\s+/g, ' ').trim(); return !stop.has(f) && !stop.has(syn.get(f)); }).map(x => { const f = bbFold(x).replace(/\s+/g, ' ').trim(), s = syn.get(f); return s || x; }))];
    const ctry = g.of(r);
    const v = { 'Authors': A.map(a => a.disp).join('; '), 'Author full names': A.map(a => a.last + ', ' + a.ini).join('; '), 'Title': r.title, 'Year': bbYear(r) || '', 'Source title': r.journal,
      'DOI': r.doi, 'Link': r.doi ? 'https://doi.org/' + r.doi : '', 'Affiliations': ctry.join('; '), 'Abstract': cleanAbs(r.abstract || ''), 'Author Keywords': kw.join('; '),
      'Language of Original Document': 'English', 'Document Type': 'Article', 'Publication Stage': 'Final', 'Source': 'Scopus', 'EID': 'telaah-' + r.id };
    return H.map(h => v[h] == null ? '' : v[h]);
  });
  return toCSV([H, ...rows]);
}
/* ---------- Ekspor ---------- */
function bbSvgText(id) {
  const svg = $('#' + id);
  if (!svg) return null;
  const cs = getComputedStyle(document.documentElement);
  return svg.outerHTML.replace(/var\((--[\w-]+)\)/g, (m, v) => cs.getPropertyValue(v).trim() || '#888').replace(/ data-tip="[^"]*"/g, '');
}
async function bbXlsx() {
  const c = UI.bbC, list = bbList();
  if (!c) return;
  toast('Menyiapkan Excel bibliometrik…');
  const XLSX = await SettingsIO.loadLib('XLSX');
  const wb = XLSX.utils.book_new();
  const add = (name, aoa, cols) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = cols.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
  add('Info utama', [['Indikator', 'Nilai'], ['Data', BB_SETS.find(s => s[0] === bbSetKey())[1]], ['Dokumen', c.n], ['Rentang tahun', c.y0 != null ? c.y0 + '–' + c.y1 : ''], ['Pertumbuhan tahunan (%)', c.cagr == null ? '' : +c.cagr.toFixed(2)], ['Sumber', c.sources.length], ['Penulis', c.authors.length], ['Dokumen penulis tunggal', c.single], ['Penulis per dokumen', c.n - c.noAuthor ? +(c.authorsTotal / (c.n - c.noAuthor)).toFixed(2) : ''], ['Kata kunci penulis', c.keywords.length]], [28, 30]);
  add('Produksi tahunan', [['Tahun', 'Dokumen'], ...Object.keys(c.years).sort().map(y => [+y, c.years[y]])], [10, 10]);
  add('Sumber', [['Sumber', 'Dokumen', '%'], ...c.sources.map(s => [s.name, s.n, +(100 * s.n / c.n).toFixed(2)])], [60, 10, 8]);
  add('Penulis', [['Penulis', 'Dokumen', 'Fraksional', 'Penulis pertama'], ...c.authors.map(a => [a.name, a.n, +a.frac.toFixed(3), a.first])], [36, 10, 12, 16]);
  const net = bbKwNet(c), cl = new Map(net.N.map(d => [d.key, d.cl]));
  add('Kata kunci', [['Kata kunci', 'Dokumen', 'Klaster', 'Tautan'], ...c.keywords.map(k => { const d = net.N.find(x => x.key === k.key); return [k.name, k.n, cl.has(k.key) ? (cl.get(k.key) >= 0 ? cl.get(k.key) + 1 : 'tidak terhubung') : '', d ? d.deg : '']; })], [40, 10, 16, 10]);
  const g = bbGeoSrc(list), t = {}; list.forEach(r => g.of(r).forEach(n => { t[n] = (t[n] || 0) + 1; }));
  add('Negara', [['Negara', 'Dokumen', 'Sumber data'], ...Object.entries(t).sort((a, b) => b[1] - a[1]).map(([n, v]) => [n, v, g.k === 'ex' ? 'ekstraksi' : 'afiliasi PDF (deteksi)'])], [28, 10, 24]);
  add('Dokumen', [['ID', 'Penulis', 'Tahun', 'Judul', 'Sumber', 'DOI', 'Kata kunci', 'Negara'], ...c.docs.map(d => [d.r.id, d.A.map(a => a.disp).join('; '), d.y || '', d.r.title, d.r.journal, d.r.doi, d.K.join('; '), g.of(d.r).join('; ')])], [12, 40, 8, 60, 40, 26, 50, 24]);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'bibliometrik-' + bbFileBase() + '.xlsx');
  toast('Excel bibliometrik diunduh (8 lembar).', 'ok');
}

/* ---------- Event ---------- */
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-action]');
  if (!a || a.disabled || !a.dataset.action.startsWith('bb-')) {
    // klik simpul jaringan: sorot tetangganya
    const n = e.target.closest('.bb-net [data-n]');
    if (n) { const svg = n.closest('svg'), i = n.dataset.n, on = svg.dataset.focus !== i; bbFocus(svg, on ? i : null); }
    else if (e.target.closest('.bb-net')) bbFocus(e.target.closest('.bb-net'), null);
    return;
  }
  const ac = a.dataset.action;
  if (ac === 'bb-set') { UI.bbSet = a.dataset.k; renderBiblio(); }
  else if (ac === 'bb-mode') { UI.bbMode = a.dataset.m; renderBiblio(); }
  else if (ac === 'bb-top') { UI.bbTop = +a.dataset.n; renderBiblio(); }
  else if (ac === 'bb-geo') { UI.bbGeo = a.dataset.k; renderBiblio(); }
  else if (ac === 'bb-kw-apply') { const P = bbProj(); P.syn = $('#bbSyn').value; P.stop = $('#bbStop').value; touch(); renderBiblio(); toast('Kata kunci dirapikan ulang.', 'ok'); }
  else if (ac === 'bb-xlsx') { try { await bbXlsx(); } catch (err) { toast(err.message, 'bad'); } }
  else if (ac === 'bb-svg') {
    const t = bbSvgText(a.dataset.id);
    if (!t) return;
    const name = 'bibliometrik-' + a.dataset.name + '-' + bbSetKey();
    if (a.dataset.fmt === 'svg') downloadText(t, name + '.svg', 'image/svg+xml');
    else downloadBlob(await svgToPng(t, 3), name + '.png');
  }
  else if (ac === 'bb-scopus') { downloadText(bbScopusCsv(bbList()), bbFileBase() + '.csv', 'text/csv'); toast('File CSV format Scopus diunduh. Muat di Biblioshiny: Scopus → CSV.', 'ok'); }
  else if (ac === 'bb-rscript') downloadText(bbRScript(bbFileBase()), 'buka-biblioshiny.R');
  else if (ac === 'bb-rcopy') { const t = bbRScript(bbFileBase()); navigator.clipboard.writeText(t).then(() => toast('Skrip R disalin.', 'ok'), () => toast('Gagal menyalin; blok teks skripnya lalu salin manual.')); }
});
function bbFocus(svg, i) {
  if (i == null) { delete svg.dataset.focus; svg.classList.remove('focus'); svg.querySelectorAll('.hot').forEach(x => x.classList.remove('hot')); return; }
  svg.dataset.focus = i; svg.classList.add('focus');
  svg.querySelectorAll('.hot').forEach(x => x.classList.remove('hot'));
  const nb = new Set([i]);
  svg.querySelectorAll('line').forEach(l => { if (l.dataset.a === i || l.dataset.b === i) { l.classList.add('hot'); nb.add(l.dataset.a); nb.add(l.dataset.b); } });
  nb.forEach(k => { svg.querySelectorAll(`[data-n="${k}"],[data-l="${k}"]`).forEach(x => x.classList.add('hot')); });
}
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'bbMin') { UI.bbMin = +t.value; renderBiblio(); }
  else if (t.id === 'bbMax') { UI.bbMax = +t.value; renderBiblio(); }
  else if (t.id === 'bbAuMin') { UI.bbAuMin = +t.value; renderBiblio(); }
  else if (t.id === 'bbAuMax') { UI.bbAuMax = +t.value; renderBiblio(); }
  else if (t.id === 'bbUrl') { const v = t.value.trim(); try { localStorage.setItem('telaah-bbshiny', v); } catch (err) { /* abaikan */ } const o = $('#bbOpen'); if (o) o.href = v; }
});
// Keterangan saat kursor di atas batang/simpul
document.addEventListener('mousemove', e => {
  const tip = $('#bbTip');
  if (!tip) return;
  const h = e.target.closest && e.target.closest('.bb-page [data-tip]');
  if (!h) { tip.hidden = true; return; }
  tip.innerHTML = h.dataset.tip; tip.hidden = false;
  const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8), y = e.clientY + 16 + tip.offsetHeight > window.innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 16;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
});
// warna mengikuti tema: gambar ulang saat tema sistem berubah
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (UI.view === 'biblio') renderBiblio(); }); } catch (e) { /* abaikan */ }
