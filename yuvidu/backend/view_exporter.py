"""View exporter table from yuvidu/backend directory."""

import sqlite3
import sys
import os

def view_exporter_table():
    """View the exporter table data."""
    # Go up one directory to find the database
    db_path = os.path.join("..", "yuvindu_data.db")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all data
        cursor.execute("SELECT * FROM exported_metrics ORDER BY session_id, window_start")
        rows = cursor.fetchall()
        
        if not rows:
            print("No data found in exporter table.")
            return
        
        # Get column names
        cursor.execute("PRAGMA table_info(exported_metrics)")
        columns = [col[1] for col in cursor.fetchall()]
        
        print(f"=== EXPORTER TABLE DATA ===")
        print(f"Total records: {len(rows)}")
        print(f"Columns: {', '.join(columns)}")
        print("-" * 80)
        
        for i, row in enumerate(rows, 1):
            print(f"Record {i}:")
            print(f"  Session ID: {row[0]}")
            print(f"  Time: {row[1]} to {row[2]}")
            print(f"  Focus App: {row[3]}")
            print(f"  Keystroke Intervals: {row[4]} ms")
            print(f"  Burstiness: {row[5]}")
            print(f"  Scroll Rate: {row[6]}")
            print(f"  Idle Time: {row[7]:.1%}")
            print(f"  EMA Rating: {row[6] if row[6] is not None else 'None'}")
            print(f"  EMA Note: {row[8] if row[8] else 'None'}")
            print()
        
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")
        print(f"Looking for database at: {os.path.abspath(db_path)}")

if __name__ == "__main__":
    view_exporter_table()
