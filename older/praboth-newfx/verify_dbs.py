import sqlite3
import os
from pathlib import Path

src_path = Path("data/state.db")
dst_path = Path("yuvindu_data.db")

print(f"CWD: {os.getcwd()}")
print(f"Checking {src_path}...")
if not src_path.exists():
    print(f"ERROR: {src_path} does not exist.")
else:
    print(f"SUCCESS: {src_path} exists. Size: {src_path.stat().st_size} bytes")
    try:
        conn = sqlite3.connect(f"file:{src_path}?mode=ro", uri=True)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Tables in source: {tables}")
        
        if ('feature_windows',) in tables:
            cursor.execute("SELECT COUNT(*) FROM feature_windows")
            count = cursor.fetchone()[0]
            print(f"Rows in feature_windows: {count}")
            
            cursor.execute("SELECT MAX(window_end) FROM feature_windows")
            max_end = cursor.fetchone()[0]
            print(f"Max window_end in source: {max_end}")
        else:
            print(f"ERROR: table 'feature_windows' not found in source. Tables found: {tables}")
            
    except Exception as e:
        print(f"ERROR reading source DB: {e}")

print(f"\nChecking {dst_path}...")
if not dst_path.exists():
    print(f"WARNING: {dst_path} does not exist (it should be created by exporter).")
else:
    print(f"SUCCESS: {dst_path} exists. Size: {dst_path.stat().st_size} bytes")
    try:
        conn = sqlite3.connect(dst_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Tables in destination: {tables}")
        
        if ('exported_metrics',) in tables:
            cursor.execute("SELECT COUNT(*) FROM exported_metrics")
            count = cursor.fetchone()[0]
            print(f"Rows in exported_metrics: {count}")
            
            cursor.execute("SELECT MAX(window_end) FROM exported_metrics")
            max_end = cursor.fetchone()[0]
            print(f"Max window_end in destination: {max_end}")
        else:
            print("ERROR: table 'exported_metrics' not found in destination.")
            
    except Exception as e:
        print(f"ERROR reading destination DB: {e}")
