# Old vs New Yuvidu – Differences

## Where they live

| | **Old Yuvidu** | **New Yuvidu** (this app) |
|---|----------------|---------------------------|
| **Path** | `newer/yuvidu/` | `yuvidu/` (repo root) |
| **Frontend** | Next.js (App Router), port **3001** | Vite + React, port **5123** |
| **Backend** | FastAPI (uvicorn), port **5001** | FastAPI (uvicorn), port **5001** or **8000** (see yuvidu.md) |

## Tech stack

| | **Old** | **New** |
|---|--------|--------|
| **Framework** | Next.js 14+ (App Router, React Server Components possible) | Vite 7 + React 19 (SPA only) |
| **Routing** | File-based (`app/page.tsx`, `app/weekly/`, `app/study-window/`) | React Router (`/`, `/weekly`, `/study-window`, `/insights`) |
| **Styling** | Tailwind + CSS variables (in `globals.css`) | Plain CSS + same design tokens (no Tailwind) |
| **Electron** | No | Optional: `npm run dev` runs Vite + Electron; `npm run dev:react` runs only Vite (for iframe embed) |

## IntentLock integration

| | **Old** | **New** |
|---|--------|--------|
| **Planner iframe** | IntentLock pointed at **3001** by default | IntentLock points at **5123** by default |
| **User/session context** | Could pass `user_id` / `from_session` in URL; old app may not have used them everywhere | Reads `user_id` and `from_session` from URL; shows “User: … · After session: …” when embedded; all API base URLs configurable via `VITE_YUVIDU_API_BASE` |
| **API base** | Often hardcoded or env in Next.js | Env: `VITE_YUVIDU_API_BASE` (default `http://localhost:5001`) |

## Design (before vs after port)

- **Old:** Light theme aligned with IntentLock (warm stone background `#F2EFE9`, apricot primary `#E76F51`, white cards, soft shadows).
- **New (original):** Had a dark theme (slate/blue `#020617`, cyan accents).  
- **New (current):** The old **color design has been applied** to the new app: same light theme, warm stone, apricot primary, white cards, and blur gradient so it matches the old Yuvidu and IntentLock when embedded.

## Are the functionalities simulated?

**No.** In both old and new Yuvidu, the backend does **real** computation:

- **Contextual bandit:** Trained with **mabwiser** (LinUCB). New Yuvidu loads training data from the **Scheduler API** (real sessions/rewards) when available, else CSV; `predictall`, best-time percentages, and next-best-window use this trained model.
- **Weekly predictions:** Old backend uses day-of-week aggregation on the dataset; new backend uses **GradientBoostingRegressor** plus bandit expectations on the same dataset (real ML).
- **Hourly intensity / heatmap:** Built from session data (old: can use **live Scheduler API** per user; new: from the backend’s CSV dataset). No fake random data.
- **Insights (new only):** `generate_weekly_insights()` in the new backend computes real stats (weekly productivity change, best day, best time-of-day) from the dataset.

When the “the” Scheduler is running, the **new** Yuvidu backend uses the Scheduler API as the real data source for bandit training; if the API is unavailable or returns no data, it falls back to a CSV. All logic is real model inference and data analysis.

---

## Functional differences (backend & behavior)

| Feature | Old Yuvidu | New Yuvidu |
|--------|------------|------------|
| **Dashboard (predictall)** | Calls backend; real bandit percentages. | Same: calls backend; real bandit percentages. **(Fixed:** now uses `apiUrl("predictall")` so base URL is configurable.) |
| **Heatmap (hourly intensity)** | **User-scoped when possible:** frontend passes `user_id` from URL → backend calls `user_sessions.get_hourly_intensity_for_user(user_id)` which fetches **real sessions from Scheduler API** (port 5000). If no user or no sessions, falls back to dataset-based intensity. | **Same:** frontend passes `user_id` from URL (IntentLock embed) when present; backend uses `user_sessions.get_hourly_intensity_for_user(user_id)` and Scheduler API. Falls back to dataset if no user or no sessions. (Previously: no `user_id` on `/hourly-intensity`; used only `get_hourly_intensity()` from the backend’s CSV. Heatmap is **not** tied to the logged-in user’s real sessions. |
| **Weekly predictions** | Backend uses `predict_weekly_windows()`: day-of-week grouping and reward means on the dataset. | Backend uses `predict_weekly_windows_ml()`: **GradientBoostingRegressor** + bandit expectations (ML-based). Different algorithm, still real. |
| **Next best study window** | Same: `predict_next_best_4hour_window()` on backend. | Same: same endpoint and logic. |
| **Insights** | **Not present:** old backend has no `/insights`; old frontend has no Insights route. | **Present:** backend has `/insights` and `generate_weekly_insights()` (productivity vs last week, best day, best time-of-day). Real computation on the dataset. |
| **Training data** | `large_contextual_bandit_dataset_with_night.csv` | **Scheduler API** (`/api/bandit/training-data`); CSV fallback if API unavailable |

So in short:

- **New has one extra feature:** Insights page (real stats from dataset).
- **User-scoped heatmap:** both support it; when `user_id` is in the URL (e.g. from IntentLock), the heatmap uses that user's real sessions from the Scheduler API. (Previously: new was missing user-scoped heatmap from Scheduler sessions (old can show heatmap from the logged-in user’s real sessions when `user_id` is passed).
- **Weekly predictions:** different implementation (new uses ML), both real.

---

## Features (summary)

- **Shared:** Dashboard prediction, heatmap (dataset or user-sessions when `user_id` in URL), weekly predictions, next best study window. All use real backend logic.
- **New only:** Insights page; configurable API base and `user_id` / `from_session` in URL (context bar).

## Summary

- **Old Yuvidu:** Next.js app at 3001, same bandit/planner features, IntentLock-style light theme.
- **New Yuvidu:** Vite + React app at 5123, same features, **same light theme** (ported from old), plus IntentLock context (user_id, from_session) and configurable API for embedding.

The **new** app is the one connected to the IntentLock Planning tab and started by `product-app/start-all.ps1 -WithServer`. The **old** app in `newer/yuvidu/` is no longer used by the launcher or docs.
