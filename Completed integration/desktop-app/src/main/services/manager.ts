import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { execa } from "execa";
import * as log from "../util/logger";
import { getIntegrationRoot, getLauncherDir } from "../util/paths";
import { collectProcessTreePids } from "./processTree";

export interface ServiceManagerOptions {
  withHooks?: boolean;
}

type ManagedProc = {
  name: string;
  proc: ChildProcess;
};

const integrationRoot = getIntegrationRoot();
const cleDir = path.join(integrationRoot, "cognitive-load-estimator");
const schedulerDir = path.join(integrationRoot, "adaptive-scheduler");
const intentLockBackendDir = path.join(integrationRoot, "intent-lock-backend");
const intentLockFrontendDir = path.join(integrationRoot, "intent-lock-frontend");
const plannerBackendDir = path.join(integrationRoot, "planner-backend");
const plannerFrontendDir = path.join(integrationRoot, "planner-frontend");

export class ServiceManager {
  private children: ManagedProc[] = [];
  private rootPids = new Set<number>();

  getTrackedRootPids(): number[] {
    return [...this.rootPids];
  }

  /** All PIDs in spawned service trees (for process guard baseline). */
  async getAllServicePids(): Promise<Set<number>> {
    const all = new Set<number>();
    for (const pid of this.rootPids) {
      const tree = await collectProcessTreePids(pid);
      for (const p of tree) all.add(p);
    }
    return all;
  }

  async runCleSetup(): Promise<void> {
    const launcherDir = getLauncherDir();
    const setupScript = path.join(launcherDir, "setup_cle.py");
    log.log("Running CLE setup:", setupScript);
    await execa("python", [setupScript], {
      cwd: launcherDir,
      stdio: "inherit",
    });
  }

  private push(name: string, proc: ChildProcess): void {
    this.children.push({ name, proc });
    if (proc.pid) this.rootPids.add(proc.pid);
    proc.on("exit", (code, signal) => {
      log.warn(`Service ${name} exited code=${code} signal=${signal}`);
    });
  }

  private spawnWin(
    name: string,
    command: string,
    args: string[],
    cwd: string,
    extraEnv: Record<string, string> = {},
    useShell = false
  ): void {
    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdio: "inherit",
      shell: useShell,
      detached: false,
    });
    this.push(name, proc);
  }

  startAll(opts: ServiceManagerOptions = {}): void {
    if (this.children.length > 0) {
      log.warn("ServiceManager.startAll: services already running");
      return;
    }

    const cleExe = path.join(cleDir, ".venv", "Scripts", "cog-py-est.exe");
    if (!fs.existsSync(cleExe)) {
      throw new Error(`CLE executable not found: ${cleExe}. Run setup_cle.py first.`);
    }

    this.spawnWin("cle", cleExe, ["--config", "policy_1.toml"], cleDir);

    if (opts.withHooks !== false) {
      const hookExe = path.join(cleDir, ".venv", "Scripts", "cle-os-hooks.exe");
      if (fs.existsSync(hookExe)) {
        this.spawnWin(
          "cle-hooks",
          hookExe,
          ["--endpoint", "http://127.0.0.1:8000/events"],
          cleDir
        );
      } else {
        log.warn("cle-os-hooks.exe not found; skipping hooks");
      }
    }

    this.spawnWin(
      "intent-lock-backend",
      "python",
      ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001", "--reload"],
      intentLockBackendDir
    );

    const nextEnv: Record<string, string> = {
      NEXT_PUBLIC_INTENTLOCK_API_BASE: "http://127.0.0.1:8001",
      NEXT_PUBLIC_CLE_API_BASE: "http://127.0.0.1:8000",
      NEXT_PUBLIC_SCHEDULER_API_BASE: "http://127.0.0.1:5000",
      NEXT_PUBLIC_YUVIDU_API_BASE: "http://127.0.0.1:5001",
      NEXT_PUBLIC_YUVIDU_PLANNER_URL: "http://localhost:5123",
    };
    this.spawnWin("intent-lock-frontend", "npm", ["run", "dev"], intentLockFrontendDir, nextEnv, true);

    this.spawnWin(
      "adaptive-scheduler",
      "python",
      ["-m", "src.api.app"],
      schedulerDir
    );

    setTimeout(() => {
      this.spawnWin(
        "planner-backend",
        "python",
        ["-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "5001", "--reload"],
        plannerBackendDir,
        { SCHEDULER_API_BASE: "http://127.0.0.1:5000" }
      );

      this.spawnWin("planner-frontend", "npm", ["run", "dev:react"], plannerFrontendDir, {}, true);
    }, 3000);
  }

  async stopAll(): Promise<void> {
    const procs = [...this.children];
    this.children = [];
    this.rootPids.clear();

    for (const { name, proc } of procs) {
      if (!proc.pid) continue;
      log.log(`Stopping ${name} (pid ${proc.pid})`);
      try {
        if (process.platform === "win32") {
          await execa("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { reject: false });
        } else {
          proc.kill("SIGTERM");
        }
      } catch {
        proc.kill("SIGKILL");
      }
    }
  }
}
