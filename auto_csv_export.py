import sqlite3
import pandas as pd
import os
import time
import threading
from datetime import datetime

def export_database_to_csv():
    """Export all tables from yuvindu_data.db to CSV files"""
    db_path = "yuvindu_data.db"
    
    if not os.path.exists(db_path):
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Database file {db_path} not found!")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all table names
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        if not tables:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] No tables found in database!")
            return False
        
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Exporting {len(tables)} tables...")
        
        # Export each table to CSV
        for table in tables:
            table_name = table[0]
            
            # Read table into DataFrame
            df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
            
            # Create CSV filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            csv_filename = f"{table_name}_{timestamp}.csv"
            
            # Save to CSV
            df.to_csv(csv_filename, index=False)
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Exported {table_name} to {csv_filename} ({len(df)} rows)")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error exporting database: {e}")
        return False

def schedule_csv_export():
    """Schedule CSV export every 10 minutes using threading"""
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting CSV export scheduler...")
    print("Database will be exported to CSV every 10 minutes")
    print("Press Ctrl+C to stop the scheduler")
    
    def export_loop():
        while True:
            success = export_database_to_csv()
            if success:
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Waiting 10 minutes for next export...")
            else:
                print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Retrying in 1 minute...")
                time.sleep(60)  # Wait 1 minute if there was an error
                continue
            
            time.sleep(600)  # 10 minutes = 600 seconds
    
    # Start the export loop in a separate thread
    export_thread = threading.Thread(target=export_loop, daemon=True)
    export_thread.start()
    
    try:
        # Keep the main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Scheduler stopped by user")

if __name__ == "__main__":
    print("Yuvidu Database CSV Exporter")
    print("=" * 40)
    
    # Export immediately
    print("Performing initial export...")
    export_database_to_csv()
    
    # Start scheduler
    print("\nStarting automatic export every 10 minutes...")
    schedule_csv_export()
