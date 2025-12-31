"""Script to view data from the exporter SQLite database."""

import sqlite3
import pandas as pd
from pathlib import Path

def view_exporter_data(limit=10):
    """View data from the exporter database."""
    db_path = "yuvindu_data.db"
    
    if not Path(db_path).exists():
        print(f"Database {db_path} not found!")
        print("Make sure you've run the cog_py_est service to generate data.")
        return
    
    conn = sqlite3.connect(db_path)
    
    try:
        # Get basic info
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM exported_metrics")
        total_records = cursor.fetchone()[0]
        print(f"Total records in database: {total_records}")
        print()
        
        # View recent records
        query = """
        SELECT session_id, window_start, window_end, block_focus,
               keystroke_intervals_mean, burstiness, scroll_rate,
               idle_time_percent, microEMA_rating, microEMA_note
        FROM exported_metrics
        ORDER BY window_end DESC
        LIMIT ?
        """
        
        df = pd.read_sql_query(query, conn, params=(limit,))
        
        if df.empty:
            print("No records found in the database.")
        else:
            print(f"Recent {len(df)} records:")
            print(df.to_string(index=False))
            
            # Show some statistics
            print("\n--- Statistics ---")
            print(f"Sessions: {df['session_id'].nunique()}")
            print(f"Time range: {df['window_start'].min()} to {df['window_end'].max()}")
            print(f"Average keystroke intervals: {df['keystroke_intervals_mean'].mean():.2f} ms")
            print(f"Average idle time: {df['idle_time_percent'].mean():.2%}")
            if df['microEMA_rating'].notna().any():
                print(f"Average EMA rating: {df['microEMA_rating'].mean():.2f}")
            
            # Show unique focus apps
            print(f"\nUnique focus apps: {df['block_focus'].value_counts().to_dict()}")
    
    finally:
        conn.close()

def view_table_schema():
    """View the table schema."""
    db_path = "yuvindu_data.db"
    
    if not Path(db_path).exists():
        print(f"Database {db_path} not found!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA table_info(exported_metrics)")
    columns = cursor.fetchall()
    
    print("Table Schema:")
    for col in columns:
        print(f"  {col[1]} ({col[2]})")
    
    conn.close()

if __name__ == "__main__":
    print("=== Exporter Data Viewer ===\n")
    
    # Show schema
    print("1. Table Schema:")
    view_table_schema()
    print()
    
    # Show recent data
    print("2. Recent Data:")
    view_exporter_data(limit=10)
