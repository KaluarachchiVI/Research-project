## Adaptive Scheduler API service

This folder documents how to run the Adaptive Scheduler API as part of the integrated stack.

### Implementation

- Codebase: `older/src`
- Entrypoint: `older/src/api/app.py`
- Default host/port: `0.0.0.0:5000`

The API exposes:

- Classic bandit session endpoints: `/api/start-session`, `/api/get-recommendation`, `/api/end-interval`, `/api/end-session`, `/api/submit-feedback`.
- Time-block endpoints (used with Intent-Lock in Phase 1):
  - `POST /api/time-block/start` – starts a time-block session and returns `{ session_id, schedule }`.
  - `POST /api/time-block/end-interval` – ends a single work/break interval and returns the next recommendation + reward.
  - `POST /api/time-block/end` – ends the session, optionally syncs CLE data and computes metrics.
  - `GET /api/time-block/recommendation` – real-time recommendation for the current interval.
  - `GET /api/time-block/suggestion` – suggestion for a future time block based on past metrics.
- Metrics endpoints: `/api/metrics`, `/api/metrics/detailed`.

### Intent-Lock metadata (Phase 1)

The `POST /api/time-block/end` endpoint now accepts optional fields from the Intent-Lock overlay:

- `intent_prediction`: `"impulsive"` or `"genuine"`.
- `friction_level`: integer (0–2).
- `intent_exit_event_id`: integer; the ID from `intentlock.db` if available.
- `intent_reason`: short categorical reason (e.g. `"fatigue"`).
- `intent_reason_custom`: optional free-text description.

When any of these are present, the API writes an `IntentLockEvent` row into the scheduler DB.

