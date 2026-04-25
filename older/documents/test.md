# Intent-Lock + Team Components — Integration Plan

This document describes **workflow**, **logic**, and **step-by-step implementation** for integrating your Intent-Lock component with the pulled-in components (Praboth CLE, Scheduler, Study Predictions).

---

## 1. Goals

- **Intent-Lock** uses **real** cognitive load from **Praboth CLE** (no simulation).
- One **integrated app** where: session UI + CLE dashboard + Intent-Lock overlay + (optional) scheduler/study predictions live together.
- Clear **data flow**: CLE → session page → Intent-Lock backend → overlay.
- **Port and URL strategy** so all backends and the frontend work together.

---

## 2. Component Inventory & Roles

| Component | Owner | Purpose | Key outputs | Key inputs |
|-----------|--------|---------|-------------|------------|
| **Intent-Lock** | You (andrew) | Predict impulsive vs genuine exit; apply gradual friction | `prediction`, `friction_level`, `requires_friction`, overlay UI | `session_minutes`, **`latent_mean`**, `session_id` |
| **Praboth CLE** | Praboth | Real-time cognitive load from keystroke/pointer | **`load`** (0–1), `load_state`, telemetry, EMA prompts | OS hooks (events), optional EMA responses |
| **Scheduler** | (External) | Work/break scheduling dashboard | N/A (iframe) | Cognitive load from CLE (separate integration) |
| **Study Predictions** | Yuvidu-style | Best study times, heatmaps, weekly | Predictions from backend on 5001 | API on port 5001 |

**Critical link:** Intent-Lock’s **`latent_mean`** (0–1) must come from CLE’s **`load`** in the integrated app.

---

## 3. Target Architecture

### 3.1 Backend services (no change to existing code; run separately)

- **CLE (Praboth)** — `http://127.0.0.1:8000`  
  - `GET /estimate`, `GET /stream/state` (SSE), `POST /events`, `POST /ema/response`, etc.
- **Intent-Lock backend** — `http://127.0.0.1:8001` (use a different port to avoid conflict with CLE)  
  - `POST /predict-exit`, `POST /log-reason`

### 3.2 Integrated frontend (single Next.js app)

- **One app** (e.g. built from `praboth-newfx/web-ui` or a new merged app) that:
  - Subscribes to CLE at **8000** for real-time **`load`** (and optionally `load_state`, telemetry).
  - Sends **`latent_mean` = CLE `load`** to Intent-Lock at **8001** on “End Session”.
  - Renders your **IntentLockOverlay** when `requires_friction === true`.
  - Can still show CLE dashboard, scheduler iframe, study predictions, etc., on the same or other routes.

### 3.3 High-level data flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     INTEGRATED FRONTEND (Next.js)                           │
│                                                                             │
│  ┌──────────────────┐     ┌─────────────────────────────────────────────┐  │
│  │ CLE stream/hook  │     │ Session page (study / scheduler view)         │  │
│  │ (SSE or polling  │────▶│ - session_minutes (local timer)               │  │
│  │  to :8000)       │     │ - latent_mean = CLE load (0–1)               │  │
│  └──────────────────┘     │ - session_id                                 │  │
│           │               │ - "End Session" button                        │  │
│           │               └─────────────────────┬─────────────────────────┘  │
│           │                                     │                           │
│           │                     POST /predict-exit (session_minutes,        │
│           │                      latent_mean, session_id)                   │
│           │                                     ▼                           │
│           │               ┌─────────────────────────────────────────────┐  │
│           │               │ Intent-Lock backend (:8001)                  │  │
│           │               │ → prediction, friction_level,                │  │
│           │               │   requires_friction, exit_event_id            │  │
│           │               └─────────────────────┬─────────────────────────┘  │
│           │                                     │                           │
│           │                     If requires_friction → show overlay         │
│           │                                     ▼                           │
│           │               ┌─────────────────────────────────────────────┐  │
│           │               │ IntentLockOverlay (your component)            │  │
│           │               │ - Level 0/1/2, reason, countdown             │  │
│           │               │ - POST /log-reason to :8001 when needed       │  │
│           │               └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

  CLE backend (:8000)                    Intent-Lock backend (:8001)
  - /estimate, /stream/state             - /predict-exit, /log-reason
  - provides load (0–1)                  - consumes latent_mean (= load)
```

---

## 4. Workflow & Logic

### 4.1 Session lifecycle (integrated)

1. **User opens integrated app**  
   - App connects to CLE at 8000 (SSE or polling).  
   - User starts a “study session” (your existing start/session state).

2. **During session**  
   - **session_minutes**: from your existing timer (seconds / 60).  
   - **latent_mean**: from CLE’s latest **`load`** (0–1), updated every time the CLE stream/hook delivers a new estimate (e.g. every 15s hop or on every SSE message).  
   - **session_id**: same as today (e.g. `session_${Date.now()}`), unchanged.

3. **User clicks “End Session”**  
   - Frontend calls Intent-Lock:  
     `POST http://127.0.0.1:8001/predict-exit`  
     with `{ session_minutes, latent_mean: <CLE load>, session_id }`.  
   - Intent-Lock backend returns `prediction`, `friction_level`, `requires_friction`, `message`, `exit_event_id`.

4. **If `requires_friction === false`**  
   - Genuine exit: show your existing “Exit allowed” feedback and reset session (no overlay).

5. **If `requires_friction === true`**  
   - Open **IntentLockOverlay** with `frictionLevel`, `message`, `exitEventId`, and `backendUrl: "http://127.0.0.1:8001"`.  
   - User chooses “Continue Studying” or “Exit Anyway” (level 0), or reason (level 1), or countdown (level 2).  
   - On “Save & Exit” (level 1), frontend calls `POST :8001/log-reason` with `exit_event_id`, `reason`, optional `custom_text`.  
   - On exit path, close overlay and reset session as you do now.

No change to **Intent-Lock backend logic** (it already uses `latent_mean` and `session_minutes`); only the **source of `latent_mean`** changes (CLE instead of simulation).

### 4.2 Fallback when CLE is unavailable

- If the integrated app cannot get a value from CLE (e.g. CLE not running, stream disconnected):
  - **Fallback:** use a default `latent_mean` (e.g. `0.5`) or last-known value so Intent-Lock still receives a number.  
- Optional: show a small “Cognitive load: from sensor” vs “Cognitive load: default” so the user knows the source.

### 4.3 Port and URL summary

| Service | Port | Env (suggested) | Used by |
|---------|------|------------------|---------|
| CLE | 8000 | `NEXT_PUBLIC_CLE_API_BASE` | CLE dashboard, stream, **source of load** |
| Intent-Lock | 8001 | `NEXT_PUBLIC_INTENTLOCK_API_BASE` | predict-exit, log-reason, overlay |

Use env vars in the integrated app so you can switch URLs per environment without code changes.

---

## 5. Step-by-Step Implementation Plan

### Phase 1: Prepare backends and URLs

**1.1 Intent-Lock backend on 8001**

- In the repo where Intent-Lock backend runs (e.g. `andrew/intentlock-backend`), run it on port **8001** when working in “integrated” mode:
  - e.g. `uvicorn main:app --host 127.0.0.1 --port 8001`
- Optionally add a small README or script (e.g. `run_integrated.bat` / `run_integrated.sh`) that starts uvicorn on 8001 so the team has a single command.

**1.2 CLE backend on 8000**

- Keep CLE (Praboth) as-is on **8000** (default in their README / `NEXT_PUBLIC_API_BASE`).
- No code change required; only the integrated frontend must use 8000 for CLE and 8001 for Intent-Lock.

**1.3 Env in integrated frontend**

- In the **integrated** Next.js app, define:
  - `NEXT_PUBLIC_CLE_API_BASE=http://127.0.0.1:8000`
  - `NEXT_PUBLIC_INTENTLOCK_API_BASE=http://127.0.0.1:8001`
- Use these in code (see below); keep `.env.local.example` updated.

---

### Phase 2: Add Intent-Lock to the integrated app

**2.1 Copy or mount your UI components**

- Copy into the integrated app (or reference from your package/workspace):
  - `IntentLockOverlay.tsx` (and any local styles if you extract them later).
- Ensure the integrated app’s layout or session page can import the overlay.

**2.2 Session page that uses CLE + Intent-Lock**

- **Option A – New “Study session” page in the integrated app**  
  - Create a page (e.g. `/study-session` or reuse the existing “scheduler” page concept) that:
    - Uses **CLE** for real-time load (see Phase 3).
    - Implements your **session state**: `sessionId`, `sessionStartTime`, `sessionMinutes`, timer, pause, “Start Session” / “End Session”.
    - On “End Session”, calls Intent-Lock with `latent_mean` from CLE and shows IntentLockOverlay when needed.
  - This page can sit alongside the existing CLE dashboard (e.g. Home at `/`, Console at `/console`).

- **Option B – Extend existing CLE dashboard page**  
  - On the same page that already shows EstimateCard / RuntimeSnapshot, add:
    - A “Study session” block: timer, Start/End Session, and the same “End Session” → Intent-Lock + overlay flow.
    - `latent_mean` = `estimate.load` from the existing CLE stream (same page already has it).

Choose one option and stick to it so the workflow is clear for users.

**2.3 Wire overlay to Intent-Lock backend URL**

- Overlay already accepts `backendUrl`. In the integrated app, pass:
  - `backendUrl={process.env.NEXT_PUBLIC_INTENTLOCK_API_BASE ?? "http://127.0.0.1:8001"}`
- So all `predict-exit` and `log-reason` calls from the overlay (or from the page) go to 8001.

---

### Phase 3: Connect CLE load to Intent-Lock (core logic)

**3.1 Get CLE `load` in the session page**

- **If using SSE (recommended):**  
  - Use the same pattern as `praboth-newfx`: subscribe to `GET ${CLE_BASE}/stream/state`.  
  - On each message, read `payload.estimate.load` (0–1) and store it in React state, e.g. `cognitiveLoad` or `latentMean`.  
  - Use that value when calling Intent-Lock.

- **If using polling:**  
  - Periodically call `GET ${CLE_BASE}/estimate`, read `load`, and set the same state.

**3.2 Use CLE load as `latent_mean`**

- When the user clicks “End Session”:
  1. Read current `session_minutes` (from your timer).
  2. Read current cognitive load from state: `latent_mean = estimate.load` (or fallback to `0.5` if no estimate yet).
  3. Call:
     ```ts
     fetch(`${INTENTLOCK_BASE}/predict-exit`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         session_minutes: sessionMinutes || 1,
         latent_mean: latentMean,  // from CLE
         session_id: sessionId,
       }),
     })
     ```
  4. From the response, set `requires_friction`, `friction_level`, `message`, `exit_event_id` and either show the overlay or allow immediate exit.

No change to Intent-Lock backend: it already expects `latent_mean` and `session_minutes`; you only swap the source of `latent_mean` from simulation to CLE.

**3.3 Optional: show “Cognitive load: live” vs “default”**

- If `estimate` is null (CLE disconnected), use a fallback (e.g. `0.5`) and optionally show a short message: “Cognitive load from sensor” vs “Cognitive load: default (sensor unavailable)”.

---

### Phase 4: Optional integrations (scheduler, study predictions)

**4.1 Scheduler**

- The scheduler is an iframe to `http://127.0.0.1:5000/static/dashboard.html`.  
- In the integrated app, keep a route (e.g. `/scheduler`) that renders that iframe.  
- No direct data exchange with Intent-Lock is required; the scheduler may have its own integration with CLE (separate from this plan).

**4.2 Study Predictions**

- Study Predictions (Yuvidu-style) call a backend on **5001** (`/predictall`, `/hourly-intensity`, `/next-best-study-window`, etc.).  
- In the integrated app, keep a route (e.g. `/study-predictions`) that uses those APIs and existing components (Heatmap, WeeklyPredictions, StudyWindow).  
- Intent-Lock does not need to know about 5001; only the session page needs CLE (8000) and Intent-Lock (8001).

---

### Phase 5: Testing and verification

**5.1 Backends**

- Start CLE on 8000 (and OS hooks if needed).  
- Start Intent-Lock on 8001.  
- Confirm:
  - `GET http://127.0.0.1:8000/estimate` returns `load`.  
  - `POST http://127.0.0.1:8001/predict-exit` with `{ "session_minutes": 20, "latent_mean": 0.8, "session_id": "test" }` returns `requires_friction` and `friction_level` (e.g. impulsive, level 0).

**5.2 Integrated frontend**

- In the session page:
  - Start session, wait until CLE has sent at least one estimate (so `load` is set).  
  - Click “End Session”.  
  - Verify:
    - Request to 8001 includes `latent_mean` equal to CLE’s last `load`.  
    - For clearly “impulsive” conditions (e.g. high load, short session), overlay appears with correct level.  
    - For “genuine” conditions (e.g. low load, longer session), exit is allowed without overlay.  
  - At friction level 1, submit a reason and confirm `POST :8001/log-reason` is sent and overlay closes.

**5.3 Fallback**

- Stop CLE (or disconnect stream).  
- Trigger “End Session” and confirm the app still works (e.g. uses default `latent_mean` and does not crash).

---

## 6. File / Code Checklist (integrated app)

- [ ] Env: `NEXT_PUBLIC_CLE_API_BASE`, `NEXT_PUBLIC_INTENTLOCK_API_BASE`.
- [ ] IntentLockOverlay present and imported; `backendUrl` set from env.
- [ ] Session page (or dashboard block) has: `sessionId`, `sessionMinutes`, timer, Start/End Session.
- [ ] CLE stream or polling sets `estimate.load` → state used as `latent_mean`.
- [ ] “End Session” calls `POST INTENTLOCK_BASE/predict-exit` with `session_minutes`, `latent_mean`, `session_id`.
- [ ] On `requires_friction === true`, open overlay with correct props; on `false`, show success and reset.
- [ ] Level 1: “Save & Exit” calls `POST INTENTLOCK_BASE/log-reason` with `exit_event_id`, `reason`, `custom_text`.
- [ ] Intent-Lock backend run on 8001 in integrated mode.

---

## 7. Summary

- **Workflow:** CLE provides **load** (0–1) → integrated session page keeps **session_minutes** and **session_id** → on “End Session”, page sends **latent_mean = load** to Intent-Lock backend (8001) → overlay shown when **requires_friction** is true.
- **Logic:** Intent-Lock’s existing behavior (impulsive vs genuine, friction 0/1/2, log-reason) stays the same; only the **source of `latent_mean`** becomes CLE’s real-time **`load`**.
- **Ports:** CLE 8000, Intent-Lock 8001; frontend uses env for both bases.
- **Phases:** (1) Backends and URLs, (2) Add overlay and session UI to integrated app, (3) Connect CLE load to Intent-Lock, (4) Optional scheduler/predictions, (5) Test and fallback.

Once this is in place, your component is integrated with the others with a clear, maintainable workflow and logic.
