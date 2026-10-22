@echo off
REM ============================================================
REM  AUTO-START GACHA SYSTEM (TV KIOSK MODE)
REM  - server-quiz-tempe  (port 3005, logic Unity via WS/API)
REM  - quiz-management    (port 3011, API soal untuk Unity)
REM  - Unity EXE (tampil fullscreen di TV, TANPA browser)
REM
REM  Cara pasang sekali saja:
REM   1. Isi UNITY_EXE di bawah
REM   2. Win+R > shell:startup > taruh SHORTCUT file ini
REM   3. Aktifkan auto-login + power "never sleep"
REM ============================================================
setlocal EnableDelayedExpansion

REM ---- KONFIGURASI: EDIT BAGIAN INI SAJA ----
REM Contoh: set "UNITY_EXE=D:\Game\Gacha\Gacha.exe"
set "UNITY_EXE="
REM Argumen Unity (fullscreen). Kosongkan jika tidak perlu.
set "UNITY_ARGS=-screen-fullscreen 1"
REM Max tunggu server siap (detik)
set "MAX_WAIT=30"
REM 1 = tutup window launcher ini otomatis setelah Unity jalan, 0 = tetap tampil
set "AUTO_CLOSE=1"
REM -------------------------------------------

set "DIR_QUIZ=E:\web\2026\tempe-park\Gacha\server-quiz-tempe"
set "DIR_MGMT=E:\web\2026\tempe-park\Gacha\quiz-management-tempe"
set "LOG_DIR=E:\web\2026\tempe-park\Gacha\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>nul
set "LOG_QUIZ=%LOG_DIR%\server-3005.log"
set "LOG_MGMT=%LOG_DIR%\mgmt-3011.log"

echo [Gacha] === Start %date% %time% ===

REM ---- 0. Cek Node.js ----
where node >nul 2>nul
if errorlevel 1 (
  echo [Gacha][ERROR] node tidak ditemukan di PATH. Install Node.js LTS v20.
  pause
  exit /b 1
)

REM ---- 1. Jalankan server-quiz 3005 (skip jika port sudah LISTENING) ----
netstat -ano | findstr /C:":3005" | findstr /C:"LISTENING" >nul 2>nul
if errorlevel 1 (
  echo [Gacha] Menjalankan server-quiz (3005)...
  start "Gacha-ServerQuiz-3005" /min cmd /c "cd /d "%DIR_QUIZ%" && node server.js ^>^> "%LOG_QUIZ%" 2^>^&1"
) else (
  echo [Gacha] Port 3005 sudah jalan, skip (anti double-run).
)

REM ---- 2. Jalankan quiz-management 3011 (skip jika port sudah LISTENING) ----
netstat -ano | findstr /C:":3011" | findstr /C:"LISTENING" >nul 2>nul
if errorlevel 1 (
  echo [Gacha] Menjalankan quiz-management (3011)...
  start "Gacha-QuizMgmt-3011" /min cmd /c "cd /d "%DIR_MGMT%" && node server.js ^>^> "%LOG_MGMT%" 2^>^&1"
) else (
  echo [Gacha] Port 3011 sudah jalan, skip (anti double-run).
)

REM ---- 3. Tunggu server-quiz SIAP (health check, bukan delay buta) ----
echo [Gacha] Menunggu server-quiz siap (max %MAX_WAIT% detik)...
set "READY3005=0"
for /L %%i in (1,1,%MAX_WAIT%) do (
  curl -s -o nul --max-time 2 http://127.0.0.1:3005/api/config >nul 2>nul
  if !errorlevel! EQU 0 (
    set "READY3005=1"
    echo [Gacha] server-quiz SIAP setelah %%i detik.
    goto :check3011
  )
  timeout /t 1 /nobreak >nul
)
:check3011
if "%READY3005%"=="0" (
  echo [Gacha][WARN] server-quiz belum merespon /api/config setelah %MAX_WAIT% detik.
  echo [Gacha][WARN] Cek log: %LOG_QUIZ%
)

REM ---- 4. Tunggu quiz-management SIAP (ringan, 10 detik max) ----
set "READY3011=0"
for /L %%i in (1,1,10) do (
  curl -s -o nul --max-time 2 http://127.0.0.1:3011/ >nul 2>nul
  if !errorlevel! EQU 0 (
    set "READY3011=1"
    goto :rununity
  )
  timeout /t 1 /nobreak >nul
)
:rununity
if "%READY3011%"=="0" (
  echo [Gacha][WARN] quiz-management belum merespon setelah 10 detik. Unity tetap dijalankan.
  echo [Gacha][WARN] Cek log: %LOG_MGMT%
) else (
  echo [Gacha] quiz-management SIAP.
)

REM ---- 5. Jalankan Unity EXE fullscreen (TANPA browser) ----
REM Auto-detect: kalau UNITY_EXE kosong, cari EXE di folder umum.
REM Nanti tinggal taruh hasil Build Unity di salah satu folder ini, tanpa edit bat.
if "%UNITY_EXE%"=="" (
  echo [Gacha] UNITY_EXE kosong, mencoba auto-detect...
  for %%D in ("E:\web\2026\tempe-park\Gacha\UnityBuild" "E:\web\2026\tempe-park\Gacha\Build" "E:\web\2026\tempe-park\Gacha\Game" "E:\web\2026\tempe-park\Gacha") do (
    for %%F in ("%%~D\*.exe") do (
      if "!UNITY_EXE!"=="" if exist "%%~F" (
        set "UNITY_EXE=%%~F"
        echo [Gacha] Auto-detect ketemu: %%~F
      )
    )
  )
)
if "%UNITY_EXE%"=="" (
  echo.
  echo [Gacha][WARN] UNITY_EXE belum diisi dan tidak ketemu EXE otomatis.
  echo [Gacha][WARN] Server tetap jalan. Nanti isi manual atau taruh EXE di:
  echo [Gacha][WARN]   E:\web\2026\tempe-park\Gacha\UnityBuild\ ^(disarankan^)
  echo.
  pause
  exit /b 0
)

if not exist "%UNITY_EXE%" (
  echo [Gacha][ERROR] UNITY_EXE tidak ditemukan: %UNITY_EXE%
  pause
  exit /b 1
)

echo [Gacha] Menjalankan Unity: %UNITY_EXE% %UNITY_ARGS%
start "" "%UNITY_EXE%" %UNITY_ARGS%

echo [Gacha] Selesai. Server hidden di background, Unity tampil di TV.
echo [Gacha] Log: %LOG_DIR%

if "%AUTO_CLOSE%"=="1" (
  timeout /t 3 /nobreak >nul
  exit /b 0
)

endlocal
