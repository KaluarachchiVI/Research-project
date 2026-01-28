Param(
    [switch] $WithHooks
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pyDir = Join-Path $root "."
$venv = Join-Path $pyDir ".venv\\Scripts"
$backendExe = Join-Path $venv "cog-py-est.exe"
$hookExe = Join-Path $venv "cle-os-hooks.exe"
$uiDir = Join-Path $pyDir "web-ui"

if (-not (Test-Path $backendExe)) {
    Write-Error "Backend not found. Run 'python -m venv .venv' and 'python -m pip install .[hooks]' in cog_py_est first."
    Write-Error "Backend not found. Run 'python -m venv .venv' and 'python -m pip install .[hooks]' in backend first."
}

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Output "Installing frontend UI dependencies..."
    Push-Location $frontendDir
    npm install
    Pop-Location
}

# 1. Backend Service
Write-Host "Starting Backend Service..." -ForegroundColor Cyan
$BackendProcess = Start-Process -FilePath "uvicorn" `
    -ArgumentList "backend.src.api.app:app", "--reload", "--port", "8000" `
    -WorkingDirectory "$PSScriptRoot" `
    -PassThru `
    -NoNewWindow

# 2. Frontend Application (Web UI)
Write-Host "Starting Web UI..." -ForegroundColor Cyan
$FrontendProcess = Start-Process -FilePath "npm" `
    -ArgumentList "run", "dev" `
    -WorkingDirectory "$PSScriptRoot\frontend" `
    -PassThru `
    -NoNewWindow

if ($WithHooks) {
    Write-Output "Starting OS hook streamer..."
    Start-Process -NoNewWindow powershell -ArgumentList "-NoProfile", "-Command", "cd '$pyDir'; & '$hookExe' --endpoint http://127.0.0.1:8000/events"
}

Write-Output "Launched. UI available at http://localhost:3000 (Next dev)."
