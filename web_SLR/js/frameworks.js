/* Telaah SLR — pemetaan kerangka konseptual/teoretis studi inklusi (katalog dari GO-GN Conceptual Frameworks Guide v1.0, CC BY 4.0) */
'use strict';

// [id, nama, grup, deskripsi singkat, rujukan kunci, pola deteksi]
const CF_GROUPS = {
  gogn: 'Kerangka dalam GO-GN (riset pendidikan terbuka)',
  trans: 'Transisi & pengalaman pembelajar',
  ident: 'Identitas & keagenan',
  ped: 'Pedagogi',
  cur: 'Kurikulum',
  soc: 'Pembelajaran sosial',
  pow: 'Teori kekuasaan (sosiologis)',
  dec: 'Dekolonisasi / pascakolonial',
  mob: 'Mobilitas',
  extra: 'Kerangka umum lain (di luar panduan GO-GN)'
};
const CF_CATALOG = [
  ['chat', 'Activity Theory (CHAT)', 'gogn', 'Aktivitas manusia yang diarahkan objek dalam sistem (subjek, alat, aturan, komunitas, pembagian kerja); kontradiksi memicu perubahan dan belajar.', 'Engeström (1987; 2001); Kaptelinin (2005)', /activity theory|activity system|\bCHAT\b|cultural[- ]historical activity|Engestr[oö]m/gi],
  ['bigoer', '"Big" & "Little" OER', 'gogn', 'Membedakan OER institusional berskala besar dan OER individual berbiaya rendah; menyoroti hubungan skala dan pedagogi.', 'Weller (2010); Cronin (2017)', /big (and|&) little OER|little OER|big OER/gi],
  ['bound', 'Boundaries (boundary objects/crossing)', 'gogn', 'Batas sosiokultural antar-komunitas pengetahuan; objek batas dan lintas batas sebagai peluang belajar.', 'Akkerman & Bakker (2011); Star & Griesemer (1989)', /boundary (object|crossing|spanning)|boundary-crossing|brokering/gi],
  ['capab', 'Capability Approach', 'gogn', 'Sejauh mana individu mampu melakukan dan menjadi apa yang mereka hargai; fokus keadilan sosial (kapabilitas, fungsi, faktor konversi).', 'Sen (1999); Nussbaum (2011); Robeyns (2017)', /capabilit(y|ies) approach|\bSen\b \(19|Nussbaum|conversion factors/gi],
  ['bazaar', 'Cathedral / Bazaar', 'gogn', 'Metafora pengembangan tertutup ("katedral") vs. terbuka dan kolaboratif ("bazar"), dipakai untuk model produksi sumber belajar.', 'Raymond (1999); Farrow (2016)', /cathedral (and|&) (the )?bazaar|bazaar model/gi],
  ['coi', 'Community of Inquiry', 'gogn', 'Pengalaman belajar daring dari interaksi kehadiran kognitif, sosial, dan pengajaran.', 'Garrison, Anderson & Archer (2000; 2001)', /community of inquiry|\bCoI\b|cognitive presence|social presence|teaching presence/gi],
  ['cop', 'Communities of Practice', 'gogn', 'Kelompok yang berbagi minat atau praktik; terdiri atas domain, komunitas, dan praktik bersama.', 'Wenger (1998); Wenger, McDermott & Snyder (2002)', /communit(y|ies) of practice|\bCoPs?\b|legitimate peripheral/gi],
  ['connect', 'Connectivism', 'gogn', 'Teori belajar era jaringan: pengetahuan terdistribusi di jaringan; belajar adalah membangun koneksi antar-simpul.', 'Siemens (2005); Downes; Kop (2011)', /connectivis[mt]/gi],
  ['coup', 'COUP Framework', 'gogn', 'Kerangka dampak OER: Cost, Outcomes, Usage, Perceptions.', 'Bliss, Robinson, Hilton & Wiley (2013)', /\bCOUP\b/g],
  ['design', 'Design Thinking', 'gogn', 'Pendekatan berpusat manusia, kolaboratif, dan eksperimental untuk memecahkan masalah pendidikan.', 'Brown & Wyatt (2010); Razzouk & Shute (2012)', /design thinking/gi],
  ['doi', 'Diffusion of Innovations', 'gogn', 'Bagaimana inovasi diadopsi dan menyebar secara sosial dari waktu ke waktu.', 'Rogers (2003)', /diffusion of innovations?|Rogers \(20|early adopters|innovation[- ]decision/gi],
  ['equity', 'Equity (equity-mindedness)', 'gogn', 'Kesetaraan hasil dan kesadaran ekuitas di pendidikan tinggi.', 'Bensimon (2005; 2012)', /equity[- ]minded|Bensimon/gi],
  ['la', 'Learning Analytics', 'gogn', 'Pengukuran, pengumpulan, dan analisis data pembelajar untuk memahami dan mengoptimalkan belajar.', 'Siemens & Baker (2011)', /learning analytics/gi],
  ['lingacc', 'Linguistic Accessibility', 'gogn', 'Keterbacaan dan aksesibilitas bahasa materi terbuka bagi penutur non-asli.', 'Rets & Rogaten (2021); Cobo (2013)', /linguistic accessibility|readability/gi],
  ['moocacc', 'MOOC Accessibility', 'gogn', 'Aksesibilitas MOOC bagi pembelajar dengan disabilitas.', 'Iniesto (2020); Kear et al. (2016)', /MOOC accessibility|accessib\w+ (of|in) MOOCs?/gi],
  ['moocout', 'MOOC Learner-Centred Outcomes', 'gogn', 'Luaran berpusat pembelajar (kepuasan, pemenuhan niat) sebagai ukuran keberhasilan kursus terbuka.', 'Rabin, Kalman & Kalz (2019); Kizilcec et al. (2013)', /intention[- ]fulfil+ment|learner[- ]cent(red|ered) outcomes?/gi],
  ['moocknow', 'MOOC Knowledge Framework', 'gogn', 'Kerangka pengetahuan dan pengembangan kompetensi melalui MOOC.', 'Kalz et al. (2015)', /MOOC knowledge/gi],
  ['network', 'Network Theory / Social Network Analysis', 'gogn', 'Struktur relasi antar-aktor dan simpul; analisis jaringan sosial.', 'Borgatti & Halgin (2011); Castells (2001)', /network theory|social network analysis|\bSNA\b|network society/gi],
  ['oeradopt', 'OER Adoption', 'gogn', 'Faktor dan tahap adopsi OER oleh pendidik dan institusi.', 'Cox & Trotter (2017); Belikov (2016)', /OER adoption|adoption of (open educational resources|OER)/gi],
  ['oerimpact', 'OER Impact', 'gogn', 'Dampak OER pada pendidik, pembelajar, dan institusi.', 'de los Arcos et al. (2014); Clarke (2005)', /OER impact|impact of (open educational resources|OER)/gi],
  ['oerreuse', 'OER Reuse (5R)', 'gogn', 'Penggunaan ulang OER: retain, reuse, revise, remix, redistribute.', 'Wiley (2015); Clements & Pawlowski (2012)', /\b5Rs?\b|retain, reuse, revise|OER reuse/gi],
  ['ocl', 'Online Collaborative Learning', 'gogn', 'Belajar kolaboratif daring melalui pembangkitan ide, pengorganisasian, dan konvergensi intelektual.', 'Harasim (2012)', /online collaborative learning|Harasim/gi],
  ['engage', 'Online Engagement Framework', 'gogn', 'Lima elemen keterlibatan daring: sosial, kognitif, perilaku, kolaboratif, emosional.', 'Redmond et al. (2018)', /online engagement framework|Redmond et al/gi],
  ['oep', 'Open Educational Practices (OEP)', 'gogn', 'Praktik pendidikan terbuka: penggunaan, kreasi, dan berbagi secara terbuka dalam pengajaran.', 'Cronin (2017); Cronin & MacLaren (2018)', /open educational practices?|\bOEP\b/gi],
  ['praxis', 'PRAXIS / Complexity', 'gogn', 'Kerangka praksis dan teori kompleksitas untuk memahami sistem pendidikan terbuka.', 'Czerwonogora & Rodés (2019); Davis & Sumara (2006)', /\bPRAXIS framework|complexity theory/gi],
  ['rhizo', 'Rhizomatic Learning', 'gogn', 'Belajar non-linear seperti rimpang: komunitas sebagai kurikulum.', 'Cormier (2008); Deleuze & Guattari', /rhizom\w+/gi],
  ['socjust', 'Social Justice', 'gogn', 'Keadilan sosial dalam pendidikan terbuka: redistributif, rekognitif, representasional.', 'Lambert (2018); Hodgkinson-Williams & Trotter (2018); Fraser', /social justice|Nancy Fraser|parity of participation/gi],
  ['socreal', 'Social Realism', 'gogn', 'Interaksi struktur, budaya, dan keagenan; refleksivitas.', 'Archer (2003; 2007; 2012)', /social realism|critical realism|morphogenetic|Archer \(20/gi],
  ['tpack', 'TPACK Framework', 'gogn', 'Integrasi pengetahuan teknologi, pedagogi, dan konten (Technological Pedagogical Content Knowledge).', 'Mishra & Koehler (2006); Koehler & Mishra (2009)', /\bTPACK\b|TPCK|technological pedagogical content knowledge/gi],
  ['utaut', 'UTAUT', 'gogn', 'Penerimaan dan penggunaan teknologi: ekspektasi kinerja, ekspektasi usaha, pengaruh sosial, kondisi pendukung.', 'Venkatesh et al. (2003)', /\bUTAUT2?\b|unified theory of acceptance|performance expectancy|effort expectancy/gi],
  ['value', 'Value Creation Framework', 'gogn', 'Siklus penciptaan nilai dalam komunitas dan jaringan (langsung, potensial, terapan, terwujud, reframing).', 'Wenger, Trayner & de Laat (2011)', /value creation (framework|cycles?)/gi],
  ['eco', 'Ecological Systems Theory', 'trans', 'Sistem lingkungan dan sosial berlapis yang memengaruhi pengalaman individu.', 'Bronfenbrenner (1979)', /ecological systems?|Bronfenbrenner|microsystem|mesosystem/gi],
  ['multitrans', 'Multidimensional Transition Theory', 'trans', 'Transisi akademik, sosial, dan emosional berlapis saat berpindah ruang.', 'Jindal-Snape & Ingram (2013)', /multiple and multi-?dimensional transitions?|Jindal-Snape/gi],
  ['resil', 'Academic Resilience', 'trans', 'Kemampuan beradaptasi dan berkembang di tengah ketidakpastian.', 'Holdsworth et al. (2017)', /academic resilience/gi],
  ['tinto', 'Student Engagement / Retention Model', 'trans', 'Faktor yang memengaruhi retensi dan keberhasilan mahasiswa.', 'Tinto (1975)', /Tinto|student integration model/gi],
  ['liminal', 'Liminality', 'trans', 'Ruang transisi yang dapat memicu disorientasi atau ambiguitas.', 'Turner (1969)', /liminal\w*/gi],
  ['agency', 'Student Agency', 'ident', 'Kemampuan membuat pilihan dalam batasan realitas hidup.', 'Biesta & Tedder (2007)', /student agency|learner agency/gi],
  ['identity', 'Identity Theory', 'ident', 'Konstruksi diri melalui interaksi dengan pengalaman dan budaya.', 'Hall (1996)', /identity theory|professional identity|researcher identity/gi],
  ['selves', 'Possible Selves', 'ident', 'Diri masa depan yang dibayangkan ("ingin menjadi" dan "ingin dihindari").', 'Markus & Nurius (1986)', /possible selves/gi],
  ['intersect', 'Intersectionality', 'ident', 'Identitas majemuk yang menghasilkan bentuk penindasan berbeda.', 'Crenshaw (1989)', /intersectional\w*/gi],
  ['crt', 'Critical Race Theory', 'ident', 'Ras sebagai konstruksi sosial; struktur sosial yang rasis.', 'McCoy (2015)', /critical race theory/gi],
  ['critped', 'Critical Pedagogy', 'ped', 'Teori kritis dalam pendidikan: keadilan sosial, relasi kuasa, dominasi.', 'Freire (1970); Giroux (2011)', /critical pedagog\w+|Freire/gi],
  ['engped', 'Engaged Pedagogy', 'ped', 'Relasi guru–siswa dan pendekatan humanistik.', 'hooks (1994)', /engaged pedagogy|bell hooks/gi],
  ['bernstein', "Bernstein's Pedagogic Device", 'ped', 'Pedagogi sebagai kontrol simbolik atas pengetahuan.', 'Bernstein (2000)', /pedagogic device|Bernstein/gi],
  ['transform', 'Transformative Learning', 'ped', 'Evaluasi pengalaman masa lalu melalui pengetahuan baru.', 'Mezirow (1991)', /transformative learning|Mezirow/gi],
  ['hidden', 'Hidden Curriculum', 'cur', 'Pelajaran tak tertulis tentang nilai dan norma dari penyelenggaraan pendidikan.', 'Apple (1989)', /hidden curriculum/gi],
  ['intlcur', 'Internationalisation of the Curriculum', 'cur', 'Unsur internasional atau antarbudaya dalam isi dan penyampaian pendidikan.', 'Leask (2015)', /internationali[sz]ation of (the )?curricul/gi],
  ['figured', 'Figured Worlds', 'soc', 'Perkembangan diri dalam kaitan dengan tipe sosial di sekitarnya.', 'Holland et al. (2001)', /figured worlds?/gi],
  ['bourdieu', 'Bourdieusian Theory', 'pow', 'Habitus, modal, dan arena untuk menelaah kuasa dan kendala struktural.', 'Bourdieu (1987); Grenfell (2013)', /Bourdieu\w*|habitus|cultural capital/gi],
  ['foucault', 'Foucauldian Theory', 'pow', 'Relasi kuasa dalam masyarakat, bahasa, dan praktik.', 'Foucault (1972; 1977)', /Foucault\w*|governmentality|disciplinary power/gi],
  ['gramsci', 'Gramscian Theory', 'pow', 'Hegemoni budaya: negara dan kelas ekonomi mempertahankan kuasa lewat institusi.', 'Gramsci (1971)', /Gramsci\w*|cultural hegemony/gi],
  ['postcol', 'Postcolonial / Third Space', 'dec', 'Orientalisme, subjugasi, ruang ketiga/hibriditas, kesadaran ganda.', 'Said (1978); Bhabha (1994); Fanon (1967)', /post-?colonial\w*|decoloni\w+|third space|hybridity|Orientalism/gi],
  ['spatial', 'Spatial Theories / Mobilities', 'mob', 'Relasi ruang dan waktu yang dikonstruksi secara sosial; infrastruktur migrasi.', 'Lefebvre (1991)', /Lefebvre|spatial theor\w+|mobilities/gi],
  ['tam', 'Technology Acceptance Model (TAM)', 'extra', 'Persepsi kegunaan dan kemudahan penggunaan menentukan niat memakai teknologi.', 'Davis (1989)', /technology acceptance model|\bTAM\b|perceived usefulness|perceived ease of use/gi],
  ['digcomp', 'DigComp (Kerangka Kompetensi Digital)', 'extra', 'Kerangka kompetensi digital warga Eropa: informasi & data, komunikasi, kreasi konten, keamanan, pemecahan masalah.', 'Vuorikari et al. (2022), Komisi Eropa', /\bDigComp\w*|digital competence framework/gi],
  ['sct', 'Social Cognitive Theory / Self-efficacy', 'extra', 'Interaksi personal, perilaku, dan lingkungan; efikasi diri.', 'Bandura (1986; 1997)', /social cognitive theory|self-efficacy|Bandura/gi],
  ['sdt', 'Self-Determination Theory', 'extra', 'Motivasi dari pemenuhan kebutuhan otonomi, kompetensi, dan keterhubungan.', 'Deci & Ryan (1985; 2000)', /self-determination theory|\bSDT\b/gi],
  ['tpb', 'Theory of Planned Behaviour', 'extra', 'Sikap, norma subjektif, dan kontrol perilaku yang dirasakan memprediksi niat.', 'Ajzen (1991)', /planned behaviou?r|\bTPB\b|subjective norms?/gi]
].map(([id, name, group, desc, refs, re]) => ({ id, name, group, desc, refs, re }));

const CF_ROLES = [
  ['under', 'Mendasari desain studi', 'Kerangka dinyatakan eksplisit dan membentuk pertanyaan, instrumen, atau analisis.'],
  ['lens', 'Lensa analisis/interpretasi', 'Dipakai untuk menafsirkan temuan, tetapi tidak membentuk desain.'],
  ['new', 'Mengembangkan kerangka baru', 'Studi mengusulkan atau memodifikasi kerangka.'],
  ['mention', 'Hanya disebut', 'Disebut di tinjauan pustaka tanpa dipakai dalam studi.'],
  ['none', 'Tidak ada kerangka eksplisit', 'Asumsi teoretis/konseptual tidak dinyatakan (masalah GO-GN no. 1).']
];
// 10 masalah pembingkaian teoretis/konseptual (Casanave & Li, 2015, diadaptasi GO-GN)
const CF_PROBLEMS = [
  ['p1', 'Tanpa kerangka', 'Pembaca tidak dapat memahami asumsi teoretis, konseptual, atau metodologis yang mendasari studi.'],
  ['p2', 'Kerangka tidak tepat', 'Kerangka yang dipilih tidak menyelaraskan teori dengan data secara tepat.'],
  ['p3', 'Kerangka tidak selaras dengan data', 'Kerangka tidak terhubung dengan bagian lain studi.'],
  ['p4', 'Tidak seimbang dengan data', 'Gagasan dan konsep besar tanpa data yang mendukung.'],
  ['p5', 'Perlakuan dangkal/tidak konsisten', 'Fokus teoretis tidak lengkap, dangkal, atau tidak konsisten.'],
  ['p6', 'Salah menafsirkan teori', 'Bergantung pada istilah populer tanpa pemahaman mendalam.'],
  ['p7', 'Sekadar formalitas (lip service)', 'Memakai nama dan konsep besar tanpa bukti pemahaman.'],
  ['p8', 'Tergiur teori populer', 'Teori populer tetap harus cocok dengan studi.'],
  ['p9', 'Ketiadaan yang mencolok', 'Nama atau konsep berpengaruh tidak muncul, tanda kurang membaca luas.'],
  ['p10', 'Metodologi tidak dijelaskan', 'Prinsip inkuiri dan sikap epistemologis tidak dijelaskan.']
];

/* ---------- Data ---------- */
function cfStore() { return (S.cframe = S.cframe || {}); }
function cfCustom() { return (S.cframeCustom = S.cframeCustom || []); }
function cfAll() { return CF_CATALOG.concat(cfCustom().map(c => ({ id: c.id, name: c.name, group: 'custom', desc: 'Ditambahkan sendiri', refs: '', re: c.terms ? new RegExp(c.terms.split(/[,;]/).map(s => s.trim()).filter(Boolean).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') || '(?!)', 'gi') : null }))); }
function cfById(id) { return cfAll().find(c => c.id === id); }
function cfRater() { return typeof apRater === 'function' ? apRater() : 'r1'; }
function cfGet(rid, k = cfRater()) { const s = cfStore()[rid]; return s && s[k] || null; }
function cfEnsure(rid) { const s = cfStore()[rid] = cfStore()[rid] || {}; const k = cfRater(); return (s[k] = s[k] || { ids: [], role: '', problems: [], note: '', other: '', done: false }); }
function cfFinal(rid) { const s = cfStore()[rid]; return s ? (isSingle() ? s.r1 : s.final) || null : null; }
function cfList() { return S.records.filter(inExtraction); }

// Deteksi dari seluruh teks PDF (kerangka sering di tinjauan pustaka) + judul/abstrak/kata kunci
function cfDetect(r) {
  UI.cfCache = UI.cfCache || {};
  const pages = UI.textCache[r.id];
  const key = r.id + ':' + (pages ? pages.length : 0) + ':' + cfCustom().length;
  if (UI.cfCache[key]) return UI.cfCache[key];
  const text = [r.title, r.abstract, r.keywords, (pages || []).join('\n')].join('\n');
  const head = [r.title, r.abstract, r.keywords].join('\n');
  const out = [];
  cfAll().forEach(c => {
    if (!c.re) return;
    c.re.lastIndex = 0;
    const m = text.match(c.re);
    if (!m) return;
    c.re.lastIndex = 0;
    const inHead = (head.match(c.re) || []).length;
    out.push({ id: c.id, n: m.length, inHead, ex: m[0] });
  });
  out.sort((a, b) => (b.inHead - a.inHead) || (b.n - a.n));
  return (UI.cfCache[key] = { hits: out, fromPdf: !!pages });
}
// Saran: disebut di judul/abstrak, atau ≥3 kali di teks lengkap
function cfSuggested(r) { return cfDetect(r).hits.filter(h => h.inHead || h.n >= 3); }

/* ---------- Tampilan ---------- */
function renderFrameworks() {
  const el = $('#view-frameworks');
  const list = cfList();
  const mode = UI.cfMode || 'map';
  if (!UI.cfSel || !list.some(r => r.id === UI.cfSel)) UI.cfSel = (list.find(r => !(cfGet(r.id) || {}).done) || list[0] || {}).id;
  const done = list.filter(r => (cfFinal(r.id) || {}).done).length;
  el.innerHTML = `<div class="page cf-page">
    <div class="page-head"><div>
      <p class="eyebrow">Kerangka konseptual</p>
      <h1>Pemetaan kerangka teori</h1>
      <p class="lede">Petakan kerangka konseptual/teoretis yang dipakai setiap studi inklusi, perannya dalam studi, dan masalah pembingkaian yang terlihat. Katalog dari <i>GO-GN Conceptual Frameworks Guide</i> v1.0 (2021, CC BY 4.0). Kerangka terdeteksi otomatis dari teks lengkap PDF.</p>
    </div>
    <div class="btn-row"><div class="seg" role="tablist" aria-label="Tampilan">${[['map', 'Pemetaan'], ['sum', 'Ringkasan'], ['cat', 'Katalog']].map(([k, l]) => `<button role="tab" aria-selected="${mode === k}" class="${mode === k ? 'on' : ''}" data-action="cf-mode" data-m="${k}">${l}</button>`).join('')}</div></div></div>
    ${list.length ? `<section class="card cf-dl"><div class="cf-dl-row"><span><b>Unduh hasil pemetaan</b> <span class="muted small">${done}/${list.length} studi selesai</span></span>
      <button class="btn sm" data-action="cf-dl" data-fmt="xlsx">Unduh Excel</button><button class="btn sm ghost" data-action="cf-dl" data-fmt="csv">CSV</button>
      <button class="btn sm ghost" data-action="cf-auto-all" title="Isi kerangka yang terdeteksi pada studi yang belum dipetakan">Terapkan saran ke studi yang belum dipetakan</button></div></section>` : ''}
    ${mode === 'cat' ? cfCatalogView() : !list.length ? `<section class="card"><p class="empty">Belum ada studi inklusi. Studi muncul di sini setelah diputuskan <b>Include</b> pada tahap Teks lengkap. Katalog kerangka tetap bisa dilihat di tab Katalog.</p></section>` : mode === 'sum' ? cfSummaryView(list) : cfMapView(list)}
  </div>`;
}

function cfMapView(list) {
  const r = rec(UI.cfSel);
  const m = cfEnsure(r.id);
  const det = cfDetect(r);
  const sug = cfSuggested(r).filter(h => !m.ids.includes(h.id));
  const groups = {};
  cfAll().forEach(c => (groups[c.group] = groups[c.group] || []).push(c));
  const q = (UI.cfQ || '').toLowerCase();
  return `<div class="ap-grid">
    <aside class="card ap-list" aria-label="Daftar studi">
      ${list.map(x => { const p = cfGet(x.id); const st = p && p.done ? 'done' : p && (p.ids.length || p.role) ? 'partial' : 'none'; return `<button class="ap-item ${x.id === UI.cfSel ? 'sel' : ''}" data-action="cf-pick" data-id="${x.id}">
        <span class="ap-dot ap-${st}" aria-hidden="true"></span>
        <span class="ap-it-main"><b>${esc((x.title || '(tanpa judul)').slice(0, 90))}</b><span class="muted small">${esc((x.authors || '').split(/[;,]/)[0])}${x.year ? ' · ' + esc(x.year) : ''}${p && p.ids.length ? ' · ' + esc(p.ids.map(i => (cfById(i) || {}).name || i).join(', ').slice(0, 60)) : ''}</span></span></button>`; }).join('')}
    </aside>
    <section class="card ap-form">
      <div class="ap-head"><div><h2>${esc(r.title || '(tanpa judul)')}</h2><p class="muted small">${esc(r.authors || '')}${r.year ? ' · ' + esc(r.year) : ''}</p></div>
        <button class="btn sm ghost" data-action="open-rec" data-id="${r.id}" data-stage="ex">Buka teks lengkap</button></div>
      <div class="ap-sug ${sug.length ? '' : 'ok'}"><span>${det.hits.length ? `<b>Terdeteksi${det.fromPdf ? ' di teks lengkap' : ' di judul/abstrak (PDF belum ada)'}:</b> ${det.hits.slice(0, 8).map(h => `${esc(cfById(h.id).name)} <span class="muted">${h.n}×${h.inHead ? ', di abstrak' : ''}</span>`).join(' · ')}` : 'Tidak ada kerangka dari katalog yang terdeteksi. Bisa jadi studi tidak menyatakan kerangka secara eksplisit.'}</span>
        ${sug.length ? `<button class="btn sm" data-action="cf-use-sug">Tambahkan saran (${sug.length})</button>` : ''}</div>

      <fieldset class="ap-sec"><legend>Kerangka yang dipakai</legend>
        <div class="cf-chosen">${m.ids.map(id => { const c = cfById(id); return `<span class="cf-chip on">${esc(c ? c.name : id)}<button class="db-x" data-action="cf-toggle" data-cf="${id}" aria-label="Hapus ${esc(c ? c.name : id)}">×</button></span>`; }).join('') || '<span class="muted small">Belum ada. Pilih dari daftar di bawah atau pakai saran.</span>'}</div>
        <input type="search" id="cfQ" placeholder="Cari kerangka, mis. TPACK, UTAUT, activity" value="${esc(UI.cfQ || '')}" aria-label="Cari kerangka">
        <div class="cf-pick">${Object.entries(groups).map(([g, cs]) => { const vis = cs.filter(c => !q || (c.name + ' ' + c.desc).toLowerCase().includes(q)); return vis.length ? `<div class="cf-pg"><span class="cf-gl">${esc(CF_GROUPS[g] || 'Ditambahkan sendiri')}</span>${vis.map(c => { const h = det.hits.find(x => x.id === c.id); return `<button class="cf-chip ${m.ids.includes(c.id) ? 'on' : ''} ${h ? 'hit' : ''}" data-action="cf-toggle" data-cf="${c.id}" aria-pressed="${m.ids.includes(c.id)}" title="${esc(c.desc)}${c.refs ? ' — ' + esc(c.refs) : ''}">${esc(c.name)}${h ? ` <small>${h.n}×</small>` : ''}</button>`; }).join('')}</div>` : ''; }).join('')}</div>
        <div class="cf-add"><input type="text" id="cfNew" placeholder="Kerangka lain, mis. Intellectual Capital Theory" aria-label="Nama kerangka baru"><input type="text" id="cfNewTerms" placeholder="Kata kunci deteksi (pisahkan koma)" aria-label="Kata kunci deteksi"><button class="btn sm ghost" data-action="cf-add">Tambah ke katalog</button></div>
      </fieldset>

      <fieldset class="ap-sec"><legend>Peran kerangka dalam studi</legend>
        <div class="cf-roles">${CF_ROLES.map(([k, l, d]) => `<label class="cf-role"><input type="radio" name="cfRole" data-cfrole value="${k}" ${m.role === k ? 'checked' : ''}><span><b>${l}</b><span class="muted small">${d}</span></span></label>`).join('')}</div>
      </fieldset>

      <fieldset class="ap-sec"><legend>Masalah pembingkaian yang terlihat <span class="muted small">(opsional · Casanave &amp; Li, 2015, dalam GO-GN)</span></legend>
        <div class="cf-probs">${CF_PROBLEMS.map(([k, l, d]) => `<label class="check sm"><input type="checkbox" data-cfprob="${k}" ${m.problems.includes(k) ? 'checked' : ''}> <span><b>${l}.</b> <span class="muted">${d}</span></span></label>`).join('')}</div>
      </fieldset>

      <label class="fld"><span>Bukti / kutipan (mis. "Penelitian ini memakai TPACK…", hlm. 3)</span><textarea id="cfNote" data-cfnote rows="3">${esc(m.note || '')}</textarea></label>
      <div class="btn-row">
        <label class="check"><input type="checkbox" id="cfDone" ${m.done ? 'checked' : ''}> <span><b>Pemetaan selesai</b></span></label>
        <button class="btn" data-action="cf-next">Simpan &amp; berikutnya</button>
        ${!isSingle() && UI.as === 'both' && cfStore()[r.id] && (cfStore()[r.id].r1 || cfStore()[r.id].r2) ? `<button class="btn ghost" data-action="cf-copy" data-from="${cfStore()[r.id].r1 ? 'r1' : 'r2'}">Salin dari ${esc(revName(cfStore()[r.id].r1 ? 'r1' : 'r2'))}</button>` : ''}
      </div>
    </section>
  </div>`;
}

function cfTally(list) {
  const rows = list.map(r => ({ r, m: cfFinal(r.id) })).filter(x => x.m && (x.m.ids.length || x.m.role));
  const fw = {}, role = {}, prob = {};
  rows.forEach(({ m }) => { m.ids.forEach(i => fw[i] = (fw[i] || 0) + 1); if (m.role) role[m.role] = (role[m.role] || 0) + 1; (m.problems || []).forEach(p => prob[p] = (prob[p] || 0) + 1); });
  return { rows, fw, role, prob, none: rows.filter(x => !x.m.ids.length).length };
}

function cfSummaryView(list) {
  const T = cfTally(list);
  const sel = UI.cfPick;
  const bars = (entries, total, kind) => { const max = Math.max(1, ...entries.map(e => e[1])); return entries.map(([k, n, label]) => `<button class="ex-bar ${sel && sel.k === kind && sel.v === k ? 'on' : ''}" data-action="cf-sumpick" data-k="${kind}" data-v="${esc(k)}"><span class="ex-bar-l" title="${esc(label)}">${esc(label)}</span><span class="ex-bar-track"><i style="width:${n / max * 100}%"></i></span><b class="ex-bar-n">${n}</b><span class="ex-bar-p muted">${total ? Math.round(n / total * 100) : 0}%</span></button>`).join(''); };
  const fwE = Object.entries(T.fw).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, n, (cfById(k) || {}).name || k]);
  const roleE = CF_ROLES.filter(([k]) => T.role[k]).map(([k, l]) => [k, T.role[k], l]);
  const probE = CF_PROBLEMS.filter(([k]) => T.prob[k]).map(([k, l]) => [k, T.prob[k], l]);
  const picked = sel ? T.rows.filter(({ m }) => sel.k === 'fw' ? m.ids.includes(sel.v) : sel.k === 'role' ? m.role === sel.v : (m.problems || []).includes(sel.v)) : [];
  const groupCount = {};
  fwE.forEach(([k, n]) => { const g = (cfById(k) || {}).group || 'custom'; groupCount[g] = (groupCount[g] || 0) + n; });
  return `<section class="card">
    <div class="card-head"><div><h2>Ringkasan kerangka (${T.rows.length} dari ${list.length} studi dipetakan)</h2>
      <p class="hint">Dari pemetaan ${isSingle() ? 'Reviewer 1' : 'konsensus'}. Satu studi bisa memakai lebih dari satu kerangka. Klik baris untuk melihat studinya.${T.none ? ` <b>${T.none} studi</b> tanpa kerangka eksplisit.` : ''}</p></div></div>
    <div class="ex-sum-grid">
      <div class="ex-field"><h3>Kerangka yang dipakai</h3>${bars(fwE, T.rows.length, 'fw') || '<p class="muted small">Belum ada.</p>'}</div>
      <div class="ex-field"><h3>Peran kerangka</h3>${bars(roleE, T.rows.length, 'role') || '<p class="muted small">Belum ada.</p>'}
        <h3 class="cf-h3">Kelompok kerangka</h3>${Object.entries(groupCount).sort((a, b) => b[1] - a[1]).map(([g, n]) => `<p class="small cf-gline"><span>${esc(CF_GROUPS[g] || 'Ditambahkan sendiri')}</span><b>${n}</b></p>`).join('') || '<p class="muted small">—</p>'}</div>
      <div class="ex-field"><h3>Masalah pembingkaian</h3>${bars(probE, T.rows.length, 'prob') || '<p class="muted small">Belum ada yang ditandai.</p>'}</div>
    </div>
    ${sel ? `<div class="ex-list"><div class="ex-list-head"><b>${esc(sel.k === 'fw' ? (cfById(sel.v) || {}).name : sel.k === 'role' ? CF_ROLES.find(x => x[0] === sel.v)[1] : CF_PROBLEMS.find(x => x[0] === sel.v)[1])}</b> <span class="muted">· ${picked.length} studi</span><button class="link sm" data-action="cf-sumclear">tutup</button></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Studi</th><th>Kerangka</th><th>Peran</th><th>Bukti</th></tr></thead><tbody>
      ${picked.map(({ r, m }) => `<tr><td class="rep-study"><button class="link" data-action="cf-open" data-id="${r.id}">${esc(apCite(r) || r.title.slice(0, 40))}</button><span class="muted small">${esc(r.title.slice(0, 100))}</span></td><td class="small">${esc(m.ids.map(i => (cfById(i) || {}).name || i).join('; ') || '—')}</td><td class="small">${esc((CF_ROLES.find(x => x[0] === m.role) || ['', '—'])[1])}</td><td class="small">${esc((m.note || '').slice(0, 160))}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
  </section>`;
}

function cfCatalogView() {
  const q = (UI.cfCatQ || '').toLowerCase();
  const groups = {};
  cfAll().filter(c => !q || (c.name + ' ' + c.desc + ' ' + c.refs).toLowerCase().includes(q)).forEach(c => (groups[c.group] = groups[c.group] || []).push(c));
  return `<section class="card">
    <div class="card-head"><div><h2>Katalog kerangka (${cfAll().length})</h2><p class="hint">Ringkasan berbahasa Indonesia dari GO-GN Conceptual Frameworks Guide v1.0 (Global OER Graduate Network, 2021, CC BY 4.0), termasuk bagian "Brief guide to additional Theoretical Frameworks" (diadaptasi dari Mittelmeier). Kelompok terakhir adalah kerangka umum di luar panduan.</p></div>
      <input type="search" id="cfCatQ" placeholder="Cari di katalog" value="${esc(UI.cfCatQ || '')}" aria-label="Cari di katalog"></div>
    ${Object.entries(groups).map(([g, cs]) => `<h3 class="ap-gtitle">${esc(CF_GROUPS[g] || 'Ditambahkan sendiri')}</h3><div class="cf-cat">${cs.map(c => `<article class="cf-card"><b>${esc(c.name)}</b><p class="small">${esc(c.desc)}</p>${c.refs ? `<p class="muted small">Rujukan: ${esc(c.refs)}</p>` : ''}</article>`).join('')}</div>`).join('') || '<p class="empty">Tidak ada yang cocok.</p>'}
    <h3 class="ap-gtitle">10 masalah pembingkaian teoretis/konseptual</h3>
    <ol class="small cf-plist">${CF_PROBLEMS.map(([, l, d]) => `<li><b>${l}.</b> ${d}</li>`).join('')}</ol>
    <p class="muted small">Casanave, C. P., &amp; Li, Y. (2015), diadaptasi dalam GO-GN Conceptual Frameworks Guide (2021).</p>
  </section>`;
}

/* ---------- Unduh ---------- */
function cfRows() {
  const out = [['study_id', 'studi', 'judul', 'tahun', 'penilai', 'kerangka', 'kelompok', 'peran', 'masalah_pembingkaian', 'bukti', 'terdeteksi_otomatis', 'selesai']];
  cfList().forEach(r => {
    const s = cfStore()[r.id] || {};
    const raters = ['r1', 'r2', 'final'].filter(k => s[k] && (!isSingle() || k === 'r1'));
    const det = cfDetect(r).hits.map(h => cfById(h.id).name + ' (' + h.n + '×)').join('; ');
    if (!raters.length) out.push([apStudyId(r), apCite(r), r.title, r.year, '', '', '', '', '', '', det, '']);
    raters.forEach(k => {
      const m = s[k];
      out.push([apStudyId(r), apCite(r), r.title, r.year, apRaterName(k), m.ids.map(i => (cfById(i) || {}).name || i).join('; '), [...new Set(m.ids.map(i => CF_GROUPS[(cfById(i) || {}).group] || 'Ditambahkan sendiri'))].join('; '),
        (CF_ROLES.find(x => x[0] === m.role) || ['', ''])[1], (m.problems || []).map(p => CF_PROBLEMS.find(x => x[0] === p)[1]).join('; '), m.note || '', det, m.done ? 'ya' : 'draf']);
    });
  });
  return out;
}
async function cfExport(fmt) {
  const base = 'kerangka-konseptual-' + slug(S.project.title || 'telaah').slice(0, 40);
  if (fmt === 'csv') { downloadText(toCSV(cfRows(), typeof delim === 'function' ? delim() : ','), base + '.csv', 'text/csv'); return; }
  try {
    toast('Menyiapkan Excel kerangka konseptual…');
    const XLSX = await SettingsIO.loadLib('XLSX');
    const wb = XLSX.utils.book_new();
    const add = (name, aoa, cols) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = cols.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
    const T = cfTally(cfList());
    const n = T.rows.length;
    const pct = x => n ? Math.round(x / n * 100) + '%' : '';
    add('Ringkasan', [['Pemetaan kerangka konseptual — ' + (S.project.title || 'Telaah SLR')], [n + ' studi dipetakan · ' + (isSingle() ? revName('r1') : 'konsensus') + ' · ' + today()], [],
      ['Kerangka', 'Kelompok', 'Jumlah studi', '%'], ...Object.entries(T.fw).sort((a, b) => b[1] - a[1]).map(([k, c]) => [(cfById(k) || {}).name || k, CF_GROUPS[(cfById(k) || {}).group] || 'Ditambahkan sendiri', c, pct(c)]),
      ['Tanpa kerangka eksplisit', '', T.none, pct(T.none)], [],
      ['Peran kerangka', '', 'Jumlah studi', '%'], ...CF_ROLES.filter(([k]) => T.role[k]).map(([k, l]) => [l, '', T.role[k], pct(T.role[k])]), [],
      ['Masalah pembingkaian', '', 'Jumlah studi', '%'], ...CF_PROBLEMS.filter(([k]) => T.prob[k]).map(([k, l]) => [l, '', T.prob[k], pct(T.prob[k])])], [40, 40, 13, 8]);
    add('Per studi', cfRows(), [12, 22, 50, 6, 14, 40, 30, 26, 34, 50, 40, 8]);
    add('Katalog', [['Kerangka', 'Kelompok', 'Deskripsi', 'Rujukan kunci'], ...cfAll().map(c => [c.name, CF_GROUPS[c.group] || 'Ditambahkan sendiri', c.desc, c.refs]), [], ['Sumber katalog: GO-GN Conceptual Frameworks Guide v1.0 (Global OER Graduate Network, 2021), CC BY 4.0.']], [36, 36, 80, 40]);
    downloadBlob(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), base + '.xlsx');
    toast('Excel diunduh: Ringkasan, Per studi, Katalog.', 'ok');
  } catch (e) { console.error(e); toast('Gagal membuat Excel: ' + e.message + '. Coba unduh CSV.', 'bad'); }
}

/* ---------- Interaksi ---------- */
function cfSave(re = true) { touch(); if (re) { const y = window.scrollY; renderFrameworks(); window.scrollTo(0, y); } }

document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]');
  if (!a || !a.dataset.action.startsWith('cf-')) return;
  const ac = a.dataset.action;
  if (ac === 'cf-mode') { UI.cfMode = a.dataset.m; renderFrameworks(); }
  else if (ac === 'cf-pick' || ac === 'cf-open') { UI.cfSel = a.dataset.id; UI.cfMode = 'map'; renderFrameworks(); if (ac === 'cf-open') window.scrollTo({ top: 0 }); }
  else if (ac === 'cf-toggle') { const m = cfEnsure(UI.cfSel), id = a.dataset.cf; m.ids = m.ids.includes(id) ? m.ids.filter(x => x !== id) : m.ids.concat(id); if (m.ids.length && m.role === 'none') m.role = ''; cfSave(); }
  else if (ac === 'cf-use-sug') { const m = cfEnsure(UI.cfSel); cfSuggested(rec(UI.cfSel)).forEach(h => { if (!m.ids.includes(h.id)) m.ids.push(h.id); }); cfSave(); }
  else if (ac === 'cf-auto-all') {
    let n = 0;
    cfList().forEach(r => { const cur = cfGet(r.id); if (cur && (cur.ids.length || cur.done)) return; const sug = cfSuggested(r); if (!sug.length) return; const m = cfEnsure.call(null, r.id); m.ids = sug.map(h => h.id); n++; });
    cfSave(); toast(n ? `Saran diterapkan pada ${n} studi. Periksa dan tentukan perannya.` : 'Tidak ada studi belum dipetakan yang punya saran.', n ? 'ok' : 'warn');
  }
  else if (ac === 'cf-add') {
    const name = ($('#cfNew').value || '').trim(); if (!name) { $('#cfNew').focus(); return; }
    const terms = ($('#cfNewTerms').value || '').trim() || name;
    const c = { id: 'u' + Date.now().toString(36), name, terms };
    cfCustom().push(c); cfEnsure(UI.cfSel).ids.push(c.id); UI.cfCache = {};
    cfSave(); toast('Ditambahkan ke katalog: ' + name, 'ok');
  }
  else if (ac === 'cf-copy') { const s = cfStore()[UI.cfSel]; s.final = JSON.parse(JSON.stringify(s[a.dataset.from])); s.final.done = false; cfSave(); }
  else if (ac === 'cf-next') {
    const list = cfList(), i = list.findIndex(r => r.id === UI.cfSel);
    const nxt = list.slice(i + 1).concat(list.slice(0, i)).find(r => !(cfGet(r.id) || {}).done);
    touch();
    if (nxt) { UI.cfSel = nxt.id; renderFrameworks(); window.scrollTo({ top: 0, behavior: 'smooth' }); } else { renderFrameworks(); toast('Semua studi sudah dipetakan. Lihat Ringkasan.', 'ok'); }
  }
  else if (ac === 'cf-sumpick') { UI.cfPick = { k: a.dataset.k, v: a.dataset.v }; renderFrameworks(); }
  else if (ac === 'cf-sumclear') { UI.cfPick = null; renderFrameworks(); }
  else if (ac === 'cf-dl') cfExport(a.dataset.fmt);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (!t.closest || !t.closest('#view-frameworks') || !UI.cfSel) return;
  const m = cfEnsure(UI.cfSel);
  if (t.dataset.cfrole !== undefined) { m.role = t.value; if (t.value === 'none') m.ids = []; cfSave(); }
  else if (t.dataset.cfprob) { m.problems = (m.problems || []).filter(x => x !== t.dataset.cfprob).concat(t.checked ? [t.dataset.cfprob] : []); touch(); }
  else if (t.id === 'cfDone') { m.done = t.checked; cfSave(); }
});
const cfQDebounced = debounce((id) => { const y = window.scrollY; renderFrameworks(); window.scrollTo(0, y); const el = $('#' + id); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 200);
document.addEventListener('input', e => {
  const t = e.target;
  if (!t.closest || !t.closest('#view-frameworks')) return;
  if (t.id === 'cfQ') { UI.cfQ = t.value; cfQDebounced('cfQ'); }
  else if (t.id === 'cfCatQ') { UI.cfCatQ = t.value; cfQDebounced('cfCatQ'); }
  else if (t.dataset.cfnote !== undefined && UI.cfSel) { cfEnsure(UI.cfSel).note = t.value; touch(); }
});
