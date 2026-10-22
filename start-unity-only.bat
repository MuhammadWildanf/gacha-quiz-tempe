@echo off
REM ============================================================
REM  UNITY-ONLY (PC KIOSK / TV)
REM  - TIDAK menjalankan node server
REM  - Hanya cek server di PC lain, lalu jalankan Unity fullscreen
REM
REM  Cara pasang sekali saja:
REM   1. Isi SERVER_IP di bawah (IP PC server, lihat ipconfig di sana)
REM   2. Isi UNITY_EXE (atau taruh EXE di .\UnityBuild agar auto-detect)
REM   3. Nyalakan Unity 1x > buka Settings (F12) > samakan:
REM        Server WS = ws://SERVER_IP:3005
REM        URL Kuis  = http://SERVER_IP:3011/api/quiz
REM      Lalu Save (tersimpan per mesin, cukup 1x)
REM   4. Win+R > shell:startup > taruh SHORTCUT file ini
REM ============================================================
setlocal EnableDelayedExpansion

REM ---- KONFIGURASI: EDIT BAGIAN INI SAJA ----
REM Samakan dengan IP PC server (default repo: localhost)
set "SERVER_IP=localhost"
REM Contoh: set "UNITY_EXE=D:\Game\Gacha\Gacha.exe"
set "UNITY_EXE="
set "UNITY_ARGS=-screen-fullscreen 1"
REM Max tunggu server remote siap (detik). Naikkan kalau WiFi lambat.
set "MAX_WAIT=60"
set "AUTO_CLOSE=1"
REM -------------------------------------------

echo [Unity] === Start %date% %time% ===
echo [Unity] Server target: %SERVER_IP% (3005 + 3011)

REM ---- 1. Tunggu server-quiz remote SIAP ----
echo [Unity] Menunggu server-quiz %SERVER_IP%:3005 (max %MAX_WAIT% detik)...
set "READY3005=0"
for /L %%i in (1,1,%MAX_WAIT%) do (
  curl -s -o nul --max-time 3 http://%SERVER_IP%:3005/api/config >nul 2>nul
  if !errorlevel! EQU 0 (
    set "READY3005=1"
    echo [Unity] server-quiz SIAP setelah %%i detik.
    goto :check3011
  )
  timeout /t 1 /nobreak >nul
)
:check3011
if "%READY3005%"=="0" (
  echo [Unity][WARN] server-quiz %SERVER_IP%:3005 tidak merespon!
  echo [Unity][WARN] Pastikan: PC server nyala + start-server-only.bat jalan
  echo [Unity][WARN] + 1 jaringan/WiFi + firewall TCP 3005 dibuka.
  echo [Unity][WARN] Unity tetap dijalankan (auto-reconnect saat server nyala).
)

REM ---- 2. Cek quiz-management remote (ringan) ----
curl -s -o nul --max-time 3 http://%SERVER_IP%:3011/ >nul 2>nul
if errorlevel 1 (
  echo [Unity][WARN] quiz-management %SERVER_IP%:3011 tidak merespon. Unity tetap jalan.
) else (
  echo [Unity] quiz-management SIAP.
)

REM ---- 3. Cari Unity EXE (auto-detect kalau kosong) ----
if "%UNITY_EXE%"=="" (
  echo [Unity] UNITY_EXE kosong, mencoba auto-detect...
  for %%D in ("E:\web\2026\tempe-park\Gacha\UnityBuild" "E:\web\2026\tempe-park\Gacha\Build" "E:\web\2026\tempe-park\Gacha\Game" "E:\web\2026\tempe-park\Gacha") do (
    for %%F in ("%%~D\*.exe") do (
      if "!UNITY_EXE!"=="" if exist "%%~F" (
        set "UNITY_EXE=%%~F"
        echo [Unity] Auto-detect ketemu: %%~F
      )
    )
  )
)
if "%UNITY_EXE%"=="" (
  echo.
  echo [Unity][WARN] UNITY_EXE belum diisi dan tidak ketemu EXE otomatis.
  echo [Unity][WARN] Taruh hasil Build Unity di:
  echo [Unity][WARN]   E:\web\2026\tempe-park\Gacha\UnityBuild\ (disarankan)
  echo.
  pause
  exit /b 0
)

if not exist "%UNITY_EXE%" (
  echo [Unity][ERROR] UNITY_EXE tidak ditemukan: %UNITY_EXE%
  pause
  exit /b 1
)

echo [Unity] Menjalankan Unity: %UNITY_EXE% %UNITY_ARGS%
start "" "%UNITY_EXE%" %UNITY_ARGS%

echo [Unity] Selesai. Unity tampil di TV, server tetap di %SERVER_IP%.
echo [Unity] Kalau Unity tulis "Server terputus", cek IP + Settings F12 + firewall.

if "%AUTO_CLOSE%"=="1" (
  timeout /t 3 /nobreak >nul
  exit /b 0
)

endlocal
