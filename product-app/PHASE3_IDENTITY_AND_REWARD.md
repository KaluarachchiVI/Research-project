# Phase 3: User identity and reward (reference)

This document describes where user identity is set, where reward is computed, and how Yuvidu is keyed by user.

## Where user identity is set

- **Login**: User signs in at `/login` (IntentLock frontend). Credentials are validated by the scheduler API `POST /api/auth/login`. On success, the frontend stores a JWT and user info (user_id, display_name) in localStorage and sets the scheduler auth token so all scheduler requests include `Authorization: Bearer <token>`.
- **Auth context**: The IntentLock app uses `AuthProvider` and `useAuth()` from `lib/authContext.tsx`. After login, `user.user_id` and `user.display_name` are the single source of truth for the session. No manual "user ID" field exists on the main screen; it is derived from auth.
- **Scheduler**: Time-block start receives `user_id` in the request body (sent by the frontend from `user.user_id`). Session IDs follow the convention `user-{USER_ID}-{START_ISO8601}` (see `SESSION_ID_CONVENTION.md`).

## Where reward is computed

- **End interval**: When the user ends a work or break interval, the frontend calls `POST /api/time-block/end-interval`. The scheduler’s `UnifiedSessionManager.end_interval_and_compute_reward()` computes reward (immediate_reward, r_progress, r_relief) using the reward calculator and stores it in the `rewards` table (linked to the action). The response includes `reward_computed.immediate_reward`, which the UI shows as "Reward" / session effectiveness.
- **Session end**: When the session is ended (IntentLock overlay exit or end-session), the frontend calls `POST /api/time-block/end`. The scheduler closes the session and can run metrics; reward per interval has already been stored on each end-interval.
- **Aggregate effectiveness**: `GET /api/time-block/user-sessions?user_id=` returns recent sessions for a user with an `effectiveness` field (average of interval rewards for that session). The IntentLock dashboard uses this to show "Recent session effectiveness".

## How Yuvidu is keyed by user

- **Planner iframe**: The IntentLock planner page (`/planner`) embeds the Yuvidu frontend in an iframe. The iframe URL includes a `user_id` query parameter from the logged-in user (`useAuth().user.user_id`).
- **Yuvidu frontend**: The Yuvidu Next.js app (e.g. `app/page.tsx`) reads `user_id` from the URL search params. When calling its backend (e.g. `/hourly-intensity`), it appends `?user_id=...` when `user_id` is present.
- **Yuvidu backend**: Endpoints such as `GET /hourly-intensity` accept an optional `user_id` query parameter. When provided, the backend calls the scheduler API `GET /api/time-block/user-sessions?user_id=` and builds user-scoped data (e.g. hourly intensity from that user’s session start times). When `user_id` is not provided, the backend uses the global bandit dataset (static CSV).
- **Config**: The Yuvidu backend uses `SCHEDULER_API_BASE` (default `http://127.0.0.1:5000`) to fetch user sessions. Set this in the environment when the scheduler runs on a different host/port.
