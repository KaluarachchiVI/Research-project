# CLE (Praboth) – Run analysis and fix

## Bug fixed: window loop was crashing (no real estimates)

**Cause:** In `cog_py_est/service.py`, the distraction-detection code used `window_context.focus_app`, but `WindowContext` has no `focus_app` attribute. It only has `context_flags` (a dict), and the focus app is stored as `context_flags["focus_app"]`.

**Effect:** On the first hop (~15 s after start), the window loop raised `AttributeError` and the async task stopped. So:

- `latest_estimate` was never set (or only from a restored previous session).
- `GET /estimate` kept returning the **warming** payload (load 0.5) because `latest_payload()` stayed `None`.
- The frontend always saw 100% and “warming up” or a static 0.5.

**Fix (applied):** Use `window_context.context_flags.get("focus_app", "unknown")` instead of `window_context.focus_app`.

---

## How to run the CLE correctly

1. **From repo root (e.g. `praboth-newfx`):**
   ```powershell
   .\.venv\Scripts\activate
   python -m cog_py_est.cli --config policy_1.toml
   ```
   Use `python -m cog_py_est.cli` so the **current source** is used (including the fix). If you use `cog-py-est.exe`, reinstall first: `pip install .` then restart.

2. **Config:** `policy_1.toml` (or your TOML) must exist. It sets:
   - `[service]` host/port (default 127.0.0.1:8000)
   - `[window]` window_seconds=60, hop_seconds=15
   - `[storage]` path (e.g. data/state.db)

3. **First estimate:** The first real estimate is produced after the **first hop** (~15 s). Until then, the API returns the warming payload (load 0.5) so clients get a valid response.

---

## Why the cognitive load may still stay near 50%

The CLE needs **input events** to change the estimate:

- **Context monitor (in-process):** Sends **system** events every 2 s (focus app, idle, DND, etc.). It runs automatically when the service starts. With **only** system events, the feature vector has little variation, so the Kalman estimate often stays near 0.5 → frontend shows ~100%.

- **OS hooks (optional):** To get **keyboard** and **pointer** events (and real variation in load), run the hook streamer in a **separate** terminal:
  ```powershell
  .\.venv\Scripts\activate
  pip install ".[hooks]"   # if not already
  .\.venv\Scripts\cle-os-hooks.exe --endpoint http://127.0.0.1:8000/events
  ```
  Then use the machine (type, move mouse); the CLE will receive events and the estimate can move away from 0.5.

**Summary:** The service is running correctly once the fix is in place. For a **changing** cognitive load in the Intent-Lock UI, run the CLE **and** (optionally) the OS hooks so it gets keyboard/pointer input; otherwise the value will often stay near 50%.

---

## If the value “worked then stopped” (loop crash)

The window loop can throw (e.g. classifier, storage, or policy code). If it did, the loop exited and `latest_estimate` stopped updating, so the frontend kept seeing the same number.

**Change made:** The whole hop body is now inside a `try/except`. On any exception we log it and continue the loop, so one bad hop no longer stops updates. You keep getting the last good estimate until the next successful hop.

**If it stops again:** Check the CLE terminal for a line like  
`Window loop error at hop_index=...; keeping previous estimate and continuing`  
and the traceback below it. That will show which call failed (e.g. classifier, storage, or policy). Fix that underlying error so new estimates can be produced every 15 s.

---

## Integration with Intent-Lock

- **CLE:** `http://127.0.0.1:8000` – `GET /estimate` returns `{ "load": 0–1, ... }`.
- **Intent-Lock frontend:** Set `NEXT_PUBLIC_CLE_API_BASE=http://127.0.0.1:8000` in `.env.local` and poll every 5 s.
- **Intent-Lock backend:** Runs on 8001; uses `latent_mean` from the frontend (which gets it from CLE) for predict-exit.

After the fix, restart the CLE (and optionally start OS hooks) and refresh the frontend; you should see “Cognitive load from CLE (Praboth)” and, with hooks, a load that changes over time.
