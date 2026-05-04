export type InstalledAppEntry = {
  name: string;
  exeHint?: string | null;
};

export type DesktopLockdownStartRequest = {
  allowedApps: string[];
  allowedUrls: string[];
  workMinutes: number;
  breakMinutes: number;
  remindersEnabled: boolean;
};

export type DesktopLockdownResult = { ok: true } | { ok: false; error: string };

export type DesktopBridge = {
  apps: {
    list: () => Promise<InstalledAppEntry[]>;
  };
  lockdown: {
    start: (req: DesktopLockdownStartRequest) => Promise<DesktopLockdownResult>;
    stop: (payload?: { reason?: string }) => Promise<DesktopLockdownResult>;
    setPhase: (phase: "work" | "break", payload?: { workMinutes?: number }) => Promise<DesktopLockdownResult>;
  };
};

// In the browser-only flow there is no desktop bridge. The Electron wrapper can
// inject one on `window.__INTENTLOCK_BRIDGE__`.

export function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  const anyWindow = window as unknown as { __INTENTLOCK_BRIDGE__?: DesktopBridge };
  return anyWindow.__INTENTLOCK_BRIDGE__ ?? null;
}

export function isDesktopApp(): boolean {
  return getDesktopBridge() != null;
}
