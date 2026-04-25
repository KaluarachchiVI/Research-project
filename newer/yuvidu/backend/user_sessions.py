"""
User-scoped data from the Adaptive Scheduler API (Phase 3).
When user_id is provided, Yuvidu can show heatmaps/keyed by that user.
"""
import os
from datetime import datetime
from typing import Optional

import requests

SCHEDULER_API_BASE = os.environ.get("SCHEDULER_API_BASE", "http://127.0.0.1:5000")


def fetch_user_sessions(user_id: str, limit: int = 100) -> list:
    """Fetch recent sessions for a user from the scheduler API."""
    try:
        r = requests.get(
            f"{SCHEDULER_API_BASE.rstrip('/')}/api/time-block/user-sessions",
            params={"user_id": user_id, "limit": limit},
            timeout=5,
        )
        if not r.ok:
            return []
        data = r.json()
        return data.get("sessions") or []
    except Exception:
        return []


def get_hourly_intensity_for_user(user_id: str) -> Optional[dict]:
    """
    Build hourly intensity (0-23) from the user's session start times.
    Returns same shape as bandit_model.get_hourly_intensity() when possible.
    """
    sessions = fetch_user_sessions(user_id)
    if not sessions:
        return None

    hourly_intensity = {str(i).zfill(2): 0 for i in range(24)}
    for s in sessions:
        start_time = s.get("start_time")
        if not start_time:
            continue
        try:
            dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            hour = dt.hour
            hourly_intensity[str(hour).zfill(2)] += 1
        except (ValueError, TypeError):
            continue

    total = sum(hourly_intensity.values())
    if total == 0:
        return None

    hourly_percentages = {
        h: (count / total) * 100 for h, count in hourly_intensity.items()
    }
    formatted_hours = []
    for i in range(24):
        hour_24 = str(i).zfill(2)
        hour_12 = f"{i % 12 or 12}{'AM' if i < 12 else 'PM'}"
        formatted_hours.append({
            "hour": hour_12,
            "intensity": hourly_percentages[hour_24],
        })
    return {
        "hourly_data": formatted_hours,
        "status": "success",
        "user_id": user_id,
    }
