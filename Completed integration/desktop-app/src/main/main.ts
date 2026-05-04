import { app, BrowserWindow, dialog, ipcMain } from "electron";
import * as path from "path";

if (process.platform === "win32") {
  app.setAppUserModelId("com.intentlock.desktop");
}
import { IPC } from "./ipc";
import { ServiceManager } from "./services/manager";
import { waitForAllHealthy } from "./services/health";
import { LockdownController } from "./lockdown/index";
import { listInstalledApps } from "./util/installedApps";
import * as log from "./util/logger";

process.on("unhandledRejection", (reason) => {
  log.err("Unhandled rejection", reason);
});
process.on("uncaughtException", (err) => {
  log.err("Uncaught exception", err);
});

let mainWindow: BrowserWindow | null = null;
const services = new ServiceManager();
let lockdown: LockdownController | null = null;
let servicesBootstrapped = false;

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function registerIpc(): void {
  ipcMain.handle(IPC.lockdownStart, async (_e, raw: unknown) => {
    if (!lockdown) return { ok: false, error: "Lockdown not initialized" };
    return lockdown.start(raw);
  });
  ipcMain.handle(IPC.lockdownStop, async (_e, raw: { reason?: string }) => {
    if (!lockdown) return { ok: true };
    await lockdown.stop(raw?.reason ?? "renderer");
    return { ok: true };
  });
  ipcMain.handle(IPC.lockdownSetPhase, (_e, phase: "work" | "break", opts?: { workMinutes?: number }) => {
    lockdown?.setPhase(phase, opts);
    return { ok: true };
  });
  ipcMain.handle(IPC.appsList, async () => {
    return listInstalledApps();
  });
}

async function ensureServices(): Promise<void> {
  if (servicesBootstrapped) return;
  servicesBootstrapped = true;
  try {
    log.log("Running CLE setup…");
    await services.runCleSetup();
  } catch (e) {
    log.err("CLE setup failed", e);
  }
  log.log("Starting backend services…");
  try {
    services.startAll({ withHooks: true });
  } catch (e) {
    log.err("Failed to start backend services", e);
    return;
  }
  // Do not block the UI on every service; Next dev server may need time before loadURL.
  void waitForAllHealthy()
    .then(() => log.log("Background health: all endpoints responded"))
    .catch((e) => log.err("Background health check did not complete in time (UI may still work)", e));
}

async function loadIntentLockHomeWithRetry(win: BrowserWindow): Promise<void> {
  const url = "http://localhost:3000";
  const deadline = Date.now() + 180_000;
  let attempt = 0;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    attempt += 1;
    try {
      await win.loadURL(url);
      log.log(`Loaded ${url} (attempt ${attempt})`);
      return;
    } catch (e) {
      lastErr = e;
      log.log(`loadURL not ready (attempt ${attempt}), retry in 2s`, e);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? `Timed out loading ${url}`));
}

async function createOrFocusWindow(): Promise<void> {
  await ensureServices();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  lockdown = new LockdownController(services, getMainWindow);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("closed", () => {
    void lockdown?.stop("window-closed");
    lockdown = null;
    mainWindow = null;
  });

  await loadIntentLockHomeWithRetry(mainWindow);
  mainWindow.show();
}

app.whenReady().then(async () => {
  registerIpc();
  try {
    await createOrFocusWindow();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.err("Fatal startup error", e);
    dialog.showErrorBox(
      "IntentLock Desktop — startup failed",
      `${msg}\n\nIf the window closed immediately, the Intent-Lock frontend (npm on port 3000) may not be ready yet — try again in a few seconds, or check the PowerShell window for [IntentLockDesktop] logs.`
    );
    app.quit();
    return;
  }
  app.on("activate", () => {
    void createOrFocusWindow().catch((err) => log.err("activate/createOrFocusWindow failed", err));
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  try {
    await lockdown?.stop("app-quit");
  } catch {
    /* */
  }
  await services.stopAll();
});
