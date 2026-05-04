Param(
    [string] $PolicyFile = "config/policy.production.example.toml",
    [string] $BackendHost = "127.0.0.1",
    [int] $BackendPort = 8000,
    [int] $FrontendPort = 3000,
    [switch] $WithHooks,
    [string] $ExportReviewToken = "dev-review-token-$(Get-Date -Format 'yyyyMMddHHmmss')",
    [string] $ApiKey = "dev-api-key-$(Get-Date -Format 'yyyyMMddHHmmss')"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvScripts = Join-Path $root ".venv\Scripts"
$backendExe = Join-Path $venvScripts "praboth-backend.exe"
$hookExe = Join-Path $venvScripts "cle-os-hooks.exe"
$frontendDir = Join-Path $root "frontend"
$aiServiceDir = Join-Path $root "ai-service"

if (-not (Test-Path $backendExe)) {
    Write-Error "Backend executable not found at $backendExe. Run 'python -m pip install -e .' in the root directory first."
}

if ($WithHooks -and -not (Test-Path $hookExe)) {
    Write-Error "OS hook executable not found at $hookExe. Run 'python -m pip install -e .[hooks]' in the root directory first."
}

if (-not (Test-Path $frontendDir)) {
    Write-Error "Frontend directory not found at $frontendDir."
}

if (-not (Test-Path $aiServiceDir)) {
    Write-Error "AI Service directory not found at $aiServiceDir."
}

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Output "Installing frontend dependencies..."
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

Write-Output "Building frontend production assets..."
Push-Location $frontendDir
npm run build
Pop-Location

if (-not (Test-Path (Join-Path $aiServiceDir "lib"))) {
    Write-Output "Building AI Service..."
    Push-Location $aiServiceDir
    npm run build
    Pop-Location
}

# Set environment variables for backend
$env:EXPORT_REVIEW_TOKEN = $ExportReviewToken
$env:API_KEY = $ApiKey

# 1. Backend Service (Production Mode)
Write-Host "Starting backend (production mode) on port $BackendPort..." -ForegroundColor Cyan
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-NoProfile", "-Command", "cd '$root'; `$env:EXPORT_REVIEW_TOKEN='$ExportReviewToken'; `$env:API_KEY='$ApiKey'; & '$backendExe' --config $PolicyFile --host $BackendHost --port $BackendPort" `
    -WindowStyle Normal

# 2. Frontend (Production Mode)
Write-Host "Starting frontend (production mode) on port $FrontendPort..." -ForegroundColor Cyan
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-NoProfile", "-Command", "cd '$frontendDir'; `$env:PORT='$FrontendPort'; npm run start" `
    -WindowStyle Normal

# 3. AI Service (Production Mode)
Write-Host "Starting AI Service (production mode) on port 3400..." -ForegroundColor Cyan
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-NoProfile", "-Command", "cd '$aiServiceDir'; npm run start" `
    -WindowStyle Normal

# 4. Ollama LLM
Write-Host "Starting Ollama LLM (llama3.2:3b)..." -ForegroundColor Cyan
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-NoProfile", "-Command", "ollama run llama3.2:3b" `
    -WindowStyle Normal

# 5. FocusReminder logs (tail file in its own terminal)
Write-Host "Tailing FocusReminder logs..." -ForegroundColor Cyan
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-NoProfile", "-Command", "cd '$root'; if (-not (Test-Path 'data')) { New-Item -ItemType Directory -Path 'data' | Out-Null }; if (-not (Test-Path 'data/focus_reminder.log')) { New-Item -ItemType File -Path 'data/focus_reminder.log' | Out-Null }; Get-Content -Path 'data/focus_reminder.log' -Wait -Tail 200" `
    -WindowStyle Normal

if ($WithHooks) {
    Write-Host "Starting OS Hook Service..." -ForegroundColor Cyan
    Start-Process -FilePath "powershell.exe" `
        -ArgumentList "-NoExit", "-NoProfile", "-Command", "`$env:API_KEY='$ApiKey'; cd '$root'; & '$hookExe' --endpoint http://127.0.0.1:$BackendPort/events --api-key '$ApiKey'" `
        -WindowStyle Normal
}

Write-Output ""
Write-Output "========================================" -ForegroundColor Green
Write-Output "Production services launched!" -ForegroundColor Green
Write-Output "========================================" -ForegroundColor Green
Write-Output ""
Write-Output "Services:" -ForegroundColor Yellow
Write-Output "  Backend API:  http://$BackendHost`:$BackendPort" -ForegroundColor Cyan
Write-Output "  Frontend:     http://127.0.0.1:$FrontendPort" -ForegroundColor Cyan
Write-Output "  AI Service:   http://localhost:3400" -ForegroundColor Cyan
if ($WithHooks) {
    Write-Output "  OS Hooks:     Running (keyboard/mouse tracking enabled)" -ForegroundColor Cyan
}
Write-Output ""
Write-Output "Policy:        $PolicyFile" -ForegroundColor Yellow
Write-Output "API Key:       $(if ($ApiKey -like 'dev-*') { 'Auto-generated (development)' } else { 'Custom' })" -ForegroundColor Yellow
Write-Output "Export Token:  $(if ($ExportReviewToken -like 'dev-*') { 'Auto-generated (development)' } else { 'Custom' })" -ForegroundColor Yellow
Write-Output ""
Write-Output "To stop services, close the respective terminal windows." -ForegroundColor Yellow
Write-Output "To include OS hooks, run: powershell -ExecutionPolicy Bypass -File start_prod.ps1 -WithHooks"
Write-Output "To use custom credentials, run: powershell -ExecutionPolicy Bypass -File start_prod.ps1 -ApiKey 'your-api-key' -ExportReviewToken 'your-token'"
