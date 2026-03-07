"""Manages persistence for telemetry metrics and analytics."""

from __future__ import annotations

import json
from hashlib import sha256
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.src.data.db import Database


def _dt(dt_val: datetime) -> str:
    return dt_val.isoformat()


class TelemetryRepository:
    def __init__(self, db: Database) -> None:
        self.db = db
        self.session_id: Optional[int] = None

    def set_session_id(self, session_id: Optional[int]) -> None:
        self.session_id = session_id

    async def record_metric(
        self, metric_type: str, metric_value: float, metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        if self.session_id is None:
            return
        now = datetime.utcnow()
        await self.db.execute(
            """
            INSERT INTO telemetry_metrics (session_id, snapshot_at, metric_type, metric_value, metadata_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                self.session_id,
                _dt(now),
                metric_type,
                metric_value,
                json.dumps(metadata or {}),
            ),
        )
        await self.db.commit()

    async def fetch_metrics(self, limit: int = 200) -> List[Dict[str, Any]]:
        cursor = await self.db.execute(
            """
            SELECT snapshot_at, metric_type, metric_value, metadata_json
            FROM telemetry_metrics
            ORDER BY snapshot_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
        metrics: List[Dict[str, Any]] = []
        for snapshot_at, metric_type, metric_value, metadata_json in rows:
            metadata: Dict[str, Any] = {}
            if metadata_json:
                try:
                    metadata = json.loads(metadata_json)
                except json.JSONDecodeError:
                    metadata = {}
            metrics.append(
                {
                    "snapshot_at": snapshot_at,
                    "metric_type": metric_type,
                    "metric_value": metric_value,
                    "metadata": metadata,
                }
            )
        return metrics

    async def aggregated_summary(self) -> Dict[str, Any]:
        """Generates a comprehensive session summary for export."""
        summary: Dict[str, Any] = {}

        async def scalar(query: str) -> int:
            cursor = await self.db.execute(query)
            row = await cursor.fetchone()
            return int(row[0]) if row and row[0] is not None else 0

        summary["input_events"] = await scalar("SELECT COUNT(*) FROM input_events")
        summary["feature_windows"] = await scalar("SELECT COUNT(*) FROM feature_windows")
        summary["ema_prompts"] = await scalar("SELECT COUNT(*) FROM ema_prompts")
        summary["ema_responses"] = await scalar("SELECT COUNT(*) FROM ema_responses")

        cursor = await self.db.execute(
            "SELECT AVG(metric_value), MAX(metric_value) FROM telemetry_metrics WHERE metric_type = 'residual_rms'"
        )
        row = await cursor.fetchone()
        summary["residual_rms_avg"] = row[0] if row and row[0] is not None else 0.0
        summary["residual_rms_peak"] = row[1] if row and row[1] is not None else 0.0

        cursor = await self.db.execute(
            "SELECT AVG(metric_value) FROM telemetry_metrics WHERE metric_type = 'variance'"
        )
        row = await cursor.fetchone()
        summary["variance_avg"] = row[0] if row and row[0] is not None else 0.0

        cursor = await self.db.execute(
            "SELECT AVG(rating) FROM ema_responses WHERE disposition = 'completed'"
        )
        row = await cursor.fetchone()
        summary["ema_rating_avg"] = row[0] if row and row[0] is not None else None

        cursor = await self.db.execute(
            "SELECT MIN(started_at), MAX(ended_at) FROM sessions"
        )
        row = await cursor.fetchone()
        summary["session"] = {
            "started_at": row[0] if row and row[0] else None,
            "ended_at": row[1] if row and row[1] else None,
        }

        cursor = await self.db.execute(
            """
            SELECT MIN(window_start), MAX(window_end), MIN(hop_index), MAX(hop_index)
            FROM feature_windows
            """
        )
        row = await cursor.fetchone()
        summary["window_span"] = {
            "start": row[0] if row and row[0] else None,
            "end": row[1] if row and row[1] else None,
            "first_hop": row[2] if row and row[2] is not None else None,
            "last_hop": row[3] if row and row[3] is not None else None,
        }

        cursor = await self.db.execute(
            """
            SELECT reason, COUNT(*) as count
            FROM policy_events
            GROUP BY reason
            """
        )
        policy_reasons = {reason or "unknown": count for reason, count in await cursor.fetchall()}
        policy_total = sum(policy_reasons.values())
        summary["policy_events"] = policy_total
        summary["policy_reasons"] = policy_reasons

        cursor = await self.db.execute(
            """
            SELECT prompt_id, trigger_reason, state
            FROM ema_prompts
            ORDER BY prompt_id DESC
            LIMIT 20
            """
        )
        prompts = [
            {"prompt_id": pid, "reason": reason, "state": state}
            for pid, reason, state in await cursor.fetchall()
        ]
        summary["ema_prompts_recent"] = prompts

        summary["checksum"] = sha256(json.dumps(summary, sort_keys=True).encode("utf-8")).hexdigest()

        return summary
