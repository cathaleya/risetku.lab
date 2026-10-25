/* Telaah SLR — katalog basis data/register & deteksi otomatis sumber dari isi file ekspor */
'use strict';

/* hdr: judul kolom khas ekspor CSV · txt: pola di isi file (dihitung per kemunculan) · file: pola nama file
   w: bobot pola teks (domain penerbit diberi bobot kecil karena juga muncul sebagai tautan di ekspor basis data lain) */
const SOURCE_CATALOG = [
  { name: 'Scopus', hdr: ['eid', 'source title', 'art. no.'], txt: /scopus\.com|2-s2\.0-\d|^DB  - Scopus|source\s*=\s*\{Scopus\}/gim, file: /scopus/i },
  { name: 'Web of Science', hdr: ['ut (unique wos id)', 'ut', 'web of science index', 'wos categories'], txt: /WOS:\d{15}|^DB  - Web of Science|web-of-science|webofscience\.com|Clarivate/gim, file: /savedrecs|\bwos\b|web.?of.?science/i },
  { name: 'PubMed / MEDLINE', hdr: ['pmid', 'create date', 'nihms id'], txt: /^PMID- |pubmed\.ncbi\.nlm\.nih\.gov|^DB  - (PubMed|MEDLINE)|^DP  - NLM/gim, file: /pubmed|medline|^csv-.*-set\.csv$/i },
  { name: 'Embase', txt: /embase|^DB  - Embase/gim, file: /embase/i },
  { name: 'Cochrane Library (CENTRAL)', txt: /cochranelibrary\.com|Cochrane (Central|Database)/gim, file: /cochrane|central/i },
  { name: 'CINAHL', txt: /^DB  - CINAHL|cinahl/gim, file: /cinahl/i },
  { name: 'APA PsycInfo', txt: /psycinfo/gim, file: /psycinfo/i },
  { name: 'ERIC', txt: /eric\.ed\.gov|^DB  - ERIC|^OWN - ERIC|^OID - E[JD]\d+/gim, file: /\beric\b/i },
  { name: 'EBSCOhost', txt: /ebscohost|^DP  - EBSCO/gim, file: /ebsco/i },
  { name: 'ProQuest', txt: /proquest\.com|^DB  - ProQuest/gim, file: /proquest/i },
  { name: 'IEEE Xplore', hdr: ['ieee terms', 'date added to xplore', 'document identifier'], txt: /ieeexplore\.ieee\.org/gim, file: /ieee/i },
  { name: 'ACM Digital Library', txt: /dl\.acm\.org/gim, file: /\bacm\b/i },
  { name: 'Dimensions', hdr: ['dimensions url', 'publication id'], txt: /app\.dimensions\.ai|About the data: Exported on/gim, file: /dimensions/i },
  { name: 'Lens.org', hdr: ['lens id'], txt: /lens\.org/gim, file: /\blens\b/i },
  { name: 'Google Scholar', hdr: ['gsrank', 'citesurl'], txt: /scholar\.google\./gim, file: /scholar|\bgs[_-]|publish.?or.?perish|\bpop\b/i },
  { name: 'Semantic Scholar', txt: /semanticscholar\.org/gim, file: /semantic/i },
  { name: 'OpenAlex', txt: /openalex\.org/gim, file: /openalex/i },
  { name: 'Crossref', txt: /^DB  - Crossref|api\.crossref\.org/gim, file: /crossref/i },
  { name: 'CORE', txt: /core\.ac\.uk/gim, file: /\bcore\b/i },
  { name: 'DOAJ', txt: /doaj\.org/gim, file: /doaj/i },
  { name: 'JSTOR', txt: /jstor\.org/gim, file: /jstor/i },
  { name: 'Garuda', txt: /garuda\.(kemdikbud|kemendikdasmen|kemdiktisaintek|ristekbrin)\.go\.id/gim, file: /garuda/i },
  { name: 'SINTA', txt: /sinta\.(kemdikbud|kemdiktisaintek|ristekbrin)\.go\.id/gim, file: /sinta/i },
  { name: 'Neliti', txt: /neliti\.com/gim, file: /neliti/i },
  { name: 'ScienceDirect', txt: /sciencedirect\.com/gim, w: 0.3, file: /sciencedirect|\bsd[_-]/i },
  { name: 'SpringerLink', hdr: ['item title', 'item doi'], txt: /link\.springer\.com/gim, w: 0.3, file: /springer/i },
  { name: 'Wiley Online Library', txt: /onlinelibrary\.wiley\.com/gim, w: 0.3, file: /wiley/i },
  { name: 'Taylor & Francis Online', txt: /tandfonline\.com/gim, w: 0.3, file: /tandf|taylor/i },
  { name: 'SAGE Journals', txt: /journals\.sagepub\.com/gim, w: 0.3, file: /sage/i },
  { name: 'Emerald Insight', txt: /emerald\.com\/insight/gim, w: 0.3, file: /emerald/i },
  { name: 'arXiv', txt: /arxiv\.org/gim, w: 0.5, file: /arxiv/i },
  { name: 'SSRN', txt: /ssrn\.com/gim, w: 0.5, file: /ssrn/i },
  { name: 'ClinicalTrials.gov', cat: 'register', hdr: ['nct number'], txt: /clinicaltrials\.gov|\bNCT\d{8}\b/gim, file: /clinicaltrials|ctgov/i },
  { name: 'WHO ICTRP', cat: 'register', txt: /trialsearch\.who\.int|ICTRP/gim, file: /ictrp/i },
  { name: 'Penelusuran sitasi', cat: 'other' },
  { name: 'Situs web organisasi', cat: 'other' }
];
const DEFAULT_DBS = ['Scopus', 'Web of Science', 'PubMed / MEDLINE', 'Google Scholar', 'Garuda'];

const Sources = {
  find(name) {
    const n = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!n) return null;
    return SOURCE_CATALOG.find(c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === n)
      || SOURCE_CATALOG.find(c => c.file && c.file.test(name) && n.length > 2) || null;
  },
  catOf(name) { const c = this.find(name); return (c && c.cat) || 'database'; },
  canon(name) { const c = this.find(name); return c ? c.name : String(name || '').trim(); },

  /* Kembalikan { name, cat, why } atau null. text: isi file (CSV/RIS/BibTeX); headers: judul kolom CSV bila ada */
  detect({ fileName = '', text = '', headers = [] }) {
    const H = headers.map(h => String(h).replace(/^﻿/, '').trim().toLowerCase());
    const T = String(text).replace(/^﻿/, '').slice(0, 400000);
    const score = new Map(), why = new Map();
    const add = (c, s, w) => { if (!s) return; score.set(c, (score.get(c) || 0) + s); if (!why.has(c)) why.set(c, w); };
    SOURCE_CATALOG.forEach(c => {
      if (c.hdr) { const hit = c.hdr.filter(h => H.includes(h)); if (hit.length) add(c, 1000 * hit.length, 'kolom "' + hit[0] + '"'); }
      if (c.txt) { c.txt.lastIndex = 0; const m = T.match(c.txt); if (m) add(c, m.length * (c.w || 1), 'teks "' + m[0].trim().slice(0, 40) + '"'); }
      if (c.file && c.file.test(fileName)) add(c, 300, 'nama file');
    });
    // RIS dengan baris DB/DP yang tidak ada di katalog: pakai namanya apa adanya
    if (!score.size) {
      const db = T.match(/^(?:DB|DP)  - (.{3,60})$/m);
      if (db) { const nm = db[1].trim(); const c = this.find(nm); return { name: c ? c.name : nm, cat: (c && c.cat) || 'database', why: 'baris "' + db[0].trim() + '"' }; }
      return null;
    }
    const [best, s] = [...score].sort((a, b) => b[1] - a[1])[0];
    if (s < 2) return null; // satu tautan saja belum cukup
    return { name: best.name, cat: best.cat || 'database', why: why.get(best) };
  }
};

/* Daftar basis data proyek (bisa ditambah/dihapus). Belum disimpan → isian bawaan + sumber yang sudah dipakai */
function projDbs() {
  if (Array.isArray(S.project.databases)) return S.project.databases;
  const used = [...new Set(S.batches.map(b => b.name).filter(Boolean))];
  return [...new Set([...used, ...DEFAULT_DBS])].map(name => ({ name, cat: (S.batches.find(b => b.name === name) || {}).cat || Sources.catOf(name) }));
}
function addProjDb(name, cat) {
  name = String(name || '').trim();
  if (!name) return null;
  const list = S.project.databases = projDbs().slice();
  const hit = list.find(d => d.name.toLowerCase() === name.toLowerCase());
  if (hit) return hit;
  const d = { name, cat: cat || Sources.catOf(name) };
  list.push(d);
  return d;
}
