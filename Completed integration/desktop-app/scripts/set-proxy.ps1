param(
  [string]$ProxyHost = "127.0.0.1",
  [int]$Port = 8888
)
$ErrorActionPreference = "Stop"
$reg = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
$server = "${ProxyHost}:${Port}"
$prevEnable = (Get-ItemProperty -Path $reg -Name ProxyEnable -ErrorAction SilentlyContinue).ProxyEnable
$prevServer = (Get-ItemProperty -Path $reg -Name ProxyServer -ErrorAction SilentlyContinue).ProxyServer
$statePath = Join-Path $env:LOCALAPPDATA "IntentLockDesktop\proxy-state.json"
$dir = Split-Path $statePath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
@{ ProxyEnable = $prevEnable; ProxyServer = $prevServer } | ConvertTo-Json | Set-Content -Path $statePath -Encoding UTF8
Set-ItemProperty -Path $reg -Name ProxyEnable -Value 1
Set-ItemProperty -Path $reg -Name ProxyServer -Value $server
# Notify apps (best-effort)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
}
"@
$HWND_BROADCAST = [IntPtr]0xffff
$WM_SETTINGCHANGE = 0x1a
$result = [IntPtr]::Zero
[void][Win32]::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [IntPtr]::Zero, "Internet Settings", 2, 5000, [ref]$result)
Write-Output "Proxy set to $server (previous saved to $statePath)"
