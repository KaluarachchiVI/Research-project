# IntentLock | Adaptive Scheduler – Setup and Run

This document describes how to set up and run the integrated system: **Cognitive Load Estimator (CLE)**, **Adaptive Scheduler API**, **Intent-Lock overlay**, and **Yuvidu** heatmap/planner.

---

## Prerequisites

- **Python 3.10+** (for CLE, Scheduler, Intent-Lock backend, Yuvidu backend)
- **Node.js 18+** and **npm** (for Intent-Lock frontend and Yuvidu frontend)
- **Windows** (PowerShell) for the one-command launcher; macOS/Linux can run each service manually (see below)

---

## Quick start (Windows, recommended)

From the **Research project** folder:

```powershell
cd product-app
.\start-all.ps1
```

This starts:

- **CLE** (Cognitive Load Estimator) on **http://127.0.0.1:8000**
- **Intent-Lock backend** on **http://127.0.0.1:8001**
- **Intent-Lock frontend** on **http://localhost:3000**

Open **http://localhost:3000** in your browser to use the Intent-Lock UI. The Scheduler API and Yuvidu are **not** started by default.

### Include Scheduler + Yuvidu (full stack)

To also run the Adaptive Scheduler API and Yuvidu (heatmap/planner):

```powershell
cd product-app
.\start-all.ps1 -WithServer
```

Then you get:

- Scheduler API at **http://127.0.0.1:5000**
- Yuvidu backend at **http://127.0.0.1:5001**
- Yuvidu frontend at **http://localhost:3001**

The Intent-Lock UI (port 3000) is configured to talk to the Scheduler at 5000 and can embed the Yuvidu planner (3001).

### Real keyboard and mouse input for CLE

By default, the CLE only receives **synthetic** events when you click “Simulate activity” in the UI. To feed it **real** keyboard and pointer data:

1. **One-time:** install CLE hooks (from repo root):

   ```powershell
   cd newer
   python setup_praboth.py
   ```

   Or manually in `newer\praboth`:

   ```powershell
   .\.venv\Scripts\pip.exe install ".[hooks]"
   ```

2. **Start with hooks:**

   ```powershell
   cd product-app
   .\start-all.ps1 -WithHooks
   ```

   A separate window runs `cle-os-hooks`, which sends keystroke timing and mouse movement to the CLE. On Windows, if keyboard events do not appear, try running the terminal **as Administrator**.

### All options combined

```powershell
cd product-app
.\start-all.ps1 -WithServer -WithHooks
```

---

## One-time setup (if something fails)

The launcher runs `newer/setup_praboth.py` to ensure the CLE (praboth) virtualenv exists. You may need to install dependencies for other parts manually.

### 1. CLE (Praboth) – `newer/praboth`

```powershell
cd newer
python setup_praboth.py
```

Or:

```powershell
cd newer\praboth
python -m venv .venv
.\.venv\Scripts\pip install -e .
# Optional, for real keyboard/mouse:
.\.venv\Scripts\pip install ".[hooks]"
```

### 2. Adaptive Scheduler API – `older`

```powershell
cd older
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
# Run (when using -WithServer or manually):
.\.venv\Scripts\python -m src.api.app
```

Uses SQLite at `older/adaptive_scheduler.db` by default.

### 3. Intent-Lock backend – `newer/andrew/intentlock-backend`

```powershell
cd newer\andrew\intentlock-backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
# Run:
.\.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

### 4. Intent-Lock frontend – `newer/andrew/intentlock-frontend`

```powershell
cd newer\andrew\intentlock-frontend
npm install
# Run (set env so it finds APIs):
$env:NEXT_PUBLIC_SCHEDULER_API_BASE='http://127.0.0.1:5000'
$env:NEXT_PUBLIC_CLE_API_BASE='http://127.0.0.1:8000'
$env:NEXT_PUBLIC_INTENTLOCK_API_BASE='http://127.0.0.1:8001'
$env:NEXT_PUBLIC_YUVIDU_PLANNER_URL='http://localhost:3001'
npm run dev
```

Then open **http://localhost:3000**.

### 5. Yuvidu backend – `newer/yuvidu/backend`

```powershell
cd newer\yuvidu\backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn server:app --host 127.0.0.1 --port 5001 --reload
```

### 6. Yuvidu frontend – `newer/yuvidu/frontend`

```powershell
cd newer\yuvidu\frontend
npm install
npm run dev
```

Runs on **http://localhost:3001** (or the port shown in the terminal).

---

## Ports and URLs

| Service              | URL                        | Purpose                          |
|----------------------|----------------------------|----------------------------------|
| Intent-Lock frontend | http://localhost:3000     | Main UI (timer, session, planner)|
| CLE                  | http://127.0.0.1:8000      | Cognitive load estimates         |
| Intent-Lock backend  | http://127.0.0.1:8001      | Exit-intent / friction logic     |
| Scheduler API        | http://127.0.0.1:5000      | Time-block sessions, metrics    |
| Yuvidu backend       | http://127.0.0.1:5001      | Heatmap / bandit API             |
| Yuvidu frontend      | http://localhost:3001      | Planner / heatmap UI             |

---

## Data flow (high level)

- **CLE** gets keyboard/mouse events (from hooks or “Simulate activity”) and exposes `GET /estimate` (cognitive load in [0, 1]).
- **Intent-Lock frontend** polls CLE, starts/ends time-block sessions via **Scheduler API** (`/api/time-block/start`, `/api/time-block/end`, `/api/time-block/end-interval`), and calls Intent-Lock backend for exit-intent (impulsive vs genuine, friction).
- **Scheduler API** stores sessions, actions, and rewards in `adaptive_scheduler.db` and exposes metrics.
- **Yuvidu** provides weekly/hourly visualizations; the Intent-Lock Planner tab can embed it in an iframe (http://localhost:3001).

---

## Troubleshooting

- **CLE not receiving events:** Use `-WithHooks` and ensure `cle-os-hooks` is running; on Windows, try running as Administrator.
- **“Session not found” or 500 from Scheduler:** Start the stack with `-WithServer` so the Scheduler API (5000) is running before you start a session from the UI.
- **Intent-Lock UI can’t reach Scheduler:** Set `NEXT_PUBLIC_SCHEDULER_API_BASE=http://127.0.0.1:5000` (or your server URL) before `npm run dev`.
- **Planner / Yuvidu blank:** Start Yuvidu frontend (3001) and optionally backend (5001); set `NEXT_PUBLIC_YUVIDU_PLANNER_URL=http://localhost:3001` for the iframe.

---

## Folder layout

- **product-app/** – Launcher (`start-all.ps1`), README, and config for the integrated stack.
- **older/** – Adaptive Scheduler (Flask API, bandit, metrics, DB).
- **newer/praboth/** – CLE service (cog-py-est).
- **newer/andrew/intentlock-backend/** – Intent-Lock exit-intent API.
- **newer/andrew/intentlock-frontend/** – Next.js Intent-Lock UI (timer, dashboard, summary, planner).
- **newer/yuvidu/backend/** – Yuvidu FastAPI.
- **newer/yuvidu/frontend/** – Yuvidu planner/heatmap UI.

For more detail on architecture and Phase 1 integration, see **product-app/README.md**.
