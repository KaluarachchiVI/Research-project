# Test IntentLock Desktop in Windows Sandbox (Windows Pro)

Sandbox is a **throwaway Windows desktop**. When you close it, changes are gone—ideal for testing proxy + process lockdown.

## Going in and out

- **In:** Run **`Open-IntentLockSandbox.ps1`** (or double‑click your `.wsb` file). A **new window** opens — that is the Sandbox desktop (separate from your normal PC).
- **Out (pause):** **Minimize** the Sandbox window. Your host desktop is unchanged; the guest keeps running until you close it.
- **Out (end session):** **Close** the Sandbox window (**X**). The **guest VM is thrown away** (apps installed only inside Sandbox are gone). Files on your **host** — including the mapped **`Completed integration`** folder — are **not** deleted.

There is no separate “log out”; closing the window **ends** that Sandbox run.

## One-time on your real PC (host)

1. **Turn on Windows Sandbox**  
   Settings → *Apps* → *Optional features* → *More Windows features* → enable **Windows Sandbox**  
   Or (PowerShell **as Administrator**):

   ```powershell
   Enable-WindowsOptionalFeature -Online -FeatureName "Containers-DisposableClientVM" -All -NoRestart
   ```

   Reboot if Windows asks.

2. From **File Explorer**, go to:

   `Research-project\Completed integration\sandbox\`

3. **Open PowerShell yourself** (so the window stays open), then run:

   ```powershell
   cd "C:\Users\YOURNAME\Documents\GitHub\Research-project\Completed integration\sandbox"
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned   # only if scripts are blocked
   .\Open-IntentLockSandbox.ps1
   ```

   **Avoid** only double‑clicking the script: the window can close before you read errors. The script now **waits for Enter** at the end so you can read any message.

   If you prefer double‑click: right‑click `Open-IntentLockSandbox.ps1` → **Run with PowerShell** — you should still get **“Press Enter to close”** at the end.

   **Administrator:** Checking “is Sandbox enabled?” uses `Get-WindowsOptionalFeature -Online`, which **often needs Admin**. If you see yellow text about that, either run this script **once as Administrator**, or confirm Sandbox is already on under **Settings → Apps → Optional features → Windows Sandbox**, then run again (the script will still try to open Sandbox even when the check could not run).

The script writes a small `.wsb` file under `%TEMP%` and opens the Sandbox. Your **`Completed integration`** folder is mounted read‑write at **`C:\Work\Completed integration`** inside the guest.

## Using Cursor (or any IDE) while testing in Sandbox

- **Cursor runs on your real PC (the host), not inside the Sandbox VM.** The Sandbox is a separate Windows; it does not ship with Cursor.
- **Recommended workflow:** Open your repo in **Cursor on the host** (e.g. `...\Research-project\`). Edit under **`Completed integration\`** as usual. Those files are the **same** ones the guest sees at **`C:\Work\Completed integration\`** — saves sync across the mapping.
- **Run and test** the stack (`start-all.ps1 -Desktop`, browsers, focus lockdown) **inside the Sandbox** only.
- If you **must** edit inside the guest, install an editor there (e.g. **VS Code** via winget) or use Notepad — installing **Cursor inside Sandbox** is possible but not automated here.

| Where        | Edit code (Cursor) | Run IntentLock / lockdown tests |
|-------------|--------------------|----------------------------------|
| **Host**    | Yes                | Optional (less isolated)       |
| **Sandbox** | Only if you install an editor there | Yes (recommended)              |

## First time inside the Sandbox

**Auto-setup:** When the guest starts, Windows should run **`Sandbox-Setup.cmd`** (after a **25 second** wait so the mapped folder is ready), which then runs **`Sandbox-Setup.ps1`**.

If nothing happens:

1. In the guest, open **File Explorer** → go to **`C:\Work\Completed integration\sandbox\`**
2. Double‑click **`Sandbox-Setup.cmd`** (or run **`Sandbox-Setup.ps1`** with PowerShell).  
3. On your **host** (Cursor), open:
   - **`sandbox/Sandbox-Setup-launcher.log`** — output from the `.cmd` wrapper (includes the 25s wait).
   - **`sandbox/Sandbox-Setup-steps.log`** — **line-by-line progress** from `Sandbox-Setup.ps1` (download started/finished, installer exit codes, npm steps). If the launcher log looks “stuck” after *installing Python from python.org*, the installer is often still **downloading** (~25MB); check **steps** for the next line.

**Why auto-run sometimes fails:** Sandbox can start the logon command **before** the mapped drive is ready; the delay + `.cmd` wrapper fixes most cases. **UTF‑8 BOM** on older `.wsb` writers could also break parsing — the host script now writes the `.wsb` **without BOM**.

**`Sandbox-Setup.ps1`** (when it runs) will:

- Install **Node.js LTS** and **Python 3.12**: tries **winget** (including `...\WindowsApps\winget.exe` if not on PATH). If winget is missing, it **downloads the official Windows installers** (python.org + nodejs.org MSI) and runs them silently (needs internet; may take a few minutes).
- Run `setup_cle.py`, `npm ci` in both frontends, `npm install` + `npm run build` in `desktop-app`.

When it finishes, start the desktop app from the same window:

```powershell
cd C:\Work\Completed integration\launcher
powershell -ExecutionPolicy Bypass -File .\start-all.ps1 -Desktop
```

Or:

```powershell
cd C:\Work\Completed integration\desktop-app
npm start
```

## Notes

- **Internet** is on by default in Sandbox (winget / npm).
- If **winget** is missing in the guest, open **Microsoft Store** once, then retry, or install Python/Node from their installers manually into the sandbox.
- Your **host** profile is untouched; proxy/registry changes only affect the **guest**.
