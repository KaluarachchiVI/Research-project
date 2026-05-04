# Run on the HOST (your Windows Pro machine). Opens Windows Sandbox with this repo's "Completed integration" folder mounted.
# If this window closes too fast: right-click -> Edit, or run from an already-open PowerShell (see sandbox/README.md).
$ErrorActionPreference = "Stop"

function Wait-ForUser {
    Write-Host ""
    Write-Host "Press Enter to close this window..." -ForegroundColor Gray
    try {
        $null = Read-Host
    } catch {
        Start-Sleep -Seconds 30
    }
}

function Write-WsbNoBom([string]$Path, [string]$Content) {
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

try {
    # This script lives in ...\Completed integration\sandbox\
    $sandboxDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $integrationRoot = Split-Path -Parent $sandboxDir
    $integrationRoot = (Resolve-Path $integrationRoot).Path

    $feature = $null
    try {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName "Containers-DisposableClientVM" -ErrorAction Stop
    } catch {
        Write-Host ""
        Write-Host "Could not read Sandbox feature status (this often needs Administrator)." -ForegroundColor Yellow
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor DarkYellow
        Write-Host "If Sandbox is already enabled in Windows Features, we will still try to open it." -ForegroundColor Gray
        Write-Host ""
    }

    if ($feature -and $feature.State -ne "Enabled") {
        Write-Host "Windows Sandbox is not enabled yet." -ForegroundColor Yellow
        Write-Host "Open PowerShell as Administrator and run:" -ForegroundColor Cyan
        Write-Host '  Enable-WindowsOptionalFeature -Online -FeatureName "Containers-DisposableClientVM" -All -NoRestart' -ForegroundColor White
        Write-Host "Then reboot if prompted, enable Sandbox in Settings if needed, and run this script again." -ForegroundColor Gray
        Write-Host ""
        exit 1
    }

    $guestMount = "C:\Work\Completed integration"
    # LogonCommand: use cmd wrapper (delay + reliable quoting). PowerShell -File alone often fails (race, BOM on .wsb, escaping).
    $logonCmd = 'cmd.exe /c call "' + $guestMount + '\sandbox\Sandbox-Setup.cmd"'

    $wsbPath = Join-Path $env:TEMP "IntentLock-CompletedIntegration.wsb"
    $hostFolderEscaped = [System.Security.SecurityElement]::Escape($integrationRoot)

    $wsbContent = @"
<Configuration>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>$hostFolderEscaped</HostFolder>
      <SandboxFolder>$guestMount</SandboxFolder>
      <ReadOnly>false</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>$logonCmd</Command>
  </LogonCommand>
</Configuration>
"@

    Write-WsbNoBom -Path $wsbPath -Content $wsbContent
    Write-Host "Opening Windows Sandbox..." -ForegroundColor Green
    Write-Host "  Mapped: $integrationRoot  ->  $guestMount" -ForegroundColor Gray
    Write-Host "  WSB file: $wsbPath" -ForegroundColor Gray
    Write-Host "  Auto-setup: cmd -> Sandbox-Setup.cmd (25s delay) -> Sandbox-Setup.ps1" -ForegroundColor Gray
    Write-Host "  If nothing runs: in the guest open Explorer -> $guestMount\sandbox\ and double-click Sandbox-Setup.cmd" -ForegroundColor Cyan
    Write-Host "  Host-side log (after run): $integrationRoot\sandbox\Sandbox-Setup-launcher.log" -ForegroundColor Gray
    Start-Process $wsbPath
    Write-Host ""
    Write-Host "If a Sandbox window did not appear, double-click the .wsb path above in Explorer." -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.InvocationInfo.PositionMessage) {
        Write-Host $_.InvocationInfo.PositionMessage -ForegroundColor DarkRed
    }
    exit 1
}
finally {
    Wait-ForUser
}
