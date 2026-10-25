# 🌟 RisetKu Lab • Ekosistem Riset & E-Asesmen Akademik Terpadu

> **Domain Resmi Publik:** [https://www.riset-ku-lab.my.id](https://www.riset-ku-lab.my.id)

Ekosistem solusi riset terpadu untuk mahasiswa, dosen, dan peneliti akademik pascasarjana (S2 & S3). Menghubungkan seluruh modul kerja:
1. **Portal Utama RisetKu** (`/`) - Beranda ekosistem dan navigasi orbital 7 modul riset.
2. **Cek-IN** (`/cekin/`) - Audit kepatuhan naskah tesis/disertasi (Sistematika, Koherensi Bab, Metodologi SPs UNJ 2025).
3. **Terjemah-IN** (`/terjemahin/`) - Penerjemah dokumen ilmiah bilingual berdampingan (PDF/Word/PPTX/Excel) & sitasi APA 7.
4. **SLR-In Aja** (`/slr/`) - Skrining *Systematic Literature Review* berstandar PRISMA 2020 dengan *Blind Reviewer Panel* (R1 & R2).
5. **Analisis-Aja** (`/analisis/`) - Komputasi psikometri modern: Rasch Partial Credit Model (PCM), Wright Map, & Confirmatory Factor Analysis (CFA).
6. **Think A Loud-In** (`/thinkaloud/`) - Protokol wawancara kognitif mendalam (*Cognitive Probing*) 10 butir studi kasus S2/S3 (5 Dimensi: Pedagogik, Desain, Etika, Kolaborasi, Pemecahan Masalah) dengan perekam suara dan ekspor transkrip verbatim.
7. **MADEL-5C** (`https://madel5c.com`) - Model asesmen literasi digital calon guru berbasis 30 skenario kasus situasional (SJT).
8. **Tolong-IN Aja** - Layanan pendampingan akses paper dan konsultasi riset pascasarjana.

---

## 🛡️ Arsitektur Keamanan Docker Sandbox (Anti-Ransomware)

Aplikasi ini menggunakan standar **Docker Compose Sandbox** untuk perlindungan maksimal:
1. **Isolasi Sistem (Container Jail)**: Proses Node.js berjalan di dalam container Alpine Linux yang terisolasi penuh. Jika terjadi upaya serangan, peretas **terkunci di dalam container** dan **TIDAK BISA** menyentuh, membaca, atau mengenkripsi file di sistem operasi utama VPS (Host OS).
2. **Localhost Port Binding (`127.0.0.1:8000:8000`)**: Port container tidak diekspos ke publik (`0.0.0.0`), sehingga kebal dari pemindaian port bot otomatis dan serangan brute-force dari internet.
3. **Non-Root Execution (`USER node`)**: Aplikasi tidak dijalankan sebagai `root`, melainkan sebagai user biasa dengan hak terbatas, memitigasi risiko eskalasi hak akses.
4. **No New Privileges (`no-new-privileges:true`)**: Mencegah proses apa pun di dalam container menaikkan hak aksesnya.

---

## 🌐 Panduan Deployment VPS dengan Docker Compose (Domain: `www.riset-ku-lab.my.id`)

### 1. Prasyarat di VPS
Pastikan Docker dan Docker Compose sudah terpasang di VPS:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker
```

### 2. Tarik / Clone Repositori di VPS
```bash
cd /var/www
git clone https://github.com/cathaleya/risetku.lab.git risetku
cd /var/www/risetku
```

### 3. Jalankan Container dengan Docker Compose
```bash
# Build image dan jalankan container di background
docker-compose up -d --build

# Periksa status container
docker-compose ps

# Lihat log aktivitas container
docker-compose logs -f
```

### 4. Konfigurasi Nginx Reverse Proxy
Buat file konfigurasi di `/etc/nginx/sites-available/risetku`:
```bash
sudo nano /etc/nginx/sites-available/risetku
```

Isi dengan konfigurasi berikut:
```nginx
server {
    listen 80;
    server_name www.riset-ku-lab.my.id riset-ku-lab.my.id;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 300M;
    }
}
```

Aktifkan konfigurasi dan reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/risetku /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Pasang Sertifikat SSL HTTPS Gratis (Certbot)
```bash
sudo certbot --nginx -d www.riset-ku-lab.my.id -d riset-ku-lab.my.id
```
Pilih opsi **Redirect** ke HTTPS saat diminta oleh Certbot.

---

## 🔄 Cara Melakukan Pembaruan Kode (Update di Masa Depan)
Jika ada pembaruan kode dari GitHub:
```bash
cd /var/www/risetku
git pull origin main
docker-compose up -d --build
```

---

## 💻 Cara Menjalankan di Komputer Lokal (Development)
Untuk pengujian cepat di laptop / PC tanpa Docker:
```bash
cd vps_version/deploy_2
node server.js
# atau jalankan file: jalankan_risetku_local.bat
```
Akses di browser: `http://localhost:8000/`

---

## 🛡️ Sistem Lisensi Klien (Client Verification Engine)

Setiap modul internal telah dilengkapi sistem aktivasi lisensi mandiri berbasis SHA-256 Client Verification Engine:
- `Chek_In` &rarr; Format: `CEKIN-[DURASI]-[SEED]-[CHECKSUM]`
- `Penerjemah_Dokumen` &rarr; Format: `TRANS-[DURASI]-[SEED]-[CHECKSUM]`
- `web_SLR` &rarr; Format: `SLR-[DURASI]-[SEED]-[CHECKSUM]`
- `web_analisis` &rarr; Format: `ANALIS-[DURASI]-[SEED]-[CHECKSUM]`
- `web_thinkaloud` &rarr; Format: `THINK-[DURASI]-[SEED]-[CHECKSUM]`
- **Universal Key** &rarr; Format: `RISETKU-[DURASI]-[SEED]-[CHECKSUM]` (Membuka semua 5 modul sekaligus)

> [!NOTE]
> Generator lisensi sengaja **TIDAK** disertakan di repositori publik ini demi keamanan. Generator lisensi resmi tersimpan secara eksklusif di komputer pribadi pemilik (`Generator_Lisensi_RisetKu.html`).
