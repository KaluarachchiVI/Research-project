"""Manages persistence for data exports."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.src.data.db import Database


def _dt(dt_val: datetime) -> str:
    return dt_val.isoformat()


class ExportRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    async def create_aggregated_export(
        self, summary: Dict[str, Any], status: str = "pending", reviewer: Optional[str] = None, file_path: Optional[str] = None
    ) -> int:
        cursor = await self.db.execute(
            """
            INSERT INTO aggregated_exports (created_at, status, reviewer, summary_json, file_path)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                _dt(datetime.utcnow()),
                status,
                reviewer,
                json.dumps(summary),
                file_path,
            ),
        )
        await self.db.commit()
        if cursor.lastrowid is None:
            raise RuntimeError("failed to create export record")
        return int(cursor.lastrowid)

    async def list_exports(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        if status:
            cursor = await self.db.execute(
                """
                SELECT export_id, created_at, status, reviewer, summary_json, file_path
                FROM aggregated_exports
                WHERE status = ?
                ORDER BY created_at DESC
                """,
                (status,),
            )
        else:
            cursor = await self.db.execute(
                """
                SELECT export_id, created_at, status, reviewer, summary_json, file_path
                FROM aggregated_exports
                ORDER BY created_at DESC
                """
            )
        rows = await cursor.fetchall()
        exports = []
        for export_id, created_at, status_val, reviewer, summary_json, file_path in rows:
            try:
                summary = json.loads(summary_json)
            except json.JSONDecodeError:
                summary = {}
            exports.append(
                {
                    "export_id": export_id,
                    "created_at": created_at,
                    "status": status_val,
                    "reviewer": reviewer,
                    "summary": summary,
                    "file_path": file_path,
                }
            )
        return exports

    async def update_export_status(
        self, export_id: int, status: str, reviewer: Optional[str] = None, file_path: Optional[str] = None
    ) -> None:
        await self.db.execute(
            """
            UPDATE aggregated_exports
            SET status = ?, reviewer = COALESCE(?, reviewer), file_path = COALESCE(?, file_path)
            WHERE export_id = ?
            """,
            (status, reviewer, file_path, export_id),
        )
        await self.db.commit()
