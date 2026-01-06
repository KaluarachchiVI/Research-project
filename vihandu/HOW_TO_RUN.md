# How to Run the Integrated System

## Quick Start Guide

This guide shows you how to run the Adaptive Scheduler with real praboth data.

---

## Prerequisites

1. **Praboth service running** with sessions data collected
2. **Python environment** with all dependencies installed
3. **Database paths** configured correctly

---

## Step 1: Check Praboth Database

First, verify your praboth database exists and has data:

```python
# Quick check script
from pathlib import Path
import sqlite3

db_path = Path("praboth/cog_py_est/data/state.db")
if db_path.exists():
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM sessions")
    count = cursor.fetchone()[0]
    print(f"Found {count} sessions in praboth database")
    conn.close()
else:
    print(f"Database not found at: {db_path}")
    print("Please check your praboth database path")
```

**Common locations:**
- `praboth/cog_py_est/data/state.db`
- `praboth/data/state.db`
- `../praboth/cog_py_est/data/state.db`

---

## Step 2: Sync Praboth Session Data

Sync your praboth sessions into the adaptive scheduler database:

### Option A: Sync Single Session

```python
from src.data_integration.praboth_metrics_adapter import PrabothMetricsAdapter
from pathlib import Path

# Initialize adapter (adjust path if needed)
db_path = "praboth/cog_py_est/data/state.db"
adapter = PrabothMetricsAdapter(praboth_db_path=db_path)

# Get available sessions
from src.data_integration.praboth_reader import PrabothDataReader
reader = PrabothDataReader(db_path)
sessions = reader.get_sessions(limit=5)

print("Available praboth sessions:")
for session in sessions:
    print(f"  Session {session.session_id}: {session.started_at} - {session.ended_at}")

# Sync a specific session
if sessions:
    praboth_session_id = sessions[0].session_id
    user_id = "user_001"
    
    print(f"\nSyncing session {praboth_session_id}...")
    adaptive_session_id = adapter.sync_praboth_session(
        praboth_session_id=praboth_session_id,
        user_id=user_id,
        task_type="writing",
        chronotype="neutral",
        algorithm="LinUCB"
    )
    
    print(f"✅ Synced! Adaptive scheduler session ID: {adaptive_session_id}")
```

### Option B: Sync All Recent Sessions

```python
from src.data_integration.praboth_metrics_adapter import PrabothMetricsAdapter

adapter = PrabothMetricsAdapter(praboth_db_path="praboth/cog_py_est/data/state.db")

# Sync all sessions from last 7 days
user_id = "user_001"
session_ids = adapter.sync_all_recent_sessions(user_id=user_id, days_back=7)

print(f"✅ Synced {len(session_ids)} sessions: {session_ids}")
```

---

## Step 3: Compute Metrics from Real Data

After syncing, compute metrics:

```python
from src.metrics.metrics_calculator import MetricsCalculator

# Initialize calculator
calculator = MetricsCalculator(user_id="user_001")

# Compute all metrics
metrics = calculator.compute_all_metrics()

# Print results
print("\n📊 METRICS FROM REAL DATA:")
print(f"{'─' * 70}")
print(f"{'Metric':<25} {'Value':<20} {'Status':<25}")
print(f"{'─' * 70}")

metrics_dict = {
    'PG (Personalization Gain)': metrics.PG,
    'RPH (Regret-per-Hour)': metrics.RPH,
    'AHL (Adaptation Half-Life)': metrics.AHL,
    'EOI (Exploration Overhead)': metrics.EOI,
    'AUC-BUC': metrics.AUC_BUC,
    'CTU (Counterfactual Uplift)': metrics.CTU,
    'SPF Variance': metrics.SPF_variance,
    'SVR (Safety Violation Rate)': metrics.SVR,
}

for name, value in metrics_dict.items():
    if value is None:
        status = "Not computed"
        display_value = "N/A"
    elif value == float('inf'):
        status = "No data/context shift"
        display_value = "∞"
    else:
        status = "✅ Computed"
        display_value = f"{value:.4f}"
    
    print(f"{name:<25} {display_value:<20} {status:<25}")

print(f"{'─' * 70}")
```

---

## Step 4: Create Time Block Schedule

Create a schedule for a user-specified time block:

```python
from src.scheduling.time_block_scheduler import TimeBlockScheduler, TimeBlock
from datetime import datetime

# Initialize scheduler
scheduler = TimeBlockScheduler(algorithm="LinUCB")

# User wants to study 2pm-4pm today
start_time = datetime(2024, 1, 15, 14, 0)  # 2pm
end_time = datetime(2024, 1, 15, 16, 0)    # 4pm

time_block = TimeBlock(
    start_time=start_time,
    end_time=end_time,
    user_id="user_001",
    task_type="writing",
    chronotype="morning"
)

# Get previous metrics to adapt schedule
from src.metrics.metrics_calculator import MetricsCalculator
calculator = MetricsCalculator(user_id="user_001")
previous_metrics = calculator.compute_all_metrics()

# Create schedule (adapts based on previous metrics if available)
schedule = scheduler.create_initial_schedule(
    time_block=time_block,
    previous_metrics=previous_metrics.__dict__ if previous_metrics.PG is not None else None
)

# Print schedule
print(f"\n📅 SCHEDULE FOR {time_block.start_time.strftime('%I:%M %p')} - {time_block.end_time.strftime('%I:%M %p')}")
print(f"{'─' * 70}")
print(f"Total duration: {schedule.total_duration_minutes:.1f} minutes")
print(f"Work time: {schedule.work_time_minutes:.1f} minutes")
print(f"Break time: {schedule.break_time_minutes:.1f} minutes")
print(f"{'─' * 70}")
print(f"\nIntervals:")
for i, interval in enumerate(schedule.intervals, 1):
    start_str = interval.start_time.strftime('%I:%M %p')
    end_str = interval.end_time.strftime('%I:%M %p')
    icon = "📚" if interval.interval_type == 'work' else "☕"
    
    if interval.interval_type == 'work':
        print(f"{i}. {icon} WORK: {start_str} - {end_str} ({interval.duration_minutes} min)")
    else:
        print(f"{i}. {icon} BREAK: {start_str} - {end_str} ({interval.duration_minutes} min)")
```

---

## Step 5: Complete Workflow Script

Here's a complete script that does everything:

```python
"""
Complete workflow: Sync praboth data → Compute metrics → Create schedule
"""
from datetime import datetime
from src.data_integration.praboth_reader import PrabothDataReader
from src.data_integration.praboth_metrics_adapter import PrabothMetricsAdapter
from src.metrics.metrics_calculator import MetricsCalculator
from src.scheduling.time_block_scheduler import TimeBlockScheduler, TimeBlock

def run_complete_workflow():
    # Configuration
    PRABOTH_DB_PATH = "praboth/cog_py_est/data/state.db"  # Adjust if needed
    USER_ID = "user_001"
    
    print("=" * 70)
    print("ADAPTIVE SCHEDULER - COMPLETE WORKFLOW")
    print("=" * 70)
    
    # Step 1: Check praboth database
    print("\n1️⃣ Checking praboth database...")
    try:
        reader = PrabothDataReader(PRABOTH_DB_PATH)
        sessions = reader.get_sessions(limit=5)
        print(f"   ✅ Found {len(sessions)} recent sessions")
        if sessions:
            print(f"   Latest session: {sessions[0].session_id} (started: {sessions[0].started_at})")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return
    
    # Step 2: Sync praboth sessions
    print("\n2️⃣ Syncing praboth sessions...")
    try:
        adapter = PrabothMetricsAdapter(praboth_db_path=PRABOTH_DB_PATH)
        session_ids = adapter.sync_all_recent_sessions(USER_ID, days_back=7)
        print(f"   ✅ Synced {len(session_ids)} sessions")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return
    
    # Step 3: Compute metrics
    print("\n3️⃣ Computing metrics from real data...")
    try:
        calculator = MetricsCalculator(user_id=USER_ID)
        metrics = calculator.compute_all_metrics()
        print(f"   ✅ Metrics computed")
        print(f"   PG: {metrics.PG:.3f}" if metrics.PG else "   PG: N/A")
        print(f"   RPH: {metrics.RPH:.3f}" if metrics.RPH else "   RPH: N/A")
        print(f"   SVR: {metrics.SVR:.3f}" if metrics.SVR else "   SVR: N/A")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return
    
    # Step 4: Create schedule for next session
    print("\n4️⃣ Creating schedule for next session...")
    try:
        scheduler = TimeBlockScheduler(algorithm="LinUCB")
        
        # Example: Next session 2pm-4pm tomorrow
        tomorrow = datetime.now().replace(hour=14, minute=0, second=0, microsecond=0)
        end_time = tomorrow.replace(hour=16, minute=0)
        
        time_block = TimeBlock(
            start_time=tomorrow,
            end_time=end_time,
            user_id=USER_ID,
            task_type="writing",
            chronotype="neutral"
        )
        
        schedule = scheduler.create_initial_schedule(
            time_block=time_block,
            previous_metrics=metrics.__dict__ if metrics.PG is not None else None
        )
        
        print(f"   ✅ Schedule created")
        print(f"   Total: {schedule.total_duration_minutes:.1f} min")
        print(f"   Work: {schedule.work_time_minutes:.1f} min")
        print(f"   Break: {schedule.break_time_minutes:.1f} min")
        print(f"   Intervals: {len(schedule.intervals)}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return
    
    print("\n" + "=" * 70)
    print("✅ WORKFLOW COMPLETE!")
    print("=" * 70)

if __name__ == "__main__":
    run_complete_workflow()
```

Save this as `run_workflow.py` and run:

```bash
python run_workflow.py
```

---

## Step 6: Run via API (Optional)

If you want to use the API endpoints:

### Start the API server:

```bash
python run_server.py
```

### Sync session via API:

```bash
curl -X POST http://127.0.0.1:5000/api/sync-praboth-session \
  -H "Content-Type: application/json" \
  -d '{
    "praboth_session_id": 123,
    "user_id": "user_001",
    "task_type": "writing",
    "chronotype": "morning"
  }'
```

### Get metrics:

```bash
curl "http://127.0.0.1:5000/api/metrics?user_id=user_001"
```

---

## Troubleshooting

### Database Not Found

```python
# Try different paths
possible_paths = [
    "praboth/cog_py_est/data/state.db",
    "praboth/data/state.db",
    "../praboth/cog_py_est/data/state.db",
]

for path in possible_paths:
    if Path(path).exists():
        print(f"Found database at: {path}")
        adapter = PrabothMetricsAdapter(praboth_db_path=path)
        break
```

### No Sessions Found

```python
# Check what's in the database
reader = PrabothDataReader("praboth/cog_py_est/data/state.db")
sessions = reader.get_sessions()

if not sessions:
    print("No sessions found. Make sure praboth service has collected data.")
else:
    print(f"Found {len(sessions)} sessions")
```

### Metrics Return None

This is normal if:
- No sessions have been synced yet
- Sessions don't have enough data
- First session (no baseline for comparison)

**Solution:** Sync more sessions or wait for more data.

---

## Quick Reference

### Most Common Commands:

```python
# 1. Sync a session
adapter = PrabothMetricsAdapter("praboth/cog_py_est/data/state.db")
adapter.sync_praboth_session(123, "user_001")

# 2. Compute metrics
calculator = MetricsCalculator("user_001")
metrics = calculator.compute_all_metrics()

# 3. Create schedule
scheduler = TimeBlockScheduler()
schedule = scheduler.create_initial_schedule(time_block, previous_metrics)
```

---

## Next Steps

1. ✅ Run the workflow script
2. ✅ Verify metrics are computed from real data
3. ✅ Create schedules for your study sessions
4. ✅ Use metrics to adapt future sessions

**You're ready to go!** 🚀











