@echo off
REM ============================================================
REM  INSTALL GACHA KE WINDOWS STARTUP
REM  Jalankan sekali sebagai Administrator untuk memasang
REM  shortcut start-gacha.bat ke folder Startup Windows.
REM
REM  Setelah ini, setiap PC menyala → start-gacha.bat otomatis
REM  dijalankan: server-quiz (3005), quiz-management (3011),
REM  dan Unity EXE (auto-detect di UnityBuild\).
REM ============================================================
setlocal

set "BAT_FILE=E:\web\2026\tempe-park\Gacha\start-gacha.bat"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP_DIR%\GachaAutoStart.lnk"

echo [Install] Folder Startup : %STARTUP_DIR%
echo [Install] Script target  : %BAT_FILE%

REM ---- Cek file bat ada ----
if not exist "%BAT_FILE%" (
  echo [Install][ERROR] File tidak ditemukan: %BAT_FILE%
  pause
  exit /b 1
)

REM ---- Buat shortcut via PowerShell (satu baris agar errorlevel bersih) ----
set "PS_CMD=$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath='%BAT_FILE%'; $s.WorkingDirectory='E:\web\2026\tempe-park\Gacha'; $s.WindowStyle=1; $s.Description='Auto-start Gacha System'; $s.Save()"
powershell -NoProfile -ExecutionPolicy Bypass -Command "%PS_CMD%"

if exist "%SHORTCUT%" (
  echo.
  echo [Install] BERHASIL! Shortcut dibuat:
  echo [Install]   %SHORTCUT%
  echo.
  echo [Install] Setiap PC menyala, sistem akan otomatis menjalankan:
  echo [Install]   - server-quiz-tempe  (port 3005)
  echo [Install]   - quiz-management    (port 3011)
  echo [Install]   - Unity EXE (dari folder UnityBuild\)
  echo.
  echo [Install] Taruh hasil Build Unity di:
  echo [Install]   E:\web\2026\tempe-park\Gacha\UnityBuild\
) else (
  echo [Install][ERROR] Shortcut gagal dibuat. Coba jalankan sebagai Administrator.
)

echo.
pause
endlocal
