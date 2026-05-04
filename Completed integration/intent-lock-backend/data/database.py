"""SQLite persistence for exit events (local dev)."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

DB_PATH = Path(__file__).resolve().parent.parent / "intentlock.db"


def get_connection() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH)


def init_database() -> None:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS synthetic_training_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_minutes REAL NOT NULL,
            latent_mean REAL NOT NULL,
            label INTEGER NOT NULL CHECK (label IN (0, 1))
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS exit_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            session_minutes REAL NOT NULL,
            latent_mean REAL NOT NULL,
            prediction TEXT NOT NULL,
            friction_level INTEGER NOT NULL,
            allowed_exit INTEGER NOT NULL,
            session_id TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS exit_reasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exit_event_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            custom_text TEXT,
            FOREIGN KEY (exit_event_id) REFERENCES exit_events (id)
        )
        """
    )
    conn.commit()
    conn.close()


def insert_training_sample(session_minutes: float, latent_mean: float, label: int) -> None:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO synthetic_training_data (session_minutes, latent_mean, label)
        VALUES (?, ?, ?)
        """,
        (session_minutes, latent_mean, int(label)),
    )
    conn.commit()
    conn.close()


def clear_training_data() -> None:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM synthetic_training_data")
    conn.commit()
    conn.close()


def get_training_data() -> List[Tuple[float, float, int]]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT session_minutes, latent_mean, label
        FROM synthetic_training_data
        ORDER BY id ASC
        """
    )
    rows = cur.fetchall()
    conn.close()
    return [(float(s), float(l), int(y)) for s, l, y in rows]


def insert_exit_event(
    session_minutes: float,
    latent_mean: float,
    prediction: str,
    friction_level: int,
    allowed_exit: bool,
    session_id: str,
) -> int:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO exit_events (
            timestamp, session_minutes, latent_mean,
            prediction, friction_level, allowed_exit, session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            datetime.now(timezone.utc).isoformat(),
            session_minutes,
            latent_mean,
            prediction,
            friction_level,
            1 if allowed_exit else 0,
            session_id,
        ),
    )
    conn.commit()
    row_id = cur.lastrowid
    conn.close()
    return int(row_id)


def count_impulsive_exits(session_id: str) -> int:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT COUNT(*) FROM exit_events
        WHERE session_id = ? AND prediction = 'impulsive'
        """,
        (session_id,),
    )
    (n,) = cur.fetchone()
    conn.close()
    return int(n)


def insert_exit_reason(
    exit_event_id: int, reason: str, custom_text: Optional[str] = None
) -> None:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO exit_reasons (exit_event_id, reason, custom_text)
        VALUES (?, ?, ?)
        """,
        (exit_event_id, reason, custom_text),
    )
    conn.commit()
    conn.close()
