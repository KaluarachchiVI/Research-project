# Production Checklist

Use this checklist before shipping Praboth to a production-like environment.

## 1) Security Baseline

- [ ] Set `security.require_api_key = true` in policy TOML.
- [ ] Set API key via `API_KEY` environment variable or `security.api_key` in policy TOML.
- [ ] Restrict CORS to trusted origins using `service.cors_allowed_origins`.
- [ ] Verify control endpoints reject unauthenticated requests.

## 2) Export and Data Governance

- [ ] Keep `export.require_review = true` for production.
- [ ] Set export review token via `EXPORT_REVIEW_TOKEN` or `export.review_token` in policy TOML.
- [ ] Set `SHUTDOWN_EXPORT_DB_PATH` or `export.shutdown_export_db_path` to a controlled data location.
- [ ] Confirm retention policy (`storage.retention_hours`) matches compliance requirements.

## 3) Reliability

- [ ] Run backend unit tests: `python -m unittest discover -s tests -p "test_*.py"`.
- [ ] Run backend core tests: `python -m unittest discover -s backend/src/tests -p "test_*.py"`.
- [ ] Run distraction tracker tests: `pytest backend/src/tests/test_distraction.py -v`.
- [ ] Run AI Service tests: `cd ai-service && npm run test`.
- [ ] Run frontend checks in `frontend/`: `npm test`, `npm run typecheck`, `npm run build`.
- [ ] Verify startup script launches all services in separate terminals:
  - Backend (port 8000), Frontend (port 3000), AI Service (port 3400).
  - Use: `powershell -ExecutionPolicy Bypass -File start_prod.ps1`.
  - Verify: Each service has independent terminal window visible.

## 4) Observability

- [ ] Keep production log level at `INFO` or higher.
- [ ] Validate `/health` endpoint and core API paths after deployment.
- [ ] Confirm telemetry feed and export flow work under expected load.
- [ ] Test distraction detection:
  - Switch between study and non-study apps for 3+ minutes.
  - Query `GET /distractions?limit=10` to verify recording.
- [ ] Monitor AI Service (port 3400) startup and error logs.
- [ ] Confirm context classification (simple vs. LLM mode) configured correctly.
  - Verify in policy: `context.classifier_provider = "simple"` (default, low latency).
  - Or LLM mode: `context.classifier_provider = "llm"` (requires `context.llm_api_key`).

## 5) Rollback and Operations

- [ ] Document and test rollback procedure for backend/frontend/AI Service release.
  - All three services are stateless; rollback requires restoring SQLite DB + prior binaries.
- [ ] Back up runtime SQLite data directory before release.
  - Includes distraction tracking periods, baseline profiles, EMA responses.
- [ ] Record policy file used for each deployment tag.
  - Document `context.distraction_threshold_seconds` chosen value.
  - Document `context.classifier_provider` setting (simple vs. LLM).
- [ ] Test rollback end-to-end:
  - Restore prior SQLite DB.
  - Restart services with prior binaries.
  - Verify distraction history and other data preserved.
