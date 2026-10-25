# Panduan Deploy Web Portofolio & Ekosistem 5 Web dalam 1 VPS

Sistem ini memungkinkan Anda menjalankan **Web Portofolio Utama** bersama **5 Web Aplikasi Riset** dalam **1 VPS yang sama** tanpa ada port yang bentrok.

---

## 1. Peta Port (Port Allocation) di VPS Anda

| No | Aplikasi | Nama Container | Port Docker (Host) | Domain / Subdomain Contoh |
|:---|:---|:---|:---|:---|
| 0 | **Web Portofolio Utama** | `bima-portfolio-app` | `127.0.0.1:8080` | `karyasaya.com` (Domain Utama) |
| 1 | **MADEL-5C** | `hdap-app` | `127.0.0.1:3000` | `madel5c.com` / `madel5c.karyasaya.com` |
| 2 | **Chek_In** | `chekin-app` | `127.0.0.1:3001` | `chekin.karyasaya.com` |
| 3 | **SLR-In Aja** | `slr-app` | `127.0.0.1:3002` | `slr.karyasaya.com` |
| 4 | **Terjemahin_Aja** | `terjemahin-app` | `127.0.0.1:3003` | `terjemahin.karyasaya.com` |
| 5 | **Analisis-Aja** | `analisis-app` | `127.0.0.1:3004` | `analisis.karyasaya.com` |

---

## 2. Strategi Domain: Hemat & Fleksibel

### Opsi A (Paling Hemat - Cukup Beli 1 Domain Utama):
Anda hanya perlu berlangganan **1 domain utama** (contoh: `karyasaya.com` atau `bimaresearch.com`).
Setelah itu, Anda bisa membuat **subdomain gratis tanpa batas** di DNS registrar (Cloudflare / Niagahoster / Rumahweb / dsb):
- `karyasaya.com` -> mengarah ke IP VPS (Portofolio Utama)
- `madel5c.karyasaya.com` -> mengarah ke IP VPS (MADEL-5C)
- `chekin.karyasaya.com` -> mengarah ke IP VPS (Chek_In)
- `slr.karyasaya.com` -> mengarah ke IP VPS (SLR-In Aja)
- `terjemahin.karyasaya.com` -> mengarah ke IP VPS (Terjemahin_Aja)
- `analisis.karyasaya.com` -> mengarah ke IP VPS (Analisis-Aja)

### Opsi B (Beli Domain Terpisah Sendiri-Sendiri):
Jika Anda ingin domain khusus untuk masing-masing (misal `madel5c.com`, `chekin.id`, `slrin.com`, `portfoliobima.com`), semuanya tinggal diarahkan (A Record) ke IP VPS yang sama. Nginx akan otomatis membedakan traffic berdasarkan nama domain!

---

## 3. Konfigurasi Nginx di VPS

### A. Konfigurasi untuk Web Portofolio (`/etc/nginx/sites-available/portfolio`)
```nginx
server {
    listen 80;
    server_name karyasaya.com www.karyasaya.com;

    location / {
        proxy_pass http://127.0.0.1:8080; # Mengarah ke Portofolio
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### B. Konfigurasi untuk Subdomain Web Lainnya (Contoh Chek-In)
```nginx
server {
    listen 80;
    server_name chekin.karyasaya.com;

    location / {
        proxy_pass http://127.0.0.1:3001; # Mengarah ke Port Chek_In
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktifkan konfigurasi dan pasang SSL otomatis:
```bash
sudo ln -s /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d karyasaya.com -d www.karyasaya.com
```

---

## 4. Cara Menjalankan Web Portofolio Ini di VPS

1. Masuk ke folder web portofolio di VPS:
   ```bash
   cd /var/www/web_portfolio
   ```
2. Jalankan dengan Docker:
   ```bash
   docker compose up -d --build
   ```
3. Web Portofolio langsung aktif di port `8080` dan siap dihubungkan oleh Nginx ke domain utama Anda.
4. Di halaman web portofolio, terdapat tombol **"Atur URL / Domain"** di pojok kanan atas di mana Anda bisa langsung memasukkan URL domain/subdomain yang sudah aktif kapan saja tanpa perlu mengubah baris kode.
