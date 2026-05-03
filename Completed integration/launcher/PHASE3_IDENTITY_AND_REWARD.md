# Phase 3: User identity and reward (reference)

This document describes where user identity is set, where reward is computed, and how the **planner** (heatmap) stack is keyed by user.

## Where user identity is set

- **Login**: User signs in at `/login` (Intent-Lock frontend). Credentials are validated by the scheduler API `POST /api/auth/login`. On success, the frontend stores a JWT and user info (`user_id`, `display_name`) in localStorage and sets the scheduler auth token so scheduler requests include `Authorization: Bearer <token>`.
- **Auth context**: The app uses `AuthProvider` and `useAuth()` from `lib/authContext.tsx`. After login, `user.user_id` and `user.display_name` are the session source of truth. No manual “user ID” field on the main screen; it comes from auth.
- **Scheduler**: Time-block start receives `user_id` in the request body (from `user.user_id`). Session IDs follow `user-{USER_ID}-{START_ISO8601}` (see scheduler docs / `SESSION_ID_CONVENTION.md` if present in tree).

## Where reward is computed

- **End interval**: On end of a work or break interval, the frontend calls `POST /api/time-block/end-interval`. The scheduler’s `UnifiedSessionManager.end_interval_and_compute_reward()` computes reward (`immediate_reward`, `r_progress`, `r_relief`) and stores it in the `rewards` table. The response includes `reward_computed.immediate_reward` for the UI.
- **Session end**: On overlay exit or end-session, the frontend calls `POST /api/time-block/end`. The scheduler closes the session; per-interval rewards were stored on each end-interval.
- **Aggregate effectiveness**: `GET /api/time-block/user-sessions?user_id=` returns recent sessions with an `effectiveness` field; the Intent-Lock dashboard can show “Recent session effectiveness.”

## How the planner UI is keyed by user

- **Planner iframe**: The Intent-Lock planner page embeds the planner frontend in an iframe. The iframe URL can include a `user_id` query parameter from `useAuth().user.user_id`.
- **Planner frontend**: Reads `user_id` from URL search params when present and forwards it to the planner backend (e.g. hourly intensity endpoints).
- **Planner backend**: Endpoints such as `GET /hourly-intensity` accept optional `user_id`. When set, the backend calls the scheduler `GET /api/time-block/user-sessions?user_id=` and builds user-scoped data. Without `user_id`, it may use global/static data (e.g. CSV fallback).
- **Config**: Set `SCHEDULER_API_BASE` (default `http://127.0.0.1:5000`) when the scheduler runs on another host/port. The integrated `start-all.ps1` sets this for the planner backend process.
