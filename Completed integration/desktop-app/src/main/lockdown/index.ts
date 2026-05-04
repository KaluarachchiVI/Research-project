import type { BrowserWindow } from "electron";
import { lockdownStartSchema, type LockdownStartPayload } from "../util/config";
import * as log from "../util/logger";
import { collectProcessTreePids } from "../services/processTree";
import type { ServiceManager } from "../services/manager";
import { disableSystemProxy, enableSystemProxy, FOCUS_PROXY_PORT } from "./systemProxy";
import { UrlConnectProxy, type LockPhase } from "./urlProxy";
import { ProcessGuard } from "./processGuard";
import { ForegroundGuard } from "./foregroundGuard";
import { ReminderScheduler } from "../notifications/scheduler";
import { ensureCaInstalled } from "./installCa";

function normalizeAppEntry(s: string): string {
  const t = s.trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  return lower.endsWith(".exe") ? lower : `${lower}.exe`;
}

function buildAllowedHostPredicate(urls: string[]): (host: string) => boolean {
  const patterns = urls
    .map((u) =>
      u
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        .split(":")[0]
    )
    .filter(Boolean);

  if (patterns.length === 0) {
    return () => false;
  }

  return (host: string) => {
    const h = host.toLowerCase().split(":")[0];
    for (const p of patterns) {
      if (h === p || h.endsWith(`.${p}`)) return true;
    }
    return false;
  };
}

export class LockdownController {
  private phase: LockPhase = "idle";
  private allowedBasenames = new Set<string>();
  private hostAllowed: (h: string) => boolean = () => true;
  private urlProxy?: UrlConnectProxy;
  private processGuard?: ProcessGuard;
  private foregroundGuard?: ForegroundGuard;
  private reminders?: ReminderScheduler;
  private currentWorkMinutes = 30;
  private remindersEnabled = true;

  constructor(
    private readonly services: ServiceManager,
    private readonly getMainWindow: () => BrowserWindow | null
  ) {}

  getPhase(): LockPhase {
    return this.phase;
  }

  private async getServicePids(): Promise<Set<number>> {
    return this.services.getAllServicePids();
  }

  private async getElectronPids(): Promise<Set<number>> {
    const s = new Set<number>();
    try {
      const mainTree = await collectProcessTreePids(process.pid);
      mainTree.forEach((x) => s.add(x));
    } catch {
      s.add(process.pid);
    }
    const win = this.getMainWindow();
    if (win && !win.isDestroyed()) {
      try {
        const wpid = win.webContents.getOSProcessId();
        s.add(wpid);
        const tree = await collectProcessTreePids(wpid);
        tree.forEach((x) => s.add(x));
      } catch {
        /* */
      }
    }
    return s;
  }

  async start(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
    const parsed = lockdownStartSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.message };
    }
    const payload: LockdownStartPayload = parsed.data;
    await this.stop("restart");

    this.allowedBasenames = new Set(
      payload.allowedApps.map(normalizeAppEntry).filter(Boolean)
    );
    this.hostAllowed = payload.restrictWebsites
      ? buildAllowedHostPredicate(payload.allowedUrls)
      : () => true;
    this.currentWorkMinutes = payload.workMinutes;
    this.remindersEnabled = payload.remindersEnabled;
    this.phase = "work";

    await ensureCaInstalled();

    this.urlProxy = new UrlConnectProxy(
      FOCUS_PROXY_PORT,
      () => this.phase,
      (host) => this.hostAllowed(host)
    );
    await this.urlProxy.start();
    await enableSystemProxy();

    this.processGuard = new ProcessGuard(
      () => this.phase,
      () => this.allowedBasenames,
      () => this.getServicePids(),
      () => this.getElectronPids()
    );
    this.processGuard.start();

    this.foregroundGuard = new ForegroundGuard(
      () => this.phase,
      () => this.allowedBasenames,
      () => this.getServicePids(),
      () => this.getElectronPids(),
      this.getMainWindow
    );
    this.foregroundGuard.start();

    if (this.remindersEnabled) {
      this.reminders = new ReminderScheduler(() => this.phase, this.getMainWindow);
      this.reminders.scheduleForWorkSegment(payload.workMinutes);
    }

    log.log("Lockdown started", payload);
    return { ok: true };
  }

  async stop(reason: string): Promise<void> {
    log.log("Lockdown stopping:", reason);
    this.phase = "idle";
    this.reminders?.clear();
    this.reminders = undefined;
    this.processGuard?.stop();
    this.processGuard = undefined;
    this.foregroundGuard?.stop();
    this.foregroundGuard = undefined;
    try {
      await this.urlProxy?.stop();
    } catch {
      /* */
    }
    this.urlProxy = undefined;
    try {
      await disableSystemProxy();
    } catch {
      /* */
    }
  }

  setPhase(phase: "work" | "break", opts?: { workMinutes?: number }): void {
    this.phase = phase;
    if (phase === "break") {
      this.reminders?.clear();
    }
    if (phase === "work") {
      if (typeof opts?.workMinutes === "number" && opts.workMinutes > 0) {
        this.currentWorkMinutes = opts.workMinutes;
        this.reminders?.clear();
        if (this.remindersEnabled) {
          this.reminders = new ReminderScheduler(() => this.phase, this.getMainWindow);
          this.reminders.scheduleForWorkSegment(opts.workMinutes);
        }
      }
    }
  }
}
