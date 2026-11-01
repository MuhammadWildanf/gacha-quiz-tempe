@echo off
REM ============================================================
REM  AUTO-START GACHA SYSTEM (TV KIOSK MODE)
REM  - server-quiz-tempe  (port 3005, logic Unity via WS/API)
REM  - quiz-management    (port 3011, API soal untuk Unity)
REM  - Unity EXE (tampil fullscreen di TV, TANPA browser)
REM
REM  Setup sekali:
REM   1. Jalankan install-startup.bat (sekali saja) → shortcut ke folder Startup
REM   2. Aktifkan auto-login: Win+R → netplwiz → hilangkan centang password
REM   3. Taruh hasil Build Unity di: UnityBuild\  (EXE akan auto-detect)
REM   4. Power plan "Never Sleep" di Power Options
REM ============================================================
setlocal EnableDelayedExpansion

REM ---- KONFIGURASI ----
REM Isi manual jika auto-detect gagal. Contoh: set "UNITY_EXE=E:\Game\Gacha.exe"
set "UNITY_EXE=E:\web\2026\tempe-park\Gacha\UnityBuild\quiz-gacha-tempe 1.6.exe"
REM Argumen Unity fullscreen
set "UNITY_ARGS=-screen-fullscreen 1"
REM Maks tunggu server siap (detik)
set "MAX_WAIT=30"
REM 1 = tutup window launcher setelah Unity jalan
set "AUTO_CLOSE=1"
REM ---------------------

set "BASE_DIR=E:\web\2026\tempe-park\Gacha"
set "DIR_QUIZ=%BASE_DIR%\server-quiz-tempe"
set "DIR_MGMT=%BASE_DIR%\quiz-management-tempe"
set "LOG_DIR=%BASE_DIR%\logs"

REM Cegah script jalan ganda secara bersamaan (Mutex lock)
set "LOCK_FILE=%TEMP%\gacha_startup.lock"
if exist "%LOCK_FILE%" (
  echo [INFO] start-gacha.bat sudah sedang berjalan, skip instance ini.
  exit /b 0
)
echo %date% %time% > "%LOCK_FILE%"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>nul
set "LOG_QUIZ=%LOG_DIR%\server-3005.log"
set "LOG_MGMT=%LOG_DIR%\mgmt-3011.log"
set "LOG_MAIN=%LOG_DIR%\startup.log"

call :log "=== Gacha Auto-Start %date% %time% ==="

REM ---- 0. Cek Node.js ----
where node >nul 2>nul
if errorlevel 1 (
  call :log "[ERROR] node.exe tidak ditemukan. Install Node.js LTS v20."
  call :log "[ERROR] Download: https://nodejs.org"
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v 2^>nul') do call :log "[INFO] Node.js %%v terdeteksi."

REM ---- 1. Jalankan server-quiz 3005 ----
netstat -ano | findstr /C:":3005" | findstr /C:"LISTENING" >nul 2>nul
if errorlevel 1 (
  call :log "[INFO] Menjalankan server-quiz (3005)..."
  start "Gacha-ServerQuiz-3005" /min cmd /c "cd /d "%DIR_QUIZ%" && node server.js >>"%LOG_QUIZ%" 2>&1"
) else (
  call :log "[INFO] Port 3005 sudah LISTENING, skip (anti double-run)."
)

REM ---- 2. Jalankan quiz-management 3011 ----
netstat -ano | findstr /C:":3011" | findstr /C:"LISTENING" >nul 2>nul
if errorlevel 1 (
  call :log "[INFO] Menjalankan quiz-management (3011)..."
  start "Gacha-QuizMgmt-3011" /min cmd /c "cd /d "%DIR_MGMT%" && node server.js >>"%LOG_MGMT%" 2>&1"
) else (
  call :log "[INFO] Port 3011 sudah LISTENING, skip (anti double-run)."
)

REM ---- 3. Tunggu server-quiz 3005 SIAP ----
call :log "[INFO] Menunggu server-quiz siap (max %MAX_WAIT% detik)..."
set "READY3005=0"
for /L %%i in (1,1,%MAX_WAIT%) do (
  if "!READY3005!"=="1" goto :check3011
  curl -s -f -o nul --max-time 2 http://127.0.0.1:3005/api/config >nul 2>nul
  if !errorlevel! EQU 0 (
    set "READY3005=1"
    call :log "[OK] server-quiz SIAP setelah %%i detik."
    goto :check3011
  )
  timeout /t 1 /nobreak >nul
)

:check3011
if "!READY3005!"=="0" (
  call :log "[WARN] server-quiz belum merespon /api/config setelah %MAX_WAIT% detik."
  call :log "[WARN] Cek log: %LOG_QUIZ%"
)

REM ---- 4. Tunggu quiz-management 3011 SIAP (cek /api/quiz dengan HTTP 200 via -f) ----
REM   Penting: -f memastikan respon bukan 404/500 melainkan 200 OK dengan data DB siap.
REM   Ini mencegah race condition di mana Unity fetch soal sebelum server benar-benar siap.
set "READY3011=0"
for /L %%i in (1,1,30) do (
  if "!READY3011!"=="1" goto :rununity
  curl -s -f -o nul --max-time 2 http://localhost:3011/api/quiz >nul 2>nul
  if !errorlevel! EQU 0 (
    set "READY3011=1"
    call :log "[OK] quiz-management + DB SIAP setelah %%i detik."
    REM Beri jeda 2 detik ekstra agar server benar-benar idle dan siap terima koneksi Unity
    timeout /t 2 /nobreak >nul
    goto :rununity
  )
  timeout /t 1 /nobreak >nul
)

:rununity
if "!READY3011!"=="0" (
  call :log "[WARN] quiz-management belum merespon /api/quiz setelah 30 detik. Unity tetap dijalankan."
  call :log "[WARN] Quiz mungkin tidak muncul di Unity. Cek: logs\mgmt-3011.log"
  call :log "[WARN] Kemungkinan: DB belum ada (jalankan: cd quiz-management-tempe && npx prisma migrate deploy)"
)

REM ---- 5. Auto-detect Unity EXE (jika UNITY_EXE kosong) ----
if "%UNITY_EXE%"=="" (
  call :log "[INFO] UNITY_EXE kosong, mencoba auto-detect..."
  REM Cari di UnityBuild dulu (disarankan), lalu fallback ke folder lain
  call :findexe "%BASE_DIR%\UnityBuild"
  if "!UNITY_EXE!"=="" call :findexe "%BASE_DIR%\Build"
  if "!UNITY_EXE!"=="" call :findexe "%BASE_DIR%\Game"
  if "!UNITY_EXE!"=="" call :findexe "%BASE_DIR%"
)

if "%UNITY_EXE%"=="" (
  call :log "[WARN] UNITY_EXE tidak ditemukan. Server tetap jalan."
  call :log "[WARN] Taruh hasil Build Unity di:"
  call :log "[WARN]   %BASE_DIR%\UnityBuild\  <- disarankan"
  call :log "[WARN] atau isi manual: set UNITY_EXE=path\ke\Game.exe di atas."
  echo.
  echo  [!] Unity EXE belum ada. Server berjalan di background.
  echo  [!] Taruh hasil Build di: %BASE_DIR%\UnityBuild\
  echo.
  pause
  exit /b 0
)

if not exist "%UNITY_EXE%" (
  call :log "[ERROR] UNITY_EXE tidak ditemukan di disk: %UNITY_EXE%"
  pause
  exit /b 1
)

REM ---- 6. Jalankan Unity EXE ----
call :log "[INFO] Menjalankan Unity: %UNITY_EXE% %UNITY_ARGS%"
start "" "%UNITY_EXE%" %UNITY_ARGS%

call :log "[OK] Selesai. Server di background, Unity tampil di TV."
call :log "[INFO] Log tersimpan di: %LOG_DIR%"

REM Hapus lock file setelah proses start selesai
if exist "%LOCK_FILE%" del "%LOCK_FILE%" >nul 2>nul

if "%AUTO_CLOSE%"=="1" (
  timeout /t 3 /nobreak >nul
  exit /b 0
)

endlocal
goto :eof

REM ============================================================
REM  SUB-ROUTINE: cari *.exe di folder tertentu (kecuali UnityCrashHandler*.exe)
REM  Hasil disimpan ke UNITY_EXE jika belum diisi.
REM ============================================================
:findexe
if not exist "%~1\" goto :eof
for %%F in ("%~1\*.exe") do (
  if "!UNITY_EXE!"=="" (
    echo "%%~nF" | findstr /I "UnityCrashHandler" >nul 2>nul
    if errorlevel 1 (
      set "UNITY_EXE=%%~F"
      call :log "[INFO] Auto-detect EXE: %%~F"
    )
  )
)
goto :eof

REM ============================================================
REM  SUB-ROUTINE: log ke konsol + file
REM ============================================================
:log
echo [Gacha] %~1
echo [%date% %time%] %~1 >>"%LOG_MAIN%"
goto :eof
