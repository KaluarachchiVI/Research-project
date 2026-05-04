$ErrorActionPreference = "Stop"
$reg = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
$statePath = Join-Path $env:LOCALAPPDATA "IntentLockDesktop\proxy-state.json"
if (Test-Path $statePath) {
  $j = Get-Content $statePath -Raw | ConvertFrom-Json
  if ($null -ne $j.ProxyEnable) { Set-ItemProperty -Path $reg -Name ProxyEnable -Value $j.ProxyEnable }
  if ($null -ne $j.ProxyServer) { Set-ItemProperty -Path $reg -Name ProxyServer -Value $j.ProxyServer }

  if ($j.PSObject.Properties.Name -contains "ProxyOverride" -and $null -ne $j.ProxyOverride) {
    Set-ItemProperty -Path $reg -Name ProxyOverride -Value $j.ProxyOverride
  } else {
    Remove-ItemProperty -Path $reg -Name ProxyOverride -ErrorAction SilentlyContinue
  }

  if ($j.PSObject.Properties.Name -contains "AutoConfigURL" -and $null -ne $j.AutoConfigURL -and "$($j.AutoConfigURL)".Trim().Length -gt 0) {
    Set-ItemProperty -Path $reg -Name AutoConfigURL -Value $j.AutoConfigURL
  }

  if ($j.PSObject.Properties.Name -contains "AutoDetect" -and $null -ne $j.AutoDetect) {
    Set-ItemProperty -Path $reg -Name AutoDetect -Value $j.AutoDetect
  }

  Remove-Item $statePath -Force
} else {
  Set-ItemProperty -Path $reg -Name ProxyEnable -Value 0
  Set-ItemProperty -Path $reg -Name ProxyServer -Value ""
  Remove-ItemProperty -Path $reg -Name ProxyOverride -ErrorAction SilentlyContinue
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
