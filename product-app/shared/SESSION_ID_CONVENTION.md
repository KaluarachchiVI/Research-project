## Session ID convention (Phase 1)

To keep CLE, the Adaptive Scheduler, and Intent-Lock logically aligned while using
separate databases, we use a shared **session ID string**.

### Format

Use the following pattern wherever you create a new study session:

```text
user-{USER_ID}-{START_ISO8601}
```

Examples:

- `user-alice-2025-03-10T14:02:15.123456`
- `user-123-2025-03-10T09:30:00`

### Where this is used

- **Adaptive Scheduler API**
  - `/api/time-block/start` returns a `session_id` that should already follow this pattern.
  - `/api/time-block/end` accepts the same `session_id`.
- **Intent-Lock overlay**
  - The frontend should use the scheduler’s `session_id` instead of generating its own
    `session_${Date.now()}`.
  - When calling `POST /predict-exit`, the frontend passes `session_id` so the
    `intentlock.db` records can later be joined to scheduler data offline.
- **CLE**
  - CLE’s SQLite DB (`state.db`) has its own session IDs; for Phase 1 we do not
    attempt to fully unify those IDs, but analysis scripts can join by time ranges.

In later phases we can add explicit APIs and/or mapping tables to hard-link CLE
sessions with Adaptive Scheduler sessions and Intent-Lock exit events.

