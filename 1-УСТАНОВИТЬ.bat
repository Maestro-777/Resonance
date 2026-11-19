@echo off
cd /d "%~dp0"
echo ============================================
echo   Resonance - установка
echo ============================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)
call npm run install:all
if errorlevel 1 (
  echo Dependency installation failed.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1"
if errorlevel 1 (
  echo Server configuration failed.
  pause
  exit /b 1
)
echo.
echo Installation complete. Start Resonance with 2-ЗАПУСТИТЬ.bat
pause
