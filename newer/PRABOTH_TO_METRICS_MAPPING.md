# Praboth Data to Metrics Mapping Guide

This document explains how data from praboth is mapped and transformed into the adaptive scheduler's metrics.

## Overview Flow

```
Praboth Database (state.db)
    ↓
PrabothDataReader (reads raw data)
    ↓
PrabothMetricsAdapter (maps to adaptive scheduler format)
    ↓
Adaptive Scheduler Database (adaptive_scheduler.db)
    ↓
MetricsCalculator (computes 8 productivity metrics)
```

---

## Step 1: Reading Praboth Data

**File:** `src/data_integration/praboth_reader.py`

### What Praboth Stores:

1. **Sessions** (`sessions` table)
   - `session_id`, `started_at`, `ended_at`, `device_label`

2. **Feature Windows** (`feature_windows` table)
   - 60-second windows with 15-second hop
   - 10-dimensional feature vector:
     ```
     [0] keystrokes (count)
     [1] iki_mean_ms (mean inter-keystroke interval in milliseconds)
     [2] iki_std_ms (standard deviation of IKI)
     [3] error_rate (typing errors per keystroke)
     [4] backspace_rate (corrections per keystroke)
     [5] pointer_events (mouse/pointer event count)
     [6] pointer_speed_mean (average pointer speed)
     [7] pointer_speed_std (pointer speed variation)
     [8] pointer_accel_mean (pointer acceleration)
     [9] idle_fraction (fraction of time idle)
     ```
   - `quality_score` (feature quality indicator)

3. **Model States** (`model_state` table)
   - Cognitive load estimates from Kalman filter
   - `latent_mean` (cognitive load estimate, 0-1)
   - `latent_variance` (uncertainty in estimate)
   - `captured_at` (timestamp)

4. **EMA Responses** (`ema_responses` + `ema_prompts` tables)
   - User feedback ratings (1-7 scale)
   - `disposition` (completed, dismissed, etc.)
   - `note` (optional text feedback)

5. **Telemetry Metrics** (`telemetry_metrics` table)
   - Quality metrics like `residual_rms` (model fit quality)

---

## Step 2: Mapping to Adaptive Scheduler Format

**File:** `src/data_integration/praboth_metrics_adapter.py`

### Mapping Process:

#### A. Feature Windows → ContextVectors

```python
# Praboth 10-dim feature vector:
[keystrokes, iki_mean_ms, iki_std_ms, error_rate, backspace_rate,
 pointer_events, pointer_speed_mean, pointer_speed_std, 
 pointer_accel_mean, idle_fraction]

# Maps to ContextVector:
{
    'mean_iki': iki_mean_ms / 1000.0,           # Convert ms → seconds
    'std_iki': iki_std_ms / 1000.0,             # Convert ms → seconds
    'typing_speed': keystrokes * 60.0,          # keystrokes → chars/min
    'correction_ratio': backspace_rate,          # Direct mapping
    'pause_count': estimated_from_idle_fraction, # Derived from idle_fraction
    'cognitive_load': from_model_state,         # From Kalman filter
    'session_duration': (timestamp - start) / 60.0,  # Minutes
    'time_of_day': 0/1/2 (morning/afternoon/evening)
}
```

**Key Mappings:**
- **IKI (Inter-Keystroke Interval)**: Converted from milliseconds to seconds
- **Typing Speed**: Keystrokes per window → characters per minute
- **Pause Count**: Estimated from `idle_fraction`:
  ```python
  if idle_fraction > 0.1:  # Significant idle time
      pause_count = int(idle_fraction * 30)  # Rough estimate
  ```
- **Cognitive Load**: Taken directly from `model_state.latent_mean` (most accurate)

#### B. Model States → Cognitive Load Values

```python
# Find closest model state to each feature window
for window in feature_windows:
    closest_state = find_state_within_30_seconds(window.timestamp)
    cognitive_load = closest_state.latent_mean  # Use praboth's estimate
    variance = closest_state.latent_variance    # For confidence weighting
```

#### C. Feature Windows → Actions (Work/Break Intervals)

```python
# Create actions every 4 windows (~4 minutes)
if i % 4 == 0:
    # Determine work/break intervals based on cognitive load
    if cognitive_load > 0.7:
        break_duration = 8 minutes  # High load → longer break
    elif cognitive_load < 0.4:
        work_interval = 45 minutes  # Low load → longer work
    
    action = Action(
        work_interval=current_work_interval,
        break_duration=current_break_duration,
        context_vector_id=context.vector_id,
        epoch=epoch_number
    )
```

#### D. Cognitive Load + Typing Patterns → Rewards

```python
# Task Progress Component (r_progress)
typing_speed = context_vector['typing_speed']
r_progress = min(1.0, typing_speed / 200.0)  # Normalize to [0, 1]
r_progress *= quality_score  # Weight by feature quality

# Load Relief Component (r_relief)
cognitive_load = from_praboth_model_state
r_relief = max(0.0, 1.0 - cognitive_load)  # Lower load = higher relief

# Confidence Weighting (from praboth variance)
variance = model_state.latent_variance
confidence_factor = max(0.7, 1.0 - min(variance, 0.3))
r_relief *= confidence_factor

# EMA Bonus (if user provided feedback)
if ema_response:
    rating = ema_response['rating']  # 1-7 scale
    ema_bonus = (rating - 4) / 12.0  # -0.25 to +0.25

# Combined Reward
w1, w2 = 0.6, 0.4  # Weights
immediate_reward = w1 * r_progress + w2 * r_relief + ema_bonus
immediate_reward = clip(immediate_reward, -1.0, 1.0)
```

#### E. EMA Responses → MicroEMA

```python
# Convert praboth EMA (1-7 scale) to adaptive scheduler format
rating = ema_response['rating']  # 1-7
normalized_rating = (rating - 1) / 6.0  # Convert to [0, 1]

micro_ema = MicroEMA(
    session_id=session_id,
    timestamp=ema_time,
    rating=normalized_rating,
    feedback_text=ema_response.get('note', '')
)
```

---

## Step 3: Computing Metrics

**File:** `src/metrics/metrics_calculator.py`

### The 8 Productivity Metrics:

#### 1. **Personalization Gain (PG)**
```python
PG = (μ_bandit - μ_baseline) / μ_baseline
```
- Compares adaptive scheduler rewards vs. Pomodoro baseline (25/5)
- Uses praboth cognitive load for accurate reward calculation

#### 2. **Regret-per-Hour (RPH)**
```python
RPH = (optimal_reward - actual_reward) / hours
```
- Measures how much reward was lost compared to optimal
- Uses praboth cognitive load to determine optimal actions

#### 3. **Adaptation Half-Life (AHL)**
```python
AHL = time_to_reach_50%_of_maximum_performance
```
- How quickly the system adapts to user
- Uses praboth cognitive load trends over time

#### 4. **Exploration Overhead Index (EOI)**
```python
EOI = exploration_cost / total_reward
```
- Cost of trying different schedules vs. exploiting best
- Uses praboth variance to weight exploration confidence

#### 5. **Area Under Break Utility Curve (AUC-BUC)**
```python
AUC_BUC = ∫ utility(break_duration) d(break_duration)
```
- Measures effectiveness of break durations
- Uses praboth cognitive load before/after breaks

#### 6. **Counterfactual Targeting Uplift (CTU)**
```python
CTU = reward_with_targeting - reward_without_targeting
```
- Improvement from targeting high cognitive load periods
- Uses praboth cognitive load to identify high-load periods

#### 7. **Stability-Productivity Frontier Variance (SPF)**
```python
SPF_variance = variance(work_interval, break_duration) pairs
```
- Consistency of schedule recommendations
- Uses praboth cognitive load patterns to assess stability

#### 8. **Safety-Violation Rate (SVR)**
```python
SVR = violations / total_actions
```
- Frequency of unsafe recommendations (e.g., too long work, too short break)
- Uses praboth cognitive load thresholds to define safety

---

## Key Advantages of Using Praboth Data

1. **Accurate Cognitive Load**: Direct from Kalman filter, not estimated
2. **Rich Features**: 10-dimensional feature vectors vs. basic keystroke data
3. **Quality Scores**: Know when data is reliable
4. **Uncertainty Estimates**: Variance from model states for confidence weighting
5. **User Feedback**: EMA responses provide ground truth labels

---

## Example: Complete Flow

```python
# 1. Read praboth session
reader = PrabothDataReader("praboth/data/state.db")
praboth_session_id = 123

# 2. Map to adaptive scheduler format
adapter = PrabothMetricsAdapter("praboth/data/state.db")
adaptive_session_id = adapter.sync_praboth_session(
    praboth_session_id=praboth_session_id,
    user_id="user_001"
)

# 3. Compute metrics
calculator = MetricsCalculator(user_id="user_001")
metrics = calculator.compute_all_metrics()

# Metrics now use praboth's cognitive load data!
print(f"Personalization Gain: {metrics.PG}")
print(f"Safety Violation Rate: {metrics.SVR}")
```

---

## Data Quality Considerations

- **Quality Score**: Used to weight rewards (higher quality = more trust)
- **Variance**: Higher variance = lower confidence, reduces reward impact
- **Idle Fraction**: Used to estimate pause count when not directly available
- **EMA Responses**: Ground truth labels for reward shaping

---

## Summary

The mapping process transforms praboth's rich cognitive load estimation data into the adaptive scheduler's format, enabling accurate metrics computation. The key insight is that praboth provides **ground truth cognitive load estimates** that are more accurate than simple keystroke-based estimation, leading to better metrics and scheduling decisions.

