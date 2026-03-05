# Metrics and Reward Calculations Guide

This document provides detailed explanations of all calculations used in the Adaptive Scheduler system, including formulas, expanded metric names, and step-by-step computation procedures.

---

## 📊 Reward Calculation

### Overview
The reward function combines two components: **Task Progress** and **Cognitive Load Relief**, weighted and shaped to provide feedback to the contextual bandit algorithm.

### Formula

```
R = w1 × r_progress + w2 × r_relief + shaping_bonuses - shaping_penalties
```

Where:
- `w1` = 0.6 (weight for task progress)
- `w2` = 0.4 (weight for load relief)
- Final reward is clipped to range [-1.0, 1.0]

---

### Component 1: Task Progress Reward (r_progress)

**Full Term:** Task Progress Component  
**Purpose:** Measures productivity during work interval

**Formula:**
```
r_progress = 0.6 × normalized_speed + 0.4 × normalized_focus
```

**Step-by-Step Calculation:**

1. **Typing Speed Normalization:**
   ```
   chars_per_min = chars_typed / work_interval_minutes
   normalized_speed = min(chars_per_min / 200.0, 1.0)
   ```
   - Assumes maximum typing speed of 200 characters/minute
   - Clipped to [0, 1] range

2. **Focus Duration Normalization:**
   ```
   focus_duration = time_without_pauses > 2_seconds
   normalized_focus = focus_duration / work_interval_minutes
   ```
   - Focus = time without gaps > 2 seconds between keystrokes
   - Normalized by work interval duration

3. **Combined:**
   ```
   r_progress = 0.6 × normalized_speed + 0.4 × normalized_focus
   r_progress = clip(r_progress, 0.0, 1.0)
   ```

---

### Component 2: Load Relief Reward (r_relief)

**Full Term:** Post-Break Cognitive Load Relief Component  
**Purpose:** Measures effectiveness of break in reducing cognitive load

**Formula:**
```
r_relief = confidence_factor × (load_pre - load_post)
```

**Step-by-Step Calculation:**

1. **Cognitive Load Delta:**
   ```
   delta_load = cognitive_load_pre_break - cognitive_load_post_break
   ```
   - Uses praboth cognitive load estimates (from Kalman filter)
   - Positive delta = load reduction = good

2. **Confidence Weighting (if variance available):**
   ```
   avg_variance = (variance_pre + variance_post) / 2.0
   confidence_factor = max(0.7, 1.0 - min(avg_variance, 0.3))
   delta_load = delta_load × confidence_factor
   ```
   - High variance = uncertain estimate = reduced confidence
   - Minimum confidence factor: 0.7

3. **Normalization:**
   ```
   r_relief = clip(delta_load, 0.0, 1.0)
   ```

4. **Fallback (if no post-break measurement):**
   ```
   load_post = load_pre - (break_duration / 12.0) × 0.3
   load_post = max(0.0, load_post)
   ```
   - Assumes longer breaks provide more relief
   - Maximum relief: 0.3 per 12 minutes

---

### Reward Shaping

**Bonuses:**
- **User-reported improved focus:** +0.2 (from EMA responses)
- **High-quality praboth data:** +0.1 (quality_score > 0.8)
- **EMA rating adjustment:** `(ema_rating - 4) / 15.0` (range: -0.2 to +0.2)
  - EMA rating scale: 1-7
  - Neutral (4) = 0 adjustment

**Penalties:**
- **Deep work interrupted:** -0.3
- **High cognitive load variance:** -0.1 (variance > 0.2)

---

### Final Reward Computation

```
immediate_reward = w1 × r_progress + w2 × r_relief
immediate_reward = immediate_reward + shaping_bonuses - shaping_penalties
immediate_reward = clip(immediate_reward, -1.0, 1.0)
```

**Delayed Reward (Optional):**
```
final_reward = w_immediate × immediate_reward + w_delayed × delayed_reward
```
- Default weights: `w_immediate = 0.7`, `w_delayed = 0.3`
- Delayed reward computed after `DELAYED_REWARD_DELAY` seconds

---

## 📈 Productivity Metrics

### 1. PG - Personalization Gain

**Full Term:** Personalization Gain  
**Purpose:** Measures per-user improvement over Pomodoro baseline (25/5 minutes)

**Formula:**
```
PG = (μ_bandit - μ_baseline) / μ_baseline
```

**Where:**
- `μ_bandit` = mean reward from adaptive scheduler actions
- `μ_baseline` = mean reward from Pomodoro baseline (25/5) actions

**Calculation Steps:**

1. Collect all rewards from bandit policy:
   ```
   bandit_rewards = [r.final_reward for all actions in sessions]
   μ_bandit = mean(bandit_rewards)
   ```

2. Estimate baseline rewards (Pomodoro 25/5):
   ```
   baseline_rewards = [estimated_reward for 25/5 action in similar contexts]
   μ_baseline = mean(baseline_rewards)
   ```
   - Uses historical rewards from 25/5 actions
   - If no data, uses conservative estimate: 0.4

3. Compute PG:
   ```
   if μ_baseline == 0:
       PG = 0.0
   else:
       PG = (μ_bandit - μ_baseline) / μ_baseline
   ```

**Interpretation:**
- `PG > 0.15`: Significant improvement (target)
- `PG > 0`: Better than baseline
- `PG < 0`: Worse than baseline

---

### 2. RPH - Regret-per-Hour

**Full Term:** Regret-per-Hour  
**Purpose:** Normalized regret by study time (measures efficiency loss)

**Formula:**
```
RPH = (1 / H_total) × Σ(r* - r)
```

**Where:**
- `H_total` = total hours of study time
- `r*` = optimal reward (oracle/hindsight best action)
- `r` = actual reward received

**Calculation Steps:**

1. For each action:
   ```
   optimal_reward = estimate_optimal_reward(action)
   actual_reward = reward.final_reward
   regret = max(0, optimal_reward - actual_reward)
   total_regret += regret
   total_hours += action.work_interval / 60.0
   ```

2. Estimate optimal reward:
   - Uses best-performing action from historical data
   - If no data, uses conservative estimate: 0.7

3. Compute RPH:
   ```
   if total_hours == 0:
       RPH = 0.0
   else:
       RPH = total_regret / total_hours
   ```

**Interpretation:**
- Lower is better
- Target: `RPH < 0.1`
- Measures how much reward was lost per hour compared to optimal

---

### 3. AHL - Adaptation Half-Life

**Full Term:** Adaptation Half-Life  
**Purpose:** Time to recover 50% of performance gap after context shift

**Formula:**
```
AHL = min {t : R(t) ≥ R_pre + 0.5 × (R_post - R_pre)}
```

**Where:**
- `R_pre` = mean reward before context shift
- `R_post` = mean reward after context shift
- `R(t)` = reward at time t after shift

**Calculation Steps:**

1. Detect context shift:
   ```
   window_size = 10 epochs
   for i in range(window_size, len(rewards) - window_size):
       pre_window = rewards[i-window_size:i]
       post_window = rewards[i+window_size:i+2*window_size]
       R_pre = mean(pre_window)
       R_post = mean(post_window)
       
       if R_post < R_pre - 0.2:  # Significant drop
           context_shift_detected = True
   ```

2. Compute half-life:
   ```
   target = R_pre + 0.5 × (R_post - R_pre)
   
   for j in range(i, min(i + 30, len(rewards))):
       if rewards[j] >= target:
           AHL = j - i  # epochs to recovery
           return AHL
   ```

3. If no recovery:
   ```
   AHL = infinity
   ```

**Interpretation:**
- Lower is better (faster adaptation)
- Target: `AHL < 5 sessions`
- Measures learning speed after context changes

---

### 4. EOI - Exploration Overhead Index

**Full Term:** Exploration Overhead Index  
**Purpose:** Quantifies cost of exploration vs exploitation

**Formula:**
```
EOI = (1 / |E|) × Σ(R_exploit - R_explore)
```

**Where:**
- `E` = set of exploration epochs
- `R_exploit` = reward from exploitation actions
- `R_explore` = reward from exploration actions

**Calculation Steps:**

1. Classify actions:
   ```
   for each action:
       is_exploration = (action differs from recent best action)
       
       if is_exploration:
           exploration_rewards.append(reward)
       else:
           exploitation_rewards.append(reward)
   ```

2. Determine exploration:
   ```
   recent_actions = last_10_actions
   best_action = most_common_action(recent_actions)
   is_exploration = (current_action != best_action)
   ```

3. Compute EOI:
   ```
   μ_explore = mean(exploration_rewards)
   μ_exploit = mean(exploitation_rewards)
   EOI = max(0, μ_exploit - μ_explore)
   ```

**Interpretation:**
- Lower is better
- Target: `EOI < 0.1` (10% productivity loss from exploration)
- Measures exploration cost

---

### 5. AUC-BUC - Area Under Break Utility Curve

**Full Term:** Area Under Break Utility Curve  
**Purpose:** Measures effectiveness of different break durations

**Formula:**
```
BUC(b) = E[Δ_load | break_length = b]
AUC-BUC = ∫[b=3 to 12] BUC(b) db
```

**Where:**
- `BUC(b)` = expected cognitive load reduction for break length `b`
- `Δ_load` = cognitive_load_pre - cognitive_load_post

**Calculation Steps:**

1. Collect break utility data:
   ```
   for each action with break:
       break_duration = action.break_duration
       context_pre = context_before_break(action)
       context_post = context_after_break(action)
       
       if context_pre and context_post:
           delta_load = context_pre.cognitive_load - context_post.cognitive_load
           break_utilities[break_duration].append(delta_load)
   ```

2. Compute BUC for each break length:
   ```
   for b in [3, 5, 8, 12]:  # minutes
       if break_utilities[b]:
           BUC[b] = mean(break_utilities[b])
       else:
           BUC[b] = 0.0
   ```

3. Compute AUC using trapezoidal rule:
   ```
   sorted_breaks = [3, 5, 8, 12]
   auc = 0.0
   
   for i in range(len(sorted_breaks) - 1):
       b1, b2 = sorted_breaks[i], sorted_breaks[i+1]
       auc += (BUC[b1] + BUC[b2]) × (b2 - b1) / 2.0
   ```

**Interpretation:**
- Higher is better
- Measures overall break effectiveness
- Integrates utility across all break durations

---

### 6. CTU - Counterfactual Targeting Uplift

**Full Term:** Counterfactual Targeting Uplift  
**Purpose:** Causal effect estimation of break targeting

**Formula:**
```
CTU = E[Y | do(break=1), x] - E[Y | do(break=0), x]
```

**Where:**
- `Y` = outcome (reward)
- `do(break=1)` = intervention: break given
- `do(break=0)` = intervention: no break
- `x` = context

**Calculation Steps:**

1. Collect outcomes:
   ```
   for each action:
       had_break = (action.break_duration > 0)
       outcome = reward.final_reward
       
       if had_break:
           outcomes_with_break.append(outcome)
       else:
           outcomes_without_break.append(outcome)
   ```

2. Compute expected outcomes:
   ```
   E_Y_break = mean(outcomes_with_break)
   E_Y_no_break = mean(outcomes_without_break)
   ```

3. Compute CTU:
   ```
   CTU = E_Y_break - E_Y_no_break
   ```

**Note:** Full counterfactual analysis requires micro-randomized probes (not yet implemented)

**Interpretation:**
- Positive = breaks improve outcomes
- Measures causal effect of break targeting

---

### 7. SPF - Stability-Productivity Frontier Variance

**Full Term:** Stability-Productivity Frontier Variance  
**Purpose:** Measures consistency of reward distribution

**Formula:**
```
SPF_variance = Var[R | policy]
```

**Where:**
- `R` = reward distribution
- `policy` = current bandit policy

**Calculation Steps:**

1. Collect all rewards:
   ```
   all_rewards = [reward.final_reward for all actions in sessions]
   ```

2. Compute variance:
   ```
   if len(all_rewards) < 2:
       SPF_variance = 0.0
   else:
       SPF_variance = variance(all_rewards)
   ```

**Interpretation:**
- Lower is better (more stable)
- Target: `SPF_variance < 0.15`
- Measures reward consistency over time

---

### 8. SVR - Safety-Violation Rate

**Full Term:** Safety-Violation Rate  
**Purpose:** Frequency of safety constraint overrides

**Formula:**
```
SVR = (# safety_overrides) / (# total_decisions)
```

**Calculation Steps:**

1. Count decisions and overrides:
   ```
   for each action:
       total_decisions += 1
       if action.safety_override:
           safety_overrides += 1
   ```

2. Compute SVR:
   ```
   if total_decisions == 0:
       SVR = 0.0
   else:
       SVR = safety_overrides / total_decisions
   ```

**Safety Constraints:**
- Maximum work duration: 90 minutes
- Minimum break frequency: every 120 minutes
- High cognitive load threshold: 0.8

**Interpretation:**
- Lower is better
- Target: `SVR < 0.05` (5% override rate)
- Measures system safety

---

## 🔧 Implementation Details

### Data Sources

1. **Praboth Cognitive Load:**
   - Direct from Kalman filter (latent_mean)
   - More accurate than estimated values
   - Includes variance for confidence weighting

2. **Keystroke Data:**
   - Inter-keystroke intervals (IKI)
   - Typing speed (chars/min)
   - Pause patterns
   - Correction ratio

3. **EMA Responses:**
   - User-reported focus/fatigue (1-7 scale)
   - Converted to [0, 1] for reward shaping

### Default Values

- **Baseline reward estimate:** 0.4 (conservative Pomodoro estimate)
- **Optimal reward estimate:** 0.7 (well-tuned action estimate)
- **Reward weights:** w1 = 0.6, w2 = 0.4
- **Immediate/Delayed weights:** 0.7, 0.3

### Normalization Ranges

- **Rewards:** [-1.0, 1.0]
- **Task Progress:** [0.0, 1.0]
- **Load Relief:** [0.0, 1.0]
- **Cognitive Load:** [0.0, 1.0] (0 = low load, 1 = high load)

---

## 📝 Summary Table

| Metric | Full Name | Formula | Target | Interpretation |
|--------|-----------|---------|--------|----------------|
| **PG** | Personalization Gain | `(μ_bandit - μ_baseline) / μ_baseline` | > 0.15 | Improvement over baseline |
| **RPH** | Regret-per-Hour | `(1/H) × Σ(r* - r)` | < 0.1 | Efficiency loss per hour |
| **AHL** | Adaptation Half-Life | `min{t : R(t) ≥ target}` | < 5 sessions | Learning speed |
| **EOI** | Exploration Overhead Index | `(1/|E|) × Σ(R_exploit - R_explore)` | < 0.1 | Exploration cost |
| **AUC-BUC** | Area Under Break Utility Curve | `∫ BUC(b) db` | Higher | Break effectiveness |
| **CTU** | Counterfactual Targeting Uplift | `E[Y\|break=1] - E[Y\|break=0]` | Positive | Causal effect |
| **SPF** | Stability-Productivity Frontier Variance | `Var[R \| policy]` | < 0.15 | Reward consistency |
| **SVR** | Safety-Violation Rate | `overrides / decisions` | < 0.05 | Safety frequency |

---

## 🎯 Key Takeaways

1. **Reward combines productivity and well-being** (task progress + load relief)
2. **Metrics evaluate both performance and safety** (8 comprehensive metrics)
3. **Real data integration** (praboth cognitive load for accuracy)
4. **Confidence weighting** (variance-aware calculations)
5. **Safety-first design** (constraints prevent harmful recommendations)

