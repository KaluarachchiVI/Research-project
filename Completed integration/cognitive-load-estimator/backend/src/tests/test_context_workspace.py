from datetime import datetime

from backend.src.core.events import Event
from backend.src.core.config import WindowConfig
from backend.src.services.context import extract_workspace_hint
from backend.src.services.window_manager import WindowManager


def test_extract_workspace_hint_for_vscode_title() -> None:
    title = "events.py - praboth - Visual Studio Code"
    workspace = extract_workspace_hint("Code.exe", title)
    assert workspace == "praboth"


def test_extract_workspace_hint_ignores_non_workspace_title() -> None:
    title = "Settings - Visual Studio Code"
    workspace = extract_workspace_hint("Code.exe", title)
    assert workspace == ""


def test_window_context_includes_workspace_flag() -> None:
    manager = WindowManager(
        WindowConfig(window_seconds=60.0, hop_seconds=15.0, inactivity_gap_seconds=5.0)
    )
    now = datetime(2024, 1, 1, 12, 0, 0)
    events = [
        Event(
            timestamp=now,
            source="system",
            payload={
                "focus_app": "Visual Studio Code",
                "workspace": "praboth",
                "running_apps": ["Visual Studio Code"],
            },
        )
    ]

    context = manager._context_from_events(events)
    assert context.context_flags.get("workspace") == "praboth"
