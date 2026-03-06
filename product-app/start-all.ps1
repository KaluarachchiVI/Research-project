Param(
    [switch]$WithServer  # include scheduler + Yuvidu
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$olderRoot = Join-Path $root "..\\older" | Resolve-Path
$newerRoot = Join-Path $root "..\\newer" | Resolve-Path

Write-Host "=== Product App: Adaptive Scheduler Stack ===" -ForegroundColor Cyan
Write-Host "Root: $root"
Write-Host ""

#
# 1) Client-side: CLE + Intent-Lock (your machine)
#

Write-Host "1) Ensuring CLE (praboth) environment is set up..." -ForegroundColor Yellow
Push-Location $newerRoot
python setup_praboth.py
Pop-Location

Write-Host "2) Starting CLE service (port 8000)..." -ForegroundColor Green
Start-Process powershell -WorkingDirectory (Join-Path $newerRoot "praboth") -ArgumentList @(
    "-NoExit",
    "-Command",
    "Write-Host 'CLE running at http://127.0.0.1:8000'; .\.venv\Scripts\cog-py-est.exe --config policy_1.toml"
) | Out-Null

Write-Host "3) Starting Intent-Lock backend (port 8001)..." -ForegroundColor Green
Start-Process powershell -WorkingDirectory (Join-Path $newerRoot "andrew\intentlock-backend") -ArgumentList @(
    "-NoExit",
    "-Command",
    "Write-Host 'Intent-Lock backend at http://127.0.0.1:8001'; python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload"
) | Out-Null

Write-Host "4) Starting Intent-Lock frontend (port 3000)..." -ForegroundColor Green
Start-Process powershell -WorkingDirectory (Join-Path $newerRoot "andrew\intentlock-frontend") -ArgumentList @(
    "-NoExit",
    "-Command",
    "`$env:NEXT_PUBLIC_INTENTLOCK_API_BASE='http://127.0.0.1:8001'; `$env:NEXT_PUBLIC_CLE_API_BASE='http://127.0.0.1:8000'; `$env:NEXT_PUBLIC_SCHEDULER_API_BASE='http://127.0.0.1:5000'; `$env:NEXT_PUBLIC_YUVIDU_API_BASE='http://127.0.0.1:5001'; Write-Host 'Intent-Lock UI at http://localhost:3000'; npm run dev"
) | Out-Null

#
# 2) Optional server-side: Scheduler + Yuvidu (central server)
#

if ($WithServer) {
    Write-Host ""
    Write-Host "5) Starting Scheduler API (port 5000)..." -ForegroundColor Green
    Start-Process powershell -WorkingDirectory $olderRoot -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host 'Scheduler API at http://127.0.0.1:5000'; python -m src.api.app"
    ) | Out-Null

    Write-Host "6) Starting Yuvidu backend (port 5001)..." -ForegroundColor Green
    Start-Process powershell -WorkingDirectory (Join-Path $newerRoot "yuvidu\backend") -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host 'Yuvidu backend at http://127.0.0.1:5001'; python -m uvicorn server:app --host 127.0.0.1 --port 5001 --reload"
    ) | Out-Null

    Write-Host "7) Starting Yuvidu frontend (web dev server only)..." -ForegroundColor Green
    Start-Process powershell -WorkingDirectory (Join-Path $newerRoot "yuvidu\frontend") -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host 'Yuvidu UI dev server starting (see terminal for port)...'; npm run dev:react"
    ) | Out-Null
}

Write-Host ""
Write-Host "Launch complete." -ForegroundColor Cyan
Write-Host "Open http://localhost:3000 for the Intent-Lock overlay." -ForegroundColor Cyan

