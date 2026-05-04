## Client Intent-Lock Overlay (Andrew stack)

This folder documents how to run the **Intent-Lock overlay** on the client machine.

### Components

- Backend: `newer/andrew/intentlock-backend` (FastAPI on port 8001).
- Frontend: `newer/andrew/intentlock-frontend` (Next.js on port 3000).

### Environment variables

These are read by the frontend (`app/page.tsx`) to find the backend and CLE:

- `NEXT_PUBLIC_INTENTLOCK_API_BASE` – base URL for the Intent-Lock backend.
  - Default: `http://127.0.0.1:8001`
- `NEXT_PUBLIC_CLE_API_BASE` – base URL for the CLE (`cog-py-est`) service.
  - Default: `http://127.0.0.1:8000`

The frontend:

- Polls `GET {CLE_API_BASE}/estimate` for `load` in `[0, 1]`.
- Calls `POST {INTENTLOCK_API_BASE}/predict-exit` on “End Session”.
- Opens a full-screen overlay when `requires_friction` is `true`.

In Phase 1, the overlay will also notify the central scheduler API on session end.

