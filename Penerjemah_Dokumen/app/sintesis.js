// ---------- Pembaca Pola Sintesis Artikel (Article Synthesis & Rhetorical Pattern Reader) ----------
// Modul akademik untuk membedah pola penyajian naskah, teknik sintesis pustaka,
// serta menyediakan templat dan formula kalimat akademik siap adaptasi.
'use strict';

const SYNTHESIS_PATTERNS = {
  multicit: {
    id: 'multicit',
    name: 'Sintesis Multistudi',
    cls: 'multicit',
    icon: 'fa-solid fa-layer-group',
    desc: 'Menggabungkan 2 atau lebih studi dalam satu klaim untuk membangun dasar teoretis yang kuat.',
    template: 'Banyak penelitian terkini telah membuktikan bahwa [Klaim Teoretis Utama] ([Penulis 1, Tahun]; [Penulis 2, Tahun]; [Penulis 3, Tahun]).'
  },
  contrast: {
    id: 'contrast',
    name: 'Pola Kontras & Pertentangan',
    cls: 'contrast',
    icon: 'fa-solid fa-code-compare',
    desc: 'Mempertentangkan atau membandingkan temuan/sudut pandang yang berbeda di antara para ahli terdahulu.',
    template: 'Meskipun [Penulis A, Tahun] menekankan bahwa [Pandangan A], temuan [Penulis B, Tahun] dan [Penulis C, Tahun] justru menunjukkan sebaliknya, yakni [Pandangan B].'
  },
  consensus: {
    id: 'consensus',
    name: 'Pola Konfirmasi & Keselarasan',
    cls: 'consensus',
    icon: 'fa-solid fa-handshake-simple',
    desc: 'Menunjukkan kesepakatan atau konfirmasi temuan dengan teori/riset sebelumnya.',
    template: 'Temuan ini selaras dan memperkuat hasil studi [Penulis A, Tahun] serta [Penulis B, Tahun], yang menyatakan bahwa [Hasil/Fenomena].'
  },
  gap: {
    id: 'gap',
    name: 'Identifikasi Celah Riset (Gap)',
    cls: 'gap',
    icon: 'fa-solid fa-magnifying-glass-chart',
    desc: 'Menunjukkan keterbatasan literatur atau area yang belum terjamah untuk menjustifikasi urgensi penelitian.',
    template: 'Kendati literatur tentang [Topik] telah berkembang pesat ([Penulis A, Tahun]), masih sangat sedikit kajian empiris yang secara komprehensif menguji [Celah Riset/Konteks Baru].'
  },
  novelty: {
    id: 'novelty',
    name: 'Klaim Kontribusi & Kebaruan',
    cls: 'novelty',
    icon: 'fa-solid fa-wand-magic-sparkles',
    desc: 'Menyatakan kontribusi spesifik artikel untuk mengisi celah pengetahuan yang telah diidentifikasi.',
    template: 'Untuk menjembatani kesenjangan tersebut, penelitian ini bertujuan untuk [Tujuan Riset] dengan memberikan kontribusi kebaruan berupa [Nilai Tambah/Kebaruan].'
  },
  hedging: {
    id: 'hedging',
    name: 'Sikap Hati-hati (Hedging)',
    cls: 'hedging',
    icon: 'fa-solid fa-scale-balanced',
    desc: 'Penggunaan derajat kepastian akademik yang cermat dan proporsional untuk menghindari overklaim.',
    template: 'Bukti empiris ini mengindikasikan bahwa [Faktor X] berpotensi memengaruhi [Variabel Y], meskipun generalisasinya tetap perlu dicermati dalam konteks [Kondisi Spesifik].'
  }
};

// Regex pendeteksi pola kalimat akademik bahasa Inggris & Indonesia
const REGEX_RULES = {
  citation: /(\([A-Z][a-zA-Z\s\-]+,\s*(?:19|20)\d{2}[a-z]?(?:\s*;\s*[A-Z][a-zA-Z\s\-]+,\s*(?:19|20)\d{2}[a-z]?)*\)|\[\d+(?:\s*,\s*\d+|\s*-\s*\d+)*\]|[A-Z][a-zA-Z\s\-]+\s*\((?:19|20)\d{2}[a-z]?\))/g,
  multiCitation: /(\([A-Z][a-zA-Z\s\-]+,\s*(?:19|20)\d{2}[a-z]?(?:\s*;\s*[A-Z][a-zA-Z\s\-]+,\s*(?:19|20)\d{2}[a-z]?)+\)|\[\d+(?:\s*,\s*\d+|\s*-\s*\d+)+\])/i,
  contrast: /\b(however|in contrast|on the other hand|conversely|whereas|nonetheless|nevertheless|despite this|contrary to|yet|although|while previous studies|differ from|discrepanc|divergen|namun|sebaliknya|akan tetapi|berbeda dengan|meskipun demikian|bertentangan dengan)\b/i,
  consensus: /\b(consistent with|in line with|corroborates|supports the findings of|aligns with|in agreement with|similarly|likewise|echoes|reinforces|accords with|selaras dengan|konsisten dengan|mendukung temuan|sejalan dengan|memperkuat hasil)\b/i,
  gap: /\b(little is known|few studies|remains unclear|has not yet been explored|has been overlooked|scant attention|unresolved|controversy exists|limited empirical evidence|gap in the literature|under-researched|remains poorly understood|belum banyak diteliti|masih belum jelas|masih sedikit kajian|celah penelitian|masih terbatas)\b/i,
  novelty: /\b(to bridge this gap|this study aims to|our research extends|first to investigate|provides novel insights|contributes to the understanding of|we propose|fills a critical void|the novelty of this study|kami mengusulkan|penelitian ini bertujuan|kebaruan dari penelitian ini|menjembatani kesenjangan)\b/i,
  hedging: /\b(plausibly suggests|may indicate|tends to show|appears to be|can be tentatively inferred|might imply|potential link|could be attributed to|mengindikasikan bahwa|tampaknya|dapat diduga bahwa|berpotensi memengaruhi)\b/i
};

// Analisis pola sintesis dari dokumen yang sedang aktif
function analyzeDocSynthesis(doc) {
  if (!doc || !doc.units || !doc.units.length) return null;

  const patterns = [];
  const tr = trOf(doc);
  let totalCitations = 0;
  let multiCitations = 0;

  // Analisis per unit teks
  doc.units.forEach((unitText, uIdx) => {
    if (!unitText || typeof unitText !== 'string' || unitText.length < 25) return;

    // Hitung sitasi
    const citMatches = unitText.match(REGEX_RULES.citation);
    if (citMatches) {
      totalCitations += citMatches.length;
    }

    const sentences = unitText.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [unitText];

    sentences.forEach(rawSent => {
      const sent = rawSent.trim();
      if (sent.length < 35) return;

      const matchedKinds = [];
      const hasMultiCit = REGEX_RULES.multiCitation.test(sent);
      if (hasMultiCit) {
        matchedKinds.push('multicit');
        multiCitations++;
      }
      if (REGEX_RULES.gap.test(sent)) matchedKinds.push('gap');
      if (REGEX_RULES.novelty.test(sent)) matchedKinds.push('novelty');
      if (REGEX_RULES.contrast.test(sent)) matchedKinds.push('contrast');
      if (REGEX_RULES.consensus.test(sent)) matchedKinds.push('consensus');
      if (REGEX_RULES.hedging.test(sent)) matchedKinds.push('hedging');

      if (matchedKinds.length > 0) {
        // Temukan judul bagian (section title)
        let secTitle = 'Badan Teks';
        for (const s of doc.sections || []) {
          if (s.blocks && s.blocks.some(b => b.u === uIdx)) {
            if (s.title) secTitle = s.title;
            break;
          }
        }

        patterns.push({
          u: uIdx,
          secTitle,
          orig: sent,
          tr: (tr && tr[uIdx]) ? tr[uIdx].trim() : '',
          kinds: matchedKinds,
          citations: citMatches ? citMatches.length : 0
        });
      }
    });
  });

  // Hitung metrik ringkasan
  const kindCounts = { multicit: 0, contrast: 0, consensus: 0, gap: 0, novelty: 0, hedging: 0 };
  patterns.forEach(p => {
    p.kinds.forEach(k => {
      if (kindCounts[k] !== undefined) kindCounts[k]++;
    });
  });

  return {
    totalUnits: doc.units.length,
    totalCitations,
    multiCitations,
    totalPatterns: patterns.length,
    kindCounts,
    patterns
  };
}

// Buka Modal Pembaca Pola Sintesis Artikel
function openSynthesisModal() {
  const doc = cur();
  if (!doc) {
    toast('Buka sebuah dokumen terlebih dahulu untuk membaca pola sintesisnya.', 'bad');
    return;
  }
  if (doc.status !== 'ready') {
    toast('Dokumen masih dalam proses pembacaan/ekstraksi. Mohon tunggu sejenak.', 'warn');
    return;
  }

  const analysis = analyzeDocSynthesis(doc);
  let modal = $('#synthesisModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'synthesisModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  modal.hidden = false;
  modal.style.display = 'flex';
  renderSynthesisUI(doc, analysis, 'overview');
}

function closeSynthesisModal() {
  const modal = $('#synthesisModal');
  if (modal) {
    modal.hidden = true;
    modal.style.display = 'none';
  }
}

// Render isi antarmuka Pola Sintesis
function renderSynthesisUI(doc, analysis, activeTab = 'overview') {
  const modal = $('#synthesisModal');
  if (!modal || !analysis) return;

  const total = analysis.totalPatterns;
  const k = analysis.kindCounts;

  modal.innerHTML = `
  <div class="modal-card-lg" role="dialog" aria-label="Pembaca Pola Sintesis Artikel">
    <div class="syn-header">
      <div class="syn-title-wrap">
        <h3><i class="fa-solid fa-brain" style="color:#6ee7b7"></i> Pembaca Pola Sintesis &amp; Penyajian Artikel</h3>
        <p>${esc(doc.name)} &bull; ${analysis.totalCitations} sitasi terdeteksi &bull; ${total} pola sintesis akademik ditemukan</p>
      </div>
      <button type="button" class="icon-btn" onclick="closeSynthesisModal()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:16px;cursor:pointer;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center" title="Tutup">✕</button>
    </div>

    <div class="syn-tabs">
      <button class="syn-tab ${activeTab === 'overview' ? 'on' : ''}" data-syntab="overview">
        <i class="fa-solid fa-chart-pie"></i> Profil &amp; Ringkasan
      </button>
      <button class="syn-tab ${activeTab === 'rhetoric' ? 'on' : ''}" data-syntab="rhetoric">
        <i class="fa-solid fa-sitemap"></i> Pola Retorika (CARS/IMRaD)
      </button>
      <button class="syn-tab ${activeTab === 'patterns' ? 'on' : ''}" data-syntab="patterns">
        <i class="fa-solid fa-magnifying-glass"></i> Pola Sintesis Riil (${total})
      </button>
      <button class="syn-tab ${activeTab === 'templates' ? 'on' : ''}" data-syntab="templates">
        <i class="fa-solid fa-paste"></i> Bank Formula Siap Adaptasi
      </button>
    </div>

    <div class="syn-body" id="synBodyContent">
      ${renderSynTabContent(doc, analysis, activeTab)}
    </div>
  </div>`;

  // Listener tab
  modal.querySelectorAll('.syn-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      renderSynthesisUI(doc, analysis, btn.dataset.syntab);
    });
  });
}

// Render konten tab
function renderSynTabContent(doc, analysis, tab) {
  const k = analysis.kindCounts;

  if (tab === 'overview') {
    const ratioMulti = analysis.totalCitations ? Math.round((analysis.multiCitations / analysis.totalCitations) * 100) : 0;
    return `
    <div class="syn-grid-stats">
      <div class="syn-stat-card">
        <div class="val">${analysis.totalCitations}</div>
        <div class="lbl">Total Sitasi Dalam Teks</div>
        <div class="desc">Kerapatan pustaka yang dirujuk dalam naskah</div>
      </div>
      <div class="syn-stat-card">
        <div class="val" style="color:#0284c7">${analysis.multiCitations} (${ratioMulti}%)</div>
        <div class="lbl">Sintesis Multistudi</div>
        <div class="desc">Kalimat yang merangkai 2+ studi sekaligus</div>
      </div>
      <div class="syn-stat-card">
        <div class="val" style="color:#ea580c">${k.contrast}</div>
        <div class="lbl">Pola Kontras &amp; Debat</div>
        <div class="desc">Membandingkan perbedaan pandangan antar-ahli</div>
      </div>
      <div class="syn-stat-card">
        <div class="val" style="color:#dc2626">${k.gap}</div>
        <div class="lbl">Celah Riset (Gap Spotting)</div>
        <div class="desc">Pernyataan keterbatasan literatur terdahulu</div>
      </div>
    </div>

    <div style="background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:1.2rem;margin-bottom:1.4rem">
      <h4 style="margin:0 0 .5rem 0;color:#0f172a;font-size:.95rem"><i class="fa-solid fa-lightbulb" style="color:#f59e0b"></i> Cara Cepat Membaca &amp; Mengadaptasi Gaya Naskah Ini:</h4>
      <ol style="margin:0;padding-left:1.2rem;font-size:.85rem;color:#334155;line-height:1.65">
        <li>Buka tab <b>"Pola Retorika (CARS/IMRaD)"</b> untuk memahami kerangka alur bagaimana penulis menyusun Pendahuluan, Tinjauan Teori, dan Diskusi.</li>
        <li>Buka tab <b>"Pola Sintesis Riil"</b> untuk melihat contoh kalimat nyata dalam artikel yang menggabungkan banyak sitasi atau mempertentangkan temuan. Klik <b>"Lihat di Teks"</b> untuk melompat langsung ke posisinya dalam dokumen.</li>
        <li>Buka tab <b>"Bank Formula Siap Adaptasi"</b> untuk menyalin kerangka kalimat sintesis akademik profesional yang bisa langsung Anda ganti isinya dengan data riset Anda sendiri.</li>
      </ol>
    </div>

    <h4 style="margin:0 0 .8rem 0;font-size:.92rem;color:var(--ink)">Distribusi Pola Sintesis Naskah:</h4>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:.8rem">
      ${Object.values(SYNTHESIS_PATTERNS).map(p => `
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:.8rem 1rem;display:flex;align-items:flex-start;gap:.8rem">
          <div style="width:36px;height:36px;border-radius:8px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;color:#059669;font-size:16px;flex-shrink:0">
            <i class="${p.icon}"></i>
          </div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <b style="font-size:.84rem">${p.name}</b>
              <span class="syn-badge ${p.cls}">${k[p.id] || 0} temuan</span>
            </div>
            <p style="margin:3px 0 0 0;font-size:.76rem;color:var(--muted);line-height:1.4">${p.desc}</p>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  if (tab === 'rhetoric') {
    return `
    <div style="margin-bottom:1.2rem">
      <p style="font-size:.86rem;color:var(--ink-2);margin:0 0 1rem 0">
        Bedah langkah retorika (Rhetorical Moves) berdasarkan model <b>CARS (Create a Research Space - John Swales)</b> dan <b>IMRaD</b> berstandar jurnal Scopus Q1/Q2:
      </p>
    </div>

    <div style="display:flex;flex-direction:column;gap:1.2rem">
      <!-- 1. Pendahuluan -->
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:1.1rem">
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.8rem">
          <span style="background:#dbeafe;color:#1e40af;font-size:.75rem;font-weight:800;padding:.2rem .6rem;border-radius:6px">BAGIAN 1</span>
          <h4 style="margin:0;font-size:1rem;color:#1e293b">Pola Penyajian Pendahuluan (Introduction - CARS Model)</h4>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.8rem;font-size:.82rem">
          <div style="background:#f8fafc;padding:.8rem;border-radius:8px;border:1px solid #e2e8f0">
            <b style="color:#0369a1;display:block;margin-bottom:4px">Move 1: Establishing Territory</b>
            <p style="margin:0;color:#475569;line-height:1.45">Penulis membuka artikel dengan mengangkat urgensi topik secara global, menyajikan data statistik masalah, dan merujuk studi terdahulu untuk membuktikan bahwa topik ini krusial.</p>
          </div>
          <div style="background:#fef2f2;padding:.8rem;border-radius:8px;border:1px solid #fecaca">
            <b style="color:#b91c1c;display:block;margin-bottom:4px">Move 2: Establishing a Niche (Gap)</b>
            <p style="margin:0;color:#7f1d1d;line-height:1.45">Penulis mempertentangkan hasil riset sebelumnya atau menunjukkan bahwa ada aspek penting yang selama ini diabaikan (*overlooked*) oleh literatur.</p>
          </div>
          <div style="background:#ecfdf5;padding:.8rem;border-radius:8px;border:1px solid #a7f3d0">
            <b style="color:#065f46;display:block;margin-bottom:4px">Move 3: Occupying the Niche</b>
            <p style="margin:0;color:#064e3b;line-height:1.45">Penulis menyatakan secara tegas tujuan penelitian, pertanyaan riset, dan kontribusi kebaruan (*novelty*) yang ditawarkan naskah ini.</p>
          </div>
        </div>
      </div>

      <!-- 2. Tinjauan Pustaka -->
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:1.1rem">
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.8rem">
          <span style="background:#fef3c7;color:#92400e;font-size:.75rem;font-weight:800;padding:.2rem .6rem;border-radius:6px">BAGIAN 2</span>
          <h4 style="margin:0;font-size:1rem;color:#1e293b">Pola Sintesis Tinjauan Pustaka (Literature Review)</h4>
        </div>
        <div style="font-size:.83rem;color:#334155;line-height:1.55">
          <p style="margin:0 0 .5rem 0">Naskah jurnal bereputasi tidak pernah merangkum artikel satu per satu per paragraf (*annotated bibliography*), melainkan menerapkan:</p>
          <ul style="margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:4px">
            <li><b>Sintesis Tematis (Thematic Grouping):</b> Paragraf diawali dengan gagasan konseptual, lalu didukung oleh beberapa rujukan sekaligus <i>(Multi-study attribution)</i>.</li>
            <li><b>Sintesis Dialektis (Thesis - Antithesis):</b> Mempertemukan dua kelompok ahli yang berbeda hasil, lalu memosisikan variabel penelitian saat ini sebagai penjelas.</li>
          </ul>
        </div>
      </div>

      <!-- 3. Pembahasan -->
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:1.1rem">
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.8rem">
          <span style="background:#dcfce7;color:#166534;font-size:.75rem;font-weight:800;padding:.2rem .6rem;border-radius:6px">BAGIAN 3</span>
          <h4 style="margin:0;font-size:1rem;color:#1e293b">Pola Pembahasan (Discussion &amp; Triangulation)</h4>
        </div>
        <div style="font-size:.83rem;color:#334155;line-height:1.55">
          <p style="margin:0 0 .5rem 0">Pola penyajian diskusi yang ideal mengikuti urutan 3 langkah:</p>
          <ol style="margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:4px">
            <li><b>Sintesis Temuan Sendiri:</b> Menegaskan kembali jawaban atas pertanyaan penelitian berdasarkan data empiris.</li>
            <li><b>Triangulasi Literatur:</b> Mendiskusikan apakah temuan ini memperkuat (*consistent with*) atau menyanggah (*diverges from*) teori/studi terdahulu, disertai penjelasan rasional mengapa hal tersebut terjadi.</li>
            <li><b>Implikasi Teoretis &amp; Praktis:</b> Menjelaskan apa arti temuan ini bagi pengembangan ilmu dan bagi praktisi/kebijakan di lapangan.</li>
          </ol>
        </div>
      </div>
    </div>`;
  }

  if (tab === 'patterns') {
    if (!analysis.patterns.length) {
      return `<div style="text-align:center;padding:3rem 1rem;color:var(--muted)">
        <i class="fa-solid fa-file-circle-question" style="font-size:40px;margin-bottom:12px;color:#cbd5e1"></i>
        <h4 style="margin:0;color:var(--ink)">Belum Terdeteksi Pola Sintesis Spesifik</h4>
        <p style="font-size:.85rem;margin:6px 0 0 0">Pastikan naskah artikel berisi kutipan dan teks lengkap.</p>
      </div>`;
    }

    return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
      <span style="font-size:.84rem;color:var(--ink-2)">Ditemukan <b>${analysis.patterns.length} kalimat</b> dengan penanda pola sintesis &amp; retorika akademik:</span>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn sm ghost" onclick="filterSynItems('all')" style="font-size:.74rem">Semua</button>
        <button class="btn sm ghost" onclick="filterSynItems('multicit')" style="font-size:.74rem">Multistudi</button>
        <button class="btn sm ghost" onclick="filterSynItems('contrast')" style="font-size:.74rem">Kontras</button>
        <button class="btn sm ghost" onclick="filterSynItems('consensus')" style="font-size:.74rem">Konsensus</button>
        <button class="btn sm ghost" onclick="filterSynItems('gap')" style="font-size:.74rem">Celah (Gap)</button>
        <button class="btn sm ghost" onclick="filterSynItems('novelty')" style="font-size:.74rem">Kebaruan</button>
      </div>
    </div>

    <div id="synItemsContainer">
      ${analysis.patterns.map((item, idx) => {
        const primaryKind = item.kinds[0] || 'multicit';
        const pDef = SYNTHESIS_PATTERNS[primaryKind] || SYNTHESIS_PATTERNS.multicit;
        return `
        <div class="syn-item-card ${pDef.cls}" data-kinds="${item.kinds.join(',')}" id="synCard-${idx}">
          <div class="syn-meta-row">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              ${item.kinds.map(k => {
                const def = SYNTHESIS_PATTERNS[k] || {};
                return `<span class="syn-badge ${def.cls || ''}"><i class="${def.icon || ''}"></i> ${def.name || k}</span>`;
              }).join('')}
              <span class="syn-loc">&bull; Bagian: <b>${esc(item.secTitle)}</b></span>
            </div>
            <button class="btn sm ghost" onclick="jumpToDocumentUnit(${item.u})" style="font-size:.74rem;padding:.2rem .55rem" title="Lihat langsung posisi kalimat ini di panel dokumen">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Lihat di Teks
            </button>
          </div>

          <div class="syn-orig-text">${CriteriaHighlight(item.orig)}</div>
          ${item.tr ? `<div class="syn-tr-text"><b>Terjemahan:</b> ${esc(item.tr)}</div>` : ''}

          <div class="syn-actions">
            <button class="btn sm ghost" onclick="copyText('${esc(item.orig.replace(/'/g, "\\'"))}', 'Kalimat asli berhasil disalin!')" style="font-size:.74rem">
              <i class="fa-solid fa-copy"></i> Salin Kalimat Asli
            </button>
            ${item.tr ? `<button class="btn sm ghost" onclick="copyText('${esc(item.tr.replace(/'/g, "\\'"))}', 'Terjemahan berhasil disalin!')" style="font-size:.74rem">
              <i class="fa-solid fa-language"></i> Salin Terjemahan
            </button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  if (tab === 'templates') {
    return `
    <div style="margin-bottom:1.2rem">
      <p style="font-size:.86rem;color:var(--ink-2);margin:0">
        Kumpulan <b>Formula &amp; Templat Kalimat Akademik Siap Adaptasi</b> yang diekstraksi dari standar penulisan jurnal internasional bereputasi. Klik <b>"Salin Formula"</b> untuk langsung memakainya dalam draf naskah Anda:
      </p>
    </div>

    <div style="display:flex;flex-direction:column;gap:1.1rem">
      <!-- 1. Templat Sintesis Multistudi -->
      <div class="syn-item-card multicit">
        <div class="syn-meta-row">
          <span class="syn-badge multicit"><i class="fa-solid fa-layer-group"></i> Formula 1: Sintesis Multistudi (Landasan Konsensus)</span>
        </div>
        <p style="font-size:.8rem;color:#475569;margin:0 0 .4rem 0">Gunakan saat ingin menegaskan bahwa sebuah konsep atau fenomena telah didukung kuat oleh banyak rujukan independen:</p>
        <div class="syn-template-box">
          <b>Inggris:</b> "Accumulating evidence indicates that <i>[Fenomena/Variabel Utama Anda]</i> plays a pivotal role in <i>[Hasil/Dampak]</i> (Author A, 2021; Author B, 2023; Author C, 2024)."<br><br>
          <b>Indonesia:</b> "Semakin banyak bukti empiris menunjukkan bahwa <i>[Fenomena/Variabel Utama Anda]</i> memainkan peran krusial dalam <i>[Hasil/Dampak]</i> (Penulis A, 2021; Penulis B, 2023; Penulis C, 2024)."
        </div>
        <button class="btn sm ghost" onclick="copyText('Accumulating evidence indicates that [Variabel Utama] plays a pivotal role in [Hasil/Dampak] ([Penulis 1, Tahun]; [Penulis 2, Tahun]; [Penulis 3, Tahun]).', 'Formula berhasil disalin!')" style="font-size:.75rem">
          <i class="fa-solid fa-copy"></i> Salin Formula Bahasa Inggris
        </button>
      </div>

      <!-- 2. Templat Sintesis Kontras -->
      <div class="syn-item-card contrast">
        <div class="syn-meta-row">
          <span class="syn-badge contrast"><i class="fa-solid fa-code-compare"></i> Formula 2: Sintesis Kontras &amp; Perdebatan Teori</span>
        </div>
        <p style="font-size:.8rem;color:#475569;margin:0 0 .4rem 0">Gunakan saat Anda mempertemukan dua mazhab pemikiran yang belum sepakat:</p>
        <div class="syn-template-box">
          <b>Inggris:</b> "While several scholars have demonstrated that <i>[Argumen Positif/Kubu A]</i> (Author A, 2020; Author B, 2022), others argue conversely that <i>[Argumen Negatif/Kubu B]</i> (Author C, 2023)."<br><br>
          <b>Indonesia:</b> "Meskipun beberapa ahli membuktikan bahwa <i>[Argumen Positif/Kubu A]</i> (Penulis A, 2020; Penulis B, 2022), peneliti lain justru berargumen sebaliknya bahwa <i>[Argumen Negatif/Kubu B]</i> (Penulis C, 2023)."
        </div>
        <button class="btn sm ghost" onclick="copyText('While several scholars have demonstrated that [Argumen Kubu A] (Author A, 2020; Author B, 2022), others argue conversely that [Argumen Kubu B] (Author C, 2023).', 'Formula berhasil disalin!')" style="font-size:.75rem">
          <i class="fa-solid fa-copy"></i> Salin Formula Bahasa Inggris
        </button>
      </div>

      <!-- 3. Templat Celah Riset -->
      <div class="syn-item-card gap">
        <div class="syn-meta-row">
          <span class="syn-badge gap"><i class="fa-solid fa-magnifying-glass-chart"></i> Formula 3: Identifikasi Celah Riset (Gap Spotting)</span>
        </div>
        <p style="font-size:.8rem;color:#475569;margin:0 0 .4rem 0">Gunakan di paragraf akhir Pendahuluan untuk membenarkan perlunya riset Anda:</p>
        <div class="syn-template-box">
          <b>Inggris:</b> "Despite substantial interest in <i>[Topik Umum]</i>, limited empirical research has directly investigated how <i>[Variabel Spesifik Anda]</i> interacts with <i>[Konteks/Populasi Anda]</i>."<br><br>
          <b>Indonesia:</b> "Kendati minat terhadap <i>[Topik Umum]</i> sangat besar, masih sangat terbatas penelitian empiris yang secara langsung menyelidiki bagaimana <i>[Variabel Spesifik Anda]</i> berinteraksi dengan <i>[Konteks/Populasi Anda]</i>."
        </div>
        <button class="btn sm ghost" onclick="copyText('Despite substantial interest in [Topik Umum], limited empirical research has directly investigated how [Variabel Spesifik] interacts with [Konteks/Populasi].', 'Formula berhasil disalin!')" style="font-size:.75rem">
          <i class="fa-solid fa-copy"></i> Salin Formula Bahasa Inggris
        </button>
      </div>

      <!-- 4. Templat Klaim Kebaruan -->
      <div class="syn-item-card novelty">
        <div class="syn-meta-row">
          <span class="syn-badge novelty"><i class="fa-solid fa-wand-magic-sparkles"></i> Formula 4: Pernyataan Tujuan &amp; Kebaruan (Novelty)</span>
        </div>
        <p style="font-size:.8rem;color:#475569;margin:0 0 .4rem 0">Gunakan untuk menegaskan kontribusi unik penelitian:</p>
        <div class="syn-template-box">
          <b>Inggris:</b> "To address this critical void, the current study aims to <i>[Tujuan Penelitian]</i>, thereby extending prior literature by offering <i>[Kebaruan/Nilai Tambah]</i>."<br><br>
          <b>Indonesia:</b> "Guna menjembatani kesenjangan penting ini, penelitian saat ini bertujuan untuk <i>[Tujuan Penelitian]</i>, sehingga memperluas literatur sebelumnya dengan menawarkan <i>[Kebaruan/Nilai Tambah]</i>."
        </div>
        <button class="btn sm ghost" onclick="copyText('To address this critical void, the current study aims to [Tujuan Riset], thereby extending prior literature by offering [Kebaruan].', 'Formula berhasil disalin!')" style="font-size:.75rem">
          <i class="fa-solid fa-copy"></i> Salin Formula Bahasa Inggris
        </button>
      </div>

      <!-- 5. Templat Pembahasan Triangulasi -->
      <div class="syn-item-card consensus">
        <div class="syn-meta-row">
          <span class="syn-badge consensus"><i class="fa-solid fa-handshake-simple"></i> Formula 5: Triangulasi Pembahasan (Discussion Triangulation)</span>
        </div>
        <p style="font-size:.8rem;color:#475569;margin:0 0 .4rem 0">Gunakan di bagian Pembahasan untuk mendialogkan temuan data Anda dengan studi terdahulu:</p>
        <div class="syn-template-box">
          <b>Inggris:</b> "These findings corroborate those of <i>[Penulis A, 2021]</i> and <i>[Penulis B, 2023]</i>, reinforcing the notion that <i>[Temuan Anda]</i>. Furthermore, our results extend this understanding to <i>[Konteks Baru Anda]</i>."<br><br>
          <b>Indonesia:</b> "Temuan ini mengonfirmasi hasil studi <i>[Penulis A, 2021]</i> dan <i>[Penulis B, 2023]</i>, memperkuat pemahaman bahwa <i>[Temuan Anda]</i>. Lebih jauh lagi, hasil penelitian kami memperluas pemahaman ini pada <i>[Konteks Baru Anda]</i>."
        </div>
        <button class="btn sm ghost" onclick="copyText('These findings corroborate those of [Penulis A, 2021] and [Penulis B, 2023], reinforcing the notion that [Temuan Anda]. Furthermore, our results extend this understanding to [Konteks Baru].', 'Formula berhasil disalin!')" style="font-size:.75rem">
          <i class="fa-solid fa-copy"></i> Salin Formula Bahasa Inggris
        </button>
      </div>
    </div>`;
  }

  return '';
}

// Filter item di tab Pola Sintesis Riil
function filterSynItems(kind) {
  const cards = document.querySelectorAll('#synItemsContainer .syn-item-card');
  cards.forEach(c => {
    if (kind === 'all') {
      c.style.display = 'block';
    } else {
      const kinds = (c.dataset.kinds || '').split(',');
      c.style.display = kinds.includes(kind) ? 'block' : 'none';
    }
  });
}

// Melompat langsung ke unit teks di dokumen
function jumpToDocumentUnit(uIdx) {
  closeSynthesisModal();
  if (UI.view !== 'read') {
    UI.view = 'read';
    renderDoc();
  }

  setTimeout(() => {
    const el = document.querySelector(`#docContent .u[data-u="${uIdx}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
      toast('Menampilkan letak kalimat sintesis di dalam naskah', 'ok');
    }
  }, 100);
}

// Salin teks ke papan klip
async function copyText(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg || 'Teks berhasil disalin!', 'ok');
  } catch (e) {
    console.error(e);
  }
}

// Sorot kata kunci sintesis dalam kalimat
function CriteriaHighlight(text) {
  if (!text) return '';
  return esc(text)
    .replace(REGEX_RULES.citation, '<b style="color:#047857;background:#ecfdf5;padding:1px 4px;border-radius:4px">$1</b>')
    .replace(REGEX_RULES.contrast, '<mark style="background:#ffedd5;color:#c2410c;font-weight:700;padding:1px 3px;border-radius:3px">$1</mark>')
    .replace(REGEX_RULES.consensus, '<mark style="background:#e0f2fe;color:#0369a1;font-weight:700;padding:1px 3px;border-radius:3px">$1</mark>')
    .replace(REGEX_RULES.gap, '<mark style="background:#fee2e2;color:#b91c1c;font-weight:700;padding:1px 3px;border-radius:3px">$1</mark>')
    .replace(REGEX_RULES.novelty, '<mark style="background:#f3e8ff;color:#6b21a8;font-weight:700;padding:1px 3px;border-radius:3px">$1</mark>');
}
