# Run and verify Intent-Lock integration

Follow these steps in **separate terminals** to run the stack and verify it works.

---

## 1. Start Intent-Lock backend (Terminal 1)

```powershell
cd c:\Users\andre\Research-project\andrew\intentlock-backend

# If you use a venv, activate it first so uvicorn is available:
# .\venv\Scripts\activate

# Install deps once if needed: pip install -r requirements.txt

# Run on 8001 (integrated mode; CLE will use 8000)
# Use "python -m uvicorn" so it works with the current Python
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

**Expected:** You see something like:
- `Uvicorn running on http://127.0.0.1:8001`
- `Application startup complete`

**Quick check:** In a browser or new terminal:
- Open http://127.0.0.1:8001/ → should show `{"message":"Intent-Lock Backend is running"}`

---

## 2. (Optional) Start CLE for real cognitive load (Terminal 2)

If you want **real** cognitive load instead of the default 0.5:

```powershell
cd c:\Users\andre\Research-project\praboth
# or: cd c:\Users\andre\Research-project\praboth-newfx

.\venv\Scripts\activate
.\.venv\Scripts\cog-py-est.exe --config policy_1.toml
```

CLE runs on **8000**. If you skip this, the frontend will show “Cognitive load: default (CLE not connected)” and use 0.5 for predictions.

---

## 3. Frontend env (one-time)

So the frontend talks to Intent-Lock on 8001 (and CLE on 8000 if you use it):

```powershell
cd c:\Users\andre\Research-project\andrew\intentlock-frontend

# Create .env.local from example (edit if needed)
copy .env.local.example .env.local
```

Edit `.env.local` and set:

```
NEXT_PUBLIC_INTENTLOCK_API_BASE=http://127.0.0.1:8001
NEXT_PUBLIC_CLE_API_BASE=http://127.0.0.1:8000
```

(If you don’t run CLE, you can leave `NEXT_PUBLIC_CLE_API_BASE` as is; the app will still work with default load.)

---

## 4. Start the frontend (Terminal 3)

```powershell
cd c:\Users\andre\Research-project\andrew\intentlock-frontend

npm run dev
```

**Expected:** Next.js runs (e.g. http://localhost:3000). Open that URL in your browser.

---

## 5. Verify in the browser

1. **Page loads** – You see “Adaptive Scheduler”, “Real-time work/break scheduling”, session timer, Cognitive Load card, etc. UI should match the dashboard style (dark theme, cards, pill buttons).

2. **Cognitive load**
   - With CLE running: after ~15 s the card should show “Cognitive load from CLE (Praboth)” and the percentage may change.
   - Without CLE: it shows “Cognitive load: default (CLE not connected)” and 100% (0.5 default).

3. **End Session (Intent-Lock)**
   - Click **“End Session”**.
   - Request goes to **port 8001** (Intent-Lock).
   - Either:
     - **Genuine exit:** alert “Exit allowed…” and session resets (no overlay), or
     - **Impulsive exit:** Intent-Lock overlay appears (reminder, or reason, or countdown).
   - Choose “Continue Studying” or “Exit Anyway” / reason / countdown and confirm overlay closes and session resets as expected.

4. **Exit logs** – “Research Metrics (Exit Logs)” shows each attempt with prediction (impulsive/genuine), friction level, session min, load.

---

## 6. Verify with curl (optional)

**Intent-Lock health:**
```powershell
curl http://127.0.0.1:8001/
# Expect: {"message":"Intent-Lock Backend is running"}
```

**Predict-exit (impulsive-like: short session + high load):**
```powershell
curl -X POST http://127.0.0.1:8001/predict-exit -H "Content-Type: application/json" -d "{\"session_minutes\": 5, \"latent_mean\": 0.85, \"session_id\": \"test-1\"}"
```
Expect JSON with `"prediction": "impulsive"`, `"requires_friction": true`, and a `friction_level` 0/1/2.

**Predict-exit (genuine-like: longer session + low load):**
```powershell
curl -X POST http://127.0.0.1:8001/predict-exit -H "Content-Type: application/json" -d "{\"session_minutes\": 45, \"latent_mean\": 0.2, \"session_id\": \"test-2\"}"
```
Expect `"prediction": "genuine"`, `"requires_friction": false`.

**CLE (if running):**
```powershell
curl http://127.0.0.1:8000/estimate
```
Expect JSON with a numeric `load` (0–1).

---

## Checklist

- [ ] Intent-Lock backend runs on 8001 and http://127.0.0.1:8001/ returns OK.
- [ ] Frontend runs and opens at http://localhost:3000.
- [ ] UI matches dashboard (dark theme, cards, pill buttons, Inter font).
- [ ] `.env.local` has `NEXT_PUBLIC_INTENTLOCK_API_BASE=http://127.0.0.1:8001`.
- [ ] “End Session” calls 8001 and either shows alert (genuine) or overlay (impulsive).
- [ ] Overlay levels work: reminder (0), reason (1), countdown (2).
- [ ] (Optional) CLE on 8000 and frontend shows “Cognitive load from CLE (Praboth)”.

If any step fails, check: backend port not in use, Node/Python versions, and that you’re in the correct directories.
