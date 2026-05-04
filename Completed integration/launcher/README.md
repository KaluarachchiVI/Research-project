# Integrated stack launcher (Completed integration)

This folder runs the **same integrated product** as the main repo’s `product-app/start-all.ps1`, using **flat, component-named** folders under `Completed integration/`:

| Role | Folder |
| ------ | ------ |
| Cognitive Load Estimator (CLE) | `../cognitive-load-estimator/` |
| Intent-Lock backend | `../intent-lock-backend/` |
| Intent-Lock frontend | `../intent-lock-frontend/` |
| Adaptive Scheduler API | `../adaptive-scheduler/` |
| Planner bandit API (heatmap backend) | `../planner-backend/` |
| Planner UI (heatmap frontend) | `../planner-frontend/` |

## Services and default ports

- **Client**
  - CLE (cog-py-est FastAPI) – `http://127.0.0.1:8000`
  - Intent-Lock backend (FastAPI) – `http://127.0.0.1:8001`
  - Intent-Lock frontend (Next.js) – `http://localhost:3000`
- **Server (optional `-WithServer`)**
  - Adaptive Scheduler API (Flask) – `http://127.0.0.1:5000`
  - Planner bandit API (FastAPI) – `http://127.0.0.1:5001`
  - Planner frontend (Vite/React) – `http://localhost:5123`

## One-time CLE setup

From this directory:

```powershell
python .\setup_cle.py
```

This creates `../cognitive-load-estimator/.venv`, runs `pip install .` and `pip install ".[hooks]"` in that folder.

## Alternative CLE implementation: repo-root `praboth/` (opt-in)

The main repo also contains a newer, standalone Praboth tree at repo root (`../../praboth`).
If you want the completed integration stack to use that Praboth backend as the CLE service (still on port **8000**), run with `-UsePrabothCle`.

Notes:

- Default behavior is unchanged (still uses `../cognitive-load-estimator`).
- This mode starts only the **Praboth backend + optional hooks**. It does **not** start the Praboth dashboard frontend (to avoid port 3000 collisions with Intent-Lock).

Example:

```powershell
cd launcher
powershell -ExecutionPolicy Bypass -File .\start-all.ps1 -UsePrabothCle -WithHooks
```

## Running the stack (CLE with keyboard + pointer)

The CLE needs **real keyboard and pointer (mouse) events** for meaningful load estimates. Without `-WithHooks`, the Intent-Lock UI can still send **synthetic** activity from “Simulate activity.”

1. **Hooks** (optional, one-time): `setup_cle.py` installs `.[hooks]`. If hooks are missing:

   ```powershell
   cd ..\cognitive-load-estimator
   .\.venv\Scripts\pip.exe install ".[hooks]"
   ```

2. **Start everything** (CLE + Intent-Lock + optional scheduler + planner + optional hooks):

   ```powershell
   cd launcher
   powershell -ExecutionPolicy Bypass -File .\start-all.ps1 -WithServer -WithHooks
   ```

   This starts `cle-os-hooks` in a separate window (keystroke timing and mouse movement only—no key content) posting to `http://127.0.0.1:8000/events`.

3. **Hooks only (manual)** after CLE is up:

   ```powershell
   cd ..\cognitive-load-estimator
   .\.venv\Scripts\cle-os-hooks.exe --endpoint http://127.0.0.1:8000/events
   ```

On Windows, if keyboard events do not reach the CLE, try running the terminal or hook process **as Administrator**.

## High-level data/control flow

- OS hooks send keyboard/mouse events to **CLE** (`POST /events`).
- CLE exposes `GET /estimate`; consumed by Intent-Lock and other tools.
- Intent-Lock frontend polls CLE, calls Intent-Lock `/predict-exit`, and on session end calls the scheduler `/api/time-block/end`.
- Adaptive Scheduler manages time blocks, `adaptive_scheduler.db`, and metrics.
- Planner backend uses `SCHEDULER_API_BASE` (set by the launcher) to pull bandit training data; planner frontend can embed in Intent-Lock’s Planning tab.

See also `PHASE3_IDENTITY_AND_REWARD.md` in this folder.
