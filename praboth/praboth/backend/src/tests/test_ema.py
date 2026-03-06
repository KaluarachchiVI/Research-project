import pytest
from datetime import datetime, timedelta
from backend.src.core.config import EmaConfig
from backend.src.services.ema import EmaScheduler, SchedulerState
from backend.src.services.kalman import Estimate

@pytest.fixture
def scheduler():
    config = EmaConfig(
        min_seconds_between_prompts=60,
        cooldown_on_dismiss_seconds=30,
        trigger_uncertainty_threshold=0.5,
        trigger_residual_threshold=0.5
    )
    return EmaScheduler(config)

@pytest.fixture
def stable_estimate():
    return Estimate(
        timestamp=datetime.now(),
        load=0.5,
        variance=0.1,
        residual=0.1
    )

def test_eligibility_triggers(scheduler, stable_estimate):
    now = datetime.now()
    
    # Stable -> Not eligible
    decision = scheduler.evaluate(stable_estimate, now)
    assert not decision.should_prompt
    assert decision.reason == "stable"
    
    # High Variance -> Eligible
    high_var = Estimate(datetime.now(), 0.5, 0.6, 0.1) # > 0.5
    decision = scheduler.evaluate(high_var, now)
    assert decision.should_prompt
    assert decision.reason == "uncertainty"
    
    # High Residual -> Eligible
    high_res = Estimate(datetime.now(), 0.5, 0.1, 0.6) # > 0.5
    decision = scheduler.evaluate(high_res, now)
    assert decision.should_prompt
    assert decision.reason == "residual"

def test_suppression_logic(scheduler, stable_estimate):
    now = datetime.now()
    
    # Privacy Pause
    scheduler.set_privacy_pause(True)
    decision = scheduler.evaluate(stable_estimate, now)
    assert decision.state == SchedulerState.HARD_SUPPRESSED
    assert not decision.should_prompt
    
    scheduler.set_privacy_pause(False)
    
    # Context Block
    context = {"focus_app": "Teams"} 
    # Providing context updates internal state
    decision = scheduler.evaluate(stable_estimate, now, context)
    # Next call within block window (30s default in Config, but checking scheduler default)
    # EmaConfig default context_block_seconds is 30.
    
    # Immediate check might pass if block starts NOW.
    # Logic: _update_context sets blocked_until = now + 30.
    # Then: if now < blocked_until -> suppress.
    # So if we pass context, it sets the block for FUTURE checks? 
    # Or current?
    # Logic: _update_context(context, now) -> sets blocked_until = now + 30
    # Then: if now < blocked_until... 
    # Wait, if now == now (same object), it might be False (now < now is False).
    # But usually context block applies to subsequent checks or current if strict inequality?
    # Code: `if self.context_blocked_until and now < self.context_blocked_until:`
    # If blocked_until = now + 30. now < now+30 is True.
    # So it should suppress immediately.
    assert decision.state == SchedulerState.CONTEXT_SUPPRESSED

def test_response_handling(scheduler):
    now = datetime.now()
    
    # Record prompt
    scheduler.record_prompt(now)
    assert scheduler.awaiting_response
    
    # Dismiss -> Snoozed
    scheduler.record_response("dismissed", now)
    assert not scheduler.awaiting_response
    assert scheduler.snoozed_until == now + timedelta(seconds=30)
    assert scheduler.cooldown_until is None
