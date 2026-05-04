# Appendices

## Appendix A — UI and Mockup Assets

- Checklist mockup reference: `25-26J-458-Students/6. CheckList Documents/CheckList set 1/checklist set 1.pdf`.
- Integrated web frontend snapshots to be inserted from running `:3000` UI.
- Suggested insertion order:
  1. Onboarding screen with consent toggle (`POST /consent`),
  2. Live session dashboard with sparklines, Pomodoro timer, and Intent-Lock status badge,
  3. Break recommendation dialog (Scheduler `GET /api/get-recommendation`),
  4. Chronotype intensity ribbon and weekly day cards (Yuvidu),
  5. Intent-Lock Level 0/1/2 modal flows.

## Appendix B — Example Micro-EMA Questionnaire

The implemented `PromptPanel.tsx` uses a 1–7 Likert scale rather than the 0–4 pre-print scale; a representative form is:

1. How mentally taxed do you feel right now? (1 = relaxed, 7 = overloaded)
2. How focused are you right now? (1 = unfocused, 7 = laser-focused)
3. Optional note: what is causing the current state? (free-text, ≤140 characters, never persisted as raw text in the CLE database tables)

**Prompting policy notes (matches `praboth/backend/src/services/ema.py`).**

- Trigger only when current variance ≥ 90th percentile of the rolling variance history.
- Gate on macro pause (≥ 15 s) or workstation focus switch (`SetWinEventHook`).
- Minimum 30-minute cadence (`min_seconds_between_prompts = 1800`).
- Suppress during high-intensity typing bursts and blocked contexts (`context_blocklist`).
- Suspend when `privacy_pause = True` or `consent_granted = False`.

## Appendix C — NASA-TLX Form Template

Standard NASA-TLX dimensions [@nasatlx1986]:

- Mental Demand
- Physical Demand
- Temporal Demand
- Performance
- Effort
- Frustration

Scoring: 0–100 scale per dimension with optional weighting pass after each selected session.

## Appendix D — Real Endpoint Inventory

This appendix replaces the earlier abstract API list with the actual endpoints exposed by each running service. All endpoints below are implemented in the source tree.

### D.1 CLE — `praboth/backend/`, FastAPI on port 8000

```http
POST   /events                       # Edge → CLE: ingest event batch
POST   /events/batch                 # Bulk variant
GET    /estimate                     # Latest (load, variance, ci95, residual, quality)
GET    /telemetry                    # Lightweight rolling metrics
POST   /ema/response                 # Submit micro-EMA value
POST   /ema/snooze                   # Snooze current prompt
GET    /stream/state                 # Server-Sent Events feed (live load + telemetry)
POST   /privacy                      # Toggle privacy pause
POST   /consent                      # Toggle consent
GET    /permissions                  # Read current consent / privacy / blocklist state
POST   /policy/events                # Forward foreground / context labels
POST   /distractions                 # Manual distraction marker
POST   /export/request               # Request reviewed aggregate export
GET    /export/{request_id}          # Status / download
GET    /healthz                      # Liveness / readiness
```

### D.2 Adaptive Scheduler — `older/`, Flask on port 5000

```http
POST   /api/start-session            # Begin session, return arm + interval
POST   /api/end-interval             # Reward and next arm
POST   /api/end-session              # Close session, persist metrics
GET    /api/get-recommendation       # Get current arm without consuming it
POST   /api/submit-feedback          # Forward EMA / quick-rating to bandit

# Production-style time-block flow (consumed by the Intent-Lock UI)
POST   /api/time-block/start
GET    /api/time-block/current
GET    /api/time-block/recommendation
GET    /api/time-block/suggestion
POST   /api/time-block/pause
POST   /api/time-block/resume
POST   /api/time-block/end-interval
POST   /api/time-block/end

GET    /api/metrics                  # Current session metrics
GET    /api/metrics/detailed         # Eight-metric harness output
GET    /api/bandit/training-data     # CSV-style export for Yuvidu
GET    /api/health
GET    /                             # Discovery JSON
```

### D.3 Intent-Lock — `newer/andrew/intentlock-backend/`, FastAPI on port 8001

```http
GET    /                             # Banner + version
GET    /health
POST   /predict-exit                 # {session_minutes, latent_mean, session_id}
                                     #  → {prediction, friction_level, message,
                                     #     exit_event_id, requires_friction}
POST   /log-reason                   # {exit_event_id, reason, custom_text?}
                                     #  → {status, message}
```

### D.4 Yuvidu — `yuvidu/backend/`, FastAPI on port 5001

```http
GET    /                             # Banner
GET    /predict                      # Best arm string
GET    /predictall                   # {best_time, percentages, status}
GET    /weekly-predictions           # ML-based 7-day view
GET    /weekly-predictionss          # Non-ML legacy view (typo route preserved)
GET    /hourly-intensity             # 24-hour intensity ribbon (?user_id=… optional)
GET    /next-best-study-window       # Next 4-hour window with confidence
GET    /insights                     # Textual insights cards
```

The proposal-style names `/heatmap`, `/recommend-time`, `/feedback`, `/chronotype-survey`, `/intent/predict`, `/intent/exit-event`, and `/intent/reason` are **not** implemented; the canonical names above replace them.

## Appendix E — Deployment Diagram and Notes

Deployment strategy source: project-root `deployment strategy.md` and the more detailed `25-26J-458-Students/6. CheckList Documents/CheckList set 3/Deployment Strategy Document .pdf` [@deploymentdoc2025].

- Hybrid edge–cloud architecture.
- Docker Compose for the MVP single-host deployment, with Nginx (or Traefik) as reverse proxy.
- Kubernetes for scale, with Horizontal Pod Autoscalers per service and managed PostgreSQL (or AWS RDS) replacing the per-service SQLite stores.
- Local OS-hooks client (`cle-os-hooks`) for low-level event collection, distributed as a standalone installer.

### E.1 Environment separation

- **Edge environment.** Event capture, local filtering, optional local SQLite cache.
- **Cloud / server environment.** API orchestration, web UI hosting, analytics aggregation.

### E.2 Operational considerations

- API gateway / reverse proxy for service routing.
- Persistent volumes or managed database for durability.
- Logging and monitoring for multi-service observability (Prometheus + Grafana suggested in the deployment document).
- Optional Redis layer for hot caches in the scheduler bandit and the Yuvidu prediction surfaces.

## Appendix F — Technology Stack Summary

| Layer | Stack |
|---|---|
| Frontend (CLE) | Next.js + React + SSE |
| Frontend (Scheduler dashboard) | HTML + JS (`older/static/dashboard.html`) |
| Frontend (Intent-Lock + integrated UI) | Next.js + React |
| Frontend (Yuvidu) | Vite + React (+ optional Electron) |
| APIs | FastAPI (CLE, Intent-Lock, Yuvidu) + Flask (Scheduler) |
| ML / Analytics | scikit-learn `LogisticRegression`, `GradientBoostingRegressor`; NumPy-based custom LinUCB / Thompson; `mabwiser` LinUCB |
| Storage | SQLite per service (extensible to PostgreSQL or AWS RDS) |
| Edge agent | Python 3.11 + `pynput` + `SetWinEventHook` (`cle-os-hooks` console script) |
| Deployment | Docker Compose (MVP) → Kubernetes (scale phase) |

## Appendix G — Evidence Traceability Matrix

| Chapter Section | Primary Artefact Source |
|---|---|
| Ch1 Literature & gaps | four proposal PDFs under `25-26J-458-Students/1. Project Proposal/Individual Reports/` |
| Ch2 CLE methodology | `praboth/cle_architecture.md`, `praboth/backend/src/` |
| Ch2 Scheduler methodology | `older/src/`, `older/config/config.py` |
| Ch2 Yuvidu methodology | `yuvidu/backend/`, `yuvidu/OLD-VS-NEW-YUVIDU.md` |
| Ch2 Intent-Lock methodology | `newer/andrew/intentlock-backend/`, `intentlock-frontend/` |
| Ch2 Deployment | project-root `deployment strategy.md` and the checklist set-3 deployment PDF |
| Ch3 Evaluation framing | proposal evaluation plans, `older/src/metrics/metrics_calculator.py`, `evaluate_model.py` |
| Appendix A UI | checklist set 1 mockup PDF |

## Appendix H — Baseline Definitions

- **Fixed baseline.** Pomodoro-style static intervals (25 / 5) [@cirillo2006].
- **Random baseline.** Interval selection uniformly sampled from the 16-arm `(work, break)` space.
- **Integrated adaptive policy.** Contextual recommendation informed by CLE + Yuvidu chronotype context + Intent-Lock signals.

## Appendix I — Example Session Log Schema (Scheduler)

| Field | Type | Description |
|---|---|---|
| `session_id` | string | Unique session identifier |
| `timestamp` | ISO-8601 | Event time |
| `load` | float | Estimated cognitive load (CLE) |
| `variance` | float | Model uncertainty (CLE) |
| `work_interval` | integer | Recommended work minutes |
| `break_duration` | integer | Recommended break minutes |
| `arm_idx` | integer | Selected bandit arm (0–15) |
| `reward` | float | Final reward in `[-1, 1]` |
| `r_progress` | float | Progress utility |
| `r_relief` | float | Relief utility |
| `intent_prediction` | string | `impulsive` or `genuine` (Intent-Lock) |
| `friction_level` | int | 0, 1, or 2 |
| `reason_tag` | string | Categorised exit reason (Level-1 reflection log) |

## Appendix J — Implementation–Plan Reconciliation

This appendix tabulates each major proposal claim against the current implementation, so that a reviewer can audit the dissertation against the running code.

**Table J.1 — Proposal claims vs implementation reality.**

| # | Proposal Claim | Implementation Reality | Future Work |
|---|---|---|---|
| 1 | CLE uses 30 s / 2 min windows | 60 s window, 15 s hop (`praboth/backend/src/core/config.py`) | Adaptive window length |
| 2 | CLE feature vector is 10-D | 14-D: 7 keyboard + 4 pointer + 3 system (`features.py`) | Add cross-app feature group |
| 3 | EMA prompt is residual-threshold | 90th-percentile variance + breakpoint gating + 30-minute cadence (`ema.py`) | Per-user threshold |
| 4 | Scheduler has `/recommend` and `/feedback` | Real names: `/api/get-recommendation`, `/api/submit-feedback`, plus the full `/api/time-block/*` family | API versioning / OpenAPI spec |
| 5 | Eight metrics planned | All eight implemented in `metrics_calculator.py` | Add per-arm confidence intervals |
| 6 | Yuvidu uses MEQ chronotype questionnaire | Time-of-day arms + `sleep_hours_prev_night` context | Implement MEQ + Bayesian per-user priors |
| 7 | Yuvidu shows hour × day heatmap | 24-hour single-row intensity ribbon + day cards | Two-dimensional surface |
| 8 | Intent-Lock uses LR + Decision Tree | `LogisticRegression` only (`models/model.py`) | Add DT with calibrated probabilities |
| 9 | Intent-Lock intercepts OS-wide app switches | In-app session-end interception only | OS-level interception agent |
| 10 | OS hooks use WebSocket | HTTP POST `/events` only (`os_hooks.py`) | Optional WebSocket transport |
| 11 | Yuvidu has automated tests | None present | Add pytest suite |
| 12 | Intent-Lock has separate `sessions` table | Not present (`exit_events`, `exit_reasons`, `synthetic_training_data` only) | Add session lifecycle table |
| 13 | `lib/schedulerClient.ts` referenced in earlier docs | Missing from current `intentlock-frontend/` snapshot | Restore client and reconcile |
| 14 | `praboth/backend/src/data/` package | Missing in current snapshot; canonical schema in legacy `praboth/build/lib/cog_py_est/storage.py` | Restore data package |
| 15 | `newer/yuvidu/` is the canonical Yuvidu tree | Canonical tree is root `yuvidu/` per `OLD-VS-NEW-YUVIDU.md` | Remove legacy tree |
