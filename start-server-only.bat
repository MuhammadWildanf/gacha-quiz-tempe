@echo off
REM ============================================================
REM  SERVER-ONLY (PC SERVER)
REM  - server-quiz-tempe  (port 3005, logic Unity via WS/API)
REM  - quiz-management    (port 3011, API soal untuk Unity)
REM  - TANPA Unity (Unity jalan di PC kiosk lain)
REM
REM  Cara pasang sekali saja:
REM   1. Win+R > shell:startup > taruh SHORTCUT file ini
REM   2. Aktifkan auto-login + power "never sleep"
REM   3. Buka firewall TCP 3005 + 3011 (lihat catatan di bawah)
REM   4. Catat IP PC ini (ipconfig), misal 192.168.88.32
REM      -> masukkan ke start-unity-only.bat di PC kiosk (SERVER_IP)
REM         + ke Unity via panel Settings F12 (1x saja, tersimpan)
REM ============================================================
setlocal EnableDelayedExpansion

REM ---- KONFIGURASI ----
set "MAX_WAIT=30"
set "DIR_QUIZ=E:\web\2026\tempe-park\Gacha\server-quiz-tempe"
set "DIR_MGMT=E:\web\2026\tempe-park\Gacha\quiz-management-tempe"
set "LOG_DIR=E:\web\2026\tempe-park\Gacha\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>nul
set "LOG_QUIZ=%LOG_DIR%\server-3005.log"
set "LOG_MGMT=%LOG_DIR%\mgmt-3011.log"
REM ---------------------

echo [Server] === Start %date% %time% ===

where node >nul 2>nul
if errorlevel 1 (
  echo [Server][ERROR] node tidak ditemukan di PATH. Install Node.js LTS v20.
  pause
  exit /b 1
)

netstat -ano | findstr /C:":3005" | findstr /C:"LISTENING" >nul 2>nul
if errorlevel 1 (
  echo [Server] Menjalankan server-quiz (3005)...
  start "Gacha-ServerQuiz-3005" /min cmd /c "cd /d "%DIR_QUIZ%" && node server.js ^>^> "%LOG_QUIZ%" 2^>^&1"
) else (
  echo [Server] Port 3005 sudah jalan, skip (anti double-run).
)

netstat -ano | findstr /C:":3011" | findstr /C:"LISTENING" >nul 2>nul
if errorlevel 1 (
  echo [Server] Menjalankan quiz-management (3011)...
  start "Gacha-QuizMgmt-3011" /min cmd /c "cd /d "%DIR_MGMT%" && node server.js ^>^> "%LOG_MGMT%" 2^>^&1"
) else (
  echo [Server] Port 3011 sudah jalan, skip (anti double-run).
)

echo [Server] Menunggu server siap (max %MAX_WAIT% detik)...
set "READY3005=0"
for /L %%i in (1,1,%MAX_WAIT%) do (
  curl -s -o nul --max-time 2 http://127.0.0.1:3005/api/config >nul 2>nul
  if !errorlevel! EQU 0 (
    set "READY3005=1"
    echo [Server] server-quiz SIAP setelah %%i detik.
    goto :check3011
  )
  timeout /t 1 /nobreak >nul
)
:check3011
if "%READY3005%"=="0" (
  echo [Server][WARN] server-quiz belum merespon /api/config. Cek log: %LOG_QUIZ%
)

set "READY3011=0"
for /L %%i in (1,1,10) do (
  curl -s -o nul --max-time 2 http://127.0.0.1:3011/ >nul 2>nul
  if !errorlevel! EQU 0 (
    set "READY3011=1"
    goto :done
  )
  timeout /t 1 /nobreak >nul
)
:done
if "%READY3011%"=="0" (
  echo [Server][WARN] quiz-management belum merespon. Cek log: %LOG_MGMT%
) else (
  echo [Server] quiz-management SIAP.
)

echo.
echo [Server] Selesai. Kedua server jalan di background.
echo [Server] Log: %LOG_DIR%
echo [Server] CATATAN FIREWALL (1x saja, Run as Admin):
echo [Server]   netsh advfirewall firewall add rule name="Gacha-3005" dir=in action=allow protocol=TCP localport=3005
echo [Server]   netsh advfirewall firewall add rule name="Gacha-3011" dir=in action=allow protocol=TCP localport=3011
echo.
pause
endlocal
