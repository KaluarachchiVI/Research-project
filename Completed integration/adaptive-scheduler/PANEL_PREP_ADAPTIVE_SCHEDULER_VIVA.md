# Adaptive Scheduler — viva / panel prep (code + in-repo docs)

**Audience:** Oral defense tomorrow — you need *correct*, *short* answers and *exact* places in code to point at.  
**Framing:** Aligns with **Final presentaion Q Research.pdf** themes: *understand*, *justify*, *own the code*, *validation*, *honest limits*, *AI use disclosure*.  
**Local docs to skim tonight:** `SUPERVISOR_PREP.md`, `VISUAL_SUMMARY.md`, `PROGRESS_SUMMARY.md`, `UI_INTEGRATION_GUIDE.md`, `HOW_TO_RUN.md`.

---

## 0. Cram sheet (read this twice before you sleep)

**One sentence:** A **contextual bandit** (LinUCB or Thompson / LinTS-style) chooses one of **16** discrete `(work_min, break_min)` arms from an **8-D context** built from **typing timing + session + time-of-day + cognitive load**; after each interval it gets a **reward** = weighted **task progress** + **post-break load relief**, with **safety overrides**; everything is logged to **SQLite** and **eight research metrics** (PG, RPH, AHL, …) are computed from that history.

**Three numbers to memorize:** `16` arms · `8` features · weights **`0.6` progress / `0.4` relief** (see `config/config.py`).

**If they ask “what’s running?”** Flask app `src/api/app.py` on **`API_PORT` default 5000**; Next.js IntentLock dashboard calls **`/api/time-block/*`** when `NEXT_PUBLIC_SCHEDULER_API_BASE` is set (`UI_INTEGRATION_GUIDE.md`).

---

## 1. Map PDF themes → your subsystem

| PDF theme | What to say (scheduler-specific) |
|-----------|-----------------------------------|
| **Understand** | Context vector → LinUCB UCB score per arm → optional safety clamp → store action/reward → `scheduler.update(...)` |
| **Justify** | Pomodoro is one fixed arm; you search **{20,30,45,60}×{3,5,8,12}** with **JITAI-style** feedback (reward after interval), plus **safety** for wellbeing |
| **Own the code** | Walk `get_recommendation` then `end_interval`: reward → `bandit.update` → next action persisted |
| **Pre-trained models** | **No foundation model.** Classical online linear bandit + hand-crafted reward; optional **Praboth/CLE** as external **cognitive load signal** (config flags) |
| **Validation** | Unit tests under `tests/`; `MetricsCalculator.compute_all_metrics`; `demo_progress.py` / dashboard; acknowledge **CTU** needs counterfactual probes |
| **AI disclosure** | If you used AI for drafts/debugging: state **tool + purpose + verification** (you ran code, checked API, read `reward_calculator` behavior) |

---

## 2. “Explain how it works” (Understanding) — with code

### 2.1 Action space (what the bandit chooses)

Arms are the Cartesian product of work intervals and break durations from config:

```14:16:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\adaptive-scheduler\config\config.py
WORK_INTERVALS = [20, 30, 45, 60]  # minutes
BREAK_DURATIONS = [3, 5, 8, 12]  # minutes
```

`BaseBandit` materializes **all pairs**:

```11:16:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\adaptive-scheduler\src\bandit_engine\base_bandit.py
    def __init__(self):
        """Initialize bandit"""
        # Action space: (work_interval, break_duration)
        self.actions = [(w, b) for w in WORK_INTERVALS for b in BREAK_DURATIONS]
        self.num_actions = len(self.actions)
        self.action_counts = {action: 0 for action in self.actions}
```

**Viva line:** “Each arm is a full schedule *hypothesis* for the next cycle, not a continuous knob—so exploration is *structured* and safe to implement.”

### 2.2 Context features (what “contextual” means here)

Eight features, including **cognitive_load** in [0,1], serialized in order for `np.dot`:

```11:34:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\adaptive-scheduler\src\feature_extractor\feature_extractor.py
@dataclass
class ContextFeatures:
    """Context feature vector"""
    mean_iki: float
    std_iki: float
    typing_speed: float  # chars/min (estimated from keystrokes)
    correction_ratio: float  # backspaces / total_keys
    pause_count: int  # pauses >1 second
    session_duration: float  # minutes
    time_of_day: int  # 0=morning, 1=afternoon, 2=evening
    cognitive_load: float  # Estimated [0, 1]
    
    def to_vector(self) -> np.ndarray:
        """Convert to numpy array for bandit input"""
        return np.array([
            self.mean_iki,
            self.std_iki,
            self.typing_speed,
            self.correction_ratio,
            self.pause_count,
            self.session_duration,
            self.time_of_day,
            self.cognitive_load
        ])
```

**Viva line:** “We never need the *text* of what was typed—only timings, pauses, and correction keys—aligned with the proposal’s privacy story.”

### 2.3 Recommendation pipeline (bandit + safety)

```36:77:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\adaptive-scheduler\src\bandit_engine\adaptive_scheduler.py
    def get_recommendation(self, context_features: ContextFeatures) -> Tuple[Tuple[int, int], dict]:
        ...
        context_vector = context_features.to_vector()
        ...
        self.user_state.cognitive_load = context_features.cognitive_load
        
        # Get bandit recommendation
        bandit_action = self.bandit.select_action(context_vector)
        
        # Apply safety constraints
        final_action, was_overridden, override_reason = self.safety.apply_constraints(
            bandit_action, self.user_state
        )
        ...
        metadata = {
            'bandit_action': bandit_action,
            'final_action': final_action,
            'was_overridden': was_overridden,
            'override_reason': override_reason,
            ...
        }
        
        return final_action, metadata
```

**Viva line:** “UCB explores uncertain arms; **safety is a separate layer** that can override the bandit so we don’t recommend a long work block when load or elapsed work time is dangerous.”

### 2.4 Safety constraints (limits + ethics)

Thresholds from config feed into `SafetyConstraints.apply_constraints`:

```36:39:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\adaptive-scheduler\config\config.py
MAX_WORK_DURATION = 90  # minutes
MIN_BREAK_FREQUENCY = 120  # minutes
HIGH_COGNITIVE_LOAD_THRESHOLD = 0.8
```

```37:56:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\adaptive-scheduler\src\bandit_engine\safety_constraints.py
        # Constraint 1: Maximum work duration
        if user_state.continuous_work_time > MAX_WORK_DURATION:
            work_interval = 20  # Force short work
            break_duration = 12  # Force long break
            override_reason = f"Max work duration exceeded ({user_state.continuous_work_time:.1f} min > {MAX_WORK_DURATION} min)"
            return (work_interval, break_duration), True, override_reason
        ...
        # Constraint 3: High cognitive load
        if user_state.cognitive_load > HIGH_COGNITIVE_LOAD_THRESHOLD:
            work_interval = 20  # Force short work
            break_duration = 12  # Force long break
            override_reason = f"High cognitive load detected ({user_state.cognitive_load:.2f} > {HIGH_COGNITIVE_LOAD_THRESHOLD})"
            return (work_interval, break_duration), True, override_reason
```

### 2.5 Reward (matches proposal: progress + relief)

Composite immediate reward and clipping:

```57:75:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\adaptive-scheduler\src\reward_handler\reward_calculator.py
        # Component 1: Task Progress
        r_progress = self._compute_progress_reward(work_interval, user_data)
        
        # Component 2: Post-Break Relief
        r_relief = self._compute_relief_reward(break_duration, user_data)
        
        # Composite immediate reward
        immediate_reward = self.w1 * r_progress + self.w2 * r_relief
        
        # Reward shaping
        immediate_reward = self._apply_reward_shaping(immediate_reward, user_data)
        
        # Clip to [-1, 1] range
        immediate_reward = np.clip(immediate_reward, -1.0, 1.0)
        
        return RewardComponents(
            r_progress=r_progress,
            r_relief=r_relief,
            immediate_reward=immediate_reward
        )
```

Weights in config:

```29:31:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\adaptive-scheduler\config\config.py
REWARD_W1 = 0.6  # Task progress weight
REWARD_W2 = 0.4  # Post-break relief weight
```

**Viva line:** “If they ask *why* 0.6/0.4—it's a **design choice** encoding ‘productivity first but recovery matters’; ablation would vary weights or learn them later.”

### 2.6 Learning step (close the loop)

After reward computation, the **legacy** `/api/end-interval` path updates the bandit and stores the next action:

```357:409:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\adaptive-scheduler\src\api\app.py
    reward_components = reward_calculator.compute_reward(
        last_action.work_interval,
        last_action.break_duration,
        user_data
    )
    ...
    reward = Reward(
        action_id=last_action.action_id,
        immediate_reward=reward_components.immediate_reward,
        r_progress=reward_components.r_progress,
        r_relief=reward_components.r_relief,
        final_reward=reward_components.immediate_reward  # Will update with delayed
    )
    db.add(reward)
    db.commit()
    
    # Update bandit (using immediate reward for now)
    scheduler.update(
        (last_action.work_interval, last_action.break_duration),
        context_features,
        reward_components.immediate_reward
    )
    
    # Get next recommendation (using updated context with new cognitive load)
    next_action, next_metadata = scheduler.get_recommendation(context_features)
    ...
    next_db_action = Action(
        session_id=session_id,
        epoch=session_info['epoch'],
        work_interval=next_action[0],
        break_duration=next_action[1],
        ...
    )
```

**Viva line:** “Feedback is **bandit-style**: one arm pulled, one scalar reward, then **posterior / A-b matrix** update—no long-horizon RL rollout required for a study timer.”

### 2.7 IntentLock integration (cross-subsystem)

Time-block session end accepts IntentLock metadata and persists `IntentLockEvent`:

```596:671:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\adaptive-scheduler\src\api\app.py
@app.route('/api/time-block/end', methods=['POST'])
def end_time_block_session():
    """
    End a time block session (auto-sync + metrics).
    ...
    Optional Intent-Lock metadata (Phase 1 integration):
      - intent_prediction: "impulsive" | "genuine"
      - friction_level: integer (0–2)
      ...
    """
        ...
        if any(
            value is not None
            for value in (
                intent_prediction,
                friction_level,
                intent_exit_event_id,
                intent_reason,
                intent_reason_custom,
            )
        ):
            ...
                event = IntentLockEvent(
                    session_id=session_id,
                    prediction=intent_prediction,
                    friction_level=friction_level,
                    ...
                )
```

**Viva line:** “Scheduler learning and **exit-friction telemetry** can live in one DB story for analysis later.”

---

## 3. “Why not Pomodoro / random / RL?” (Justification)

| Alternative | Weakness for your problem | Your answer |
|-------------|---------------------------|-------------|
| **Fixed Pomodoro** | One context-fits-all; no data-driven personalization | PG metric explicitly compares mean reward to a **25/5 baseline proxy** (`metrics_calculator.py`) |
| **Random breaks** | High regret, no use of load/features | You use **context** + structured arms |
| **Full RL** | Sparse reward, hard to deploy safely, heavy | **Contextual bandit** = myopic but **theoretically grounded** and matches JITAI literature cited in the proposal |

Snippet — PG definition in code:

```102:108:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\adaptive-scheduler\src\metrics\metrics_calculator.py
    def compute_personalization_gain(self, time_range: Optional[Tuple[datetime, datetime]] = None) -> float:
        """
        Compute Personalization Gain (PG)
        
        PG measures per-user improvement over Pomodoro baseline (25/5 minutes)
        
        Formula: PG_u = (μ_bandit - μ_baseline) / μ_baseline
        """
```

---

## 4. LinUCB in one paragraph (if they open `linucb.py`)

For each arm, maintain **A** and **b** (ridge-regularized design matrix and response vector). Score each arm with **estimated mean** `θᵀx` plus **α·confidence width** from `xᵀ A⁻¹ x`. Pick the max. On reward, **update A, b** for that arm only. (See `src/bandit_engine/linucb.py` — `select_action` / `update`.)

**Thompson Sampling caveat (honesty):** `SUPERVISOR_PREP.md` notes the TS path should be **verified against LinTS literature**; say you implemented **Bayesian linear regression sampling**, not a tabular TS.

---

## 5. Validation & metrics (PDF “how do you know it works?”)

**Implemented metric set** (names in `MetricResults`):

```11:21:c:\Users\vihan\Documents\GitHub\Research-project\Completed integration\adaptive-scheduler\src\metrics\metrics_calculator.py
@dataclass
class MetricResults:
    """Container for computed metrics"""
    PG: Optional[float] = None  # Personalization Gain
    RPH: Optional[float] = None  # Regret-per-Hour
    AHL: Optional[float] = None  # Adaptation Half-Life
    EOI: Optional[float] = None  # Exploration Overhead Index
    AUC_BUC: Optional[float] = None  # Area Under Break Utility Curve
    CTU: Optional[float] = None  # Counterfactual Targeting Uplift
    SPF_variance: Optional[float] = None  # Stability-Productivity Frontier variance
    SVR: Optional[float] = None  # Safety-Violation Rate
```

**What to say about CTU:** “CTU needs **counterfactual** or **micro-randomized** probes—we document this as **future work** in `SUPERVISOR_PREP.md`; the other metrics still give a **multi-faceted** picture.”

**Concrete checks tonight:**

1. `python run_server.py` → open `/dashboard` (see `SUPERVISOR_PREP.md`).
2. `GET /api/metrics?user_id=...` after generating sessions (`generate_test_data.py`).
3. Run `pytest tests/test_bandit.py tests/test_reward.py` (or full `tests/` if time).

---

## 6. Privacy (short answer)

Reuse the script from `SUPERVISOR_PREP.md` Q10: **timings and aggregates**, not keystroke content; SQLite local by default (`DATABASE_URL`). Feature extractor uses **key codes for backspace** and **timestamps**, not typed letters.

---

## 7. Likely viva questions — ultra-short answers

- **“Where is exploration?”** → LinUCB confidence term; Thompson samples from posterior.  
- **“What if user doesn’t type?”** → `RewardCalculator` has **neutral / completion proxies** so reward is not degenerate (`_compute_progress_reward` branches).  
- **“Two APIs?”** → `/api/start-session` **vs** `/api/time-block/start` — unified manager path for integrated Next app; know which path your demo uses.  
- **“Hyperparameters?”** → `LINUCB_ALPHA`, `LINUCB_LAMBDA` in `config/config.py` — “sensitivity analysis / grid search” is a fine future-work answer.

---

## 8. Tonight’s 15-minute demo order (from `SUPERVISOR_PREP.md`, compressed)

1. Architecture one-liner + `VISUAL_SUMMARY.md` diagram (mental or on screen).  
2. Start server → hit `/api/health` or `/`.  
3. Start session → show recommendation changes after `end-interval`.  
4. Show **one metric** plot or JSON (e.g. PG or SVR).  
5. Show **one safety override** scenario (describe state: high load → forced short work / long break).

---

## 9. If you blank out — fallback sentence

> “The scheduler is a **contextual bandit over discrete work/break schedules**. It observes an **eight-dimensional** context, receives a **scalar reward** blending **productivity** and **recovery**, updates **per-arm linear statistics**, and applies **hard safety caps** so recommendations stay responsible. Evaluation uses **eight metrics** aligned with our proposal, with **user studies and randomized probes** as the next validation layer.”

Good luck tomorrow.
