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

## 2) Reliability Gate (Must Pass)

- [ ] Backend tests pass.
  - Command: `python -m unittest discover -s tests -p "test_*.py"`
- [ ] Backend core tests pass.
  - Command: `python -m unittest discover -s backend/src/tests -p "test_*.py"`
- [ ] Frontend tests pass.
  - Command: `cd frontend && npm test`
- [ ] Frontend type-check passes.
  - Command: `cd frontend && npm run typecheck`
- [ ] Frontend production build passes.
  - Command: `cd frontend && npm run build`
- [ ] AI service build/test passes.
  - Command: `cd ai-service && npm run test`

## 3) Runtime Gate (Must Pass)

- [ ] Backend runs in non-reload mode.
  - Use: `start_prod.ps1`.
- [ ] Frontend runs using built assets (`next start`), not dev mode.
  - Use: `start_prod.ps1`.
- [ ] Health endpoint returns OK after startup.
  - Check: `GET /health`.
- [ ] Critical endpoints validated with API key.
  - Validate at minimum: `/estimate`, `/telemetry`, `/events`, `/export/request`.

## 4) Operations Gate (Must Pass)

- [ ] Rollback procedure tested in last release rehearsal.
- [ ] Runtime SQLite data directory backed up before deployment.
- [ ] Exact policy file and artifact versions recorded for release tag.
- [ ] Log level set to `INFO` or higher for production deploy.

## 5) Release Decision

- Release status: `GO` only when all checkboxes are complete and evidence is attached.
- If any item is incomplete, release status is `NO-GO`.
