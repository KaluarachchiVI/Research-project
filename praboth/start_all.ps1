Param(
    [switch] $WithHooks,
    [string] $ExportReviewToken = "dev-review-token-$(Get-Date -Format 'yyyyMMddHHmmss')",
    [string] $ApiKey = "dev-api-key-$(Get-Date -Format 'yyyyMMddHHmmss')"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pyDir = Join-Path $root "."
$venv = Join-Path $pyDir ".venv\\Scripts"
$backendExe = Join-Path $venv "praboth-backend.exe"
$hookExe = Join-Path $venv "cle-os-hooks.exe"
$frontendDir = Join-Path $pyDir "frontend"
$aiServiceDir = Join-Path $pyDir "ai-service"

if (-not (Test-Path $backendExe)) {
    Write-Error "Backend executable not found at $backendExe. Run 'python -m pip install -e .' in the root directory first."
}

if (-not (Test-Path $frontendDir)) {
    Write-Error "Frontend directory not found at $frontendDir."
}

if (-not (Test-Path $aiServiceDir)) {
    Write-Error "AI Service directory not found at $aiServiceDir."
}

if ($WithHooks -and -not (Test-Path $hookExe)) {
    Write-Error "OS hook executable not found at $hookExe. Run 'python -m pip install -e .[hooks]' in the root directory first."
}

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Output "Installing frontend UI dependencies..."
    Push-Location $frontendDir
    npm install
    Pop-Location
}

if (-not (Test-Path (Join-Path $aiServiceDir "node_modules"))) {
    Write-Output "Installing AI Service dependencies..."
    Push-Location $aiServiceDir
    npm install
    Pop-Location
}

# Set environment variable for backend (export review token)
$env:EXPORT_REVIEW_TOKEN = $ExportReviewToken
$env:API_KEY = $ApiKey

# 1. Backend Service
Write-Host "Starting Backend Service on port 8000..." -ForegroundColor Cyan
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-NoProfile", "-Command", "`$env:EXPORT_REVIEW_TOKEN='$ExportReviewToken'; `$env:API_KEY='$ApiKey'; cd '$PSScriptRoot'; uvicorn backend.src.api.app:app --reload --port 8000" `
    -WindowStyle Normal

# 2. Frontend Application (Web UI)
Write-Host "Starting Web UI on port 3000..." -ForegroundColor Cyan
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-NoProfile", "-Command", "cd '$frontendDir'; npm run dev" `
    -WindowStyle Normal

# 3. AI Service (Genkit Context Categorization)
Write-Host "Starting AI Service on port 3400..." -ForegroundColor Cyan
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-NoProfile", "-Command", "cd '$aiServiceDir'; npm run dev" `
    -WindowStyle Normal

# 4. Ollama LLM
Write-Host "Starting Ollama LLM (llama3.2:3b)..." -ForegroundColor Cyan
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-NoProfile", "-Command", "ollama run llama3.2:3b" `
    -WindowStyle Normal

# 5. FocusReminder logs (tail file in its own terminal)
Write-Host "Tailing FocusReminder logs..." -ForegroundColor Cyan
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-NoProfile", "-Command", "cd '$PSScriptRoot'; if (-not (Test-Path 'data')) { New-Item -ItemType Directory -Path 'data' | Out-Null }; if (-not (Test-Path 'data/focus_reminder.log')) { New-Item -ItemType File -Path 'data/focus_reminder.log' | Out-Null }; Get-Content -Path 'data/focus_reminder.log' -Wait -Tail 200" `
    -WindowStyle Normal

if ($WithHooks) {
    Write-Host "Starting OS Hook Streamer..." -ForegroundColor Cyan
    Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-NoProfile", "-Command", "`$env:API_KEY='$ApiKey'; cd '$pyDir'; & '$hookExe' --endpoint http://127.0.0.1:8000/events --api-key '$ApiKey'" `
        -WindowStyle Normal
}

Write-Output ""
Write-Output "========================================" -ForegroundColor Green
Write-Output "All services launched in separate terminals!" -ForegroundColor Green
Write-Output "========================================" -ForegroundColor Green
Write-Output ""
Write-Output "Services:" -ForegroundColor Yellow
Write-Output "  Backend API:  http://localhost:8000" -ForegroundColor Cyan
Write-Output "  Web UI:       http://localhost:3000" -ForegroundColor Cyan
Write-Output "  AI Service:   http://localhost:3400" -ForegroundColor Cyan
if ($WithHooks) {
    Write-Output "  OS Hooks:     Running (context monitoring)" -ForegroundColor Cyan
}
Write-Output ""
Write-Output "To stop services, close the respective terminal windows." -ForegroundColor Yellow
