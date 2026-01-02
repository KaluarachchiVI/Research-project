import sqlite3
import pandas as pd
import os
from datetime import datetime

def check_database():
    """Check database structure and export to CSV"""
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
        
        print(f"Database: {db_path}")
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
            
            # Export to CSV
            df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            csv_filename = f"{table_name}_{timestamp}.csv"
            df.to_csv(csv_filename, index=False)
            print(f"  Exported to: {csv_filename}")
        
        conn.close()
        print("\nExport completed successfully!")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_database()
