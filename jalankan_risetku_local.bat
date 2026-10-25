@echo off
title RisetKu - Ekosistem Riset Terpadu (Lokal Gateway)
cls
echo ==============================================================
echo       MENJALANKAN PORTAL UTAMA RISETKU & 5 MODUL WEB
echo ==============================================================
echo.
echo Pastikan Node.js sudah terpasang di komputer Anda.
echo.
echo Membuka server di http://localhost:8000 ...
echo.
start "" http://localhost:8000/
node server.js
pause
