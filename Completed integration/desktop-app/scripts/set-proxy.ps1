param(
  [string]$ProxyHost = "127.0.0.1",
  [int]$Port = 8888
)
$ErrorActionPreference = "Stop"
$reg = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
$server = "http=${ProxyHost}:${Port};https=${ProxyHost}:${Port}"
$statePath = Join-Path $env:LOCALAPPDATA "IntentLockDesktop\proxy-state.json"
$dir = Split-Path $statePath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

function Get-RegString([string]$name) {
  (Get-ItemProperty -Path $reg -Name $name -ErrorAction SilentlyContinue).$name
}
function Get-RegDword([string]$name) {
  (Get-ItemProperty -Path $reg -Name $name -ErrorAction SilentlyContinue).$name
}

$prevEnable = Get-RegDword "ProxyEnable"
$prevServer = Get-RegString "ProxyServer"
$prevOverride = Get-RegString "ProxyOverride"
$prevPac = Get-RegString "AutoConfigURL"
$prevAutoDetect = Get-RegDword "AutoDetect"

@{
  ProxyEnable    = $prevEnable
  ProxyServer    = $prevServer
  ProxyOverride  = $prevOverride
  AutoConfigURL  = $prevPac
  AutoDetect     = $prevAutoDetect
} | ConvertTo-Json | Set-Content -Path $statePath -Encoding UTF8

# Tight bypass: short local names only (not internet hostnames). Stale ProxyOverride often bypasses too much.
Set-ItemProperty -Path $reg -Name ProxyOverride -Value "<local>"
Set-ItemProperty -Path $reg -Name ProxyServer -Value $server
Set-ItemProperty -Path $reg -Name ProxyEnable -Value 1

# PAC / WPAD often sends browsers DIRECT while manual proxy looks "on" — disable for this session (restored in unset-proxy.ps1).
if ($null -ne $prevPac -and "$prevPac".Trim().Length -gt 0) {
  Remove-ItemProperty -Path $reg -Name AutoConfigURL -ErrorAction SilentlyContinue
}
Set-ItemProperty -Path $reg -Name AutoDetect -Value 0 -ErrorAction SilentlyContinue

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
Write-Output "Proxy set to $server (ProxyOverride=<local>; PAC/WPAD cleared if present). Previous saved to $statePath"
Write-Output "Note: Firefox uses its own proxy by default — set it to Use system proxy settings for URL filtering."
