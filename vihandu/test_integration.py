"""
Simple test script to check integration setup
"""
from pathlib import Path
import sys

print("=" * 70)
print("ADAPTIVE SCHEDULER - INTEGRATION TEST")
print("=" * 70)

# Check for praboth database
print("\n1. Checking for praboth database...")
possible_paths = [
    "praboth/data/state.db",
    "praboth/cog_py_est/data/state.db",
    "data/state.db",
]

db_found = None
for path_str in possible_paths:
    path = Path(path_str)
    if path.exists():
        db_found = str(path)
        print(f"   [OK] Found database at: {db_found}")
        break

if not db_found:
    print("   [INFO] Praboth database not found.")
    print("   This is normal if praboth service hasn't been run yet.")
    print("   The database will be created when praboth service starts.")
    print("\n   To create data, run praboth service first:")
    print("   cd praboth")
    print("   python -m cog_py_est.cli --config policy_1.toml")

# Check adaptive scheduler database
print("\n2. Checking adaptive scheduler database...")
if Path("adaptive_scheduler.db").exists():
    print("   [OK] Found adaptive_scheduler.db")
else:
    print("   [INFO] adaptive_scheduler.db will be created when needed")

# Try to import modules
print("\n3. Checking imports...")
try:
    from src.data_integration.praboth_reader import PrabothDataReader
    print("   [OK] PrabothDataReader imported")
except Exception as e:
    print(f"   [ERROR] Failed to import PrabothDataReader: {e}")
    sys.exit(1)

try:
    from src.data_integration.praboth_metrics_adapter import PrabothMetricsAdapter
    print("   [OK] PrabothMetricsAdapter imported")
except Exception as e:
    print(f"   [ERROR] Failed to import PrabothMetricsAdapter: {e}")
    sys.exit(1)

try:
    from src.scheduling.time_block_scheduler import TimeBlockScheduler
    print("   [OK] TimeBlockScheduler imported")
except Exception as e:
    print(f"   [ERROR] Failed to import TimeBlockScheduler: {e}")
    sys.exit(1)

try:
    from src.metrics.metrics_calculator import MetricsCalculator
    print("   [OK] MetricsCalculator imported")
except Exception as e:
    print(f"   [ERROR] Failed to import MetricsCalculator: {e}")
    sys.exit(1)

# If database exists, try to read from it
if db_found:
    print("\n4. Testing database connection...")
    try:
        reader = PrabothDataReader(db_found)
        sessions = reader.get_sessions(limit=1)
        print(f"   [OK] Connected to database")
        if sessions:
            print(f"   [OK] Found {len(sessions)} session(s)")
        else:
            print("   [INFO] No sessions found in database yet")
            print("   Run praboth service to collect data")
    except Exception as e:
        print(f"   [ERROR] Failed to read database: {e}")
        import traceback
        traceback.print_exc()

# Test creating a schedule (doesn't require database)
print("\n5. Testing schedule creation...")
try:
    from src.scheduling.time_block_scheduler import TimeBlockScheduler, TimeBlock
    from datetime import datetime
    
    scheduler = TimeBlockScheduler()
    time_block = TimeBlock(
        start_time=datetime(2024, 1, 15, 14, 0),
        end_time=datetime(2024, 1, 15, 16, 0),
        user_id="test_user"
    )
    
    schedule = scheduler.create_initial_schedule(time_block, None)
    print(f"   [OK] Schedule created successfully")
    print(f"   Total duration: {schedule.total_duration_minutes:.1f} minutes")
    print(f"   Intervals: {len(schedule.intervals)}")
except Exception as e:
    print(f"   [ERROR] Failed to create schedule: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)
print("TEST COMPLETE")
print("=" * 70)

if not db_found:
    print("\nNEXT STEPS:")
    print("1. Start praboth service to collect data:")
    print("   cd praboth")
    print("   python -m cog_py_est.cli --config policy_1.toml")
    print("\n2. After praboth has collected session data, run:")
    print("   python run_workflow.py")
else:
    print("\nReady to run workflow!")
    print("Run: python run_workflow.py")











