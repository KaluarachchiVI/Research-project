$ErrorActionPreference = "Stop"
$reg = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
$statePath = Join-Path $env:LOCALAPPDATA "IntentLockDesktop\proxy-state.json"
if (Test-Path $statePath) {
  $j = Get-Content $statePath -Raw | ConvertFrom-Json
  $en = $j.ProxyEnable
  $sv = $j.ProxyServer
  if ($null -ne $en) { Set-ItemProperty -Path $reg -Name ProxyEnable -Value $en }
  if ($null -ne $sv) { Set-ItemProperty -Path $reg -Name ProxyServer -Value $sv }
  Remove-Item $statePath -Force
} else {
  Set-ItemProperty -Path $reg -Name ProxyEnable -Value 0
  Set-ItemProperty -Path $reg -Name ProxyServer -Value ""
}
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
Write-Output "Proxy restored"
