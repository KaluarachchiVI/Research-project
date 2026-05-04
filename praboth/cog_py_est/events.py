"""Legacy shim for event primitives."""

from backend.src.core.events import Event, EventBuffer, PermissionGuard, utc_now

__all__ = ["Event", "EventBuffer", "PermissionGuard", "utc_now"]
