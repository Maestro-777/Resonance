@echo off
cd /d "%~dp0"
if not exist "server\.env" (
  echo Run 1-УСТАНОВИТЬ.bat first.
  pause
  exit /b 1
)
echo Starting Resonance frontend and music server...
call npm run dev
pause
