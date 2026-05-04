# Praboth: Cognitive Load Estimator (CLE)

A privacy-first, on-device cognitive load estimation system that fuses keyboard, pointer, and system context metrics to adaptively measure user workload.

## Architecture

- **Backend** (`backend/`): Python-based microservice (FastAPI, SQLite, NumPy). Fuses features, runs the Kalman filter, and manages policies.
- **Frontend** (`frontend/`): Next.js dashboard for real-time visualization, telemetry, and EMA prompts.
- **AI Service** (`ai-service/`): Node.js/Genkit service for context categorization (LLM-based).

## Directory Structure

```text
praboth/
├── backend/            # Python CLE Service
│   ├── src/            # Core logic (api, core, data, services)
│   ├── apps/           # Entry points
│   └── tests/          # Unit tests
├── frontend/           # Next.js Web Dashboard
└── ai-service/         # Context Categorization Service
```

## Quick Start

### Option 1: One-Shot Launch (Recommended)

Use the helper scripts to launch all services in **separate terminals** (each visible and independently controllable):

#### Development Mode (with hot-reload)
```powershell
# In root (praboth/)
powershell -ExecutionPolicy Bypass -File start_all.ps1
```

**Launches in separate terminals:**
- **Backend API** (uvicorn, port 8000, auto-reload on code changes)
- **Frontend Web UI** (Next.js dev, port 3000)
- **AI Service** (Genkit, port 3400)

**With OS Hooks** (context monitoring):
```powershell
powershell -ExecutionPolicy Bypass -File start_all.ps1 -WithHooks
```

#### Production Mode (optimized)
```powershell
powershell -ExecutionPolicy Bypass -File start_prod.ps1
```

**Launches in separate terminals:**
- **Backend API** (production binary, port 8000, no reload)
- **Frontend Web UI** (Next.js production build, port 3000)
- **AI Service** (production binary, port 3400)

**Custom configuration:**
```powershell
powershell -ExecutionPolicy Bypass -File start_prod.ps1 `
  -PolicyFile config/policy.custom.toml `
  -BackendPort 9000 `
  -FrontendPort 8080
```

### Option 2: Manual Setup

1. **Backend Service** (Python 3.10+):

    ```powershell
    # In the root (praboth/)
    python -m venv .venv
    .\.venv\Scripts\activate
    pip install -e ".[hooks,tests,lint]"
    # Run the service
    praboth-backend --config policy.toml
    ```

2. **Frontend Dashboard** (Node.js 18+):

    ```powershell
    cd frontend
    npm install
    npm run dev
    ```

3. **AI Service** (Node.js 18+):

    ```powershell
    cd ai-service
    npm install
    npm run dev
    ```

## Access Services

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend UI** | http://localhost:3000 | Dashboard, EMA prompts, distraction history |
| **Backend API** | http://localhost:8000 | REST API endpoints |
| **API Docs** | http://localhost:8000/docs | Swagger UI documentation |
| **AI Service** | http://localhost:3400 | Context categorization (optional) |

## Production Gate

- Use `GO_LIVE_GATE.md` as the pass/fail release checklist.
- Use `config/policy.production.example.toml` as the production policy baseline.

## Features

- **Privacy-First**: All raw data stays on-device in local SQLite. No window titles, only app names and timestamps.
- **Adaptive Estimation**: Scalar Kalman filter with RLS integration for learning from user feedback.
- **Context Aware**: Monitored context (app usage, notifications) via OS hooks. LLM-backed or keyword-based classification.
- **Distraction Tracking**: Adaptive threshold-based detection of non-study periods (configurable 30-600 seconds).
- **EMA Integration**: Prompts user for feedback when confidence is high, with policy-based scheduling.
- **Gold Standard Codebase**: Typed Python, 3rd-person documentation, and Unit Test coverage.

## Configuration

- **Defaults**: Defined in `backend/src/core/config.py`.
- **Overrides**: Create a `policy.toml` (copy from `config/policy.example.toml` if available, or create new).
- **Key Sections**:
  - `[sensitivity]`: Profiles like `balanced`, `sensitive`.
  - `[permissions]`: `privacy_pause`, `context_blocklist`.

## API Endpoints And Behavior Notes

- `GET /estimate`: Latest cognitive load estimate (state, posterior, residual).
- `POST /events`: Ingest raw events (keyboard, pointer, system) -> Buffer.
- `GET /telemetry`: Health metrics and privacy status.
- `GET /stream/state`: SSE stream for the frontend overlay.
- `POST /ema/response`: Submit feedback (`rating`: 1-7, `disposition`: completed/dismissed).
- `GET /distractions`: Query distraction periods (app-based non-study detection with adaptive thresholds).
- `POST /export/request`: Request data export (requires review token in production).

## Development

- **Tests**: `pytest backend/src/tests/`
- **Linting**: `ruff check backend/src`
- **Type Check**: `mypy backend/src`
- **Production Gate**: `PRODUCTION_CHECKLIST.md`

## Services & Ports

| Service | Port | Purpose |
|---------|------|----------|
| Backend API | 8000 | Core estimation engine, event ingestion, state queries |
| Frontend UI | 3000 | Real-time dashboard, telemetry visualization, EMA prompts |
| AI Service | 3400 | Context categorization via Genkit/LLM (optional for advanced classification) |

## What It Implements (Data Pipeline)

- Permission guard drops disallowed sources or privacy-pause traffic (`OS Input Hooks -> Guard -> Buffer`).
- Event ring buffer with 60 s span / 15 s hop (`Sliding Window Manager` in the passive-sensing sequence).
- Keystroke/pointer feature fusion (IKI stats, error/backspace rate, pointer speed/accel, idle fraction) and quality scoring with simple imputation when an input channel is missing.
- Rolling normalization (EWMA mean/variance + Huber clipping) before estimation.
- Consent & policy guard loads blocklists, logs consent history, and wires retention pruning all the way to SQLite (via `Storage.prune_retention`).
- Cold-start calibrator streams residual diagnostics, persists a mean feature profile, and drives onboarding banners until the variance target is met.
- EMA fusion layer replays labelled windows into the estimator immediately (RLS update + Kalman assimilation) and emits residual/variance telemetry for the overlay and console/SSE feeds.
- Scalar Kalman filter + RLS adapter for observation weights; emits posterior, variance, and residual per hop.
- EMA scheduler paired with a policy actor/log that enforces DND/blocklists/privacy toggles and surfaces suppression decisions through `/policy/events`.
- Cold-start baseline: 5 minutes of passive collection, then an initial baseline prompt as shown in the cold-start sequence.
- Local-only SQLite persistence aligned with the ERD (sessions, events, feature windows, EMA prompts/responses, model snapshots, telemetry metrics). No network egress.

## File Map

- `backend/src/api/`: FastAPI routes.
- `backend/src/core/`: Configuration and Event definitions.
- `backend/src/services/`: Core logic (Kalman, Classifier, Window Manager, EMA Scheduler, **Distraction Tracker**).
- `backend/src/data/`: SQLite repositories and migrations.
- `frontend/`: Next.js application.
- `ai-service/`: Genkit context categorization service (optional, for advanced LLM-based classification).

## Distraction Tracking

Praboth includes an **adaptive distraction tracker** that monitors for non-study contexts:

### How It Works

1. **Context Classification**: Each app/window is classified as study-related or distraction.
   - **Simple mode** (default): Keyword matching (e.g., "YouTube" → distraction).
   - **LLM mode** (optional): Genkit-based semantic analysis via AI Service.

2. **Adaptive Threshold Learning**: The tracker learns user's break patterns.
   - Base: 180 seconds (3 minutes, configurable).
   - Adapts: Tracks history of all non-study durations.
   - Formula: `Threshold = Median(history) + 2×StdDev(history)`, clamped to [30s, 600s].

3. **Recording**: Non-study periods **exceeding threshold** are recorded with:
   - Start/end timestamps (ISO8601).
   - App name.
   - Duration (seconds).

4. **Privacy**: Only app names and timestamps stored. No window titles. Classification cache uses SHA256 hashing.

### Query Distraction History

```bash
# Get recent distraction periods
curl -H "X-API-Key: your-api-key" http://localhost:8000/distractions?limit=50

# Response
{
  "periods": [
    {
      "start_time": "2026-04-27T10:00:00Z",
      "end_time": "2026-04-27T10:05:30Z",
      "app_name": "youtube"
    },
    ...
  ]
}
```

### Configuration

Edit `policy.toml`:
```toml
[context]
classifier_provider = "simple"  # or "llm" for advanced classification
distraction_threshold_seconds = 180  # Adapt to your needs
poll_interval_seconds = 2.0
```
