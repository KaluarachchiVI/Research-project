# Praboth Go-Live Gate

This gate is pass/fail. Do not release if any item is failing.

## 1) Security Gate (Must Pass)

- [ ] API authentication enforced in production policy.
  - Verify in runtime config: `security.require_api_key = true`.
- [ ] Strong API key configured via environment variable.
  - Verify: `API_KEY` is set and not empty.
- [ ] CORS restricted to known trusted origins only.
  - Verify in production policy: `service.cors_allowed_origins` has only approved domains.
- [ ] Export review approval required.
  - Verify: `export.require_review = true`.
- [ ] Export review token configured from secret store.
  - Verify: `EXPORT_REVIEW_TOKEN` is set and not placeholder text.
- [ ] Export output path is controlled and backed up.
  - Verify: `SHUTDOWN_EXPORT_DB_PATH` points to approved storage.
- [ ] Distraction tracker privacy verified.
  - Verify: Only app names and timestamps stored (no window titles).
  - Verify: Distraction classifier uses SHA256 cache for privacy.

## 2) Reliability Gate (Must Pass)

- [ ] Backend tests pass.
  - Command: `python -m unittest discover -s tests -p "test_*.py"`
- [ ] Backend core tests pass.
  - Command: `python -m unittest discover -s backend/src/tests -p "test_*.py"`
- [ ] Distraction tracker tests pass.
  - Command: `pytest backend/src/tests/test_distraction.py -v`
- [ ] Frontend tests pass.
  - Command: `cd frontend && npm test`
- [ ] Frontend type-check passes.
  - Command: `cd frontend && npm run typecheck`
- [ ] Frontend production build passes.
  - Command: `cd frontend && npm run build`
- [ ] AI service build/test passes.
  - Command: `cd ai-service && npm run test`

## 3) Runtime Gate (Must Pass)

- [ ] All three services launch in separate terminals successfully.
  - Use: `start_prod.ps1` (launches Backend, Frontend, AI Service in parallel).
  - Verify: Each service has its own visible terminal window.
- [ ] Backend runs in non-reload mode.
  - Verify: Backend runs with production binary (not uvicorn --reload).
- [ ] Frontend runs using built assets (`next start`), not dev mode.
  - Verify: Production build completed and assets served.
- [ ] AI Service runs without errors.
  - Verify: Service listening on port 3400, no startup errors.
- [ ] Health endpoint returns OK after startup.
  - Check: `GET /health` returns healthy status.
- [ ] Critical endpoints validated with API key.
  - Validate at minimum: `/estimate`, `/telemetry`, `/events`, `/export/request`, `/distractions`.
- [ ] Distraction detection active.
  - Verify: `GET /distractions` returns recent non-study periods.

## 4) Operations Gate (Must Pass)

- [ ] Rollback procedure tested in last release rehearsal.
- [ ] Runtime SQLite data directory backed up before deployment.
- [ ] Exact policy file and artifact versions recorded for release tag.
- [ ] Log level set to `INFO` or higher for production deploy.

## 5) Release Decision

- Release status: `GO` only when all checkboxes are complete and evidence is attached.
- If any item is incomplete, release status is `NO-GO`.
