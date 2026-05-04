import * as path from "path";

/** .../Completed integration (parent of desktop-app) */
export function getIntegrationRoot(): string {
  // dist/main/main.js -> ../../.. = Completed integration
  return path.resolve(__dirname, "..", "..", "..");
}

export function getLauncherDir(): string {
  return path.join(getIntegrationRoot(), "launcher");
}

export function getDesktopAppRoot(): string {
  return path.join(getIntegrationRoot(), "desktop-app");
}
