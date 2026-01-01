"""Module for exporting session data to SQLite."""
from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

def get_focus_app(cursor: sqlite3.Cursor, start_iso: str, end_iso: str) -> str:
    """Fetch the most frequent focus_app from system events within the time window."""
    try:
        cursor.execute(
            """
            SELECT payload_json 
            FROM input_events 
            WHERE source = 'system' 
              AND occurred_at >= ? 
              AND occurred_at <= ?
            """,
            (start_iso, end_iso)
        )
        rows = cursor.fetchall()
        if not rows:
            return "unknown"
        
        # Simple heuristic: take the last reported focus app in the window
        last_payload = json.loads(rows[-1][0])
        return last_payload.get("focus_app", "unknown")
    except (json.JSONDecodeError, IndexError, sqlite3.Error):
        return "error"

def export_to_sqlite(source_db_path: Path, output_db_path: Path) -> None:
    """
    Export feature windows and associated context/EMA data to a standalone SQLite DB.
    """
    if not source_db_path.exists():
        logger.warning("Source DB not found at %s. Skipping export.", source_db_path)
        return

    logger.info("Exporting data from %s to %s...", source_db_path, output_db_path)

    try:
        # Connect to source DB (read-only)
        # Using a URI to ensure read-only if supported, but standard connect is fine
        src_conn = sqlite3.connect(f"file:{source_db_path}?mode=ro", uri=True)
        src_cursor = src_conn.cursor()

        # Connect to destination DB
        dst_conn = sqlite3.connect(output_db_path)
        dst_cursor = dst_conn.cursor()

        # Create table in destination DB if not exists
        dst_cursor.execute("""
            CREATE TABLE IF NOT EXISTS exported_metrics (
                session_id INTEGER,
                window_start TEXT,
                window_end TEXT,
                block_focus TEXT,
                keystroke_intervals_mean REAL,
                burstiness REAL,
                scroll_rate REAL,
                idle_time_percent REAL,
                microEMA_rating INTEGER,
                microEMA_note TEXT
            )
        """)
        dst_conn.commit()

        # Find the latest exported window_end to avoid duplicates
        dst_cursor.execute("SELECT MAX(window_end) FROM exported_metrics")
        last_export_row = dst_cursor.fetchone()
        last_export_ts = last_export_row[0] if last_export_row and last_export_row[0] else "1970-01-01T00:00:00"

        logger.info("Last exported timestamp in destination: %s", last_export_ts)

        # Main query: Get all feature windows AFTER the last export
        src_cursor.execute(
            """
            SELECT 
                session_id,
                window_start, 
                window_end, 
                feature_vector_json, 
                ema_prompt_id 
            FROM feature_windows 
            WHERE window_end > ?
            ORDER BY window_start ASC
            """,
            (last_export_ts,)
        )
        windows = src_cursor.fetchall()

        if not windows:
            logger.info("No new data to export.")
            return

        rows_to_insert = []
        
        for row in windows:
            session_id, start_iso, end_iso, vec_json, prompt_id = row
            
            # 1. Parse Feature Vector
            try:
                vec = json.loads(vec_json)
                iki_mean = vec[1] if len(vec) > 1 else 0.0
                burstiness = vec[2] if len(vec) > 2 else 0.0
                pointer_speed = vec[6] if len(vec) > 6 else 0.0
                idle_pct = vec[9] if len(vec) > 9 else 0.0
            except (json.JSONDecodeError, IndexError):
                iki_mean, burstiness, pointer_speed, idle_pct = 0.0, 0.0, 0.0, 0.0

            # 2. Get Block Focus (Context)
            focus_app = get_focus_app(src_cursor, start_iso, end_iso)

            # 3. Get MicroEMA Response (if linked)
            ema_rating = None
            ema_note = None
            if prompt_id:
                src_cursor.execute(
                    "SELECT rating, note FROM ema_responses WHERE prompt_id = ?", 
                    (prompt_id,)
                )
                ema_row = src_cursor.fetchone()
                if ema_row:
                    ema_rating = ema_row[0]
                    ema_note = ema_row[1]

            rows_to_insert.append((
                session_id,
                start_iso, 
                end_iso,
                focus_app, 
                iki_mean, 
                burstiness, 
                pointer_speed, 
                idle_pct, 
                ema_rating,
                ema_note
            ))

        # Batch insert
        dst_cursor.executemany(
            """
            INSERT INTO exported_metrics (
                session_id, window_start, window_end, block_focus, keystroke_intervals_mean, 
                burstiness, scroll_rate, idle_time_percent, 
                microEMA_rating, microEMA_note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, 
            rows_to_insert
        )
        
        dst_conn.commit()
        logger.info("Export complete. %d new rows written to %s", len(rows_to_insert), output_db_path)
        
    except sqlite3.Error as e:
        logger.error("Database error during export: %s", e)
        if 'dst_conn' in locals():
            dst_conn.close()


class DataManager:
    """CRUD interface for the exported SQLite database."""
    
    def __init__(self, db_path: str = "yuvindu_data.db"):
        self.db_path = db_path

    def _get_connection(self) -> sqlite3.Connection:
        if not Path(self.db_path).exists():
            raise FileNotFoundError(f"Database not found at {self.db_path}")
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def create(self, **kwargs) -> int:
        """Insert a new record manually. Returns rowid."""
        keys = list(kwargs.keys())
        values = list(kwargs.values())
        placeholders = ",".join(["?"] * len(keys))
        columns = ",".join(keys)
        
        with self._get_connection() as conn:
            cursor = conn.execute(
                f"INSERT INTO exported_metrics ({columns}) VALUES ({placeholders})", 
                values
            )
            conn.commit()
            return cursor.lastrowid

    def read(self, limit: int = 100, **filters) -> list[dict]:
        """Read records matching filters. E.g. read(session_id=1)."""
        query = "SELECT * FROM exported_metrics"
        params = []
        if filters:
            conditions = []
            for k, v in filters.items():
                conditions.append(f"{k} = ?")
                params.append(v)
            query += " WHERE " + " AND ".join(conditions)
        
        query += f" ORDER BY window_start DESC LIMIT {limit}"
        
        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def update(self, row_id: int, **updates) -> int:
        """Update a record by logic row_id (sqlite rowid). Returns affected count."""
        if not updates:
            return 0
            
        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        values = list(updates.values())
        values.append(row_id)
        
        with self._get_connection() as conn:
            cursor = conn.execute(
                f"UPDATE exported_metrics SET {set_clause} WHERE rowid = ?", 
                values
            )
            conn.commit()
            return cursor.rowcount

    def delete(self, **filters) -> int:
        """Delete records matching filters. Returns deleted count."""
        if not filters:
            raise ValueError("Must provide at least one filter for delete safety.")
            
        conditions = []
        params = []
        for k, v in filters.items():
            conditions.append(f"{k} = ?")
            params.append(v)
            
        query = "DELETE FROM exported_metrics WHERE " + " AND ".join(conditions)
        
        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            conn.commit()
            return cursor.rowcount

if __name__ == "__main__":
    
    import sys
    
    # Defaults
    src = Path("data/state.db")
    dst = Path("yuvindu_data.db")
    
    # Simple arg parsing
    if len(sys.argv) > 1:
        src = Path(sys.argv[1])
    if len(sys.argv) > 2:
        dst = Path(sys.argv[2])
        
    logging.basicConfig(level=logging.INFO)
    export_to_sqlite(src, dst)
