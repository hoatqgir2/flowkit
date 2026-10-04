@echo off
setlocal
cd /d "%~dp0"

echo =========================================
echo   Flow Kit -- Windows Native Setup
echo =========================================
echo.

where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    where py >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Python not found. Please install Python 3.10+ from https://www.python.org/
        pause
        exit /b 1
    )
    set PY_CMD=py
) else (
    set PY_CMD=python
)

if not exist "venv" (
    echo Creating virtual environment at .\venv...
    where uv >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        uv venv venv
    ) else (
        %PY_CMD% -m venv venv
    )
)

echo Installing dependencies...
where uv >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    uv pip install -r requirements.txt --python venv\Scripts\python.exe
    uv pip install static-ffmpeg --python venv\Scripts\python.exe
) else (
    venv\Scripts\python.exe -m pip install --upgrade pip
    venv\Scripts\python.exe -m pip install -r requirements.txt
    venv\Scripts\python.exe -m pip install static-ffmpeg
)

echo Configuring FFmpeg and FFprobe...
venv\Scripts\python.exe -c "import static_ffmpeg; static_ffmpeg.add_paths()"
if exist "venv\Lib\site-packages\static_ffmpeg\bin\win32" (
    copy /y "venv\Lib\site-packages\static_ffmpeg\bin\win32\*.exe" "venv\Scripts\" >nul
)

set "PATH=%~dp0venv\Scripts;%PATH%"
set "PYTHONUTF8=1"

echo Verifying agent imports...
venv\Scripts\python.exe -c "from agent.main import app; print('  OK: agent.main imports successfully')"

echo Generating AI configs...
venv\Scripts\python.exe setup.py --tool all

echo.
echo =========================================
echo   Setup completed successfully!
echo =========================================
echo Run start.bat to launch Flow Kit.
echo.
pause
endlocal
