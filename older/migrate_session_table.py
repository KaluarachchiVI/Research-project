"""Migration script to add new columns to Session table for active session persistence"""
import sqlite3
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent
DATABASE_PATH = os.getenv("DATABASE_URL", f"sqlite:///{PROJECT_ROOT}/adaptive_scheduler.db")
# Extract path from SQLite URL
if DATABASE_PATH.startswith("sqlite:///"):
    db_path = DATABASE_PATH.replace("sqlite:///", "")
else:
    db_path = str(PROJECT_ROOT / "adaptive_scheduler.db")

def migrate():
    """Add new columns to Session table if they don't exist"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check which columns exist
        cursor.execute("PRAGMA table_info(sessions)")
        existing_columns = [row[1] for row in cursor.fetchall()]
        
        # Add new columns if they don't exist
        new_columns = {
            'algorithm': 'TEXT DEFAULT "LinUCB"',
            'is_active': 'INTEGER DEFAULT 1',
            'praboth_session_id': 'INTEGER',
            'schedule_json': 'TEXT',
            'current_interval_index': 'INTEGER DEFAULT 0',
            'is_paused': 'INTEGER DEFAULT 0',
            'paused_at': 'DATETIME',
            'current_cognitive_load': 'REAL',
            'last_updated': 'DATETIME'
        }
        
        for column_name, column_def in new_columns.items():
            if column_name not in existing_columns:
                try:
                    cursor.execute(f"ALTER TABLE sessions ADD COLUMN {column_name} {column_def}")
                    print(f"[OK] Added column: {column_name}")
                except sqlite3.OperationalError as e:
                    print(f"[ERROR] Failed to add column {column_name}: {e}")
            else:
                print(f"[SKIP] Column {column_name} already exists")
        
        # Create index on is_active for faster queries
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active)")
            print("[OK] Created index on is_active")
        except sqlite3.OperationalError as e:
            print(f"[ERROR] Failed to create index: {e}")
        
        conn.commit()
        print("\nMigration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print(f"Migrating database at: {db_path}")
    migrate()

