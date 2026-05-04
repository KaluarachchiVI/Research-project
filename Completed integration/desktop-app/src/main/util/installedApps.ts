import execa from "execa";
import { isWindowsBaselineProcess } from "../lockdown/windowsBaseline";
import * as log from "./logger";

export interface InstalledAppEntry {
  name: string;
  /** Hint for whitelist (exe basename when known) */
  exeHint?: string;
}

/** Same basename resolution as focus-setup `appWhitelistValue` (keep in sync). */
function focusPickerKey(entry: InstalledAppEntry): string {
  const hint = entry.exeHint?.trim();
  if (hint && hint.toLowerCase().endsWith(".exe")) {
    const k = hint.replace(/\//g, "\\").trim().toLowerCase();
    const i = Math.max(k.lastIndexOf("\\"), k.lastIndexOf("/"));
    return i >= 0 ? k.slice(i + 1) : k;
  }
  const n = entry.name.trim().toLowerCase();
  if (!n) return "";
  return n.endsWith(".exe") ? n : `${n}.exe`;
}

/** Built-in / admin tools: never offer as focus "allowed" checkboxes (baseline already covers many). */
const NEVER_SHOW_EXE = new Set(
  [
    "charmap.exe",
    "cmd.exe",
    "dfrgui.exe",
    "cleanmgr.exe",
    "eventvwr.exe",
    "mmc.exe",
    "regedit.exe",
    "regedt32.exe",
    "taskmgr.exe",
    "msconfig.exe",
    "msinfo32.exe",
    "resmon.exe",
    "perfmon.exe",
    "compmgmtlauncher.exe",
    "compmgmt.exe",
    "odbcad32.exe",
    "iscsicpl.exe",
    "mstsc.exe",
    "msdt.exe",
    "optionalfeatures.exe",
    "sysdm.exe",
    "control.exe",
    "explorer.exe",
    "powershell.exe",
    "pwsh.exe",
    "wt.exe",
    "wsl.exe",
    "wslhost.exe",
    "bash.exe",
    "services.exe",
    "lsass.exe",
    "winlogon.exe",
    "fontdrvhost.exe",
    "smss.exe",
    "csrss.exe",
    "wininit.exe",
    "conhost.exe",
    "dwm.exe",
    "sihost.exe",
    "userinit.exe",
    "logonui.exe",
    "lockapp.exe",
    "credentialuibroker.exe",
    "runtimebroker.exe",
    "searchhost.exe",
    "searchapp.exe",
    "shellexperiencehost.exe",
    "startmenuexperiencehost.exe",
    "applicationframehost.exe",
    "systemsettings.exe",
    "systemsettingsbroker.exe",
    "narrator.exe",
    "magnify.exe",
    "osk.exe",
    "displayswitch.exe",
    "tabtip.exe",
    "textinputhost.exe",
    "ctfmon.exe",
    "smartscreen.exe",
    "securityhealthsystray.exe",
    "securityhealthhost.exe",
    "msmpeng.exe",
    "wuauclt.exe",
    "usoclient.exe",
    "mdsched.exe",
    "recoverydrive.exe",
    "bitlockerwizard.exe",
    "cipher.exe",
    "bcdedit.exe",
    "vssadmin.exe",
    "wbadmin.exe",
    "winver.exe",
    "schtasks.exe",
    "wevtutil.exe",
    "wmic.exe",
    "diskpart.exe",
    "defrag.exe",
    "xwizard.exe",
    "mshta.exe",
    "wscript.exe",
    "cscript.exe",
    "psr.exe",
    "snippingtool.exe",
    "screenclippinghost.exe",
    "write.exe",
    "wordpad.exe",
    "dxdiag.exe",
    "fsquirt.exe",
    "telnet.exe",
    "ftp.exe",
    "net.exe",
    "net1.exe",
    "sc.exe",
    "shutdown.exe",
    "logoff.exe",
    "dccw.exe",
    "colorcpl.exe",
    "wusa.exe",
    "dism.exe",
    "sfc.exe",
    "livecaptions.exe",
    "voiceaccess.exe",
    "gethelp.exe",
    "helppane.exe",
    "quickassist.exe",
  ].map((s) => s.toLowerCase())
);

/** Display-name phrases (lowercase substring) when Start menu label is clearer than AppID. */
const NEVER_SHOW_NAME_PHRASE = [
  "windows defender firewall",
  "windows memory diagnostic",
  "windows backup",
  "windows tools",
  "component services",
  "computer management",
  "disk cleanup",
  "defragment and optimize",
  "event viewer",
  "local security policy",
  "performance monitor",
  "resource monitor",
  "task scheduler",
  "system configuration",
  "system information",
  "remote desktop connection",
  "iscsi initiator",
  "odbc data sources",
  "uninstall node",
  "node.js documentation",
  "node.js website",
  "node.js command prompt",
  "install additional tools for node",
  "manuals (64-bit)",
  "module docs (64-bit)",
  "idle (python",
  "powershell (x86)",
  "windows powershell",
  "command prompt",
  "registry editor",
  "character map",
  "control panel",
  "get started",
  "click to do",
  "recovery drive",
  "voice access",
  "live captions",
  "narrator",
  "on-screen keyboard",
  "magnifier",
  "task manager",
];

function shouldShowInFocusPicker(entry: InstalledAppEntry, appId: string): boolean {
  const aid = appId.trim();
  if (/\\Windows\\(System32|SysWOW64)\\/i.test(aid) || /\/Windows\/(System32|SysWOW64)\//i.test(aid)) {
    const tail = aid.split(/[/\\]/).pop()?.toLowerCase() ?? "";
    if (tail.endsWith(".msc") || tail.endsWith(".cpl")) return false;
    if (tail.endsWith(".exe")) {
      if (NEVER_SHOW_EXE.has(tail) || isWindowsBaselineProcess(tail)) return false;
    }
  }

  const name = entry.name.trim().toLowerCase();
  if (name === "services" || name === "settings" || name === "windows settings") return false;
  for (const part of NEVER_SHOW_NAME_PHRASE) {
    if (name.includes(part)) return false;
  }

  const key = focusPickerKey(entry);
  if (!key) return false;
  if (key.includes(" ") && !key.includes("\\")) return false;

  const base = (() => {
    const k = key.replace(/\//g, "\\");
    const i = Math.max(k.lastIndexOf("\\"), k.lastIndexOf("/"));
    return (i >= 0 ? k.slice(i + 1) : k).toLowerCase();
  })();

  if (NEVER_SHOW_EXE.has(base)) return false;
  if (NEVER_SHOW_EXE.has(key.toLowerCase())) return false;
  if (isWindowsBaselineProcess(base)) return false;

  return true;
}

/**
 * Enumerate Start-menu / registered apps via Get-StartApps (Windows).
 * Filters out built-in Windows and admin tools so the focus picker only shows realistic "work" apps.
 */
export async function listInstalledApps(): Promise<InstalledAppEntry[]> {
  try {
    const { stdout } = await execa(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Get-StartApps | Select-Object -First 400 | ConvertTo-Json -Compress -Depth 3",
      ],
      { reject: false, timeout: 60_000 }
    );
    if (!stdout?.trim()) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return [];
    }
    const rows = Array.isArray(parsed) ? parsed : parsed != null ? [parsed] : [];
    const out: InstalledAppEntry[] = [];
    for (const row of rows) {
      if (row && typeof row === "object" && "Name" in row) {
        const name = String((row as { Name: string }).Name ?? "").trim();
        if (!name) continue;
        const appId = (row as { AppID?: string }).AppID ?? "";
        const exeMatch = /\.exe$/i.test(appId) ? appId.split("\\").pop() : undefined;
        const entry: InstalledAppEntry = { name, exeHint: exeMatch };
        if (!shouldShowInFocusPicker(entry, appId)) continue;
        out.push(entry);
      }
    }
    return out;
  } catch (e) {
    log.warn("listInstalledApps failed", e);
    return [];
  }
}
