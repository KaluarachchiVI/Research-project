# Panel prep: four subsystems + IntentLock stack (code walkthrough)

This note is for a teammate preparing for viva-style questions aligned with **Final presentaion Q Research.pdf** (AI usage, *understand / justify / own*, code ownership, pre-trained models, validation). It ties the **four research parts**—**adaptive scheduler**, **cognitive load estimator (CLE)**, **planner (Yuvidu)**, **IntentLock overlay**—to what actually runs in **`intent-lock-backend`** and **`intent-lock-frontend`**, with file/line references so you can open the code while you speak.

---

## 1. How the four parts connect in the integrated demo

| Part | Role in the study stack | Where it shows up in this repo slice |
|------|-------------------------|--------------------------------------|
| **Cognitive load** | Continuous estimate of mental effort (0–1); feeds exit context and EMA prompts | Browser polls CLE `GET /estimate`; `latent_mean` for IntentLock comes from that signal when connected |
| **Adaptive scheduler** | Bandit-style work/break recommendations and rewards | Optional Flask service; `schedulerClient.ts` + `page.tsx` start/end time blocks and intervals |
| **Planner** | Longer-horizon “what to study next” UI | Next route `/planner` embeds Yuvidu in an iframe with `user_id` / `from_session` query params |
| **IntentLock overlay** | On “end session”, predicts impulsive vs genuine exit; escalates friction; logs reasons | FastAPI `POST /predict-exit`; UI `IntentLockModal` + legacy `IntentLockOverlay` |

**End-to-end exit path (one sentence for the panel):** While you study, the dashboard keeps **session minutes** and a **cognitive load proxy** (`latent_mean`). When you try to end the session, the **IntentLock backend** classifies the exit and may require **friction**; if the **scheduler** is enabled, the same exit metadata is sent to **`/api/time-block/end`** so the bandit can learn from that session.

---

## 2. “Explain this part in your own words” (Understanding)

### 2.1 What happens when `POST /predict-exit` runs?

The backend loads a small **sklearn** model if a `*.pkl` exists under `models/`; otherwise it falls back to a **deterministic heuristic** on `(session_minutes, latent_mean)`. It then counts prior **impulsive** predictions for this `session_id` to pick **friction level** 0, 1, or 2, logs an `exit_events` row, and returns JSON the UI uses to open the modal.

Core logic:

```54:108:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\intent-lock-backend\main.py
@app.post("/predict-exit")
def predict_exit(data: PredictRequest):
    """
    Predict exit intent and determine friction level
    ...
    """
    try:
        # Get prediction from model
        prediction_value = model.predict(data.session_minutes, data.latent_mean)
        prediction_label = "impulsive" if prediction_value == 1 else "genuine"
        
        # Determine friction level based on previous impulsive exits
        if prediction_label == "impulsive":
            impulsive_count = count_impulsive_exits(data.session_id)
            
            if impulsive_count == 0:
                friction_level = 0
                message = "You've been focused. Are you sure you want to exit?"
            elif impulsive_count == 1:
                friction_level = 1
                message = "Before exiting, please tell us why:"
            else:  # 2 or more
                friction_level = 2
                message = "You've attempted to exit multiple times. Please confirm your intent."
            ...
        else:
            # Genuine exit - no friction, immediate exit allowed
            friction_level = 0
            message = "Exit allowed. You've had a productive session."
            requires_friction = False
        
        # Log exit event to database
        exit_event_id = insert_exit_event(
            ...
        )
        
        return {
            "prediction": prediction_label,
            "friction_level": friction_level,
            "message": message,
            "exit_event_id": exit_event_id,
            "requires_friction": requires_friction
        }
```

**Say aloud:** friction is not only “model says impulsive”—it is **stateful per `session_id`**: first impulsive nudge, second asks for a **structured reason** (logged to SQLite), third adds a **cool-down style countdown** in the UI.

### 2.2 How does `latent_mean` get into the request?

The dashboard treats CLE’s **load** as a value in **[0, 1]** and stores it in React state as `latentMean`, then sends it with `session_minutes` and `session_id` to IntentLock:

```420:433:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\intent-lock-frontend\app\page.tsx
  const handleExitAttempt = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/predict-exit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_minutes: sessionMinutes || 1, // At least 1 minute
          latent_mean: latentMean,
          session_id: sessionId,
        }),
      });
```

The same state is fed from CLE polling (`GET` on `CLE_API_BASE/estimate`); when a numeric load arrives it **clamps to [0,1]** and updates `latentMean`:

```347:352:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\intent-lock-frontend\app\page.tsx
        const clampedLoad =
          load !== null && !Number.isNaN(load)
            ? Math.max(0, Math.min(1, Number(load)))
            : null;
        if (clampedLoad !== null) {
          setLatentMean(clampedLoad);
```

So in one sentence: **`latent_mean` in the IntentLock API is the latest normalized cognitive-load estimate from CLE**, not a separate latent model inside IntentLock.

### 2.3 What does the classifier implementation actually do?

```32:54:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\intent-lock-backend\models\model.py
class IntentModel:
    """1 = impulsive exit, 0 = genuine."""

    def predict(self, session_minutes: float, latent_mean: float) -> int:
        m = _load_sklearn_model()
        if m is not False and m is not None:
            try:
                import numpy as np  # type: ignore[import-untyped]

                X = np.array([[session_minutes, latent_mean]], dtype=float)
                y = int(m.predict(X)[0])
                return 1 if y == 1 else 0
            except Exception:
                pass
        return self._heuristic(session_minutes, latent_mean)

    @staticmethod
    def _heuristic(session_minutes: float, latent_mean: float) -> int:
        if latent_mean >= 0.72 and session_minutes < 12:
            return 1
        if latent_mean >= 0.85:
            return 1
        return 0
```

**Panel line:** There is a **graceful degradation path**: shipped joblib model if present; else transparent rules so the API still behaves for demos and tests.

### 2.4 What does friction level 1 vs 2 mean in the UI?

The production-styled modal posts **`/log-reason`** when the user saves a reason (friction 1), matching the backend’s `LogReasonRequest`:

```72:95:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\intent-lock-frontend\components\IntentLockModal.tsx
  const handleReasonSubmit = async () => {
    if (frictionLevel === 1 && !selectedReason) return;
    if (exitEventId) {
      try {
        await fetch(`${backendUrl}/log-reason`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exit_event_id: exitEventId,
            reason: selectedReason,
            custom_text: reasonText || undefined,
          }),
        });
        onReasonSubmitted(selectedReason, reasonText || undefined);
      } catch (err) {
        console.error("Error logging reason:", err);
      }
    }
    ...
  };
```

Friction **2** uses a **3-second countdown** before `onExit()` fires—see `handleFriction2Confirm` and the `useEffect` that decrements `countdown` in the same file.

---

## 3. “Why this technology / model?” (Justification)

### 3.1 Why FastAPI + SQLite for IntentLock?

- **FastAPI**: typed request bodies (`PredictRequest`, `LogReasonRequest`), automatic OpenAPI docs, easy CORS for a local Next dev server.
- **SQLite**: zero-setup persistence for **`exit_events`** and **`exit_reasons`** for lab demos and offline evaluation—see `init_database()` and `insert_exit_event` in `data/database.py`.

### 3.2 Why sklearn + joblib instead of a deep network here?

The feature vector is **only two dimensions** (`session_minutes`, `latent_mean`). A small **linear or tree-based** sklearn model is appropriate: low latency, easy to explain, easy to evaluate with confusion matrix scripts—fits the “**engineer, not black box**” narrative from the PDF.

### 3.3 Why connect the scheduler only when `NEXT_PUBLIC_SCHEDULER_API_BASE` is set?

```41:45:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\intent-lock-frontend\app\page.tsx
const SCHEDULER_ENABLED =
  typeof process !== "undefined" &&
  typeof process.env.NEXT_PUBLIC_SCHEDULER_API_BASE === "string" &&
  process.env.NEXT_PUBLIC_SCHEDULER_API_BASE.length > 0;
```

**Justification:** the web UI must run **without** the Flask bandit service for IntentLock-only demos; when the env var is present, `startTimeBlockSession` wires in the adaptive piece.

### 3.4 Why iframe the planner instead of rewriting it in React?

```10:23:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\intent-lock-frontend\app\planner\page.tsx
const YUVIDU_PLANNER_URL =
  process.env.NEXT_PUBLIC_YUVIDU_PLANNER_URL ?? "http://localhost:5123";
...
  const base = YUVIDU_PLANNER_URL.replace(/\/$/, "");
  const params = new URLSearchParams();
  if (user?.user_id) params.set("user_id", user.user_id);
  if (fromSessionId) params.set("from_session", fromSessionId);
  const plannerSrc = params.toString() ? `${base}/?${params.toString()}` : `${base}/`;
```

**Justification:** separation of concerns—Yuvidu remains its own service; IntentLock passes **identity** and **session provenance** via query string so planning can be “after session X” without duplicating planner logic in Next.

---

## 4. Code ownership: “Walk me through this function”

### 4.1 `count_impulsive_exits` — why it matters

```129:141:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\intent-lock-backend\data\database.py
def count_impulsive_exits(session_id: str) -> int:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT COUNT(*) FROM exit_events
        WHERE session_id = ? AND prediction = 'impulsive'
        """,
        (session_id,),
    )
    (n,) = cur.fetchone()
    conn.close()
    return int(n)
```

If the panel asks “what if `session_id` changes every second?”—then the count resets and friction never escalates. **In this app**, `sessionId` is set at session start (and aligned with scheduler session id when the scheduler starts), so escalation is **per study block**, which matches the product intent.

### 4.2 `handleExitAttempt` — branch the panel will probe

```457:482:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\intent-lock-frontend\app\page.tsx
      // If genuine exit (no friction required), allow immediate exit
      if (!data.requires_friction) {
        // Notify scheduler (if configured) before resetting the session.
        if (schedulerSessionId && data.prediction) {
          const prediction = data.prediction as ExitPrediction;
          void endTimeBlockSession({
            session_id: schedulerSessionId,
            auto_sync: true,
            auto_compute_metrics: true,
            intent_prediction: prediction,
            friction_level: data.friction_level ?? null,
            intent_exit_event_id: data.exit_event_id ?? null,
            intent_reason: null,
            intent_reason_custom: null,
          }).catch((err: unknown) => {
            console.error("Failed to end scheduler session:", err);
          });
        }
        ...
        resetSession();
        return;
      }

      // Impulsive exit - show overlay with friction
      setOverlayOpen(true);
```

**Say:** genuine exits still **close the scheduler session** with metadata so bandit rewards/logs stay consistent; impulsive exits open UI friction first, and may still end the scheduler after the user completes exit (see `handleOverlayExit` in the same file).

---

## 5. Pre-trained models / data (PDF section)

### 5.1 Did you *train* this model or use a bundled one?

`IntentModel` loads **whichever** `models/*.pkl` `joblib` finds first—training is **out of band** (scripts in the repo), not inside the API request path:

```20:26:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\intent-lock-backend\models\model.py
    candidates = list(Path(__file__).resolve().parent.glob("*.pkl"))
    if not candidates:
        _MODEL = False
        return None
    try:
        _MODEL = joblib.load(candidates[0])
```

**Honest panel answer:** clarify whether your team **trained on synthetic data** (`generate_training_data.py` → `synthetic_data_generator`) vs **real user logs**—the pipeline supports synthetic seeds in SQLite `synthetic_training_data` for offline checks (`evaluate_model.py`).

### 5.2 What dataset / biases?

If you only used **synthetic** labels, say clearly: the model may **overfit generator assumptions** (e.g. short session + high load ⇒ impulsive). Mitigations you can mention: **collect real exit labels**, **rebalance classes**, **calibrate thresholds** in `_heuristic`, **A/B** friction against a no-AI control.

---

## 6. Validation: “How do you know it works?”

### 6.1 Offline metrics (backend script)

`evaluate_model.py` computes **accuracy, per-class accuracy, confusion matrix, precision, recall, F1** against rows in `synthetic_training_data`:

```14:63:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\intent-lock-backend\evaluate_model.py
X = np.array([[row[0], row[1]] for row in training_data])
y_true = np.array([row[2] for row in training_data])

# Get predictions
y_pred = np.array([model.predict(x[0], x[1]) for x in X])
...
accuracy = np.mean(y_true == y_pred)
...
precision = tp / (tp + fp) if (tp + fp) > 0 else 0
recall = tp / (tp + fn) if (tp + fn) > 0 else 0
f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
```

### 6.2 Runtime checks

- **`GET /health`** on IntentLock backend touches model init (`main.py`).
- **UI**: exit logs table (last 10) on the dashboard gives a **live audit** of `prediction`, `frictionLevel`, `sessionMinutes`, `latentMean` after each attempt (`handleExitAttempt` pushes to `exitLogs`).
- **Scheduler**: `endTimeBlockSession` / `endTimeBlockInterval` return structures include optional `reward_computed` (see types in `schedulerClient.ts`)—use that in a user study or logging dashboard.

### 6.3 Cognitive load card (qualitative + UX validation)

`CognitiveLoadCard` visualizes rolling **0–100%** history from successful polls—good for demos and for arguing **transparency** (users see the signal driving friction, not a hidden score).

---

## 7. AI usage disclosure (tie-in to the PDF)

If asked **where AI was used**, separate:

| Layer | Typical “AI” boundary |
|-------|------------------------|
| **IntentLock sklearn** | Classical ML you train/evaluate; not an LLM |
| **CLE** | May include statistical / ML fusion (see CLE service docs in its own repo) |
| **Adaptive scheduler** | Contextual bandit (research component) |
| **Coding / report drafting** | Disclose per institutional policy |

**Validation of AI-assisted text/code:** run the app, hit endpoints with curl/Postman, compare predictions to `evaluate_model.py`, and keep **git history** showing human review.

---

## 8. Quick “ports and env” cheat sheet (for live demo)

| Service | Default in frontend code | Env override |
|---------|---------------------------|--------------|
| CLE | `http://127.0.0.1:8000` | `NEXT_PUBLIC_CLE_API_BASE` |
| IntentLock API | `http://127.0.0.1:8001` | `NEXT_PUBLIC_INTENTLOCK_API_BASE` |
| Scheduler | unset until env set | `NEXT_PUBLIC_SCHEDULER_API_BASE` (e.g. `http://127.0.0.1:5000`) |
| Yuvidu planner | `http://localhost:5123` | `NEXT_PUBLIC_YUVIDU_PLANNER_URL` |

Note: `intent-lock-backend/main.py` does not hardcode the port; you choose it when launching **uvicorn** (match `NEXT_PUBLIC_INTENTLOCK_API_BASE`).

---

## 9. One-minute “architecture” monologue (memorize)

“We split concerns: **CLE** estimates load from interaction telemetry and micro-EMA. The **Next dashboard** polls CLE, runs the timer, and optionally talks to the **adaptive scheduler** for work/break intervals. When the user tries to quit, **IntentLock** sends session length and the latest load to a **small classifier**; if the exit looks **impulsive**, we apply **progressive friction** and log reasons to **SQLite**. The **planner** is embedded as **Yuvidu** for longer planning with the same user id. Offline, we **evaluate the classifier** on stored training rows; online, we **verify** with health checks, UI logs, and scheduler reward payloads.”

---

*Document generated for internal study / viva prep; paths are under `Completed integration/intent-lock-backend` and `Completed integration/intent-lock-frontend`.*
