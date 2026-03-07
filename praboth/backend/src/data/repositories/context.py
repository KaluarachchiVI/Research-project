"""Manages persistence for the context classification cache."""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Tuple

from backend.src.data.db import Database


def _dt(dt_val: datetime) -> str:
    return dt_val.isoformat()


class ContextRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    async def get_cached_classification(self, cache_key: str) -> Optional[Tuple[bool, str]]:
        cursor = await self.db.execute(
            "SELECT is_study, category FROM context_classification_cache WHERE cache_key = ?",
            (cache_key,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return bool(row[0]), row[1]

    async def cache_classification(
        self, cache_key: str, is_study: bool, category: str
    ) -> None:
        await self.db.execute(
            """
            INSERT OR REPLACE INTO context_classification_cache (cache_key, is_study, category, classified_at)
            VALUES (?, ?, ?, ?)
            """,
            (cache_key, is_study, category, _dt(datetime.utcnow())),
        )
        await self.db.commit()
