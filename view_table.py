"""Simple script to view the exporter table structure and data."""

import sqlite3
from pathlib import Path

def create_and_view_table():
    """Create sample data and view the table."""
    db_path = "yuvindu_data.db"
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create table
    cursor.execute("""
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
    
    # Insert one sample record
    cursor.execute("""
        INSERT INTO exported_metrics VALUES 
        (1, '2025-01-01T09:00:00', '2025-01-01T10:00:00', 'chrome.exe', 
         180.5, 0.45, 35.2, 0.15, 4, 'Feeling productive')
    """)
    
    conn.commit()
    
    # View table structure
    cursor.execute("PRAGMA table_info(exported_metrics)")
    columns = cursor.fetchall()
    
    print("=== TABLE STRUCTURE ===")
    for col in columns:
        print(f"{col[1]:<25} {col[2]:<10} {'NOT NULL' if col[3] else 'NULL':<8} {'PRIMARY KEY' if col[5] else ''}")
    
    # View data
    cursor.execute("SELECT * FROM exported_metrics")
    rows = cursor.fetchall()
    
    print("\n=== TABLE DATA ===")
    if rows:
        for row in rows:
            print(f"Session: {row[0]}")
            print(f"Time: {row[1]} to {row[2]}")
            print(f"Focus: {row[3]}")
            print(f"Keystroke intervals: {row[4]} ms")
            print(f"Burstiness: {row[5]}")
            print(f"Scroll rate: {row[6]}")
            print(f"Idle time: {row[7]:.1%}")
            print(f"EMA rating: {row[8]}")
            print(f"Note: {row[9]}")
            print("-" * 40)
    else:
        print("No data in table")
    
    conn.close()

if __name__ == "__main__":
    create_and_view_table()
