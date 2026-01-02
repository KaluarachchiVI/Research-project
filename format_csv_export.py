import sqlite3
import pandas as pd
import os
import time
import threading
from datetime import datetime, timedelta
import random

def format_database_to_bandit_csv():
    """Export database data to match the bandit dataset format"""
    db_path = "yuvindu_data.db"
    
    if not os.path.exists(db_path):
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Database file {db_path} not found!")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        
        # Read the exported_metrics table
        df = pd.read_sql_query("SELECT * FROM exported_metrics", conn)
        
        if df.empty:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] No data found in exported_metrics table!")
            return False
        
        # Transform data to match bandit dataset format
        formatted_data = []
        
        for _, row in df.iterrows():
            # Parse window_start and window_end to get date and times
            window_start_str = str(row['window_start'])
            window_end_str = str(row['window_end'])
            
            # Convert to datetime objects
            window_start = datetime.fromisoformat(window_start_str.replace('T', ' ').replace('Z', ''))
            window_end = datetime.fromisoformat(window_end_str.replace('T', ' ').replace('Z', ''))
            
            # Extract date and times
            date = window_start.strftime('%Y-%m-%d')
            starttime = window_start.strftime('%H:%M')
            endtime = window_end.strftime('%H:%M')
            
            # Generate session_id based on date and time
            time_period = "morning" if 6 <= window_start.hour < 12 else "afternoon" if 12 <= window_start.hour < 18 else "evening"
            session_id = f"{date.replace('-', '')}_{time_period}_{str(row['session_id']).zfill(8)}"
            
            # Map microEMA_rating to microEMA (same value)
            microEMA = row['microEMA_rating']
            
            # Generate sleep_hours_prev_night (random between 4-10 for demo)
            sleep_hours_prev_night = random.uniform(4.0, 10.0)
            
            # Determine action based on time period
            action = time_period
            
            # Calculate reward based on block_focus and microEMA
            try:
                block_focus = float(row['block_focus'])
                reward = (block_focus * 0.6 + microEMA * 0.4)
            except (ValueError, TypeError):
                reward = microEMA  # Fallback to microEMA if block_focus conversion fails
            
            # Create formatted row
            formatted_row = {
                'date': date,
                'starttime': starttime,
                'endtime': endtime,
                'session_id': session_id,
                'block_focus': row['block_focus'],
                'keystroke_intervals_mean': row['keystroke_intervals_mean'],
                'burstiness': row['burstiness'],
                'scroll_rate': row['scroll_rate'],
                'idle_time_percent': row['idle_time_percent'],
                'microEMA': microEMA,
                'sleep_hours_prev_night': sleep_hours_prev_night,
                'action': action,
                'reward': reward
            }
            
            formatted_data.append(formatted_row)
        
        # Create DataFrame and save to CSV
        formatted_df = pd.DataFrame(formatted_data)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_filename = f"large_contextual_bandit_dataset_{timestamp}.csv"
        
        formatted_df.to_csv(csv_filename, index=False)
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Formatted data exported to {csv_filename} ({len(formatted_df)} rows)")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error formatting database: {e}")
        return False

def schedule_formatted_export():
    """Schedule formatted CSV export every 10 minutes"""
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting formatted CSV export scheduler...")
    print("Database will be exported to bandit-format CSV every 10 minutes")
    print("Press Ctrl+C to stop the scheduler")
    
    def export_loop():
        while True:
            success = format_database_to_bandit_csv()
            if success:
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Waiting 10 minutes for next export...")
            else:
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Retrying in 1 minute...")
                time.sleep(60)
                continue
            
            time.sleep(600)  # 10 minutes
    
    export_thread = threading.Thread(target=export_loop, daemon=True)
    export_thread.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Scheduler stopped by user")

if __name__ == "__main__":
    print("Yuvidu Database to Bandit Format Exporter")
    print("=" * 50)
    
    # Export immediately
    print("Performing initial formatted export...")
    format_database_to_bandit_csv()
    
    # Start scheduler
    print("\nStarting automatic formatted export every 10 minutes...")
    schedule_formatted_export()
