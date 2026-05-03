import { Notification } from "electron";
import type { BrowserWindow } from "electron";
import * as log from "../util/logger";
import type { LockPhase } from "../lockdown/urlProxy";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function focusWindow(getMainWindow: () => BrowserWindow | null): void {
  const w = getMainWindow();
  if (w && !w.isDestroyed()) {
    w.show();
    w.focus();
  }
}

/**
 * 3–4 reminders per work segment, spaced 30–50 minutes, plus one anchored ~5 min before interval end.
 */
export class ReminderScheduler {
  private timeouts: NodeJS.Timeout[] = [];

  constructor(
    private getPhase: () => LockPhase,
    private getMainWindow: () => BrowserWindow | null
  ) {}

  clear(): void {
    for (const t of this.timeouts) clearTimeout(t);
    this.timeouts = [];
  }

  scheduleForWorkSegment(workMinutes: number): void {
    this.clear();
    const nRandom = Math.min(4, Math.max(3, Math.floor(workMinutes / 40)));
    const gapsMin: number[] = [];
    for (let i = 0; i < nRandom; i++) gapsMin.push(randInt(30, 50));

    let cumulativeMs = 0;
    for (let i = 0; i < gapsMin.length; i++) {
      cumulativeMs += gapsMin[i] * 60 * 1000;
      const delay = cumulativeMs;
      const id = setTimeout(() => {
        if (this.getPhase() !== "work") return;
        try {
          if (!Notification.isSupported()) return;
          const note = new Notification({
            title: "IntentLock focus check",
            body: "Stay on your allowed apps and sites. You’ve got this.",
          });
          note.on("click", () => focusWindow(this.getMainWindow));
          note.show();
        } catch (e) {
          log.warn("Notification failed", e);
        }
      }, delay);
      this.timeouts.push(id);
    }

    const segmentEnd = Date.now() + Math.max(5, workMinutes) * 60 * 1000;
    const finalAt = segmentEnd - 5 * 60 * 1000;
    const finalDelay = Math.max(30_000, finalAt - Date.now());
    const lastRandomEnd = Date.now() + cumulativeMs;
    if (finalDelay > cumulativeMs + 60_000 || finalAt > lastRandomEnd + 60_000) {
      const id = setTimeout(() => {
        if (this.getPhase() !== "work") return;
        try {
          if (!Notification.isSupported()) return;
          const note = new Notification({
            title: "IntentLock",
            body: "About 5 minutes left in this work interval — stay focused.",
          });
          note.on("click", () => focusWindow(this.getMainWindow));
          note.show();
        } catch (e) {
          log.warn("Final notification failed", e);
        }
      }, finalDelay);
      this.timeouts.push(id);
    }
  }
}
