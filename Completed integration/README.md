# Completed integration

Self-contained copy of the **working integrated stack** (what `product-app/start-all.ps1 -WithServer -WithHooks` runs), reorganized with **component-based folder names** (no person/legacy top-level names inside this tree).

## Layout

| Folder | Role | Default port |
|--------|------|--------------|
| `cognitive-load-estimator/` | CLE (cog-py-est + optional OS hooks) | 8000 |
| `intent-lock-backend/` | Intent-Lock FastAPI | 8001 |
| `intent-lock-frontend/` | Intent-Lock Next.js UI | 3000 |
| `adaptive-scheduler/` | Adaptive Scheduler Flask API + bandit | 5000 |
| `planner-backend/` | Planner / heatmap FastAPI | 5001 |
| `planner-frontend/` | Planner Vite/React UI | 5123 |
| `launcher/` | `start-all.ps1`, `setup_cle.py`, launcher docs | — |
| `desktop-app/` | Electron shell: starts all services, focus lockdown, `/focus-setup` | — |

## Quick start

```powershell
cd launcher
python .\setup_cle.py
powershell -ExecutionPolicy Bypass -File .\start-all.ps1 -WithServer -WithHooks
```

- **Without** `-WithServer`: CLE + Intent-Lock only (ports 8000, 8001, 3000).
- **Without** `-WithHooks`: no OS keyboard/mouse stream to CLE (use UI “Simulate activity” or install hooks later).

First run of the Node apps requires `npm install` in `intent-lock-frontend/` and (if using `-WithServer`) in `planner-frontend/` unless you already installed in a copy—the launcher does **not** run `npm install` automatically.

### Run as desktop app (Electron)

After the same `npm ci` / `setup_cle.py` prerequisites:

```powershell
cd launcher
powershell -ExecutionPolicy Bypass -File .\start-all.ps1 -Desktop
```

This launches [`desktop-app/start-desktop.ps1`](desktop-app/start-desktop.ps1), which builds and runs the Electron app. The app starts all six services internally, then opens the Intent-Lock UI. In desktop mode, **Start session** sends you to **`/focus-setup`** to choose allowed apps and URL hostnames before lockdown begins.

## Smoke check (HTTP 200)

After services are up, verify (adjust host if needed):

| URL |
|-----|
| `http://localhost:3000` |
| `http://127.0.0.1:8000/docs` or root |
| `http://127.0.0.1:8001/docs` |
| `http://127.0.0.1:5000` |
| `http://127.0.0.1:5001/docs` |
| `http://localhost:5123` |

## Historical name mapping (main repo → this tree)

| Old location (main repo) | This folder |
|---------------------------|-------------|
| `newer/praboth/` | `cognitive-load-estimator/` |
| `newer/andrew/intentlock-backend/` | `intent-lock-backend/` |
| `newer/andrew/intentlock-frontend/` | `intent-lock-frontend/` |
| `older/` (excluding nested duplicate trees) | `adaptive-scheduler/` |
| `yuvidu/backend/` | `planner-backend/` |
| `yuvidu/frontend/` | `planner-frontend/` |
| `product-app/start-all.ps1` + `newer/setup_praboth.py` | `launcher/start-all.ps1` + `launcher/setup_cle.py` |

## What was excluded from copy

Heavy or regenerable artifacts are omitted: `.venv/`, `node_modules/`, `.next/`, `build/`, `__pycache__/`, `*.egg-info/`, `tsconfig.tsbuildinfo`. The CLE `web-ui/` subtree was omitted (not used by this launcher). Stale nested copies under `older/` (`praboth*`, `yuvidu/`) were not copied into `adaptive-scheduler/`.

SQLite databases present at copy time (**e.g.** `adaptive_scheduler.db`, `intentlock.db`, CLE `data/state.db` if any) are kept under the new paths.

## Original trees

The main repository’s `newer/`, `older/`, `yuvidu/`, and `product-app/` folders are **unchanged**; you can keep using them side by side with this integration folder.
