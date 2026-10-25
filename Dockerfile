# ==============================================================================
# Dockerfile RisetKu Lab (Hardened & Lightweight Anti-Ransomware Sandbox)
# Base: Node.js 20 Alpine (Minimal surface attack, secure container)
# ==============================================================================

FROM node:20-alpine

# Set direktori kerja
WORKDIR /app

# Atur environment produksi
ENV NODE_ENV=production
ENV PORT=8000

# Salin konfigurasi package
COPY package*.json ./

# Install dependensi (jika ada) dan bersihkan cache
RUN npm ci --only=production --ignore-scripts || npm install --only=production --ignore-scripts

# Salin seluruh kode aplikasi ekosistem RisetKu
COPY . .

# Buat folder kerja terjemahan dan pastikan izin hak akses milik user non-root 'node'
RUN mkdir -p /app/Penerjemah_Dokumen/Masukan /app/Penerjemah_Dokumen/Hasil_Terjemahan \
    && chown -R node:node /app

# KEAMANAN: Jalankan aplikasi sebagai user non-root 'node' (bukan root host VPS)
USER node

# Expose port internal container
EXPOSE 8000

# Healthcheck otomatis untuk memastikan server aktif
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8000/ || exit 1

# Jalankan server gateway
CMD ["node", "server.js"]
