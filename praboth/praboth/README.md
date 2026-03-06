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

1.  **Backend Service** (Python 3.10+):

    ```powershell
    # In the root (praboth/)
    python -m venv .venv
    .\.venv\Scripts\activate
    pip install -e ".[hooks,tests,lint]" or pip install .
    # Run the service
    praboth-backend --config policy.toml
    # OR
    python -m backend.src.api.app
    ```

2.  **Frontend Dashboard** (Node.js 18+):

    ```powershell
    cd frontend
    npm install
    npm run dev
    # Dashboard available at http://localhost:3000
    ```

3.  **One-Shot Launch** (Windows):
    Use the helper script to launch backend, frontend, and optionally hooks:

    ```powershell
    # In root (praboth/)
    powershell -ExecutionPolicy Bypass -File start_all.ps1
    # OR with hooks
    powershell -ExecutionPolicy Bypass -File start_all.ps1 -WithHooks
    ```

## Features

- **Privacy-First**: All raw data stays on-device in local SQLite.
- **Adaptive Estimation**: Scalar Kalman filter with RLS integration for learning from user feedback.
- **Context Aware**: Monitored context (app usage, notifications) via OS hooks.
- **Gold Standard Codebase**: Typed Python, 3rd-person documentation, and Unit Test coverage.

## Configuration

- **Defaults**: Defined in `backend/src/core/config.py`.
- **Overrides**: Create a `policy.toml` (copy from `config/policy.example.toml` if available, or create new).
- **Key Sections**:
  - `[sensitivity]`: Profiles like `balanced`, `sensitive`.
  - `[permissions]`: `privacy_pause`, `context_blocklist`.

## API Endpoints (Localhost:8000)

- `GET /estimate`: Latest cognitive load estimate (state, posterior, residual).
- `POST /events`: Ingest raw events (keyboard, pointer, system) -> Buffer.
- `GET /telemetry`: Health metrics and privacy status.
- `GET /stream/state`: SSE stream for the frontend overlay.
- `POST /ema/response`: Submit feedback (`rating`: 1-7, `disposition`: completed/dismissed).

## Development

- **Tests**: `pytest backend/src/tests/`
- **Linting**: `ruff check backend/src`
- **Type Check**: `mypy backend/src`

## API Endpoints (Localhost:8000)

- `GET /estimate`: Latest cognitive load estimate and state.
- `GET /telemetry`: System health and metrics.
- `POST /ema/response`: Submit feedback for the estimator.
- `POST /events`: Ingest raw OS events (if using specialized hooks).
  What it implements (mapping to diagrams)

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
- `backend/src/services/`: Core logic (Kalman, SMA, Window Manager, EMA Scheduler).
- `backend/src/data/`: SQLite repositories and migrations.
- `frontend/`: Next.js application.
