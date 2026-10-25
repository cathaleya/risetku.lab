/*
 * Basis aturan diturunkan dari:
 * Panduan Penulisan Tesis & Disertasi Sekolah Pascasarjana UNJ 2025
 * (Keputusan Rektor UNJ No. 970.a/UN39/HK.02/2025).
 * "hal" = nomor halaman cetak pada buku panduan.
 *
 * Setiap item sistematika memiliki daftar `alt` (frasa alternatif) yang
 * dicari pada judul/subjudul naskah. Frasa ditulis dalam huruf kecil tanpa
 * tanda baca karena teks naskah dinormalisasi sebelum dicocokkan.
 */
(function (global) {
  'use strict';

  const JENJANG = {
    tesis: {
      label: 'Tesis (Magister, KKNI level 8)',
      minRujukan: 30,
      minJurnal: 30,
      kata: { proposal: [15000, 20000], lengkap: [30000, 50000] },
      pendekatan: 'multi atau interdisipliner',
      luaran: 'karya inovatif dan teruji',
    },
    disertasi: {
      label: 'Disertasi (Doktor, KKNI level 9)',
      minRujukan: 60,
      minJurnal: 60,
      kata: { proposal: [15000, 20000], lengkap: [50000, 80000] },
      pendekatan: 'multi/interdisipliner atau transdisipliner',
      luaran: 'karya kreatif, original, dan teruji',
    },
  };

  // Bagian awal (hal 23–26). `wajib: false` = dicek tetapi hanya catatan ringan.
  const BAGIAN_AWAL = [
    { id: 'judul', nama: 'Halaman Sampul & Halaman Judul', alt: ['tesis', 'disertasi'], cara: 'judul', hal: '23, Lampiran 1–4' },
    { id: 'pengesahan', nama: 'Lembar Persetujuan/Pengesahan Pembimbing atau Promotor', alt: ['lembar persetujuan', 'halaman pengesahan', 'lembar pengesahan', 'persetujuan pembimbing', 'persetujuan promotor', 'persetujuan panitia ujian', 'persetujuan komisi pembimbing', 'pengesahan perbaikan'], hal: '23, Lampiran 5–16' },
    { id: 'orisinalitas', nama: 'Pernyataan Orisinalitas', alt: ['pernyataan orisinalitas', 'orisinalitas karya', 'pernyataan keaslian', 'bebas plagiat', 'pernyataan bebas plagiarisme'], hal: '23, Lampiran 17' },
    { id: 'publikasi', nama: 'Pernyataan (Persetujuan) Publikasi', alt: ['pernyataan publikasi', 'persetujuan publikasi', 'pernyataan persetujuan publikasi', 'copyright transfer'], hal: '23–24, Lampiran 19–20', lengkapSaja: true },
    { id: 'abstrak', nama: 'Abstrak (Bahasa Indonesia)', alt: ['abstrak'], hal: '24–25, Lampiran 18' },
    { id: 'abstract', nama: 'Abstract (Bahasa Inggris)', alt: ['abstract'], hal: '24–25, Lampiran 18' },
    { id: 'pengantar', nama: 'Kata Pengantar', alt: ['kata pengantar', 'prakata', 'acknowledgement', 'acknowledgment'], hal: '25' },
    { id: 'daftarisi', nama: 'Daftar Isi', alt: ['daftar isi'], hal: '25, Lampiran 21' },
    { id: 'daftargambar', nama: 'Daftar Gambar', alt: ['daftar gambar'], hal: '25–26, Lampiran 22', wajib: false },
    { id: 'daftartabel', nama: 'Daftar Tabel', alt: ['daftar tabel'], hal: '26, Lampiran 23', wajib: false },
    { id: 'daftarlampiran', nama: 'Daftar Lampiran', alt: ['daftar lampiran'], hal: 'Lampiran 21', wajib: false },
  ];

  // Bagian akhir (hal 31–32).
  const BAGIAN_AKHIR = [
    { id: 'pustaka', nama: 'Daftar Pustaka', alt: ['daftar pustaka', 'daftar rujukan', 'daftar referensi', 'references', 'bibliografi'], hal: '31' },
    { id: 'lampiran', nama: 'Lampiran-lampiran', alt: ['lampiran'], hal: '31–32', lengkapSaja: true },
  ];

  // Isi lampiran (hal 31–32, 9–10).
  const ISI_LAMPIRAN = [
    { id: 'instrumen', nama: 'Instrumen Penelitian / Panduan Observasi atau Wawancara', alt: ['instrumen penelitian', 'kuesioner', 'angket', 'pedoman wawancara', 'panduan wawancara', 'pedoman observasi', 'panduan observasi', 'lembar observasi', 'kisi kisi instrumen', 'butir soal', 'lembar validasi'], hal: '31' },
    { id: 'data', nama: 'Data dan Hasil Pengolahan Data', alt: ['data penelitian', 'hasil pengolahan data', 'output spss', 'output', 'tabulasi data', 'data mentah', 'hasil analisis data', 'rekapitulasi data', 'transkrip wawancara', 'catatan lapangan'], hal: '31' },
    { id: 'similarity', nama: 'Surat Keterangan Hasil Pindai Uji Kemiripan Naskah', alt: ['uji kemiripan', 'similarity', 'turnitin', 'cek plagiasi', 'pindai kemiripan', 'plagiarism checker', 'ithenticate'], hal: '32' },
    { id: 'validasi', nama: 'Bukti Validasi Instrumen', alt: ['validasi instrumen', 'validasi ahli', 'expert judgment', 'expert judgement', 'lembar validasi', 'uji validitas', 'hasil validasi'], hal: '9, 32' },
    { id: 'izin', nama: 'Surat Izin Penelitian & Surat Keterangan Telah Mengambil Data', alt: ['surat izin', 'izin penelitian', 'ijin penelitian', 'surat keterangan telah melakukan penelitian', 'surat keterangan penelitian', 'telah melaksanakan penelitian', 'telah melakukan pengambilan data'], hal: '9' },
    { id: 'riwayat', nama: 'Riwayat Hidup Penulis', alt: ['riwayat hidup', 'daftar riwayat hidup', 'curriculum vitae', 'biodata penulis'], hal: '32' },
  ];

  // Komponen sistematika per jenis penelitian (hal 32–39).
  // Bab Pendahuluan umum yang dipakai beberapa jenis.
  const BAB1_KUANT = {
    judul: ['pendahuluan'],
    sub: [
      { nama: 'Latar Belakang Masalah', alt: ['latar belakang'] },
      { nama: 'Identifikasi Masalah', alt: ['identifikasi masalah'] },
      { nama: 'Pembatasan Masalah', alt: ['pembatasan masalah', 'batasan masalah', 'pembatasan penelitian', 'ruang lingkup'] },
      { nama: 'Rumusan Masalah', alt: ['rumusan masalah', 'perumusan masalah', 'pertanyaan penelitian'] },
      { nama: 'Kegunaan Hasil Penelitian', alt: ['kegunaan hasil penelitian', 'kegunaan penelitian', 'manfaat penelitian', 'manfaat hasil penelitian', 'signifikansi penelitian'] },
    ],
  };
  const BAB1_FOKUS = {
    judul: ['pendahuluan'],
    sub: [
      { nama: 'Latar Belakang Masalah', alt: ['latar belakang'] },
      { nama: 'Fokus Penelitian', alt: ['fokus penelitian', 'fokus dan subfokus'] },
      { nama: 'Perumusan Masalah', alt: ['perumusan masalah', 'rumusan masalah', 'pertanyaan penelitian'] },
      { nama: 'Kegunaan Hasil Penelitian', alt: ['kegunaan hasil penelitian', 'kegunaan penelitian', 'manfaat penelitian', 'manfaat hasil penelitian'] },
    ],
  };
  const SUB_TUJUAN = { nama: 'Tujuan Penelitian', alt: ['tujuan penelitian'] };
  const SUB_TEMPAT = { nama: 'Tempat dan Waktu Penelitian', alt: ['tempat dan waktu', 'waktu dan tempat', 'lokasi dan waktu', 'tempat penelitian', 'lokasi penelitian'] };
  const SUB_ANALISIS = { nama: 'Teknik Analisis Data', alt: ['teknik analisis data', 'analisis data', 'prosedur analisis data'] };
  const SUB_PENGUMPULAN = { nama: 'Teknik Pengumpulan Data', alt: ['teknik pengumpulan data', 'pengumpulan data', 'prosedur pengumpulan data'] };
  const BAB5_KIS = {
    judul: ['kesimpulan implikasi dan saran', 'kesimpulan', 'simpulan'],
    sub: [
      { nama: 'Kesimpulan', alt: ['kesimpulan', 'simpulan'] },
      { nama: 'Implikasi', alt: ['implikasi'] },
      { nama: 'Saran', alt: ['saran', 'rekomendasi'] },
    ],
  };

  const JENIS = {
    kualitatif: {
      label: 'Penelitian Kualitatif',
      hal: '32–33',
      pendekatan: 'kualitatif',
      bab: [
        {
          judul: ['pendahuluan'],
          sub: [
            { nama: 'Konteks Penelitian / Latar Belakang', alt: ['konteks penelitian', 'latar belakang'] },
            { nama: 'Fokus dan Subfokus Penelitian', alt: ['fokus dan subfokus', 'fokus penelitian', 'subfokus'] },
            { nama: 'Rumusan Masalah / Pertanyaan Penelitian', alt: ['rumusan masalah', 'pertanyaan penelitian', 'perumusan masalah'] },
            { nama: 'Kegunaan Hasil Penelitian', alt: ['kegunaan hasil penelitian', 'kegunaan penelitian', 'manfaat penelitian'] },
          ],
        },
        {
          judul: ['kajian pustaka', 'tinjauan pustaka', 'kajian teori', 'landasan teori'],
          sub: [
            { nama: 'Deskripsi Konseptual Fokus dan Subfokus Penelitian', alt: ['deskripsi konseptual', 'konsep fokus', 'kajian konseptual'] },
            { nama: 'Hasil Penelitian yang Relevan', alt: ['penelitian yang relevan', 'penelitian relevan', 'hasil penelitian yang relevan', 'penelitian terdahulu', 'kajian penelitian relevan'] },
          ],
        },
        {
          judul: ['metodologi penelitian', 'metode penelitian'],
          sub: [
            SUB_TUJUAN,
            SUB_TEMPAT,
            { nama: 'Latar Penelitian', alt: ['latar penelitian', 'setting penelitian'] },
            { nama: 'Metode dan Prosedur Penelitian', alt: ['metode dan prosedur', 'metode penelitian', 'prosedur penelitian'] },
            { nama: 'Data dan Sumber Data', alt: ['data dan sumber data', 'sumber data'] },
            { nama: 'Teknik dan Prosedur Pengumpulan Data', alt: ['teknik dan prosedur pengumpulan data', 'pengumpulan data'] },
            { nama: 'Prosedur Analisis Data', alt: ['prosedur analisis data', 'analisis data'] },
            { nama: 'Teknik Pemeriksaan Keabsahan Data', alt: ['keabsahan data', 'pemeriksaan keabsahan', 'trustworthiness'] },
            { nama: 'Kredibilitas', alt: ['kredibilitas', 'credibility'], level: 2 },
            { nama: 'Transferabilitas', alt: ['transferabilitas', 'transferbilitas', 'transferability'], level: 2 },
            { nama: 'Dependabilitas', alt: ['dependabilitas', 'depandabilitas', 'dependability'], level: 2 },
            { nama: 'Konfirmabilitas', alt: ['konfirmabilitas', 'confirmability'], level: 2 },
          ],
        },
        {
          judul: ['hasil penelitian'],
          sub: [
            { nama: 'Deskripsi Latar Penelitian', alt: ['deskripsi latar', 'latar penelitian', 'gambaran umum'] },
            { nama: 'Proses Analisis Data', alt: ['proses analisis data', 'analisis data'] },
            { nama: 'Temuan Penelitian', alt: ['temuan penelitian', 'temuan'] },
          ],
        },
        {
          judul: ['pembahasan temuan penelitian', 'pembahasan'],
          sub: [{ nama: 'Pembahasan Temuan Penelitian', alt: ['pembahasan temuan', 'pembahasan'] }],
        },
        {
          judul: ['simpulan dan rekomendasi', 'simpulan', 'kesimpulan'],
          sub: [
            { nama: 'Simpulan', alt: ['simpulan', 'kesimpulan'] },
            { nama: 'Rekomendasi', alt: ['rekomendasi', 'saran'] },
          ],
        },
      ],
    },

    asosiatif: {
      label: 'Penelitian Kuantitatif Asosiatif (korelasional/regresi/SEM/jalur)',
      hal: '33–34',
      pendekatan: 'kuantitatif',
      bab: [
        BAB1_KUANT,
        {
          judul: ['kajian pustaka', 'tinjauan pustaka', 'kajian teori', 'landasan teori'],
          sub: [
            { nama: 'Deskripsi Konseptual', alt: ['deskripsi konseptual', 'kajian teori', 'landasan teori', 'konsep'] },
            { nama: 'Hasil Penelitian yang Relevan', alt: ['penelitian yang relevan', 'penelitian relevan', 'penelitian terdahulu'] },
            { nama: 'Kerangka Teoretik', alt: ['kerangka teoretik', 'kerangka teoritik', 'kerangka teoretis', 'kerangka teoritis', 'kerangka berpikir', 'kerangka pemikiran', 'kerangka konseptual'] },
            { nama: 'Hipotesis Penelitian', alt: ['hipotesis penelitian', 'hipotesis'] },
          ],
        },
        {
          judul: ['metodologi penelitian', 'metode penelitian'],
          sub: [
            SUB_TUJUAN,
            SUB_TEMPAT,
            { nama: 'Metode Penelitian', alt: ['metode penelitian', 'desain penelitian', 'rancangan penelitian'] },
            { nama: 'Populasi dan Sampel', alt: ['populasi dan sampel', 'populasi', 'sampel'] },
            SUB_PENGUMPULAN,
            SUB_ANALISIS,
            { nama: 'Hipotesis Statistika', alt: ['hipotesis statistik', 'hipotesis statistika'] },
          ],
        },
        {
          judul: ['hasil penelitian dan pembahasan', 'hasil penelitian', 'pembahasan'],
          sub: [
            { nama: 'Deskripsi Data', alt: ['deskripsi data', 'statistik deskriptif'] },
            { nama: 'Pengujian Persyaratan Analisis Data', alt: ['persyaratan analisis', 'uji persyaratan', 'uji asumsi', 'pengujian persyaratan'] },
            { nama: 'Pengujian Hipotesis', alt: ['pengujian hipotesis', 'uji hipotesis'] },
            { nama: 'Pembahasan Hasil Penelitian', alt: ['pembahasan'] },
          ],
        },
        BAB5_KIS,
      ],
    },

    eksperimen: {
      label: 'Penelitian Eksperimen / Kuasi Eksperimen',
      hal: '34–35',
      pendekatan: 'kuantitatif',
      bab: [
        BAB1_KUANT,
        {
          judul: ['kajian pustaka', 'tinjauan pustaka', 'kajian teori', 'landasan teori'],
          sub: [
            { nama: 'Deskripsi Konseptual Variabel', alt: ['deskripsi konseptual', 'kajian teori', 'konsep'] },
            { nama: 'Hasil Penelitian Relevan', alt: ['penelitian yang relevan', 'penelitian relevan', 'penelitian terdahulu'] },
            { nama: 'Kerangka Teoretik', alt: ['kerangka teoretik', 'kerangka teoritik', 'kerangka teoretis', 'kerangka berpikir', 'kerangka pemikiran'] },
            { nama: 'Hipotesis Penelitian', alt: ['hipotesis penelitian', 'hipotesis'] },
          ],
        },
        {
          judul: ['metodologi penelitian', 'metode penelitian'],
          sub: [
            SUB_TUJUAN,
            SUB_TEMPAT,
            { nama: 'Metode Penelitian (termasuk rancangan eksperimen)', alt: ['metode penelitian', 'rancangan eksperimen', 'desain eksperimen', 'desain penelitian'] },
            { nama: 'Populasi dan Sampel', alt: ['populasi dan sampel', 'populasi', 'sampel'] },
            { nama: 'Rancangan Perlakuan', alt: ['rancangan perlakuan', 'perlakuan', 'treatment'] },
            { nama: 'Kontrol Validitas Internal dan Eksternal', alt: ['validitas internal', 'validitas eksternal', 'kontrol validitas'] },
            SUB_PENGUMPULAN,
            SUB_ANALISIS,
            { nama: 'Hipotesis Statistika', alt: ['hipotesis statistik', 'hipotesis statistika'] },
          ],
        },
        {
          judul: ['hasil penelitian dan pembahasan', 'hasil penelitian', 'pembahasan'],
          sub: [
            { nama: 'Deskripsi Data', alt: ['deskripsi data', 'statistik deskriptif'] },
            { nama: 'Pengujian Persyaratan Analisis Data', alt: ['persyaratan analisis', 'uji persyaratan', 'uji asumsi', 'uji normalitas'] },
            { nama: 'Pengujian Hipotesis', alt: ['pengujian hipotesis', 'uji hipotesis'], wajib: false },
            { nama: 'Pembahasan Hasil Penelitian', alt: ['pembahasan'] },
          ],
        },
        BAB5_KIS,
      ],
    },

    rnd: {
      label: 'Penelitian dan Pengembangan (R&D) – Pengembangan Model/Produk',
      hal: '35–36',
      pendekatan: 'rnd',
      bab: [
        BAB1_FOKUS,
        {
          judul: ['kajian pustaka', 'tinjauan pustaka', 'kajian teori', 'landasan teori'],
          sub: [
            { nama: 'Konsep Pengembangan Model', alt: ['konsep pengembangan model', 'model pengembangan', 'konsep pengembangan'] },
            { nama: 'Konsep Model yang Dikembangkan', alt: ['konsep model yang dikembangkan', 'model yang dikembangkan', 'produk yang dikembangkan'] },
            { nama: 'Hasil Penelitian yang Relevan', alt: ['penelitian yang relevan', 'penelitian relevan', 'penelitian terdahulu'] },
            { nama: 'Kerangka Teoretik', alt: ['kerangka teoretik', 'kerangka teoritik', 'kerangka teoretis', 'kerangka berpikir', 'kerangka pemikiran'] },
            { nama: 'Rancangan Model', alt: ['rancangan model', 'desain model', 'rancangan produk', 'model hipotetik', 'draf model'] },
          ],
        },
        {
          judul: ['metodologi penelitian', 'metode penelitian'],
          sub: [
            SUB_TUJUAN,
            SUB_TEMPAT,
            { nama: 'Metode Penelitian dan Desain Penelitian', alt: ['metode penelitian', 'desain penelitian', 'desain pengembangan', 'prosedur pengembangan'] },
            { nama: 'Pengembangan Instrumen Validasi Model/Produk dan Uji Efektivitas', alt: ['instrumen validasi', 'pengembangan instrumen', 'instrumen penelitian', 'uji efektivitas'] },
            { nama: 'Validasi dan Pengujian Model/Produk', alt: ['validasi model', 'validasi produk', 'pengujian model', 'uji coba model', 'uji coba produk', 'validasi dan pengujian'] },
            { nama: 'Analisis Data Penelitian', alt: ['analisis data'] },
          ],
        },
        {
          judul: ['hasil penelitian dan pembahasan', 'hasil penelitian', 'pembahasan'],
          sub: [
            { nama: 'Proses Pengembangan Model (sesuai langkah desain pengembangan)', alt: ['proses pengembangan', 'tahap pengembangan', 'langkah pengembangan'] },
            { nama: 'Hasil Pengembangan Model', alt: ['hasil pengembangan', 'produk akhir', 'model akhir'] },
            { nama: 'Kelayakan Model (teoretik dan empiris)', alt: ['kelayakan model', 'kelayakan produk', 'kelayakan'], level: 2 },
            { nama: 'Efektivitas Model (melalui uji coba)', alt: ['efektivitas model', 'efektivitas produk', 'efektivitas', 'keefektifan'], level: 2 },
            { nama: 'Pembahasan (subjudul sesuai perumusan masalah)', alt: ['pembahasan'] },
          ],
        },
        BAB5_KIS,
      ],
    },

    instrumen: {
      label: 'Penelitian Pengembangan Instrumen',
      hal: '36–37',
      pendekatan: 'instrumen',
      bab: [
        BAB1_FOKUS,
        {
          judul: ['kajian pustaka', 'tinjauan pustaka', 'kajian teori', 'landasan teori'],
          sub: [
            { nama: 'Konsep Pengembangan Instrumen', alt: ['konsep pengembangan instrumen', 'pengembangan instrumen'] },
            { nama: 'Konsep Variabel yang akan Diukur', alt: ['konsep variabel', 'variabel yang akan diukur', 'variabel yang diukur', 'konstruk'] },
            { nama: 'Konsep Analisis Data yang Digunakan', alt: ['konsep analisis data', 'analisis data yang digunakan', 'teori respons butir', 'item response theory', 'teori tes klasik', 'analisis faktor'] },
            { nama: 'Penskoran Hasil Pengukuran', alt: ['penskoran hasil', 'pensekoran hasil', 'penskoran', 'pensekoran', 'skoring', 'scoring'] },
            { nama: 'Hasil Penelitian yang Relevan', alt: ['penelitian yang relevan', 'penelitian relevan', 'penelitian terdahulu'] },
            { nama: 'Kerangka Berpikir', alt: ['kerangka berpikir', 'kerangka teoretik', 'kerangka teoritik', 'kerangka pemikiran'] },
          ],
        },
        {
          judul: ['metodologi penelitian', 'metode penelitian'],
          sub: [
            SUB_TUJUAN,
            { nama: 'Prosedur/Tahapan Pengembangan Instrumen', alt: ['prosedur pengembangan instrumen', 'tahapan pengembangan instrumen', 'langkah pengembangan instrumen', 'prosedur pengembangan', 'tahapan pengembangan'] },
            { nama: 'Metode Pengujian Instrumen Penelitian', alt: ['metode pengujian instrumen', 'pengujian instrumen', 'uji coba instrumen'] },
            { nama: 'Karakteristik Responden dan Teknik Pengambilan Sampel', alt: ['karakteristik responden', 'teknik pengambilan sampel', 'teknik sampling', 'sampel penelitian'] },
            { nama: 'Instrumen Ukur yang Dikembangkan (Definisi Konseptual, Operasional, Kisi-kisi)', alt: ['instrumen ukur', 'instrumen yang dikembangkan', 'definisi konseptual', 'kisi kisi'] },
            SUB_ANALISIS,
          ],
        },
        {
          judul: ['hasil penelitian dan pembahasan', 'hasil penelitian', 'pembahasan'],
          sub: [
            { nama: 'Hasil Penelitian', alt: ['hasil penelitian'] },
            { nama: 'Pembahasan Instrumen yang Dihasilkan', alt: ['pembahasan instrumen', 'instrumen yang dihasilkan', 'pembahasan'] },
            { nama: 'Pedoman Penggunaan Instrumen', alt: ['pedoman penggunaan instrumen', 'pedoman penggunaan', 'panduan penggunaan instrumen', 'manual instrumen'] },
          ],
        },
        BAB5_KIS,
      ],
    },

    kebijakan: {
      label: 'Penelitian Kebijakan / Implementasi Kebijakan',
      hal: '37',
      pendekatan: 'kebijakan',
      bab: [
        {
          judul: ['pendahuluan'],
          sub: [
            { nama: 'Latar Belakang Masalah', alt: ['latar belakang'] },
            { nama: 'Ruang Lingkup Penelitian', alt: ['ruang lingkup', 'fokus penelitian', 'pembatasan'] },
            { nama: 'Rumusan Masalah', alt: ['rumusan masalah', 'perumusan masalah', 'pertanyaan penelitian'] },
            { nama: 'Kegunaan Hasil Penelitian', alt: ['kegunaan hasil penelitian', 'kegunaan penelitian', 'manfaat penelitian'] },
          ],
        },
        {
          judul: ['kajian pustaka', 'tinjauan pustaka', 'kajian teori', 'landasan teori'],
          sub: [
            { nama: 'Konsep Model Penelitian Kebijakan/Implementasi Kebijakan yang Dipilih', alt: ['model penelitian kebijakan', 'model implementasi kebijakan', 'konsep model', 'model kebijakan', 'implementasi kebijakan'] },
            { nama: 'Analisis Konten dan Konteks Kebijakan', alt: ['analisis konten', 'konten dan konteks', 'konteks kebijakan', 'isi kebijakan'] },
            { nama: 'Hasil Penelitian yang Relevan', alt: ['penelitian yang relevan', 'penelitian relevan', 'penelitian terdahulu'] },
            { nama: 'Kriteria Evaluasi Kebijakan/Implementasi Kebijakan', alt: ['kriteria evaluasi', 'kriteria keberhasilan'] },
          ],
        },
        {
          judul: ['metodologi penelitian', 'metode penelitian'],
          sub: [
            SUB_TUJUAN,
            SUB_TEMPAT,
            { nama: 'Jenis dan Metode Penelitian', alt: ['jenis dan metode', 'metode penelitian', 'jenis penelitian'] },
            { nama: 'Teknik dan Prosedur Pengumpulan Data', alt: ['pengumpulan data'] },
            SUB_ANALISIS,
          ],
        },
        {
          judul: ['hasil penelitian'],
          sub: [
            { nama: 'Hasil Evaluasi Kebijakan/Implementasi Kebijakan', alt: ['hasil evaluasi', 'hasil analisis kebijakan', 'hasil penelitian'] },
            { nama: 'Pembahasan', alt: ['pembahasan'] },
          ],
        },
        {
          judul: ['kesimpulan dan rekomendasi', 'kesimpulan', 'simpulan'],
          sub: [
            { nama: 'Kesimpulan', alt: ['kesimpulan', 'simpulan'] },
            { nama: 'Rekomendasi', alt: ['rekomendasi', 'saran'] },
          ],
        },
      ],
    },

    evaluasi: {
      label: 'Penelitian Evaluasi (Program)',
      hal: '38',
      pendekatan: 'evaluasi',
      bab: [
        BAB1_FOKUS,
        {
          judul: ['kajian pustaka', 'tinjauan pustaka', 'kajian teori', 'landasan teori'],
          sub: [
            { nama: 'Model Evaluasi yang Dipilih', alt: ['model evaluasi', 'cipp', 'kirkpatrick', 'countenance', 'discrepancy'] },
            { nama: 'Konsep Objek yang Dievaluasi', alt: ['objek yang dievaluasi', 'konsep objek', 'konsep program', 'program yang dievaluasi'] },
            { nama: 'Hasil Penelitian yang Relevan', alt: ['penelitian yang relevan', 'penelitian relevan', 'penelitian terdahulu'] },
            { nama: 'Kriteria Evaluasi', alt: ['kriteria evaluasi', 'kriteria keberhasilan', 'standar evaluasi'] },
          ],
        },
        {
          judul: ['metodologi penelitian', 'metode penelitian'],
          sub: [
            SUB_TUJUAN,
            SUB_TEMPAT,
            { nama: 'Pendekatan, Metode, dan Desain Penelitian', alt: ['pendekatan', 'metode penelitian', 'desain penelitian', 'desain evaluasi'] },
            { nama: 'Instrumen Penelitian', alt: ['instrumen penelitian', 'instrumen evaluasi', 'instrumen'] },
            { nama: 'Teknik dan Prosedur Pengumpulan Data', alt: ['pengumpulan data'] },
            SUB_ANALISIS,
          ],
        },
        {
          judul: ['hasil penelitian'],
          sub: [
            { nama: 'Hasil Evaluasi', alt: ['hasil evaluasi', 'hasil penelitian'] },
            { nama: 'Pembahasan', alt: ['pembahasan'] },
          ],
        },
        {
          judul: ['kesimpulan dan rekomendasi', 'kesimpulan', 'simpulan'],
          sub: [
            { nama: 'Kesimpulan', alt: ['kesimpulan', 'simpulan'] },
            { nama: 'Rekomendasi/Saran', alt: ['rekomendasi', 'saran'] },
          ],
        },
      ],
    },

    tindakan: {
      label: 'Penelitian Tindakan (PTK/Action Research)',
      hal: '38–39',
      pendekatan: 'tindakan',
      bab: [
        BAB1_FOKUS,
        {
          judul: ['kajian pustaka', 'tinjauan pustaka', 'kajian teori', 'landasan teori'],
          sub: [
            { nama: 'Landasan Teori', alt: ['landasan teori', 'kajian teori', 'deskripsi konseptual'] },
            { nama: 'Konsep Intervensi Tindakan', alt: ['intervensi tindakan', 'konsep intervensi', 'konsep tindakan'] },
            { nama: 'Hasil Penelitian yang Relevan', alt: ['penelitian yang relevan', 'penelitian relevan', 'penelitian terdahulu'] },
            { nama: 'Hipotesis Tindakan', alt: ['hipotesis tindakan'] },
          ],
        },
        {
          judul: ['metodologi penelitian', 'metode penelitian'],
          sub: [
            SUB_TUJUAN,
            SUB_TEMPAT,
            { nama: 'Pendekatan dan Metode Penelitian', alt: ['pendekatan dan metode', 'metode penelitian', 'desain penelitian'] },
            { nama: 'Rancangan Tindakan yang Dikembangkan', alt: ['rancangan tindakan', 'desain tindakan', 'rencana tindakan'] },
            { nama: 'Langkah-langkah Penerapan Tindakan', alt: ['langkah langkah penerapan', 'penerapan tindakan', 'prosedur tindakan', 'siklus'] },
          ],
        },
        {
          judul: ['hasil penelitian dan pembahasan', 'hasil penelitian', 'pembahasan'],
          sub: [
            { nama: 'Hasil Penerapan Tindakan', alt: ['hasil penerapan tindakan', 'hasil tindakan', 'hasil siklus', 'deskripsi siklus'] },
            { nama: 'Analisis Keberhasilan Tindakan', alt: ['keberhasilan tindakan', 'analisis keberhasilan', 'indikator keberhasilan'] },
            { nama: 'Pembahasan', alt: ['pembahasan'] },
          ],
        },
        BAB5_KIS,
      ],
    },
  };

  /*
   * Kriteria substansi isi (hal 4–10, 26–31). Dicek dengan mencari
   * indikator kata kunci di dalam teks bab yang relevan.
   *  bab   : indeks bab (0 = Bab I) tempat kriteria seharusnya muncul,
   *          'any' = seluruh bagian inti, 'abstrak' = abstrak.
   *  kw    : kumpulan kata kunci; kriteria terpenuhi bila `min` kata kunci ada.
   *  untuk : batasi ke jenis tertentu (array) atau pendekatan.
   *  tahap : 'lengkap' bila hanya untuk naskah lengkap (Bab IV–V).
   */
  const KRITERIA_ISI = [
    // ---------- BAB I ----------
    { id: 'dassollen', bab: 0, nama: 'Das sollen (masalah teoretis / kondisi ideal menurut teori)', kw: ['das sollen', 'theoretical problem', 'masalah teoretis', 'kondisi ideal', 'seharusnya', 'idealnya'], hal: '26', saran: 'Uraikan das sollen: kondisi ideal berdasarkan teori yang menjadi acuan topik.' },
    { id: 'dassein', bab: 0, nama: 'Das sein (masalah empiris: fenomena lokal, nasional, internasional)', kw: ['das sein', 'empirical problem', 'masalah empiris', 'fenomena', 'kenyataan', 'faktanya', 'data menunjukkan'], hal: '26', saran: 'Tampilkan das sein: fenomena/peristiwa empiris di tingkat lokal, nasional, dan internasional yang didukung data/penelitian terdahulu.' },
    { id: 'tingkat', bab: 0, nama: 'Fenomena tingkat lokal, nasional, dan internasional', kw: ['lokal', 'nasional', 'internasional', 'global', 'dunia'], min: 3, hal: '26', saran: 'Latar belakang belum memperlihatkan fenomena pada tingkat lokal, nasional, dan internasional sekaligus.' },
    { id: 'kesenjangan', bab: 0, nama: 'Kesenjangan das sollen–das sein sebagai sumber masalah', kw: ['kesenjangan', 'kesenjangan antara', 'gap antara', 'ketimpangan', 'diskrepansi', 'discrepancy'], hal: '26', saran: 'Tegaskan kesenjangan antara das sollen dan das sein yang melahirkan masalah penelitian.' },
    { id: 'sota', bab: 0, nama: 'State of the art dari penelitian terdahulu', kw: ['state of the art', 'state of art', 'posisi penelitian', 'pemetaan penelitian'], hal: '26–27', saran: 'Sajikan state of the art berdasarkan analisis penelitian terdahulu yang relevan (bisa dalam bentuk tabel/matriks).' },
    { id: 'gap', bab: 0, nama: 'Research gap (celah penelitian)', kw: ['research gap', 'celah penelitian', 'celah', 'gap penelitian', 'belum diteliti', 'belum ada penelitian', 'belum banyak'], hal: '27', saran: 'Nyatakan research gap secara eksplisit yang dihasilkan dari state of the art.' },
    { id: 'novelty', bab: 0, nama: 'Kebaruan (novelty) penelitian', kw: ['kebaruan', 'novelty', 'unsur baru', 'orisinalitas penelitian'], hal: '27', saran: 'Nyatakan kebaruan (novelty) penelitian: topik, model, media, metode, subjek, kasus, dll.' },
    { id: 'roadmap', bab: 'any', nama: 'Kesesuaian dengan roadmap penelitian program studi', kw: ['roadmap', 'road map', 'peta jalan penelitian'], hal: '2', saran: 'Tunjukkan keterkaitan topik dengan roadmap penelitian program studi.', wajib: false },
    { id: 'paradigma', bab: 'any', nama: 'Paradigma penelitian dinyatakan (positivisme/post-positivisme, dll.)', kw: ['paradigma', 'positivis', 'post positivis', 'postpositivis', 'konstruktivis', 'pragmatis'], hal: '27', saran: 'Sebutkan paradigma penelitian agar alur berpikir latar belakang konsisten dengan pendekatan.', wajib: false },
    { id: 'interdisiplin', bab: 'any', nama: 'Pendekatan multi/inter(/trans)disipliner', kw: ['multidisiplin', 'interdisiplin', 'transdisiplin', 'multi disiplin', 'inter disiplin', 'lintas disiplin'], hal: '6–7', saran: 'Panduan mewajibkan pendekatan multi/interdisipliner (magister) atau multi/inter/transdisipliner (doktor). Jelaskan secara eksplisit.' },
    { id: 'tanya', bab: 0, nama: 'Rumusan masalah/pertanyaan penelitian berbentuk kalimat tanya', khusus: 'kalimatTanya', hal: '27–28', saran: 'Tulis rumusan masalah/pertanyaan penelitian dalam bentuk kalimat tanya yang singkat, padat, dan jelas.' },
    { id: 'tujuan', bab: [0, 2], nama: 'Tujuan penelitian', kw: ['tujuan penelitian', 'penelitian ini bertujuan', 'bertujuan untuk'], hal: '28', saran: 'Cantumkan tujuan penelitian yang spesifik (dapat diletakkan di Bab I atau Bab III sesuai sistematika).' },
    { id: 'kontribusi', bab: 'any', nama: 'Kontribusi pada disiplin keilmuan, pembangunan & kesejahteraan masyarakat', kw: ['kontribusi', 'manfaat teoretis', 'manfaat praktis', 'kegunaan teoretis', 'kegunaan praktis', 'kesejahteraan masyarakat', 'pembangunan'], hal: '5', saran: 'Uraikan kontribusi penelitian terhadap disiplin keilmuan serta pembangunan dan kesejahteraan masyarakat.' },

    // ---------- BAB II ----------
    { id: 'grand', bab: 1, nama: 'Teori / grand theory yang menjadi landasan', kw: ['grand theory', 'teori utama', 'landasan teori', 'kajian teori', 'deskripsi konseptual', 'teori'], hal: '29', saran: 'Tegaskan teori/grand theory yang menjadi landasan penelitian.' },
    { id: 'relevan', bab: 1, nama: 'Kajian penelitian yang relevan (kritis & perbandingan)', kw: ['penelitian yang relevan', 'penelitian relevan', 'penelitian terdahulu', 'penelitian sebelumnya', 'studi sebelumnya'], hal: '29', saran: 'Tambahkan kajian kritis penelitian relevan yang menunjukkan perbedaan dengan penelitian Anda.' },
    { id: 'novelty2', bab: 1, nama: 'Penegasan kebaruan secara lebih rinci di kajian pustaka', kw: ['kebaruan', 'novelty', 'perbedaan dengan penelitian', 'berbeda dengan penelitian', 'membedakan penelitian ini'], hal: '29', saran: 'Panduan meminta kebaruan dipertegas kembali di tinjauan pustaka, lebih rinci (kritik/evaluasi teori).' },
    { id: 'kerangka', bab: 1, nama: 'Kerangka teoretik / kerangka berpikir', kw: ['kerangka teoretik', 'kerangka teoritik', 'kerangka teoretis', 'kerangka teoritis', 'kerangka berpikir', 'kerangka pemikiran', 'kerangka konseptual'], hal: '29', saran: 'Susun kerangka teoretik/kerangka berpikir yang mengoperasionalkan teori.', untuk: ['asosiatif', 'eksperimen', 'rnd', 'instrumen', 'tindakan'] },
    { id: 'hipotesis', bab: 1, nama: 'Hipotesis penelitian', kw: ['hipotesis penelitian', 'hipotesis'], hal: '29', saran: 'Penelitian kuantitatif wajib merumuskan hipotesis penelitian di akhir kajian pustaka.', untuk: ['asosiatif', 'eksperimen'] },
    { id: 'modelpengembangan', bab: 1, nama: 'Model pengembangan (R&D) yang dirujuk', kw: ['model pengembangan', 'addie', 'borg', 'gall', 'dick and carey', '4d', 'thiagarajan', 'plomp', 'design based research', 'rancangan model'], hal: '29', saran: 'Penelitian R&D harus menjelaskan model pengembangan yang digunakan (mis. ADDIE, Borg & Gall, 4D) dan rancangan model.', untuk: ['rnd'] },

    // ---------- BAB III (kuantitatif: 9 komponen minimal, hal 30) ----------
    { id: 'm_waktu', bab: 2, nama: 'Waktu dan tempat penelitian', kw: ['waktu penelitian', 'tempat penelitian', 'lokasi penelitian', 'waktu dan tempat', 'tempat dan waktu'], hal: '30', saran: 'Cantumkan waktu dan tempat penelitian.' },
    { id: 'm_desain', bab: 2, nama: 'Desain penelitian', kw: ['desain penelitian', 'rancangan penelitian', 'desain eksperimen', 'research design'], hal: '30', saran: 'Jelaskan desain penelitian (disertai gambar/konstelasi bila perlu).', untuk: ['asosiatif', 'eksperimen', 'rnd', 'evaluasi', 'instrumen'] },
    { id: 'm_variabel', bab: 2, nama: 'Variabel penelitian', kw: ['variabel penelitian', 'variabel bebas', 'variabel terikat', 'variabel independen', 'variabel dependen', 'variabel eksogen', 'variabel endogen'], hal: '30', saran: 'Uraikan variabel penelitian.', untuk: ['asosiatif', 'eksperimen'] },
    { id: 'm_populasi', bab: 2, nama: 'Populasi dan sampel', kw: ['populasi', 'sampel', 'teknik sampling', 'sampling'], min: 2, hal: '30', saran: 'Jelaskan populasi, sampel, dan teknik pengambilan sampel.', untuk: ['asosiatif', 'eksperimen', 'instrumen'] },
    { id: 'm_teknik', bab: 2, nama: 'Teknik pengumpulan data (wawancara, kuesioner, dokumentasi, observasi)', kw: ['kuesioner', 'angket', 'wawancara', 'observasi', 'dokumentasi', 'tes'], hal: '30', saran: 'Sebutkan teknik pengumpulan data yang digunakan.' },
    { id: 'm_defkons', bab: 2, nama: 'Instrumen: definisi konseptual', kw: ['definisi konseptual'], hal: '30, 36', saran: 'Instrumen harus memuat definisi konseptual setiap variabel.', untuk: ['asosiatif', 'eksperimen', 'instrumen', 'rnd'] },
    { id: 'm_defop', bab: 2, nama: 'Instrumen: definisi operasional', kw: ['definisi operasional'], hal: '30, 36', saran: 'Instrumen harus memuat definisi operasional setiap variabel.', untuk: ['asosiatif', 'eksperimen', 'instrumen', 'rnd'] },
    { id: 'm_kisi', bab: 2, nama: 'Instrumen: kisi-kisi', kw: ['kisi kisi', 'kisi-kisi', 'blueprint', 'kisi'], hal: '30, 36', saran: 'Lampirkan/uraikan kisi-kisi instrumen (dimensi, indikator, nomor butir).', untuk: ['asosiatif', 'eksperimen', 'instrumen', 'rnd', 'evaluasi'] },
    { id: 'm_validitas', bab: 2, nama: 'Uji validitas instrumen', kw: ['validitas', 'valid', 'expert judgment', 'expert judgement', 'validasi ahli', 'cvr', 'cvi', 'aiken'], hal: '9, 30', saran: 'Jelaskan uji validitas instrumen (validitas isi/konstruk) beserta hasil uji coba empirisnya.', untuk: ['asosiatif', 'eksperimen', 'instrumen', 'rnd', 'evaluasi'] },
    { id: 'm_reliabilitas', bab: 2, nama: 'Uji reliabilitas instrumen', kw: ['reliabilitas', 'reliability', 'alpha cronbach', 'cronbach', 'kr 20', 'koefisien alpha', 'omega'], hal: '9, 30', saran: 'Jelaskan uji reliabilitas instrumen beserta koefisiennya.', untuk: ['asosiatif', 'eksperimen', 'instrumen', 'rnd', 'evaluasi'] },
    { id: 'm_ujicoba', bab: 'any', nama: 'Uji coba instrumen secara empiris', kw: ['uji coba instrumen', 'ujicoba instrumen', 'try out', 'tryout', 'uji coba empiris', 'uji coba terbatas'], hal: '9', saran: 'Panduan mensyaratkan bukti uji coba empiris instrumen (data & foto) untuk menguji validitas dan reliabilitas.', untuk: ['asosiatif', 'eksperimen', 'instrumen', 'rnd', 'evaluasi'] },
    { id: 'm_analisis', bab: 2, nama: 'Teknik analisis data', kw: ['analisis data', 'teknik analisis'], hal: '30', saran: 'Uraikan teknik analisis data yang sesuai dengan rumusan masalah.' },
    { id: 'm_hipstat', bab: 2, nama: 'Hipotesis statistik (H0 dan H1)', kw: ['hipotesis statistik', 'hipotesis statistika', 'h0', 'h1', 'hipotesis nol', 'hipotesis alternatif'], hal: '30', saran: 'Tuliskan hipotesis statistik (H₀ dan H₁) untuk setiap hipotesis penelitian.', untuk: ['asosiatif', 'eksperimen'] },
    { id: 'm_eksperimen', bab: 2, nama: 'Kelompok eksperimen–kontrol & kontrol validitas internal/eksternal', kw: ['kelompok eksperimen', 'kelompok kontrol', 'validitas internal', 'validitas eksternal'], min: 2, hal: '34', saran: 'Jelaskan rancangan perlakuan, kelompok eksperimen–kontrol, serta kontrol validitas internal dan eksternal.', untuk: ['eksperimen'] },

    // ---------- BAB III kualitatif (6 komponen minimal, hal 30) ----------
    { id: 'q_pendekatan', bab: 2, nama: 'Pendekatan dan jenis penelitian kualitatif', kw: ['fenomenologi', 'etnografi', 'studi kasus', 'grounded theory', 'naratif', 'kualitatif'], hal: '30', saran: 'Nyatakan pendekatan dan jenis penelitian kualitatif (fenomenologi, etnografi, studi kasus, dll.).', untuk: ['kualitatif'] },
    { id: 'q_sumber', bab: 2, nama: 'Sumber data / informan', kw: ['sumber data', 'informan', 'partisipan', 'key informant', 'informan kunci'], hal: '30', saran: 'Jelaskan sumber data dan informan penelitian.', untuk: ['kualitatif', 'kebijakan', 'evaluasi'] },
    { id: 'q_peneliti', bab: 2, nama: 'Peneliti sebagai instrumen utama (observasi partisipatif, wawancara mendalam, analisis dokumen)', kw: ['instrumen utama', 'human instrument', 'peneliti sebagai instrumen', 'observasi partisipatif', 'wawancara mendalam', 'in depth interview', 'analisis dokumen', 'studi dokumen'], hal: '9', saran: 'Tegaskan peneliti sebagai instrumen utama dan teknik observasi partisipatif, wawancara mendalam, serta analisis dokumen.', untuk: ['kualitatif'] },
    { id: 'q_keabsahan', bab: 2, nama: 'Keabsahan data (kredibilitas, transferabilitas, dependabilitas, konfirmabilitas)', kw: ['kredibilitas', 'transferabilitas', 'transferbilitas', 'dependabilitas', 'depandabilitas', 'konfirmabilitas', 'triangulasi', 'member check'], min: 3, hal: '30, 32', saran: 'Uraikan teknik pemeriksaan keabsahan data: kredibilitas, transferabilitas, dependabilitas, dan konfirmabilitas.', untuk: ['kualitatif'] },
    { id: 'q_analisis', bab: 2, nama: 'Model analisis data kualitatif', kw: ['miles', 'huberman', 'spradley', 'reduksi data', 'kondensasi data', 'penyajian data', 'penarikan kesimpulan', 'analisis tematik', 'coding', 'koding', 'nvivo', 'atlas ti'], hal: '30, 33', saran: 'Sebutkan model analisis data kualitatif yang digunakan (mis. Miles & Huberman, Spradley, analisis tematik).', untuk: ['kualitatif'] },

    // ---------- BAB III jenis khusus ----------
    { id: 'r_validasi', bab: 'any', nama: 'Validasi model/produk (ahli & empiris) dan uji efektivitas', kw: ['validasi ahli', 'validasi model', 'validasi produk', 'uji efektivitas', 'uji coba lapangan', 'uji coba terbatas', 'kelayakan model', 'efektivitas model'], min: 2, hal: '35–36', saran: 'Tunjukkan validasi model/produk (teoretik oleh ahli dan empiris) serta pengujian efektivitas melalui uji coba.', untuk: ['rnd'] },
    { id: 'i_psikometri', bab: 'any', nama: 'Analisis psikometrik instrumen (validitas konstruk, reliabilitas, karakteristik butir)', kw: ['analisis faktor', 'efa', 'cfa', 'confirmatory factor', 'exploratory factor', 'irt', 'item response', 'rasch', 'teori tes klasik', 'daya beda', 'tingkat kesukaran', 'loading factor', 'goodness of fit'], min: 2, hal: '36–37', saran: 'Penelitian pengembangan instrumen perlu analisis psikometrik (EFA/CFA, IRT/Rasch, daya beda, tingkat kesukaran, reliabilitas).', untuk: ['instrumen'] },
    { id: 'i_skor', bab: 'any', nama: 'Penskoran hasil pengukuran & pedoman penggunaan instrumen', kw: ['penskoran', 'pensekoran', 'skoring', 'pedoman penggunaan', 'norma', 'kategori skor', 'interpretasi skor'], min: 2, hal: '36–37', saran: 'Sertakan sistem penskoran, norma/interpretasi skor, dan pedoman penggunaan instrumen.', untuk: ['instrumen'] },
    { id: 'e_model', bab: 'any', nama: 'Model evaluasi & kriteria keberhasilan program', kw: ['cipp', 'kirkpatrick', 'countenance', 'discrepancy', 'stake', 'model evaluasi', 'kriteria evaluasi', 'kriteria keberhasilan'], min: 2, hal: '38', saran: 'Nyatakan model evaluasi yang dipilih dan kriteria evaluasi sebagai tolok ukur.', untuk: ['evaluasi'] },
    { id: 'k_model', bab: 'any', nama: 'Model analisis kebijakan & analisis konten–konteks', kw: ['edward iii', 'van meter', 'van horn', 'grindle', 'mazmanian', 'sabatier', 'dunn', 'konten kebijakan', 'konteks kebijakan', 'implementasi kebijakan', 'kriteria evaluasi'], min: 2, hal: '37', saran: 'Uraikan model analisis/implementasi kebijakan yang dipilih, analisis konten & konteks, dan kriteria evaluasinya.', untuk: ['kebijakan'] },
    { id: 't_siklus', bab: 'any', nama: 'Siklus tindakan & indikator keberhasilan', kw: ['siklus', 'perencanaan', 'pelaksanaan', 'observasi', 'refleksi', 'indikator keberhasilan', 'kemmis', 'mctaggart'], min: 3, hal: '38–39', saran: 'Jelaskan siklus tindakan (perencanaan–pelaksanaan–observasi–refleksi) dan indikator keberhasilan tindakan.', untuk: ['tindakan'] },

    // ---------- BAB IV–V (hanya naskah lengkap) ----------
    { id: 'hasil_rm', bab: 3, nama: 'Hasil disusun sesuai rumusan masalah/pertanyaan penelitian', khusus: 'hasilSesuaiRM', hal: '30', saran: 'Susun hasil penelitian mengikuti urutan rumusan masalah/pertanyaan penelitian.', tahap: 'lengkap' },
    { id: 'pembahasan', bab: [3, 4], nama: 'Pembahasan: interpretasi temuan & konfirmasi dengan teori dan penelitian terdahulu', kw: ['sejalan dengan', 'sesuai dengan teori', 'mendukung penelitian', 'konsisten dengan', 'berbeda dengan', 'bertentangan dengan', 'memperkuat', 'menguatkan', 'temuan ini'], min: 2, hal: '30', saran: 'Pembahasan perlu mengonfirmasi temuan dengan teori yang dirujuk dan hasil penelitian sebelumnya.', tahap: 'lengkap' },
    { id: 'pembahasan_sitasi', bab: [3, 4], nama: 'Pembahasan didukung sitasi rujukan', khusus: 'sitasiPembahasan', hal: '30', saran: 'Pembahasan perlu didukung sitasi teori dan penelitian terdahulu.', tahap: 'lengkap' },
    { id: 'keterbatasan', bab: [3, 4], nama: 'Keterbatasan penelitian (bukan soal waktu & biaya)', kw: ['keterbatasan penelitian', 'keterbatasan', 'limitasi', 'limitation'], hal: '30–31', saran: 'Tambahkan subbagian Keterbatasan Penelitian (terkait metode, bukan waktu dan biaya).', tahap: 'lengkap' },
    { id: 'simpulan_hip', bab: [4, 5], nama: 'Simpulan menjawab rumusan masalah / hasil uji hipotesis', kw: ['simpulan', 'kesimpulan', 'disimpulkan'], hal: '31', saran: 'Simpulan harus menjawab rumusan masalah dan tujuan penelitian (berisi hasil uji hipotesis untuk kuantitatif).', tahap: 'lengkap' },
    { id: 'rekomendasi', bab: [4, 5], nama: 'Rekomendasi/saran yang spesifik dan teknis (praktisi & penelitian lanjut)', kw: ['rekomendasi', 'saran', 'disarankan', 'direkomendasikan', 'penelitian selanjutnya', 'peneliti selanjutnya', 'penelitian lanjutan'], min: 2, hal: '31', saran: 'Rekomendasi harus spesifik dan teknis, ditujukan untuk praktisi dan penelitian yang akan datang.', tahap: 'lengkap' },
    { id: 'implikasi', bab: [4, 5], nama: 'Implikasi penelitian', kw: ['implikasi'], hal: '33–39', saran: 'Tambahkan implikasi (teoretis/praktis) hasil penelitian.', tahap: 'lengkap', untuk: ['asosiatif', 'eksperimen', 'rnd', 'instrumen', 'tindakan'] },

    // ---------- Etika (hal 21) ----------
    { id: 'etik_rentan', bab: 'any', nama: 'Etika: pelibatan partisipan rentan (anak, ABK, lansia)', khusus: 'etikaRentan', hal: '21', saran: 'Penelitian melibatkan partisipan rentan: lampirkan surat izin orang tua/wali/sekolah, surat bebas kriminal, surat pernyataan tanggung jawab, buramkan wajah anak, dan samarkan nama responden.', wajib: false },
    { id: 'etik_consent', bab: 'any', nama: 'Consent form / persetujuan partisipan', kw: ['informed consent', 'inform consent', 'consent form', 'surat pernyataan kesediaan', 'kesediaan responden', 'persetujuan partisipan'], hal: '21, Lampiran 25', saran: 'Sertakan consent form (surat pernyataan kesediaan responden/partisipan).', wajib: false },
  ];

  // Kata kunci untuk mendeteksi jenis penelitian otomatis.
  const DETEKSI_JENIS = {
    instrumen: ['pengembangan instrumen', 'mengembangkan instrumen', 'konstruksi instrumen', 'pengembangan tes', 'pengembangan skala', 'analisis faktor konfirmatori', 'item response theory', 'teori respons butir', 'model rasch', 'psikometri', 'pedoman penggunaan instrumen'],
    rnd: ['penelitian dan pengembangan', 'research and development', 'r&d', 'pengembangan model', 'model yang dikembangkan', 'addie', 'borg and gall', 'borg & gall', 'dick and carey', 'model 4d', 'design based research', 'produk yang dikembangkan', 'kelayakan model', 'efektivitas model'],
    eksperimen: ['eksperimen', 'kuasi eksperimen', 'quasi experiment', 'kelompok kontrol', 'kelompok eksperimen', 'pretest', 'posttest', 'treatment by level', 'desain faktorial', 'anava', 'anova dua jalur', 'rancangan perlakuan'],
    asosiatif: ['korelasional', 'korelasi', 'regresi', 'analisis jalur', 'path analysis', 'structural equation', 'sem pls', 'pls sem', 'pengaruh langsung', 'kuantitatif asosiatif', 'survei', 'variabel eksogen', 'variabel endogen'],
    kualitatif: ['penelitian kualitatif', 'pendekatan kualitatif', 'fenomenologi', 'etnografi', 'studi kasus', 'grounded theory', 'fokus dan subfokus', 'keabsahan data', 'kredibilitas', 'informan', 'miles dan huberman', 'miles & huberman', 'spradley'],
    evaluasi: ['penelitian evaluasi', 'evaluasi program', 'model cipp', 'cipp', 'kirkpatrick', 'countenance', 'discrepancy evaluation', 'objek yang dievaluasi', 'kriteria evaluasi'],
    kebijakan: ['penelitian kebijakan', 'analisis kebijakan', 'implementasi kebijakan', 'evaluasi kebijakan', 'edward iii', 'van meter', 'grindle', 'konteks kebijakan', 'konten kebijakan'],
    tindakan: ['penelitian tindakan', 'action research', 'penelitian tindakan kelas', 'ptk', 'siklus i', 'siklus ii', 'kemmis', 'mctaggart', 'hipotesis tindakan', 'refleksi'],
  };

  const SUMBER_TERLARANG = [
    { pola: /wikipedia\.org|\bwikipedia\b/i, nama: 'Wikipedia' },
    { pola: /blogspot\.com|wordpress\.com|\bblogger\b|medium\.com|kompasiana/i, nama: 'Blog pribadi' },
  ];

  global.RULES = { JENJANG, JENIS, BAGIAN_AWAL, BAGIAN_AKHIR, ISI_LAMPIRAN, KRITERIA_ISI, DETEKSI_JENIS, SUMBER_TERLARANG };
})(window);
