@echo off
REM ============================================================
REM  STOP GACHA SYSTEM - mematikan kedua server node
REM ============================================================
echo [Gacha] Menghentikan server quiz (3005) & management (3011)...

REM 1. Coba hentikan window cmd berjudul khusus dulu
taskkill /FI "WINDOWTITLE eq Gacha-ServerQuiz-3005*" /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq Gacha-QuizMgmt-3011*" /F >nul 2>nul

REM 2. Paksa bunuh sisa proses yang masih memegang port (andal di Win10/11)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3005" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3011" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul

echo [Gacha] Selesai.
pause
