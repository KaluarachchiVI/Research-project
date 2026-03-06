import pytest
import numpy as np
from datetime import datetime, timedelta
from backend.src.services.ema import UncertaintySampler, BreakpointManager

def test_uncertainty_sampler():
    # History 10, 90th percentile
    sampler = UncertaintySampler(history_size=10, percentile=90.0)
    
    # Warmup (needs 10 samples)
    for _ in range(9):
        assert sampler.evaluate(0.1) == False
        
    # 10th sample, still low variance
    assert sampler.evaluate(0.1) == False
    
    # Fill history with 0.1
    # Now inject a high variance
    # History: [0.1, ... 0.1] (size 10)
    # 90th percentile of [0.1]*10 is 0.1
    # So 0.1 should actually trigger if >= threshold. 
    # Let's make the history diverse.
    
    sampler.variance_history = [0.1, 0.2, 0.1, 0.2, 0.1, 0.2, 0.1, 0.2, 0.1, 0.2]
    # 90th percentile of this mix is ~0.2
    
    # Test low variance
    assert sampler.evaluate(0.05) == False
    
    # Test high variance
    # If we pass 1.0, it will be added to history, removing the first 0.1
    # History becomes [0.2, 0.1, ..., 1.0]
    # 90th percentile will jump, but the method returns comparison against the computed threshold *before*? 
    # No, evaluate appends THEN calculates. 
    # So if I add 1.0, it computes percentile of [... , 1.0]. 
    # The 90th percentile of 10 items including 1.0 will likely be 1.0 or close to it.
    # Logic: return variance >= threshold.
    # If 1.0 is the max, it is >= 90th percentile.
    
    assert sampler.evaluate(1.0) == True


def test_breakpoint_manager():
    manager = BreakpointManager(max_pending_seconds=60)
    now = datetime.utcnow()
    
    # Queue a prompt
    manager.queue_prompt("uncertainty", now)
    assert manager.is_pending() == True
    
    # Check release - No breakpoint
    reason = manager.check_release(now + timedelta(seconds=10), context_flags={}, macro_pause_detect=False)
    assert reason is None
    assert manager.is_pending() == True
    
    # Check release - Macro Pause
    reason = manager.check_release(now + timedelta(seconds=20), context_flags={}, macro_pause_detect=True)
    assert reason == "uncertainty_breakpoint"
    assert manager.is_pending() == False

def test_breakpoint_timeout():
    manager = BreakpointManager(max_pending_seconds=60)
    now = datetime.utcnow()
    manager.queue_prompt("uncertainty", now)
    
    # Timeout
    future = now + timedelta(seconds=61)
    reason = manager.check_release(future, context_flags={}, macro_pause_detect=False)
    assert reason == "timeout_forced"
    assert manager.is_pending() == False
