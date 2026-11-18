@echo off
title Paytm Business Dashboard 24/7 Monitor Worker
color 0B
cd /d "%~dp0"

echo ===============================================================================
echo   PAYTM BUSINESS DASHBOARD 24/7 MONITOR & ORDER RECONCILER
echo ===============================================================================
echo.

if not exist node_modules (
  echo [Setup] Installing worker dependencies...
  call npm install
  if errorlevel 1 (
    echo [Error] Failed to install dependencies. Make sure Node.js is installed.
    pause
    exit /b 1
  )
  echo [Setup] Ensuring Playwright Chromium browser is installed...
  call npx playwright install chromium
)

:loop
echo [%time%] Starting monitor worker...
node monitor.js
echo.
echo [%time%] Worker exited with code %errorlevel%.
echo Waiting 10 seconds before auto-restarting...
timeout /t 10 /nobreak >nul
goto loop
