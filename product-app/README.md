## Product-grade Adaptive Scheduler Stack (Phase 1)

This folder describes how to run the **integrated product** composed of:

- Cognitive Load Estimator (**CLE**) – `newer/praboth` (cog-py-est)
- Adaptive Scheduler API – `older/src` (Flask + bandit + metrics)
- Yuvidu heatmap service – `newer/yuvidu/backend` + `newer/yuvidu/frontend`
- Intent-Lock overlay – `newer/andrew/intentlock-backend` + `newer/andrew/intentlock-frontend`

The target deployment for Phase 1 is **hybrid**:

- **Client machine (per user)** runs CLE and the Intent-Lock overlay.
- **Central server** runs the Adaptive Scheduler API and Yuvidu heatmap service.

### Services and default ports

- **Client**
  - CLE (cog-py-est FastAPI) – `http://127.0.0.1:8000`
  - Intent-Lock backend (FastAPI) – `http://127.0.0.1:8001`
  - Intent-Lock frontend (Next.js) – `http://127.0.0.1:3000`
- **Server**
  - Adaptive Scheduler API (Flask) – `http://SERVER_HOST:5000`
  - Yuvidu bandit API (FastAPI) – `http://SERVER_HOST:5001`
  - Yuvidu frontend (React SPA) – `http://SERVER_HOST:5123` (or 3001 in dev)

All services should be configurable via environment variables; see the env templates in `server/config` and `client/*/env`.

### Running the stack (CLE with keyboard + pointer)

The CLE needs **real keyboard and pointer (mouse) events** to estimate cognitive load. By default, `start-all.ps1` starts only the CLE HTTP service; the Intent-Lock UI then only sends **synthetic** keyboard events when you click “Simulate activity,” so you get no real typing or mouse data.

To feed the CLE with **real** keyboard and pointer input:

1. **Install hooks** (one-time): from repo root, run `python newer/setup_praboth.py` (it runs `pip install ".[hooks]"` in `newer/praboth`). Or manually:
   ```powershell
   cd newer\praboth
   .\.venv\Scripts\pip.exe install ".[hooks]"
   ```
2. **Start the stack with hooks**:
   ```powershell
   cd product-app
   powershell -ExecutionPolicy Bypass -File start-all.ps1 -WithHooks
   ```
   This starts the CLE OS hook daemon (`cle-os-hooks`) in a separate window, which captures keystroke timing and mouse movement (no key content) and POSTs them to `http://127.0.0.1:8000/events`.

3. **Optional (hooks only, manual)**: in a separate terminal after the CLE is running:
   ```powershell
   cd newer\praboth
   .\.venv\Scripts\cle-os-hooks.exe --endpoint http://127.0.0.1:8000/events
   ```

On Windows, if keyboard events are not appearing in the CLE, try running the terminal (or the hook process) **as Administrator**; global keyboard capture sometimes requires elevated permissions.

### High-level data/control flow

- OS hooks send keyboard/mouse events to **CLE** (`POST /events`).
- CLE produces real-time cognitive load estimates (`GET /estimate`), consumed by:
  - The Intent-Lock frontend (for exit-intent decisions).
  - The Adaptive Scheduler (via its own Praboth integration and metrics sync).
- The Intent-Lock frontend:
  - Polls `CLE /estimate` to obtain `load` in \[0, 1].
  - On “End Session”, calls `Intent-Lock /predict-exit` to classify exits as impulsive vs genuine and determine friction.
  - After friction completes, calls the **Scheduler API** `/api/time-block/end` with the scheduler `session_id` and optional Intent-Lock metadata.
- The Adaptive Scheduler:
  - Manages time-block sessions (`/api/time-block/*`), writes to `adaptive_scheduler.db`, and exposes metrics.
  - Optionally surfaces links or proxy endpoints to Yuvidu heatmaps for long-horizon planning.
- Yuvidu:
  - Provides weekly and hourly recommendation visualizations used in dashboards and the product UI.

### Folder layout (Phase 1)

- `server/`
  - `scheduler/` – wrappers and config to run `older/src/api/app.py` under a production WSGI/ASGI server.
  - `yuvidu/` – wrappers and config to run `newer/yuvidu/backend/server.py` and serve the Yuvidu frontend bundle.
  - `config/` – shared `.env.example` and `settings.yaml` describing ports, DB URIs, and CLE base URLs.
- `client/`
  - `cle/` – instructions and env for running `cog-py-est` on the client.
  - `intent-lock/` – wrappers and env for running Andrew’s Intent-Lock backend and frontend.
  - `launchers/` – OS-specific scripts to start CLE + Intent-Lock together.
- `shared/`
  - Cross-service types (e.g., `SessionId` format) and optional small client libraries for scheduler/CLE APIs.

For Phase 1 we **reuse** the existing codebases in `older/` and `newer/` and only add thin wrappers and configuration here. No large codebases are duplicated into `product-app/`.

