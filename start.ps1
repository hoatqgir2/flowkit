# Flow Kit — Windows PowerShell Launcher
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

if (-not (Test-Path "$ScriptDir\venv\Scripts\python.exe")) {
    Write-Error "Virtual environment not found at .\venv. Please run .\setup.ps1 first."
    exit 1
}

$env:PATH = "$ScriptDir\venv\Scripts;$env:PATH"
$env:PYTHONUTF8 = "1"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Starting Flow Kit on Windows" -ForegroundColor Cyan
Write-Host "  Base URL: http://127.0.0.1:8100" -ForegroundColor Green
Write-Host "  Extension WS: ws://127.0.0.1:9222" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

& "$ScriptDir\venv\Scripts\python.exe" -m agent.main
