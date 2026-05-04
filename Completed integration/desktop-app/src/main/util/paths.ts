import * as fs from "fs";
import * as path from "path";

/** .../Completed integration (parent of desktop-app) */
export function getIntegrationRoot(): string {
  // Compiled to dist/main/util/paths.js (not dist/main/main.js): four parents reach Completed integration.
  const candidates = [
    path.resolve(__dirname, "..", "..", "..", ".."),
    path.resolve(__dirname, "..", "..", "..", "..", ".."),
    path.resolve(__dirname, "..", "..", ".."),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "launcher", "setup_cle.py"))) {
      return dir;
    }
  }
  return candidates[0];
}

export function getLauncherDir(): string {
  return path.join(getIntegrationRoot(), "launcher");
}

export function getDesktopAppRoot(): string {
  return path.join(getIntegrationRoot(), "desktop-app");
}
