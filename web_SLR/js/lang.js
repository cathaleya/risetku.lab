/* Telaah SLR — deteksi bahasa publikasi (luring, berbasis kata umum & aksara) untuk kriteria eksklusi bahasa */
'use strict';

const LANG_NAMES = { en: 'Inggris', id: 'Indonesia', ms: 'Melayu', es: 'Spanyol', pt: 'Portugis', fr: 'Prancis', de: 'Jerman', it: 'Italia', tr: 'Turki', ru: 'Rusia', uk: 'Ukraina', ar: 'Arab/Persia', zh: 'Mandarin', ja: 'Jepang', ko: 'Korea', th: 'Thai', und: 'Tidak terdeteksi' };
const LANG_CHOICES = ['en', 'id', 'ms', 'es', 'pt', 'fr', 'de', 'it', 'tr', 'ru', 'ar', 'zh', 'ja', 'ko'];

const Lang = {
  STOP: {
    en: 'the and of to in is for with that this are on as by from were was be an which their these have has or not between',
    id: 'dan yang di ini dengan untuk dari dalam pada tidak adalah itu atau oleh sebagai ke juga akan dapat bahwa para lebih',
    ms: 'dan yang di ini dengan untuk dari dalam pada tidak adalah itu atau oleh sebagai ke juga akan boleh bagi kajian ialah',
    es: 'el la los las de del y en que por para con una un es se su al como más sus entre fue este esta',
    pt: 'o os as de do da dos das e em que para com uma um não por é ao como mais pelo pela entre foi este',
    fr: 'le la les des du de et en que pour dans une un est sur par au avec ce cette sont qui plus aux leur',
    de: 'der die das und ist mit von zu den des auf für nicht ein eine im dem sich auch wird werden bei',
    it: 'il lo la gli le di del della e in che per con una un è sono dei nel alla come più tra',
    tr: 've bir bu ile için olarak da de olan en daha gibi ise çok kadar ya sonra üzerine arasında'
  },
  sets: null,
  detect(text) {
    const t = String(text || '').slice(0, 12000);
    if (!t.trim()) return 'und';
    // aksara non-Latin
    const count = re => (t.match(re) || []).length;
    const letters = count(/\p{L}/gu) || 1;
    const scripts = [['ru', /[Ѐ-ӿ]/g], ['ar', /[؀-ۿݐ-ݿ]/g], ['ko', /[가-힯]/g], ['ja', /[぀-ヿ]/g], ['zh', /[一-鿿]/g], ['th', /[฀-๿]/g]];
    for (const [k, re] of scripts) if (count(re) / letters > 0.3) return k === 'ru' && /[іїєґ]/i.test(t) ? 'uk' : k;
    if (!this.sets) { this.sets = {}; for (const [k, v] of Object.entries(this.STOP)) this.sets[k] = new Set(v.split(' ')); }
    const words = t.toLowerCase().match(/\p{L}+/gu) || [];
    const score = {};
    words.forEach(w => { for (const k in this.sets) if (this.sets[k].has(w)) score[k] = (score[k] || 0) + 1; });
    const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
    if (!ranked.length || ranked[0][1] < 4) return 'und';
    let [best, n] = ranked[0];
    // id vs ms berbagi banyak kata: pilih ms hanya bila kata khas Melayu muncul
    if (best === 'id' || best === 'ms') best = /\b(boleh|kajian|ialah|daripada|semasa|kerana)\b/i.test(t) && !/\b(bahwa|tersebut|yaitu|dapat)\b/i.test(t) ? 'ms' : 'id';
    const second = ranked.find(([k]) => k !== best && !(best === 'id' && k === 'ms') && !(best === 'ms' && k === 'id'));
    if (second && n < second[1] * 1.25) return 'und';
    return best;
  },
  // Sampel: halaman 1–3 teks lengkap bila ada (bahasa artikel), selain itu judul + abstrak
  of(r) {
    UI.langCache = UI.langCache || {};
    const t = UI.textCache[r.id];
    const key = r.id + (t ? ':ft' : ':ta');
    if (UI.langCache[key]) return UI.langCache[key];
    const sample = t ? t.slice(0, 3).join('\n') : [r.title, r.abstract].join('\n');
    return (UI.langCache[key] = this.detect(sample));
  }
};

function langRule() { const L = S.criteria.lang; return L && L.on && (L.allowed || []).length ? L : null; }

// Tambahkan kriteria bahasa ke hasil evaluasi kata kunci
function applyLang(ev, r) {
  const L = langRule();
  if (!ev || !L) return ev;
  const code = Lang.of(r);
  if (code === 'und' || L.allowed.includes(code)) return Object.assign({}, ev, { lang: code });
  const exc = [{ id: 'lang', label: (L.label || 'Bahasa tidak sesuai') + ' (' + (LANG_NAMES[code] || code) + ')', idx: 99, n: 1 }].concat(ev.exc); // bahasa didahulukan: alasan otomatis memakai kode bahasa
  return Object.assign({}, ev, { exc, excMatched: ev.excMatched + 1, flag: 'exclude', score: ev.score - 1, lang: code, langOut: true });
}
