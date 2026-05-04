# Optional: install a user-scoped root CA PEM for HTTPS MITM (future). No-op placeholder for v1 CONNECT-only filtering.
param([string]$PemPath = "")
if (-not $PemPath -or -not (Test-Path $PemPath)) {
  Write-Output "No PEM path; skipping CA install (v1 uses CONNECT allow-list only)."
  exit 0
}
certutil -user -addstore Root $PemPath
exit $LASTEXITCODE
