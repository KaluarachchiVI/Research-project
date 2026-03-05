# How to Start All Services - Step by Step Guide

This guide shows you exactly how to start all the services for the Adaptive Scheduler with Praboth integration.

---

## Prerequisites

1. **Python 3.8+** installed
2. **Node.js** installed (for the web UI)
3. All dependencies installed (see setup steps below)

---

## Step 1: Setup (One-time, if not done already)

### 1.1 Setup Praboth
```powershell
cd "C:\Users\ASUS TUF\Desktop\Research project"
python setup_praboth.py
```

This will:
- Create virtual environment in `praboth/.venv`
- Install all praboth dependencies
- Install OS hooks for keystroke capture

### 1.2 Initialize Database
```powershell
python init_database.py
```

### 1.3 Install Web UI Dependencies
```powershell
cd praboth\web-ui
npm install
cd ..\..
```

---

## Step 2: Starting All Services

You need to start **4 services** in separate terminal windows. Here's how:

### Service 1: Praboth Backend (Port 8000)

**Option A: Using Python script**
```powershell
cd "C:\Users\ASUS TUF\Desktop\Research project"
python run_praboth.py
```

**Option B: Using PowerShell script**
```powershell
cd "C:\Users\ASUS TUF\Desktop\Research project"
powershell -ExecutionPolicy Bypass -File start_praboth.ps1
```

**Option C: Manual**
```powershell
cd "C:\Users\ASUS TUF\Desktop\Research project\praboth"
.\.venv\Scripts\cog-py-est.exe --config policy_1.toml
```

**What to look for:**
- Should see "Starting Praboth Service"
- API will be at: http://127.0.0.1:8000
- Keep this window open

---

### Service 2: Adaptive Scheduler API (Port 5000)

Open a **NEW** PowerShell window:

```powershell
cd "C:\Users\ASUS TUF\Desktop\Research project"
python run_server.py
```

**What to look for:**
- Should see "Initializing database..."
- Then "Starting API server on 127.0.0.1:5000..."
- API will be at: http://127.0.0.1:5000
- Keep this window open

---

### Service 3: Praboth Web UI (Port 3000)

Open a **NEW** PowerShell window:

```powershell
cd "C:\Users\ASUS TUF\Desktop\Research project\praboth\web-ui"
npx next dev
```

**What to look for:**
- Will take 15-30 seconds to compile on first start
- Look for: "Ready" and "Local: http://localhost:3000"
- Once ready, open http://localhost:3000 in your browser
- Keep this window open

**Note:** If `npx` doesn't work, try:
```powershell
.\node_modules\.bin\next.cmd dev
```

---

### Service 4: OS Hooks (Keystroke Capture)

Open a **NEW** PowerShell window:

```powershell
cd "C:\Users\ASUS TUF\Desktop\Research project\praboth"
.\.venv\Scripts\cle-os-hooks.exe --endpoint http://127.0.0.1:8000/events
```

**What to look for:**
- Should start capturing keystrokes immediately
- No output is normal - it's working silently
- Keep this window open (minimize if you want)

---

## Quick Start Script (All-in-One)

If you want to start everything at once, create this PowerShell script:

**File: `start_all_services.ps1`**

```powershell
# Start All Services for Adaptive Scheduler + Praboth

$projectRoot = "C:\Users\ASUS TUF\Desktop\Research project"
$prabothDir = Join-Path $projectRoot "praboth"
$webUIDir = Join-Path $prabothDir "web-ui"

Write-Host "========================================"
Write-Host "Starting All Services"
Write-Host "========================================"
Write-Host ""

# 1. Start Praboth Backend
Write-Host "1. Starting Praboth Backend (Port 8000)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; python run_praboth.py"

Start-Sleep -Seconds 2

# 2. Start Adaptive Scheduler API
Write-Host "2. Starting Adaptive Scheduler API (Port 5000)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; python run_server.py"

Start-Sleep -Seconds 2

# 3. Start Web UI
Write-Host "3. Starting Web UI (Port 3000)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$webUIDir'; npx next dev"

Start-Sleep -Seconds 2

# 4. Start OS Hooks
Write-Host "4. Starting OS Hooks (Keystroke Capture)..."
$hookExe = Join-Path $prabothDir ".venv\Scripts\cle-os-hooks.exe"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$prabothDir'; & '$hookExe' --endpoint http://127.0.0.1:8000/events"

Write-Host ""
Write-Host "========================================"
Write-Host "All services started!"
Write-Host "========================================"
Write-Host ""
Write-Host "Services:"
Write-Host "  - Praboth Backend: http://127.0.0.1:8000"
Write-Host "  - Adaptive Scheduler API: http://127.0.0.1:5000"
Write-Host "  - Web UI: http://localhost:3000 (wait 15-30 sec)"
Write-Host "  - OS Hooks: Running (capturing keystrokes)"
Write-Host ""
Write-Host "Open http://localhost:3000 in your browser once the UI is ready!"
```

**To use it:**
```powershell
cd "C:\Users\ASUS TUF\Desktop\Research project"
powershell -ExecutionPolicy Bypass -File start_all_services.ps1
```

---

## Verifying Services Are Running

### Check Ports
```powershell
netstat -ano | findstr ":3000 :8000 :5000" | findstr "LISTENING"
```

You should see all three ports listening.

### Check Processes
```powershell
Get-Process | Where-Object { $_.ProcessName -like "*python*" -or $_.ProcessName -like "*node*" }
```

### Test Services
```powershell
# Test Praboth
Invoke-WebRequest -Uri "http://127.0.0.1:8000/docs"

# Test API
Invoke-WebRequest -Uri "http://127.0.0.1:5000/api/health"

# Test Web UI (after it's ready)
Invoke-WebRequest -Uri "http://localhost:3000"
```

---

## Stopping Services

To stop all services:
1. Go to each PowerShell window
2. Press `Ctrl+C` to stop each service
3. Or close the PowerShell windows

---

## Troubleshooting

### Port Already in Use
If you get "port already in use" error:
```powershell
# Find what's using the port
netstat -ano | findstr ":8000"  # or :5000, :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Installation Error: File in Use (cle-os-hooks.exe)
If you get an error like:
```
ERROR: Could not install packages due to an OSError: [WinError 32] 
The process cannot access the file because it is being used by another process: 
'cle-os-hooks.exe'
```

**Solution:** Stop all running services first, then reinstall:
```powershell
# Stop all Python processes (this will stop praboth, API, and hooks)
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force

# Or stop specific processes
Get-Process | Where-Object { 
    (Get-WmiObject Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like "*cle-os-hooks*" 
} | Stop-Process -Force

# Then reinstall
cd "C:\Users\ASUS TUF\Desktop\Research project"
python setup_praboth.py
```

### Next.js Not Starting
```powershell
cd praboth\web-ui
# Try with npx
npx next dev

# Or use full path
.\node_modules\.bin\next.cmd dev
```

### OS Hooks Not Working
Make sure praboth backend is running first, then start hooks:
```powershell
cd praboth
.\.venv\Scripts\cle-os-hooks.exe --endpoint http://127.0.0.1:8000/events
```

### Can't Access Web UI
1. Wait 15-30 seconds for Next.js to compile
2. Check the PowerShell window for errors
3. Look for "Ready" message
4. Try http://127.0.0.1:3000 instead of localhost

---

## Summary: What Each Service Does

1. **Praboth Backend (Port 8000)**
   - Cognitive load estimation service
   - Receives keystroke events
   - Computes cognitive load estimates
   - API: http://127.0.0.1:8000

2. **Adaptive Scheduler API (Port 5000)**
   - Main API for the adaptive scheduler
   - Handles sessions, recommendations, metrics
   - API: http://127.0.0.1:5000

3. **Praboth Web UI (Port 3000)**
   - User interface for viewing cognitive load
   - Real-time visualization
   - Web: http://localhost:3000

4. **OS Hooks**
   - Captures keyboard/mouse events
   - Sends to praboth backend
   - No web interface (runs in background)

---

## Quick Reference Commands

```powershell
# Start Praboth
cd "C:\Users\ASUS TUF\Desktop\Research project"
python run_praboth.py

# Start API (new window)
cd "C:\Users\ASUS TUF\Desktop\Research project"
python run_server.py

# Start UI (new window)
cd "C:\Users\ASUS TUF\Desktop\Research project\praboth\web-ui"
npx next dev

# Start Hooks (new window)
cd "C:\Users\ASUS TUF\Desktop\Research project\praboth"
.\.venv\Scripts\cle-os-hooks.exe --endpoint http://127.0.0.1:8000/events
```

---

That's it! You now know how to start everything yourself. 🚀

