@echo off
setlocal
title Resonance - проверка сервера
echo Проверяю локальный API Resonance...
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:4317/api/health' -TimeoutSec 5; Write-Host ('API: OK, version ' + $r.version); exit 0 } catch { Write-Host 'API недоступен. Сначала запустите 2-ЗАПУСТИТЬ.bat.'; exit 1 }"
if errorlevel 1 pause
