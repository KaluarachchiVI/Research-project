"""Manages persistence for distraction tracking data."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.src.data.db import Database


def _dt(dt_val: datetime) -> str:
    return dt_val.isoformat()


class DistractionRepository:
    def __init__(self, db: Database) -> None:
        self.db = db
        self.session_id: Optional[int] = None

    def set_session_id(self, session_id: Optional[int]) -> None:
        self.session_id = session_id

    async def record_distraction_period(self, start_time: datetime, end_time: datetime, app_name: str = "unknown") -> None:
        if self.session_id is None:
            return
        await self.db.execute(
            """
            INSERT INTO distraction_periods (session_id, start_time, end_time, app_name)
            VALUES (?, ?, ?, ?)
            """,
            (self.session_id, _dt(start_time), _dt(end_time), app_name),
        )
        await self.db.commit()

    async def fetch_distraction_periods(self, limit: int = 50) -> List[Dict[str, Any]]:
        cursor = await self.db.execute(
            """
            SELECT start_time, end_time, app_name
            FROM distraction_periods
            ORDER BY start_time DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
        periods = []
        for row in rows:
            start, end, app = row[0], row[1], row[2]
            periods.append({
                "start_time": start,
                "end_time": end,
                "app_name": app or "unknown"
            })
        return periods
