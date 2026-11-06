@echo off
setlocal
title FINORA - Tally Sync Launcher
pushd "%~dp0"

echo ============================================================
echo                 FINORA Tally Sync Engine
echo ============================================================
echo.

echo [1/3] Checking Python installation...
py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if errorlevel 1 (
    python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Python 3.10 or later was not found.
        echo Install Python and ensure it is available in PATH, then try again.
        pause
        popd
        exit /b 1
    )
    set "PYTHON=python"
) else (
    set "PYTHON=py -3"
)

echo [2/3] Checking configuration (.env)...
if not exist ".env" (
    if not exist ".env.example" (
        echo [ERROR] .env.example is missing. Restore it from the project files.
        pause
        popd
        exit /b 1
    )
    copy ".env.example" ".env" >nul
    echo A .env file was created from .env.example.
    echo Update its Supabase settings, Company ID, and Tally company name.
    notepad ".env"
    echo Save the file, then run this launcher again.
    pause
    popd
    exit /b 1
)

echo [3/3] Starting Tally sync...
echo.
%PYTHON% tally_sync.py
if errorlevel 1 (
    echo.
    echo [ERROR] Sync failed. Read the message above, check .env and TallyPrime,
    echo then run this launcher again.
    pause
    popd
    exit /b 1
)

echo.
echo Sync finished successfully.
pause
popd
exit /b 0
