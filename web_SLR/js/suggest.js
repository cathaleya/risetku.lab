/* Telaah SLR — Saran skrining abstrak otomatis: kriteria wajib + model yang belajar dari keputusan Anda */
'use strict';

const SG_STOP = new Set(('the and for with from that this these those were was are has have had been being which their there into than then also using used use our its not but can may such between among within across about after before more most other some each both only very well how what when where who whom why will would should could study studies paper article research results result findings method methods data based analysis approach review purpose aim aims objective objectives conclusion conclusions background however therefore thus while through over under one two three new findings found show shows shown provide provides present presents discuss discussed significant significantly dan yang untuk dengan dari pada dalam ini itu atau oleh sebagai adalah akan juga tidak lebih karena serta bahwa telah dapat para').split(' '));

function sgTokens(r) {
  const c = UI.sgTok || (UI.sgTok = new Map());
  const k = r.id + '|' + (r.title || '').length + '|' + (r.abstract || '').length;
  const hit = c.get(r.id);
  if (hit && hit.k === k) return hit.t;
  const words = ((r.title || '') + ' . ' + cleanAbs(r.abstract) + ' . ' + (r.keywords || '')).toLowerCase().match(/[\p{L}][\p{L}\p{N}-]{2,}/gu) || [];
  const w = words.filter(x => !SG_STOP.has(x));
  const set = new Set(w);
  for (let i = 0; i < w.length - 1; i++) set.add(w[i] + ' ' + w[i + 1]);
  const t = [...set];
  c.set(r.id, { k, t });
  return t;
}

// Label latih: keputusan Judul & abstrak yang Anda buat atau setujui sendiri (bukan tanda otomatis yang belum dicek)
function sgLabel(r, rv) {
  const s = r.screen.ta;
  const d = (s.final && s.final.d ? s.final : null) || (rv && s[rv]) || s.r1;
  if (!d || d.auto || d.sg || (d.d !== 'include' && d.d !== 'exclude')) return null;
  return d.d;
}

// Bobot kata: IDF dari seluruh rekaman tahap ini (kata umum berbobot kecil)
function sgIdf(recs) {
  if (UI.sgIdf && UI.sgIdf.n === recs.length) return UI.sgIdf.m;
  const df = new Map();
  recs.forEach(r => sgTokens(r).forEach(w => df.set(w, (df.get(w) || 0) + 1)));
  const m = new Map(), N = recs.length;
  df.forEach((c, w) => { if (c >= 2 && c < N * 0.5) m.set(w, Math.log(N / c)); });
  UI.sgIdf = { n: N, m };
  return m;
}
function sgVec(t, idf) {
  const v = new Map(); let n = 0;
  t.forEach(w => { const x = idf.get(w); if (x) { v.set(w, x); n += x * x; } });
  n = Math.sqrt(n) || 1;
  v.forEach((x, w) => v.set(w, x / n));
  return v;
}
// Centroid (Rocchio): rata-rata vektor studi Include dan studi Exclude
function sgTrain(docs, idf) {
  const ci = new Map(), ce = new Map(); let ni = 0, ne = 0;
  docs.forEach(({ t, y }) => {
    const c = y === 'include' ? ci : ce;
    y === 'include' ? ni++ : ne++;
    sgVec(t, idf).forEach((x, w) => c.set(w, (c.get(w) || 0) + x));
  });
  ci.forEach((x, w) => ci.set(w, x / (ni || 1)));
  ce.forEach((x, w) => ce.set(w, x / (ne || 1)));
  const m = { ci, ce, idf, scale: 1 };
  // skala: sebaran skor pada data latih, agar p tidak terlalu yakin
  const sc = docs.map(d => sgRaw(m, d.t).s);
  const mean = sc.reduce((a, b) => a + b, 0) / (sc.length || 1);
  const sd = Math.sqrt(sc.reduce((a, b) => a + (b - mean) ** 2, 0) / (sc.length || 1)) || 1;
  m.scale = sd;
  return m;
}
function sgRaw(m, t) {
  let s = 0; const contrib = [];
  sgVec(t, m.idf).forEach((x, w) => {
    const d = x * ((m.ci.get(w) || 0) - (m.ce.get(w) || 0));
    if (d) { s += d; contrib.push([w, d]); }
  });
  return { s, contrib };
}
function sgPredict(m, t) {
  const { s, contrib } = sgRaw(m, t);
  return { p: 1 / (1 + Math.exp(-1.5 * s / m.scale)), contrib };
}

// Hanya keputusan Anda sendiri (klik satu per satu, di Papan, 3 panel, atau Saran); "Terima semua" tidak ikut dipelajari
function sgModel() {
  const rv = boardRv();
  const recs = stageRecords('ta');
  const lab = [];
  recs.forEach(r => { const y = sgLabel(r, rv); if (y) lab.push({ r, y }); });
  // dilatih ulang setiap 5 keputusan baru (atau lewat tombol Latih ulang) agar klik tetap cepat
  const nI = lab.filter(x => x.y === 'include').length, nE = lab.length - nI;
  const key = (nI >= 10 && nE >= 10 ? 'm' + Math.floor(lab.length / 5) : nI + ':' + nE) + ':' + recs.length + ':' + (rv || '');
  if (UI.sgModel && UI.sgModel.key === key) return UI.sgModel;
  const docs = lab.map(({ r, y }) => ({ t: sgTokens(r), y }));
  const nInc = docs.filter(d => d.y === 'include').length, nExc = docs.length - nInc;
  const out = { key, nInc, nExc, ready: nInc >= 10 && nExc >= 10, acc: null };
  if (out.ready) {
    const idf = sgIdf(recs);
    out.m = sgTrain(docs, idf);
    // perkiraan akurasi: validasi silang 5 lipatan pada keputusan Anda
    let ok = 0;
    for (let f = 0; f < 5; f++) {
      const te = docs.filter((_, i) => i % 5 === f), mm = sgTrain(docs.filter((_, i) => i % 5 !== f), idf);
      te.forEach(d => { if ((sgPredict(mm, d.t).p >= 0.5) === (d.y === 'include')) ok++; });
    }
    out.acc = Math.round(ok / docs.length * 100);
  }
  UI.sgModel = out;
  return out;
}

// Skor kriteria 0..1: kriteria wajib berbobot lebih, kata eksklusi mengurangi
function sgCrit(ev, r) {
  if (!ev.total) return 0.5;
  const keys = keyCrit();
  const req = ev.inc.filter(x => keys.includes(x.label));
  const others = ev.inc.filter(x => !keys.includes(x.label));
  const fOth = others.length ? others.filter(x => x.n).length / others.length : 1;
  // ada kriteria wajib yang padam -> paling tinggi 0,4 (kelompok Exclude), selaras dengan Tandai otomatis
  const v = req.length && req.some(x => !x.n) ? 0.4 * req.filter(x => x.n).length / req.length
    : (keyStrong(ev, r) ? 0.7 : 0.55) + 0.3 * fOth - (ev.excMatched ? 0.3 : 0);
  return Math.max(0, Math.min(1, v));
}

function sgScore(r, M) {
  const ev = evB(r);
  const c = sgCrit(ev, r);
  const pr = M.ready ? sgPredict(M.m, sgTokens(r)) : null;
  const w = 0.5;
  const rel = pr ? w * pr.p + (1 - w) * c : c;
  const grp = rel >= 0.7 ? 'inc' : rel >= 0.45 ? 'maybe' : 'exc';
  return { r, ev, c, pr, rel, grp, stars: 1 + Math.round(rel * 4) };
}

// Kandidat: belum diputuskan, ragu, atau tanda otomatis yang belum dikirim
function sgCandidates(rv) {
  return stageRecords('ta').filter(r => {
    if (r.archived) return false;
    const d = r.screen.ta[rv];
    return !d || !d.d || d.d === 'maybe' || (d.auto && !d.sent);
  });
}

function sgEvidence(r) {
  const C = Criteria.compiled(S.criteria);
  const sents = cleanAbs(r.abstract).split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).filter(Boolean);
  const scored = sents.map(s => ({ s, n: C.inc.filter(c => { c.re.lastIndex = 0; return c.re.test(s); }).length })).filter(x => x.n);
  scored.sort((a, b) => b.n - a.n);
  return scored.slice(0, 2).map(x => Criteria.highlight(x.s.length > 320 ? x.s.slice(0, 320) + '…' : x.s, S.criteria));
}

const SG_GROUPS = [
  ['inc', 'Disarankan Include', 'Kriteria wajib terpenuhi dan mirip studi yang Anda sertakan.'],
  ['maybe', 'Ragu, baca dulu', 'Sinyal campuran. Baca abstraknya sebelum memutuskan.'],
  ['exc', 'Disarankan Exclude', 'Kriteria wajib padam atau mirip studi yang Anda keluarkan.'],
  ['conf', 'Bertentangan', 'Saran berbeda dengan tanda otomatis yang sudah dipasang. Perlu dicek.']
];

function renderSuggest() {
  UI.stage = 'ta';
  const rv = boardRv();
  UI.evMemo = new Map();
  try {
    const M = rv ? sgModel() : null;
    const all = rv ? sgCandidates(rv).map(r => sgScore(r, M)) : [];
    const cur = x => { const d = x.r.screen.ta[rv]; return d && d.auto && !d.sent ? d.d : null; };
    const conf = x => { const c = cur(x); return (c === 'include' && x.grp === 'exc') || (c === 'exclude' && x.grp === 'inc'); };
    const by = { inc: [], maybe: [], exc: [], conf: [] };
    all.forEach(x => { by[x.grp].push(x); if (conf(x)) by.conf.push(x); });
    Object.values(by).forEach(l => l.sort((a, b) => b.rel - a.rel));
    const g = UI.sgGrp && by[UI.sgGrp] ? UI.sgGrp : 'inc';
    const lim = UI.sgLim || 100;
    const list = by[g];
    const gm = SG_GROUPS.find(x => x[0] === g);

    $('#view-work').innerHTML = `
    <div class="work-bar">
      ${workModeSeg()}
      <span class="muted small">Saran skrining tahap <b>Judul &amp; abstrak</b> · ${all.length} rekaman belum dipastikan</span>
      <div class="work-filters">${rv ? autoLowCtl() : ''}<button class="btn sm ghost" data-action="sg-retrain">Latih ulang</button></div>
    </div>
    ${!rv ? `<div class="cbanner conf"><span>Pilih <b>Bekerja sebagai: Reviewer 1</b> atau <b>Reviewer 2</b> di kanan atas untuk melihat saran.</span></div>` : `
    <section class="card sg-how">
      <div class="sg-how-row">
        <div><b>Cara saran dihitung</b>
          <p class="small muted">Skor relevansi menggabungkan <b>kriteria wajib</b> (${esc(keyCrit().join(', ') || '—')}) dengan <b>model yang belajar dari keputusan Anda sendiri</b>, yaitu kata dan frasa yang sering muncul di studi yang Anda Include atau Exclude. Semakin banyak Anda memutuskan, semakin tajam sarannya. Semua dihitung di peramban ini; tidak ada data yang dikirim ke luar.</p></div>
        <div class="sg-model">${M.ready
          ? `<span class="pill ok">Model aktif</span><span class="small">Belajar dari <b>${M.nInc}</b> Include + <b>${M.nExc}</b> Exclude keputusan Anda · perkiraan akurasi <b>${M.acc}%</b></span>
            <span class="small muted">Saran makin tajam setiap kali Anda memutuskan satu per satu. Hasil &ldquo;Terima semua&rdquo; tidak ikut dipelajari.</span>`
          : `<span class="pill">Kriteria saja</span><span class="small">Model belajar setelah Anda sendiri memutuskan ≥ 10 Include dan ≥ 10 Exclude (sekarang ${M.nInc} dan ${M.nExc}). Sementara ini saran dihitung dari kriteria saja.</span>`}</div>
      </div>
    </section>
    <div class="seg sg-tabs" role="tablist" aria-label="Kelompok saran">${SG_GROUPS.map(([k, l]) => `<button role="tab" aria-selected="${g === k}" class="${g === k ? 'on' : ''} sg-t-${k}" data-action="sg-grp" data-g="${k}">${l} <span class="n">${by[k].length}</span></button>`).join('')}</div>
    <div class="sg-grp-head"><span class="muted small">${gm[2]}</span>
      ${list.length && g === 'exc' ? `<button class="btn sm d-exc" data-action="sg-accept" data-g="exc">✕ Terima semua sebagai Exclude (${list.length})</button>` : list.length && g === 'inc' ? `<span class="small muted">Include dipilih satu per satu (tombol ✓ di tiap baris), supaya Teks lengkap hanya berisi studi yang Anda pilih sendiri.</span>` : ''}</div>
    <div class="sg-list">${list.slice(0, lim).map(x => sgRow(x, rv, cur(x))).join('') || `<p class="bcol-empty">Tidak ada rekaman di kelompok ini.</p>`}
      ${list.length > lim ? `<button class="btn sm ghost bcol-more" data-action="sg-more">Tampilkan 100 lagi · ${list.length - lim} tersembunyi</button>` : ''}</div>`}`;
  } finally { UI.evMemo = null; }
}

function sgRow(x, rv, cur) {
  const { r, ev, pr } = x;
  const pos = pr ? pr.contrib.filter(c => c[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(c => c[0]) : [];
  const neg = pr ? pr.contrib.filter(c => c[1] < 0).sort((a, b) => a[1] - b[1]).slice(0, 4).map(c => c[0]) : [];
  const ex = sgEvidence(r);
  const keys = keyCrit();
  const miss = ev.inc.filter(c => keys.includes(c.label) && !c.n).map(c => c.label);
  return `<article class="sg-row sg-${x.grp}">
    <div class="sg-score" title="Skor relevansi ${Math.round(x.rel * 100)}/100"><span class="sg-stars" aria-label="${x.stars} dari 5">${'★'.repeat(x.stars)}<span class="off">${'★'.repeat(5 - x.stars)}</span></span><b>${Math.round(x.rel * 100)}</b></div>
    <div class="sg-main">
      <button class="bc-title" data-action="board-open" data-id="${r.id}" title="Buka di tampilan 3 panel">${esc(r.title || '(tanpa judul)')}</button>
      <p class="bc-meta">${esc((r.authors || '').split(/[;,]/)[0])}${r.year ? ' · ' + esc(r.year) : ''} ${critLamps(ev)}${cur ? ` <span class="pill">otomatis: ${cur === 'include' ? 'Include' : 'Exclude'}</span>` : ''}</p>
      ${miss.length ? `<p class="sg-why no">Kriteria wajib padam: ${esc(miss.join('; '))}</p>` : !keyStrong(ev, r) ? `<p class="sg-why small muted">Bukti tipis: kriteria wajib hanya disebut sekali di abstrak.</p>` : ''}
      ${ex.length ? `<div class="sg-ev">${ex.map(h => `<p>${h}</p>`).join('')}</div>` : !r.abstract ? '<p class="small muted">Tanpa abstrak: putuskan dari judul atau buka teks lengkap.</p>' : ''}
      ${pos.length || neg.length ? `<p class="sg-why small">${pos.length ? `<span class="ok">mirip Include: ${esc(pos.join(', '))}</span>` : ''}${pos.length && neg.length ? ' · ' : ''}${neg.length ? `<span class="no">mirip Exclude: ${esc(neg.join(', '))}</span>` : ''}</p>` : ''}
    </div>
    <div class="sg-act">
      <button class="btn sm d-inc" data-action="sg-dec" data-id="${r.id}" data-d="include">✓ Include</button>
      <button class="btn sm d-exc" data-action="sg-dec" data-id="${r.id}" data-d="exclude">✕ Exclude</button>
      <button class="btn sm ghost" data-action="sg-dec" data-id="${r.id}" data-d="maybe">? Ragu</button>
    </div>
  </article>`;
}

function sgDecide(r, d, rv, bulk) {
  setDecision(r, 'ta', rv, d, { reason: d === 'exclude' ? keyReason(r) : '' });
  if (bulk) r.screen.ta[rv].sg = 1;
  r.taLowSeen = 1;
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]');
  if (!a || !a.dataset.action.startsWith('sg-')) return;
  const ac = a.dataset.action, rv = boardRv();
  if (ac === 'sg-grp') { UI.sgGrp = a.dataset.g; UI.sgLim = 100; renderSuggest(); }
  else if (ac === 'sg-more') { UI.sgLim = (UI.sgLim || 100) + 100; renderSuggest(); }
  else if (ac === 'sg-retrain') { UI.sgModel = null; renderSuggest(); toast('Model dilatih ulang dari keputusan terbaru.', 'ok'); }
  else if (ac === 'sg-dec' && rv) {
    const r = rec(a.dataset.id); if (!r) return;
    UI.evMemo = new Map(); try { sgDecide(r, a.dataset.d, rv); } finally { UI.evMemo = null; }
    touch(); renderSuggest();
    toast(a.dataset.d === 'include' ? 'Include: masuk tahap Teks lengkap.' : a.dataset.d === 'exclude' ? 'Exclude dicatat. Kirim alasan & bersihkan di kolom Exclude.' : 'Ditandai ragu.', 'ok');
  }
  else if (ac === 'sg-accept' && rv) {
    const g = a.dataset.g, d = 'exclude';
    if (g !== 'exc') return; // Include massal tidak diizinkan: Teks lengkap hanya berisi pilihan Anda
    UI.evMemo = new Map();
    let n = 0;
    try {
      const M = sgModel();
      sgCandidates(rv).map(r => sgScore(r, M)).filter(x => x.grp === g).forEach(x => { sgDecide(x.r, d, rv, true); n++; });
    } finally { UI.evMemo = null; }
    touch(); renderSuggest();
    toast(`${n} rekaman ditetapkan sebagai ${d === 'include' ? 'Include' : 'Exclude'}.${d === 'exclude' ? ' Kirim alasan & bersihkan di kolom Exclude (Papan).' : ''}`, 'ok');
  }
});
