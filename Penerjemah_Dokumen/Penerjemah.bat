@echo off
title Penerjemah Dokumen ke Bahasa Indonesia
cd /d "%~dp0"
rem Pakai node.exe di folder "node" bila ada (versi portabel), selain itu Node.js yang terpasang.
set "NODE=node"
if exist "%~dp0node\node.exe" set "NODE=%~dp0node\node.exe"
if "%NODE%"=="node" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo  Node.js tidak ditemukan.
    echo  Pasang Node.js dari https://nodejs.org lalu jalankan file ini lagi,
    echo  atau salin node.exe ke folder "node" di dalam folder aplikasi ini.
    echo.
    pause
    exit /b
  )
)
if not exist "Masukan" mkdir "Masukan"
if not exist "Hasil_Terjemahan" mkdir "Hasil_Terjemahan"
start "" http://localhost:8090
"%NODE%" server.js
pause
