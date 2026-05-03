import * as http from "http";
import * as log from "../util/logger";

export interface HealthTarget {
  name: string;
  url: string;
}

export const DEFAULT_HEALTH_TARGETS: HealthTarget[] = [
  { name: "ILF", url: "http://localhost:3000" },
  { name: "CLE", url: "http://127.0.0.1:8000/docs" },
  { name: "ILB", url: "http://127.0.0.1:8001/docs" },
  { name: "Sched", url: "http://127.0.0.1:5000" },
  { name: "PlannerB", url: "http://127.0.0.1:5001/docs" },
  { name: "PlannerF", url: "http://localhost:5123" },
];

function checkOne(url: string, timeoutMs: number): Promise<number> {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, { timeout: timeoutMs }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on("error", () => resolve(0));
      req.on("timeout", () => {
        req.destroy();
        resolve(0);
      });
    } catch {
      resolve(0);
    }
  });
}

export async function waitForAllHealthy(
  targets: HealthTarget[] = DEFAULT_HEALTH_TARGETS,
  opts: { overallTimeoutMs?: number; perRequestMs?: number; pollMs?: number } = {}
): Promise<void> {
  const overallTimeoutMs = opts.overallTimeoutMs ?? 240_000;
  const perRequestMs = opts.perRequestMs ?? 10_000;
  const pollMs = opts.pollMs ?? 2000;
  const start = Date.now();

  while (Date.now() - start < overallTimeoutMs) {
    const results = await Promise.all(
      targets.map(async (t) => ({
        name: t.name,
        url: t.url,
        status: await checkOne(t.url, perRequestMs),
      }))
    );
    const failed = results.filter((r) => r.status !== 200);
    if (failed.length === 0) {
      log.log("All health checks passed:", results.map((r) => `${r.name}=200`).join(", "));
      return;
    }
    log.log(
      "Health pending:",
      failed.map((f) => `${f.name}=${f.status}`).join(", "),
      `(${Math.round((Date.now() - start) / 1000)}s)`
    );
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Health check timeout after ${overallTimeoutMs}ms`);
}
