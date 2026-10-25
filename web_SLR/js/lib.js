/* Telaah SLR — utilitas umum & fungsi statistik */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function uid(prefix = 'r') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function normTitle(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
}

function normDoi(s) {
  return String(s || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/^doi:\s*/, '');
}

function toast(msg, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function downloadText(text, name, type = 'text/plain') {
  downloadBlob(new Blob([text], { type: type + ';charset=utf-8' }), name);
}

function toCSV(rows, delim = ',') {
  const cell = v => {
    const s = v == null ? '' : String(v);
    return /["\n\r]/.test(s) || s.includes(delim) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + rows.map(r => r.map(cell).join(delim)).join('\r\n');
}

function fmt(x, d = 2) {
  if (x == null || !isFinite(x)) return '–';
  return Number(x).toFixed(d);
}

function fmtP(p) {
  if (p == null || !isFinite(p)) return '–';
  return p < 0.001 ? '< 0.001' : p.toFixed(3);
}

function slug(s) {
  return String(s || 'proyek').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'proyek';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- Distribusi statistik ---------- */
const Stat = {
  // CDF normal standar (Abramowitz–Stegun 7.1.26 via erf)
  normCdf(z) {
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
    const erf = z >= 0 ? y : -y;
    return 0.5 * (1 + erf);
  },
  gammaln(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  },
  // Gamma tak lengkap teregulasi atas Q(a,x)
  gammaQ(a, x) {
    if (x <= 0) return 1;
    if (x < a + 1) {
      let sum = 1 / a, del = sum, ap = a;
      for (let n = 0; n < 200; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break; }
      return 1 - sum * Math.exp(-x + a * Math.log(x) - Stat.gammaln(a));
    }
    let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (let i = 1; i < 200; i++) {
      const an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-12) break;
    }
    return Math.exp(-x + a * Math.log(x) - Stat.gammaln(a)) * h;
  },
  chi2Upper(x, df) { return df > 0 ? Stat.gammaQ(df / 2, x / 2) : NaN; },
  betacf(a, b, x) {
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    d = 1 / d; let h = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-12) break;
    }
    return h;
  },
  betai(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(Stat.gammaln(a + b) - Stat.gammaln(a) - Stat.gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * Stat.betacf(a, b, x) / a : 1 - bt * Stat.betacf(b, a, 1 - x) / b;
  },
  // p dua sisi untuk statistik t
  tTwoSided(t, df) { return Stat.betai(df / 2, 0.5, df / (df + t * t)); },

  // Cohen's kappa untuk dua penilai pada kategori bebas
  kappa(pairs) {
    const n = pairs.length;
    if (!n) return { n: 0, po: NaN, kappa: NaN };
    const cats = Array.from(new Set(pairs.flat()));
    let agree = 0;
    const ca = {}, cb = {};
    pairs.forEach(([a, b]) => { if (a === b) agree++; ca[a] = (ca[a] || 0) + 1; cb[b] = (cb[b] || 0) + 1; });
    const po = agree / n;
    const pe = cats.reduce((s, c) => s + ((ca[c] || 0) / n) * ((cb[c] || 0) / n), 0);
    const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
    return { n, po, pe, kappa };
  },
  kappaLabel(k) {
    if (!isFinite(k)) return '–';
    if (k < 0) return 'Buruk';
    if (k <= 0.20) return 'Sangat lemah';
    if (k <= 0.40) return 'Lemah';
    if (k <= 0.60) return 'Sedang';
    if (k <= 0.80) return 'Kuat';
    return 'Hampir sempurna';
  }
};
