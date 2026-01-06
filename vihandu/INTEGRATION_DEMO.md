# Integration Demo - How Everything Works Together

## 🎯 Quick Overview

This system integrates **4 main components**:
1. **Praboth** - Captures keystrokes and estimates cognitive load
2. **Adaptive Scheduler** - Creates work/break schedules
3. **Metrics Calculator** - Computes performance metrics
4. **Time Block Scheduler** - Adapts schedules based on metrics

---

## 📊 Visual Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER STARTS WORKING                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  OS Hooks → Captures Keystrokes → Sends to Praboth (Port 8000)│
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  PRABOTH SERVICE (Port 8000)                                  │
│  • Receives keystroke events                                 │
│  • Extracts features (IKI, typing speed, etc.)              │
│  • Estimates cognitive load (Kalman filter)                 │
│  • Stores in: praboth/data/state.db                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  AFTER SESSION ENDS                                           │
│  • Praboth has collected session data                        │
│  • Data includes: feature windows, cognitive load estimates │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  SYNC PHASE (run_workflow.py)                                │
│  • PrabothMetricsAdapter reads praboth database              │
│  • Maps praboth data → adaptive scheduler format             │
│  • Creates: Sessions, Actions, Rewards, ContextVectors       │
│  • Stores in: adaptive_scheduler.db                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  METRICS COMPUTATION                                          │
│  • MetricsCalculator reads synced data                       │
│  • Computes 8 metrics: PG, RPH, AHL, EOI, AUC-BUC, etc.   │
│  • Uses real data (not simulated)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  ADAPTATION PHASE                                             │
│  • TimeBlockScheduler uses metrics                           │
│  • Creates next session schedule                             │
│  • Adapts work/break intervals based on:                    │
│    - PG (Personalization Gain)                              │
│    - SVR (Safety Violation Rate)                            │
│    - AHL (Adaptation Half-Life)                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  NEXT SESSION                                                │
│  • User gets adapted schedule                                │
│  • Cycle repeats with improved schedule                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Step-by-Step Integration Process

### Phase 1: Data Collection (Real-time)

**What happens:**
1. User types on keyboard
2. OS Hooks captures keystroke timing (no content, just timing)
3. Events sent to Praboth API: `POST http://127.0.0.1:8000/events`
4. Praboth processes events:
   - Groups into 60-second feature windows
   - Extracts features (IKI, typing speed, pause patterns)
   - Estimates cognitive load using Kalman filter
   - Stores in `praboth/data/state.db`

**You can see this:**
- Open http://localhost:3000 (Praboth Web UI)
- Watch real-time cognitive load estimates
- See feature windows being created

---

### Phase 2: Data Sync (After Session)

**What happens:**
1. Session ends (user stops or explicitly ends)
2. Run sync script: `python run_workflow.py`
3. `PrabothMetricsAdapter`:
   - Reads praboth database
   - Finds feature windows and cognitive load estimates
   - Maps to adaptive scheduler format:
     - Feature windows → ContextVectors
     - Cognitive load → Rewards
     - Time periods → Actions (work/break intervals)
   - Stores in `adaptive_scheduler.db`

**Code example:**
```python
from src.data_integration.praboth_metrics_adapter import PrabothMetricsAdapter

adapter = PrabothMetricsAdapter(praboth_db_path="praboth/data/state.db")
session_id = adapter.sync_praboth_session(
    praboth_session_id=123,
    user_id="user_001",
    task_type="writing"
)
```

---

### Phase 3: Metrics Computation

**What happens:**
1. `MetricsCalculator` reads synced data
2. Computes 8 productivity metrics:
   - **PG** (Personalization Gain): Improvement over baseline
   - **RPH** (Regret-per-Hour): Normalized regret
   - **AHL** (Adaptation Half-Life): Learning speed
   - **EOI** (Exploration Overhead): Exploration cost
   - **AUC-BUC**: Break utility curve
   - **CTU** (Counterfactual Uplift): Causal effect
   - **SPF**: Stability-Productivity Frontier
   - **SVR** (Safety Violation Rate): Safety overrides

**Code example:**
```python
from src.metrics.metrics_calculator import MetricsCalculator

calculator = MetricsCalculator(user_id="user_001")
metrics = calculator.compute_all_metrics()

print(f"PG: {metrics.PG:.3f}")  # Personalization Gain
print(f"SVR: {metrics.SVR:.3f}")  # Safety Violation Rate
```

---

### Phase 4: Schedule Adaptation

**What happens:**
1. User wants to schedule next session (e.g., "2pm-4pm")
2. `TimeBlockScheduler` creates initial schedule
3. Uses previous metrics to adapt:
   - If PG > 0.15: Keep successful intervals
   - If SVR > 0.1: Reduce work duration, increase breaks
   - If AHL < 5: Fast learning, can explore more

**Code example:**
```python
from src.scheduling.time_block_scheduler import TimeBlockScheduler, TimeBlock
from datetime import datetime

scheduler = TimeBlockScheduler(algorithm="LinUCB")
time_block = TimeBlock(
    start_time=datetime(2024, 1, 15, 14, 0),  # 2pm
    end_time=datetime(2024, 1, 15, 16, 0),     # 4pm
    user_id="user_001"
)

# Get previous metrics
previous_metrics = calculator.compute_all_metrics()

# Create adapted schedule
schedule = scheduler.create_initial_schedule(
    time_block=time_block,
    previous_metrics=previous_metrics.__dict__ if previous_metrics.PG else None
)
```

---

## 🧪 Try It Yourself

### Quick Demo Script

Run this to see the integration in action:

```powershell
python run_workflow.py
```

This will:
1. ✅ Check praboth database for sessions
2. ✅ Sync praboth sessions to adaptive scheduler
3. ✅ Compute metrics from real data
4. ✅ Create adapted schedule for next session

### Manual Step-by-Step

**1. Check what praboth has collected:**
```python
from src.data_integration.praboth_reader import PrabothDataReader

reader = PrabothDataReader("praboth/data/state.db")
sessions = reader.get_sessions(limit=5)
print(f"Found {len(sessions)} sessions")
```

**2. Sync a session:**
```python
from src.data_integration.praboth_metrics_adapter import PrabothMetricsAdapter

adapter = PrabothMetricsAdapter("praboth/data/state.db")
session_id = adapter.sync_praboth_session(
    praboth_session_id=sessions[0].session_id,
    user_id="user_001"
)
print(f"Synced! Adaptive scheduler session ID: {session_id}")
```

**3. Compute metrics:**
```python
from src.metrics.metrics_calculator import MetricsCalculator

calculator = MetricsCalculator(user_id="user_001")
metrics = calculator.compute_all_metrics()
print(f"PG: {metrics.PG}, SVR: {metrics.SVR}")
```

**4. Create adapted schedule:**
```python
from src.scheduling.time_block_scheduler import TimeBlockScheduler, TimeBlock
from datetime import datetime, timedelta

scheduler = TimeBlockScheduler()
tomorrow = datetime.now() + timedelta(days=1)
time_block = TimeBlock(
    start_time=tomorrow.replace(hour=14, minute=0),
    end_time=tomorrow.replace(hour=16, minute=0),
    user_id="user_001"
)

schedule = scheduler.create_initial_schedule(
    time_block=time_block,
    previous_metrics=metrics.__dict__ if metrics.PG else None
)
print(f"Created schedule with {len(schedule.intervals)} intervals")
```

---

## 🔍 What Data Gets Mapped?

| Praboth Data | → | Adaptive Scheduler Data |
|-------------|---|------------------------|
| Feature Windows (60s) | → | ContextVectors |
| Cognitive Load Estimates | → | Rewards |
| Time Periods | → | Actions (work/break) |
| Session Metadata | → | Session records |
| EMA Responses | → | MicroEMA feedback |

---

## 📈 How Metrics Influence Adaptation

| Metric | Threshold | Adaptation Behavior |
|--------|-----------|---------------------|
| **PG** > 0.15 | High | Keep successful intervals |
| **PG** < 0 | Low | Try different intervals |
| **SVR** > 0.1 | High | Reduce work, increase breaks |
| **AHL** < 5 | Fast | Can explore more variety |
| **AHL** > 10 | Slow | Be more conservative |

---

## 🎬 Complete Example

See `run_workflow.py` for a complete example that does all steps automatically!

