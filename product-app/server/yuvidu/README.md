## Yuvidu heatmap service

This folder documents how the Yuvidu service is used in the integrated product.

### Components

- Backend API: `newer/yuvidu/backend/server.py` (FastAPI on port 5001).
- Frontend: `newer/yuvidu/frontend/src/ui` (React SPA, served separately on port 5123 or similar).

### API endpoints

Yuvidu’s backend exposes:

- `GET /predictall` – overall best time of day and probabilities over {morning, afternoon, evening, night}.
- `GET /weekly-predictions` – per-day-of-week best times and confidence scores.
- `GET /hourly-intensity` – intensity (fraction of sessions) per hour of day.
- `GET /next-best-study-window` – best 4-hour window recommendation for today.

The React UI (`App.tsx`) calls these endpoints directly at `http://localhost:5001/...`.

### Integration with the main product

In Phase 1 we keep Yuvidu **UI-level integrated**:

- The main session UI (Intent-Lock frontend) or the scheduler dashboard can link out to the Yuvidu SPA:
  - Example link: `http://SERVER_HOST:5123/` (or whatever port you use for `npm run dev` / the built bundle).
- The scheduler can optionally proxy Yuvidu data via a future `/api/recommendation/weekly` endpoint, but that is out of scope for Phase 1.

No additional code changes are required to have Yuvidu running alongside the scheduler; it remains a **separate visualization service**.

