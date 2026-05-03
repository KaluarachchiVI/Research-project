# 1 Introduction

## 1.1 Background and Context

Digital study environments increasingly depend on self-regulation. Students use timers, application blockers, and simple analytics tools to organize sessions; however, most consumer tools still implement a static, one-size-fits-all strategy. Typical timers enforce fixed cycles (for example, 25 minutes work and 5 minutes break) based on the generalized assumptions of the Pomodoro technique [@cirillo2006]. Although helpful for basic time structuring, fixed schedules cannot adapt to real-time variation in fatigue, task complexity, motivation, and time-of-day, all of which are well documented as primary drivers of within-session learning quality [@sweller1988; @zerbini2017].

This mismatch produces three practical consequences observed both in prior productivity studies and in the four individual project proposals collected under `25-26J-458-Students/1. Project Proposal/Individual Reports/`. First, fixed breaks may interrupt deep work when the learner is still performing efficiently, wasting the cognitive momentum that mental-fatigue studies identify as a key productivity asset [@dejong2020]. Second, delayed breaks may allow cognitive overload to accumulate, reducing answer quality and increasing error corrections in writing-intensive tasks [@conijn2019]. Third, static systems provide little support for *impulsive* disengagement, where users leave the study context due to distraction rather than genuine necessity, a behavior well characterized in the digital self-control literature [@mark2018; @lyngs2019].

The project **Adaptive Cognitive-Load Study Timer for Personalized Break Scheduling** (Project ID 25-26J-458) addresses these limitations through four integrated subsystems implemented as cooperating microservices in this repository:

1. **Cognitive Load Estimator (CLE)** — `praboth/` — a privacy-first FastAPI service on port 8000 that fuses passive interaction telemetry with low-burden micro-EMA labels using a Kalman-style latent estimator with recursive least-squares (RLS) adaptation.
2. **Adaptive Break Scheduler** — `older/` — a Flask service on port 5000 that selects work/break interval pairs through contextual bandit policies (LinUCB and Thompson Sampling) under a productivity-and-relief reward objective.
3. **Chronotype-aware Time-of-Day Recommender** — `yuvidu/` — a FastAPI service on port 5001 that produces hour-resolution intensity ribbons and weekly study-window suggestions using a `mabwiser` LinUCB policy combined, optionally, with a Gradient Boosting Regressor.
4. **Intent-Lock Overlay** — `newer/andrew/` — a FastAPI backend on port 8001 plus a Next.js modal component that classifies exit attempts as impulsive or genuine and applies graduated friction.

Together, these modules define a closed-loop adaptive system in which sensing informs intervention, intervention outcomes update future policy, and longitudinal patterns guide more stable recommendations over time. The integration surface and runtime layout are summarised in the project's `deployment strategy.md` and in `25-26J-458-Students/6. CheckList Documents/CheckList set 3/Deployment Strategy Document .pdf` [@deploymentdoc2025].

## 1.2 Background Literature Survey

The literature underpinning this dissertation can be grouped into six themes that map directly to the four subsystems.

### 1.2.1 Cognitive load and fatigue in learning tasks

Cognitive load theory frames learning as constrained by finite working-memory resources [@sweller1988]. During prolonged effort, mental fatigue manifests behaviorally through slower response patterns, increased error correction, and reduced sustained attention. Field studies on real-life typing behavior demonstrate consistent fatigue signatures, including increased inter-key intervals (IKI) and rising correction activity as sessions extend [@dejong2020; @acien2022]. These findings motivate software-based, non-intrusive proxies for cognitive state, particularly for educational environments where wearables or eye-trackers are infeasible at scale.

### 1.2.2 Passive interaction sensing as practical instrumentation

Passive sensing through keystroke and pointer metadata is attractive because it avoids specialized hardware and can run in naturalistic environments [@nguyen2023]. Mouse-only and keystroke-only fatigue or workload classifiers have reported AUCs in the 0.72–0.85 range under controlled conditions [@arshad2013; @acien2022]. Compared with camera or wearable approaches, software-level event metadata reduces cost and deployment friction while preserving acceptable fidelity for adaptation tasks [@ahmed2020]. Critically, the *type* of writing task changes keystroke distributions, which means that a generic single-population model is unlikely to generalise; per-user baselines are needed [@conijn2019].

### 1.2.3 EMA and micro-EMA for low-burden ground truth

Subjective labelling remains important because cognitive load is partly internal and context-dependent. Traditional multi-item Ecological Momentary Assessment (EMA) can be intrusive; *micro-EMA* designs reduce burden by using single-question interactions with sub-five-second response times [@king2019; @intille2016]. Micro-randomized trials have further demonstrated that brief, contextually-triggered prompts can support causal estimation of intervention effects without saturating users [@klasnja2015]. EMA studies in cognitive aging populations confirm that intermittent self-report remains valuable when paired with passive sensing [@crawford2022]. This trade-off is critical for long-term deployment: fewer interruptions improve adherence while still enabling periodic model recalibration. NASA-TLX [@nasatlx1986] complements micro-EMA as a periodic ground truth instrument at session boundaries.

### 1.2.4 Contextual bandits for adaptive interventions

Contextual bandits provide a mathematically grounded framework for sequential intervention decisions with immediate feedback [@lan2016; @lei2017]. In educational and mHealth settings, bandits balance exploration and exploitation efficiently when full reinforcement-learning horizons are unnecessary [@hunziker2020; @qin2022]. Recent IEEE work shows contextual bandits can drive adaptive sequence learning at scale [@chen2023icdm], with intelligent tutoring system (ITS) surveys demonstrating their viability for online educational decisions [@jedm2015bandits]. Newer feature-engineering approaches at LAK 2024 show that expert-derived features can substantially shorten warm-up time [@lak2024bandit], while UMAP-2023 introduces dynamic linear ε-greedy variants that adapt their exploration schedule to context volatility [@umap2023epsilon]. The Open Bandit Dataset further supports offline counterfactual evaluation when live deployments are unavailable [@openbandit2023]. This project adopts bandits because break recommendation is inherently contextual, short-horizon, and user-specific. The reference implementation in `older/` uses both LinUCB (`older/src/bandit_engine/linucb.py`) and Thompson Sampling (`older/src/bandit_engine/thompson_sampling.py`); the chronotype service in `yuvidu/` uses the `mabwiser` LinUCB policy [@mabwiser2019].

### 1.2.5 Chronotype and time-of-day synchronization

Chronotype literature consistently reports performance differences based on alignment between individual circadian preference and task timing [@zerbini2017; @preckel2011; @goldin2017; @goldstein2023]. Longitudinal alignment studies further indicate practical educational impact when schedules better match chronotype profiles [@vollmer2023]. Despite this evidence, mainstream study tools rarely operationalize chronotype in adaptive recommendation logic; in this project the operationalisation is implemented as four time-of-day arms (morning/afternoon/evening/night) augmented by the `sleep_hours_prev_night` feature in the bandit context (see `yuvidu/backend/bandit_model.py`).

### 1.2.6 Digital self-control and friction-based design

Distraction mitigation research in HCI and digital well-being suggests that strict blocking can produce resistance, whereas reflective friction can reduce impulsive behavior while maintaining autonomy [@mark2018; @lyngs2019; @matthies2023; @kim2019]. The "one sec" intervention reported a 57% reduction in reflexive social-media opens through a single brief reflective pause [@matthies2023]. Affective-state computation work also argues for lightweight in-the-loop classifiers that can drive context-aware UI behavior without heavy dependencies [@dmello2015]. For study systems, this implies interventions should be graduated and context-aware rather than binary. Self-regulation development research further supports awareness-based interventions for younger learners and university students alike [@duckworth2016; @zhou2020].

## 1.3 Current Practice and Technical Baseline

Beyond the literature, the dissertation builds on a concrete, running multi-service implementation. The implementation deltas from common consumer baselines are summarised below using only what is actually present in the codebase under inspection (rather than aspirational claims):

- **CLE service** (`praboth/backend/`, FastAPI on port 8000): rolling 60-second feature windows with 15-second hop (`praboth/backend/src/core/config.py`); a 14-dimensional feature vector composed of seven keyboard, four pointer, and three system features (`praboth/backend/src/services/processing/features.py`); a Huber-clipped exponentially-weighted rolling normalizer (`praboth/backend/src/services/processing/normalization.py`); a scalar Kalman filter with RLS-adapted observation weights (`praboth/backend/src/services/kalman.py`); active micro-EMA prompting driven by 90th-percentile variance thresholds and breakpoint gating (`praboth/backend/src/services/ema.py`); a `/stream/state` Server-Sent Events feed; and explicit `/privacy`, `/consent`, `/permissions`, `/policy/events`, `/distractions`, and `/export/*` endpoints.
- **Scheduler service** (`older/src/`, Flask on port 5000): a 16-arm action set defined as the Cartesian product of four work intervals `{20, 30, 45, 60}` minutes and four break durations `{3, 5, 8, 12}` minutes (`older/config/config.py`); an 8-dimensional context vector built from typing dynamics, session duration, time-of-day, and the CLE-derived load (`older/src/feature_extractor/feature_extractor.py`); LinUCB and Thompson Sampling policies; reward `R = 0.6 R_{progress} + 0.4 R_{relief}` shaped by deep-work and EMA quality bonuses, with optional `0.7 immediate + 0.3 delayed` blending (`older/src/reward_handler/reward_calculator.py`); and the eight planned evaluation metrics — Personalisation Gain (PG), Regret-per-Hour (RPH), Adaptation Half-Life (AHL), Exploration Overhead Index (EOI), Break Utility Curve (BUC) and AUC-BUC, Counterfactual Targeting Uplift (CTU), Stability–Productivity Frontier variance (SPF-Var), and Safety Violation Rate (SVR) — implemented in `older/src/metrics/metrics_calculator.py`.
- **Chronotype/heatmap service** (`yuvidu/backend/`, FastAPI on port 5001): `mabwiser` LinUCB with `alpha=1.25` over four time-of-day arms; an optional weekly hybrid using a `GradientBoostingRegressor` over `(context + day-one-hot) → reward` with weekend/weekday multipliers (`yuvidu/backend/bandit_model.py`); and a 24-hour single-row intensity ribbon visualisation in `yuvidu/frontend/src/ui/components/Heatmap.tsx`. The repository's `yuvidu/OLD-VS-NEW-YUVIDU.md` declares the root `yuvidu/` directory canonical relative to the legacy `newer/yuvidu/` Next.js app.
- **Intent-Lock service** (`newer/andrew/intentlock-backend/`, FastAPI on port 8001): a single `LogisticRegression` classifier over two features (`session_minutes`, `latent_mean`), trained on 500 synthetic samples generated with a `Beta(2,3)` distribution for cognitive load and a piecewise uniform distribution for session length (`data/synthetic_data_generator.py`); three friction levels (0/1/2) selected by `count_impulsive_exits(session_id)` (`main.py`); and the `IntentLockModal.tsx` overlay component used in `intentlock-frontend/app/page.tsx`.
- **Web UI** (`praboth/frontend/` and `newer/andrew/intentlock-frontend/`): Next.js applications on port 3000 with sparkline visualisations of load and residual, an EMA prompt panel, and an Intent-Lock overlay mounted at the application root.
- **Edge component** (`praboth/backend/src/tools/os_hooks.py`): a Python `pynput` and `SetWinEventHook` client packaged as the `cle-os-hooks` console script. Events are sent over HTTP POST to the CLE `/events` endpoint; no WebSocket transport is used.

This baseline establishes that the dissertation is not purely conceptual; it is tied to an implemented and integrable software architecture. Where proposals describe richer designs that have not yet been implemented (for example, a Decision Tree classifier alternative for Intent-Lock, a Morningness-Eveningness Questionnaire for chronotype priors, or OS-wide application-switch interception), this dissertation labels them as **designed but not yet implemented** and discusses them under future work in Chapter 4.

## 1.4 Research Gap Analysis

Despite extensive literature across sensing, adaptive scheduling, and self-control tools, gaps remain at the *integration* level. Each gap row in Table 1.1 maps to a concrete code location.

**Table 1.1 — Research gap analysis with project response and code anchor.**

| Gap ID | Gap Description | Evidence from Literature/Tools | Project Response | Code Anchor |
|---|---|---|---|---|
| G1 | Static timer policies dominate consumer practice | Pomodoro and clones rely on fixed intervals [@cirillo2006] with negligible context awareness | Contextual-bandit scheduler with 16-arm action space and 8-D context | `older/src/bandit_engine/linucb.py`, `older/src/bandit_engine/thompson_sampling.py` |
| G2 | Single-modality sensing reduces robustness | Passive-only [@dejong2020] or survey-only EMA [@king2019] each have known blind spots | Dual-signal fusion: passive interaction features + micro-EMA via Kalman+RLS | `praboth/backend/src/services/kalman.py`, `praboth/backend/src/services/ema.py` |
| G3 | Chronotype rarely operationalised in adaptive timing | Chronotype effect is well established [@zerbini2017; @vollmer2023] but consumer apps ignore it | LinUCB over time-of-day arms, sleep-history context, and weekly GBR hybrid | `yuvidu/backend/bandit_model.py`, `yuvidu/frontend/src/ui/components/Heatmap.tsx` |
| G4 | Binary blocking produces disuse [@mark2018] or rebound | Strict blockers and unrestricted exits both fail [@lyngs2019] | Predictive impulsive-vs-genuine classifier with three-level graduated friction and reflection logging | `newer/andrew/intentlock-backend/main.py`, `newer/andrew/intentlock-backend/models/model.py`, `newer/andrew/intentlock-frontend/components/IntentLockModal.tsx` |
| G5 | Narrow evaluation: cumulative regret only | Most bandit studies report regret in isolation [@qin2022] | Multi-axis metrics: PG, RPH, AHL, EOI, AUC-BUC, CTU, SPF-Var, SVR | `older/src/metrics/metrics_calculator.py` |
| G6 | Limited deployment realism | Many prototypes ignore OS-level capture and edge–cloud constraints | Hybrid edge–cloud architecture with explicit edge agent and containerised services | `praboth/backend/src/tools/os_hooks.py`, `25-26J-458-Students/6. CheckList Documents/CheckList set 3/Deployment Strategy Document .pdf` [@deploymentdoc2025] |

## 1.5 Problem Statement

### 1.5.1 Main Problem

Learners currently lack an integrated, privacy-preserving, and non-intrusive study-support system that adapts interventions to fluctuating cognitive load, chronotype rhythms, and distraction intent, causing inefficient study timing, unstable focus continuity, and avoidable fatigue accumulation.

### 1.5.2 Component-Level Sub-Problems

- **SP1 (CLE):** How to estimate cognitive load continuously from interaction metadata without storing sensitive typed content, and how to keep that estimate calibrated despite long idle periods, application context switches, and inter-user typing-style variation.
- **SP2 (Scheduler):** How to personalise work-break interval pairs online, under uncertainty, with bounded exploration cost in early sessions, while keeping the policy auditable through interpretable per-arm statistics.
- **SP3 (Chronotype):** How to convert sparse temporal performance history into actionable recommendation priors that survive irregular study schedules and extend coherently from short windows (current next-best-window) to longer horizons (weekly view).
- **SP4 (Intent-Lock):** How to reduce impulsive exits while preserving user autonomy for genuine exits, using lightweight features that are already available within the running CLE/Scheduler stack.

### 1.5.3 Research Questions

1. Which passive interaction features and micro-EMA calibration strategy most reliably estimate within-user cognitive load during real desktop study sessions, given a 60-second window and 15-second hop?
2. Which contextual bandit policy (LinUCB vs Thompson Sampling) provides the best balance of adaptation speed and short-term intervention cost over the 16-arm action space defined for break scheduling?
3. How much does chronotype-informed initialisation, realised through time-of-day arms and sleep-history context, reduce cold-start instability in the first 5–10 sessions of adaptive recommendation?
4. Can a two-feature `LogisticRegression` classifier combined with three-level graduated friction reduce impulsive exits without raising user-reported intrusiveness above acceptable thresholds?
5. How does the integrated system compare with fixed and random baselines on productivity, fatigue, intrusiveness, and a multi-axis metric set (PG, RPH, AHL, EOI, AUC-BUC, CTU, SPF-Var, SVR)?

## 1.6 Research Objectives

### 1.6.1 Main Objective

To design, implement, and evaluate an integrated adaptive study-support framework that combines cognitive load estimation, contextual break scheduling, chronotype-aware recommendation, and intent-aware distraction prevention, deployed as cooperating services with explicit privacy controls.

### 1.6.2 Specific Objectives

1. **O1 — CLE:** Build a privacy-first dual-signal CLE pipeline using a 14-dimensional passive feature vector, robust normalisation, scalar Kalman + RLS state estimation, and uncertainty-aware micro-EMA prompting.
2. **O2 — Scheduler:** Implement and compare LinUCB and Thompson Sampling contextual bandits over a 16-arm `(work, break)` grid with a productivity-and-relief reward and an eight-metric evaluation harness.
3. **O3 — Chronotype:** Develop a chronotype-aware heatmap subsystem with `mabwiser` LinUCB over time-of-day arms and an optional weekly hybrid using a Gradient Boosting Regressor for stable recommendation priors and interpretable visualisation.
4. **O4 — Intent-Lock:** Design and evaluate an intent-lock overlay with `LogisticRegression` impulsive/genuine classification over `(session_minutes, latent_mean)` and three-level friction escalation governed by `count_impulsive_exits`.
5. **O5 — Integration & Evaluation:** Define and apply technical and user-centred metrics for integrated comparative evaluation against fixed and random baselines using the eight-metric harness.
6. **O6 — Deployment:** Produce a deployment-ready modular architecture with clear edge–cloud boundaries, explicit API integration contracts, and a documented hybrid Docker-Compose / Kubernetes path.

## 1.7 Objective-to-Question Mapping

**Table 1.2 — Mapping between research questions and specific objectives.**

| Research Question | Primary Objective | Code Anchor |
|---|---|---|
| RQ1 — Passive features & EMA calibration | O1 | `praboth/backend/src/services/processing/features.py` |
| RQ2 — LinUCB vs Thompson | O2 | `older/src/bandit_engine/*` |
| RQ3 — Chronotype warm-start | O3 | `yuvidu/backend/bandit_model.py` |
| RQ4 — Friction without intrusiveness | O4 | `newer/andrew/intentlock-backend/main.py` |
| RQ5 — Integrated comparison | O5, O6 | `older/src/metrics/metrics_calculator.py`, `25-26J-458-Students/6. CheckList Documents/CheckList set 3/Deployment Strategy Document .pdf` |

## 1.8 Scope, Assumptions, and Delimitations

### Scope

- Student self-study context on Windows desktops/laptops (the OS hooks client uses Windows event APIs in addition to cross-platform `pynput`).
- Software-only sensing via keyboard, pointer, and session metadata captured at the edge and forwarded over HTTP.
- Local-first data handling (SQLite + JSONL consent log) with optional cloud-compatible deployment per the project deployment strategy.

### Assumptions

- Users can provide periodic micro-EMA responses on a 1–7 Likert scale (the implemented prompt panel uses this range).
- Session metadata and behaviour proxies are sufficiently informative for adaptation in the absence of physiological wearables.
- Pilot (5–10) and full-study (20–30) participant cohorts can be recruited from the SLIIT student population.

### Delimitations

- No physiological wearables, EEG, or camera-based continuous tracking.
- No claim of universal academic performance improvement without extended trials.
- Initial deployment focus on desktop/laptop workflows before mobile parity.
- Proposed components that the codebase has not yet implemented (Decision Tree alternative for Intent-Lock, MEQ-style chronotype questionnaire, OS-wide application-switch interception) are described in Chapter 2 and treated as future work in Chapter 4.

## 1.9 Significance of the Study

This dissertation contributes at both academic and practical levels. Academically, it unifies four research threads often studied in isolation: cognitive load sensing [@sweller1988; @dejong2020], adaptive scheduling [@lan2016; @hunziker2020], chronotype timing [@zerbini2017; @vollmer2023], and digital self-control friction [@mark2018; @lyngs2019; @matthies2023]. Practically, it offers a deployable blueprint for study-support systems that are personalised, explainable, and privacy-aware, with explicit interfaces, metric harnesses, and a documented deployment path that the four-student team has executed within a single semester [@deploymentdoc2025].

## 1.10 Chapter Summary

Chapter 1 established the motivation, literature foundation, and formal research framing for project 25-26J-458, including a six-gap analysis grounded in concrete code locations within `praboth/`, `older/`, `newer/andrew/`, and `yuvidu/`. Chapter 2 details the technical and experimental methodology in depth; Chapter 3 presents results and interpretation; Chapter 4 concludes with recommendations and future directions.
