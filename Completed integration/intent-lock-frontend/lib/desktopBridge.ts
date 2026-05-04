/**
 * Bridge to IntentLock Desktop (Electron preload). In plain browser dev this is absent.
 */
export type InstalledAppEntry = {
  name: string;
  exeHint?: string;
};

export type LockdownStartPayload = {
  allowedApps: string[];
  allowedUrls: string[];
  workMinutes: number;
  breakMinutes: number;
  remindersEnabled: boolean;
};

export type DesktopBridge = {
  apps: {
    list: () => Promise<InstalledAppEntry[]>;
  };
  lockdown: {
    start: (
      payload: LockdownStartPayload
    ) => Promise<{ ok: boolean; error?: string }>;
    stop: (opts: { reason: string }) => Promise<void>;
    setPhase: (
      phase: "work" | "break",
      opts?: { workMinutes?: number }
    ) => Promise<void>;
  };
};

declare global {
  interface Window {
    intentLockDesktop?: DesktopBridge;
  }
}

export function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return window.intentLockDesktop ?? null;
}

export function isDesktopApp(): boolean {
  return getDesktopBridge() !== null;
}
