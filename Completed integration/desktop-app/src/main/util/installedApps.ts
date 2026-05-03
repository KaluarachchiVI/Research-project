import { execa } from "execa";
import * as log from "./logger";

export interface InstalledAppEntry {
  name: string;
  /** Hint for whitelist (exe basename when known) */
  exeHint?: string;
}

/**
 * Enumerate Start-menu / registered apps via Get-StartApps (Windows).
 */
export async function listInstalledApps(): Promise<InstalledAppEntry[]> {
  try {
    const { stdout } = await execa(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Get-StartApps | Select-Object -First 400 | ConvertTo-Json -Compress -Depth 3",
      ],
      { reject: false, timeout: 60_000 }
    );
    if (!stdout?.trim()) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return [];
    }
    const rows = Array.isArray(parsed) ? parsed : parsed != null ? [parsed] : [];
    const out: InstalledAppEntry[] = [];
    for (const row of rows) {
      if (row && typeof row === "object" && "Name" in row) {
        const name = String((row as { Name: string }).Name ?? "").trim();
        if (!name) continue;
        const appId = (row as { AppID?: string }).AppID ?? "";
        const exeMatch = /\.exe$/i.test(appId) ? appId.split("\\").pop() : undefined;
        out.push({ name, exeHint: exeMatch });
      }
    }
    return out;
  } catch (e) {
    log.warn("listInstalledApps failed", e);
    return [];
  }
}
