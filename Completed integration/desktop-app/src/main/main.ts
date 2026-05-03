import { app, BrowserWindow, ipcMain } from "electron";
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
  services.startAll({ withHooks: true });
  try {
    await waitForAllHealthy();
  } catch (e) {
    log.err("Health check failed", e);
  }
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

  await mainWindow.loadURL("http://localhost:3000");
  mainWindow.show();
}

app.whenReady().then(async () => {
  registerIpc();
  await createOrFocusWindow();
  app.on("activate", () => {
    void createOrFocusWindow();
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
