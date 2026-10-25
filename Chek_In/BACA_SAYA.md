# Cek-In — folder siap deploy

Situs statis (HTML + JavaScript). Tidak perlu build, database, atau API key.

## Isi
- `index.html` — beranda (fitur, cara kerja, panduan penggunaan)
- `periksa.html` — halaman 2: masuk (nama + email UNJ), lalu alat periksa
- `css/cekin.css` — gaya bersama kedua halaman
- `js/` — mesin pemeriksa (parser, aturan panduan, analisis lanjutan, antarmuka)
- `vendor/` — JSZip dan pdf.js (lokal, tidak bergantung CDN)
- `img/` — logo Cek-In (`logo_cekin.svg`, `logo_cekin_512.png`, `logo_cekin_lengkap.png` dengan tulisan) dan logo MADEL-5C

## Pilihan pemasangan
1. **Sebagai sub-halaman madel5c.com** — salin seluruh isi folder ini ke `public/cek-in/` pada proyek Next.js,
   lalu build/deploy seperti biasa. Alamatnya menjadi `https://madel5c.com/cek-in/index.html` (beranda) dan `…/cek-in/periksa.html` (masuk & periksa)
   (tambahkan tautan "Cek-In" di navbar MADEL-5C ke alamat tersebut).
2. **Sebagai subdomain** (mis. `cekin.madel5c.com`) — arahkan web server (Nginx/Apache) ke folder ini.
3. **Hosting statis lain** — Netlify, Vercel, GitHub Pages, Cloudflare Pages: unggah folder ini apa adanya.

Gunakan alamat **https** agar fitur "Masuk dengan OpenRouter" berfungsi.

## Catatan
- Naskah diproses di browser pengguna; server hanya menyajikan berkas statis.
- Masukan AI memakai AI milik pengguna (salin prompt, API key pribadi, atau login OpenRouter).
- Sumber kode dan skrip build ada di `D:\web_disertasi_UNJ` (`build.sh`).
- Masuk memakai nama + email kampus (`…unj.ac.id`, termasuk `…@mhs.unj.ac.id`) tanpa kata sandi. Ini identifikasi,
  bukan verifikasi: data disimpan di browser pengguna dan dicantumkan pada laporan revisi. Verifikasi email
  (tautan/kode ke email) memerlukan layanan seperti Firebase/Supabase.
