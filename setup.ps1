# Flow Kit — Windows Native Setup (No WSL required)
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Flow Kit — Windows Native Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check Python
$pyCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pyCmd = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pyCmd = "py"
}

if (-not $pyCmd) {
    Write-Error "Python 3 not found. Please install Python 3.10+ from https://www.python.org/downloads/ (check 'Add Python to PATH')"
    exit 1
}

$pyVer = & $pyCmd -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"
Write-Host "  OK: Python $pyVer detected" -ForegroundColor Green

# Virtual Environment
if (-not (Test-Path "$ScriptDir\venv")) {
    Write-Host "Creating virtual environment at .\venv..." -ForegroundColor Yellow
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        uv venv venv
    } else {
        & $pyCmd -m venv venv
    }
} else {
    Write-Host "  Exists: .\venv" -ForegroundColor Green
}

$venvPython = "$ScriptDir\venv\Scripts\python.exe"

# Install dependencies
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
if (Get-Command uv -ErrorAction SilentlyContinue) {
    uv pip install -r requirements.txt --python $venvPython
    uv pip install static-ffmpeg --python $venvPython
} else {
    & $venvPython -m pip install --upgrade pip
    & $venvPython -m pip install -r requirements.txt
    & $venvPython -m pip install static-ffmpeg
}

# Ensure ffmpeg & ffprobe in venv\Scripts
Write-Host "Configuring FFmpeg & FFprobe..." -ForegroundColor Yellow
& $venvPython -c "import static_ffmpeg; static_ffmpeg.add_paths()"
$staticFfmpegDir = "$ScriptDir\venv\Lib\site-packages\static_ffmpeg\bin\win32"
if (Test-Path $staticFfmpegDir) {
    Copy-Item "$staticFfmpegDir\*.exe" -Destination "$ScriptDir\venv\Scripts\" -Force
}

$env:PATH = "$ScriptDir\venv\Scripts;$env:PATH"
$env:PYTHONUTF8 = "1"

# Verify imports
Write-Host "Verifying agent imports..." -ForegroundColor Yellow
& $venvPython -c "from agent.main import app; print('  OK: agent.main imports successfully')"

# Generate AI tool configs
Write-Host "Generating AI tool configs..." -ForegroundColor Yellow
& $venvPython setup.py --tool all

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Setup completed successfully!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Load Chrome extension:"
Write-Host "     Open chrome://extensions -> Enable 'Developer mode' -> Click 'Load unpacked' -> Select '$ScriptDir\extension'"
Write-Host "  2. Start the server:"
Write-Host "     Run .\start.ps1  (or double click start.bat)"
Write-Host "  3. Open Google Flow:"
Write-Host "     https://flow.google.com/ (sign in with your account)"
Write-Host "  4. (Optional) Run Dashboard:"
Write-Host "     cd dashboard; npm run dev"
Write-Host ""
