import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

let cached: string | null = null;

function tryPrintExecutable(cmd: string, args: string[]): string | null {
  try {
    const out = execFileSync(cmd, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 12_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const exe = out.trim().split(/\r?\n/).pop()?.trim();
    if (exe && fs.existsSync(exe)) return exe;
  } catch {
    /* */
  }
  return null;
}

function bestPythonUnderProgramsPython(base: string): string | null {
  if (!base || !fs.existsSync(base)) return null;
  let best: { v: number; p: string } | null = null;
  try {
    for (const name of fs.readdirSync(base, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      const m = /^Python(\d+)$/i.exec(name.name);
      if (!m) continue;
      const candidate = path.join(base, name.name, "python.exe");
      if (!fs.existsSync(candidate)) continue;
      const v = parseInt(m[1], 10);
      if (!best || v > best.v) best = { v, p: candidate };
    }
  } catch {
    /* */
  }
  return best?.p ?? null;
}

/**
 * Full path to python.exe for spawning (Electron often lacks Shims on PATH).
 */
export function getPythonExecutableSync(): string {
  if (cached) return cached;
  if (process.platform !== "win32") {
    cached = "python3";
    return cached;
  }

  const fromPy = tryPrintExecutable("py", ["-3", "-c", "import sys; print(sys.executable)"]);
  if (fromPy) {
    cached = fromPy;
    return cached;
  }

  const fromPython = tryPrintExecutable("python", ["-c", "import sys; print(sys.executable)"]);
  if (fromPython) {
    cached = fromPython;
    return cached;
  }

  const localPrograms = path.join(process.env.LOCALAPPDATA || "", "Programs", "Python");
  const fromLocal = bestPythonUnderProgramsPython(localPrograms);
  if (fromLocal) {
    cached = fromLocal;
    return cached;
  }

  const pf = process.env.PROGRAMFILES || "";
  for (const dir of ["Python313", "Python312", "Python311", "Python310"]) {
    const candidate = path.join(pf, dir, "python.exe");
    if (fs.existsSync(candidate)) {
      cached = candidate;
      return cached;
    }
  }

  cached = "python";
  return cached;
}

const projectPythonCache = new Map<string, string>();

/**
 * Prefer projectDir/.venv Python (where pip installed uvicorn etc.); else same as getPythonExecutableSync().
 */
export function getProjectPythonSync(projectDir: string): string {
  const key = path.resolve(projectDir);
  const hit = projectPythonCache.get(key);
  if (hit) return hit;

  let resolved: string;
  if (process.platform === "win32") {
    const venvPy = path.join(key, ".venv", "Scripts", "python.exe");
    resolved = fs.existsSync(venvPy) ? venvPy : getPythonExecutableSync();
  } else {
    const venvPy = path.join(key, ".venv", "bin", "python");
    resolved = fs.existsSync(venvPy) ? venvPy : getPythonExecutableSync();
  }
  projectPythonCache.set(key, resolved);
  return resolved;
}
