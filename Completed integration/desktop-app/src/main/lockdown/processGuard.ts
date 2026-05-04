import psList from "ps-list";
import execa from "execa";
import * as log from "../util/logger";
import type { LockPhase } from "./urlProxy";
import { isWindowsBaselineProcess } from "./windowsBaseline";

function normalizeExe(name: string): string {
  return name.trim().toLowerCase();
}

export class ProcessGuard {
  private timer?: NodeJS.Timeout;

  constructor(
    private getPhase: () => LockPhase,
    private getAllowedBasenames: () => Set<string>,
    private getServicePids: () => Promise<Set<number>>,
    private getElectronPids: () => Promise<Set<number>>
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), 1500);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async tick(): Promise<void> {
    const phase = this.getPhase();
    if (phase !== "work") return;

    let list: Awaited<ReturnType<typeof psList>>;
    try {
      list = await psList();
    } catch (e) {
      log.warn("ps-list failed", e);
      return;
    }

    const allowedNames = this.getAllowedBasenames();
    const servicePids = await this.getServicePids();
    const electronPids = await this.getElectronPids();

    for (const p of list) {
      const pid = p.pid;
      if (!Number.isFinite(pid) || pid < 8) continue;
      const name = normalizeExe(p.name || "");
      if (!name) continue;
      if (servicePids.has(pid)) continue;
      if (electronPids.has(pid)) continue;
      if (isWindowsBaselineProcess(name)) continue;
      if (allowedNames.has(name)) continue;
      if (name.startsWith("[") && name.includes("]")) continue;

      log.log("ProcessGuard: terminating", name, pid);
      try {
        await execa("taskkill", ["/PID", String(pid), "/T", "/F"], { reject: false, timeout: 10_000 });
      } catch {
        /* */
      }
    }
  }
}
