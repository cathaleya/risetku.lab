# 🚀 Panduan Lengkap: Push ke GitHub & Deploy ke VPS (Docker Anti-Ransomware)
## Proyek: RisetKu Lab (Domain: `www.riset-ku-lab.my.id`)

Dokumen ini memandu Anda mengunggah seluruh sistem **RisetKu** (Portal Utama, Cek-IN, Terjemah-IN, SLR-In Aja, Analisis-Aja, dan Think A Loud-In) dari folder `deploy_2` ke GitHub, serta menyiapkannya di VPS menggunakan arsitektur **Docker Compose Sandbox** yang kebal terhadap serangan ransomware.

---

### 🛡️ Mengapa Docker Jauh Lebih Aman dari PM2 (Anti-Ransomware)?
1. **Container Isolation (Sandbox)**: Aplikasi berjalan di lingkungan terisolasi (Alpine Linux). Jika ada celah pada file yang diunggah pengguna (PDF/Word), penyerang terkunci di dalam container dan **tidak bisa menyentuh, membaca, ataupun mengenkripsi sistem VPS utama (Host OS)**.
2. **Localhost Port Binding (`127.0.0.1:8000`)**: Port container tidak diekspos ke IP publik (`0.0.0.0`). Bot scanner otomatis di internet tidak bisa menjangkau Node.js secara langsung; semua lalu lintas wajib disaring oleh Nginx + SSL.
3. **Non-Root User (`node`)**: Di dalam container, proses dijalankan sebagai user biasa (`node`), bukan `root`.
4. **No New Privileges (`no-new-privileges:true`)**: Mencegah proses apa pun menaikkan hak aksesnya (privilege escalation).
5. **Generator Lisensi Aman di Komputer Lokal**: File `Generator_Lisensi_RisetKu.html` tersimpan di `d:\Riset_BIMA\` dan sudah masuk `.gitignore` sehingga **tidak pernah ikut terunggah ke GitHub atau VPS**.

---

### Langkah 1: Buat Repositori di GitHub
1. Buka [https://github.com/](https://github.com/) dan login ke akun Anda.
2. Klik tombol **New** (Repository baru).
3. Beri nama repositori, misalnya: `risetku-lab`.
4. Pilih **Private** (Sangat disarankan agar data instrumen dan kode riset terlindungi).
5. **Jangan centang** "Add a README file" (karena file README sudah tersedia lengkap).
6. Klik **Create repository**.

---

### Langkah 2: Inisialisasi & Push dari Komputer Anda
Buka **PowerShell** atau **Terminal**, arahkan ke folder `deploy_2`:

```bash
cd "d:\Riset_BIMA\vps_version\deploy_2"

# 1. Inisialisasi git
git init

# 2. Tambahkan semua file (Generator lisensi lokal diabaikan otomatis)
git add .

# 3. Buat commit pertama
git commit -m "feat: RisetKu Lab ekosistem lengkap dengan Docker Compose Anti-Ransomware & Think A Loud S2/S3"

# 4. Atur branch utama ke main
git branch -M main

# 5. Hubungkan ke repositori GitHub Anda (Ganti USERNAME_ANDA dengan username GitHub Anda)
git remote add origin https://github.com/USERNAME_ANDA/risetku-lab.git

# 6. Unggah kode ke GitHub
git push -u origin main
```

---

### Langkah 3: Deploy di VPS Anda Menggunakan Docker Compose

#### 1. Masuk ke VPS melalui SSH
```bash
ssh root@IP_VPS_ANDA
```

#### 2. Pasang Docker, Docker Compose, Nginx & Certbot (Jika Belum Ada)
```bash
sudo apt update
sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker
```

#### 3. Clone Repositori ke VPS
```bash
cd /var/www
git clone https://github.com/cathaleya/risetku.lab.git risetku
cd /var/www/risetku
```

#### 4. Jalankan Aplikasi dengan Docker Compose (Sandbox Anti-Ransomware)
```bash
# Build dan jalankan container di background
docker-compose up -d --build

# Periksa status container yang sedang berjalan
docker-compose ps

# Melihat log aktivitas sistem
docker-compose logs -f
```

---

### Langkah 4: Hubungkan Domain `www.riset-ku-lab.my.id`

#### 1. Atur DNS Domain Anda (di Cloudflare / Registrar Domain):
- **Tipe A**: `riset-ku-lab.my.id` &rarr; Arahkan ke `IP_VPS_ANDA`
- **Tipe A / CNAME**: `www.riset-ku-lab.my.id` &rarr; Arahkan ke `IP_VPS_ANDA` (atau CNAME `riset-ku-lab.my.id`)

#### 2. Buat Konfigurasi Nginx di VPS:
```bash
sudo nano /etc/nginx/sites-available/risetku
```

Salin & tempel konfigurasi berikut:
```nginx
server {
    listen 80;
    server_name www.riset-ku-lab.my.id riset-ku-lab.my.id;

    location / {
        proxy_pass http://127.0.0.1:8585;
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

Aktifkan konfigurasi Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/risetku /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 3. Pasang Sertifikat SSL HTTPS Gratis (Certbot):
```bash
sudo certbot --nginx -d www.riset-ku-lab.my.id -d riset-ku-lab.my.id
```
Pilih opsi **Redirect** ke HTTPS saat diminta oleh Certbot.

---

### 🔄 Cara Melakukan Pembaruan Kode di Masa Depan
Bila Anda melakukan perubahan file di komputer:
```bash
# Di Komputer Lokal (folder deploy_2):
git add .
git commit -m "Update perbaikan"
git push origin main

# Di VPS:
cd /var/www/risetku
git pull origin main
docker-compose up -d --build
```

---

### 🔑 Kunci Master & Generator Lisensi (Pribadi Anda)
- Generator Lisensi: Buka `d:\Riset_BIMA\Buka_Generator_Lisensi.bat` di laptop/PC Anda.
- **Kunci Master Cadangan Darurat**:
  - `CEKIN-BIMA-DISERTASI-MASTER` (Cek-In)
  - `TRANS-BIMA-DISERTASI-MASTER` (Terjemah-IN)
  - `SLR-BIMA-DISERTASI-MASTER` (SLR-In Aja)
  - `ANALIS-BIMA-DISERTASI-MASTER` (Analisis-Aja)
  - `THINK-BIMA-DISERTASI-MASTER` (Think A Loud-In)
  - `RISETKU-BIMA-DISERTASI-MASTER` (Universal untuk semua modul)
