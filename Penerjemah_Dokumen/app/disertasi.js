// ---------- Modul Telaah Disertasi / Tesis: Analisis Konsep Penyajian & Anatomi Monograf ----------
// Menyediakan telaah menyeluruh struktur monograf akademik tingkat Magister & Doktoral (Ph.D.),
// membedah 5 pilar konsep penyajian ilmiah, matriks benang merah (The Golden Thread),
// serta formula kalimat akademik (Doctoral Sentence Stems) siap adaptasi.
'use strict';

// Aturan deteksi bab & elemen monograf dalam teks dokumen
const DISERTASI_RULES = {
  ch1: /\b(bab\s*(?:i\b|1\b)|chapter\s*(?:one|1|i\b)|pendahuluan|introduction|latar\s*belakang|background\s*of\s*the\s*study|research\s*questions|rumusan\s*masalah|tujuan\s*penelitian)\b/i,
  ch2: /\b(bab\s*(?:ii\b|2\b)|chapter\s*(?:two|2|ii\b)|tinjauan\s*pustaka|literature\s*review|landasan\s*teori|theoretical\s*framework|kerangka\s*konseptual|conceptual\s*framework|penelitian\s*terdahulu|previous\s*studies)\b/i,
  ch3: /\b(bab\s*(?:iii\b|3\b)|chapter\s*(?:three|3|iii\b)|metode\s*penelitian|metodologi|research\s*methodology|desain\s*penelitian|research\s*design|populasi\s*dan\s*sampel|participants|instrumen\s*penelitian|data\s*collection|teknik\s*analisis\s*data)\b/i,
  ch4: /\b(bab\s*(?:iv\b|4\b)|chapter\s*(?:four|4|iv\b)|hasil\s*penelitian|findings|results|deskripsi\s*data|analisis\s*temuan|uji\s*hipotesis|hypothesis\s*testing)\b/i,
  ch5: /\b(bab\s*(?:v\b|5\b)|chapter\s*(?:five|5|v\b)|pembahasan|discussion|kesimpulan|conclusion|implikasi\s*(?:teoretis|praktis)|implications|keterbatasan\s*penelitian|limitations|saran|future\s*research)\b/i,

  methodologicalKeywords: {
    rasch: /\b(rasch|infit|outfit|mnsq|wright\s*map|andrich|separation|unidimensionality)\b/i,
    sem: /\b(sem|structural\s*equation|pls-sem|amos|smartpls|lisrel|fit\s*indices|cfi|tli|rmsea)\b/i,
    cfa: /\b(cfa|confirmatory\s*factor|factor\s*loading|convergent\s*validity|ave|cronbach)\b/i,
    aiken: /\b(aiken|content\s*validity|cvr|expert\s*judgment|validitas\s*isi)\b/i,
    qual: /\b(phenomenology|grounded\s*theory|thematic\s*analysis|case\s*study|triangulation|member\s*check|audit\s*trail|purposive\s*sampling)\b/i,
    mixed: /\b(mixed\s*methods|explanatory\s*sequential|exploratory\s*sequential|convergent\s*parallel)\b/i
  }
};

// Standar proporsi monograf ideal (Doctoral Thesis Standard)
const IDEAL_PROPORTIONS = {
  ch1: { label: 'Bab 1: Pendahuluan', idealMin: 10, idealMax: 15, role: 'Membangun urgensi empiris & gap teoretis' },
  ch2: { label: 'Bab 2: Tinjauan Teori', idealMin: 25, idealMax: 35, role: 'Memetakan konstruk, sintesis literatur, kerangka berpikir' },
  ch3: { label: 'Bab 3: Metodologi', idealMin: 15, idealMax: 20, role: 'Rancangan pembuktian, psikometrik instrumen, rigoritas prosedur' },
  ch4: { label: 'Bab 4: Hasil & Analisis', idealMin: 25, idealMax: 35, role: 'Penyajian bukti empiris, statistik, verifikasi hipotesis/tema' },
  ch5: { label: 'Bab 5: Pembahasan & Kesimpulan', idealMin: 10, idealMax: 20, role: 'Menjawab "So What?", kontribusi kebaruan, implikasi' }
};

// Analisis dokumen monograf
function analyzeThesisDocument(doc) {
  if (!doc || !doc.units || !doc.units.length) return null;

  let totalWords = 0;
  const chapters = {
    ch1: { name: 'Bab 1: Pendahuluan', count: 0, words: 0, detected: false, snippets: [] },
    ch2: { name: 'Bab 2: Landasan Teori', count: 0, words: 0, detected: false, snippets: [] },
    ch3: { name: 'Bab 3: Metodologi', count: 0, words: 0, detected: false, snippets: [] },
    ch4: { name: 'Bab 4: Hasil & Temuan', count: 0, words: 0, detected: false, snippets: [] },
    ch5: { name: 'Bab 5: Pembahasan & Implikasi', count: 0, words: 0, detected: false, snippets: [] },
    other: { name: 'Bagian Lain / Lampiran', count: 0, words: 0, snippets: [] }
  };

  const detectedMethods = {
    rasch: false, sem: false, cfa: false, aiken: false, qual: false, mixed: false
  };

  let currentCh = 'ch1';

  doc.units.forEach((uText, idx) => {
    if (!uText || typeof uText !== 'string') return;
    const words = uText.trim().split(/\s+/).filter(Boolean).length;
    totalWords += words;

    // Deteksi pergantian bab
    if (DISERTASI_RULES.ch1.test(uText) && idx < doc.units.length * 0.3) {
      currentCh = 'ch1'; chapters.ch1.detected = true;
    } else if (DISERTASI_RULES.ch2.test(uText) && idx < doc.units.length * 0.6) {
      currentCh = 'ch2'; chapters.ch2.detected = true;
    } else if (DISERTASI_RULES.ch3.test(uText) && idx < doc.units.length * 0.75) {
      currentCh = 'ch3'; chapters.ch3.detected = true;
    } else if (DISERTASI_RULES.ch4.test(uText) && idx < doc.units.length * 0.9) {
      currentCh = 'ch4'; chapters.ch4.detected = true;
    } else if (DISERTASI_RULES.ch5.test(uText)) {
      currentCh = 'ch5'; chapters.ch5.detected = true;
    }

    chapters[currentCh].count++;
    chapters[currentCh].words += words;
    if (chapters[currentCh].snippets.length < 3 && words >= 15) {
      chapters[currentCh].snippets.push({ u: idx, text: uText.slice(0, 160) + '…' });
    }

    // Deteksi kata kunci metodologis
    for (const [mKey, mReg] of Object.entries(DISERTASI_RULES.methodologicalKeywords)) {
      if (mReg.test(uText)) detectedMethods[mKey] = true;
    }
  });

  return {
    docName: doc.name,
    totalUnits: doc.units.length,
    totalWords,
    chapters,
    detectedMethods
  };
}

// Buka Modal Telaah Disertasi / Tesis
function openThesisModal() {
  const doc = cur();
  if (!doc) {
    toast('Pilih dan buka dokumen naskah terlebih dahulu.', 'bad');
    return;
  }
  if (doc.status !== 'ready') {
    toast('Dokumen masih dalam proses ekstraksi. Harap tunggu sejenak.', 'warn');
    return;
  }

  const analysis = analyzeThesisDocument(doc);
  let modal = $('#thesisModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'thesisModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  modal.hidden = false;
  modal.style.display = 'flex';
  renderThesisUI(doc, analysis, 'pillars');
}

function closeThesisModal() {
  const modal = $('#thesisModal');
  if (modal) {
    modal.hidden = true;
    modal.style.display = 'none';
  }
}

// Render Antarmuka Modal
function renderThesisUI(doc, analysis, activeTab = 'pillars') {
  const modal = $('#thesisModal');
  if (!modal) return;

  modal.innerHTML = `
  <div class="modal-card-lg" role="dialog" aria-label="Telaah Disertasi / Tesis & Konsep Penyajian">
    <div class="thesis-header">
      <div class="thesis-title-wrap">
        <h3><i class="fa-solid fa-graduation-cap" style="color:#93c5fd"></i> Telaah Disertasi / Tesis: Analisis Konsep Penyajian Monograf</h3>
        <p>${esc(doc.name)} &bull; Panduan Penulisan &amp; Konsep Penyajian Ilmiah Tingkat Magister/Doktoral</p>
      </div>
      <button type="button" class="icon-btn" onclick="closeThesisModal()" style="background:rgba(255,255,255,0.18);border:none;color:#fff;font-size:16px;cursor:pointer;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center" title="Tutup">✕</button>
    </div>

    <div class="thesis-tabs">
      <button class="thesis-tab ${activeTab === 'pillars' ? 'on' : ''}" data-thesistab="pillars">
        <i class="fa-solid fa-columns"></i> 5 Pilar Konsep Penyajian
      </button>
      <button class="thesis-tab ${activeTab === 'anatomy' ? 'on' : ''}" data-thesistab="anatomy">
        <i class="fa-solid fa-scale-balanced"></i> Anatomi &amp; Bobot Bab Monograf
      </button>
      <button class="thesis-tab ${activeTab === 'matrix' ? 'on' : ''}" data-thesistab="matrix">
        <i class="fa-solid fa-diagram-project"></i> Matriks Benang Merah (Golden Thread)
      </button>
      <button class="thesis-tab ${activeTab === 'stems' ? 'on' : ''}" data-thesistab="stems">
        <i class="fa-solid fa-pen-nib"></i> Formula Kalimat Doktoral
      </button>
      <button class="thesis-tab ${activeTab === 'blueprint' ? 'on' : ''}" data-thesistab="blueprint">
        <i class="fa-solid fa-file-export"></i> Cetak Biru Disertasi (Export)
      </button>
    </div>

    <div class="thesis-body">
      ${renderThesisTabContent(doc, analysis, activeTab)}
    </div>
  </div>`;

  // Listener tab
  modal.querySelectorAll('.thesis-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      renderThesisUI(doc, analysis, btn.dataset.thesistab);
    });
  });
}

// Render Konten Per Tab
function renderThesisTabContent(doc, analysis, tab) {
  if (tab === 'pillars') {
    return `
    <div style="background:linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);border:1.5px solid #bfdbfe;border-radius:12px;padding:1.1rem 1.3rem;margin-bottom:1.4rem">
      <h4 style="margin:0 0 .4rem 0;color:#1e3a8a;font-size:1rem;font-weight:800"><i class="fa-solid fa-compass" style="color:#2563eb"></i> Mengapa Konsep Penyajian Disertasi Berbeda dengan Artikel Jurnal?</h4>
      <p style="margin:0;font-size:.84rem;color:#334155;line-height:1.6">
        Artikel jurnal menuntut keringkasan (6.000–8.000 kata) dengan gaya <i>straight-to-the-point</i>. Sebaliknya, <b>Disertasi / Tesis adalah pembuktian kedalaman intelektual (Doctoral Thoroughness)</b>. Penguji menuntut argumentasi epistemologis, justifikasi teoretis mendalam, transparansi prosedur instrumen/analisis, dan sintesis implikasi yang mendalam. Berikut adalah <b>5 Pilar Konsep Penyajian</b> yang harus dipenuhi:
      </p>
    </div>

    <div class="thesis-pillar-grid">
      <!-- Pilar 1 -->
      <div class="thesis-pillar">
        <h4><span style="background:#2563eb;color:#fff;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.75rem">1</span> Konsep Penyajian Masalah (Bab 1)</h4>
        <p><b>Gaya Funneling (Corong):</b> Mulai dari isu global makro &bull; fenomena empiris lokal &bull; inkonsistensi teoretis &bull; formulasi Research Questions (RQs) yang terukur.</p>
        <div style="margin:8px 0">
          <span class="thesis-tag">Macro-to-Micro</span>
          <span class="thesis-tag">Theoretical Gap</span>
          <span class="thesis-tag">3-Level Significance</span>
        </div>
        <div style="font-size:.78rem;color:#475569;background:#fff;padding:8px;border-radius:6px;border:1px solid #e2e8f0;line-height:1.45">
          <b>Kunci Lolos Ujian:</b> Jangan hanya mengeluhkan "kondisi riil", tetapi tunjukkan mengapa literatur saat ini belum mampu menyelesaikan kondisi tersebut secara teoretis.
        </div>
      </div>

      <!-- Pilar 2 -->
      <div class="thesis-pillar" style="border-top-color:#0284c7">
        <h4 style="color:#0369a1"><span style="background:#0284c7;color:#fff;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.75rem">2</span> Landasan Teori &amp; Peta Pustaka (Bab 2)</h4>
        <p><b>Hierarki Teori &amp; Sintesis Konstruk:</b> Grand Theory &bull; Middle-Range Theory &bull; Applied Theory &bull; Kerangka Konseptual &bull; Hipotesis.</p>
        <div style="margin:8px 0">
          <span class="thesis-tag" style="background:#e0f2fe;color:#0369a1">Grand vs Applied Theory</span>
          <span class="thesis-tag" style="background:#e0f2fe;color:#0369a1">Anti-Parade Pustaka</span>
          <span class="thesis-tag" style="background:#e0f2fe;color:#0369a1">Conceptual Framework</span>
        </div>
        <div style="font-size:.78rem;color:#475569;background:#fff;padding:8px;border-radius:6px;border:1px solid #e2e8f0;line-height:1.45">
          <b>Kunci Lolos Ujian:</b> Hindari format katalog pengarang ("Menurut A..., Menurut B..."). Sajikan secara tematik-kritis dengan mempertentangkan sudut pandang antar-pakar.
        </div>
      </div>

      <!-- Pilar 3 -->
      <div class="thesis-pillar" style="border-top-color:#059669">
        <h4 style="color:#065f46"><span style="background:#059669;color:#fff;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.75rem">3</span> Metodologi Penelitian Rigor (Bab 3)</h4>
        <p><b>Arsitektur Pembuktian:</b> Paradigma filosofis &bull; Desain riset &bull; Penentuan unit analisis &bull; Uji psikometrik instrumen (Rasch/Aiken/CFA) &bull; Protokol Etika.</p>
        <div style="margin:8px 0">
          <span class="thesis-tag" style="background:#ecfdf5;color:#065f46">Philosophical Stance</span>
          <span class="thesis-tag" style="background:#ecfdf5;color:#065f46">Psychometric Rigor</span>
          <span class="thesis-tag" style="background:#ecfdf5;color:#065f46">Audit Trail / Protocol</span>
        </div>
        <div style="font-size:.78rem;color:#475569;background:#fff;padding:8px;border-radius:6px;border:1px solid #e2e8f0;line-height:1.45">
          <b>Kunci Lolos Ujian:</b> Urai proses validasi instrumen secara transparan. Jika memakai Rasch, tampilkan Wright Map &amp; Infit/Outfit MNSQ; jika kualitatif, jelaskan prosedur audit trail.
        </div>
      </div>

      <!-- Pilar 4 -->
      <div class="thesis-pillar" style="border-top-color:#7c3aed">
        <h4 style="color:#6b21a8"><span style="background:#7c3aed;color:#fff;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.75rem">4</span> Penyajian Temuan Empiris (Bab 4)</h4>
        <p><b>Storytelling Data &amp; Formulasi Temuan:</b> Pisahkan secara tegas antara <i>hasil murni</i> dengan <i>interpretasi opini</i> &bull; Tabel standar format APA 7 &bull; Jawab RQs secara berurutan.</p>
        <div style="margin:8px 0">
          <span class="thesis-tag" style="background:#f3e8ff;color:#6b21a8">APA 7 Tables</span>
          <span class="thesis-tag" style="background:#f3e8ff;color:#6b21a8">RQ-by-RQ Alignment</span>
          <span class="thesis-tag" style="background:#f3e8ff;color:#6b21a8">Hypothesis Decision</span>
        </div>
        <div style="font-size:.78rem;color:#475569;background:#fff;padding:8px;border-radius:6px;border:1px solid #e2e8f0;line-height:1.45">
          <b>Kunci Lolos Ujian:</b> Setiap tabel atau grafik wajib didahului oleh orientasi pembaca ("Tabel 4.X menyajikan...") dan diikuti oleh interpretasi signifikansi praktis.
        </div>
      </div>

      <!-- Pilar 5 -->
      <div class="thesis-pillar" style="border-top-color:#ea580c">
        <h4 style="color:#c2410c"><span style="background:#ea580c;color:#fff;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.75rem">5</span> Pembahasan Sintetis &amp; Kontribusi (Bab 5)</h4>
        <p><b>The "So What?" Factor:</b> Mengapa hasil demikian? &bull; Konfrontasi dengan Bab 2 &bull; Implikasi Teoretis (Kebaruan Doktoral) &bull; Implikasi Praktis &bull; Keterbatasan Jujur.</p>
        <div style="margin:8px 0">
          <span class="thesis-tag" style="background:#ffedd5;color:#c2410c">Doctoral Contribution</span>
          <span class="thesis-tag" style="background:#ffedd5;color:#c2410c">Theoretical Confrontation</span>
          <span class="thesis-tag" style="background:#ffedd5;color:#c2410c">Honest Limitations</span>
        </div>
        <div style="font-size:.78rem;color:#475569;background:#fff;padding:8px;border-radius:6px;border:1px solid #e2e8f0;line-height:1.45">
          <b>Kunci Lolos Ujian:</b> Bab 5 bukan ringkasan ulang Bab 4! Bab 5 adalah tempat Anda memposisikan diri sebagai ilmuwan mandiri yang memperluas teori yang sudah ada.
        </div>
      </div>
    </div>
    `;
  }

  if (tab === 'anatomy') {
    const ch = analysis.chapters;
    const tw = Math.max(1, analysis.totalWords);

    const rows = [
      { key: 'ch1', name: 'Bab 1: Pendahuluan', words: ch.ch1.words, pct: Math.round((ch.ch1.words / tw) * 100), ideal: '10% – 15%', tip: 'Harus tajam, tidak bertele-tele; fokus pada justification of the gap.' },
      { key: 'ch2', name: 'Bab 2: Landasan Teori & Tinjauan Pustaka', words: ch.ch2.words, pct: Math.round((ch.ch2.words / tw) * 100), ideal: '25% – 35%', tip: 'Paling tebal dalam monograf; wajib menyajikan sintesis komprehensif.' },
      { key: 'ch3', name: 'Bab 3: Metodologi Penelitian', words: ch.ch3.words, pct: Math.round((ch.ch3.words / tw) * 100), ideal: '15% – 20%', tip: 'Transparansi tinggi; harus bisa direplikasi oleh peneliti lain.' },
      { key: 'ch4', name: 'Bab 4: Hasil & Analisis Data', words: ch.ch4.words, pct: Math.round((ch.ch4.words / tw) * 100), ideal: '25% – 35%', tip: 'Bukti empiris solid, terstruktur per rumusan masalah.' },
      { key: 'ch5', name: 'Bab 5: Pembahasan, Implikasi, & Kesimpulan', words: ch.ch5.words, pct: Math.round((ch.ch5.words / tw) * 100), ideal: '10% – 20%', tip: 'Tempat menegaskan kebaruan (novelty) dan kontribusi keilmuan.' }
    ];

    const methodsDetectedList = [];
    if (analysis.detectedMethods.rasch) methodsDetectedList.push('Rasch Measurement Model');
    if (analysis.detectedMethods.sem) methodsDetectedList.push('Structural Equation Modeling (SEM)');
    if (analysis.detectedMethods.cfa) methodsDetectedList.push('Confirmatory Factor Analysis (CFA)');
    if (analysis.detectedMethods.aiken) methodsDetectedList.push("Aiken's Content Validity");
    if (analysis.detectedMethods.qual) methodsDetectedList.push('Kualitatif / Fenomenologi / Studi Kasus');
    if (analysis.detectedMethods.mixed) methodsDetectedList.push('Mixed-Methods Sequential Design');

    return `
    <div class="thesis-card">
      <h4 style="margin:0 0 .8rem 0;color:#1e3a8a;font-size:1rem"><i class="fa-solid fa-chart-column"></i> Distribusi &amp; Keseimbangan Bobot Bab Dokumen</h4>
      <p style="font-size:.84rem;color:#475569;margin-bottom:1rem">Total estimasi kata dalam naskah: <b>${analysis.totalWords.toLocaleString()} kata</b> (${analysis.totalUnits} unit paragraf).</p>

      <table class="thesis-matrix-table">
        <thead>
          <tr>
            <th>Struktur Monograf</th>
            <th style="width:110px">Kata Aktual</th>
            <th style="width:100px">Proporsi Aktual</th>
            <th style="width:110px">Standar Ideal</th>
            <th>Rekomendasi Konsep Penyajian</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><b>${esc(r.name)}</b></td>
              <td>${r.words.toLocaleString()} kata</td>
              <td>
                <div style="font-weight:700;color:${r.pct > 0 ? '#1d4ed8' : '#94a3b8'}">${r.pct}%</div>
                <div style="background:#e2e8f0;height:6px;border-radius:3px;margin-top:4px;overflow:hidden">
                  <div style="background:#2563eb;height:100%;width:${Math.min(100, r.pct * 2.5)}%"></div>
                </div>
              </td>
              <td><span style="font-weight:600;color:#0f766e">${r.ideal}</span></td>
              <td style="font-size:.8rem;color:#334155">${r.tip}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="thesis-card">
      <h4 style="margin:0 0 .6rem 0;color:#1e3a8a;font-size:.95rem"><i class="fa-solid fa-vial-circle-check"></i> Deteksi Komponen Metodologis dalam Naskah:</h4>
      ${methodsDetectedList.length ? `
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          ${methodsDetectedList.map(m => `<span class="thesis-tag" style="padding:4px 10px;font-size:.8rem;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe"><i class="fa-solid fa-check"></i> ${esc(m)}</span>`).join('')}
        </div>
      ` : `
        <p style="font-size:.82rem;color:#64748b;margin:0">Belum terdeteksi istilah metodologi khusus secara eksplisit (seperti Rasch, SEM, CFA, atau Triangulasi). Pastikan Bab 3 naskah Anda mencantumkan rincian teknik analisis data secara jelas.</p>
      `}
    </div>
    `;
  }

  if (tab === 'matrix') {
    return `
    <div style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:12px;padding:1.1rem;margin-bottom:1.2rem">
      <h4 style="margin:0 0 .4rem 0;color:#1e3a8a;font-size:.95rem"><i class="fa-solid fa-link" style="color:#2563eb"></i> Konsep "The Golden Thread" (Benang Merah Keselarasan Disertasi)</h4>
      <p style="margin:0;font-size:.82rem;color:#475569;line-height:1.6">
        Kelemahan paling fatal dalam ujian tertutup/terbuka disertasi adalah <b>"Inkonsistensi Benang Merah"</b>: ketika rumusan masalah di Bab 1 tidak dijawab dengan pas di Bab 4, atau teori di Bab 2 tidak pernah disinggung dalam pembahasan Bab 5. Matriks di bawah ini adalah alat kontrol keselarasan wajib:
      </p>
    </div>

    <div style="overflow-x:auto">
      <table class="thesis-matrix-table" style="min-width:780px">
        <thead>
          <tr>
            <th style="width:18%">1. Fenomena &amp; Gap (Bab 1)</th>
            <th style="width:16%">2. Research Question (Bab 1)</th>
            <th style="width:18%">3. Teori &amp; Konstruk (Bab 2)</th>
            <th style="width:16%">4. Metode &amp; Analisis (Bab 3)</th>
            <th style="width:16%">5. Temuan Inti (Bab 4)</th>
            <th style="width:16%">6. Implikasi Doktoral (Bab 5)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tingginya kecemasan akademik pada mahasiswa pascasarjana belum terpetakan instrumen pengukurnya secara invarian.</td>
            <td><b>RQ 1:</b> Bagaimana struktur psikometrik dan invariansi skala kecemasan akademik berbasis Rasch Model?</td>
            <td><i>Latent Trait Theory</i> &bull; <i>Rasch Measurement Model</i> (Bond &amp; Fox, 2020) &bull; Invariant Measurement (Engelhard).</td>
            <td>Kalibrasi Rating Scale Model (RSM) &bull; Analisis WINSTEPS &bull; Uji DIF gender &bull; Uji unidimensionalitas (PCA of residuals).</td>
            <td>24 dari 28 butir memenuhi batas Infit/Outfit MNSQ (0.7–1.3) &bull; Wright Map menunjukkan sebaran logit person seimbang.</td>
            <td><b>Kontribusi Teoretis:</b> Menghasilkan skala pengukuran interval linier bebas bias (invarian) bagi populasi pascasarjana.</td>
          </tr>
          <tr>
            <td>Inkonsistensi pengaruh integrasi AI terhadap keterampilan berpikir kritis dan regulasi diri mahasiswa.</td>
            <td><b>RQ 2:</b> Sejauh mana penggunaan AI scaffolding memprediksi kemampuan metakognitif mahasiswa secara mediatif?</td>
            <td><i>Self-Regulated Learning Theory</i> (Zimmerman) &bull; <i>Cognitive Load Theory</i> (Sweller).</td>
            <td>Structural Equation Modeling (PLS-SEM) &bull; Bootstrapping 5.000 subsampel &bull; Uji mediasi berulang.</td>
            <td>AI Scaffolding berpengaruh positif signifikan terhadap regulasi diri ($\beta = 0.42, p < .001$), dimediasi oleh efikasi diri.</td>
            <td><b>Kontribusi Pedagogis:</b> Merumuskan model intervensi AI adaptif yang menjaga agensi belajar tanpa menimbulkan ketergantungan.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="margin-top:1rem;text-align:right">
      <button class="btn sm" onclick="copyGoldenThreadTemplate()" style="background:#1d4ed8;color:#fff;font-weight:700">
        <i class="fa-solid fa-copy"></i> Salin Templat Matriks Benang Merah (Markdown)
      </button>
    </div>
    `;
  }

  if (tab === 'stems') {
    return `
    <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:.9rem 1.1rem;margin-bottom:1.2rem">
      <h4 style="margin:0 0 .3rem 0;color:#1e3a8a;font-size:.92rem"><i class="fa-solid fa-spell-check" style="color:#2563eb"></i> Bank Formula Kalimat Doktoral (Doctoral Sentence Stems)</h4>
      <p style="margin:0;font-size:.8rem;color:#475569">Formula kalimat akademis dengan register bahasa tingkat tinggi (Ph.D. / Master level) yang dapat langsung diadaptasi ke naskah Anda.</p>
    </div>

    <!-- Group 1 -->
    <h5 style="margin:1rem 0 .5rem 0;color:#1e3a8a;font-size:.88rem;text-transform:uppercase;letter-spacing:.05em">A. Formulasi Masalah &amp; Signifikansi (Bab 1)</h5>
    <div class="thesis-stem-card">
      <div class="stem-title">
        <span>Menjustifikasi Urgensi Celah Teoretis</span>
        <button class="btn sm ghost" onclick="copyTextToClipboard(this, 'While extensive literature has focused on [Phenomenon A] (e.g., [Author 1], [Year]), limited empirical scrutiny has been directed toward the underlying mechanisms of [Construct B], particularly within the context of [Context].')">Salin</button>
      </div>
      <div class="stem-en">"While extensive literature has focused on [Phenomenon A] (e.g., [Author 1], [Year]), limited empirical scrutiny has been directed toward the underlying mechanisms of [Construct B], particularly within the context of [Context]."</div>
      <div class="stem-id"><b>Adaptasi Indonesia:</b> "Meskipun literatur luas telah banyak berfokus pada [Fenomena A] (mis., [Penulis 1], [Tahun]), kajian empiris yang mendalam terhadap mekanisme mendasar dari [Konstruk B] masih sangat terbatas, khususnya dalam konteks [Konteks]."</div>
    </div>

    <!-- Group 2 -->
    <h5 style="margin:1.2rem 0 .5rem 0;color:#1e3a8a;font-size:.88rem;text-transform:uppercase;letter-spacing:.05em">B. Justifikasi Metodologis &amp; Filosofis (Bab 3)</h5>
    <div class="thesis-stem-card">
      <div class="stem-title">
        <span>Mempertahankan Pilihan Paradigma &amp; Model Pengukuran</span>
        <button class="btn sm ghost" onclick="copyTextToClipboard(this, 'To overcome the ordinal limitations inherent in traditional summative scoring, this dissertation employs the Rasch Measurement Model to transform raw categorical responses into genuine interval-level logit scales (Bond & Fox, 2020).')">Salin</button>
      </div>
      <div class="stem-en">"To overcome the ordinal limitations inherent in traditional summative scoring, this dissertation employs the [Rasch Measurement Model] to transform raw categorical responses into genuine interval-level logit scales (Bond & Fox, 2020)."</div>
      <div class="stem-id"><b>Adaptasi Indonesia:</b> "Guna mengatasi keterbatasan data ordinal yang melekat pada skor sumatif konvensional, disertasi ini menerapkan [Model Pengukuran Rasch] untuk mentransformasikan respons kategorikal mentah menjadi skala pengukuran interval logit yang sesungguhnya (Bond & Fox, 2020)."</div>
    </div>

    <!-- Group 3 -->
    <h5 style="margin:1.2rem 0 .5rem 0;color:#1e3a8a;font-size:.88rem;text-transform:uppercase;letter-spacing:.05em">C. Penyajian Bukti &amp; Temuan Tak Terduga (Bab 4)</h5>
    <div class="thesis-stem-card">
      <div class="stem-title">
        <span>Menyajikan Anomali atau Temuan Tak Terduga Secara Elegan</span>
        <button class="btn sm ghost" onclick="copyTextToClipboard(this, 'Contrary to initial theoretical expectations grounded in [Theory Name], the empirical evidence revealed a non-significant association between [Variable X] and [Variable Y] (β = [Val], p > .05), suggesting that...')">Salin</button>
      </div>
      <div class="stem-en">"Contrary to initial theoretical expectations grounded in [Theory Name], the empirical evidence revealed a non-significant association between [Variable X] and [Variable Y] (β = [Val], p > .05), suggesting that [Contextual Factor] may function as a boundary condition."</div>
      <div class="stem-id"><b>Adaptasi Indonesia:</b> "Berlawanan dengan ekspektasi teoretis awal yang berakar pada [Nama Teori], bukti empiris menunjukkan hubungan yang tidak signifikan antara [Variabel X] dan [Variabel Y] (β = [Nilai], p > .05), yang mengindikasikan bahwa [Faktor Kontekstual] kemungkinan berfungsi sebagai kondisi pembatas (boundary condition)."</div>
    </div>

    <!-- Group 4 -->
    <h5 style="margin:1.2rem 0 .5rem 0;color:#1e3a8a;font-size:.88rem;text-transform:uppercase;letter-spacing:.05em">D. Klaim Kebaruan &amp; Kontribusi Doktoral (Bab 5)</h5>
    <div class="thesis-stem-card">
      <div class="stem-title">
        <span>Artikulasi Kontribusi Orisinal Doktoral (Ph.D. Novelty Claim)</span>
        <button class="btn sm ghost" onclick="copyTextToClipboard(this, 'The primary doctoral contribution of this study lies in extending [Grand Theory] by demonstrating that [Key Mechanism] operates differentially under conditions of [Condition]. This finding refines existing models by...')">Salin</button>
      </div>
      <div class="stem-en">"The primary doctoral contribution of this study lies in extending [Grand Theory] by demonstrating that [Key Mechanism] operates differentially under conditions of [Condition]. This finding refines existing models by [Specific Refinement]."</div>
      <div class="stem-id"><b>Adaptasi Indonesia:</b> "Kontribusi doktoral utama dari penelitian ini terletak pada perluasan [Grand Theory] dengan membuktikan bahwa [Mekanisme Kunci] beroperasi secara berbeda di bawah kondisi [Kondisi Spesifik]. Temuan ini menyempurnakan model teoritis sebelumnya dengan cara [Bentuk Penyempurnaan]."</div>
    </div>
    `;
  }

  if (tab === 'blueprint') {
    const md = generateThesisBlueprintMarkdown(doc, analysis);
    return `
    <div class="thesis-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.8rem;flex-wrap:wrap;gap:.5rem">
        <h4 style="margin:0;color:#1e3a8a;font-size:1rem"><i class="fa-solid fa-file-lines"></i> Cetak Biru Konsep Penyajian Disertasi (Markdown)</h4>
        <button class="btn sm" onclick="copyFullThesisBlueprint()" style="background:#1d4ed8;color:#fff;font-weight:700">
          <i class="fa-solid fa-copy"></i> Salin Semua Cetak Biru
        </button>
      </div>
      <p style="font-size:.82rem;color:#475569;margin-bottom:1rem">Cetak biru ini merangkum seluruh kerangka penyajian monograf doktoral yang dapat Anda simpan dan gunakan sebagai checklist kerja penulisan naskah Anda.</p>

      <textarea id="thesisBlueprintArea" readonly style="width:100%;height:320px;padding:10px 12px;border:1.5px solid var(--line);border-radius:8px;font-family:monospace;font-size:.82rem;line-height:1.5;background:var(--surface-2);color:var(--ink);resize:vertical">${esc(md)}</textarea>
    </div>
    `;
  }

  return '';
}

// Generator Dokumen Markdown Cetak Biru
function generateThesisBlueprintMarkdown(doc, analysis) {
  return `# CETAK BIRU KONSEP PENYAJIAN DISERTASI / TESIS DOKTORAL
**Dokumen Rujukan:** ${doc ? doc.name : 'Naskah Disertasi'}
**Tanggal Telaah:** ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
**Standar:** Format Monograf Akademik Tingkat Magister / Doktoral

---

## 1. ANATOMI & PROPORSI BOBOT BAB IDEAL
- **Bab 1: Pendahuluan (10% - 15%)**
  * Macro-to-Micro Funneling
  * Justifikasi Kesenjangan Teoretis (bukan hanya keluhan praktis)
  * Formulasi Research Questions (RQs) terukur
  * Signifikansi Teoretis, Metodologis, dan Praktis
- **Bab 2: Kajian Teori & Tinjauan Pustaka (25% - 35%)**
  * Peta Teori: Grand Theory -> Middle-Range Theory -> Applied Theory
  * Anti-Parade Pustaka: Sintesis kritis tematik, bukan katalog nama pengarang
  * Matriks Konstruk, Dimensi, dan Indikator
  * Kerangka Konseptual & Model Hipotesis
- **Bab 3: Metodologi Penelitian (15% - 20%)**
  * Justifikasi Paradigma Filosofis (Positivisme / Post-Positivisme / Pragmatisme)
  * Desain Riset & Unit Analisis
  * Rigoritas Psikometrik Instrumen (Aiken's V, Rasch Infit/Outfit MNSQ, CFA)
  * Prosedur Pengumpulan Data & Protokol Etika Riset
- **Bab 4: Hasil Penelitian & Temuan Empiris (25% - 35%)**
  * Pemisahan tegas hasil statistik dari interpretasi opini
  * Visualisasi data standar APA 7 (tiga garis horizontal)
  * Verifikasi RQ demi RQ secara berurutan
- **Bab 5: Pembahasan Sintetis & Kontribusi Doktoral (10% - 20%)**
  * Menjawab "The So What? Factor"
  * Triangulasi dan konfrontasi hasil dengan teori Bab 2
  * Pernyataan Kontribusi Kebaruan Doktoral (Doctoral Novelty Claim)
  * Keterbatasan Jujur (Honest Limitations) & Arah Riset Lanjutan

---

## 2. MATRIKS BENANG MERAH (THE GOLDEN THREAD)
| No | Fenomena & Celah (Bab 1) | Research Question (Bab 1) | Teori & Konstruk (Bab 2) | Metode & Instrumen (Bab 3) | Temuan Kunci (Bab 4) | Implikasi Doktoral (Bab 5) |
|---|---|---|---|---|---|---|
| 1 | [Masalah Teoretis 1] | [RQ 1] | [Teori Rujukan 1] | [Teknik Analisis 1] | [Hasil Empiris 1] | [Kontribusi Teori 1] |
| 2 | [Masalah Teoretis 2] | [RQ 2] | [Teori Rujukan 2] | [Teknik Analisis 2] | [Hasil Empiris 2] | [Kontribusi Praktis 2] |

---

## 3. CHECKLIST KESIAPAN SIDANG DISERTASI (VIVA DEFENSE READINESS)
- [ ] Apakah setiap Research Question di Bab 1 terjawab secara tuntas di Bab 4 dan dibahas implikasinya di Bab 5?
- [ ] Apakah instrumen pengukur telah diuji validitas dan reliabilitasnya secara psikometrik ketat (bebas dari isu data ordinal palsu)?
- [ ] Apakah Bab 2 memuat sintesis perbandingan antar-peneliti atau sekadar mendaftar kutipan?
- [ ] Apakah kontribusi teoretis orisinal (kebaruan doktoral) telah dirumuskan secara tegas dalam 1-2 paragraf di Bab 5?
`;
}

// Fungsi Bantuan Salin
function copyGoldenThreadTemplate() {
  const tpl = `| No | Fenomena & Celah (Bab 1) | Research Question (Bab 1) | Teori & Konstruk (Bab 2) | Metode & Instrumen (Bab 3) | Temuan Kunci (Bab 4) | Implikasi Doktoral (Bab 5) |
|---|---|---|---|---|---|---|
| 1 | [Tuliskan fenomena empiris & kesenjangan teoretis di Bab 1] | [Rumuskan pertanyaan penelitian 1 yang spesifik] | [Sebutkan teori induk & konstruk di Bab 2] | [Jelaskan instrumen & teknik analisis Bab 3] | [Rangkum temuan empiris utama Bab 4] | [Uraikan kontribusi kebaruan ilmiah Bab 5] |`;

  navigator.clipboard.writeText(tpl).then(() => {
    toast('Templat Matriks Benang Merah berhasil disalin ke clipboard!', 'ok');
  }).catch(() => {
    toast('Gagal menyalin teks.', 'bad');
  });
}

function copyFullThesisBlueprint() {
  const el = $('#thesisBlueprintArea');
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() => {
    toast('Cetak Biru Disertasi berhasil disalin ke clipboard!', 'ok');
  }).catch(() => {
    toast('Gagal menyalin teks.', 'bad');
  });
}

function copyTextToClipboard(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const oldText = btn.textContent;
    btn.textContent = 'Tersalin!';
    btn.style.color = '#059669';
    setTimeout(() => {
      btn.textContent = oldText;
      btn.style.color = '';
    }, 1500);
    toast('Formula kalimat berhasil disalin ke clipboard!', 'ok');
  }).catch(() => {
    toast('Gagal menyalin formula.', 'bad');
  });
}

// Ekspor ke window global
window.openThesisModal = openThesisModal;
window.closeThesisModal = closeThesisModal;
window.copyGoldenThreadTemplate = copyGoldenThreadTemplate;
window.copyFullThesisBlueprint = copyFullThesisBlueprint;
window.copyTextToClipboard = copyTextToClipboard;
