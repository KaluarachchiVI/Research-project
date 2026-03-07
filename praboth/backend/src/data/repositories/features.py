"""Manages persistence for feature windows."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from backend.src.data.db import Database
from backend.src.services.processing.features import FeatureWindow


def _dt(dt_val: datetime) -> str:
    return dt_val.isoformat()


class FeatureRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    async def record_window(
        self, window: FeatureWindow, session_id: Optional[int], ema_prompt_id: Optional[int] = None
    ) -> None:
        if session_id is None:
            return
        payload = json.dumps(window.vector.tolist())
        await self.db.execute(
            """
            INSERT INTO feature_windows (session_id, hop_index, window_start, window_end, feature_vector_json, quality_score, ema_prompt_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                window.hop_index,
                _dt(window.window_start),
                _dt(window.window_end),
                payload,
                window.quality,
                ema_prompt_id,
            ),
        )
        await self.db.commit()
