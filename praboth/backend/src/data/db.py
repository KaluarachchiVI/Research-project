"""Manages the database connection and schema initialization."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import aiosqlite

logger = logging.getLogger(__name__)


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.db: Optional[aiosqlite.Connection] = None

    async def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.db = await aiosqlite.connect(self.path.as_posix())
        await self.db.execute("PRAGMA journal_mode=WAL;")
        await self._create_tables()
        await self._migrate()
        await self.db.commit()

    async def close(self) -> None:
        if self.db:
            await self.db.close()
            self.db = None

    async def execute(self, sql: str, parameters: tuple = ()) -> aiosqlite.Cursor:
        if self.db is None:
            raise RuntimeError("Database not initialized")
        return await self.db.execute(sql, parameters)

    async def commit(self) -> None:
        if self.db is None:
            raise RuntimeError("Database not initialized")
        await self.db.commit()

    async def executescript(self, sql_script: str) -> None:
         if self.db is None:
            raise RuntimeError("Database not initialized")
         await self.db.executescript(sql_script)

    async def _create_tables(self) -> None:
        if self.db is None:
             raise RuntimeError("Database not initialized")
        await self.db.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                device_label TEXT,
                consent_version TEXT
            );
            CREATE TABLE IF NOT EXISTS input_events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                occurred_at TEXT NOT NULL,
                source TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                hop_index INTEGER,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            CREATE TABLE IF NOT EXISTS feature_windows (
                window_id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                hop_index INTEGER NOT NULL,
                window_start TEXT NOT NULL,
                window_end TEXT NOT NULL,
                feature_vector_json TEXT NOT NULL,
                quality_score REAL,
                ema_prompt_id INTEGER,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            CREATE TABLE IF NOT EXISTS ema_prompts (
                prompt_id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                issued_at TEXT NOT NULL,
                trigger_reason TEXT,
                state TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            CREATE TABLE IF NOT EXISTS ema_responses (
                response_id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id INTEGER NOT NULL,
                responded_at TEXT NOT NULL,
                rating INTEGER,
                disposition TEXT,
                note TEXT,
                FOREIGN KEY (prompt_id) REFERENCES ema_prompts(prompt_id)
            );
            CREATE TABLE IF NOT EXISTS model_state (
                state_id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                captured_at TEXT NOT NULL,
                latent_mean REAL,
                latent_variance REAL,
                weights_json TEXT,
                forgetting_factor REAL,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            CREATE TABLE IF NOT EXISTS telemetry_metrics (
                metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                snapshot_at TEXT NOT NULL,
                metric_type TEXT,
                metric_value REAL,
                metadata_json TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            CREATE TABLE IF NOT EXISTS baseline_profiles (
                profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                captured_at TEXT NOT NULL,
                feature_mean_json TEXT NOT NULL,
                feature_covariance_json TEXT,
                residual_mean REAL,
                residual_std REAL,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            CREATE TABLE IF NOT EXISTS policy_events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                occurred_at TEXT NOT NULL,
                event_type TEXT NOT NULL,
                reason TEXT,
                metadata_json TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            CREATE TABLE IF NOT EXISTS aggregated_exports (
                export_id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL,
                reviewer TEXT,
                summary_json TEXT NOT NULL,
                file_path TEXT
            );
            CREATE TABLE IF NOT EXISTS normalizer_state (
                state_id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                captured_at TEXT NOT NULL,
                normalizer_type TEXT NOT NULL,
                state_json TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            CREATE TABLE IF NOT EXISTS distraction_periods (
                period_id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                app_name TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            CREATE TABLE IF NOT EXISTS context_classification_cache (
                cache_key TEXT PRIMARY KEY,
                is_study BOOLEAN NOT NULL,
                category TEXT,
                classified_at TEXT NOT NULL
            );
            """
        )

    async def _migrate(self) -> None:
        """Handles database schema migrations."""
        if self.db is None:
             raise RuntimeError("Database not initialized")
        
        # Checks for the existence of the 'app_name' column in 'distraction_periods'.
        async with self.db.execute("PRAGMA table_info(distraction_periods)") as cursor:
            columns = [row[1] for row in await cursor.fetchall()]
            if "app_name" not in columns:
                logger.info("Migrating schema: Adding app_name to distraction_periods")
                await self.db.execute("ALTER TABLE distraction_periods ADD COLUMN app_name TEXT")

        # Checks for 'feature_covariance_json' in 'baseline_profiles'
        async with self.db.execute("PRAGMA table_info(baseline_profiles)") as cursor:
            columns = [row[1] for row in await cursor.fetchall()]
            if "feature_covariance_json" not in columns:
                logger.info("Migrating schema: Adding feature_covariance_json to baseline_profiles")
                await self.db.execute("ALTER TABLE baseline_profiles ADD COLUMN feature_covariance_json TEXT")
