# Runs INSIDE Windows Sandbox (LogonCommand). Installs toolchain and project deps under the mapped folder.
# File must use ASCII straight quotes only (curly quotes break parsing).
# Windows Sandbox often has no winget on PATH; we fall back to python.org + nodejs.org installers.
# Progress is appended to Sandbox-Setup-steps.log (same folder, visible on host via mapped drive).
$ErrorActionPreference = "Continue"
$root = "C:\Work\Completed integration"
if (-not (Test-Path $root)) {
    Write-Host "ERROR: Expected mapped folder $root - check Open-IntentLockSandbox.ps1 mapping." -ForegroundColor Red
    pause
    exit 1
}

function Write-StepLog([string]$Message) {
    $log = Join-Path $PSScriptRoot "Sandbox-Setup-steps.log"
    $line = (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + " " + $Message
    try {
        $line | Add-Content -LiteralPath $log -Encoding utf8
    } catch { }
    Write-Host $Message
}

function Refresh-EnvPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::Machine)
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
    $env:Path = $machinePath + ";" + $userPath
    $extras = @(
        "$env:LOCALAPPDATA\Programs\Python\Python312"
        "$env:LOCALAPPDATA\Programs\Python\Python312\Scripts"
        "$env:LOCALAPPDATA\Programs\Python\Python313"
        "$env:LOCALAPPDATA\Programs\Python\Python313\Scripts"
        "$env:ProgramFiles\nodejs"
        "$env:ProgramFiles (x86)\nodejs"
    )
    foreach ($e in $extras) {
        if (Test-Path $e) { $env:Path = $e + ";" + $env:Path }
    }
}

function Discover-PythonOnDisk {
    $base = "$env:LOCALAPPDATA\Programs\Python"
    if (-not (Test-Path $base)) { return }
    $py = Get-ChildItem -Path $base -Recurse -Filter "python.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($py) {
        $dir = $py.DirectoryName
        $env:Path = $dir + ";" + (Join-Path $dir "Scripts") + ";" + $env:Path
        Write-StepLog "Prepended discovered Python to PATH: $dir"
    }
}

function Discover-NodeOnDisk {
    $nodejs = "$env:ProgramFiles\nodejs"
    if (Test-Path (Join-Path $nodejs "node.exe")) {
        $env:Path = $nodejs + ";" + $env:Path
        Write-StepLog "Prepended ProgramFiles nodejs to PATH: $nodejs"
    }
}

function Test-Cmd($Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-WingetExe {
    if (Test-Cmd "winget") {
        $src = (Get-Command winget -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
        if ($src) { return $src }
        return "winget"
    }
    $winApps = "$env:LOCALAPPDATA\Microsoft\WindowsApps\winget.exe"
    if (Test-Path $winApps) { return $winApps }
    try {
        $hit = Get-ChildItem -Path "$env:ProgramFiles\WindowsApps" -Filter "winget.exe" -Recurse -ErrorAction SilentlyContinue |
            Select-Object -First 1 -ExpandProperty FullName
        if ($hit) { return $hit }
    } catch { }
    return $null
}

function Remove-FileWithRetry([string]$LiteralPath, [int]$Attempts = 10) {
    if (-not $LiteralPath -or -not (Test-Path -LiteralPath $LiteralPath)) { return }
    for ($i = 0; $i -lt $Attempts; $i++) {
        try {
            Remove-Item -LiteralPath $LiteralPath -Force -ErrorAction Stop
            return
        } catch {
            Start-Sleep -Seconds 2
        }
    }
}

function Save-UrlToFile([string]$Uri, [string]$OutPath) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
        Invoke-WebRequest -Uri $Uri -OutFile $OutPath -UseBasicParsing -TimeoutSec 900
    } catch {
        Write-StepLog "Invoke-WebRequest failed, trying WebClient: $($_.Exception.Message)"
        $wc = New-Object System.Net.WebClient
        $wc.DownloadFile($Uri, $OutPath)
    }
    Start-Sleep -Seconds 2
}

# msiexec 1618 = ERROR_INSTALL_ALREADY_RUNNING (e.g. Sandbox first boot, pending Python MSI chain, Windows Update).
function Invoke-MsiexecInstall {
    param(
        [string[]]$ArgumentList,
        [int]$MaxAttempts = 10,
        [int]$WaitOn1618Seconds = 45
    )
    $last = $null
    for ($a = 1; $a -le $MaxAttempts; $a++) {
        $last = Start-Process -FilePath "msiexec.exe" -ArgumentList $ArgumentList -PassThru -Wait
        Write-StepLog "msiexec exit code: $($last.ExitCode) (attempt $a/$MaxAttempts)"
        if ($last.ExitCode -eq 0 -or $last.ExitCode -eq 3010) { break }
        if ($last.ExitCode -eq 1618) {
            Write-StepLog "Another Windows Installer operation is running (1618); waiting ${WaitOn1618Seconds}s..."
            Start-Sleep -Seconds $WaitOn1618Seconds
            continue
        }
        break
    }
    return $last
}

function Install-PythonIfMissing {
    Refresh-EnvPath
    if (Test-Cmd "python") { Write-StepLog "python already on PATH"; return }

    $wg = Get-WingetExe
    if ($wg) {
        Write-StepLog "Trying winget for Python: $wg"
        & $wg install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements --silent 2>$null
        Refresh-EnvPath
        Discover-PythonOnDisk
    }
    if (Test-Cmd "python") { Write-StepLog "python available after winget"; return }

    Write-StepLog "winget unavailable or failed; downloading Python from python.org (can take several minutes)..."
    # Unique name avoids "file in use" from a previous run / Defender / installer still closing the old fixed path.
    $installer = Join-Path $env:TEMP ("py-install-" + [Guid]::NewGuid().ToString("n") + ".exe")
    Get-ChildItem -Path $env:TEMP -Filter "python-3.12.8-amd64.exe" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $env:TEMP -Filter "py-install-*.exe" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-2) } | Remove-Item -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    try {
        Save-UrlToFile -Uri "https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe" -OutPath $installer
        if (Test-Path $installer) {
            $sz = (Get-Item $installer).Length
            Write-StepLog "Python installer downloaded ($sz bytes), running silent install..."
        }
        $proc = Start-Process -FilePath $installer -ArgumentList @("/quiet", "InstallAllUsers=0", "PrependPath=1", "Include_test=0") -PassThru -Wait
        Write-StepLog "Python installer process exit code: $($proc.ExitCode)"
        Start-Sleep -Seconds 12
    } catch {
        Write-StepLog "Python download/install failed: $($_.Exception.Message)"
        Write-Host "Python download/install failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    Remove-FileWithRetry -LiteralPath $installer
    Refresh-EnvPath
    Discover-PythonOnDisk
}

function Install-NodeIfMissing {
    Refresh-EnvPath
    if (Test-Cmd "node") { Write-StepLog "node already on PATH"; return }

    $wg = Get-WingetExe
    if ($wg) {
        Write-StepLog "Trying winget for Node: $wg"
        & $wg install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent 2>$null
        Refresh-EnvPath
        Discover-NodeOnDisk
    }
    if (Test-Cmd "node") { Write-StepLog "node available after winget"; return }

    Write-StepLog "Downloading Node MSI from nodejs.org (can take a few minutes)..."
    $msi = Join-Path $env:TEMP ("node-install-" + [Guid]::NewGuid().ToString("n") + ".msi")
    Get-ChildItem -Path $env:TEMP -Filter "node-lts-x64.msi" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    try {
        Save-UrlToFile -Uri "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi" -OutPath $msi
        if (Test-Path $msi) {
            $sz = (Get-Item $msi).Length
            Write-StepLog "Node MSI downloaded ($sz bytes), running msiexec..."
        }
        $p = Invoke-MsiexecInstall -ArgumentList @("/i", $msi, "/qn", "/norestart")
        Start-Sleep -Seconds 10
    } catch {
        Write-StepLog "Node download/install failed: $($_.Exception.Message)"
        Write-Host "Node download/install failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    Remove-FileWithRetry -LiteralPath $msi
    Refresh-EnvPath
    Discover-NodeOnDisk
}

function Install-PythonProjectVenv {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectPath,
        [string]$RequirementsFile = "requirements.txt"
    )
    $req = Join-Path $ProjectPath $RequirementsFile
    if (-not (Test-Path $req)) {
        Write-StepLog "Skipping venv (missing ${RequirementsFile}): $ProjectPath"
        return
    }
    $venvPy = Join-Path $ProjectPath ".venv\Scripts\python.exe"
    if (-not (Test-Path $venvPy)) {
        Write-StepLog "Creating .venv in $ProjectPath"
        Write-Host "`n--- python -m venv (.venv) -> $ProjectPath ---" -ForegroundColor Cyan
        Push-Location $ProjectPath
        python -m venv .venv
        $v = $LASTEXITCODE
        Pop-Location
        if ($v -ne 0) {
            Write-StepLog "venv create failed exit $v : $ProjectPath"
            Write-Host "venv create failed: $ProjectPath" -ForegroundColor Red
            pause
            exit $v
        }
    }
    $pipExe = Join-Path $ProjectPath ".venv\Scripts\pip.exe"
    Write-StepLog "pip install -r $RequirementsFile in $ProjectPath"
    Write-Host "`n--- pip install -r $RequirementsFile -> $ProjectPath ---" -ForegroundColor Cyan
    Push-Location $ProjectPath
    & $pipExe install -r $RequirementsFile
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -ne 0) {
        Write-StepLog "pip install failed exit $code : $ProjectPath"
        Write-Host "pip install failed: $ProjectPath" -ForegroundColor Red
        pause
        exit $code
    }
}

Write-StepLog "=== IntentLock Sandbox setup started ==="
Write-Host "`n=== IntentLock Sandbox setup ===" -ForegroundColor Cyan
Write-Host "Root: $root" -ForegroundColor Cyan
Write-Host "(Live steps also in sandbox\Sandbox-Setup-steps.log on the host.)`n" -ForegroundColor DarkGray

Install-PythonIfMissing
if (-not (Test-Cmd "python")) {
    Write-StepLog "ERROR: python still not on PATH after all attempts."
    Write-Host "python still not on PATH after install attempts." -ForegroundColor Yellow
    Write-Host "Open Microsoft Store in the Sandbox once, or install Python manually, then re-run this script." -ForegroundColor Gray
    pause
    exit 1
}

Install-NodeIfMissing
if (-not (Test-Cmd "node")) {
    Write-StepLog "ERROR: node still not on PATH after all attempts."
    Write-Host "node still not on PATH after install attempts." -ForegroundColor Yellow
    Write-Host "Install Node.js LTS manually in the Sandbox, then re-run this script." -ForegroundColor Gray
    pause
    exit 1
}

Write-StepLog "Running setup_cle.py..."
Set-Location (Join-Path $root "launcher")
Write-Host "`n--- setup_cle.py ---" -ForegroundColor Cyan
python .\setup_cle.py
if ($LASTEXITCODE -ne 0) {
    Write-StepLog "setup_cle.py failed exit $LASTEXITCODE"
    Write-Host "setup_cle.py failed (exit $LASTEXITCODE)" -ForegroundColor Red
    pause
    exit $LASTEXITCODE
}

$ilb = Join-Path $root "intent-lock-backend"
$plb = Join-Path $root "planner-backend"
$asched = Join-Path $root "adaptive-scheduler"

Write-StepLog "Python venv: intent-lock-backend (uvicorn, FastAPI, ...)"
Install-PythonProjectVenv -ProjectPath $ilb

Write-StepLog "Python venv: planner-backend"
Install-PythonProjectVenv -ProjectPath $plb

Write-StepLog "Python venv: adaptive-scheduler (includes torch; first run can take a long time)"
Install-PythonProjectVenv -ProjectPath $asched

$ilf = Join-Path $root "intent-lock-frontend"
$plf = Join-Path $root "planner-frontend"
$desk = Join-Path $root "desktop-app"

Write-StepLog "npm ci intent-lock-frontend"
Write-Host "`n--- npm ci intent-lock-frontend ---" -ForegroundColor Cyan
Set-Location $ilf
npm ci
if ($LASTEXITCODE -ne 0) { Write-StepLog "npm ci failed intent-lock-frontend"; Write-Host "npm ci failed in intent-lock-frontend" -ForegroundColor Red; pause; exit $LASTEXITCODE }

Write-StepLog "npm ci planner-frontend"
Write-Host "`n--- npm ci planner-frontend ---" -ForegroundColor Cyan
Set-Location $plf
npm ci
if ($LASTEXITCODE -ne 0) { Write-StepLog "npm ci failed planner-frontend"; Write-Host "npm ci failed in planner-frontend" -ForegroundColor Red; pause; exit $LASTEXITCODE }

Write-StepLog "desktop-app npm install + build"
Write-Host "`n--- desktop-app npm install + build ---" -ForegroundColor Cyan
Set-Location $desk
npm install
if ($LASTEXITCODE -ne 0) { Write-StepLog "npm install failed desktop-app"; Write-Host "npm install failed in desktop-app" -ForegroundColor Red; pause; exit $LASTEXITCODE }
npm run build
if ($LASTEXITCODE -ne 0) { Write-StepLog "npm run build failed desktop-app"; Write-Host "npm run build failed in desktop-app" -ForegroundColor Red; pause; exit $LASTEXITCODE }

Write-StepLog "=== Setup finished successfully ==="
Write-Host "`n=== Setup finished ===" -ForegroundColor Green
Write-Host "To start the desktop stack, run:" -ForegroundColor White
$launcherHint = "  cd " + (Join-Path $root "launcher")
Write-Host $launcherHint -ForegroundColor Gray
Write-Host '  powershell -ExecutionPolicy Bypass -File .\start-all.ps1 -Desktop' -ForegroundColor Gray
Write-Host ""
pause
