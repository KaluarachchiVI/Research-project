# Start Intent-Lock integrated stack: backend (8001) + frontend (3000)
# Run from repo root or andrew folder. Use two terminals for backend and frontend.

$ErrorActionPreference = "Stop"
# Script lives in andrew/; backend and frontend are andrew/intentlock-backend and andrew/intentlock-frontend
$andrewDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$backend = Join-Path $andrewDir "intentlock-backend"
$frontend = Join-Path $andrewDir "intentlock-frontend"

Write-Host "Intent-Lock integrated start" -ForegroundColor Cyan
Write-Host ""

# Check .env.local for frontend
$envLocal = Join-Path $frontend ".env.local"
if (-not (Test-Path $envLocal)) {
    $example = Join-Path $frontend ".env.local.example"
    if (Test-Path $example) {
        Copy-Item $example $envLocal
        Write-Host "Created .env.local from .env.local.example (Intent-Lock 8001, CLE 8000)." -ForegroundColor Yellow
    }
}

Write-Host "Terminal 1 - Backend (run this first):" -ForegroundColor Green
Write-Host "  cd $backend"
Write-Host "  python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload"
Write-Host ""
Write-Host "Terminal 2 - Frontend:" -ForegroundColor Green
Write-Host "  cd $frontend"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Then open http://localhost:3000 and try End Session." -ForegroundColor Cyan
Write-Host "See andrew/RUN_AND_VERIFY.md for full steps and checks." -ForegroundColor Gray
