@echo off
chcp 65001 >nul
setlocal
title Resonance - доступ с телефона
cd /d "%~dp0"

echo.
echo НАСТРОЙКА ПРИВАТНОГО ДОСТУПА ЧЕРЕЗ TAILSCALE
echo =============================================
echo.
where tailscale >nul 2>nul
if errorlevel 1 (
  echo Tailscale не найден.
  echo Установите его на компьютер и телефон:
  echo https://tailscale.com/download
  start "" "https://tailscale.com/download"
  pause
  exit /b 1
)

powershell -NoProfile -Command "$c=New-Object Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1',5173); exit 0 } catch { exit 1 } finally { $c.Dispose() }"
if errorlevel 1 (
  echo Сначала запустите 2-ЗАПУСТИТЬ.bat, затем повторите настройку.
  pause
  exit /b 1
)

echo Включаю приватный HTTPS-доступ...
tailscale serve --bg http://127.0.0.1:5173
if errorlevel 1 (
  echo Не удалось включить Tailscale Serve.
  echo Проверьте, что Tailscale запущен и выполнен вход.
  pause
  exit /b 1
)

echo.
echo Адрес для телефона показан ниже:
echo.
tailscale serve status
echo.
echo Скопируйте HTTPS-адрес вида https://имя-компьютера.имя-сети.ts.net и откройте его на телефоне.
echo Tailscale должен быть включён на компьютере и телефоне.
echo Компьютер должен оставаться включённым и не переходить в сон.
echo Порт музыкального API 4317 наружу не публикуется.
pause
