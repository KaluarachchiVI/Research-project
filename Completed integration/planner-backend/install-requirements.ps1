# Install planner-backend deps when pip hits ProxyError / WinError 10061.
# Causes: dead HTTP(S)_PROXY, pip.ini proxy, or Windows WinHTTP proxy. urllib3 still
# uses system proxy unless NO_PROXY=* (and/or pip proxy keys are cleared).
# Continue: pip writes "ERROR: No such key" to stderr when unsetting missing keys; Stop would abort.
$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$py = Join-Path $here ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    throw "Missing venv at $py - create it first (e.g. py -3.12 -m venv .venv)."
}

foreach ($name in @(
        "HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy",
        "ALL_PROXY", "all_proxy", "PIP_PROXY"
    )) {
    if (Test-Path "Env:$name") {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
}

# Requests/urllib3: bypass proxy for all hosts (WinHTTP + env proxy).
$env:NO_PROXY = "*"
$env:no_proxy = "*"

$req = Join-Path $here "requirements.txt"
Write-Host "Installing from $req..."
Write-Host "pip config lines mentioning proxy (before unset):"
& $py -m pip config list 2>$null | Select-String -Pattern "proxy" -CaseSensitive:$false

foreach ($key in @("global.proxy", "install.proxy")) {
    # Missing keys are normal; stderr must be merged or PowerShell treats it as a terminating error.
    & $py -m pip config unset $key 2>&1 | Out-Null
}

Write-Host "Using direct PyPI (NO_PROXY=*; cleared pip proxy keys if present)."
& $py -m pip install `
    --index-url "https://pypi.org/simple" `
    --trusted-host "pypi.org" `
    --trusted-host "files.pythonhosted.org" `
    -r $req

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "If you still see ProxyError, check Windows WinHTTP proxy (may need admin):"
    Write-Host "  netsh winhttp show proxy"
    Write-Host "To reset (only if you do not need a system proxy):"
    Write-Host "  netsh winhttp reset proxy"
}
