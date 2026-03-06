## Phase 1 end-to-end checks (manual/informal)

This file outlines basic checks to validate that CLE, Intent-Lock, the scheduler, and
Yuvidu are wired together correctly. It is not an automated test suite, but a
lightweight checklist you can convert into proper tests later.

### 1. CLE + Intent-Lock

1. Start CLE on port 8000.
2. Start Intent-Lock backend on port 8001.
3. Start Intent-Lock frontend on port 3000 with:
   - `NEXT_PUBLIC_INTENTLOCK_API_BASE=http://127.0.0.1:8001`
   - `NEXT_PUBLIC_CLE_API_BASE=http://127.0.0.1:8000`
4. Open `http://localhost:3000` and verify:
   - Cognitive load shows a numeric value and “warming” state initially.
   - “Simulate activity” changes the CLE estimate at the next hop.
   - “End Session” triggers friction when the backend predicts an impulsive exit.

### 2. Scheduler API + Intent-Lock

1. Start the Adaptive Scheduler API (Flask) on port 5000.
2. Ensure `NEXT_PUBLIC_SCHEDULER_API_BASE` is set for the Intent-Lock frontend.
3. Start a session in the overlay and then end it:
   - Confirm that `/api/time-block/start` is called (check scheduler logs).
   - Confirm that `/api/time-block/end` is called with:
     - `session_id` from the scheduler,
     - `intent_prediction`, `friction_level`, and optional reason fields.
4. Inspect `adaptive_scheduler.db` and verify that an `intent_lock_events`
   row exists for the session with the expected metadata.

### 3. Yuvidu + scheduler / product UI

1. Start Yuvidu backend on port 5001.
2. Start Yuvidu frontend on its configured port (e.g. 5123).
3. From the main UI or docs:
   - Follow the link to the Yuvidu dashboard.
   - Confirm that `/predictall`, `/weekly-predictions`,
     `/hourly-intensity`, and `/next-best-study-window` all respond and render.

### 4. Health endpoints

Confirm the following endpoints respond with JSON and HTTP 200:

- CLE: `GET /health`
- Intent-Lock: (to be added) `GET /health`
- Scheduler: `GET /api/health`
- Yuvidu: `GET /` (basic status)

You can turn these checks into automated tests later using pytest + httpx
or a similar HTTP client.

