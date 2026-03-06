from backend.src.services.distraction.distraction import DistractionTracker
from datetime import datetime, timedelta
import random

def test():
    tracker = DistractionTracker(threshold_seconds=100, min_history=5)
    
    start = datetime.utcnow()
    
    # 1. Feed 5 short "micro-breaks" (e.g., 10s)
    # This should lower the adaptive threshold near 10s + margin
    print("Feeding micro-breaks...")
    for i in range(5):
        tracker.update(is_study=False, timestamp=start, current_app="discord")
        end_break = start + timedelta(seconds=10)
        tracker.update(is_study=True, timestamp=end_break, current_app="code")
        start = end_break + timedelta(minutes=1)
        
    print(f"History: {tracker.history}")
    adaptive = tracker.current_threshold
    print(f"Adaptive Threshold (after 10s breaks): {adaptive:.2f}")
    
    # Expect threshold to be low. Median=10, Std=0. 10 + 0 = 10. Clamped to 30.
    # So threshold should be 30.
    
    if adaptive == 30.0:
        print("PASS: Clamped to 30s")
    else:
        print(f"FAIL: Expected 30s, got {adaptive}")
        
    # 2. Feed 5 long breaks (e.g., 300s)
    # History becomes [10, 10, 10, 10, 10, 300, 300, 300, 300, 300]
    # Median ~ 155? No, sorted: 10,10,10,10,10, 300,300,300,300,300. Median is (10+300)/2 = 155.
    # Std dev will be large.
    
    print("\nFeeding long breaks...")
    for i in range(5):
        tracker.update(is_study=False, timestamp=start, current_app="game")
        end_break = start + timedelta(seconds=300) # 5 mins
        tracker.update(is_study=True, timestamp=end_break, current_app="code")
        start = end_break + timedelta(minutes=1)
        
    print(f"History: {tracker.history}")
    adaptive = tracker.current_threshold
    print(f"Adaptive Threshold (mixed): {adaptive:.2f}")
    
    # Threshold should increase significantly
    if adaptive > 100:
        print("PASS: Threshold increased")
    else:
        print("FAIL: Threshold did not adapt")

if __name__ == "__main__":
    test()
