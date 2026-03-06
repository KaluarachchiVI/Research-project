"""
Complete workflow: Sync praboth data -> Compute metrics -> Create schedule
Run this script to use the integrated system with real praboth data.
"""
import sys
import io
# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from datetime import datetime
from pathlib import Path
from src.data_integration.praboth_reader import PrabothDataReader
from src.data_integration.praboth_metrics_adapter import PrabothMetricsAdapter
from src.metrics.metrics_calculator import MetricsCalculator
from src.scheduling.time_block_scheduler import TimeBlockScheduler, TimeBlock


def find_praboth_database():
    """Find praboth database in common locations"""
    possible_paths = [
        Path("praboth/data/state.db"),  # Most likely location (relative to praboth root)
        Path("praboth/cog_py_est/data/state.db"),
        Path("../praboth/data/state.db"),
        Path("../../praboth/data/state.db"),
        Path("data/state.db"),  # If running from praboth directory
    ]
    
    for path in possible_paths:
        abs_path = path.resolve() if path.exists() else None
        if path.exists():
            return str(path)
    
    return None


def run_complete_workflow():
    # Configuration
    PRABOTH_DB_PATH = find_praboth_database()
    USER_ID = "user_001"
    
    if not PRABOTH_DB_PATH:
        print("=" * 70)
        print("[ERROR] PRABOTH DATABASE NOT FOUND")
        print("=" * 70)
        print("\nPlease specify the path to your praboth database.")
        print("Common locations:")
        print("  - praboth/cog_py_est/data/state.db")
        print("  - praboth/data/state.db")
        print("\nOr modify PRABOTH_DB_PATH in this script.")
        return
    
    print("=" * 70)
    print("ADAPTIVE SCHEDULER - COMPLETE WORKFLOW")
    print("=" * 70)
    print(f"\nUsing praboth database: {PRABOTH_DB_PATH}")
    
    # Step 1: Check praboth database
    print("\n1️⃣ Checking praboth database...")
    try:
        reader = PrabothDataReader(PRABOTH_DB_PATH)
        sessions = reader.get_sessions(limit=5)
        print(f"   [OK] Found {len(sessions)} recent sessions")
        if sessions:
            print(f"   Latest session: {sessions[0].session_id} (started: {sessions[0].started_at})")
            if len(sessions) > 1:
                print(f"   Sessions: {[s.session_id for s in sessions]}")
    except Exception as e:
        print(f"   [ERROR] Error: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Step 2: Sync praboth sessions
    print("\n2️⃣ Syncing praboth sessions to adaptive scheduler...")
    try:
        adapter = PrabothMetricsAdapter(praboth_db_path=PRABOTH_DB_PATH)
        session_ids = adapter.sync_all_recent_sessions(USER_ID, days_back=7)
        print(f"   [OK] Synced {len(session_ids)} sessions")
        if session_ids:
            print(f"   Adaptive scheduler session IDs: {session_ids}")
    except Exception as e:
        print(f"   ❌ Error syncing sessions: {e}")
        import traceback
        traceback.print_exc()
        print("\n   Trying to sync single session...")
        try:
            if sessions:
                session_id = adapter.sync_praboth_session(
                    praboth_session_id=sessions[0].session_id,
                    user_id=USER_ID,
                    task_type="writing",
                    chronotype="neutral",
                    algorithm="LinUCB"
                )
                print(f"   [OK] Synced session {sessions[0].session_id} -> {session_id}")
                session_ids = [session_id]
        except Exception as e2:
            print(f"   [ERROR] Failed to sync: {e2}")
            return
    
    # Step 3: Compute metrics
    print("\n3️⃣ Computing metrics from real data...")
    try:
        calculator = MetricsCalculator(user_id=USER_ID)
        metrics = calculator.compute_all_metrics()
        print(f"   [OK] Metrics computed")
        print(f"\n   📊 METRICS:")
        print(f"   {'─' * 60}")
        
        metric_values = {
            'PG (Personalization Gain)': metrics.PG,
            'RPH (Regret-per-Hour)': metrics.RPH,
            'AHL (Adaptation Half-Life)': metrics.AHL,
            'EOI (Exploration Overhead)': metrics.EOI,
            'AUC-BUC': metrics.AUC_BUC,
            'CTU (Counterfactual Uplift)': metrics.CTU,
            'SPF Variance': metrics.SPF_variance,
            'SVR (Safety Violation Rate)': metrics.SVR,
        }
        
        for name, value in metric_values.items():
            if value is None:
                display = "N/A"
            elif value == float('inf'):
                display = "∞ (No context shift)"
            else:
                display = f"{value:.4f}"
            print(f"   {name:<30} {display}")
        
        print(f"   {'─' * 60}")
        
    except Exception as e:
        print(f"   [ERROR] Error computing metrics: {e}")
        import traceback
        traceback.print_exc()
        print("\n   This is normal if no sessions have been synced yet.")
        metrics = None
    
    # Step 4: Create schedule for next session
    print("\n4️⃣ Creating schedule for next session...")
    try:
        scheduler = TimeBlockScheduler(algorithm="LinUCB")
        
        # Example: Next session 2pm-4pm (adjust as needed)
        now = datetime.now()
        tomorrow = now.replace(hour=14, minute=0, second=0, microsecond=0)
        if tomorrow < now:
            # If it's already past 2pm, use tomorrow
            from datetime import timedelta
            tomorrow = (now + timedelta(days=1)).replace(hour=14, minute=0, second=0, microsecond=0)
        
        end_time = tomorrow.replace(hour=16, minute=0)
        
        time_block = TimeBlock(
            start_time=tomorrow,
            end_time=end_time,
            user_id=USER_ID,
            task_type="writing",
            chronotype="neutral"
        )
        
        previous_metrics_dict = None
        if metrics:
            previous_metrics_dict = {
                'PG': metrics.PG,
                'RPH': metrics.RPH,
                'AHL': metrics.AHL,
                'EOI': metrics.EOI,
                'AUC_BUC': metrics.AUC_BUC,
                'CTU': metrics.CTU,
                'SPF_variance': metrics.SPF_variance,
                'SVR': metrics.SVR,
            }
        
        schedule = scheduler.create_initial_schedule(
            time_block=time_block,
            previous_metrics=previous_metrics_dict
        )
        
        print(f"   [OK] Schedule created for {time_block.start_time.strftime('%I:%M %p')} - {time_block.end_time.strftime('%I:%M %p')}")
        print(f"\n   📅 SCHEDULE:")
        print(f"   {'─' * 60}")
        print(f"   Total duration: {schedule.total_duration_minutes:.1f} minutes")
        print(f"   Work time: {schedule.work_time_minutes:.1f} minutes")
        print(f"   Break time: {schedule.break_time_minutes:.1f} minutes")
        print(f"   Number of intervals: {len(schedule.intervals)}")
        print(f"   {'─' * 60}")
        print(f"\n   Intervals:")
        
        for i, interval in enumerate(schedule.intervals, 1):
            start_str = interval.start_time.strftime('%I:%M %p')
            end_str = interval.end_time.strftime('%I:%M %p')
            icon = "[WORK]" if interval.interval_type == 'work' else "[BREAK]"
            
            if interval.interval_type == 'work':
                duration_info = f"{interval.work_interval} min work"
            else:
                duration_info = f"{interval.break_duration} min break"
            
            print(f"   {i}. {icon} {interval.interval_type.upper():5} {start_str} - {end_str} ({duration_info})")
        
    except Exception as e:
        print(f"   [ERROR] Error creating schedule: {e}")
        import traceback
        traceback.print_exc()
        return
    
    print("\n" + "=" * 70)
    print("[OK] WORKFLOW COMPLETE!")
    print("=" * 70)
    print("\nNext steps:")
    print("  1. Use the schedule above for your next study session")
    print("  2. After session, run this script again to sync new data")
    print("  3. Metrics will adapt based on your performance")


if __name__ == "__main__":
    run_complete_workflow()

