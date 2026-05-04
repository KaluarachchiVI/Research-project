# Praboth Integration Guide

## Overview

This guide explains how the Adaptive Scheduler integrates with the **praboth** cognitive load estimation service to use **real session data** (not simulated) for metrics computation and session adaptation.

## Architecture Flow

```
User specifies time block (e.g., 2pm-4pm)
    ↓
Time Block Scheduler creates initial schedule
    ↓
Session runs with adaptive scheduling (during execution)
    ↓
Praboth collects real-time keystroke/pointer data
    ↓
Praboth estimates cognitive load from features
    ↓
After session, sync praboth data to adaptive scheduler
    ↓
Compute metrics from real data
    ↓
Use metrics to adapt next session's schedule
```

## Key Components

### 1. Praboth Data Reader (`src/data_integration/praboth_reader.py`)

Reads real session data from praboth SQLite database:
- Sessions (start/end times)
- Feature windows (60s windows, 15s hop)
- Cognitive load estimates (from Kalman filter)
- EMA responses
- Telemetry metrics

**Database Location:**
- Default: `praboth/cog_py_est/data/state.db`
- Or specify path when initializing reader

### 2. Praboth Metrics Adapter (`src/data_integration/praboth_metrics_adapter.py`)

Maps praboth data format to adaptive scheduler format:
- Converts feature windows → context vectors
- Maps cognitive load estimates → rewards
- Creates actions and rewards for metrics computation
- Syncs data into adaptive scheduler database

### 3. Time Block Scheduler (`src/scheduling/time_block_scheduler.py`)

Creates schedules based on user-specified time blocks:
- User says "2pm-4pm" → creates initial schedule
- Adapts schedule based on metrics from previous sessions
- During session, adaptive scheduler can override based on real-time data

## Usage

### Step 1: Sync Praboth Session Data

After a praboth session completes, sync it to adaptive scheduler:

```python
from src.data_integration.praboth_metrics_adapter import PrabothMetricsAdapter

# Initialize adapter
adapter = PrabothMetricsAdapter(praboth_db_path="praboth/cog_py_est/data/state.db")

# Sync a specific session
praboth_session_id = 123
user_id = "user_001"
adaptive_session_id = adapter.sync_praboth_session(
    praboth_session_id=praboth_session_id,
    user_id=user_id,
    task_type="writing",
    chronotype="morning",
    algorithm="LinUCB"
)

# Or sync all recent sessions
session_ids = adapter.sync_all_recent_sessions(
    user_id="user_001",
    days_back=7
)
```

### Step 2: Create Time Block Schedule

Create a schedule for a user-specified time block:

```python
from src.scheduling.time_block_scheduler import TimeBlockScheduler, TimeBlock
from datetime import datetime

# Create scheduler
scheduler = TimeBlockScheduler(algorithm="LinUCB")

# User specifies time block: 2pm-4pm today
start_time = datetime(2024, 1, 15, 14, 0)  # 2pm
end_time = datetime(2024, 1, 15, 16, 0)    # 4pm

time_block = TimeBlock(
    start_time=start_time,
    end_time=end_time,
    user_id="user_001",
    task_type="writing",
    chronotype="morning"
)

# Get previous metrics (if available)
from src.metrics.metrics_calculator import MetricsCalculator
calculator = MetricsCalculator(user_id="user_001")
previous_metrics = calculator.compute_all_metrics()

# Create initial schedule (adapts based on previous metrics)
schedule = scheduler.create_initial_schedule(
    time_block=time_block,
    previous_metrics=previous_metrics.__dict__ if previous_metrics else None
)

# Print schedule
print(f"Total duration: {schedule.total_duration_minutes:.1f} minutes")
print(f"Work time: {schedule.work_time_minutes:.1f} minutes")
print(f"Break time: {schedule.break_time_minutes:.1f} minutes")

for interval in schedule.intervals:
    print(f"{interval.interval_type}: {interval.start_time} - {interval.end_time} ({interval.duration_minutes} min)")
```

### Step 3: Compute Metrics from Real Data

After syncing praboth session, compute metrics:

```python
from src.metrics.metrics_calculator import MetricsCalculator

# Compute metrics for user
calculator = MetricsCalculator(user_id="user_001")
metrics = calculator.compute_all_metrics()

# Access individual metrics
print(f"Personalization Gain: {metrics.PG:.3f}")
print(f"Regret-per-Hour: {metrics.RPH:.3f}")
print(f"Adaptation Half-Life: {metrics.AHL:.1f}")
print(f"Safety Violation Rate: {metrics.SVR:.3f}")
```

### Step 4: Use Metrics to Adapt Next Session

Metrics from previous sessions inform the next session's schedule:

```python
# When creating next session schedule, pass previous metrics
previous_metrics = calculator.compute_all_metrics()

next_schedule = scheduler.create_initial_schedule(
    time_block=next_time_block,
    previous_metrics=previous_metrics.__dict__
)
# The scheduler will:
# - Use successful intervals from previous sessions (if PG > 0.15)
# - Adjust work/break durations based on SVR (safety violations)
# - Adapt based on AHL (adaptation speed)
```

## API Integration

### New Endpoint: Sync Praboth Session

```bash
POST /api/sync-praboth-session
Content-Type: application/json

{
  "praboth_session_id": 123,
  "user_id": "user_001",
  "task_type": "writing",
  "chronotype": "morning",
  "algorithm": "LinUCB"
}
```

### New Endpoint: Create Time Block Schedule

```bash
POST /api/create-schedule
Content-Type: application/json

{
  "start_time": "2024-01-15T14:00:00",
  "end_time": "2024-01-15T16:00:00",
  "user_id": "user_001",
  "task_type": "writing",
  "chronotype": "morning"
}
```

## Data Flow Details

### How Praboth Data Maps to Adaptive Scheduler

1. **Feature Windows → Context Vectors**
   - Praboth: 60s windows with feature vectors (IKI, typing speed, etc.)
   - Adaptive Scheduler: ContextVector with 8 features
   - Mapping: Extract relevant features from praboth feature vector

2. **Cognitive Load Estimates → Rewards**
   - Praboth: Kalman filter estimates (latent_mean)
   - Adaptive Scheduler: Reward based on cognitive load relief
   - Mapping: Lower cognitive load = higher reward (r_relief)

3. **Actions → Work/Break Intervals**
   - Praboth: Continuous monitoring (no explicit actions)
   - Adaptive Scheduler: Discrete actions (work_interval, break_duration)
   - Mapping: Infer actions from cognitive load patterns and schedule

### Session Adaptation Logic

The scheduler adapts based on these metrics:

1. **Personalization Gain (PG)**
   - PG > 0.15: Keep successful intervals
   - PG < 0: Try different intervals (shorter work, longer breaks)

2. **Adaptation Half-Life (AHL)**
   - AHL < 5: Fast learning, can try more variety
   - AHL > 10: Slow learning, be more conservative

3. **Safety Violation Rate (SVR)**
   - SVR > 0.1: Intervals too aggressive, reduce work duration, increase break duration

## Example Workflow

### Complete Session Flow

```python
# 1. User starts praboth service
# (praboth collects keystroke data and estimates cognitive load)

# 2. User specifies time block
from src.scheduling.time_block_scheduler import TimeBlockScheduler, TimeBlock
from datetime import datetime

scheduler = TimeBlockScheduler()
time_block = TimeBlock(
    start_time=datetime(2024, 1, 15, 14, 0),
    end_time=datetime(2024, 1, 15, 16, 0),
    user_id="user_001"
)

# 3. Get previous metrics (if this isn't first session)
from src.metrics.metrics_calculator import MetricsCalculator
calculator = MetricsCalculator(user_id="user_001")
previous_metrics = calculator.compute_all_metrics()

# 4. Create initial schedule
schedule = scheduler.create_initial_schedule(
    time_block=time_block,
    previous_metrics=previous_metrics.__dict__ if previous_metrics.PG else None
)

# 5. Session runs...
# (praboth collects data, adaptive scheduler can override schedule based on real-time cognitive load)

# 6. After session, sync praboth data
from src.data_integration.praboth_metrics_adapter import PrabothMetricsAdapter
adapter = PrabothMetricsAdapter()
praboth_session_id = 123  # Get from praboth
adaptive_session_id = adapter.sync_praboth_session(
    praboth_session_id=praboth_session_id,
    user_id="user_001"
)

# 7. Compute metrics from real data
metrics = calculator.compute_all_metrics()

# 8. Next session uses these metrics for adaptation
next_time_block = TimeBlock(...)
next_schedule = scheduler.create_initial_schedule(
    time_block=next_time_block,
    previous_metrics=metrics.__dict__
)
```

## Configuration

### Database Paths

```python
# In config/config.py or environment variables
PRABOTH_DB_PATH = "praboth/cog_py_est/data/state.db"
ADAPTIVE_SCHEDULER_DB_PATH = "adaptive_scheduler.db"
```

### Time Block Settings

```python
# Default work/break intervals (from config/config.py)
WORK_INTERVALS = [20, 30, 45, 60]  # minutes
BREAK_DURATIONS = [3, 5, 8, 12]    # minutes
```

## Troubleshooting

### Database Not Found

**Error:** `FileNotFoundError: Could not find praboth database`

**Solution:** Specify the path explicitly:
```python
adapter = PrabothMetricsAdapter(praboth_db_path="/path/to/praboth/cog_py_est/data/state.db")
```

### No Data in Metrics

**Error:** Metrics return None or 0

**Solution:** 
1. Ensure praboth session has completed and has data
2. Sync the session: `adapter.sync_praboth_session(...)`
3. Verify feature windows exist in praboth database

### Sessions Not Syncing

**Error:** `Failed to sync praboth session`

**Solution:**
1. Check that praboth session has feature windows and model states
2. Verify database permissions
3. Check logs for specific error messages

## Differences from Simulated Data

| Aspect | Simulated Data | Real Praboth Data |
|--------|---------------|-------------------|
| **Source** | Synthetic generation | Real keystroke/pointer events |
| **Cognitive Load** | Estimated from typing patterns | Kalman filter estimate from praboth |
| **Feature Windows** | Generated | Real 60s windows from praboth |
| **Timing** | Simulated timestamps | Real session timestamps |
| **Quality** | Perfect quality scores | Real quality scores from praboth |
| **Accuracy** | Approximate | High accuracy (real-time estimation) |

## Benefits of Using Real Data

1. **Accurate Metrics**: Metrics computed from actual user behavior
2. **Real Adaptation**: System learns from real cognitive load patterns
3. **Personalized**: Adapts to individual user's actual patterns
4. **Validated**: Can compare metrics against ground truth (EMA responses)
5. **Production-Ready**: Uses real production data, not simulations

## Next Steps

1. **Integrate with API**: Add endpoints for time block scheduling and praboth sync
2. **Dashboard Updates**: Show real-time sync status and praboth session data
3. **Metrics Visualization**: Compare metrics from real vs simulated data
4. **Automated Sync**: Auto-sync praboth sessions when they complete

