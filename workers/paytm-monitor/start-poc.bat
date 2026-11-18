@echo off
title Paytm Business Dashboard - Phase 1 Feasibility POC
color 0A
cd /d "%~dp0"

echo ===============================================================================
echo   PAYTM BUSINESS DASHBOARD MONITOR - PHASE 1 FEASIBILITY PROOF OF CONCEPT
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

echo [Running] Starting Phase 1 Feasibility POC...
node poc.js

echo.
echo ===============================================================================
echo   POC Run Finished. Check logs\poc-feasibility-report.json for details.
echo ===============================================================================
pause
