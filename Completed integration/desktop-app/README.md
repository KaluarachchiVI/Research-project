# IntentLock Desktop (Electron)

Wraps the **Intent-Lock Next.js UI** (`../intent-lock-frontend`) and starts the full **Completed integration** stack (CLE, Intent-Lock backend, adaptive scheduler, planner). During a session, optional **focus lockdown** (from `/focus-setup`) enforces:

- **Process allow-list** — non-allowed apps are terminated (work intervals only).
- **CONNECT proxy** on `127.0.0.1:8888` + **system proxy** — HTTPS host allow-list without installing a MITM CA (empty URL list = allow all hosts, process lock only).

## Prerequisites

From repo root under `Completed integration/`:

1. `cd launcher && python setup_cle.py`
2. `cd ../intent-lock-frontend && npm ci`
3. `cd ../planner-frontend && npm ci`

## Run (dev)

```powershell
cd desktop-app
npm install
npm run build
npm start
```

Or use [`start-desktop.ps1`](./start-desktop.ps1).

## Windows safety baseline

Process lockdown uses a **large built-in allow-list of Windows system/shell processes** ([`src/main/lockdown/windowsBaseline.ts`](src/main/lockdown/windowsBaseline.ts)): Explorer, DWM, session services, Defender, WMI, Search indexer, Task Manager, Settings hosts, WebView2 used by the shell, accessibility tools, etc. Those processes are **never killed** and **never trigger the foreground “snap back”** to Electron.

Your **focus-setup** choices add **extra** apps (IDE, browser, Spotify, …) and optional **URL hostnames** for the CONNECT proxy. Anything **not** in the Windows baseline and **not** in your list can still be terminated during **work** intervals—so keep recovery tools (e.g. Task Manager) in the baseline; we already include `taskmgr.exe` and `mmc.exe`.

## Flow

1. Desktop starts all services, waits for health checks, opens `http://localhost:3000`.
2. User configures session on the landing page, then **Start** → `/focus-setup` (desktop only) to pick allowed apps and URL hostnames.
3. After submit, lockdown starts; user returns to `/` with autostart to begin the scheduler session.
4. **Break** vs **work** phases sync with the dashboard (including manual work/break toggle).
5. Ending the session or **impulsive exit** runs `lockdown.stop()` and restores the system proxy.

## Build installer

```powershell
npm run package
```

Output under `release/`. Bundling embedded Python/Node is **not** included in v1 — targets must exist on disk as above.
