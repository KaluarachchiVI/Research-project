"""Manages persistence for EMA prompts and responses."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from backend.src.data.db import Database


def _dt(dt_val: datetime) -> str:
    return dt_val.isoformat()


class EmaRepository:
    def __init__(self, db: Database) -> None:
        self.db = db
        self.session_id: Optional[int] = None

    def set_session_id(self, session_id: Optional[int]) -> None:
        self.session_id = session_id

    async def record_prompt(self, reason: str, state: str = "delivered") -> Optional[int]:
        if self.session_id is None:
            return None
        now = datetime.utcnow()
        cursor = await self.db.execute(
            """
            INSERT INTO ema_prompts (session_id, issued_at, trigger_reason, state)
            VALUES (?, ?, ?, ?)
            """,
            (self.session_id, _dt(now), reason, state),
        )
        await self.db.commit()
        prompt_id = cursor.lastrowid
        return int(prompt_id) if prompt_id is not None else None

    async def update_prompt_state(self, prompt_id: int, state: str) -> None:
        await self.db.execute(
            "UPDATE ema_prompts SET state = ? WHERE prompt_id = ?",
            (state, prompt_id),
        )
        await self.db.commit()

    async def fetch_latest_pending_prompt(self, timeout_seconds: int) -> Optional[Dict[str, Any]]:
        """Retrieves the most recent delivered prompt awaiting a response, respecting the timeout."""
        cursor = await self.db.execute(
            """
            SELECT p.prompt_id, p.issued_at, p.trigger_reason
            FROM ema_prompts p
            WHERE p.state = 'delivered'
            AND NOT EXISTS (SELECT 1 FROM ema_responses r WHERE r.prompt_id = p.prompt_id)
            ORDER BY p.issued_at DESC
            LIMIT 1
            """
        )
        row = await cursor.fetchone()
        if not row:
            return None
        prompt_id, issued_at_str, reason = row
        issued_at = datetime.fromisoformat(issued_at_str)
        age = (datetime.utcnow() - issued_at).total_seconds()
        if age > timeout_seconds:
            await self.update_prompt_state(prompt_id, "timeout")
            return None
        return {
            "prompt_id": int(prompt_id),
            "reason": reason,
            "issued_at": issued_at,
        }

    async def record_response(
        self,
        prompt_id: int,
        rating: int,
        disposition: str,
        note: str | None = None,
    ) -> None:
        now = datetime.utcnow()
        await self.db.execute(
            """
            INSERT INTO ema_responses (prompt_id, responded_at, rating, disposition, note)
            VALUES (?, ?, ?, ?, ?)
            """,
            (prompt_id, _dt(now), rating, disposition, note),
        )
        await self.db.commit()
