import sqlite3
import os
from datetime import datetime
from typing import Optional, List, Tuple

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "intentlock.db")

def get_connection():
    """Get SQLite database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    """Initialize database with required tables"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Table 1: synthetic_training_data
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS synthetic_training_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_minutes REAL NOT NULL,
            latent_mean REAL NOT NULL,
            label INTEGER NOT NULL
        )
    """)
    
    # Table 2: exit_events
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exit_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            session_minutes REAL NOT NULL,
            latent_mean REAL NOT NULL,
            prediction TEXT NOT NULL,
            friction_level INTEGER NOT NULL,
            allowed_exit BOOLEAN NOT NULL,
            session_id TEXT
        )
    """)
    
    # Table 3: exit_reasons
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exit_reasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exit_event_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            custom_text TEXT,
            FOREIGN KEY (exit_event_id) REFERENCES exit_events(id)
        )
    """)
    
    conn.commit()
    conn.close()
    print(f"Database initialized at {DB_PATH}")

def insert_training_data(session_minutes: float, latent_mean: float, label: int):
    """Insert a training data sample"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO synthetic_training_data (session_minutes, latent_mean, label) VALUES (?, ?, ?)",
        (session_minutes, latent_mean, label)
    )
    conn.commit()
    conn.close()

def get_training_data() -> List[Tuple[float, float, int]]:
    """Get all training data as list of (session_minutes, latent_mean, label)"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT session_minutes, latent_mean, label FROM synthetic_training_data")
    data = cursor.fetchall()
    conn.close()
    return [(row[0], row[1], row[2]) for row in data]

def insert_exit_event(
    session_minutes: float,
    latent_mean: float,
    prediction: str,
    friction_level: int,
    allowed_exit: bool,
    session_id: Optional[str] = None
) -> int:
    """Insert an exit event and return the event ID"""
    conn = get_connection()
    cursor = conn.cursor()
    timestamp = datetime.now().isoformat()
    cursor.execute(
        """INSERT INTO exit_events 
           (timestamp, session_minutes, latent_mean, prediction, friction_level, allowed_exit, session_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (timestamp, session_minutes, latent_mean, prediction, friction_level, allowed_exit, session_id)
    )
    event_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return event_id

def count_impulsive_exits(session_id: Optional[str] = None) -> int:
    """Count previous impulsive exit attempts for a session"""
    conn = get_connection()
    cursor = conn.cursor()
    if session_id:
        cursor.execute(
            "SELECT COUNT(*) FROM exit_events WHERE prediction = 'impulsive' AND session_id = ?",
            (session_id,)
        )
    else:
        cursor.execute("SELECT COUNT(*) FROM exit_events WHERE prediction = 'impulsive'")
    count = cursor.fetchone()[0]
    conn.close()
    return count

def insert_exit_reason(exit_event_id: int, reason: str, custom_text: Optional[str] = None):
    """Insert exit reason for an exit event"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO exit_reasons (exit_event_id, reason, custom_text) VALUES (?, ?, ?)",
        (exit_event_id, reason, custom_text)
    )
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_database()
    print("Database tables created successfully!")


