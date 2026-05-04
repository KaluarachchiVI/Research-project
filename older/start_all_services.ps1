# Start All Services for Adaptive Scheduler + Praboth
# This script starts all 4 services in separate windows

$projectRoot = "C:\Users\ASUS TUF\Desktop\Research project"
$prabothDir = Join-Path $projectRoot "praboth"
$webUIDir = Join-Path $prabothDir "web-ui"

Write-Host "========================================"
Write-Host "Starting All Services"
Write-Host "========================================"
Write-Host ""

# 1. Start Praboth Backend
Write-Host "1. Starting Praboth Backend (Port 8000)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host 'Praboth Backend - Port 8000'; python run_praboth.py"

Start-Sleep -Seconds 2

# 2. Start Adaptive Scheduler API
Write-Host "2. Starting Adaptive Scheduler API (Port 5000)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host 'Adaptive Scheduler API - Port 5000'; python run_server.py"

Start-Sleep -Seconds 2

# 3. Start Web UI
Write-Host "3. Starting Web UI (Port 3000)..."
Write-Host "   (This will take 15-30 seconds to compile)"
# Use local Next.js version to avoid version conflicts
$nextCmd = Join-Path $webUIDir "node_modules\.bin\next.cmd"
if (Test-Path $nextCmd) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$webUIDir'; Write-Host 'Praboth Web UI - Port 3000'; & '$nextCmd' dev"
} else {
    # Fallback to npx if local version not found
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$webUIDir'; Write-Host 'Praboth Web UI - Port 3000'; npx next dev"
}

Start-Sleep -Seconds 2

# 4. Start Yuvidu Backend (Study Predictions)
Write-Host "4. Starting Yuvidu Backend (Port 5001)..."
$yuviduBackendDir = Join-Path $projectRoot "yuvidu\backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$yuviduBackendDir'; Write-Host 'Yuvidu Backend - Port 5001'; python -m uvicorn server:app --reload --port 5001"

Start-Sleep -Seconds 2

# 5. Start OS Hooks
Write-Host "5. Starting OS Hooks (Keystroke Capture)..."
$hookExe = Join-Path $prabothDir ".venv\Scripts\cle-os-hooks.exe"
if (Test-Path $hookExe) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$prabothDir'; Write-Host 'OS Hooks - Capturing keystrokes'; & '$hookExe' --endpoint http://127.0.0.1:8000/events"
} else {
    Write-Host "   ⚠️  OS Hooks executable not found. Skipping..."
    Write-Host "   Run: cd praboth && .\.venv\Scripts\cle-os-hooks.exe --endpoint http://127.0.0.1:8000/events"
}

Write-Host ""
Write-Host "========================================"
Write-Host "All services started in separate windows!"
Write-Host "========================================"
Write-Host ""
Write-Host "Services:"
Write-Host "  ✅ Praboth Backend: http://127.0.0.1:8000"
Write-Host "  ✅ Adaptive Scheduler API: http://127.0.0.1:5000"
Write-Host "  ✅ Yuvidu Backend (Study Predictions): http://127.0.0.1:5001"
Write-Host "  ✅ Web UI: http://localhost:3000 (wait 15-30 sec for compilation)"
Write-Host "  ✅ OS Hooks: Running (capturing keystrokes)"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Wait for Web UI to show 'Ready' message"
Write-Host "  2. Open http://localhost:3000 in your browser"
Write-Host "  3. Start typing - keystrokes will be captured automatically"
Write-Host ""
Write-Host "To stop services: Press Ctrl+C in each window"
Write-Host ""


