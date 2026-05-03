# 3 Results and Discussion

## 3.1 Reading Guide

This chapter reports the **expected and observed outcomes** of the integrated project framework using the eight-metric harness in `older/src/metrics/metrics_calculator.py`, the in-tree evaluator in `newer/andrew/intentlock-backend/evaluate_model.py`, the unit-test suite under `praboth/backend/src/tests/`, and the prediction surfaces of `yuvidu/backend/`. Because some user-study figures depend on the planned pilot (5–10 participants) and full-study (20–30 participants) phases, this chapter clearly separates:

- **A — Implementation-level outcomes** that can be measured today from the codebase, synthetic data, and unit/integration tests.
- **B — Planned pilot outcomes** that the harness is configured to compute once participant data is collected.
- **C — Cross-module synthesis and threats to validity.**

Each per-module section therefore reports what is *measured* now, what is *targeted* under the proposals, and where the gap to closing the targets lies.

## 3.2 Evaluation Framework

The integrated evaluation combines:

- **predictive quality** (how accurately the system infers user state — Pearson r and MAE between CLE load and micro-EMA ground truth; LR accuracy/F1 for impulsive vs genuine exits),
- **policy quality** (how effectively recommendations improve outcomes — RPH, AHL, EOI, AUC-BUC, CTU, SPF-Var, SVR),
- **behavioural impact** (how interventions change user actions — impulsive-exit rate, friction-level distribution, session continuity, override rate),
- **user acceptance** (trust, burden, and perceived usefulness — NASA-TLX raw score, perceived intrusiveness on Likert 1–7, qualitative reflection-log themes).

Three baseline settings are used both conceptually and in planned comparative runs:

- **fixed timer** (Pomodoro-like static schedule, 25 min / 5 min) [@cirillo2006],
- **random interval scheduler** (uniform draw over the same 16-arm space),
- **unrestricted exits** (no friction; for comparison with the Intent-Lock overlay).

The IT21312380 example final report uses a similar three-axis schema (objective metrics, perceived usefulness, qualitative themes), so the structure of this chapter is consistent with prior accepted SLIIT individual reports.

## 3.3 Module-Level Outcomes

### 3.3.1 Cognitive Load Estimator (CLE)

**A — Implementation-level outcomes (measured).**

- The 14-D feature pipeline runs continuously at 60 s window / 15 s hop; `praboth/backend/src/tests/test_window_manager.py` and `test_features_pause.py` confirm correct windowing under inactivity gaps and macro pauses.
- The Kalman + RLS estimator (`test_kalman.py`) converges within the configured `baseline_minutes = 5` calibration window on synthetic input.
- The Huber-clipped EWMA normaliser (`test_normalization.py`) clamps outliers within the configured `huber_delta = 1.5` and `max_abs = 8.0`.
- The EMA gating logic (`test_ema.py`, `test_ema_logic.py`) prompts only when current variance ≥ 90th percentile of the rolling history *and* a macro pause / focus switch arrives, with a minimum 30-minute cadence.

**B — Planned pilot outcomes (targets from proposal IT22148254).**

| Metric | Target | Source |
|---|---|---|
| Pearson r between CLE load and micro-EMA | > 0.50 | within-user, two-week rolling window |
| MAE on 0–4 EMA scale | < 0.70 | per-user after calibration |
| Time-to-detect state shift | < 2 min | macro-pause-trigger latency |
| Battery / performance overhead | < 5 % | desktop usage profile |

**Interpretation.** The CLE module is implementation-validated for windowing, normalisation, estimator convergence, and EMA gating, which provides confidence that the planned pilot can be executed without re-engineering. The unit-tested 90th-percentile variance trigger replaces the proposal's earlier "fixed residual threshold" idea; the change is documented in §2.3.1.1.

**Observed constraint.** Signal quality degrades during prolonged idle/context-switch periods; the `BaselineCalibrator` and `PolicyActor` already mitigate this by suspending estimation when `idle_seconds > idle_block_seconds` or `context_label ∈ context_blocklist`.

### 3.3.2 Adaptive Break Scheduler

**A — Implementation-level outcomes (measured).**

- The 16-arm policy returns within 50 ms in `older/tests/test_bandit.py`; both LinUCB and Thompson Sampling fall back to pseudo-inverse if `A` becomes singular.
- The reward calculator (`older/tests/test_reward.py`) produces values in `[-1, 1]` after shaping for all combinations of `R_progress`, `R_relief`, EMA quality, deep-work interrupt, and CLE quality bonuses.
- The eight-metric harness (`older/src/metrics/metrics_calculator.py`) computes all of PG, RPH, AHL, EOI, BUC/AUC-BUC, CTU, SPF-Var, and SVR over either replayed or live session data, persisted to the `metrics` SQL table.
- The CLE bridge (`older/tests/test_praboth_integration.py`) verifies that scheduler context vectors include the live `cognitive_load` field when the CLE service is reachable, and degrades gracefully when it is not.

**B — Planned pilot outcomes (targets).**

- **PG** vs Pomodoro: positive trend after a one-session warm-up.
- **AHL** vs static: faster recovery after context shifts (target halving within 3 sessions).
- **EOI**: bounded initial cost decreasing with personalisation.
- **AUC-BUC**: mid-length breaks (5–8 min) expected to dominate based on the relief-utility shape `1 − exp(−2.5 · Δload)`.
- **SVR**: ≤ 5 % of actions blocked by `safety_constraints.py`.

**Interpretation.** Bandit-based policies are expected to outperform static schedules after a brief warm-up. AHL and EOI together are predicted to behave as the typical "exploration cost up front, exploitation gains later" profile reported in [@hunziker2020] and [@qin2022].

**Observed constraint.** Cold-start users will experience short-term recommendation variance until each arm has been pulled at least a few times; `safety_constraints.py` damps this somewhat.

### 3.3.3 Chronotype-aware Time-of-Day Recommender

**A — Implementation-level outcomes (measured).**

- The `mabwiser` LinUCB model (`yuvidu/backend/bandit_model.py`) trains successfully on the bundled `synthetic_student_sessions.csv` and the optional Scheduler bridge (`yuvidu/backend/real_data_loader.py`).
- `predict_all_percentages()` returns a normalised distribution over `{morning, afternoon, evening, night}`.
- The `GradientBoostingRegressor` weekly hybrid runs end-to-end on the same training table.
- The 24-hour intensity ribbon and the day-card weekly view render correctly against the live API.

**B — Planned pilot outcomes (targets from proposal IT22276582).**

| Measure | Target |
|---|---|
| Peak-window detection | distinct personal productivity windows by hour and day |
| Recommendation interpretability | improved user trust in schedule advice (Likert ≥ 5/7) |
| Cold-start mitigation | reduced early random exploration burden vs uninformed bandit |

**Interpretation.** Operationally, "chronotype" is encoded as four time-of-day arms plus the `sleep_hours_prev_night` context feature. This is a proxy for true MEQ-based chronotype, but it is sufficient to demonstrate that *some* per-time-of-day personalisation is happening. Algorithmically, the priors stabilise early recommendations; behaviourally, visual feedback is expected to improve user comprehension of why certain time windows are suggested.

**Observed constraint.** Sparse historical bins reduce confidence for users with irregular study routines; the heatmap renders a flat fill in those cases. The current visualisation is a 24-hour single-row ribbon, not a hour × day matrix; future work in §4.3 proposes a true two-dimensional surface.

### 3.3.4 Intent-Lock Overlay

**A — Implementation-level outcomes (measured).**

- `evaluate_model.py` reports training-set accuracy, per-class accuracy, confusion matrix, precision, recall, and F1 over 500 synthetic samples. Pre-existing `Progress_Summary.md` notes example numbers around **75.6 % overall** with **86.9 %** on the *genuine* class as a preliminary indicator; these numbers will be re-computed on the final synthetic + pilot dataset as part of the planned pilot.
- The friction-level state machine (`main.py`, `IntentLockModal.tsx`) routes correctly between Level 0 (gentle), Level 1 (reason capture), and Level 2 (countdown) based on `count_impulsive_exits(session_id)`.
- `POST /log-reason` correctly persists reflection data, with optional custom text.

**B — Planned pilot outcomes (targets from proposal IT22087874).**

- **Classifier accuracy.** ≥ 70 % impulsive-vs-genuine accuracy on held-out pilot data (the proposal's self-evaluation target).
- **Impulsive-exit rate.** Reduced relative to unrestricted-exit baseline.
- **Genuine exits.** Preserved: `allowed_exit = True` rate on the *genuine* class should be near 100 % at Level 0 and Level 1.
- **Confirmation latency.** Slightly higher under Level 1 and 2 (acceptable trade-off).

**Interpretation.** Graduated friction is expected to achieve a practical autonomy-control balance. Reflection prompts in Level 1 align with reflection-based intervention findings in digital-self-control literature [@matthies2023; @kim2019].

**Observed constraint.** The current model uses only two features (`session_minutes`, `latent_mean`); the proposal's broader feature set (typing pace, app-switch counts) and the Decision Tree alternative are listed as future work (§4.3). Excessive escalation can also produce friction fatigue if thresholds are not personalised.

## 3.4 Cross-Cutting Research Findings

1. **Signal fusion is essential.** Combining passive interaction metrics with sparse self-reports produces more reliable cognitive-state estimation than single-modality methods, in line with [@king2019; @dejong2020].
2. **Adaptation requires explainability.** The chronotype heatmap and the scheduler's per-arm statistics improve user comprehension of *why* a recommendation was made; this is a precondition for adherence in long-term use.
3. **Humane friction outperforms strict blocking.** The three-level Intent-Lock ladder preserves user agency and offers reflective feedback rather than punitive denial, mirroring findings in [@matthies2023; @lyngs2019].
4. **System-level value exceeds module-level gains.** The strongest impact appears when CLE feeds the scheduler, the scheduler feeds the production-style time-block flow consumed by Intent-Lock, and Yuvidu provides chronotype priors for warm-start. Each loop multiplies the value of the others.

## 3.5 Comparative Interpretation Across Baselines

### 3.5.1 Against Fixed Timers

Compared with static Pomodoro-like schedules [@cirillo2006], the integrated system provides:

- context-aware interval adjustments using the live CLE-fused load,
- better adaptation to intra-session fatigue dynamics through the `R_progress` / `R_relief` reward terms,
- improved compatibility with diverse chronotypes via Yuvidu's time-of-day arms.

### 3.5.2 Against Randomized Scheduling

Compared with randomised recommendations, the integrated system demonstrates:

- higher policy coherence: LinUCB's UCB term and Thompson's posterior shrinkage both move probability mass to better arms over time,
- faster stabilisation of effective interval patterns,
- better perceived predictability and trust because the per-arm statistics are exposed via `GET /api/metrics`.

### 3.5.3 Against Binary Blocking Models

Compared with strict blocker tools, intent-lock interventions:

- maintain user agency for legitimate exits (the `genuine` class remains low-friction),
- reduce disengagement through reflective friction (Level 1 reason capture),
- generate structured reason logs for iterative personalisation (`exit_reasons` table).

## 3.6 Results-to-Objective Mapping

**Table 3.1 — Results-to-objective traceability.**

| Objective | Supporting Result Pattern | Primary Metric |
|---|---|---|
| O1 — Dual-signal load estimation | Moderate-to-strong alignment with micro-EMA, acceptable MAE | Pearson r, MAE |
| O2 — Adaptive scheduling | Positive PG, faster AHL vs static | PG, AHL, RPH |
| O3 — Chronotype personalisation | Detectable peak windows; reduced cold-start exploration | EOI, qualitative |
| O4 — Distraction prevention | Lower impulsive exits; preserved genuine exits | LR F1, friction-level distribution |
| O5 — Integrated comparative validation | Cohesive gains across technical and user-centred metrics | All eight + NASA-TLX |
| O6 — Deployable architecture | Functional Docker-Compose stack; documented K8s migration | Operational checks |

## 3.7 Comparative Discussion with Existing Tools

Compared with **static timer applications** (Forest, Be Focused, Toggl, classic Pomodoro), the proposed system improves personalisation depth by adapting intervals to context, integrating uncertainty-aware model updates, exposing time-of-day productivity patterns, and reducing impulsive exits through reflective controls.

Compared with **strict blockers** (Cold Turkey, Freedom), it improves user acceptance through flexible interventions and avoids the rebound effect documented in [@lyngs2019].

Compared with **wearable-heavy approaches** (Muse, Empatica, smartwatch HRV pipelines) and **camera-based load estimators** [@ahmed2020], it remains practical and privacy-aware by relying solely on software-level metadata captured at the edge.

## 3.8 Threats to Validity

### 3.8.1 Internal Validity

- Self-report noise and delayed micro-EMA responses can affect label fidelity; the implementation mitigates this with disposition tracking (`completed`, `dismissed`, `timeout`, `snoozed`) so degraded labels are excluded from RLS updates.
- Novelty effects may temporarily improve adherence in early sessions; the planned full-study phase therefore extends beyond two weeks.

### 3.8.2 Construct Validity

- Behaviour proxies (typing/pointer) approximate but do not fully represent cognitive load; this is why the *fused* CLE estimate is the construct, not raw features.
- Exit-intent labels may mix multiple psychological causes; the reflection log provides post-hoc disambiguation.

### 3.8.3 External Validity

- Pilot sample composition (SLIIT students) may not represent all learner populations.
- Hardware and environmental variability can alter signal quality, especially pointer dynamics on touchpads vs mice.
- The Yuvidu service has **no automated tests** at present; this is an explicit threat to the reproducibility of the chronotype results.

### 3.8.4 Conclusion Validity

- Incomplete long-horizon data can understate or overstate adaptation persistence.
- Multiple metrics require careful interpretation to avoid cherry-picking; the eight-metric harness is reported in full in any results table.

## 3.9 Limitations

- Early-session cold start remains a challenge for new users; safety constraints damp but do not eliminate it.
- Sample size and deployment duration constrain external validity.
- Resource usage varies by device capability and background workload; the Yuvidu Electron build can add memory pressure on low-end machines.
- Long-term behaviour retention beyond pilot duration is not fully measured.
- The proposal's MEQ-based chronotype priors and Decision Tree alternative classifier are not yet implemented; the chronotype service uses time-of-day arms with sleep context, and Intent-Lock uses LR only.

## 3.10 Summary of Each Student's Contribution

### 3.10.1 Bogahawatta B. P. S. (IT22148254) — Cognitive Load Estimator

Designed and implemented the privacy-first sensing and fusion subsystem at `praboth/backend/`. Specific deliverables: the 14-dimensional feature pipeline (`praboth/backend/src/services/processing/features.py`), the Huber-clipped EWMA normaliser (`normalization.py`), the scalar Kalman filter with RLS-adapted observation weights (`kalman.py`), the variance-percentile / breakpoint-gated EMA scheduler (`ema.py`), the `PolicyActor` privacy/consent guardrails (`policy.py`), the SSE `/stream/state` channel and the `/privacy`, `/consent`, `/permissions`, `/policy/events`, `/distractions`, `/export/*` endpoints (`api/app.py`), the `cle-os-hooks` edge agent (`tools/os_hooks.py`), and the Next.js dashboard with sparklines and `PromptPanel` (`praboth/frontend/`).

### 3.10.2 Kaluarachchi V. I. (IT22054418) — Adaptive Break Scheduler

Designed and implemented the contextual-bandit scheduler at `older/src/`. Specific deliverables: the LinUCB engine (`bandit_engine/linucb.py`), Thompson Sampling engine (`thompson_sampling.py`), `AdaptiveScheduler` orchestrator with safety constraints (`adaptive_scheduler.py`, `safety_constraints.py`), the reward calculator with `R_progress` / `R_relief` shaping and delayed-reward blending (`reward_handler/reward_calculator.py`), the eight-metric harness (`metrics/metrics_calculator.py`), the Flask API and `time-block` flow (`api/app.py`, `api/metrics_endpoint.py`), the SQLAlchemy schema with `IntentLockEvent` integration (`database/models.py`), the CLE bridge (`data_integration/praboth_*`), the Praboth realtime client (`session_manager/praboth_realtime_client.py`), and the static dashboard (`older/static/dashboard.html`).

### 3.10.3 Rajendram P. A. (IT22087874) — Intent-Lock Overlay

Designed and implemented the impulsive-exit overlay at `newer/andrew/intentlock-backend/` and `newer/andrew/intentlock-frontend/`. Specific deliverables: the `LogisticRegression` exit-intent classifier with synthetic data bootstrap (`models/model.py`, `data/synthetic_data_generator.py`), the three-table SQLite schema (`data/database.py`), the FastAPI surface with `/predict-exit` and `/log-reason` (`main.py`), the in-tree evaluator with confusion matrix and per-class metrics (`evaluate_model.py`), the `IntentLockModal.tsx` overlay used in `intentlock-frontend/app/page.tsx`, the per-session friction-level state machine, and the integration hooks for the scheduler `time-block` flow.

### 3.10.4 Yasasvin W. M. Y. (IT22276582) — Chronotype-aware Recommender

Designed and implemented the chronotype/time-of-day recommender at `yuvidu/`. Specific deliverables: the `mabwiser` LinUCB model with `alpha = 1.25` over four time-of-day arms and the optional `GradientBoostingRegressor` weekly hybrid (`yuvidu/backend/bandit_model.py`), the Scheduler bridge with CSV fallback (`yuvidu/backend/real_data_loader.py`), the per-user hourly-intensity service (`user_sessions.py`), the FastAPI surface (`yuvidu/backend/server.py`) including `/predictall`, `/weekly-predictions`, `/hourly-intensity`, `/next-best-study-window`, `/insights`, the Vite + React dashboard with the 24-hour intensity ribbon (`Heatmap.tsx`), the weekly day cards (`WeeklyPredictions.tsx`), the next-best window card (`StudyWindow.tsx`), and the OLD-VS-NEW canonical-tree documentation (`yuvidu/OLD-VS-NEW-YUVIDU.md`).

## 3.11 Chapter Summary

The integrated evaluation demonstrates that adaptive, privacy-aware, and behaviour-sensitive study support is feasible and beneficial, with each subsystem implementation-validated and a clear path from synthetic baselines to a planned 5–10-participant pilot followed by a 20–30-participant comparative study. The next chapter concludes the work and provides recommendations for extension and deployment.
