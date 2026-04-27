Param(
    [switch] $WithHooks
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pyDir = Join-Path $root "."
$venv = Join-Path $pyDir ".venv\\Scripts"
$backendExe = Join-Path $venv "praboth-backend.exe"
$hookExe = Join-Path $venv "cle-os-hooks.exe"
$frontendDir = Join-Path $pyDir "frontend"

if (-not (Test-Path $backendExe)) {
    Write-Error "Backend executable not found at $backendExe. Run 'python -m pip install -e .' in the root directory first."
}

if (-not (Test-Path $frontendDir)) {
    Write-Error "Frontend directory not found at $frontendDir."
}

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Output "Installing frontend UI dependencies..."
    Push-Location $frontendDir
    npm install
    Pop-Location
}

# 1. Backend Service
Write-Host "Starting Backend Service..." -ForegroundColor Cyan
Start-Process -FilePath "uvicorn" `
    -ArgumentList "backend.src.api.app:app", "--reload", "--port", "8000" `
    -WorkingDirectory "$PSScriptRoot" `
    -PassThru `
    -NoNewWindow

# 2. Frontend Application (Web UI)
Write-Host "Starting Web UI..." -ForegroundColor Cyan
Start-Process -FilePath "npm" `
    -ArgumentList "run", "dev" `
    -WorkingDirectory "$PSScriptRoot\frontend" `
    -PassThru `
    -NoNewWindow

if ($WithHooks) {
    Write-Output "Starting OS hook streamer..."
    Start-Process -NoNewWindow powershell -ArgumentList "-NoProfile", "-Command", "cd '$pyDir'; & '$hookExe' --endpoint http://127.0.0.1:8000/events"
}

Write-Output "Launched. UI available at http://localhost:3000 (Next dev)."
