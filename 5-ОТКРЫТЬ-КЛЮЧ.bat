@echo off
cd /d "%~dp0"
if not exist "server\.env" (
  echo Файл server\.env не найден. Сначала запустите 1-УСТАНОВИТЬ.bat.
  pause
  exit /b 1
)
notepad "server\.env"
