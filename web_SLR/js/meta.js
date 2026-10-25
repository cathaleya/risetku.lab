/* Telaah SLR — meta-analisis (fixed / random-effects DerSimonian–Laird), forest & funnel plot */
'use strict';

const MEASURES = {
  OR: { label: 'Odds ratio (OR)', log: true, kind: 'Dikotomus' },
  RR: { label: 'Risk ratio (RR)', log: true, kind: 'Dikotomus' },
  MD: { label: 'Mean difference (MD)', log: false, kind: 'Kontinu' },
  SMD: { label: "Standardized mean difference (Hedges' g)", log: false, kind: 'Kontinu' },
  GENLOG: { label: 'Efek generik rasio (OR/RR/HR + CI)', log: true, kind: 'Efek generik' },
  GEN: { label: 'Efek generik selisih (MD/β + CI)', log: false, kind: 'Efek generik' }
};

const MA = {
  values(r) {
    const src = S.meta.source;
    if (src === 'r1' || src === 'r2') return r.extract[src] || {};
    return exDone(r) ? exFinal(r) : {};
  },

  effect(v, measure) {
    const num = k => { const x = parseFloat(String(v[k] ?? '').replace(',', '.')); return isFinite(x) ? x : NaN; };
    const m = MEASURES[measure];
    if (m.kind === 'Dikotomus') {
      let a = num('ma_e1'), n1 = num('ma_n1'), c = num('ma_e2'), n2 = num('ma_n2');
      if ([a, n1, c, n2].some(isNaN) || n1 <= 0 || n2 <= 0 || a > n1 || c > n2) return { ok: false, why: 'Data event/N belum lengkap' };
      let b = n1 - a, d = n2 - c;
      if ((a === 0 && c === 0) || (b === 0 && d === 0)) return { ok: false, why: 'Event nol di kedua lengan' };
      if ([a, b, c, d].includes(0)) { a += 0.5; b += 0.5; c += 0.5; d += 0.5; }
      if (measure === 'OR') return { ok: true, y: Math.log((a * d) / (b * c)), v: 1 / a + 1 / b + 1 / c + 1 / d, n: n1 + n2, desc: `${v.ma_e1}/${v.ma_n1} vs ${v.ma_e2}/${v.ma_n2}` };
      const N1 = a + b, N2 = c + d;
      return { ok: true, y: Math.log((a / N1) / (c / N2)), v: 1 / a - 1 / N1 + 1 / c - 1 / N2, n: n1 + n2, desc: `${v.ma_e1}/${v.ma_n1} vs ${v.ma_e2}/${v.ma_n2}` };
    }
    if (m.kind === 'Kontinu') {
      const m1 = num('ma_m1'), s1 = num('ma_sd1'), n1 = num('ma_n1'), m2 = num('ma_m2'), s2 = num('ma_sd2'), n2 = num('ma_n2');
      if ([m1, s1, n1, m2, s2, n2].some(isNaN) || n1 < 2 || n2 < 2 || s1 <= 0 || s2 <= 0) return { ok: false, why: 'Mean/SD/N belum lengkap' };
      const desc = `${m1} (${s1}) n=${n1} vs ${m2} (${s2}) n=${n2}`;
      if (measure === 'MD') return { ok: true, y: m1 - m2, v: s1 * s1 / n1 + s2 * s2 / n2, n: n1 + n2, desc };
      const sp = Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2));
      const J = 1 - 3 / (4 * (n1 + n2) - 9);
      const g = J * (m1 - m2) / sp;
      return { ok: true, y: g, v: (n1 + n2) / (n1 * n2) + g * g / (2 * (n1 + n2)), n: n1 + n2, desc };
    }
    const es = num('ma_es'), lo = num('ma_lo'), hi = num('ma_hi');
    if ([es, lo, hi].some(isNaN) || lo >= hi) return { ok: false, why: 'Efek & CI belum lengkap' };
    if (m.log) {
      if (es <= 0 || lo <= 0) return { ok: false, why: 'Rasio harus > 0' };
      const se = (Math.log(hi) - Math.log(lo)) / 3.92;
      return { ok: true, y: Math.log(es), v: se * se, n: null, desc: `${es} [${lo}; ${hi}]` };
    }
    const se = (hi - lo) / 3.92;
    return { ok: true, y: es, v: se * se, n: null, desc: `${es} [${lo}; ${hi}]` };
  },

  outcomes() {
    const set = new Set();
    S.records.filter(inExtraction).forEach(r => { const o = (MA.values(r).ma_outcome || '').trim(); if (o) set.add(o); });
    return Array.from(set);
  },

  studies() {
    if (!S || S.project.type !== 'meta') return [];
    const measure = S.meta.measure, want = MEASURES[measure].kind, oc = S.meta.outcome;
    return S.records.filter(inExtraction).map(r => {
      const v = MA.values(r);
      const name = v.study_id || ((r.authors || '').split(/[;,]/)[0] + ' ' + (r.year || '')).trim() || r.title.slice(0, 30);
      if (S.meta.source === 'final' && !exDone(r)) return { id: r.id, name, ok: false, why: 'Konsensus belum final' };
      if (oc && (v.ma_outcome || '').trim() !== oc) return { id: r.id, name, ok: false, why: 'Outcome lain', skip: true };
      if (v.ma_type && v.ma_type !== want) return { id: r.id, name, ok: false, why: 'Jenis data: ' + v.ma_type };
      const e = MA.effect(v, measure);
      return { id: r.id, name, sub: v.ma_subgroup || '', ...e };
    });
  },

  pool(st, model) {
    const k = st.length;
    if (!k) return null;
    const w = st.map(s => 1 / s.v);
    const sw = w.reduce((a, b) => a + b, 0);
    const muF = st.reduce((a, s, i) => a + w[i] * s.y, 0) / sw;
    const Q = st.reduce((a, s, i) => a + w[i] * (s.y - muF) ** 2, 0);
    const df = k - 1;
    const C = sw - w.reduce((a, b) => a + b * b, 0) / sw;
    const tau2 = df > 0 && C > 0 ? Math.max(0, (Q - df) / C) : 0;
    const I2 = Q > 0 && df > 0 ? Math.max(0, (Q - df) / Q) * 100 : 0;
    const wr = st.map(s => 1 / (s.v + (model === 'random' ? tau2 : 0)));
    const swr = wr.reduce((a, b) => a + b, 0);
    const mu = st.reduce((a, s, i) => a + wr[i] * s.y, 0) / swr;
    const se = Math.sqrt(1 / swr);
    const z = mu / se;
    const p = 2 * (1 - Stat.normCdf(Math.abs(z)));
    let pi = null;
    if (model === 'random' && k >= 3) {
      // prediksi interval (pendekatan normal + t df k-2 disederhanakan ke 1.96·sqrt(tau²+se²) bila k kecil diberi t)
      const tcrit = MA.tQuant(0.975, k - 2);
      const s2 = Math.sqrt(tau2 + se * se);
      pi = [mu - tcrit * s2, mu + tcrit * s2];
    }
    return { k, mu, se, lo: mu - 1.96 * se, hi: mu + 1.96 * se, z, p, Q, df, pQ: Stat.chi2Upper(Q, df), tau2, I2, weights: wr.map(x => x / swr * 100), pi };
  },

  tQuant(p, df) {
    // invers t lewat bisection pada CDF
    let lo = 0, hi = 50;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const cdf = 1 - Stat.tTwoSided(mid, df) / 2;
      if (cdf < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  },

  egger(st) {
    const k = st.length;
    if (k < 3) return null;
    const xs = st.map(s => 1 / Math.sqrt(s.v)), ys = st.map(s => s.y / Math.sqrt(s.v));
    const mx = xs.reduce((a, b) => a + b, 0) / k, my = ys.reduce((a, b) => a + b, 0) / k;
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    if (sxx === 0) return null;
    const b1 = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx;
    const b0 = my - b1 * mx;
    const rss = xs.reduce((a, x, i) => a + (ys[i] - b0 - b1 * x) ** 2, 0);
    const df = k - 2;
    if (df < 1) return null;
    const s2 = rss / df;
    const seb0 = Math.sqrt(s2 * (1 / k + mx * mx / sxx));
    const t = b0 / seb0;
    return { b0, seb0, t, df, p: Stat.tTwoSided(t, df) };
  },

  tx(x) { return MEASURES[S.meta.measure].log ? Math.exp(x) : x; },

  forestSVG(st, res) {
    const log = MEASURES[S.meta.measure].log;
    const rowH = 26, top = 44, W = 860;
    const plotX = 330, plotW = 300;
    const H = top + (st.length + 2.6) * rowH + 40;
    const all = st.flatMap(s => [s.y - 1.96 * Math.sqrt(s.v), s.y + 1.96 * Math.sqrt(s.v)]).concat(res ? [res.lo, res.hi] : []).concat(res && res.pi ? res.pi : []);
    let min = Math.min(0, ...all), max = Math.max(0, ...all);
    const padR = (max - min) * 0.06 || 0.5; min -= padR; max += padR;
    const X = v => plotX + (Math.max(min, Math.min(max, v)) - min) / (max - min) * plotW;
    const ticks = MA.niceTicks(min, max, log);
    const f = x => fmt(MA.tx(x), 2);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="forest" role="img" aria-label="Forest plot">`;
    s += `<text x="8" y="22" class="ax-h">Studi</text><text x="${plotX + plotW / 2}" y="22" class="ax-h" text-anchor="middle">${esc(S.meta.measure.replace('GENLOG', 'Rasio').replace('GEN', 'Efek'))} [CI 95%]</text>`;
    s += `<text x="${plotX + plotW + 20}" y="22" class="ax-h">Estimasi [CI 95%]</text><text x="${W - 10}" y="22" class="ax-h" text-anchor="end">Bobot</text>`;
    const y0 = top - 10, y1 = top + st.length * rowH + rowH * 1.6;
    ticks.forEach(t => {
      s += `<line x1="${X(t)}" x2="${X(t)}" y1="${y0}" y2="${y1}" class="grid"/>`;
      s += `<text x="${X(t)}" y="${y1 + 16}" text-anchor="middle" class="tick">${esc(log ? fmt(Math.exp(t), Math.exp(t) < 1 ? 2 : 1) : fmt(t, 1))}</text>`;
    });
    s += `<line x1="${X(0)}" x2="${X(0)}" y1="${y0}" y2="${y1}" class="null"/>`;
    const maxW = res ? Math.max(...res.weights) : 1;
    st.forEach((d, i) => {
      const y = top + i * rowH + rowH / 2;
      const se = Math.sqrt(d.v);
      const lo = d.y - 1.96 * se, hi = d.y + 1.96 * se;
      const w = res ? res.weights[i] : 0;
      const sz = 5 + 9 * Math.sqrt(w / maxW);
      const tip = `${d.name}: ${f(d.y)} [${f(lo)}; ${f(hi)}] · bobot ${fmt(w, 1)}%`;
      s += `<g class="frow" data-tip="${esc(tip)}"><rect x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" class="hit"/>`;
      s += `<text x="8" y="${y + 4}" class="lab">${esc(d.name.slice(0, 40))}</text>`;
      s += `<line x1="${X(lo)}" x2="${X(hi)}" y1="${y}" y2="${y}" class="ci"/>`;
      if (lo < min) s += `<path d="M${X(lo) + 6},${y - 4} L${X(lo)},${y} L${X(lo) + 6},${y + 4}" class="ci" fill="none"/>`;
      if (hi > max) s += `<path d="M${X(hi) - 6},${y - 4} L${X(hi)},${y} L${X(hi) - 6},${y + 4}" class="ci" fill="none"/>`;
      s += `<rect x="${X(d.y) - sz / 2}" y="${y - sz / 2}" width="${sz}" height="${sz}" class="pt"/>`;
      s += `<text x="${plotX + plotW + 20}" y="${y + 4}" class="num">${f(d.y)} [${f(lo)}; ${f(hi)}]</text>`;
      s += `<text x="${W - 10}" y="${y + 4}" class="num" text-anchor="end">${fmt(w, 1)}%</text></g>`;
    });
    if (res) {
      const y = top + st.length * rowH + rowH * 0.9;
      s += `<line x1="0" x2="${W}" y1="${y - rowH * 0.6}" y2="${y - rowH * 0.6}" class="sep"/>`;
      const tip = `Gabungan (${S.meta.model === 'random' ? 'random' : 'fixed'}): ${f(res.mu)} [${f(res.lo)}; ${f(res.hi)}]`;
      s += `<g class="frow" data-tip="${esc(tip)}"><rect x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" class="hit"/>`;
      s += `<text x="8" y="${y + 4}" class="lab b">${S.meta.model === 'random' ? 'Model random-effects' : 'Model fixed-effect'}</text>`;
      if (res.pi) s += `<line x1="${X(res.pi[0])}" x2="${X(res.pi[1])}" y1="${y}" y2="${y}" class="pi"/>`;
      s += `<path d="M${X(res.lo)},${y} L${X(res.mu)},${y - 8} L${X(res.hi)},${y} L${X(res.mu)},${y + 8} Z" class="dia"/>`;
      s += `<text x="${plotX + plotW + 20}" y="${y + 4}" class="num b">${f(res.mu)} [${f(res.lo)}; ${f(res.hi)}]</text>`;
      s += `<text x="${W - 10}" y="${y + 4}" class="num b" text-anchor="end">100%</text></g>`;
      s += `<text x="8" y="${y + rowH + 2}" class="note">Heterogenitas: τ² = ${fmt(res.tau2, 3)}; Q = ${fmt(res.Q, 2)} (df = ${res.df}), p = ${fmtP(res.pQ)}; I² = ${fmt(res.I2, 0)}%${res.pi ? ' · garis tipis = interval prediksi' : ''}</text>`;
    }
    s += `<text x="${X(0) - 8}" y="${H - 6}" text-anchor="end" class="note">← mendukung intervensi*</text><text x="${X(0) + 8}" y="${H - 6}" class="note">mendukung kontrol* →</text>`;
    return s + '</svg>';
  },

  funnelSVG(st, res) {
    const W = 460, H = 320, L = 56, R = 16, T = 16, B = 44;
    const ses = st.map(s => Math.sqrt(s.v));
    const maxSe = Math.max(...ses) * 1.1 || 1;
    const mu = res.mu;
    const xs = st.map(s => s.y).concat([mu - 1.96 * maxSe, mu + 1.96 * maxSe]);
    let min = Math.min(...xs), max = Math.max(...xs);
    const pad = (max - min) * 0.05; min -= pad; max += pad;
    const X = v => L + (v - min) / (max - min) * (W - L - R);
    const Y = se => T + se / maxSe * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="funnel" role="img" aria-label="Funnel plot">`;
    MA.niceTicks(0, maxSe, false).forEach(t => { if (t <= maxSe) { s += `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" class="grid"/><text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end" class="tick">${fmt(t, 2)}</text>`; } });
    s += `<path d="M${X(mu)},${Y(0)} L${X(mu - 1.96 * maxSe)},${Y(maxSe)} L${X(mu + 1.96 * maxSe)},${Y(maxSe)} Z" class="cone"/>`;
    s += `<line x1="${X(mu)}" x2="${X(mu)}" y1="${Y(0)}" y2="${Y(maxSe)}" class="null"/>`;
    const log = MEASURES[S.meta.measure].log;
    MA.niceTicks(min, max, log).forEach(t => { s += `<text x="${X(t)}" y="${H - B + 16}" text-anchor="middle" class="tick">${esc(log ? fmt(Math.exp(t), 2) : fmt(t, 1))}</text>`; });
    st.forEach((d, i) => {
      s += `<circle cx="${X(d.y)}" cy="${Y(ses[i])}" r="5" class="dot" data-tip="${esc(d.name + ': ' + fmt(MA.tx(d.y), 2) + ', SE ' + fmt(ses[i], 3))}"/>`;
    });
    s += `<text x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle" class="ax-h">${log ? 'Efek (skala log, ditampilkan sebagai rasio)' : 'Efek'}</text>`;
    s += `<text x="14" y="${(T + H - B) / 2}" text-anchor="middle" class="ax-h" transform="rotate(-90 14 ${(T + H - B) / 2})">Standard error</text>`;
    return s + '</svg>';
  },

  niceTicks(min, max, log) {
    if (log) {
      const cands = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 4, 5, 10, 20, 50, 100].map(Math.log);
      let t = cands.filter(c => c >= min && c <= max);
      if (t.length > 7) t = t.filter((_, i) => i % 2 === 0 || cands[i] === 0);
      return t.length ? t : [0];
    }
    const span = max - min || 1;
    const step0 = span / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= 6) || mag * 10;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
};
