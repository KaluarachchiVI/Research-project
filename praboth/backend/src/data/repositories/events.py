"""Manages persistence for sessions and input events."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from backend.src.core.events import Event
from backend.src.data.db import Database


def _dt(dt_val: datetime) -> str:
    return dt_val.isoformat()


class EventRepository:
    def __init__(self, db: Database) -> None:
        self.db = db
        self.session_id: Optional[int] = None

    async def start_session(
        self, consent_version: str = "v1", device_label: str = "workstation"
    ) -> int:
        now = datetime.utcnow()
        cursor = await self.db.execute(
            "INSERT INTO sessions (started_at, device_label, consent_version) VALUES (?, ?, ?)",
            (_dt(now), device_label, consent_version),
        )
        await self.db.commit()
        if cursor.lastrowid is None:
            raise RuntimeError("failed to create session row")
        self.session_id = int(cursor.lastrowid)
        return self.session_id

    async def record_event(self, event: Event, hop_index: int) -> None:
        if self.session_id is None:
             # Aborts recording if no active session exists.
            return
        
        await self.db.execute(
            """
            INSERT INTO input_events (session_id, occurred_at, source, payload_json, hop_index)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                self.session_id,
                _dt(event.timestamp),
                event.source,
                json.dumps(event.payload),
                hop_index,
            ),
        )
        await self.db.commit()

    async def end_session(self) -> None:
        if self.session_id is None:
            return
        await self.db.execute(
            "UPDATE sessions SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL",
            (_dt(datetime.utcnow()), self.session_id),
        )
        await self.db.commit()
