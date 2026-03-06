# Start Praboth Service
# This script starts the praboth cognitive load estimation service

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$prabothDir = Join-Path $scriptPath "praboth"
$venvScripts = Join-Path $prabothDir ".venv\Scripts"
$exePath = Join-Path $venvScripts "cog-py-est.exe"
$configPath = Join-Path $prabothDir "policy_1.toml"

if (-not (Test-Path $exePath)) {
    Write-Error "Praboth not found. Run 'python setup_praboth.py' first."
    exit 1
}

if (-not (Test-Path $configPath)) {
    Write-Error "Config file not found: $configPath"
    exit 1
}

Write-Host "=" * 70
Write-Host "Starting Praboth Service"
Write-Host "=" * 70
Write-Host ""
Write-Host "Config: $configPath"
Write-Host "API will be available at: http://127.0.0.1:8000"
Write-Host ""
Write-Host "To stop, press Ctrl+C"
Write-Host ""

Push-Location $prabothDir
& $exePath --config policy_1.toml
Pop-Location



