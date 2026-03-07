"""Manages persistence for policy enforcement events."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.src.data.db import Database


def _dt(dt_val: datetime) -> str:
    return dt_val.isoformat()


class PolicyRepository:
    def __init__(self, db: Database) -> None:
        self.db = db
        self.session_id: Optional[int] = None

    def set_session_id(self, session_id: Optional[int]) -> None:
        self.session_id = session_id

    async def record_policy_event(
        self,
        event_type: str,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        if self.session_id is None:
            return
        await self.db.execute(
            """
            INSERT INTO policy_events (session_id, occurred_at, event_type, reason, metadata_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                self.session_id,
                _dt(datetime.utcnow()),
                event_type,
                reason,
                json.dumps(metadata or {}),
            ),
        )
        await self.db.commit()

    async def fetch_policy_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        cursor = await self.db.execute(
            """
            SELECT occurred_at, event_type, reason, metadata_json
            FROM policy_events
            ORDER BY occurred_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
        events: List[Dict[str, Any]] = []
        for occurred_at, event_type, reason, metadata_json in rows:
            metadata: Dict[str, Any] = {}
            if metadata_json:
                try:
                    metadata = json.loads(metadata_json)
                except json.JSONDecodeError:
                    metadata = {}
            events.append(
                {
                    "occurred_at": occurred_at,
                    "event_type": event_type,
                    "reason": reason,
                    "metadata": metadata,
                }
            )
        return events
