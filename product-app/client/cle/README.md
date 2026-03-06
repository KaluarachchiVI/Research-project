## Client CLE Service (cog-py-est)

This folder documents how to run the **Cognitive Load Estimator (CLE)** on a client machine.

### Service

- Implementation: `newer/praboth-newfx/cog_py_est`
- Entrypoint: `cog_py_est.app:create_app`
- Default port: `8000`

The CLE service exposes:

- `POST /events` – ingest keyboard/mouse/context events.
- `GET /estimate` – latest cognitive load estimate with fields:
  - `load` – primary scalar in \[0, 1] (use this in the overlay).
  - `load_raw` – raw Kalman latent value.
  - `load_z` – z-score of the latent value relative to recent history.
  - `baseline_active`, `hop_index`, `load_state`, `context_flags`, etc.
- `GET /health` – simple health/status document.

### Recommended local workflow (Windows/macOS)

1. Create and activate a virtual environment.
2. Install the CLE package from `newer/praboth-newfx` (editable install).
3. Run the service with uvicorn, binding to port 8000.

