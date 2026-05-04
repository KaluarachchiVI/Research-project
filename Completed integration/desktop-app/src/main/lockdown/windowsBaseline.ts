/**
 * Processes that must never be targeted by focus lockdown (process kill / foreground steal).
 * Names are stored lowercase with a `.exe` suffix; matching tolerates ProcessName with or without `.exe`.
 *
 * Goal: keep Windows shell, input, security, search indexing, audio, display, and recovery tools working.
 * User-chosen "external" apps still go through the allow-list on top of this baseline.
 */

const RAW = [
  // Session / kernel (never end these)
  "system idle process",
  "system",
  "registry",
  "[system process].exe",
  "secure system.exe",
  "memory compression.exe",
  "smss.exe",
  "csrss.exe",
  "wininit.exe",
  "services.exe",
  "lsass.exe",
  "winlogon.exe",
  "fontdrvhost.exe",
  "svchost.exe",
  // Desktop & compositor
  "dwm.exe",
  "explorer.exe",
  "sihost.exe",
  "taskhostw.exe",
  "userinit.exe",
  // Input & IME
  "ctfmon.exe",
  "textinputhost.exe",
  "tabtip.exe",
  "chsime.exe",
  "dllhost.exe",
  // Search & shell UI (Win10/11)
  "searchapp.exe",
  "searchhost.exe",
  "searchindexer.exe",
  "searchprotocolhost.exe",
  "searchfilterhost.exe",
  "shellexperiencehost.exe",
  "startmenuexperiencehost.exe",
  "applicationframehost.exe",
  "shellhost.exe",
  "shellappruntime.exe",
  // Runtime / broker
  "runtimebroker.exe",
  "aggregatorhost.exe",
  // Audio / print
  "audiodg.exe",
  "spoolsv.exe",
  // Security / Defender (do not kill)
  "securityhealthsystray.exe",
  "securityhealthservice.exe",
  "securityhealthhost.exe",
  "securityhealthsso.exe",
  "msmpeng.exe",
  "mssense.exe",
  "nissrv.exe",
  "mpcmdrun.exe",
  "smartscreen.exe",
  "lsaiso.exe",
  // Windows Update / servicing
  "mousocoreworker.exe",
  "usoclient.exe",
  "tiworker.exe",
  "trustedinstaller.exe",
  "wuauclt.exe",
  "wuapihost.exe",
  // WMI / management
  "wmiprvse.exe",
  "unsecapp.exe",
  "winmgmt.exe",
  // WebView / embedded Edge used by shell & many apps
  "msedgewebview2.exe",
  "crashpad_handler.exe",
  // Consoles spawned by tools
  "conhost.exe",
  // Lock / logon UI
  "lockapp.exe",
  "logonui.exe",
  // Settings & OOBE
  "systemsettings.exe",
  "systemsettingsbroker.exe",
  "useroobebroker.exe",
  "credentialuibroker.exe",
  // Widgets / phone link shell
  "widgets.exe",
  "widgetservice.exe",
  "phoneexperiencehost.exe",
  // Recovery / admin (escape hatch)
  "taskmgr.exe",
  "mmc.exe",
  // Optional: common accessibility (do not disrupt)
  "narrator.exe",
  "magnify.exe",
  "osk.exe",
  "displayswitch.exe",
  // Store / WinRT host (system updates & shell extensions)
  "winstore.app.exe",
  "wsclient.exe",
  // Network list / tray helpers
  "dasHost.exe",
  "wlanext.exe",
  // Sync / notifications
  "monotificationux.exe",
  // Device census (often runs as own process)
  "devicecensus.exe",
  // Sandbox / VM / RDP helpers (WDAG, Hyper-V, remote desktop)
  "vmcomputeagent.exe",
  "rdpclip.exe",
  "wudfhost.exe",
  "cexecsvc.exe",
  "vmmem.exe",
  "vmmemwsl.exe",
  // XAML / modern host
  "winrtnetfx32.exe",
  "winrtnetfx64.exe",
];

export const WINDOWS_BASELINE_EXECUTABLES = new Set(RAW.map((s) => s.trim().toLowerCase()));

/** Normalize ProcessName / Image name for lookup in {@link WINDOWS_BASELINE_EXECUTABLES}. */
export function baselineProcessKey(name: string): string {
  const n = name.trim().toLowerCase();
  if (!n) return "";
  if (n === "system idle process" || n === "system" || n === "registry") return n;
  return n.endsWith(".exe") ? n : `${n}.exe`;
}

export function isWindowsBaselineProcess(name: string): boolean {
  const key = baselineProcessKey(name);
  if (!key) return false;
  return WINDOWS_BASELINE_EXECUTABLES.has(key);
}
