Param(
    [string]$ClePort = "8000",
    [string]$IntentLockPort = "8001",
    [string]$FrontendPort = "3000"
)

Write-Host "Starting CLE (cog-py-est) and Intent-Lock on Windows..." -ForegroundColor Cyan

# Adjust these paths if your repo layout is different
$repoRoot = Split-Path -Parent $PSScriptRoot | Split-Path -Parent
$clePath = Join-Path $repoRoot "newer\praboth-newfx"
$intentBackendPath = Join-Path $repoRoot "newer\andrew\intentlock-backend"
$intentFrontendPath = Join-Path $repoRoot "newer\andrew\intentlock-frontend"

Write-Host "Repo root: $repoRoot"

# Start CLE service (cog-py-est) in a new window
Write-Host "Starting CLE on port $ClePort..."
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location `"$clePath`"; `n",
    "Write-Host 'Starting CLE (port $ClePort)...'; `n",
    "uvicorn cog_py_est.app:create_app --factory --host 127.0.0.1 --port $ClePort"
) | Out-Null

# Start Intent-Lock backend
Write-Host "Starting Intent-Lock backend on port $IntentLockPort..."
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location `"$intentBackendPath`"; `n",
    "Write-Host 'Starting Intent-Lock backend (port $IntentLockPort)...'; `n",
    "uvicorn main:app --host 127.0.0.1 --port $IntentLockPort"
) | Out-Null

# Start Intent-Lock frontend
Write-Host "Starting Intent-Lock frontend on port $FrontendPort..."
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location `"$intentFrontendPath`"; `n",
    "\$env:NEXT_PUBLIC_INTENTLOCK_API_BASE = 'http://127.0.0.1:' + $IntentLockPort; `n",
    "\$env:NEXT_PUBLIC_CLE_API_BASE = 'http://127.0.0.1:' + $ClePort; `n",
    "Write-Host 'Starting Intent-Lock frontend (port $FrontendPort)...'; `n",
    "npm run dev -- --port $FrontendPort"
) | Out-Null

Write-Host "CLE and Intent-Lock launch sequence triggered." -ForegroundColor Green

