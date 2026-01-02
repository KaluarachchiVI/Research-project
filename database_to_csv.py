import sqlite3
import pandas as pd
import os
import time
from datetime import datetime
import threading

def export_database_to_csv():
    """Export all tables from yuvindu_data.db to CSV files"""
    db_path = "yuvindu_data.db"
    
    if not os.path.exists(db_path):
        print(f"Database file {db_path} not found!")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all table names
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        if not tables:
            print("No tables found in database!")
            return
        
        print(f"Found {len(tables)} tables: {[table[0] for table in tables]}")
        
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
            print(f"Exported {table_name} to {csv_filename} ({len(df)} rows)")
        
        conn.close()
        print("Database export completed successfully!")
        
    except Exception as e:
        print(f"Error exporting database: {e}")

def get_database_info():
    """Get information about database structure"""
    db_path = "yuvindu_data.db"
    
    if not os.path.exists(db_path):
        print(f"Database file {db_path} not found!")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all table names
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        print(f"\nDatabase: {db_path}")
        print(f"Tables found: {len(tables)}")
        
        for table in tables:
            table_name = table[0]
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            row_count = cursor.fetchone()[0]
            
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()
            
            print(f"\nTable: {table_name}")
            print(f"  Rows: {row_count}")
            print(f"  Columns: {[col[1] for col in columns]}")
        
        conn.close()
        
    except Exception as e:
        print(f"Error getting database info: {e}")

def schedule_csv_export():
    """Schedule CSV export every 10 minutes using threading"""
    print("Starting CSV export scheduler...")
    print("Database will be exported to CSV every 10 minutes")
    
    def export_loop():
        while True:
            export_database_to_csv()
            print("Waiting 10 minutes for next export...")
            time.sleep(600)  # 10 minutes = 600 seconds
    
    # Start the export loop in a separate thread
    export_thread = threading.Thread(target=export_loop, daemon=True)
    export_thread.start()
    
    try:
        # Keep the main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nScheduler stopped by user")

if __name__ == "__main__":
    # First, show database info
    get_database_info()
    
    # Ask user what to do
    print("\nOptions:")
    print("1. Export database to CSV once")
    print("2. Start automatic export every 10 minutes")
    print("3. Both (export now, then start scheduler)")
    
    choice = input("Enter choice (1-3): ").strip()
    
    if choice == "1":
        export_database_to_csv()
    elif choice == "2":
        schedule_csv_export()
    elif choice == "3":
        export_database_to_csv()
        schedule_csv_export()
    else:
        print("Invalid choice. Exiting.")
