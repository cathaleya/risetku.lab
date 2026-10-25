@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js tidak ditemukan. Membuka index.html langsung...
  start "" "%~dp0index.html"
  exit /b
)
start "" http://localhost:8080
node serve.js
