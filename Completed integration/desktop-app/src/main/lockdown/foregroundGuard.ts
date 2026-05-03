import { execa } from "execa";
import type { BrowserWindow } from "electron";
import * as log from "../util/logger";
import type { LockPhase } from "./urlProxy";
import { isWindowsBaselineProcess } from "./windowsBaseline";

/**
 * When focus is on a non-allowed process during work phase, bring IntentLock window forward.
 */
export class ForegroundGuard {
  private timer?: NodeJS.Timeout;

  constructor(
    private getPhase: () => LockPhase,
    private getAllowedBasenames: () => Set<string>,
    private getServicePids: () => Promise<Set<number>>,
    private getElectronPids: () => Promise<Set<number>>,
    private getMainWindow: () => BrowserWindow | null
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), 2000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async tick(): Promise<void> {
    const phase = this.getPhase();
    if (phase !== "work") return;

    let fgPid = 0;
    try {
      const { stdout } = await execa(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class FG {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out int pid);
  public static int Pid() {
    IntPtr h = GetForegroundWindow();
    int pid = 0;
    GetWindowThreadProcessId(h, out pid);
    return pid;
  }
}
"@
[FG]::Pid()`,
        ],
        { reject: false, timeout: 8000 }
      );
      fgPid = parseInt(String(stdout).trim(), 10) || 0;
    } catch {
      return;
    }
    if (!fgPid) return;

    const servicePids = await this.getServicePids();
    const electronPids = await this.getElectronPids();
    if (servicePids.has(fgPid) || electronPids.has(fgPid)) return;

    let fgName = "";
    try {
      const { stdout } = await execa(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `(Get-Process -Id ${fgPid} -ErrorAction SilentlyContinue).ProcessName`,
        ],
        { reject: false, timeout: 5000 }
      );
      fgName = String(stdout || "").trim().toLowerCase();
    } catch {
      return;
    }
    if (!fgName) return;

    const allowed = this.getAllowedBasenames();
    const base = fgName.replace(/\.exe$/i, "").toLowerCase();
    const withExe = fgName.toLowerCase().endsWith(".exe") ? fgName.toLowerCase() : `${base}.exe`;
    const userOk =
      allowed.has(withExe) ||
      allowed.has(fgName.toLowerCase()) ||
      [...allowed].some((a) => a.replace(/\.exe$/i, "") === base);

    if (userOk || isWindowsBaselineProcess(fgName)) return;

    const win = this.getMainWindow();
    if (!win || win.isDestroyed()) return;
    try {
      log.log("ForegroundGuard: refocusing app, foreground was", fgName, fgPid);
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      win.moveTop();
    } catch (e) {
      log.warn("ForegroundGuard focus failed", e);
    }
  }
}
