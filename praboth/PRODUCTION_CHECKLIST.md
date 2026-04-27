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
- [ ] Run frontend checks in `frontend/`: `npm test`, `npm run typecheck`, `npm run build`.
- [ ] Verify startup script launches backend and frontend with no manual fixes.

## 4) Observability

- [ ] Keep production log level at `INFO` or higher.
- [ ] Validate `/health` endpoint and core API paths after deployment.
- [ ] Confirm telemetry feed and export flow work under expected load.

## 5) Rollback and Operations

- [ ] Document and test rollback procedure for backend/frontend release.
- [ ] Back up runtime SQLite data directory before release.
- [ ] Record policy file used for each deployment tag.
