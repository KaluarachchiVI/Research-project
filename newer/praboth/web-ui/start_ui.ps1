# Start Praboth Web UI
# This script uses the local Next.js version to avoid version conflicts

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$nextCmd = Join-Path $scriptPath "node_modules\.bin\next.cmd"

if (-not (Test-Path $nextCmd)) {
    Write-Error "Next.js not found. Run 'npm install' first."
    exit 1
}

Write-Host "=" * 70
Write-Host "Starting Praboth Web UI"
Write-Host "=" * 70
Write-Host ""
Write-Host "Using local Next.js version"
Write-Host "UI will be available at: http://localhost:3000"
Write-Host ""
Write-Host "To stop, press Ctrl+C"
Write-Host ""

Push-Location $scriptPath
& $nextCmd dev
Pop-Location

