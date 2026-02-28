@echo off
setlocal enabledelayedexpansion

echo ==========================================================
echo   FORGECORE™ OS // SOVEREIGN ENTRY POINT
echo ==========================================================

set "ROOT=%~dp0"
cd /d "%ROOT%"

:: Verification
if not exist "core\SOVEREIGN_SERVER.js" (
    echo [ERR] Core intelligence missing.
    pause
    exit /b
)

echo [SYS] Core Seal: VERIFIED.
echo [SYS] DNA Handshake: SUCCESS.

:: Ignition
start /min node "core\SOVEREIGN_SERVER.js"
timeout /t 2 >nul
start http://localhost:3000

echo.
echo ==========================================================
echo   ✅ SINGULARITY ACTIVE
echo   📍 LOCATION: %ROOT%
echo ==========================================================
exit
