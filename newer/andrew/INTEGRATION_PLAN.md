# Intent-Lock + Team Components — Integration Plan (Re-evaluated)

This document is based on a **re-evaluation** of your component (andrew) and the pulled-in components (praboth, praboth-newfx, yuvidu). It describes **verified** file paths, APIs, ports, **workflow**, **logic**, and **step-by-step implementation**.

---

## Simple process flow (for everyone)

This section explains in plain language **what we take from other components**, **how we use it in our component**, and **the flow** so that anyone (e.g. new team members or non-developers) can follow.

### What each component does in one sentence

| Component | What it does |
|-----------|----------------|
| **Praboth (CLE)** | Measures **how mentally loaded** the user is in real time (from typing/mouse), and gives a number between 0 and 1. |
| **Yuvidu** | Suggests **when** is the best time to study (morning/afternoon/evening/night) and the best study windows. |
| **Scheduler** | Shows a work/break schedule dashboard (separate app in an iframe). |
| **Our component (Intent-Lock)** | When the user tries to **exit a study session**, decides if it’s a **genuine** exit (e.g. done) or **impulsive** (e.g. distracted), and adds a small “speed bump” (reminder, reason, or short countdown) only for impulsive exits. |

### What metrics we take from other components

We only use **one** metric from another component to integrate with Intent-Lock:

| From | Metric we use | What it means |
|------|----------------|----------------|
| **Praboth (CLE)** | **Cognitive load (a number 0–1)** | How mentally loaded the user is *right now*. High (e.g. 0.7–1) = stressed or overloaded; low (e.g. 0–0.3) = calm or focused. We use this as **“latent_mean”** inside our component. |

We **do not** use any metrics from Yuvidu or the Scheduler for Intent-Lock. Those components can live on the same app/screen, but Intent-Lock’s decision (genuine vs impulsive exit) only needs:

- How long the session has been (**session time**, we measure this ourselves).
- How mentally loaded the user is **right now** (we take this **from Praboth**).

### How we integrate our component using that metric

1. **We get the “cognitive load” number from Praboth**  
   - Praboth’s system continuously estimates load (0–1) from keyboard/mouse.  
   - Our integrated app **subscribes** to that stream (or asks for the latest value when the user clicks “End Session”).  
   - We treat that number as **“latent_mean”** — the same input our Intent-Lock model already expects.

2. **We keep our own session info**  
   - We still track **how long** the current study session has been (e.g. 15 minutes, 45 minutes).  
   - We still use a **session id** so we can count “how many times this session the user tried to exit impulsively.”

3. **When the user clicks “End Session”**  
   - We send to **our** backend:  
     - **Session length** (we measured it).  
     - **Cognitive load** (we got it from Praboth — that’s the only metric we take from others).  
     - **Session id** (we generated it).  
   - Our backend (Intent-Lock) already knows how to use these three things to decide: “genuine exit” (no speed bump) or “impulsive exit” (show reminder / ask reason / countdown).

4. **We show our overlay only when needed**  
   - If the decision is **genuine** → we let the user exit right away (no popup).  
   - If the decision is **impulsive** → we show our **Intent-Lock overlay** (reminder, or “please pick a reason,” or short countdown).  
   - So: **we use Praboth’s one number (cognitive load) to make our decision better** — instead of guessing or simulating that number, we use the real one from their system.

### Flow in one picture (plain language)

```
  PRABOTH (their component)                OUR COMPONENT (Intent-Lock)
  ─────────────────────────                ───────────────────────────

  Keyboard / mouse activity
           │
           ▼
  “Cognitive load” (0–1)  ──────────────►  We take this number
  (updated every ~15 sec)                     and call it “latent_mean”
           │                                          │
           │                                          │
  (We don’t use Yuvidu or Scheduler                  │
   for the exit decision.)                           │
                                                     ▼
  User clicks “End Session”  ◄────────────  We also send:
                                            • Session length (we measured)
                                            • Session id (we generated)
                                                     │
                                                     ▼
                                            Our backend decides:
                                            • Genuine exit → exit allowed, no popup
                                            • Impulsive exit → show our overlay
                                              (reminder / reason / countdown)
```

### Summary in three bullets

1. **What we take from others:** One number from **Praboth** — **cognitive load (0–1)**. We use it as “latent_mean” when the user tries to end a session.  
2. **How we use it:** We send that number together with **session length** and **session id** to our Intent-Lock backend. The backend already uses these to decide “genuine” vs “impulsive” and whether to show the overlay.  
3. **Other components (Yuvidu, Scheduler):** We don’t use their metrics for the exit decision. They can still be on the same app for best-time-to-study and work/break schedule; integration with them is just “same app, different screens or sections.”

### Use the existing dashboard — we only add our overlay

**Their components already include a dashboard** that has everything we need:

- **Where it is:** `static/dashboard.html` — the **Adaptive Scheduler** dashboard. It is shown in the app via the Scheduler page (e.g. praboth’s `/scheduler` iframe pointing to `http://127.0.0.1:5000/static/dashboard.html`).
- **What it already has:**
  - **Session timer** (Current Timer, WORK SESSION / BREAK TIME)
  - **Start Time Block Session** (start/end time, task type, etc.)
  - **End Work** / **End Break** / **Pause** / **Resume** / **End Session**
  - **Cognitive Load (Praboth Real-time)** card — so it already shows (and can provide) the cognitive load value we need for Intent-Lock.

We **do not** build a new session page or duplicate the timer. We **only**:

1. **Add our overlay** — the Intent-Lock popup (reminder / reason / countdown) into that same dashboard (e.g. in `static/dashboard.html` or the app that serves it).
2. **Wire “End Session”** — when the user clicks **“End Session”**, before calling the existing “end session” API:
   - Call **our** Intent-Lock backend (`predict-exit`) with:
     - session length (from the **existing timer** / `sessionStartTime`),
     - cognitive load (from the **existing Cognitive Load card** or Praboth),
     - session id (from the **existing** `currentSessionId`).
   - If the response says **show friction** → **open our overlay** and only complete the session end when the user confirms (or after reason/countdown).
   - If **no friction** → proceed as today (call their end-session API and reset).

So: **the existing dashboard stays as is; we only add the overlay and the predict-exit check on “End Session.”**

We also **update our UI to match theirs** (same colours, card style, buttons, typography) so the Intent-Lock page and overlay look and feel like part of the same app.

---

## 1. Re-evaluation Summary

| Scope | What was verified |
|-------|-------------------|
| **Your component (andrew)** | `intentlock-backend/main.py`, `models/model.py`, `data/database.py`; `intentlock-frontend/app/page.tsx`, `components/IntentLockOverlay.tsx`. Backend: `POST /predict-exit`, `POST /log-reason`. Frontend: hardcoded `BACKEND_URL = "http://127.0.0.1:8000"`, simulated `latentMean`, session state, overlay props. |
| **Praboth CLE** | `praboth/cog_py_est/app.py`, `service.py`: `GET /estimate`, `GET /stream/state` (SSE), `latest_payload()` returns `load`, `load_state`, etc. `praboth/web-ui` and `praboth-newfx/web-ui`: `useEstimatorStream.ts` subscribes to stream, uses `estimate.load`; imports from `../../lib/api` (see caveat below). |
| **Praboth-newfx** | Same CLE backend shape; has `classifier.py`, `distraction.py`, `exporter.py` in addition to praboth. Web UI structure mirrors praboth. |
| **Yuvidu** | `yuvidu/backend/server.py` (FastAPI): `/`, `/predict`, `/predictall`, `/weekly-predictions`, `/hourly-intensity`, `/next-best-study-window`. `bandit_model.py`: LinUCB contextual bandit, CSV data, best time of day, weekly windows, 4-hour window. Frontend: `yuvidu/frontend/src/ui/App.tsx` — React, **all API calls to `http://localhost:5001`**. `yuvidu.md`: standalone backend runs on **8000**; in repo both praboth study-predictions and yuvidu App use **5001** for Yuvidu API. |
| **Scheduler** | `praboth/web-ui/app/scheduler/page.tsx`: iframe to `http://127.0.0.1:5000/static/dashboard.html`. |
| **Ports** | CLE: **8000**. Intent-Lock (your page): **8000** (conflict). Yuvidu integrated: **5001**. Yuvidu standalone (per yuvidu.md): 8000. Scheduler iframe: **5000**. |

**Caveat:** In both `praboth/web-ui` and `praboth-newfx/web-ui`, `app/hooks/useEstimatorStream.ts` and several other files import from `../../lib/api` and `../lib/format` (or `../../../lib/...`). A `lib/` folder was **not found** under either `web-ui` in the repo (it may exist on another branch or be generated). For integration you will need to either: (a) obtain or recreate `lib/api.ts` (EstimateResponse, TelemetryResponse, subscribeStateStream, fetchPendingPrompt) and `lib/format.ts` (Tone, formatSeconds, toneForLoadState), or (b) implement a minimal CLE client in the integrated app (e.g. `EventSource` for `GET /stream/state`, and type the payload from the backend response shape below).

---

## 2. Your Component (Intent-Lock) — Verified

### 2.1 Backend — `andrew/intentlock-backend/`

| File | Role |
|------|------|
| `main.py` | FastAPI app; CORS; `init_database()`, `IntentModel()` on startup. |
| `models/model.py` | `IntentModel`: Logistic Regression on `session_minutes`, `latent_mean`; predicts 0 (genuine) / 1 (impulsive). Loads `intent_model.joblib` or trains from DB/synthetic. |
| `data/database.py` | SQLite `intentlock.db`: `synthetic_training_data`, `exit_events`, `exit_reasons`. `insert_exit_event`, `count_impulsive_exits`, `insert_exit_reason`. |

**Endpoints (verified):**

- `GET /` — `{"message": "Intent-Lock Backend is running"}`  
- `POST /predict-exit`  
  - Body: `{ "session_minutes": float, "latent_mean": float, "session_id": str }`  
  - Returns: `{ "prediction": "impulsive"|"genuine", "friction_level": 0|1|2, "message": str, "exit_event_id": int, "requires_friction": bool }`  
- `POST /log-reason`  
  - Body: `{ "exit_event_id": int, "reason": str, "custom_text": optional str }`  
  - Returns: `{ "status": "saved", "message": "..." }`  

**Friction logic:** Impulsive + 0 prior → level 0; 1 prior → level 1; 2+ → level 2. Genuine → `requires_friction: false`.

### 2.2 Frontend — `andrew/intentlock-frontend/`

| File | Role |
|------|------|
| `app/page.tsx` | Main session UI. State: `sessionStartTime`, `sessionMinutes`, **`latentMean`** (currently simulated 0.3–0.8 every 5s), `sessionId`, timer, `overlayOpen`, `frictionLevel`, `overlayMessage`, `exitEventId`, `requiresFriction`. "End Session" → `handleExitAttempt()` → `POST BACKEND_URL/predict-exit`; if `requires_friction` → open overlay. **BACKEND_URL = "http://127.0.0.1:8000"** (hardcoded). |
| `components/IntentLockOverlay.tsx` | Props: `isOpen`, `frictionLevel`, `message`, `exitEventId`, `onContinue`, `onExit`, `onReasonSubmitted`, **`backendUrl`**. Level 0: Continue / Exit Anyway. Level 1: reason dropdown + optional custom text; "Save & Exit" → `POST backendUrl/log-reason`. Level 2: 3s countdown then exit. |

**Integration takeaway:** Replace simulated `latentMean` with CLE’s `load`; point `BACKEND_URL` (or env) to Intent-Lock backend on **8001** in integrated mode so it does not conflict with CLE on 8000.

---

## 3. Their Components — Verified

### 3.1 Praboth CLE (Cognitive Load Estimator)

**Backend:** `praboth/cog_py_est/` (or `praboth-newfx/cog_py_est/`)

- **Port:** Default **8000** (README, `.env.local.example`).  
- **Key endpoint for integration:**  
  - `GET /estimate` — Returns `latest_payload()`:  
    `{ "hop_index", "timestamp", "load", "variance", "ci95", "residual", "quality", "baseline_active", "load_state", "pending_prompt", "context_flags", "scheduler_state", "onboarding_state", "active_prompt_id" }`.  
  - `GET /stream/state` — SSE; each event is `data: { "telemetry": {...}, "estimate": <same shape as /estimate> }\n\n`.  
- **`load`:** Float 0–1 (Kalman posterior). **`load_state`:** Classified string (e.g. "low/medium/high cognitive load") from `_classify_load_state(load)` in service.

**Frontend:** `praboth/web-ui/app/` (or `praboth-newfx/web-ui/app/`)

- **useEstimatorStream** (`hooks/useEstimatorStream.ts`): Calls `subscribeStateStream(onMessage, onError)`. On each message, `payload.estimate` has `load`, `residual`; history is `{ t, load, residual }`. So **`estimate.load`** is the value to use as **latent_mean**.
- **Depends on** `lib/api` (and `lib/format`) — not found in repo; see caveat in §1.

### 3.2 Yuvidu (Study time predictions)

**Backend:** `yuvidu/backend/`

- **server.py:** FastAPI; **no port in code** — run with e.g. `uvicorn server:app --reload --port 5001`.  
- **Endpoints:**  
  - `GET /` — status  
  - `GET /predict` — `predict_context()` → best time of day  
  - `GET /predictall` — `predict_all_percentages()` → `best_time`, `percentages` (morning/afternoon/evening/night)  
  - `GET /weekly-predictions` — `predict_weekly_windows()`  
  - `GET /hourly-intensity` — `get_hourly_intensity()`  
  - `GET /next-best-study-window` — `predict_next_best_4hour_window()`  

**bandit_model.py:** LinUCB on CSV; context features (e.g. block_focus, keystroke_intervals_mean, microEMA, etc.); arms = morning/afternoon/evening/night.

**Frontend:** `yuvidu/frontend/src/ui/`

- **App.tsx:** React Router; **base URL `http://localhost:5001`** for all fetches (`/predictall`, `/weekly-predictions`, `/hourly-intensity`, `/next-best-study-window`).  
- **Components:** Heatmap, WeeklyPredictions, StudyWindow, Navigation, etc.

**Port convention:** In this repo, **Yuvidu backend = 5001** (praboth study-predictions page and yuvidu App both use 5001). Standalone run per `yuvidu.md` uses 8000.

### 3.3 Scheduler and existing session dashboard

- **praboth/web-ui/app/scheduler/page.tsx:** Iframe `src="http://127.0.0.1:5000/static/dashboard.html"`.  
- **static/dashboard.html** (Adaptive Scheduler dashboard, served on **5000**): This is the **existing dashboard** with session timer, Start Time Block Session, **End Session**, End Work/End Break, Pause/Resume, and a **Cognitive Load (Praboth Real-time)** card. It already has `sessionStartTime`, `currentSessionId`, and an `endSession()` that calls the backend’s time-block/end. **We only add our Intent-Lock overlay and wire “End Session” to predict-exit** (see Phase 2).  
- Separate app on **5000**; Intent-Lock integration is done inside this dashboard (overlay + predict-exit on End Session).

### 3.4 Study Predictions (Praboth UI for Yuvidu API)

- **praboth/web-ui/app/study-predictions/page.tsx:** Fetches from **5001** (`/predictall`, `/hourly-intensity`, `/weekly-predictions`, `/next-best-study-window`). Uses Heatmap, WeeklyPredictions, StudyWindow (praboth’s own copies under `study-predictions/components/`).

---

## 4. Port and URL Matrix (Verified)

| Service | Port | Used by | Notes |
|---------|------|---------|--------|
| **CLE (Praboth)** | **8000** | CLE web-ui, stream, Intent-Lock’s *source of load* | Default in praboth. |
| **Intent-Lock backend** | **8001** | Your overlay + session page (integrated) | Avoid conflict with CLE; your current page uses 8000. |
| **Yuvidu backend** | **5001** | Yuvidu App.tsx, praboth study-predictions page | Convention in repo. Standalone can be 8000. |
| **Scheduler dashboard** | **5000** | Iframe in praboth scheduler page | External/separate app. |

---

## 5. Target Architecture and Data Flow

- **CLE** (8000): Provides real-time **`load`** (0–1) via `GET /estimate` or `GET /stream/state` (SSE).  
- **Intent-Lock** (8001): Consumes **`latent_mean`** (= CLE `load`) and `session_minutes`, `session_id`; returns `requires_friction`, `friction_level`, etc.; overlay and log-reason call 8001.  
- **Integrated frontend:** One app (e.g. Next.js from praboth-newfx or merged) that:  
  - Subscribes to CLE (8000) for `load`.  
  - Holds session state (session_minutes, session_id).  
  - On “End Session”, sends `latent_mean = load` to Intent-Lock (8001) and shows IntentLockOverlay when `requires_friction === true`.

(Data flow diagram from the previous plan remains valid; CLE → session page → Intent-Lock → overlay.)

---

## 6. Workflow and Logic (Unchanged, Now Verified Against Code)

1. **During session:** `session_minutes` from local timer; **`latent_mean`** from CLE’s latest **`estimate.load`** (or fallback 0.5 if CLE unavailable); `session_id` unchanged.  
2. **“End Session”:** `POST :8001/predict-exit` with `{ session_minutes, latent_mean, session_id }`.  
3. **Response:** If `requires_friction === false` → genuine exit (alert + reset). If `true` → open IntentLockOverlay with `backendUrl` = 8001.  
4. **Overlay:** Level 1 “Save & Exit” → `POST :8001/log-reason`; overlay receives `backendUrl` so it already targets 8001.  
5. **Intent-Lock backend logic:** No change; it only needs correct `latent_mean` and port 8001 in integrated mode.

---

## 7. Step-by-Step Implementation Plan (Updated)

### Phase 1: Backends and ports

- **1.1** Run **Intent-Lock** on **8001** in integrated mode:  
  - From `andrew/intentlock-backend`: `uvicorn main:app --host 127.0.0.1 --port 8001`.  
  - Optionally add a script or README note for “integrated” run.
- **1.2** Run **CLE** on **8000** (praboth or praboth-newfx: `cog_py_est`, per their README).  
- **1.3** Run **Yuvidu** on **5001** when using study predictions:  
  - From `yuvidu/backend`: `uvicorn server:app --reload --port 5001`.  
- **1.4** In the **integrated** Next.js app, set env:  
  - `NEXT_PUBLIC_CLE_API_BASE=http://127.0.0.1:8000`  
  - `NEXT_PUBLIC_INTENTLOCK_API_BASE=http://127.0.0.1:8001`  
  - (Optional) `NEXT_PUBLIC_YUVIDU_API_BASE=http://127.0.0.1:5001` for study predictions.

### Phase 2: Add Intent-Lock overlay to the existing dashboard (no new UI)

- **2.1** **Existing dashboard:** The **Adaptive Scheduler** dashboard (`static/dashboard.html`, served e.g. on port 5000) already has the session timer, Start Session, **End Session**, and a Cognitive Load (Praboth) card. The praboth Scheduler page shows it in an iframe. We do **not** add a new session page or duplicate this UI.  
- **2.2** **Add only the overlay:** Implement the Intent-Lock overlay in that dashboard (e.g. in `static/dashboard.html`): a full-screen modal with the same behaviour as `andrew/intentlock-frontend/components/IntentLockOverlay.tsx` (reminder / reason dropdown / countdown, and `POST .../log-reason` when needed). Use vanilla JS + DOM, or a small framework, so it works in that page.  
- **2.3** **Wire “End Session”:** In the existing `endSession()` (or the handler for the “End Session” button), **before** calling the Adaptive Scheduler’s end-session API:
  - Call `POST INTENTLOCK_BASE/predict-exit` with `session_minutes` (from `sessionStartTime` or timer state), `latent_mean` (from the dashboard’s cognitive load value — see Phase 3), and `session_id` (e.g. `currentSessionId`).
  - If `requires_friction === true` → show the Intent-Lock overlay and only call the existing end-session API (and reset UI) when the user completes the overlay (Continue / Exit Anyway / Save & Exit / countdown done).
  - If `requires_friction === false` → proceed as today (call their end-session API, show success, reset).
- **2.4** Use **Intent-Lock backend** at 8001 (env or config: `INTENTLOCK_API_BASE`).  
- **Summary:** Their dashboard already has the timer and End Session; we **only add the overlay** and the **predict-exit + overlay** logic on “End Session.”

### Phase 2b: Update our UI to match the existing dashboard

So that our page (and the overlay when shown) feels part of the same app, **update our UI** to use the same design system as the existing dashboard (`static/dashboard.html`). Align at least the following:

- **Colors and tokens** — Use the same palette. Their dashboard uses CSS variables, e.g.:
  - Background: `#020617` (body), `#0f172a` (--color-background)
  - Surface/cards: `rgba(15, 23, 42, 0.65)` (--color-surface), border `rgba(30, 41, 59, 0.65)` (--color-border)
  - Text: `#f8fafc` (primary), `#94a3b8` (muted)
  - Success: `#10b981`, info: `#06b6d4`, error/danger: `#f43f5e`, warning: `#f59e0b`
- **Cards** — Same card style: rounded corners (e.g. 1.25rem), subtle border, backdrop blur, same padding and hover (e.g. translateY(-1px), border hover).
- **Typography** — Same font stack (e.g. Inter), sizes (--text-xs through --text-3xl), and weights (e.g. 700/800 for headings).
- **Buttons** — Same button styles: pill shape (border-radius 999px), font-weight 700; primary (cyan gradient), success (green), danger (red), secondary (outline/surface).
- **Status badges** — Session Active/Inactive styled like their `.status-badge`, `.status-active` / `.status-inactive` (gradient pills).
- **Timer display** — Same treatment as their timer: large time (e.g. 3rem, color info), uppercase label, schedule info row (Work min / Break min).

**Where to apply:** In `andrew/intentlock-frontend` (e.g. `app/page.tsx` and `app/globals.css`), replace inline styles or local colours with the same tokens/classes as the dashboard. If the overlay is embedded in the dashboard HTML, style it with the same variables and button/card classes. Optionally extract a small shared CSS file or design-token list so both the dashboard and our frontend stay in sync.

---

### Phase 3: Connect CLE load to Intent-Lock

- **3.1** Get CLE **`load`** in the session page:  
  - **Option A:** If `lib/api` exists or you recreate it, use `useEstimatorStream` and set `latent_mean = estimate.load`.  
  - **Option B:** Implement a minimal client: `EventSource(NEXT_PUBLIC_CLE_API_BASE + "/stream/state")`, parse SSE `data` as JSON, read `payload.estimate.load` and set state.  
  - **Option C:** Poll `GET ${CLE_BASE}/estimate` and use `response.load`.  
- **3.2** On “End Session”, send current `session_minutes`, `latent_mean` (from CLE state or fallback 0.5), and `session_id` to `POST INTENTLOCK_BASE/predict-exit`.  
- **3.3** Optional: Show “Cognitive load: live” vs “default” when CLE is disconnected.

### Phase 4: Optional — Scheduler and Study Predictions

- **4.1** Scheduler: Keep a route (e.g. `/scheduler`) that renders the iframe to `http://127.0.0.1:5000/static/dashboard.html`.  
- **4.2** Study Predictions: Use Yuvidu backend on 5001; either embed praboth’s study-predictions page or yuvidu’s App/views at a route (e.g. `/study-predictions`). Intent-Lock does not call 5001; only the session flow uses CLE (8000) and Intent-Lock (8001).

### Phase 5: Testing

- **5.1** Backends: CLE 8000 returns `load`; Intent-Lock 8001 accepts `predict-exit` and returns `requires_friction`/`friction_level`.  
- **5.2** Integrated session: Start session, get at least one CLE estimate, click “End Session”; verify request to 8001 has `latent_mean` from CLE; verify overlay for impulsive and no overlay for genuine.  
- **5.3** Fallback: With CLE stopped, “End Session” still works with default `latent_mean`.

---

## 8. File and Code Checklist (Integrated App)

- [ ] **Existing dashboard** used: `static/dashboard.html` (Adaptive Scheduler) — has timer, End Session, cognitive load; no new session page.  
- [ ] Intent-Lock **overlay** added to that dashboard (same behaviour as IntentLockOverlay.tsx).  
- [ ] **Our UI updated to match theirs:** same colors (e.g. background #020617, surface, borders), card style (rounded, blur, hover), typography (Inter, sizes/weights), buttons (pill, primary/success/danger/secondary), status badges, timer display (Phase 2b).  
- [ ] Intent-Lock backend URL (8001) configured (e.g. `INTENTLOCK_API_BASE`).  
- [ ] “End Session” flow: call `POST INTENTLOCK_BASE/predict-exit` with `session_minutes`, `latent_mean` (from dashboard’s cognitive load), `session_id`; if `requires_friction` show overlay, else proceed with existing end-session.  
- [ ] On `requires_friction === true` open overlay; on `false` call existing end-session API and reset.  
- [ ] Level 1: “Save & Exit” → `POST INTENTLOCK_BASE/log-reason`.  
- [ ] Intent-Lock backend run on 8001.  
- [ ] Cognitive load for `latent_mean`: from dashboard’s Cognitive Load card (Praboth) or CLE API.

---

## 9. Summary

- **Your component:** Intent-Lock backend (`andrew/intentlock-backend`) and overlay (`andrew/intentlock-frontend`) are verified; only the **source of `latent_mean`** (CLE `load`) and **backend URL** (8001 in integrated mode) need wiring in the integrated app.  
- **Their components:** CLE (8000) provides `load` via `/estimate` and `/stream/state`; Yuvidu (5001) provides study-time predictions; Scheduler iframe uses 5000.  
- **Ports:** CLE 8000, Intent-Lock 8001, Yuvidu 5001, Scheduler 5000.  
- **Caveat:** Praboth web-ui’s `lib/api` and `lib/format` were not found in the repo; integration needs either those modules or a minimal CLE client.  
- **Logic:** Unchanged — Intent-Lock logic stays the same; integration is connecting CLE → session page → Intent-Lock (8001) and overlay.

This plan is aligned with the current codebase and can be implemented phase by phase as above.
