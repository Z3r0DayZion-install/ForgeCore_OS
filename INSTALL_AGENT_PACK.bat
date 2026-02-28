@echo off
setlocal ENABLEDELAYEDEXPANSION

echo ==========================================
echo ForgeCore Agent Ops Pack Installer
echo ==========================================

REM ----- CONFIG -----
set ZIP_FILE=ForgeCore_AGENT_OPS_PACK.zip
set TARGET_DIR=docs\AGENT_OPS_PACK

REM ----- CHECK ZIP -----
if not exist "%ZIP_FILE%" (
    echo ERROR: %ZIP_FILE% not found in current directory.
    echo Place the zip in the repo root and run again.
    exit /b 1
)

REM ----- CREATE TARGET DIR -----
if not exist "docs" (
    mkdir docs
)

if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

REM ----- EXTRACT USING POWERSHELL -----
echo Extracting Agent Ops Pack...
powershell -Command "Expand-Archive -Force '%ZIP_FILE%' '.'"

if %ERRORLEVEL% neq 0 (
    echo ERROR: Extraction failed.
    exit /b 1
)

REM ----- VERIFY FILES -----
if exist "%TARGET_DIR%\README_AGENT_START.md" (
    echo.
    echo SUCCESS: Agent Ops Pack installed.
) else (
    echo.
    echo WARNING: Expected files not found in %TARGET_DIR%.
    echo Check folder structure manually.
)

echo.
echo Installation complete.
echo ==========================================
pause
endlocal