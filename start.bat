@echo off
setlocal
cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found at .\venv.
    echo Please run setup.bat first!
    pause
    exit /b 1
)

set "PATH=%~dp0venv\Scripts;%PATH%"
set "PYTHONUTF8=1"

echo =========================================
echo   Starting Flow Kit on Windows
echo   Base URL: http://127.0.0.1:8100
echo   Extension WS: ws://127.0.0.1:9222
echo =========================================
echo.

"%~dp0venv\Scripts\python.exe" -m agent.main
endlocal
