import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "./ipc";

export type LockdownStartRendererPayload = {
  allowedApps: string[];
  allowedUrls: string[];
  restrictWebsites?: boolean;
  sessionId?: string;
  workMinutes?: number;
  breakMinutes?: number;
  remindersEnabled?: boolean;
};

contextBridge.exposeInMainWorld("desktopBridge", {
  lockdown: {
    start: (config: LockdownStartRendererPayload) => ipcRenderer.invoke(IPC.lockdownStart, config),
    stop: (payload?: { reason?: string }) => ipcRenderer.invoke(IPC.lockdownStop, payload ?? {}),
    setPhase: (phase: "work" | "break", opts?: { workMinutes?: number }) =>
      ipcRenderer.invoke(IPC.lockdownSetPhase, phase, opts ?? {}),
  },
  apps: {
    list: () => ipcRenderer.invoke(IPC.appsList),
  },
});
