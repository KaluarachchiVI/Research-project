Param(
    [switch]$WithServer,  # include adaptive scheduler + planner (Yuvidu stack)
    [switch]$WithHooks,   # start CLE OS hooks for real keyboard + pointer input
    [switch]$Desktop,     # start Electron desktop app (it manages all services internally)
    [switch]$UsePrabothCle # use repo-root praboth/ as the CLE backend instead of cognitive-load-estimator/
)

$ErrorActionPreference = "Stop"

function Ensure-PythonVenv {
    param(
        [Parameter(Mandatory = $true)][string]$ServiceDir,
        [Parameter(Mandatory = $true)][string]$RequirementsFile
    )

    $venvDir = Join-Path $ServiceDir ".venv"
    $venvPython = Join-Path $venvDir "Scripts\python.exe"

    if (-not (Test-Path $venvPython)) {
        Write-Host "Creating venv: $venvDir" -ForegroundColor Yellow
        Push-Location $ServiceDir
        if (Get-Command py -ErrorAction SilentlyContinue) {
            py -3.10 -m venv .venv
        } else {
            python -m venv .venv
        }
        Pop-Location
    }

    # IMPORTANT: do not let external command stdout become this function's output,
    # otherwise callers that do `$py = Ensure-PythonVenv ...` will capture pip logs
    # instead of the interpreter path.

    $reqHashFile = Join-Path $venvDir ".requirements.sha256"
    $currentHash = (Get-FileHash -Algorithm SHA256 -Path $RequirementsFile).Hash
    $previousHash = $null
    if (Test-Path $reqHashFile) {
        try { $previousHash = (Get-Content $reqHashFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim() } catch { $previousHash = $null }
    }

    if ($previousHash -ne $currentHash) {
        Write-Host "Installing Python deps from: $RequirementsFile" -ForegroundColor Yellow
        (& $venvPython -m pip install -U pip) 2>&1 | Out-Host
        (& $venvPython -m pip install -r $RequirementsFile) 2>&1 | Out-Host
        try { Set-Content -Path $reqHashFile -Value $currentHash -Encoding ASCII } catch {}
    } else {
        Write-Host "Python deps already installed (requirements unchanged)." -ForegroundColor DarkGray
    }

    return $venvPython
}

function Ensure-NodeModules {
    param(
        [Parameter(Mandatory = $true)][string]$ServiceDir
    )

    $nodeModules = Join-Path $ServiceDir "node_modules"
    if (-not (Test-Path $nodeModules)) {
        Write-Host "Running npm install in: $ServiceDir" -ForegroundColor Yellow
        Push-Location $ServiceDir
        npm install
        Pop-Location
    }
}

# This script lives in .../Completed integration/launcher/
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$integrationRoot = Join-Path $root ".." | Resolve-Path

if ($Desktop) {
    $desktopScript = Join-Path $integrationRoot "desktop-app\start-desktop.ps1" | Resolve-Path
    Write-Host "Starting IntentLock Desktop (Electron)..." -ForegroundColor Cyan
    Write-Host "Script: $desktopScript"
    Start-Process powershell -WorkingDirectory (Split-Path $desktopScript) -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-File",
        $desktopScript.Path
    ) | Out-Null
    return
}

$cleDir = Join-Path $integrationRoot "cognitive-load-estimator" | Resolve-Path
$schedulerDir = Join-Path $integrationRoot "adaptive-scheduler" | Resolve-Path
$intentLockBackendDir = Join-Path $integrationRoot "intent-lock-backend" | Resolve-Path
$intentLockFrontendDir = Join-Path $integrationRoot "intent-lock-frontend" | Resolve-Path
$plannerBackendDir = Join-Path $integrationRoot "planner-backend" | Resolve-Path
$plannerFrontendDir = Join-Path $integrationRoot "planner-frontend" | Resolve-Path
$setupScript = Join-Path $root "setup_cle.py"
$repoRoot = Join-Path $integrationRoot ".." | Resolve-Path
$prabothRoot = Join-Path $repoRoot "praboth"
$prabothSetupScript = Join-Path $root "setup_praboth_cle.py"

Write-Host "=== Completed integration: Adaptive Scheduler stack ===" -ForegroundColor Cyan
Write-Host "Launcher: $root"
Write-Host "Integration root: $integrationRoot"
if ($UsePrabothCle) {
    Write-Host "CLE implementation: repo-root praboth\\ (praboth-backend)" -ForegroundColor Yellow
} else {
    Write-Host "CLE implementation: cognitive-load-estimator\\ (cog-py-est)" -ForegroundColor Yellow
}
Write-Host ""

#
# 1) Client-side: CLE + Intent-Lock
#

if ($UsePrabothCle) {
    if (-not (Test-Path $prabothRoot)) {
        throw "UsePrabothCle was set, but repo-root praboth/ was not found at: $prabothRoot"
    }

    Write-Host "1) Ensuring CLE (repo-root praboth) environment is set up..." -ForegroundColor Yellow
    Push-Location $root
    python $prabothSetupScript
    Pop-Location

    $prabothPython = Join-Path $prabothRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path $prabothPython)) {
        throw "Praboth venv python not found at $prabothPython (setup_praboth_cle.py should have created it)"
    }
} else {
    Write-Host "1) Ensuring CLE (cognitive-load-estimator) environment is set up..." -ForegroundColor Yellow
    Push-Location $root
    python $setupScript
    Pop-Location
}

Write-Host "2) Starting CLE service (port 8000)..." -ForegroundColor Green
if ($UsePrabothCle) {
    Start-Process powershell -WorkingDirectory $prabothRoot -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host 'Praboth CLE backend at http://127.0.0.1:8000'; & '.\\.venv\\Scripts\\python.exe' -m uvicorn backend.src.api.app:app --host 127.0.0.1 --port 8000 --reload"
    ) | Out-Null
} else {
    Start-Process powershell -WorkingDirectory $cleDir -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host 'CLE running at http://127.0.0.1:8000'; .\\.venv\\Scripts\\cog-py-est.exe --config policy_1.toml"
    ) | Out-Null
}

if ($WithHooks) {
    if ($UsePrabothCle) {
        $hookExe = Join-Path $prabothRoot ".venv\Scripts\cle-os-hooks.exe"
        if (Test-Path $hookExe) {
            Write-Host "2b) Starting Praboth CLE OS hooks (keyboard + pointer -> CLE)..." -ForegroundColor Green
            Start-Process powershell -WorkingDirectory $prabothRoot -ArgumentList @(
                "-NoExit",
                "-Command",
                "Write-Host 'CLE OS hooks streaming to http://127.0.0.1:8000/events'; .\\.venv\\Scripts\\cle-os-hooks.exe --endpoint http://127.0.0.1:8000/events"
            ) | Out-Null
        } else {
            Write-Host "2b) Praboth hooks skipped: cle-os-hooks.exe not found. Run: cd praboth; .\\.venv\\Scripts\\pip.exe install -e '.[hooks]'" -ForegroundColor Yellow
        }
    } else {
        $hookExe = Join-Path $cleDir ".venv\Scripts\cle-os-hooks.exe"
        if (Test-Path $hookExe) {
            Write-Host "2b) Starting CLE OS hooks (keyboard + pointer -> CLE)..." -ForegroundColor Green
            Start-Process powershell -WorkingDirectory $cleDir -ArgumentList @(
                "-NoExit",
                "-Command",
                "Write-Host 'CLE OS hooks streaming to http://127.0.0.1:8000/events'; .\\.venv\\Scripts\\cle-os-hooks.exe --endpoint http://127.0.0.1:8000/events"
            ) | Out-Null
        } else {
            Write-Host "2b) CLE hooks skipped: cle-os-hooks.exe not found. Run: cd cognitive-load-estimator; .\\.venv\\Scripts\\pip.exe install '.[hooks]'" -ForegroundColor Yellow
        }
    }
}

Write-Host "3) Starting Intent-Lock backend (port 8001)..." -ForegroundColor Green
$intentLockReq = Join-Path $intentLockBackendDir "requirements.txt"
$intentLockPython = Ensure-PythonVenv -ServiceDir $intentLockBackendDir -RequirementsFile $intentLockReq
Start-Process powershell -WorkingDirectory $intentLockBackendDir -ArgumentList @(
    "-NoExit",
    "-Command",
    "Write-Host 'Intent-Lock backend at http://127.0.0.1:8001'; & '$intentLockPython' -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload"
) | Out-Null

Write-Host "4) Starting Intent-Lock frontend (port 3000)..." -ForegroundColor Green
Ensure-NodeModules -ServiceDir $intentLockFrontendDir
Start-Process powershell -WorkingDirectory $intentLockFrontendDir -ArgumentList @(
    "-NoExit",
    "-Command",
    "`$env:NEXT_PUBLIC_INTENTLOCK_API_BASE='http://127.0.0.1:8001'; `$env:NEXT_PUBLIC_CLE_API_BASE='http://127.0.0.1:8000'; `$env:NEXT_PUBLIC_SCHEDULER_API_BASE='http://127.0.0.1:5000'; `$env:NEXT_PUBLIC_YUVIDU_API_BASE='http://127.0.0.1:5001'; `$env:NEXT_PUBLIC_YUVIDU_PLANNER_URL='http://localhost:5123'; Write-Host 'Intent-Lock UI at http://localhost:3000'; npm run dev"
) | Out-Null

#
# 2) Optional: Adaptive scheduler + planner (heatmap / bandit API)
#

if ($WithServer) {
    Write-Host ""
    Write-Host "5) Starting Adaptive Scheduler API (port 5000)..." -ForegroundColor Green
$schedulerReq = Join-Path $schedulerDir "requirements.txt"
$schedulerPython = Ensure-PythonVenv -ServiceDir $schedulerDir -RequirementsFile $schedulerReq
    Start-Process powershell -WorkingDirectory $schedulerDir -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host 'Adaptive Scheduler API at http://127.0.0.1:5000'; & '$schedulerPython' -m src.api.app"
    ) | Out-Null

    Write-Host "   Waiting 3s for scheduler to bind..." -ForegroundColor Gray
    Start-Sleep -Seconds 3

    Write-Host "6) Starting planner backend (port 5001)..." -ForegroundColor Green
$plannerBackendReq = Join-Path $plannerBackendDir "requirements.txt"
$plannerBackendPython = Ensure-PythonVenv -ServiceDir $plannerBackendDir -RequirementsFile $plannerBackendReq
    Start-Process powershell -WorkingDirectory $plannerBackendDir -ArgumentList @(
        "-NoExit",
        "-Command",
        "`$env:SCHEDULER_API_BASE='http://127.0.0.1:5000'; Write-Host 'Planner backend at http://127.0.0.1:5001 (bandit data from scheduler when available)'; & '$plannerBackendPython' -m uvicorn server:app --host 127.0.0.1 --port 5001 --reload"
    ) | Out-Null

    Write-Host "7) Starting planner frontend (port 5123)..." -ForegroundColor Green
    Ensure-NodeModules -ServiceDir $plannerFrontendDir
    Start-Process powershell -WorkingDirectory $plannerFrontendDir -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host 'Planner UI at http://localhost:5123 (embedded from Intent-Lock Planning tab)'; npm run dev:react"
    ) | Out-Null
}

Write-Host ""
Write-Host "Launch complete." -ForegroundColor Cyan
Write-Host "Open http://localhost:3000 for the Intent-Lock UI." -ForegroundColor Cyan
if ($WithServer) {
    Write-Host "With -WithServer: planner bandit prefers scheduler training data; heatmap can be user-scoped." -ForegroundColor Gray
}
if (-not $WithHooks) {
    Write-Host "Tip: For real keyboard + pointer to CLE, add: -WithHooks" -ForegroundColor Gray
}
if (-not $WithServer) {
    Write-Host "Tip: For scheduler (5000) + planner (5001, 5123), add: -WithServer" -ForegroundColor Gray
}
