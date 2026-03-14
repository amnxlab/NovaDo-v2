@echo off
setlocal enabledelayedexpansion
title NovaDo v2

cd /d "%~dp0"

echo.
echo  =====================================================
echo    NovaDo v2  --  Neuro-First Productivity OS
echo  =====================================================
echo.

:: ── Release ports 3000 and 3001 if already occupied ─────────────────────────
for %%P in (3000 3001) do (
  for /f "tokens=5 delims= " %%a in ('netstat -ano 2^>nul ^| findstr /r "[:.]%%P " ^| findstr "LISTENING"') do (
    if not "%%a"=="" (
      echo   Releasing port %%P  ^(PID %%a^)...
      taskkill /F /PID %%a >nul 2>&1
    )
  )
)

:: ── Install dependencies if node_modules is absent ──────────────────────────
if not exist "node_modules\" (
  echo   Installing dependencies...
  echo.
  npm install
  if errorlevel 1 (
    echo.
    echo   ERROR: npm install failed. Make sure Node.js is installed.
    echo   Download from https://nodejs.org/
    pause
    exit /b 1
  )
)

echo.
echo   Data server  ^>^>  http://localhost:3001
echo   App          ^>^>  http://localhost:3000
echo   Press Ctrl+C to stop.
echo.

npm run dev

:: Keep window open if the process exits unexpectedly
echo.
echo   NovaDo stopped.
pause
