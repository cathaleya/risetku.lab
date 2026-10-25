/* Telaah SLR — penilaian kualitas studi: MMAT 2018 dan daftar periksa JBI */
'use strict';

/* ---------- Daftar butir ---------- */
// [kode, teks Indonesia, teks asli]
const MMAT_SCREEN = [
  ['S1', 'Apakah pertanyaan penelitiannya jelas?', 'Are there clear research questions?'],
  ['S2', 'Apakah data yang dikumpulkan memungkinkan untuk menjawab pertanyaan penelitian?', 'Do the collected data allow to address the research questions?']
];
const MMAT_CATS = {
  1: { label: 'Kualitatif', en: 'Qualitative', items: [
    ['1.1', 'Apakah pendekatan kualitatif tepat untuk menjawab pertanyaan penelitian?', 'Is the qualitative approach appropriate to answer the research question?'],
    ['1.2', 'Apakah metode pengumpulan data kualitatif memadai untuk menjawab pertanyaan penelitian?', 'Are the qualitative data collection methods adequate to address the research question?'],
    ['1.3', 'Apakah temuan diturunkan secara memadai dari data?', 'Are the findings adequately derived from the data?'],
    ['1.4', 'Apakah interpretasi hasil cukup didukung oleh data?', 'Is the interpretation of results sufficiently substantiated by data?'],
    ['1.5', 'Apakah ada koherensi antara sumber, pengumpulan, analisis, dan interpretasi data kualitatif?', 'Is there coherence between qualitative data sources, collection, analysis and interpretation?']] },
  2: { label: 'Kuantitatif – uji acak terkontrol (RCT)', en: 'Quantitative randomized controlled trials', items: [
    ['2.1', 'Apakah randomisasi dilakukan dengan tepat?', 'Is randomization appropriately performed?'],
    ['2.2', 'Apakah kelompok sebanding pada kondisi awal (baseline)?', 'Are the groups comparable at baseline?'],
    ['2.3', 'Apakah data luaran lengkap?', 'Are there complete outcome data?'],
    ['2.4', 'Apakah penilai luaran tidak mengetahui (blinded) intervensi yang diberikan?', 'Are outcome assessors blinded to the intervention provided?'],
    ['2.5', 'Apakah partisipan patuh pada intervensi yang ditetapkan?', 'Did the participants adhere to the assigned intervention?']] },
  3: { label: 'Kuantitatif – non-acak', en: 'Quantitative non-randomized', items: [
    ['3.1', 'Apakah partisipan mewakili populasi sasaran?', 'Are the participants representative of the target population?'],
    ['3.2', 'Apakah pengukuran tepat, baik untuk luaran maupun intervensi (atau paparan)?', 'Are measurements appropriate regarding both the outcome and intervention (or exposure)?'],
    ['3.3', 'Apakah data luaran lengkap?', 'Are there complete outcome data?'],
    ['3.4', 'Apakah faktor perancu diperhitungkan dalam desain dan analisis?', 'Are the confounders accounted for in the design and analysis?'],
    ['3.5', 'Selama periode studi, apakah intervensi diberikan (atau paparan terjadi) sesuai rencana?', 'During the study period, is the intervention administered (or exposure occurred) as intended?']] },
  4: { label: 'Kuantitatif – deskriptif', en: 'Quantitative descriptive', items: [
    ['4.1', 'Apakah strategi pengambilan sampel relevan untuk menjawab pertanyaan penelitian?', 'Is the sampling strategy relevant to address the research question?'],
    ['4.2', 'Apakah sampel mewakili populasi sasaran?', 'Is the sample representative of the target population?'],
    ['4.3', 'Apakah pengukurannya tepat?', 'Are the measurements appropriate?'],
    ['4.4', 'Apakah risiko bias karena tidak merespons (nonresponse bias) rendah?', 'Is the risk of nonresponse bias low?'],
    ['4.5', 'Apakah analisis statistik tepat untuk menjawab pertanyaan penelitian?', 'Is the statistical analysis appropriate to answer the research question?']] },
  5: { label: 'Metode campuran (mixed methods)', en: 'Mixed methods', items: [
    ['5.1', 'Apakah ada alasan yang memadai untuk memakai desain metode campuran?', 'Is there an adequate rationale for using a mixed methods design to address the research question?'],
    ['5.2', 'Apakah komponen-komponen studi diintegrasikan secara efektif untuk menjawab pertanyaan penelitian?', 'Are the different components of the study effectively integrated to answer the research question?'],
    ['5.3', 'Apakah hasil integrasi komponen kualitatif dan kuantitatif diinterpretasikan secara memadai?', 'Are the outputs of the integration of qualitative and quantitative components adequately interpreted?'],
    ['5.4', 'Apakah perbedaan dan ketidakkonsistenan antara hasil kuantitatif dan kualitatif dibahas secara memadai?', 'Are divergences and inconsistencies between quantitative and qualitative results adequately addressed?'],
    ['5.5', 'Apakah setiap komponen studi memenuhi kriteria kualitas tradisi metode masing-masing?', 'Do the different components of the study adhere to the quality criteria of each tradition of the methods involved?']] }
};

const JBI_TOOLS = {
  'jbi-cs': { label: 'JBI – Analitik potong lintang (cross-sectional)', short: 'JBI-CS', items: [
    'Apakah kriteria inklusi sampel didefinisikan dengan jelas?|Were the criteria for inclusion in the sample clearly defined?',
    'Apakah subjek dan latar penelitian dijelaskan secara rinci?|Were the study subjects and the setting described in detail?',
    'Apakah paparan diukur dengan cara yang valid dan reliabel?|Was the exposure measured in a valid and reliable way?',
    'Apakah kriteria objektif dan standar dipakai untuk mengukur kondisi?|Were objective, standard criteria used for measurement of the condition?',
    'Apakah faktor perancu diidentifikasi?|Were confounding factors identified?',
    'Apakah strategi untuk menangani faktor perancu dinyatakan?|Were strategies to deal with confounding factors stated?',
    'Apakah luaran diukur dengan cara yang valid dan reliabel?|Were the outcomes measured in a valid and reliable way?',
    'Apakah analisis statistik yang dipakai tepat?|Was appropriate statistical analysis used?'] },
  'jbi-qual': { label: 'JBI – Penelitian kualitatif', short: 'JBI-Qual', items: [
    'Apakah ada kesesuaian antara perspektif filosofis yang dinyatakan dan metodologi penelitian?|Is there congruity between the stated philosophical perspective and the research methodology?',
    'Apakah ada kesesuaian antara metodologi dan pertanyaan atau tujuan penelitian?|Is there congruity between the research methodology and the research question or objectives?',
    'Apakah ada kesesuaian antara metodologi dan metode pengumpulan data?|Is there congruity between the research methodology and the methods used to collect data?',
    'Apakah ada kesesuaian antara metodologi dan penyajian serta analisis data?|Is there congruity between the research methodology and the representation and analysis of data?',
    'Apakah ada kesesuaian antara metodologi dan interpretasi hasil?|Is there congruity between the research methodology and the interpretation of results?',
    'Apakah ada pernyataan yang menempatkan posisi peneliti secara budaya atau teoretis?|Is there a statement locating the researcher culturally or theoretically?',
    'Apakah pengaruh peneliti terhadap penelitian, dan sebaliknya, dibahas?|Is the influence of the researcher on the research, and vice-versa, addressed?',
    'Apakah partisipan dan suara mereka terwakili secara memadai?|Are participants, and their voices, adequately represented?',
    'Apakah penelitian etis menurut kriteria terkini, atau ada bukti persetujuan etik dari lembaga yang berwenang?|Is the research ethical according to current criteria or, for recent studies, is there evidence of ethical approval by an appropriate body?',
    'Apakah kesimpulan mengalir dari analisis atau interpretasi data?|Do the conclusions drawn in the research report flow from the analysis, or interpretation, of the data?'] },
  'jbi-quasi': { label: 'JBI – Kuasi-eksperimen', short: 'JBI-Quasi', items: [
    'Apakah jelas mana "sebab" dan mana "akibat" (tidak ada kerancuan variabel mana yang lebih dulu)?|Is it clear in the study what is the \'cause\' and what is the \'effect\'?',
    'Apakah partisipan dalam perbandingan serupa?|Were the participants included in any comparisons similar?',
    'Apakah partisipan dalam perbandingan menerima perlakuan serupa selain paparan/intervensi yang diteliti?|Were the participants included in any comparisons receiving similar treatment/care, other than the exposure or intervention of interest?',
    'Apakah ada kelompok kontrol?|Was there a control group?',
    'Apakah ada beberapa kali pengukuran luaran sebelum dan sesudah intervensi/paparan?|Were there multiple measurements of the outcome both pre and post the intervention/exposure?',
    'Apakah tindak lanjut lengkap; bila tidak, apakah perbedaan antar-kelompok dijelaskan dan dianalisis secara memadai?|Was follow up complete and if not, were differences between groups in terms of their follow up adequately described and analyzed?',
    'Apakah luaran partisipan dalam perbandingan diukur dengan cara yang sama?|Were the outcomes of participants included in any comparisons measured in the same way?',
    'Apakah luaran diukur dengan cara yang reliabel?|Were outcomes measured in a reliable way?',
    'Apakah analisis statistik yang dipakai tepat?|Was appropriate statistical analysis used?'] },
  'jbi-rct': { label: 'JBI – Uji acak terkontrol (RCT)', short: 'JBI-RCT', items: [
    'Apakah randomisasi sejati dipakai untuk menempatkan partisipan ke kelompok perlakuan?|Was true randomization used for assignment of participants to treatment groups?',
    'Apakah alokasi ke kelompok perlakuan disembunyikan?|Was allocation to treatment groups concealed?',
    'Apakah kelompok perlakuan serupa pada kondisi awal?|Were treatment groups similar at the baseline?',
    'Apakah partisipan tidak mengetahui (blind) penempatan perlakuan?|Were participants blind to treatment assignment?',
    'Apakah pemberi perlakuan tidak mengetahui penempatan perlakuan?|Were those delivering treatment blind to treatment assignment?',
    'Apakah penilai luaran tidak mengetahui penempatan perlakuan?|Were outcomes assessors blind to treatment assignment?',
    'Apakah kelompok diperlakukan sama selain intervensi yang diteliti?|Were treatment groups treated identically other than the intervention of interest?',
    'Apakah tindak lanjut lengkap; bila tidak, apakah perbedaan antar-kelompok dijelaskan dan dianalisis secara memadai?|Was follow up complete and if not, were differences between groups in terms of their follow up adequately described and analyzed?',
    'Apakah partisipan dianalisis dalam kelompok tempat mereka diacak?|Were participants analyzed in the groups to which they were randomized?',
    'Apakah luaran diukur dengan cara yang sama untuk semua kelompok?|Were outcomes measured in the same way for treatment groups?',
    'Apakah luaran diukur dengan cara yang reliabel?|Were outcomes measured in a reliable way?',
    'Apakah analisis statistik yang dipakai tepat?|Was appropriate statistical analysis used?',
    'Apakah desain uji tepat, dan setiap penyimpangan dari desain RCT standar diperhitungkan dalam pelaksanaan dan analisis?|Was the trial design appropriate, and any deviations from the standard RCT design accounted for in the conduct and analysis of the trial?'] },
  'jbi-cohort': { label: 'JBI – Kohort', short: 'JBI-Cohort', items: [
    'Apakah kedua kelompok serupa dan direkrut dari populasi yang sama?|Were the two groups similar and recruited from the same population?',
    'Apakah paparan diukur dengan cara serupa untuk menempatkan orang ke kelompok terpapar dan tidak terpapar?|Were the exposures measured similarly to assign people to both exposed and unexposed groups?',
    'Apakah paparan diukur dengan cara yang valid dan reliabel?|Was the exposure measured in a valid and reliable way?',
    'Apakah faktor perancu diidentifikasi?|Were confounding factors identified?',
    'Apakah strategi untuk menangani faktor perancu dinyatakan?|Were strategies to deal with confounding factors stated?',
    'Apakah kelompok/partisipan bebas dari luaran pada awal studi (atau saat paparan)?|Were the groups/participants free of the outcome at the start of the study (or at the moment of exposure)?',
    'Apakah luaran diukur dengan cara yang valid dan reliabel?|Were the outcomes measured in a valid and reliable way?',
    'Apakah waktu tindak lanjut dilaporkan dan cukup panjang agar luaran dapat terjadi?|Was the follow up time reported and sufficient to be long enough for outcomes to occur?',
    'Apakah tindak lanjut lengkap; bila tidak, apakah alasan kehilangan partisipan dijelaskan dan ditelusuri?|Was follow up complete, and if not, were the reasons to loss to follow up described and explored?',
    'Apakah strategi untuk menangani tindak lanjut yang tidak lengkap dipakai?|Were strategies to address incomplete follow up utilized?',
    'Apakah analisis statistik yang dipakai tepat?|Was appropriate statistical analysis used?'] },
  'jbi-cc': { label: 'JBI – Kasus-kontrol', short: 'JBI-CC', items: [
    'Apakah kelompok sebanding selain ada/tidaknya penyakit pada kasus dan kontrol?|Were the groups comparable other than the presence of disease in cases or the absence of disease in controls?',
    'Apakah kasus dan kontrol dipasangkan dengan tepat?|Were cases and controls matched appropriately?',
    'Apakah kriteria yang sama dipakai untuk mengidentifikasi kasus dan kontrol?|Were the same criteria used for identification of cases and controls?',
    'Apakah paparan diukur dengan cara yang standar, valid, dan reliabel?|Was exposure measured in a standard, valid and reliable way?',
    'Apakah paparan diukur dengan cara yang sama untuk kasus dan kontrol?|Was exposure measured in the same way for cases and controls?',
    'Apakah faktor perancu diidentifikasi?|Were confounding factors identified?',
    'Apakah strategi untuk menangani faktor perancu dinyatakan?|Were strategies to deal with confounding factors stated?',
    'Apakah luaran dinilai dengan cara yang standar, valid, dan reliabel untuk kasus dan kontrol?|Were outcomes assessed in a standard, valid and reliable way for cases and controls?',
    'Apakah periode paparan yang diteliti cukup panjang agar bermakna?|Was the exposure period of interest long enough to be meaningful?',
    'Apakah analisis statistik yang dipakai tepat?|Was appropriate statistical analysis used?'] },
  'jbi-prev': { label: 'JBI – Studi prevalensi', short: 'JBI-Prev', items: [
    'Apakah kerangka sampel tepat untuk menjangkau populasi sasaran?|Was the sample frame appropriate to address the target population?',
    'Apakah partisipan diambil sampelnya dengan cara yang tepat?|Were study participants sampled in an appropriate way?',
    'Apakah ukuran sampel memadai?|Was the sample size adequate?',
    'Apakah subjek dan latar penelitian dijelaskan secara rinci?|Were the study subjects and the setting described in detail?',
    'Apakah analisis data mencakup sampel yang teridentifikasi secara memadai?|Was the data analysis conducted with sufficient coverage of the identified sample?',
    'Apakah metode yang valid dipakai untuk mengidentifikasi kondisi?|Were valid methods used for the identification of the condition?',
    'Apakah kondisi diukur dengan cara yang standar dan reliabel untuk semua partisipan?|Was the condition measured in a standard, reliable way for all participants?',
    'Apakah analisis statistiknya tepat?|Was there appropriate statistical analysis?',
    'Apakah tingkat respons memadai; bila rendah, apakah ditangani dengan tepat?|Was the response rate adequate, and if not, was the low response rate managed appropriately?'] },
  'jbi-sr': { label: 'JBI – Tinjauan sistematis & sintesis riset', short: 'JBI-SR', items: [
    'Apakah pertanyaan tinjauan dinyatakan dengan jelas dan eksplisit?|Is the review question clearly and explicitly stated?',
    'Apakah kriteria inklusi tepat untuk pertanyaan tinjauan?|Were the inclusion criteria appropriate for the review question?',
    'Apakah strategi penelusuran tepat?|Was the search strategy appropriate?',
    'Apakah sumber dan basis data yang ditelusuri memadai?|Were the sources and resources used to search for studies adequate?',
    'Apakah kriteria penilaian studi tepat?|Were the criteria for appraising studies appropriate?',
    'Apakah penilaian kritis dilakukan oleh dua reviewer atau lebih secara independen?|Was critical appraisal conducted by two or more reviewers independently?',
    'Apakah ada metode untuk meminimalkan kesalahan ekstraksi data?|Were there methods to minimize errors in data extraction?',
    'Apakah metode penggabungan studi tepat?|Were the methods used to combine studies appropriate?',
    'Apakah kemungkinan bias publikasi dinilai?|Was the likelihood of publication bias assessed?',
    'Apakah rekomendasi kebijakan dan/atau praktik didukung data yang dilaporkan?|Were recommendations for policy and/or practice supported by the reported data?',
    'Apakah arahan khusus untuk penelitian lanjutan tepat?|Were the specific directives for new research appropriate?'] },
  'jbi-text': { label: 'JBI – Teks & opini', short: 'JBI-Text', items: [
    'Apakah sumber opini teridentifikasi dengan jelas?|Is the source of the opinion clearly identified?',
    'Apakah sumber opini memiliki kedudukan di bidang keahliannya?|Does the source of opinion have standing in the field of expertise?',
    'Apakah kepentingan populasi terkait menjadi fokus utama opini?|Are the interests of the relevant population the central focus of the opinion?',
    'Apakah posisi yang dinyatakan merupakan hasil proses analitis, dan apakah opininya logis?|Is the stated position the result of an analytical process, and is there logic in the opinion expressed?',
    'Apakah ada rujukan ke literatur yang ada?|Is there reference to the extant literature?',
    'Apakah ketidaksesuaian dengan literatur/sumber dipertahankan secara logis?|Is any incongruence with the literature/sources logically defended?'] }
};
Object.values(JBI_TOOLS).forEach(t => { t.items = t.items.map((s, i) => { const [id, en] = s.split('|'); return ['Q' + (i + 1), id, en]; }); });

const AP_ANS = {
  mmat: [['y', 'Ya'], ['n', 'Tidak'], ['u', 'Tidak dapat ditentukan']],
  jbi: [['y', 'Ya'], ['n', 'Tidak'], ['u', 'Tidak jelas'], ['na', 'Tidak berlaku']]
};
const AP_SYM = { y: '✓', n: '✗', u: '?', na: '–' };
const JBI_OVERALL = [['include', 'Sertakan'], ['exclude', 'Keluarkan'], ['seek', 'Cari info lebih lanjut']];

/* ---------- Data ---------- */
function apStore() { return (S.appraisal = S.appraisal || {}); }
function apRater() { return isSingle() ? 'r1' : UI.as === 'both' ? 'final' : UI.as; }
function apRaterName(k) { return k === 'final' ? 'Konsensus' : revName(k); }
function apGet(rid, rater = apRater()) { const s = apStore()[rid]; return s && s[rater] || null; }
function apEnsure(rid, rater = apRater()) {
  const s = apStore()[rid] = apStore()[rid] || {};
  if (!s[rater]) {
    const sug = apSuggest(rec(rid));
    const main = S.project.apTool || 'mmat';
    s[rater] = main === 'mmat' || !sug.jbi ? { tool: 'mmat', cat: sug.mmat || '', qcomp: sug.qcomp || '', ans: {}, notes: {} } : { tool: sug.jbi, ans: {}, notes: {} };
    s[rater].auto = sug.why || '';
  }
  return s[rater];
}
// Penilaian yang dipakai untuk ringkasan: R1 (mode satu reviewer) atau konsensus
function apFinal(rid) { const s = apStore()[rid]; if (!s) return null; return isSingle() ? s.r1 || null : s.final || null; }

// Butir yang berlaku untuk satu penilaian, dikelompokkan
function apSections(a) {
  if (!a) return [];
  if (a.tool === 'mmat') {
    const sec = [{ title: 'Pertanyaan penyaring (semua jenis studi)', items: MMAT_SCREEN }];
    const c = MMAT_CATS[a.cat];
    if (c) sec.push({ title: a.cat + '. ' + c.label, items: c.items });
    if (a.cat === '5') {
      sec.push({ title: 'Komponen kualitatif (1.1–1.5)', items: MMAT_CATS[1].items });
      const q = MMAT_CATS[a.qcomp];
      if (q && a.qcomp !== '1') sec.push({ title: 'Komponen kuantitatif: ' + q.label, items: q.items });
    }
    return sec;
  }
  const t = JBI_TOOLS[a.tool];
  return t ? [{ title: t.label, items: t.items }] : [];
}
function apItems(a) { return apSections(a).flatMap(s => s.items); }
// Butir inti yang dihitung (MMAT: lima butir kategori; S1/S2 hanya penyaring)
function apCoreItems(a) {
  if (!a) return [];
  if (a.tool === 'mmat') return (MMAT_CATS[a.cat] || { items: [] }).items;
  return (JBI_TOOLS[a.tool] || { items: [] }).items;
}
function apScore(a) {
  const core = apCoreItems(a);
  const applicable = core.filter(([k]) => a.ans[k] !== 'na');
  const yes = applicable.filter(([k]) => a.ans[k] === 'y').length;
  const answered = apItems(a).filter(([k]) => a.ans[k]).length;
  // Skor dari CSV impor dipakai selama butir inti belum dijawab
  if (a.csvScore && !core.some(([k]) => a.ans[k])) return { yes: a.csvScore.yes, of: a.csvScore.of, total: apItems(a).length, answered, csv: true, pct: a.csvScore.of ? Math.round(a.csvScore.yes / a.csvScore.of * 100) : 0 };
  return { yes, of: applicable.length, total: apItems(a).length, answered, pct: applicable.length ? Math.round(yes / applicable.length * 100) : 0 };
}
function apStatus(a) {
  if (!a || !(a.tool === 'mmat' ? a.cat : a.tool)) return 'none';
  if (a.done) return 'done';
  return apScore(a).answered ? 'partial' : 'none';
}
function apToolLabel(a) {
  if (!a) return '—';
  if (a.tool === 'mmat') return a.cat ? 'MMAT ' + a.cat + ' · ' + MMAT_CATS[a.cat].label : 'MMAT (kategori belum dipilih)';
  return (JBI_TOOLS[a.tool] || {}).label || a.tool;
}
function apToolShort(a) { return !a ? '—' : a.tool === 'mmat' ? (a.cat ? 'MMAT ' + a.cat : 'MMAT') : (JBI_TOOLS[a.tool] || {}).short || a.tool; }
function apStars(a) { const s = apScore(a); return a.tool === 'mmat' && s.of ? '★'.repeat(s.yes) + '☆'.repeat(s.of - s.yes) : ''; }

/* ---------- Saran desain studi dari teks ---------- */
const AP_RULES = [
  ['sr', /systematic (literature )?review|scoping review|meta-analy|umbrella review|tinjauan sistematis/gi],
  ['mixed', /mixed[- ]methods?|multi-?method|sequential explanatory|explanatory sequential|exploratory sequential|convergent parallel|metode campuran/gi],
  ['rct', /randomi[sz]ed (controlled )?trial|\bRCTs?\b|randomly assigned/gi],
  ['quasi', /quasi[- ]experiment\w*|non-?randomi[sz]ed|pre-?test[- ]post-?test|one-group pretest/gi],
  ['cohort', /\bcohort\b|longitudinal stud/gi],
  ['cc', /case[- ]control/gi],
  ['qual', /qualitative|semi-structured interview|in-depth interview|focus group|thematic analysis|phenomenolog\w*|grounded theory|ethnograph\w*|narrative inquiry|kualitatif/gi],
  ['prev', /prevalence/gi],
  ['cs', /cross-?sectional|survey|questionnaire|structural equation|PLS-SEM|\bSEM\b|regression|correlational|descriptive (study|design)|kuesioner|angket/gi],
  ['text', /commentary|editorial|opinion piece|position paper|conceptual paper|viewpoint/gi]
];
const AP_MAP = {
  sr: { jbi: 'jbi-sr', mmat: '', label: 'tinjauan sistematis (MMAT tidak berlaku, pakai JBI-SR)' },
  mixed: { jbi: '', mmat: '5', qcomp: '4', label: 'metode campuran' },
  rct: { jbi: 'jbi-rct', mmat: '2', label: 'uji acak terkontrol' },
  quasi: { jbi: 'jbi-quasi', mmat: '3', label: 'kuasi-eksperimen' },
  cohort: { jbi: 'jbi-cohort', mmat: '3', label: 'kohort' },
  cc: { jbi: 'jbi-cc', mmat: '3', label: 'kasus-kontrol' },
  qual: { jbi: 'jbi-qual', mmat: '1', label: 'kualitatif' },
  prev: { jbi: 'jbi-prev', mmat: '4', label: 'prevalensi' },
  cs: { jbi: 'jbi-cs', mmat: '4', label: 'survei / potong lintang' },
  text: { jbi: 'jbi-text', mmat: '', label: 'teks & opini (MMAT tidak berlaku)' }
};
function apSuggest(r) {
  if (!r) return {};
  const ex = Object.values(r.extract && (exFinal(r) || r.extract.r1) || {}).join(' ');
  const pages = (UI.textCache[r.id] || []).slice(0, 3).join(' ');
  const t = [r.title, r.abstract, r.keywords, ex, pages].join('\n').slice(0, 60000);
  const hits = AP_RULES.map(([k, re]) => [k, (t.match(re) || []).length, (t.match(re) || [])[0]]).filter(x => x[1]);
  if (!hits.length) return {};
  const n = k => (hits.find(h => h[0] === k) || [0, 0])[1];
  // mixed methods menang bila disebut; RCT/kuasi menang atas survei; kualitatif vs survei: yang lebih sering
  let k;
  if (n('sr') >= 2 && n('sr') >= n('qual')) k = 'sr';
  else if (n('mixed')) k = 'mixed';
  else if (n('rct')) k = 'rct';
  else if (n('quasi')) k = 'quasi';
  else if (n('cc')) k = 'cc';
  else if (n('cohort') >= 2) k = 'cohort';
  else if (n('qual') && n('qual') >= n('cs')) k = 'qual';
  else if (n('prev') >= 2) k = 'prev';
  else if (n('cs')) k = 'cs';
  else k = hits.sort((a, b) => b[1] - a[1])[0][0];
  const h = hits.find(x => x[0] === k) || hits[0];
  return Object.assign({ key: k, why: AP_MAP[k].label + ' · kata "' + h[2] + '" ' + h[1] + '×' }, AP_MAP[k]);
}

/* ---------- Tampilan ---------- */
function apList() { return S.records.filter(inExtraction); }

function renderQuality() {
  const el = $('#view-quality');
  const list = apList();
  const rater = apRater();
  const mode = UI.apMode || 'form';
  if (!UI.apSel || !list.some(r => r.id === UI.apSel)) UI.apSel = (list.find(r => apStatus(apGet(r.id)) !== 'done') || list[0] || {}).id;
  const done = list.filter(r => apStatus(apFinal(r.id)) === 'done').length;
  const keep = $('#apReader');
  const keepY = keep ? (keep.querySelector('.apr-body') || {}).scrollTop || 0 : 0; // posisi baca hilang saat node dilepas
  const readerOn = mode === 'form' && apReaderOn() && list.length;
  el.innerHTML = `<div class="page ap-page ${readerOn ? 'has-reader' : ''}">
    <div class="page-head"><div>
      <p class="eyebrow">Penilaian kualitas</p>
      <h1>MMAT &amp; JBI</h1>
      <p class="lede">Nilai kualitas metodologis setiap studi yang lolos teks lengkap. Jenis desain disarankan otomatis dari judul, abstrak, isian ekstraksi, dan halaman awal PDF. Penilai: <b>${esc(apRaterName(rater))}</b>.</p>
    </div>
    <div class="btn-row">
      <div class="seg" role="tablist" aria-label="Tampilan">${[['form', 'Formulir'], ['sum', 'Ringkasan']].map(([k, l]) => `<button role="tab" aria-selected="${mode === k}" class="${mode === k ? 'on' : ''}" data-action="ap-mode" data-m="${k}">${l}</button>`).join('')}</div>
    </div></div>
    <section class="card ap-settings">
      <div class="ap-set-row">
        <span><b>Alat utama</b></span>
        <div class="seg sm">${[['mmat', 'MMAT 2018'], ['jbi', 'JBI']].map(([k, l]) => `<button class="${(S.project.apTool || 'mmat') === k ? 'on' : ''}" data-action="ap-tool-main" data-t="${k}">${l}</button>`).join('')}</div>
        <span class="muted small">${(S.project.apTool || 'mmat') === 'mmat' ? 'MMAT menilai studi kualitatif, kuantitatif, dan metode campuran dengan satu alat (5 butir per kategori).' : 'JBI memakai daftar periksa terpisah per desain studi. Desain yang terdeteksi memilih daftar periksanya.'} Alat tiap studi tetap bisa diganti.</span>
        <span class="ap-prog"><b>${done}</b>/${list.length} selesai</span>
      </div>
    </section>
    ${list.length ? `<section class="card ap-dl-card"><h2>Unduh hasil penilaian</h2><p class="hint">Excel berisi tiga lembar: Ringkasan (tabel per kategori/daftar periksa, siap untuk naskah), Rincian per butir (jawaban, bukti, komentar), dan Daftar butir (keterangan kode + rujukan). CSV berisi rincian per butir.</p>${apDownloads()}</section>` : ''}
    ${!list.length ? `<section class="card"><p class="empty">Belum ada studi inklusi. Studi muncul di sini setelah diputuskan <b>Include</b> pada tahap Teks lengkap.${!isSingle() ? ' Proyek ini memakai dua reviewer: keputusan teks lengkap perlu disepakati dulu, atau aktifkan "Satu reviewer saja" di Proyek &amp; Kriteria bila Anda bekerja sendiri.' : ''}</p></section>` : mode === 'sum' ? apSummary(list) : apFormView(list)}
  </div>`;
  if (readerOn) apReaderMount(keep, keepY);
  if (mode === 'form' && UI.apSel) apEvEnsure(rec(UI.apSel));
}

function apFormView(list) {
  const r = rec(UI.apSel);
  const a = r ? apEnsure(r.id) : null;
  const sug = r ? apSuggest(r) : {};
  const ans = a && AP_ANS[a.tool === 'mmat' ? 'mmat' : 'jbi'];
  const sc = a ? apScore(a) : null;
  const screenFail = a && a.tool === 'mmat' && ['n', 'u'].some(v => a.ans.S1 === v || a.ans.S2 === v);
  const toolOpts = `<optgroup label="MMAT 2018">${opt('mmat', 'MMAT – Mixed Methods Appraisal Tool', a && a.tool)}</optgroup><optgroup label="JBI Critical Appraisal">${Object.entries(JBI_TOOLS).map(([k, t]) => opt(k, t.label, a && a.tool)).join('')}</optgroup>`;
  const sugText = sug.key ? ((a.tool === 'mmat' ? sug.mmat : sug.jbi) ? `${a.tool === 'mmat' ? 'MMAT ' + sug.mmat + ' · ' + MMAT_CATS[sug.mmat].label : JBI_TOOLS[sug.jbi].label}` : '') : '';
  const sugMatches = sug.key && (a.tool === 'mmat' ? a.cat === sug.mmat : a.tool === sug.jbi);
  return `<div class="ap-grid ${apReaderOn() ? 'with-reader' : ''}">
    <aside class="card ap-list" aria-label="Daftar studi">
      ${list.map(x => { const p = apGet(x.id), st = apStatus(p), s = p && apScore(p); return `<button class="ap-item ${x.id === UI.apSel ? 'sel' : ''}" data-action="ap-pick" data-id="${x.id}">
        <span class="ap-dot ap-${st}" aria-hidden="true"></span>
        <span class="ap-it-main"><b>${esc((x.title || '(tanpa judul)').slice(0, 90))}</b><span class="muted small">${esc((x.authors || '').split(/[;,]/)[0])}${x.year ? ' · ' + esc(x.year) : ''} · ${esc(apToolShort(p))}${s && s.answered ? ` · ${s.yes}/${s.of}` : ''}</span></span>
        <span class="sr-only">${{ none: 'belum dinilai', partial: 'sebagian', done: 'selesai' }[st]}</span></button>`; }).join('')}
    </aside>
    ${apReaderOn() ? '<aside class="card ap-reader" id="apReader" aria-label="Pembaca teks lengkap"></aside>' : ''}
    <section class="card ap-form">
      <div class="ap-head">
        <div><h2>${esc(r.title || '(tanpa judul)')}</h2>
          <p class="muted small">${esc(r.authors || '')}${r.year ? ' · ' + esc(r.year) : ''}${r.journal ? ' · ' + esc(r.journal) : ''}</p></div>
        <button class="btn sm ghost" data-action="ap-reader">${apReaderOn() ? 'Tutup pembaca' : '📖 Baca PDF di samping'}</button>
      </div>
      ${sug.key ? `<div class="ap-sug ${sugMatches ? 'ok' : ''}"><span><b>Desain terdeteksi:</b> ${esc(sug.why)}.${sugText && !sugMatches ? ` Saran: <b>${esc(sugText)}</b>.` : sugMatches ? ' Sudah sesuai pilihan di bawah.' : ''}</span>${sugText && !sugMatches ? `<button class="btn sm" data-action="ap-use-sug">Pakai saran</button>` : ''}</div>` : `<div class="ap-sug"><span>Desain studi tidak terdeteksi dari teks. Pilih alat dan kategori secara manual.</span></div>`}
      <div class="ap-tool-row">
        <label class="fld"><span>Alat penilaian</span><select id="apTool" data-ap="tool">${toolOpts}</select></label>
        ${a.tool === 'mmat' ? `<label class="fld"><span>Kategori desain studi (MMAT)</span><select id="apCat" data-ap="cat">${opt('', 'Pilih kategori…', a.cat)}${Object.entries(MMAT_CATS).map(([k, c]) => opt(k, k + '. ' + c.label, a.cat)).join('')}</select></label>` : ''}
        ${a.tool === 'mmat' && a.cat === '5' ? `<label class="fld"><span>Komponen kuantitatif</span><select id="apQ" data-ap="qcomp">${['2', '3', '4'].map(k => opt(k, k + '. ' + MMAT_CATS[k].label, a.qcomp || '4')).join('')}</select></label>` : ''}
      </div>
      ${apSections(a).map((sec, si) => `<fieldset class="ap-sec"><legend>${esc(sec.title)}</legend>
        ${sec.items.map(([k, idT, en]) => { const key = k; const nm = 'ap-' + si + '-' + k; return `<div class="ap-q ${a.ans[key] ? 'ans-' + a.ans[key] : ''}">
          <div class="ap-qtext"><span class="ap-code ${apEvOn() && AP_EV[k] ? 'ev-code hl-c' + apEvColor(a, k) : ''}">${esc(k)}</span><span><span>${esc(idT)}</span><span class="ap-en" lang="en">${esc(en)}</span></span></div>
          <div class="ap-opts" role="radiogroup" aria-label="${esc(k)}">${ans.map(([v, l]) => `<label class="ap-opt o-${v}"><input type="radio" name="${nm}" data-apq="${esc(key)}" value="${v}" ${a.ans[key] === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
          <div class="ev-slot" data-evq="${esc(key)}">${apEvSlot(a, key)}</div>
          <input type="text" class="ap-note" data-apn="${esc(key)}" value="${esc(a.notes[key] || '')}" placeholder="Bukti/catatan (opsional), mis. kutipan atau halaman" aria-label="Catatan ${esc(k)}">
        </div>`; }).join('')}</fieldset>`).join('') || '<p class="empty">Pilih kategori desain studi untuk menampilkan butir penilaian.</p>'}
      ${screenFail ? `<div class="cbanner conf"><span>Pertanyaan penyaring S1/S2 dijawab "Tidak" atau "Tidak dapat ditentukan". Menurut MMAT, studi ini mungkin bukan studi empiris dan penilaian lanjutan bisa tidak layak.</span></div>` : ''}
      <div class="ap-foot">
        ${sc && sc.of ? `<div class="ap-score"><b>${sc.yes}/${sc.of}</b> kriteria inti terpenuhi (${sc.pct}%)${sc.csv ? ' <span class="pill">skor dari CSV</span>' : ''} ${apStars(a) ? `<span class="ap-stars" aria-hidden="true">${apStars(a)}</span>` : ''}
          <span class="muted small">${a.tool === 'mmat' ? 'MMAT 2018 tidak menganjurkan skor tunggal; laporkan rincian tiap butir (lihat Ringkasan).' : 'JBI menganjurkan keputusan keseluruhan, bukan skor saja.'}</span></div>` : ''}
        ${a.tool !== 'mmat' ? `<div class="fld"><span>Penilaian keseluruhan (JBI)</span><div class="seg sm">${JBI_OVERALL.map(([k, l]) => `<button class="${a.overall === k ? 'on' : ''}" data-action="ap-overall" data-v="${k}">${l}</button>`).join('')}</div></div>` : ''}
        <label class="fld"><span>Komentar penilai</span><textarea id="apComment" data-ap="comment" rows="2">${esc(a.comment || '')}</textarea></label>
        <div class="btn-row">
          <label class="check"><input type="checkbox" id="apDone" ${a.done ? 'checked' : ''}> <span><b>Penilaian selesai</b>${sc && sc.answered < sc.total ? ` <span class="muted small">(${sc.total - sc.answered} butir belum dijawab)</span>` : ''}</span></label>
          <button class="btn" data-action="ap-next">Simpan &amp; berikutnya</button>
          ${!isSingle() && UI.as === 'both' && apStore()[r.id] && (apStore()[r.id].r1 || apStore()[r.id].r2) ? `<button class="btn ghost" data-action="ap-copy" data-from="${apStore()[r.id].r1 ? 'r1' : 'r2'}">Salin dari ${esc(revName(apStore()[r.id].r1 ? 'r1' : 'r2'))}</button>` : ''}
        </div>
      </div>
    </section>
  </div>`;
}

function apSummary(list) {
  const rows = list.map(r => ({ r, a: apFinal(r.id) })).filter(x => x.a && (x.a.tool === 'mmat' ? x.a.cat : x.a.tool));
  const missing = list.length - rows.length;
  const groups = {};
  rows.forEach(x => { const k = x.a.tool === 'mmat' ? 'mmat-' + x.a.cat : x.a.tool; (groups[k] = groups[k] || []).push(x); });
  const order = Object.keys(groups).sort();
  const cell = v => `<td class="ap-cell c-${v || 'x'}" title="${v ? { y: 'Ya', n: 'Tidak', u: 'Tidak jelas / tidak dapat ditentukan', na: 'Tidak berlaku' }[v] : 'belum dijawab'}">${v ? AP_SYM[v] : ''}</td>`;
  return `<section class="card">
    <div class="card-head"><div><h2>Ringkasan penilaian (${rows.length} studi)</h2>
      <p class="hint">Dari penilaian ${isSingle() ? 'Reviewer 1' : 'konsensus'}. Tabel per alat dan kategori, siap disalin ke naskah sebagai tabel penilaian kualitas.${missing ? ` <span class="txt-conf">${missing} studi belum dinilai.</span>` : ''}</p></div>
      <span class="ap-legend"><span class="ap-cell c-y">✓</span> Ya <span class="ap-cell c-n">✗</span> Tidak <span class="ap-cell c-u">?</span> Tidak jelas <span class="ap-cell c-na">–</span> Tidak berlaku</span></div>
    ${order.map(k => {
      const g = groups[k], a0 = g[0].a;
      const items = apItems(a0).filter(([c]) => a0.tool !== 'mmat' || !/^1\./.test(c) || a0.cat === '1' || a0.cat === '5');
      const isMixed = a0.tool === 'mmat' && a0.cat === '5';
      const cols = isMixed ? [...MMAT_SCREEN, ...MMAT_CATS[5].items] : items;
      return `<h3 class="ap-gtitle">${esc(apToolLabel(a0))} <span class="muted">· ${g.length} studi</span></h3>
      <div class="table-wrap"><table class="tbl ap-tbl"><thead><tr><th>Studi</th>${cols.map(([c, idT]) => `<th class="ap-th" title="${esc(idT)}">${esc(c)}</th>`).join('')}<th class="num">Ya</th>${a0.tool === 'mmat' ? '' : '<th>Keseluruhan</th>'}<th>Status</th></tr></thead>
      <tbody>${g.map(({ r, a }) => { const s = apScore(a); return `<tr><td class="rep-study"><button class="link" data-action="ap-open" data-id="${r.id}">${esc((r.authors || '').split(/[;,]/)[0] || r.title.slice(0, 40))}${r.year ? ' (' + esc(r.year) + ')' : ''}</button><span class="muted small">${esc(r.title.slice(0, 90))}</span></td>
        ${cols.map(([c]) => cell(a.ans[c])).join('')}<td class="num"><b>${s.yes}</b>/${s.of}</td>${a0.tool === 'mmat' ? '' : `<td>${a.overall ? `<span class="pill ${{ include: 'ok', exclude: 'no', seek: 'warn' }[a.overall]}">${JBI_OVERALL.find(o => o[0] === a.overall)[1]}</span>` : '—'}</td>`}
        <td>${a.done ? '<span class="pill ok">Selesai</span>' : '<span class="pill">Draf</span>'}</td></tr>`; }).join('')}</tbody></table></div>
      ${isMixed ? '<p class="muted small">Untuk metode campuran, butir komponen kualitatif dan kuantitatif tetap tersimpan dan ikut di CSV.</p>' : ''}`;
    }).join('') || '<p class="empty">Belum ada penilaian. Isi di tampilan Formulir.</p>'}
  </section>
  <section class="card"><h2>Rujukan alat</h2>
    <ul class="small ap-refs"><li>Hong, Q. N., Pluye, P., Fàbregues, S., dkk. (2018). <i>Mixed Methods Appraisal Tool (MMAT), version 2018</i>. Registration of Copyright #1148552, Canadian Intellectual Property Office.</li>
    <li>JBI. <i>Critical Appraisal Tools</i>. Adelaide: JBI. Tersedia di jbi.global/critical-appraisal-tools. Butir di aplikasi ini disertai terjemahan Indonesia; rujuk versi resmi saat melaporkan.</li></ul></section>`;
}

const AP_LABEL = { y: 'Ya', n: 'Tidak', u: 'Tidak jelas', na: 'Tidak berlaku' };
const AP_FAMILY = { mmat: 'MMAT 2018', jbi: 'JBI' };
function apFamily(a) { return a && a.tool === 'mmat' ? 'mmat' : 'jbi'; }
function apReady(a) { return !!(a && (a.tool === 'mmat' ? a.cat : a.tool)); }
// Studi yang dinilai dengan satu keluarga alat (penilaian final: R1 atau konsensus)
function apRowsOf(fam) { return apList().map(r => ({ r, a: apFinal(r.id) })).filter(x => apReady(x.a) && apFamily(x.a) === fam); }
function apStudyId(r) { const f = S.fields.find(x => x.id === 'study_id'); const e = r.extract && exFinal(r); return (f && e && e[f.id]) || ''; }
function apCite(r) { return ((r.authors || '').split(/[;,]/)[0] || '').trim() + (r.year ? ' (' + r.year + ')' : ''); }

// Rincian per butir (semua penilai yang ada)
function apDetailRows(fam) {
  const head = ['study_id', 'studi', 'judul', 'penilai', 'alat', 'kategori/daftar periksa', 'butir', 'pertanyaan', 'question (asli)', 'jawaban', 'bukti/catatan', 'ya', 'butir_inti', 'persen'].concat(fam === 'jbi' ? ['keseluruhan'] : []).concat(['komentar', 'selesai']);
  const out = [head];
  apList().forEach(r => {
    const s = apStore()[r.id] || {};
    ['r1', 'r2', 'final'].filter(k => apReady(s[k]) && apFamily(s[k]) === fam && (!isSingle() || k === 'r1')).forEach(k => {
      const a = s[k], sc = apScore(a);
      apItems(a).forEach(([c, idT, en]) => out.push([apStudyId(r), apCite(r), r.title, apRaterName(k), apToolShort(a), apToolLabel(a), c, idT, en, AP_LABEL[a.ans[c]] || '', a.notes[c] || '', sc.yes, sc.of, sc.pct + '%']
        .concat(fam === 'jbi' ? [(JBI_OVERALL.find(o => o[0] === a.overall) || ['', ''])[1]] : []).concat([a.comment || '', a.done ? 'ya' : 'draf'])));
    });
  });
  return out;
}

// Ringkasan: satu tabel per kategori MMAT / daftar periksa JBI, baris = studi, kolom = butir
function apSummaryRows(fam) {
  const rows = apRowsOf(fam);
  const groups = {};
  rows.forEach(x => { const k = fam === 'mmat' ? 'mmat-' + x.a.cat : x.a.tool; (groups[k] = groups[k] || []).push(x); });
  const out = [[AP_FAMILY[fam] + ' — ' + (S.project.title || 'Telaah SLR')], ['Penilai: ' + (isSingle() ? revName('r1') : 'Konsensus') + ' · diunduh ' + today()], []];
  Object.keys(groups).sort().forEach(k => {
    const g = groups[k], a0 = g[0].a;
    const cols = fam === 'mmat' ? [...MMAT_SCREEN, ...MMAT_CATS[a0.cat].items] : JBI_TOOLS[a0.tool].items;
    out.push([apToolLabel(a0) + ' (' + g.length + ' studi)']);
    out.push(['Studi', 'Judul'].concat(cols.map(c => c[0]), ['Ya', 'Butir inti', '%'], fam === 'jbi' ? ['Keseluruhan'] : [], ['Status']));
    g.forEach(({ r, a }) => { const sc = apScore(a); out.push([apCite(r), r.title].concat(cols.map(([c]) => AP_LABEL[a.ans[c]] || ''), [sc.yes, sc.of, sc.pct + '%'], fam === 'jbi' ? [(JBI_OVERALL.find(o => o[0] === a.overall) || ['', ''])[1]] : [], [a.done ? 'Selesai' : 'Draf'])); });
    out.push([]);
  });
  return out;
}

// Daftar butir yang dipakai (kode → pertanyaan), untuk keterangan tabel di naskah
function apItemRows(fam) {
  const out = [['Kode', 'Pertanyaan (terjemahan)', 'Question (asli)', 'Alat']];
  if (fam === 'mmat') {
    MMAT_SCREEN.forEach(([c, i, e]) => out.push([c, i, e, 'MMAT – penyaring']));
    Object.entries(MMAT_CATS).forEach(([k, cat]) => cat.items.forEach(([c, i, e]) => out.push([c, i, e, 'MMAT ' + k + ' – ' + cat.label])));
  } else {
    const used = new Set(apRowsOf('jbi').map(x => x.a.tool));
    Object.entries(JBI_TOOLS).filter(([k]) => used.has(k)).forEach(([, t]) => t.items.forEach(([c, i, e]) => out.push([c, i, e, t.label])));
  }
  out.push([], [fam === 'mmat'
    ? 'Hong, Q. N., Pluye, P., Fàbregues, S., dkk. (2018). Mixed Methods Appraisal Tool (MMAT), version 2018. Canadian Intellectual Property Office, Registration #1148552.'
    : 'JBI. Critical Appraisal Tools. Adelaide: JBI. jbi.global/critical-appraisal-tools']);
  out.push(['Terjemahan Indonesia disediakan aplikasi Telaah SLR; rujuk versi resmi saat melaporkan.']);
  return out;
}

async function apExport(fam, fmt) {
  if (!apRowsOf(fam).length && !apDetailRows(fam).slice(1).length) { toast('Belum ada studi yang dinilai dengan ' + AP_FAMILY[fam] + '.', 'warn'); return; }
  const base = 'penilaian-' + fam + '-' + slug(S.project.title || 'telaah').slice(0, 40);
  if (fmt === 'csv') { downloadText(toCSV(apDetailRows(fam), typeof delim === 'function' ? delim() : ','), base + '.csv', 'text/csv'); return; }
  try {
    toast('Menyiapkan Excel ' + AP_FAMILY[fam] + '…');
    const XLSX = await SettingsIO.loadLib('XLSX');
    const wb = XLSX.utils.book_new();
    const add = (name, aoa, cols) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = cols.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
    add('Ringkasan', apSummaryRows(fam), [22, 50].concat(Array(16).fill(9)));
    add('Rincian per butir', apDetailRows(fam), [12, 22, 40, 14, 10, 30, 7, 50, 50, 14, 40, 5, 9, 8, 14, 30, 8]);
    add('Daftar butir', apItemRows(fam), [8, 70, 70, 34]);
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), base + '.xlsx');
    toast('Excel ' + AP_FAMILY[fam] + ' diunduh: Ringkasan, Rincian per butir, Daftar butir.', 'ok');
  } catch (e) { console.error(e); toast('Gagal membuat Excel: ' + e.message + '. Coba unduh CSV.', 'bad'); }
}

function apDownloads() {
  return `<div class="ap-dl">${['mmat', 'jbi'].map(f => { const n = apRowsOf(f).length; return `<div class="ap-dl-grp"><span><b>Hasil ${AP_FAMILY[f]}</b> <span class="muted small">${n} studi</span></span>
    <button class="btn sm" data-action="ap-dl" data-f="${f}" data-fmt="xlsx" ${n ? '' : 'disabled'}>Unduh Excel</button><button class="btn sm ghost" data-action="ap-dl" data-f="${f}" data-fmt="csv" ${n ? '' : 'disabled'}>CSV</button></div>`; }).join('')}</div>`;
}

/* ---------- Interaksi ---------- */
/* ---------- Pembaca teks lengkap di samping formulir ---------- */
// Pintasan ke bagian naskah yang biasanya menjawab butir MMAT
const AP_JUMPS = [
  ['Tujuan', 'S1', /research questions?|research aims?|aims? (of|for) (this|the) (study|paper|research)|purpose of (this|the) (study|paper|research)|objectives? of (this|the)|this (study|paper) (aims|seeks|investigates|examines|explores)|tujuan penelitian/gi],
  ['Metode', 'desain', /\bmethod(ology|s)?\b|research design|study design|metode penelitian|desain penelitian/gi],
  ['Sampel', 'x.1–x.2', /\bsampl(e|es|ing)\b|participants?|respondents?|populations?|sampel|responden/gi],
  ['Instrumen', 'x.2–x.3', /questionnaires?|instruments?|interviews?|focus groups?|measures?|scales?|kuesioner|wawancara/gi],
  ['Respons', '4.4', /response rate|non-?response|returned|completed (the )?(survey|questionnaire)|tingkat respons/gi],
  ['Analisis', 'x.4–x.5', /data analysis|analy[sz]ed|statistical|SPSS|SmartPLS|AMOS|regression|structural equation|thematic analysis|coding|analisis data/gi],
  ['Integrasi', '5.x', /mixed[- ]methods?|integrat(e|ed|ion)|triangulat\w*|convergent|sequential/gi],
  ['Hasil', '', /\bresults?\b|\bfindings?\b|hasil penelitian|temuan/gi],
  ['Keterbatasan', '', /limitations?|keterbatasan/gi]
];
function apReaderOn() { return UI.apReader !== false; }
function apDocMode(r) { return UI.apDoc === 'pdf' && r.hasPdf ? 'pdf' : UI.apDoc === 'abs' || !r.hasText ? 'abs' : 'txt'; }
async function apReaderMount(old, y) {
  const slot = $('#apReader');
  const r = rec(UI.apSel);
  if (!slot || !r) return;
  const mode = apDocMode(r);
  const lang = mode === 'pdf' ? 'orig' : UI.lang || 'orig';
  const key = r.id + '|' + mode + '|' + lang;
  if (old && old.dataset.key === key) { slot.replaceWith(old); const b = old.querySelector('.apr-body'); if (b) b.scrollTop = y || 0; return; }
  slot.dataset.key = key;
  slot.innerHTML = `<div class="apr-head">
      <div class="seg sm">${[['txt', 'Teks'], ['pdf', 'PDF'], ['abs', 'Abstrak']].map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-action="ap-doc" data-m="${k}" ${(k === 'txt' && !r.hasText) || (k === 'pdf' && !r.hasPdf) ? 'disabled title="PDF belum dilampirkan"' : ''}>${l}</button>`).join('')}</div>
      ${mode !== 'pdf' ? `<div class="seg sm lang-seg" role="group" aria-label="Bahasa baca">${[['orig', 'Asli'], ['bi', 'Dwibahasa'], ['id', 'Indonesia']].map(([k, l]) => `<button class="${lang === k ? 'on' : ''}" data-action="lang" data-lang="${k}" title="${k === 'orig' ? 'Teks asli' : k === 'bi' ? 'Paragraf asli + terjemahan Indonesia di bawahnya' : 'Hanya terjemahan Indonesia'}">${l}</button>`).join('')}</div>` : ''}
      ${mode !== 'pdf' ? `<label class="check sm apr-ev" title="Kalimat yang kemungkinan menjawab butir MMAT diberi warna sesuai kode butirnya di formulir"><input type="checkbox" id="apEvOn" ${apEvOn() ? 'checked' : ''}> <span>Sorot bukti MMAT</span></label>` : ''}
      <span class="muted small">${r.pages ? r.pages + ' hlm.' : ''}</span>
      ${mode === 'txt' && lang === 'orig' ? `<span class="apr-find"><input type="search" id="apFind" placeholder="Cari di teks…" value="${esc(UI.apFind || '')}" aria-label="Cari di teks"><span class="small muted" id="apFindN"></span><button class="icon-btn" data-action="ap-find-step" data-d="-1" aria-label="Hasil sebelumnya">‹</button><button class="icon-btn" data-action="ap-find-step" data-d="1" aria-label="Hasil berikutnya">›</button></span>` : ''}
    </div>
    ${mode === 'txt' && lang === 'orig' ? `<div class="apr-jumps" role="group" aria-label="Lompat ke bagian naskah">${AP_JUMPS.map(([l, c], i) => `<button class="chip-btn ${UI.apJump === i ? 'on' : ''}" data-action="ap-jump" data-i="${i}" ${c ? `title="Membantu butir MMAT ${esc(c)}"` : ''}>${esc(l)}${c ? ` <small>${esc(c)}</small>` : ''}</button>`).join('')}</div>` : ''}
    <div class="apr-body" id="apRBody" tabindex="0"><p class="muted pad">Memuat…</p></div>`;
  const body = $('#apRBody');
  if (lang !== 'orig' && (mode === 'abs' || r.hasText)) {
    const text = mode === 'txt' ? await loadText(r.id) : null;
    if (UI.apSel !== r.id) return;
    if (mode === 'abs' || (text && text.length)) { Tr.job++; Tr.render(body, r, text, mode, lang, { decorate: apEvDecorate }); return; }
  }
  if (mode === 'abs') {
    body.innerHTML = `<article class="doc-text"><h4 class="doc-sub">Abstrak</h4><p>${esc(r.abstract || 'Abstrak tidak tersedia.')}</p></article>
      ${r.hasText ? '' : '<p class="hint pad">Belum ada PDF untuk studi ini. Lampirkan PDF di <b>Skrining &amp; Ekstraksi</b>, atau unggah folder PDF di <b>Impor</b>, supaya teks lengkapnya bisa dibaca di sini.</p>'}`;
    return;
  }
  if (mode === 'txt') { const text = await loadText(r.id); if (UI.apSel !== r.id) return; UI.apText = text || []; apRenderText(); return; }
  apRenderPdf(r, body);
}
/* ---------- Pendeteksi bukti MMAT ---------- */
// Pola kalimat yang biasanya menjawab tiap butir (Inggris + Indonesia). Hanya penanda untuk dibaca, bukan jawaban otomatis.
const AP_EV = {
  S1: /research questions?|\bRQ\s?\d|hypothes[ie]s|aims? (to|of)|purpose of (this|the|our)|objectives? (of|was|is)|this (study|paper|research|article) (aims|seeks|investigates|examines|explores|addresses)|we (aim|investigate|examine|explore)|tujuan penelitian|rumusan masalah/i,
  S2: /data (were|was) (collected|gathered|obtained)|collected (data|responses)|data collection|questionnaires?|surveys?|interviews?|focus groups?|pengumpulan data|kuesioner|wawancara/i,
  '1.1': /qualitative (approach|design|research|study|method|inquiry)|phenomenolog\w*|grounded theory|case study|ethnograph\w*|narrative inquiry|interpretiv\w*|pendekatan kualitatif/i,
  '1.2': /semi-?structured|in-depth interviews?|focus groups?|observations?|field notes|interview (guide|protocol|questions)|saturation|wawancara mendalam/i,
  '1.3': /thematic analysis|themes? (emerged|were identified|were generated)|coding|\bcodes\b|NVivo|ATLAS\.?ti|MAXQDA|Braun (and|&) Clarke|inductive|deductive|analisis tematik/i,
  '1.4': /participants? (said|stated|noted|explained|reported|mentioned)|as one (participant|respondent|student|lecturer)|excerpts?|quotations?|illustrat\w* (by|with) (the following|quotes?)/i,
  '1.5': /trustworthiness|credibility|member check\w*|triangulat\w*|reflexiv\w*|audit trail|dependability|transferability|confirmability|keabsahan data/i,
  '2.1': /randomi[sz](ed|ation)|randomly (assigned|allocated)|random allocation|allocation concealment/i,
  '2.2': /baseline|pre-?test|groups were (comparable|similar|equivalent)|no significant differences? (between|at)/i,
  '2.3': /attrition|drop-?outs?|lost to follow|completed (the )?(study|intervention|post-?test)|missing data|intention[- ]to[- ]treat/i,
  '2.4': /blind(ed|ing)|mask(ed|ing)/i,
  '2.5': /adheren\w*|complian\w*|attendance|fidelity|completed all sessions/i,
  '3.1': /representative|target population|inclusion criteria|recruit(ed|ment)|sampling (frame|method)|convenience sampl\w*|purposive/i,
  '3.2': /validated|validity|reliab\w*|Cronbach|instruments?|scales? (was|were|adapted)|measured (by|using|with)|adapted from/i,
  '3.3': /response rate|attrition|drop-?outs?|missing data|complete (data|responses)|lost to follow/i,
  '3.4': /confound\w*|covariates?|control(led|ling) for|adjust(ed|ing) for|ANCOVA|propensity/i,
  '3.5': /as (intended|planned)|implementation fidelity|fidelity|was (delivered|implemented|administered)|exposure/i,
  '4.1': /sampling (strategy|technique|method|frame|procedure)|random sampling|stratified|convenience sampl\w*|purposive|snowball|sample size|G\*?Power|power analysis|teknik sampling/i,
  '4.2': /representative|target population|generali[sz]\w*|demographic|respondents (were|comprised|consisted)|participants (were|comprised|consisted)/i,
  '4.3': /validated|validity|reliab\w*|Cronbach|composite reliability|AVE|instruments?|Likert|adapted from|pilot (test|study)/i,
  '4.4': /response rate|non-?response|questionnaires? (were )?returned|valid (responses|questionnaires)|usable (responses|questionnaires)|tingkat respons/i,
  '4.5': /SPSS|AMOS|SmartPLS|PLS-SEM|structural equation|regression|ANOVA|t-tests?|chi-square|correlation|descriptive statistics|factor analysis|\bCFA\b|\bEFA\b|Mann|Kruskal|analisis statistik/i,
  '5.1': /mixed[- ]methods?|rationale|both (qualitative|quantitative) and (qualitative|quantitative)|to (complement|triangulate|explain|corroborate)|metode campuran/i,
  '5.2': /integrat(e|ed|ion|ing)|merg(e|ed|ing)|joint display|sequential|convergent|explanatory|exploratory design/i,
  '5.3': /meta-?inferences?|integrated (findings|results)|(qualitative|quantitative) (findings|results) (support|confirm|corroborate|explain|complement)|corroborat\w*/i,
  '5.4': /diverg\w*|discrepan\w*|inconsisten\w*|contradict\w*|in contrast (to|with)/i,
  '5.5': /trustworthiness|credibility|validity|reliab\w*|Cronbach|rigou?r/i
};
function apEvOn() { return UI.apEvOn !== false; }
// Warna mengikuti posisi butir dalam bagiannya (x.1–x.5 = warna 0–4, S1/S2 = warna 5)
function apEvColor(a, code) { if (/^S/.test(code)) return 5; const i = parseInt(String(code).split('.')[1], 10); return i >= 1 ? (i - 1) % 5 : 0; }
function apEvCodes(a) { return apItems(a).map(([k]) => k).filter(k => AP_EV[k]); }
function apEvMatch(t, codes) {
  return codes.map(k => [k, (t.match(new RegExp(AP_EV[k].source, 'gi')) || []).length]).filter(x => x[1]).sort((x, y) => y[1] - x[1]);
}
function apEvSentences(p) { return String(p || '').split(/(?<=[.!?])\s+(?=[A-Z0-9“"(\[])/); }
// Pindai teks lengkap; kalimat di Daftar Pustaka (paruh akhir naskah) tidak dihitung
async function apEvEnsure(r) {
  if (!r || !apEvOn()) return;
  const a = apGet(r.id);
  if (!a || !apReady(a)) return;
  const codes = apEvCodes(a);
  const key = r.id + '|' + codes.join(',');
  if (UI.apEv && UI.apEv.key === key) { apEvFill(); return; }
  const text = r.hasText ? await loadText(r.id) : null;
  if (UI.apSel !== r.id) return;
  const pages = text && text.length ? text : [r.abstract || ''];
  const n = pages.length;
  let refAt = n;
  for (let i = Math.floor(n / 2); i < n; i++) if (/\b(References|REFERENCES|Bibliography|Daftar Pustaka|DAFTAR PUSTAKA)\b/.test(pages[i])) { refAt = i; break; }
  const ev = { key, rid: r.id, codes, pages: [], byQ: {}, best: {} };
  let sid = 0;
  pages.forEach((p, i) => {
    let after = false;
    ev.pages.push(apEvSentences(p).map(t => {
      if (i === refAt && /\b(References|REFERENCES|Bibliography|Daftar Pustaka|DAFTAR PUSTAKA)\b/.test(t)) after = true;
      const off = i > refAt || after;
      const m = off || t.length < 25 ? [] : apEvMatch(t, codes);
      const x = { t, sid: sid++, page: i + 1, codes: m.map(y => y[0]) };
      m.forEach(([k, h]) => {
        (ev.byQ[k] = ev.byQ[k] || []).push(x.sid);
        const sc = h * 10 - Math.abs(t.length - 180) / 40;
        if (!ev.best[k] || sc > ev.best[k].sc) ev.best[k] = { sc, t: t.slice(0, 400), page: i + 1, sid: x.sid };
      });
      return x;
    }));
  });
  UI.apEv = ev;
  UI.apEvPos = {};
  apEvFill();
  // pembaca teks asli digambar ulang dengan sorotan
  const sl = $('#apReader');
  if (sl && apDocMode(r) === 'txt' && (UI.lang || 'orig') === 'orig') apRenderText();
}
function apEvSlot(a, k) {
  const ev = UI.apEv;
  if (!apEvOn() || !AP_EV[k] || !ev || ev.rid !== UI.apSel) return '';
  const n = (ev.byQ[k] || []).length, b = ev.best[k], c = apEvColor(a, k);
  if (!n) return `<span class="ev-none small muted">Tidak ada kalimat yang terdeteksi untuk butir ini. Baca bagian terkait secara manual.</span>`;
  return `<button class="ev-chip" data-action="ap-ev-go" data-q="${esc(k)}" title="Lompat ke kalimat berikutnya di pembaca"><i class="ev-dot hl-c${c}"></i>${n} kalimat terdeteksi ›</button>
    <span class="ev-snip hl-c${c}">“${esc(b.t.length > 220 ? b.t.slice(0, 220) + '…' : b.t)}” <span class="muted">hlm. ${b.page}</span></span>
    <button class="link sm" data-action="ap-ev-use" data-q="${esc(k)}">Tempel sebagai bukti</button>`;
}
function apEvFill() {
  const a = UI.apSel && apGet(UI.apSel);
  if (!a) return;
  document.querySelectorAll('#view-quality .ev-slot[data-evq]').forEach(el => { el.innerHTML = apEvSlot(a, el.dataset.evq); });
}
function apEvPage(ev, i, mark) {
  const a = apGet(ev.rid);
  return (ev.pages[i] || []).map(x => {
    const inner = mark(x.t).replace(/\n/g, '<br>');
    if (!x.codes.length) return inner;
    return `<span class="ev hl-c${apEvColor(a, x.codes[0])}" data-s="${x.sid}" data-q="${x.codes.join(' ')}" title="Bukti untuk butir ${x.codes.join(', ')}"><b class="ev-tag">${x.codes[0]}</b>${inner}</span>`;
  }).join(' ');
}
function apEvDecorate(u) {
  if (!apEvOn() || !UI.apSel) return null;
  const a = apGet(UI.apSel);
  if (!a || !apReady(a)) return null;
  const m = apEvMatch(u, apEvCodes(a));
  if (!m.length) return null;
  const c = apEvColor(a, m[0][0]);
  return { cls: 'ev-unit', attr: `data-q="${m.map(x => x[0]).join(' ')}" style="--evc: var(--cc${c})"`, badge: `<span class="ev-badges">${m.slice(0, 4).map(([k]) => `<i class="hl-c${apEvColor(a, k)}">${esc(k)}</i>`).join('')}</span>` };
}
function apEvGo(q) {
  const body = $('#apRBody');
  const els = body ? [...body.querySelectorAll('[data-q]')].filter(el => el.dataset.q.split(' ').includes(q)) : [];
  if (!els.length) return false;
  UI.apEvPos = UI.apEvPos || {};
  const i = UI.apEvPos[q] = ((UI.apEvPos[q] ?? -1) + 1) % els.length;
  body.querySelectorAll('.ev-cur').forEach(el => el.classList.remove('ev-cur'));
  const el = els[i];
  el.classList.add('ev-cur');
  body.scrollTop += el.getBoundingClientRect().top - body.getBoundingClientRect().top - 80;
  return true;
}

function apReaderRefresh() { const sl = $('#apReader'); if (sl) sl.dataset.key = ''; renderQualityKeepScroll(); }
function apFindRe() {
  if (UI.apJump != null && AP_JUMPS[UI.apJump]) return new RegExp(AP_JUMPS[UI.apJump][2].source, 'gi');
  const q = (UI.apFind || '').trim();
  return q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'gi') : null;
}
function apRenderText() {
  const body = $('#apRBody');
  if (!body) return;
  const re = apFindRe(), pages = UI.apText || [];
  if (!pages.length) { body.innerHTML = '<p class="empty pad">Teks PDF kosong (mungkin hasil pindaian). Pakai tab PDF.</p>'; return; }
  const mark = t => {
    if (!re) return esc(t);
    let out = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(t))) { if (!m[0]) { re.lastIndex++; continue; } out += esc(t.slice(last, m.index)) + '<mark class="hl-find">' + esc(m[0]) + '</mark>'; last = m.index + m[0].length; }
    return out + esc(t.slice(last));
  };
  const ev = apEvOn() && UI.apEv && UI.apEv.rid === UI.apSel ? UI.apEv : null;
  body.innerHTML = pages.map((p, i) => `<article class="doc-text page-txt"><span class="pg-no">Hlm. ${i + 1}</span><p>${ev ? apEvPage(ev, i, mark) : mark(p).replace(/\n/g, '<br>')}</p></article>`).join('');
  UI.apHit = 0;
  apFindStep(0);
}
function apFindStep(d) {
  const body = $('#apRBody'), marks = body ? [...body.querySelectorAll('mark.hl-find')] : [];
  const n = $('#apFindN');
  if (marks.length) UI.apHit = (((UI.apHit || 0) + d) % marks.length + marks.length) % marks.length;
  if (n) n.textContent = marks.length ? (UI.apHit + 1) + '/' + marks.length : (apFindRe() ? '0' : '');
  marks.forEach((m, i) => m.classList.toggle('cur', i === UI.apHit));
  const m = marks[UI.apHit];
  if (m) body.scrollTop += m.getBoundingClientRect().top - body.getBoundingClientRect().top - 60;
}
async function apRenderPdf(r, body) {
  try {
    let pdf = UI.pdfCache[r.id];
    if (!pdf) {
      const blob = await DB.get('pdfs', r.id);
      if (!blob) { body.innerHTML = '<p class="empty pad">File PDF asli tidak tersimpan. Pakai tab Teks.</p>'; return; }
      pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
      UI.pdfCache[r.id] = pdf;
    }
    body.innerHTML = '';
    const width = Math.max(240, body.clientWidth - 16);
    const max = Math.min(pdf.numPages, UI.apPdfAll === r.id ? pdf.numPages : 30);
    for (let p = 1; p <= max; p++) {
      if (UI.apSel !== r.id || !body.isConnected) return;
      const page = await pdf.getPage(p);
      const vp0 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: width / vp0.width * (window.devicePixelRatio || 1) });
      const box = document.createElement('div'); box.className = 'pdf-page';
      const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; cv.style.width = width + 'px';
      const lbl = document.createElement('span'); lbl.className = 'pg-no'; lbl.textContent = 'Hlm. ' + p;
      box.append(cv, lbl); body.appendChild(box);
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    }
    if (max < pdf.numPages) {
      const b = document.createElement('button'); b.className = 'btn ghost'; b.textContent = `Tampilkan ${pdf.numPages - max} halaman lagi`;
      b.onclick = () => { UI.apPdfAll = r.id; const sl = $('#apReader'); if (sl) sl.dataset.key = ''; renderQualityKeepScroll(); };
      body.appendChild(b);
    }
  } catch (e) { console.error(e); body.innerHTML = `<p class="empty pad">PDF gagal ditampilkan: ${esc(e.message)}</p>`; }
}

function apSave(rerender = true) { touch(); if (rerender) renderQuality(); }

document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]');
  if (!a || !a.dataset.action.startsWith('ap-')) return;
  const ac = a.dataset.action;
  const cur = UI.apSel && apGet(UI.apSel);
  if (ac === 'ap-mode') { UI.apMode = a.dataset.m; renderQuality(); }
  else if (ac === 'ap-pick') { UI.apSel = a.dataset.id; renderQuality(); const f = $('.ap-form'); if (f) f.scrollTop = 0; }
  else if (ac === 'ap-open') { UI.apSel = a.dataset.id; UI.apMode = 'form'; renderQuality(); }
  else if (ac === 'ap-reader') { UI.apReader = !apReaderOn(); renderQualityKeepScroll(); }
  else if (ac === 'ap-doc') { UI.apDoc = a.dataset.m; renderQualityKeepScroll(); }
  else if (ac === 'ap-jump') { const i = +a.dataset.i; UI.apJump = UI.apJump === i ? null : i; document.querySelectorAll('.apr-jumps .chip-btn').forEach((b, k) => b.classList.toggle('on', k === UI.apJump)); apRenderText(); }
  else if (ac === 'ap-find-step') apFindStep(+a.dataset.d);
  else if (ac === 'ap-ev-go') {
    const q = a.dataset.q;
    if (!apEvGo(q)) {
      const r = rec(UI.apSel);
      // buka pembaca di mode Teks bila sorotan belum terlihat
      if (r && r.hasText) { UI.apReader = true; UI.apDoc = 'txt'; apReaderRefresh(); setTimeout(() => apEvGo(q), 400); }
      else toast('Sorotan hanya tersedia bila PDF studi ini sudah dilampirkan.', 'warn');
    }
  }
  else if (ac === 'ap-ev-use' && UI.apSel && UI.apEv) {
    const q = a.dataset.q, b = UI.apEv.best[q], ap = apEnsure(UI.apSel);
    if (!b) return;
    ap.notes[q] = (ap.notes[q] ? ap.notes[q] + ' | ' : '') + '"' + b.t.replace(/\s+/g, ' ').slice(0, 400) + '" (hlm. ' + b.page + ')';
    UI.apLastQ = q;
    apSave(false); renderQualityKeepScroll();
    toast('Bukti ditempel ke butir ' + q + '. Periksa dulu sebelum menjawab.', 'ok');
  }
  else if (ac === 'ap-evidence' && UI.apSel) {
    const ap = apEnsure(UI.apSel), items = apItems(ap);
    const k = UI.apLastQ && items.some(([c]) => c === UI.apLastQ) ? UI.apLastQ : (items.find(([c]) => !ap.ans[c]) || items[0] || [])[0];
    const t = (UI.selText || '').replace(/\s+/g, ' ').trim();
    if (!k || !t) return;
    ap.notes[k] = (ap.notes[k] ? ap.notes[k] + ' | ' : '') + '"' + t.slice(0, 500) + '"' + (UI.selPage ? ' (' + UI.selPage + ')' : '');
    $('#selbar').hidden = true; window.getSelection().removeAllRanges();
    apSave(false); renderQualityKeepScroll();
    toast('Bukti ditempel ke butir ' + k + '.', 'ok');
  }
  else if (ac === 'ap-tool-main') { S.project.apTool = a.dataset.t; apSave(); }
  else if (ac === 'ap-dl') apExport(a.dataset.f, a.dataset.fmt);
  else if (ac === 'ap-use-sug' && cur) {
    const s = apSuggest(rec(UI.apSel));
    if (cur.tool === 'mmat' && s.mmat) { cur.cat = s.mmat; if (s.qcomp) cur.qcomp = s.qcomp; }
    else if (cur.tool === 'mmat' && !s.mmat && s.jbi) cur.tool = s.jbi;
    else if (s.jbi) cur.tool = s.jbi;
    else if (s.mmat) { cur.tool = 'mmat'; cur.cat = s.mmat; }
    apSave();
  }
  else if (ac === 'ap-overall' && cur) { cur.overall = cur.overall === a.dataset.v ? '' : a.dataset.v; apSave(); }
  else if (ac === 'ap-copy' && UI.apSel) {
    const s = apStore()[UI.apSel];
    s.final = JSON.parse(JSON.stringify(s[a.dataset.from])); s.final.done = false;
    apSave(); toast('Disalin ke Konsensus. Periksa butir yang berbeda antar-reviewer.', 'ok');
  }
  else if (ac === 'ap-next') {
    const list = apList();
    const i = list.findIndex(r => r.id === UI.apSel);
    const nxt = list.slice(i + 1).concat(list.slice(0, i)).find(r => apStatus(apGet(r.id)) !== 'done');
    touch();
    if (nxt) { UI.apSel = nxt.id; renderQuality(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else { renderQuality(); toast('Semua studi sudah dinilai. Lihat tab Ringkasan.', 'ok'); }
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (!UI.apSel || !t.closest || !t.closest('#view-quality')) return;
  const a = apEnsure(UI.apSel);
  if (t.dataset.apq) { UI.apLastQ = t.dataset.apq; a.ans[t.dataset.apq] = t.value; const q = t.closest('.ap-q'); if (q) q.className = 'ap-q ans-' + t.value; apSave(false); const sc = $('.ap-score'); if (sc || apCoreItems(a).some(([k]) => k === t.dataset.apq) || /^S/.test(t.dataset.apq)) renderQualityKeepScroll(); return; }
  if (t.dataset.ap === 'tool') { a.tool = t.value; if (t.value === 'mmat' && !a.cat) { const s = apSuggest(rec(UI.apSel)); a.cat = s.mmat || ''; a.qcomp = s.qcomp || ''; } apSave(); return; }
  if (t.dataset.ap === 'cat') { a.cat = t.value; if (t.value === '5' && !a.qcomp) a.qcomp = '4'; apSave(); return; }
  if (t.dataset.ap === 'qcomp') { a.qcomp = t.value; apSave(); return; }
  if (t.id === 'apDone') { a.done = t.checked; apSave(); return; }
  if (t.id === 'apEvOn') { UI.apEvOn = t.checked; UI.apEv = null; apReaderRefresh(); return; }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (!UI.apSel || !t.closest || !t.closest('#view-quality')) return;
  const a = apGet(UI.apSel);
  if (!a) return;
  if (t.dataset.apn) { UI.apLastQ = t.dataset.apn; a.notes[t.dataset.apn] = t.value; touch(); }
  else if (t.id === 'apFind') { UI.apFind = t.value; UI.apJump = null; document.querySelectorAll('.apr-jumps .chip-btn').forEach(b => b.classList.remove('on')); apRenderText(); }
  else if (t.dataset.ap === 'comment') { a.comment = t.value; touch(); }
});
function renderQualityKeepScroll() {
  const y = window.scrollY, f = $('.ap-form'), fy = f && f.scrollTop;
  renderQuality();
  window.scrollTo(0, y);
  const f2 = $('.ap-form'); if (f2 && fy) f2.scrollTop = fy;
}

// Ringkas untuk Laporan, mis. "MMAT 4: 4/5 (selesai)" atau "JBI-CS: 7/8 · Sertakan"
function apReportCell(r) {
  const a = apFinal(r.id);
  if (!a || !(a.tool === 'mmat' ? a.cat : a.tool)) return '';
  const s = apScore(a);
  return apToolShort(a) + ': ' + s.yes + '/' + s.of + (a.overall ? ' · ' + JBI_OVERALL.find(o => o[0] === a.overall)[1] : '') + (a.done ? '' : ' (draf)');
}
document.addEventListener('focusin', e => { const t = e.target; if (t.dataset && t.dataset.apn) UI.apLastQ = t.dataset.apn; });
