/* Telaah SLR — terjemahan teks lengkap/abstrak ke Bahasa Indonesia.
   Mesin: penerjemah bawaan Chrome (di perangkat, gratis, teks tidak keluar) atau Google Translate (dengan izin). */
'use strict';

const Tr = {
  job: 0,
  translators: {},
  seq: 0,

  pref() { try { return localStorage.getItem('telaah-lang') || 'orig'; } catch (e) { return 'orig'; } },
  setPref(v) { try { localStorage.setItem('telaah-lang', v); } catch (e) { /* abaikan */ } },
  googleOk() { try { return localStorage.getItem('telaah-gtx') === '1'; } catch (e) { return false; } },
  setGoogle(ok) { try { localStorage.setItem('telaah-gtx', ok ? '1' : '0'); } catch (e) { /* abaikan */ } },

  // Satuan terjemahan: gabungkan baris PDF, sambung kata terpenggal, pecah per ±700 karakter di batas kalimat
  units(text) {
    const t = String(text || '').replace(/([a-z])-\s*\n\s*([a-z])/g, '$1$2').replace(/([a-z])- ([a-z])/g, '$1$2');
    const out = [];
    t.split(/\n\s*\n/).forEach(par => {
      const p = par.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
      if (!p) return;
      if (p.length <= 800) { out.push(p); return; }
      let cur = '';
      p.split(/(?<=[.!?;:])\s+(?=[A-Z0-9“"(\[])/).forEach(s => {
        if (cur && (cur + ' ' + s).length > 700) { out.push(cur); cur = s; } else cur = cur ? cur + ' ' + s : s;
      });
      if (cur) out.push(cur);
    });
    return out;
  },

  async detect(sample) {
    try {
      if ('LanguageDetector' in self) {
        const d = await LanguageDetector.create();
        const r = await d.detect(sample.slice(0, 3000));
        if (r && r[0] && r[0].confidence > 0.5 && r[0].detectedLanguage !== 'und') return r[0].detectedLanguage;
      }
    } catch (e) { /* abaikan */ }
    return 'en';
  },

  async chromeAvailability(src) {
    if (!('Translator' in self)) return 'unavailable';
    try { return await Translator.availability({ sourceLanguage: src, targetLanguage: 'id' }); } catch (e) { return 'unavailable'; }
  },

  async google(text) {
    const res = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=id&dt=t', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'q=' + encodeURIComponent(text)
    });
    if (!res.ok) throw new Error('Google Translate menolak permintaan (' + res.status + '). Coba lagi beberapa saat lagi.');
    const j = await res.json();
    return (j[0] || []).map(x => x[0]).join('');
  },

  // Pilih mesin: Chrome di perangkat bila ada, selain itu Google bila diizinkan
  async engine(sample, onStatus) {
    const src = await this.detect(sample);
    if (src === 'id') return { name: 'none', label: 'Teks sudah berbahasa Indonesia', fn: async t => t };
    const av = await this.chromeAvailability(src);
    if (av !== 'unavailable') {
      const key = src;
      if (!this.translators[key]) {
        if (av !== 'available') onStatus && onStatus('Mengunduh model bahasa Chrome (' + src + ' → id), hanya sekali…');
        this.translators[key] = await Translator.create({
          sourceLanguage: src, targetLanguage: 'id',
          monitor(m) { m.addEventListener('downloadprogress', e => onStatus && onStatus('Mengunduh model bahasa Chrome: ' + Math.round((e.loaded || 0) * 100) + '%')); }
        });
      }
      const tr = this.translators[key];
      return { name: 'chrome', label: 'Penerjemah bawaan Chrome (di perangkat)', fn: t => tr.translate(t) };
    }
    if (this.googleOk()) return { name: 'google', label: 'Google Translate', fn: t => this.google(t) };
    const e = new Error('consent'); e.consent = true; throw e;
  },

  cacheKey(rid) { return rid + '|tr-id'; },
  async cache(rid) {
    if (UI.trCache && UI.trCache[rid]) return UI.trCache[rid];
    const c = (await DB.get('texts', this.cacheKey(rid))) || { map: {} };
    UI.trCache = UI.trCache || {};
    UI.trCache[rid] = c;
    return c;
  },
  saveCache: debounce(async function (rid) { if (UI.trCache && UI.trCache[rid]) await DB.put('texts', Tr.cacheKey(rid), UI.trCache[rid]); }, 800),

  /* ---------- tampilan ---------- */
  async render(el, r, text, mode, lang, opts = {}) {
    const blocks = mode === 'abs'
      ? [{ page: 'abs', title: 'Abstrak', units: this.units(r.abstract || '') }].concat(r.keywords ? [{ page: 'abs', title: 'Kata kunci', units: [r.keywords] }] : [])
      : text.map((p, i) => ({ page: String(i + 1), title: 'Hlm. ' + (i + 1), units: this.units(p) }));
    const c = await this.cache(r.id);
    this.el = el; this.rid = r.id;
    const pre = 'tu' + (++this.seq) + '_';
    let n = 0;
    const all = [];
    el.innerHTML = `<div class="tr-bar" id="trBar"><span class="tr-status" id="trStatus">Menyiapkan terjemahan…</span><button class="btn sm ghost" data-action="tr-stop" id="trStop">Hentikan</button></div>` +
      (mode === 'abs' ? '' : termHitsBlock(text.join('\n'))) +
      blocks.map(b => `<article class="doc-text page-txt tr-page" data-page="${b.page}"><span class="pg-no">${b.title}</span>${b.units.map(u => {
        const id = pre + (n++);
        const done = c.map[u];
        all.push({ id, src: u });
        const dc = opts.decorate ? opts.decorate(u) : null;
        return `<div class="tr-unit ${dc ? dc.cls : ''}" ${dc ? dc.attr : ''}>${dc ? dc.badge : ''}${lang === 'bi' ? `<p class="tr-src">${Criteria.highlight(u, S.criteria, UI.find)}</p>` : ''}<p class="tr-out ${done ? '' : 'pending'}" id="${id}" lang="id" title="${lang === 'id' ? esc(u.slice(0, 300)) : ''}">${done ? esc(done) : '<span class="muted">menerjemahkan…</span>'}</p></div>`;
      }).join('') || '<p class="muted">(halaman kosong)</p>'}</article>`).join('');
    if (mode === 'abs' && !r.abstract) { el.querySelector('#trStatus').textContent = 'Abstrak tidak tersedia. Pakai tab Teks lengkap.'; el.querySelector('#trStop').hidden = true; return; }
    const todo = all.filter(u => !c.map[u.src]);
    if (!todo.length) { this.status('Terjemahan tersimpan · ' + (c.engine || ''), true); return; }
    this.run(r.id, todo, c);
  },

  root() { return this.el && this.el.isConnected ? this.el : document; },
  status(t, finished) {
    const s = this.root().querySelector('#trStatus'); if (s) s.innerHTML = t;
    const b = this.root().querySelector('#trStop'); if (b && finished) b.hidden = true;
  },

  async run(rid, todo, c) {
    const job = ++this.job;
    let eng;
    try {
      eng = await this.engine(todo.map(u => u.src).join(' ').slice(0, 3000), t => this.status(esc(t)));
    } catch (e) {
      if (e.consent) { this.consentBox(); return; }
      this.status('<span class="txt-conf">Gagal menyiapkan penerjemah: ' + esc(e.message) + '</span>', true); return;
    }
    c.engine = eng.label;
    let done = 0, fail = 0;
    for (const u of todo) {
      if (job !== this.job || this.rid !== rid || !(this.el && this.el.isConnected)) return;
      this.status(`Menerjemahkan ${done + 1} dari ${todo.length} · ${esc(eng.label)}${eng.name === 'google' ? ' · <button class="link sm" data-action="tr-revoke">cabut izin Google</button>' : ''}`);
      try {
        const out = c.map[u.src] || await eng.fn(u.src);
        c.map[u.src] = out;
        const p = document.getElementById(u.id);
        if (p) { p.textContent = out; p.classList.remove('pending'); }
        this.saveCache(rid);
      } catch (e) {
        fail++;
        const p = document.getElementById(u.id);
        if (p) p.innerHTML = '<span class="txt-conf">gagal diterjemahkan</span>';
        if (fail >= 3) { this.status('<span class="txt-conf">Terjemahan berhenti: ' + esc(e.message) + '</span>', true); return; }
      }
      done++;
    }
    this.status(`Selesai · ${esc(eng.label)} · terjemahan mesin, periksa istilah penting di teks asli`, true);
  },

  consentBox() {
    const bar = this.root().querySelector('#trBar');
    if (!bar) return;
    bar.classList.add('consent');
    bar.innerHTML = `<div><b>Penerjemah bawaan Chrome tidak tersedia di peramban ini.</b>
      <p class="small">Pakai Google Translate? Teks artikel yang sedang dibaca akan dikirim ke server Google untuk diterjemahkan. Izin ini bisa dicabut kapan saja. Alternatif tanpa mengirim teks: perbarui Chrome ke versi terbaru (penerjemah bawaan tersedia di Chrome 138 ke atas).</p></div>
      <div class="btn-row"><button class="btn sm" data-action="tr-allow">Izinkan Google Translate</button><button class="btn sm ghost" data-action="lang" data-lang="orig">Kembali ke teks asli</button></div>`;
  },

  /* Terjemahan teks yang diblok */
  async selection(text, x, y) {
    const pop = $('#trPop');
    pop.hidden = false;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 380, x)) + 'px';
    pop.style.top = Math.min(window.innerHeight - 160, y + 10) + 'px';
    pop.innerHTML = '<p class="muted small">Menerjemahkan…</p>';
    try {
      const eng = await this.engine(text, t => { pop.innerHTML = '<p class="muted small">' + esc(t) + '</p>'; });
      const out = await eng.fn(text.replace(/\s+/g, ' '));
      pop.innerHTML = `<p class="tr-pop-text" lang="id">${esc(out)}</p><div class="tr-pop-foot"><span class="muted small">${esc(eng.label)}</span><button class="btn sm ghost" data-action="tr-pop-copy">Salin</button><button class="icon-btn" data-action="tr-pop-close" aria-label="Tutup">×</button></div>`;
      pop.dataset.text = out;
    } catch (e) {
      pop.innerHTML = e.consent
        ? `<p class="small">Penerjemah bawaan Chrome tidak tersedia. Izinkan Google Translate? Teks yang diblok akan dikirim ke Google.</p><div class="btn-row"><button class="btn sm" data-action="tr-allow-pop">Izinkan</button><button class="btn sm ghost" data-action="tr-pop-close">Batal</button></div>`
        : `<p class="small txt-conf">${esc(e.message)}</p><button class="btn sm ghost" data-action="tr-pop-close">Tutup</button>`;
    }
  }
};

// Gambar ulang panel yang sedang terlihat: pembaca di Penilaian kualitas atau panel dokumen di Skrining
function trRefresh() {
  if (UI.view === 'quality' && typeof apReaderRefresh === 'function') apReaderRefresh();
  else if (rec(UI.sel)) renderPanelA();
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  const ac = a.dataset.action;
  if (ac === 'lang') { UI.lang = a.dataset.lang; Tr.setPref(UI.lang); Tr.job++; trRefresh(); }
  else if (ac === 'tr-stop') { Tr.job++; Tr.status('Dihentikan. Bagian yang sudah diterjemahkan tetap tersimpan.', true); }
  else if (ac === 'tr-allow') { Tr.setGoogle(true); trRefresh(); }
  else if (ac === 'tr-revoke') { Tr.setGoogle(false); Tr.job++; toast('Izin Google Translate dicabut. Terjemahan yang sudah tersimpan tetap bisa dibaca.'); trRefresh(); }
  else if (ac === 'sel-translate') {
    const t = UI.selText || (window.getSelection() || '').toString();
    if (t.trim()) { const b = $('#selbar').getBoundingClientRect(); Tr.selection(t.trim().slice(0, 4000), b.left, b.bottom); }
  }
  else if (ac === 'tr-allow-pop') { Tr.setGoogle(true); const t = UI.selText; const p = $('#trPop').getBoundingClientRect(); if (t) Tr.selection(t, p.left, p.top - 10); }
  else if (ac === 'tr-pop-close') $('#trPop').hidden = true;
  else if (ac === 'tr-pop-copy') { const t = $('#trPop').dataset.text || ''; navigator.clipboard.writeText(t).then(() => toast('Terjemahan disalin.'), () => toast('Gagal menyalin.', 'bad')); }
});
