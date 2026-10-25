/**
 * ==============================================================================
 * Cek-In Client-Side License Verification Engine
 * ==============================================================================
 * - Bertugas memverifikasi keabsahan lisensi secara offline & kriptografis.
 * - Hanya berisi logika validasi (verifikasi checksum & masa aktif).
 * - Generator lisensi dipisahkan secara eksklusif ke aplikasi offline lokal milik Pemilik.
 * ==============================================================================
 */

(function (global) {
  'use strict';

  // Secret Salt internal untuk verifikasi integritas checksum
  const SECRET_SALT = 'RISETKU_BIMA_EXCLUSIVE_DISERTASI_2026';

  // Master Universal Keys (Khusus Pemilik - Akses Permanen)
  const MASTER_KEYS = [
    'CEKIN-BIMA-DISERTASI-MASTER',
    'RISETKU-BIMA-DISERTASI-VIP',
    'CEKIN-PRO-UNJ-2026-VIP',
    'CEKIN-RISETKU-SPECIAL-ACCESS'
  ];

  // Modul-modul Ekosistem RisetKu
  const MODULE_NAMES = {
    'CEKIN':   'Cek-IN (Pemeriksa Naskah Tesis/Disertasi)',
    'MADEL':   'MADEL-5C (E-Asesmen Model Pembelajaran)',
    'SLR':     'SLR-In Aja (PRISMA Systematic Review)',
    'TRANS':   'Terjemah-IN (Penerjemah Dokumen Bilingual)',
    'ANALIS':  'Analisis-Aja (Olah Data Rasch & CFA)',
    'THINK':   'Think A Loud-In (Probing S2/S3)',
    'TOLONG':  'Tolong-IN Aja (Download Paper & Konsultasi)',
    'RISETKU': 'RisetKu All-Access (Semua 7 Fitur Ekosistem)'
  };

  // Daftar Pilihan Durasi Hari
  const DURATION_PRESETS = {
    '1D':   { code: '1D',   label: '1 Hari (Uji Coba / Trial)', days: 1 },
    '7D':   { code: '7D',   label: '7 Hari (1 Minggu)',         days: 7 },
    '30D':  { code: '30D',  label: '30 Hari (1 Bulan)',         days: 30 },
    '90D':  { code: '90D',  label: '90 Hari (3 Bulan)',         days: 90 },
    '180D': { code: '180D', label: '180 Hari (6 Bulan)',        days: 180 },
    '365D': { code: '365D', label: '365 Hari (1 Tahun)',        days: 365 },
    'LIFE': { code: 'LIFE', label: 'Permanen / Lifetime',       days: 3650 }
  };

  // Rolling Polynomial Hash 32-bit untuk Checksum Verification
  function computeChecksum(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return Math.abs(combined).toString(36).toUpperCase().padStart(4, '0').slice(-4);
  }

  /**
   * Memvalidasi Kunci Lisensi untuk Cek-In
   * @param {string} key - Kunci yang dimasukkan pengguna
   * @returns {Object} Hasil validasi
   */
  function validateLicense(key) {
    if (!key || typeof key !== 'string') {
      return { valid: false, message: 'Harap masukkan kunci lisensi.' };
    }

    const clean = key.trim().toUpperCase().replace(/\s+/g, '');

    // 1. Cek Master Key Khusus Pemilik
    if (MASTER_KEYS.includes(clean)) {
      return {
        valid: true,
        key: clean,
        durationCode: 'LIFE',
        label: '👑 Master Key Pemilik (Akses VIP Selamanya)',
        days: 3650,
        isMaster: true,
        message: 'Akses Master Pemilik berhasil diaktifkan!'
      };
    }

    // 2. Format: [PREFIX]-[DURASI]-[SEED]-[CHECKSUM]
    const parts = clean.split('-');
    if (parts.length !== 4) {
      return {
        valid: false,
        message: 'Format kunci lisensi tidak valid. Contoh pola: CEKIN-30D-XXXX-XXXX'
      };
    }

    const [prefix, dur, seed, checksum] = parts;

    // Cek apakah kunci untuk modul lain
    if (prefix !== 'CEKIN' && prefix !== 'RISETKU') {
      const moduleName = MODULE_NAMES[prefix];
      if (moduleName) {
        return {
          valid: false,
          message: `Kunci lisensi ini diterbitkan khusus untuk modul "${moduleName}", bukan untuk Cek-In. Silakan masukkan kunci Cek-In atau kunci paket RisetKu All-Access.`
        };
      }
      return {
        valid: false,
        message: 'Kunci lisensi tidak dikenali untuk aplikasi ini.'
      };
    }

    if (!DURATION_PRESETS[dur]) {
      return {
        valid: false,
        message: `Masa berlaku "${dur}" tidak dikenali dalam sistem lisensi.`
      };
    }

    // Verifikasi Checksum Kriptografis
    const payload = `${prefix}-${dur}-${seed}`;
    const expectedChecksum = computeChecksum(`${payload}-${SECRET_SALT}`);
    if (checksum !== expectedChecksum) {
      return {
        valid: false,
        message: 'Kunci lisensi tidak valid (kode checksum salah atau kunci palsu).'
      };
    }

    const preset = DURATION_PRESETS[dur];
    const isUniversal = prefix === 'RISETKU';
    const tag = isUniversal ? ' (Paket RisetKu All-Access)' : '';

    return {
      valid: true,
      key: clean,
      prefix,
      durationCode: dur,
      label: preset.label + tag,
      days: preset.days,
      isMaster: false,
      message: `Lisensi Terverifikasi: ${preset.label}${tag}`
    };
  }

  /**
   * Mengecek status lisensi dari localStorage
   */
  function checkLicenseStatus(licData) {
    if (!licData || !licData.key || !licData.activatedAt) {
      return { active: false, remainingDays: 0, expired: true };
    }

    const val = validateLicense(licData.key);
    if (!val.valid) {
      return { active: false, remainingDays: 0, expired: true };
    }

    if (val.isMaster || val.durationCode === 'LIFE') {
      return { active: true, remainingDays: 9999, expired: false, label: val.label, isMaster: true };
    }

    const actTime = new Date(licData.activatedAt).getTime();
    const now = Date.now();
    const durationMs = val.days * 24 * 60 * 60 * 1000;
    const expiryTime = actTime + durationMs;
    const remainingMs = expiryTime - now;

    if (remainingMs <= 0) {
      return {
        active: false,
        remainingDays: 0,
        expired: true,
        label: val.label,
        expiryDate: new Date(expiryTime).toLocaleDateString('id-ID')
      };
    }

    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    return {
      active: true,
      remainingDays,
      expired: false,
      label: val.label,
      expiryDate: new Date(expiryTime).toLocaleDateString('id-ID')
    };
  }

  // Export
  const LicenseEngine = {
    validateLicense,
    checkLicenseStatus,
    DURATION_PRESETS,
    MASTER_KEYS,
    MODULE_NAMES
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LicenseEngine;
  }
  if (typeof window !== 'undefined') {
    window.LicenseEngine = LicenseEngine;
  }

})(typeof window !== 'undefined' ? window : global);
