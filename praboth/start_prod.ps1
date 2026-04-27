Param(
    [string] $PolicyFile = "config/policy.production.example.toml",
    [string] $BackendHost = "127.0.0.1",
    [int] $BackendPort = 8000,
    [int] $FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvScripts = Join-Path $root ".venv\Scripts"
$backendExe = Join-Path $venvScripts "praboth-backend.exe"
$frontendDir = Join-Path $root "frontend"

if (-not (Test-Path $backendExe)) {
    Write-Error "Backend executable not found at $backendExe. Run 'python -m pip install -e .' in the root directory first."
}

if (-not (Test-Path $frontendDir)) {
    Write-Error "Frontend directory not found at $frontendDir."
}

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Output "Installing frontend dependencies..."
    Push-Location $frontendDir
    npm install
    Pop-Location
}

Write-Output "Building frontend production assets..."
Push-Location $frontendDir
npm run build
Pop-Location

Write-Host "Starting backend (production mode)..." -ForegroundColor Cyan
Start-Process -FilePath $backendExe `
    -ArgumentList "--config", $PolicyFile, "--host", $BackendHost, "--port", $BackendPort `
    -WorkingDirectory $root `
    -PassThru `
    -NoNewWindow

Write-Host "Starting frontend (production mode)..." -ForegroundColor Cyan
Start-Process -FilePath "npm.cmd" `
    -ArgumentList "run", "start", "--", "-p", $FrontendPort `
    -WorkingDirectory $frontendDir `
    -PassThru `
    -NoNewWindow

Write-Output "Launched production services."
Write-Output "Backend: http://$BackendHost`:$BackendPort"
Write-Output "Frontend: http://127.0.0.1:$FrontendPort"
