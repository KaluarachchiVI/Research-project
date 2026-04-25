import pytest
from datetime import datetime, timedelta
from typing import List
from backend.src.core.config import WindowConfig
from backend.src.core.events import Event
from backend.src.services.window_manager import WindowManager, WindowContext

@pytest.fixture
def manager():
    config = WindowConfig(
        window_seconds=60.0,
        hop_seconds=15.0,
        inactivity_gap_seconds=5.0
    )
    return WindowManager(config)

def test_initialization(manager):
    assert manager.window_span.total_seconds() == 60.0
    assert manager._last_window_end is None

def test_context_extraction(manager):
    # Simulate events
    now = datetime(2023, 1, 1, 12, 0, 0)
    events = [
        Event(timestamp=now, source="system", payload={"focus_app": "Code", "running_apps": ["Code"]}),
        Event(timestamp=now + timedelta(seconds=1), source="system", payload={"focus_app": "Chrome", "running_apps": ["Chrome"]}),
    ]
    
    context = manager._context_from_events(events)
    assert isinstance(context, WindowContext)
    # running_apps accumulates observed apps (sorted set logic in implementation)
    assert "Code" in context.running_apps
    assert "Chrome" in context.running_apps
    assert context.context_flags.get("focus_app") == "Chrome" # Uses last event's focus

def test_missing_window_detection(manager):
    events = []
    end1 = datetime(2023, 1, 1, 12, 0, 0)
    
    # First window
    fused, ctx = manager.build_window(events, 0, end1)
    assert ctx.missing_window is False
    
    # Second window, 15s later (normal hop)
    end2 = end1 + timedelta(seconds=15)
    fused, ctx = manager.build_window(events, 1, end2)
    assert ctx.missing_window is False
    
    # Third window, 60s later (gap!)
    end3 = end2 + timedelta(seconds=60)
    fused, ctx = manager.build_window(events, 2, end3)
    assert ctx.missing_window is True
