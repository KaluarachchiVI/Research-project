import execa from "execa";

/**
 * Collect this PID and all descendant PIDs on Windows (best-effort).
 */
export async function collectProcessTreePids(rootPid: number): Promise<Set<number>> {
  const out = new Set<number>([rootPid]);
  try {
    const script = `
$root = ${rootPid}
function Get-Descendants([int]$parentId) {
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$parentId" -ErrorAction SilentlyContinue | ForEach-Object {
    $_.ProcessId
    Get-Descendants $_.ProcessId
  }
}
@($root) + (Get-Descendants $root) | Sort-Object -Unique | ConvertTo-Json -Compress
`.trim();
    const { stdout } = await execa("powershell", ["-NoProfile", "-Command", script], {
      reject: false,
      timeout: 15_000,
    });
    if (!stdout?.trim()) return out;
    const parsed = JSON.parse(stdout) as unknown;
    const nums = Array.isArray(parsed) ? parsed : [parsed];
    for (const n of nums) {
      const pid = Number(n);
      if (Number.isFinite(pid) && pid > 0) out.add(pid);
    }
  } catch {
    /* keep root only */
  }
  return out;
}
