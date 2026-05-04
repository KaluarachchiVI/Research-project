# Launched from start-all.ps1 -Desktop (new PowerShell window, -NoExit).
# Keeps the window useful on failure: logs to desktop-start.log and pauses so errors are visible.
$ErrorActionPreference = "Continue"
# PS 7.2+: tools log INFO to stderr; without this, PowerShell shows them as red NativeCommandError noise.
if ($PSVersionTable.PSVersion -ge [version]"7.2") {
  $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot

$log = Join-Path $PSScriptRoot "desktop-start.log"
"=== $(Get-Date -Format o) start-desktop ===" | Out-File -FilePath $log -Encoding utf8

function Write-Log([string]$Message) {
  $line = "$(Get-Date -Format o) $Message"
  Add-Content -LiteralPath $log -Value $line -Encoding utf8
  Write-Host $Message
}

if (-not (Test-Path ".\node_modules")) {
  Write-Log "npm install (missing node_modules)..."
  npm install 2>&1 | Tee-Object -FilePath $log -Append
}

Write-Log "npm run build..."
npm run build 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) {
  Write-Host "`nBUILD FAILED (exit $LASTEXITCODE). Full log: $log" -ForegroundColor Red
  pause
  exit $LASTEXITCODE
}

Write-Log "npm start (Electron)..."
npm start 2>&1 | Tee-Object -FilePath $log -Append
$exit = $LASTEXITCODE
Write-Log "npm start exited with $exit"
if ($exit -ne 0) {
  Write-Host "`nnpm start failed (exit $exit). Log: $log" -ForegroundColor Red
}
Write-Host "`nLog file: $log" -ForegroundColor DarkGray
pause
