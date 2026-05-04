"""
Quick test script to simulate 30 minutes of work in fast mode and check reward.
This script:
1. Starts a time block session
2. Simulates work activity (fast mode - 30 min in ~3 minutes)
3. Ends the work interval to trigger reward calculation
4. Displays the reward
"""
import requests
import time
import json
from datetime import datetime, timedelta
import random

API_BASE = "http://127.0.0.1:5000/api"
PRABOTH_URL = "http://localhost:8000"

def check_services():
    """Check if both services are running"""
    try:
        response = requests.get(f"{API_BASE}/health", timeout=2.0)
        if response.status_code != 200:
            print(f"❌ Adaptive Scheduler API not responding: {response.status_code}")
            return False
        print("✓ Adaptive Scheduler API is running")
    except Exception as e:
        print(f"❌ Cannot connect to Adaptive Scheduler API: {e}")
        return False
    
    try:
        response = requests.get(f"{PRABOTH_URL}/health", timeout=2.0)
        if response.status_code != 200:
            print(f"⚠️  Praboth not responding (will use estimated load): {response.status_code}")
        else:
            print("✓ Praboth service is running")
    except:
        print("⚠️  Praboth not available (will use estimated load)")
    
    return True

def start_session():
    """Start a new time block session"""
    now = datetime.utcnow()
    start_time = now + timedelta(minutes=1)
    end_time = start_time + timedelta(hours=2)
    
    payload = {
        "user_id": "test_user",
        "start_time": start_time.isoformat() + "Z",
        "end_time": end_time.isoformat() + "Z",
        "task_type": "coding",
        "chronotype": "neutral",
        "algorithm": "LinUCB"
    }
    
    print("\n🚀 Starting time block session...")
    print(f"   Start: {start_time.strftime('%H:%M:%S')}")
    print(f"   End: {end_time.strftime('%H:%M:%S')}")
    print(f"   Task: {payload['task_type']}")
    
    try:
        response = requests.post(f"{API_BASE}/time-block/start", json=payload, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        session_id = data.get('session_id')
        print(f"✓ Session started: {session_id[:8]}...")
        return session_id
    except Exception as e:
        print(f"❌ Error starting session: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Response: {e.response.text}")
        return None

def send_keystroke_event(latency_ms=100, is_error=False, is_backspace=False):
    """Send a keystroke event to praboth"""
    try:
        payload = {
            "source": "keyboard",
            "payload": {
                "latency_ms": latency_ms,
                "is_error": is_error,
                "is_backspace": is_backspace
            },
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        response = requests.post(
            f"{PRABOTH_URL}/events",
            json=payload,
            timeout=1.0
        )
        return response.status_code == 200
    except:
        return False

def send_pointer_event(dx=10, dy=10, dt_ms=100):
    """Send a pointer event to praboth"""
    try:
        payload = {
            "source": "pointer",
            "payload": {
                "dx": dx,
                "dy": dy,
                "dt_ms": dt_ms
            },
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        response = requests.post(
            f"{PRABOTH_URL}/events",
            json=payload,
            timeout=1.0
        )
        return response.status_code == 200
    except:
        return False

def simulate_work_fast(duration_minutes=30, speed_multiplier=10):
    """
    Simulate work activity in fast mode.
    duration_minutes: How long to simulate (in real work time)
    speed_multiplier: How much faster (10x = 30 min in 3 min)
    """
    real_duration_seconds = (duration_minutes * 60) / speed_multiplier
    events_per_second = 2  # 2 events per second in fast mode
    
    total_events = int(real_duration_seconds * events_per_second)
    print(f"\n⏱️  Simulating {duration_minutes} minutes of work (fast mode: {speed_multiplier}x)")
    print(f"   Real time: {real_duration_seconds:.1f} seconds")
    print(f"   Events: ~{total_events} events")
    print(f"   Progress: ", end="", flush=True)
    
    start_time = time.time()
    keyboard_count = 0
    pointer_count = 0
    
    for i in range(total_events):
        # Mix of keyboard and pointer events
        if random.random() < 0.7:  # 70% keyboard
            latency = random.gauss(100, 20)
            is_error = random.random() < 0.05
            is_backspace = is_error and random.random() < 0.7
            send_keystroke_event(latency, is_error, is_backspace)
            keyboard_count += 1
        else:  # 30% pointer
            dx = random.uniform(-50, 50)
            dy = random.uniform(-50, 50)
            dt = random.gauss(100, 50)
            send_pointer_event(dx, dy, dt)
            pointer_count += 1
        
        # Progress indicator
        if (i + 1) % (total_events // 20) == 0:
            print("█", end="", flush=True)
        
        # Small delay to avoid overwhelming the system
        time.sleep(1.0 / events_per_second)
    
    elapsed = time.time() - start_time
    print(f"\n✓ Simulation complete!")
    print(f"   Keyboard events: {keyboard_count}")
    print(f"   Pointer events: {pointer_count}")
    print(f"   Real time elapsed: {elapsed:.1f} seconds")
    
    return keyboard_count + pointer_count

def get_cognitive_load(session_id):
    """Get current cognitive load"""
    try:
        response = requests.get(
            f"{API_BASE}/cognitive-load",
            params={"session_id": session_id},
            timeout=5.0
        )
        if response.status_code == 200:
            data = response.json()
            if data.get('available'):
                return data.get('cognitive_load', 0.5)
    except:
        pass
    return 0.5  # Default

def end_work_interval(session_id):
    """End the work interval and get the reward"""
    print("\n🏁 Ending work interval...")
    
    # Get current cognitive load
    cognitive_load = get_cognitive_load(session_id)
    print(f"   Current cognitive load: {cognitive_load:.2%}")
    
    # Prepare metrics
    metrics = {
        "chars_typed": random.randint(200, 800),
        "cognitive_load_pre_break": cognitive_load,
        "cognitive_load_post_break": max(0.1, cognitive_load - 0.1),  # Slight decrease
        "improved_focus": True,
        "deep_work_interrupted": False
    }
    
    payload = {
        "session_id": session_id,
        "interval_type": "work",
        "metrics": metrics
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/time-block/end-interval",
            json=payload,
            timeout=10.0
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('error'):
                print(f"❌ Error: {data['error']}")
                return None
            
            # Extract reward
            reward_data = data.get('reward_computed', {})
            immediate_reward = reward_data.get('immediate_reward', 0)
            
            # Extract next action
            next_action = data.get('next_action') or data.get('next_recommendation', {})
            
            print(f"\n{'='*60}")
            print(f"🎉 REWARD CALCULATED!")
            print(f"{'='*60}")
            print(f"   Immediate Reward: {immediate_reward:.4f}")
            print(f"   Next Work Interval: {next_action.get('work_interval', 'N/A')} min")
            print(f"   Next Break Duration: {next_action.get('break_duration', 'N/A')} min")
            
            if data.get('metadata'):
                meta = data['metadata']
                print(f"\n   Algorithm: {meta.get('algorithm', 'N/A')}")
                print(f"   Confidence: {meta.get('confidence', 0):.2%}")
                if meta.get('was_overridden'):
                    print(f"   ⚠️  Safety Override: {meta.get('override_reason', 'N/A')}")
            
            print(f"{'='*60}\n")
            
            return immediate_reward
        else:
            print(f"❌ Error: Status {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error ending interval: {e}")
        return None

def main():
    print("="*60)
    print("🧪 QUICK REWARD TEST - 30 Min Work Simulation")
    print("="*60)
    
    # Check services
    if not check_services():
        print("\n❌ Services not available. Please start:")
        print("   1. Adaptive Scheduler API (port 5000)")
        print("   2. Praboth service (port 8000) - optional")
        return
    
    # Start session
    session_id = start_session()
    if not session_id:
        return
    
    # Wait a moment for session to initialize
    print("\n⏳ Waiting 2 seconds for session initialization...")
    time.sleep(2)
    
    # Simulate work
    simulate_work_fast(duration_minutes=30, speed_multiplier=10)
    
    # Wait a moment for praboth to process events
    print("\n⏳ Waiting 3 seconds for praboth to process events...")
    time.sleep(3)
    
    # End work interval and get reward
    reward = end_work_interval(session_id)
    
    if reward is not None:
        print("✅ Test completed successfully!")
        print(f"\n💡 You can now check the dashboard to see the full results.")
        print(f"   Dashboard: http://127.0.0.1:5000/static/dashboard.html")
        print(f"   Or via Praboth UI: http://localhost:3000/scheduler")
    else:
        print("❌ Test failed - could not get reward")

if __name__ == "__main__":
    main()

