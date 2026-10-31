/*
 * SintesisEngine: Modul Audit Retorika Akademik & Pola Sintesis Pustaka
 * Berdasarkan Master Skill: Phenomenon-Driven Literature Synthesis & Anti-Parade Engineering
 * (Diadaptasi untuk Standar Pascasarjana UNJ 2025 & Jurnal Bereputasi Scopus/WoS)
 */
(function (global) {
  'use strict';

  const STOPWORDS = new Set(('ada adalah adanya akibat akibatnya akan akhir aktif antara apa apakah atau bagi bahkan bahkan bahwa ' +
    'banyak baru beberapa begini begitu belum berada berdampak berapa berdasarkan berkaitan bersama bisa boleh buat ' +
    'cara cukup dalam dan dapat dari daripada demikian dengan depan di dia dimana diharapkan diri dkk ' +
    'hal hanya harus hingga ia ingin ini itu jadi jika juga kalau kami kamu karena ke kedua kemungkinan kemudian ' +
    'kini kita lebih lewat lagi lalu lain lama lanjut luas luar makin mampu mana manakah masa masih mau me mereka ' +
    'melalui meliputi memang men mendapati menemukan mengenai menjadi menunjukkan menurut menjelaskan merasa ' +
    'merupakan meski meskipun misalnya mulai namun nanti nya oleh pada para pasti perlu pernah pertama pula pun ' +
    'saat saja sama sampai sampai-sampai sana sang sangat satu saya se sebab sebagian sebagai sebagaimana sebaiknya sebuah ' +
    'secara sedang sedangkan sedikit sehingga selain selalu seluruh sementara semakin sendiri seperti serta sesuai setiap ' +
    'tahap tahun tanpa tapi telah tentang tentu terdapat terhadap tetapi tiap tidak tingkat tinggi untuk yaitu yakni ' +
    'the and or of in on at to for with by from that which this these those as is are was were be been being have has had ' +
    'do does did but however although while whereas therefore thus moreover furthermore additionally').split(' '));

  const NON_AUTHOR_NOUNS = new Set([
    'penelitian', 'studi', 'riset', 'kajian', 'literatur', 'laporan', 'hasil', 'temuan', 'data', 'analisis',
    'survey', 'survei', 'evaluasi', 'observasi', 'evidence', 'study', 'research', 'findings', 'literature',
    'telah', 'sudah', 'juga', 'akan', 'pernah', 'dapat', 'bisa', 'secara', 'ini', 'itu', 'tersebut', 'mereka'
  ]);

  const PARADE_REGEXES = [
    {
      id: 'menurut',
      re: /\b([Mm]enurut|[Mm]engacu pada|[Bb]erdasarkan pandangan|[Bb]erdasarkan|[Ss]ebagaimana (?:dinyatakan|dikemukakan|dijelaskan) oleh|[Mm]erujuk pada|[Ss]esuai pendapat)\s+([A-Z][a-zA-ZÀ-ſ'’\-]+(?:\s+(?:dkk|et al\.?))?(?:\s*\((?:19|20)\d{2}[a-z]?\))?)/,
      label: 'Author as Subject (Menurut / Berdasarkan [Nama])',
      validate: (m) => {
        const name = m[2] ? m[2].toLowerCase().split(/\s+/)[0] : '';
        return !NON_AUTHOR_NOUNS.has(name);
      }
    },
    {
      id: 'reporting_verb',
      re: /\b([A-Z][a-zA-ZÀ-ſ'’\-]+(?:\s+(?:dkk|et al\.?))?(?:\s*\((?:19|20)\d{2}[a-z]?\)))\s+(?:telah\s+|juga\s+)?(?:menemukan|menyatakan|mengemukakan|mengidentifikasi|menjelaskan|berpendapat|mendefinisikan|menegaskan|meneliti|menyimpulkan|membuktikan|menyarankan|menunjukkan)\s+bahwa\b/,
      label: 'Author Reporting Verb ([Pengarang (Tahun)] menyatakan/menemukan bahwa)',
      validate: (m) => {
        const name = m[1] ? m[1].toLowerCase().split(/\s+/)[0] : '';
        return !NON_AUTHOR_NOUNS.has(name);
      }
    },
    {
      id: 'reporting_verb_notyear',
      re: /\b([A-Z][a-zA-ZÀ-ſ'’\-]+(?:\s+(?:dkk|et al\.?)))\s+(?:telah\s+|juga\s+)?(?:menemukan|menyatakan|mengemukakan|mengidentifikasi|menjelaskan|berpendapat|mendefinisikan|menegaskan|meneliti|menyimpulkan|membuktikan|menyarankan|menunjukkan)\s+bahwa\b/,
      label: 'Author Reporting Verb ([Pengarang] menyatakan/menemukan bahwa)',
      validate: (m) => {
        const name = m[1] ? m[1].toLowerCase().split(/\s+/)[0] : '';
        return !NON_AUTHOR_NOUNS.has(name);
      }
    },
    {
      id: 'en_according',
      re: /\baccording to\s+([A-Z][a-zA-ZÀ-ſ'’\-]+(?:\s+et al\.?)?(?:\s*\((?:19|20)\d{2}\))?)/i,
      label: 'Author as Subject (According to [Author])',
      validate: (m) => {
        const name = m[1] ? m[1].toLowerCase().split(/\s+/)[0] : '';
        return !NON_AUTHOR_NOUNS.has(name);
      }
    },
    {
      id: 'en_verb',
      re: /\b([A-Z][a-zA-ZÀ-ſ'’\-]+(?:\s+et al\.?)?\s*\((?:19|20)\d{2}\))\s+(?:have\s+|has\s+|also\s+)?(?:stated|found|argued|claimed|suggested|showed|demonstrated|identified|concluded)\s+that\b/i,
      label: 'Author Reporting Verb ([Author (Year)] argued/found that)',
      validate: (m) => {
        const name = m[1] ? m[1].toLowerCase().split(/\s+/)[0] : '';
        return !NON_AUTHOR_NOUNS.has(name);
      }
    },
    {
      id: 'multi_dump',
      re: /\((?:[A-Z][a-zA-Z\s\-]+,\s*(?:19|20)\d{2}[a-z]?(?:;|\,)\s*){2,}[A-Z][a-zA-Z\s\-]+,\s*(?:19|20)\d{2}[a-z]?\)/,
      label: 'Multi-Citation Cluster Dumping (Penumpukan Sitasi Berlebihan)',
      validate: () => true
    }
  ];

  const CONNECTOR_REGEXES = [
    { id: 'contrast', re: /\b(sementara itu|sementara|namun demikian|namun|sebaliknya|meskipun demikian|kendati demikian|akan tetapi|di sisi lain|berbeda dengan|kendatipun|walaupun demikian|di balik itu|however|in contrast|conversely|whereas|while|nevertheless|nonetheless|on the other hand|despite this|contrary to|yet)\b/i, label: 'Kontras / Konsesi' },
    { id: 'causality', re: /\b(tidak mengherankan|akibatnya|oleh karena itu|dengan demikian|oleh sebab itu|konsekuensinya|dampaknya|hal ini mengindikasikan|secara empiris|secara substansial|secara teoretis|dalam konteks ini|not surprisingly|unsurprisingly|therefore|thus|consequently|as a result|hence|empirically|substantially|theoretically|this indicates that)\b/i, label: 'Kausalitas / Penegasan' },
    { id: 'elaboration', re: /\b(lebih lanjut|selain itu|di samping itu|sejalan dengan hal tersebut|sejalan dengan itu|tidak hanya itu|bahkan|lebih jauh lagi|memperkuat temuan tersebut|furthermore|moreover|in addition|additionally|along these lines|consistently|echoing this)\b/i, label: 'Elaborasi / Penguatan' }
  ];

  function splitSentences(text) {
    if (!text || typeof text !== 'string') return [];
    let safe = text
      .replace(/\bet al\./gi, 'et al@DOT@')
      .replace(/\bdkk\./gi, 'dkk@DOT@')
      .replace(/\be\.g\./gi, 'e@DOT@g@DOT@')
      .replace(/\bi\.e\./gi, 'i@DOT@e@DOT@')
      .replace(/\bvs\./gi, 'vs@DOT@')
      .replace(/\bmis\./gi, 'mis@DOT@')
      .replace(/\bhal\./gi, 'hal@DOT@')
      .replace(/\bno\./gi, 'no@DOT@')
      .replace(/\bdr\./gi, 'dr@DOT@')
      .replace(/\bprof\./gi, 'prof@DOT@');

    const rawSents = safe.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [safe];
    return rawSents.map((s) => s.replace(/@DOT@/g, '.').trim()).filter((s) => s.length > 15);
  }

  function extractWords(sentence) {
    return sentence.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  }

  // Analisis satu paragraf
  function analyzeParagraph(paraText) {
    const cleanedSents = splitSentences(paraText);
    const results = [];
    let prevWords = [];

    cleanedSents.forEach((sent, idx) => {
      const curWords = extractWords(sent);
      let paradeMatch = null;
      for (const pr of PARADE_REGEXES) {
        const m = sent.match(pr.re);
        if (m && pr.validate(m)) {
          paradeMatch = { id: pr.id, label: pr.label, match: m[0] };
          break;
        }
      }

      let connectorMatch = null;
      for (const cr of CONNECTOR_REGEXES) {
        const m = sent.match(cr.re);
        if (m) {
          connectorMatch = { id: cr.id, label: cr.label, match: m[0] };
          break;
        }
      }

      let shared = [];
      if (idx > 0 && prevWords.length > 0) {
        shared = curWords.filter((w) => prevWords.includes(w));
        shared = [...new Set(shared)];
      }

      let chainingType = 'first';
      if (idx > 0) {
        if (shared.length > 0 && connectorMatch) {
          chainingType = 'strong'; // Shared words + connector
        } else if (shared.length > 0 || connectorMatch) {
          chainingType = 'moderate'; // Either shared words or connector
        } else {
          chainingType = 'jump'; // Neither! Abrupt jump
        }
      }

      results.push({
        idx: idx + 1,
        text: sent,
        words: curWords,
        sharedWithPrev: shared,
        connector: connectorMatch,
        parade: paradeMatch,
        chainingType,
        isTopicSentence: idx === 0
      });

      prevWords = curWords;
    });

    return results;
  }

  // Audit menyeluruh naskah (chapters & blocks)
  function auditDocument(chapters, blocks) {
    let totalParagraphs = 0;
    let totalSentences = 0;
    let paradeCount = 0;
    let jumpCount = 0;
    let chainedCount = 0;
    let topicParadeCount = 0;

    const paradeList = [];
    const jumpList = [];
    const topicViolations = [];

    // Filter blok yang berupa paragraf naratif (bukan heading/tabel/singkat)
    const targetBlocks = (blocks || []).filter((b) => b && b.text && b.words >= 25 && !b._toc && !b.numbered);

    targetBlocks.forEach((b) => {
      totalParagraphs++;
      const pAnalysis = analyzeParagraph(b.text);
      totalSentences += pAnalysis.length;

      pAnalysis.forEach((s) => {
        if (s.parade) {
          paradeCount++;
          if (paradeList.length < 15) {
            paradeList.push({
              sentence: s.text,
              match: s.parade.match,
              label: s.parade.label,
              page: b.page || null
            });
          }
        }

        if (s.isTopicSentence && s.parade) {
          topicParadeCount++;
          if (topicViolations.length < 10) {
            topicViolations.push({
              sentence: s.text,
              match: s.parade.match,
              page: b.page || null
            });
          }
        }

        if (s.chainingType === 'jump') {
          jumpCount++;
          if (jumpList.length < 12) {
            jumpList.push({
              sentence: s.text,
              page: b.page || null
            });
          }
        } else if (s.chainingType === 'strong' || s.chainingType === 'moderate') {
          chainedCount++;
        }
      });
    });

    const evaluatedTransitions = totalSentences - totalParagraphs; // Kalimat non-pertama
    const cohesionPct = evaluatedTransitions > 0 ? Math.round((chainedCount / evaluatedTransitions) * 100) : 100;
    const paradeRate = totalSentences > 0 ? (paradeCount / totalSentences) : 0;
    const phenomenonPct = Math.max(0, Math.min(100, Math.round((1 - paradeRate * 2.5) * 100)));

    let styleClass = 'phenomenon';
    let styleLabel = 'Phenomenon-Driven Academic Storytelling (Retorika Naratif Tematik)';
    let styleDesc = 'Penyajian naskah berfokus pada fenomena riil dan konstruksi konsep. Sitasi disematkan rapi sebagai penopang evidensial di dalam kurung, bukan kliping nama pengarang.';

    if (paradeRate > 0.08 || topicParadeCount > 4) {
      styleClass = 'parade';
      styleLabel = 'Parade Literatur / Author-Centric (Kliping Pengarang)';
      styleDesc = 'Terdeteksi banyak kalimat yang diawali nama peneliti ("Menurut X...", "Y menyatakan bahwa..."). Pola ini melelahkan pembaca dan perlu direkonstruksi menjadi sintesis berbasis fenomena.';
    } else if (paradeRate > 0.03 || topicParadeCount > 1) {
      styleClass = 'transitional';
      styleLabel = 'Gaya Transisional / Campuran';
      styleDesc = 'Sebagian paragraf sudah mengusung retorika fenomena, namun masih terdapat pola parade nama pengarang dan kalimat pembuka paragraf yang perlu dipoles.';
    }

    return {
      totalParagraphs,
      totalSentences,
      paradeCount,
      jumpCount,
      chainedCount,
      topicParadeCount,
      cohesionPct,
      phenomenonPct,
      styleClass,
      styleLabel,
      styleDesc,
      paradeList,
      jumpList,
      topicViolations
    };
  }

  global.SintesisEngine = {
    splitSentences,
    extractWords,
    analyzeParagraph,
    auditDocument,
    PARADE_REGEXES,
    CONNECTOR_REGEXES
  };

})(typeof window !== 'undefined' ? window : this);
