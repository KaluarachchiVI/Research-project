import sqlite3
import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

def get_session_data(db_path: str) -> list[dict]:
    """Extract session data from yuvindu_data.db"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all session data
    cursor.execute("""
        SELECT session_id, window_start, window_end, block_focus, 
               keystroke_intervals_mean, burstiness, scroll_rate, 
               idle_time_percent, microEMA_rating
        FROM exported_metrics 
        ORDER BY session_id, window_start
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return rows

def aggregate_session_data(rows: list[dict]) -> list[dict]:
    """Aggregate multiple windows per session into single records"""
    sessions = {}
    
    for row in rows:
        session_id, start, end, focus, iki_mean, burstiness, scroll_rate, idle_pct, ema_rating = row
        
        if session_id not in sessions:
            # Initialize session with first window's start time
            sessions[session_id] = {
                'session_id': session_id,
                'windows': [],
                'start_time': start,
                'end_time': end,
                'block_focus_values': [],
                'iki_values': [],
                'burstiness_values': [],
                'scroll_rate_values': [],
                'idle_pct_values': [],
                'ema_ratings': []
            }
        else:
            # Update end time to latest window
            sessions[session_id]['end_time'] = end
        
        # Collect values for aggregation
        sessions[session_id]['windows'].append({
            'start': start, 'end': end, 'focus': focus,
            'iki_mean': iki_mean, 'burstiness': burstiness,
            'scroll_rate': scroll_rate, 'idle_pct': idle_pct,
            'ema_rating': ema_rating
        })
        
        if focus and focus != "unknown":
            sessions[session_id]['block_focus_values'].append(focus)
        if iki_mean is not None:
            sessions[session_id]['iki_values'].append(iki_mean)
        if burstiness is not None:
            sessions[session_id]['burstiness_values'].append(burstiness)
        if scroll_rate is not None:
            sessions[session_id]['scroll_rate_values'].append(scroll_rate)
        if idle_pct is not None:
            sessions[session_id]['idle_pct_values'].append(idle_pct)
        if ema_rating is not None:
            sessions[session_id]['ema_ratings'].append(ema_rating)
    
    # Aggregate each session
    aggregated = []
    for session_data in sessions.values():
        # Parse datetime strings
        start_dt = datetime.fromisoformat(session_data['start_time'].replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(session_data['end_time'].replace('Z', '+00:00'))
        
        # Create session ID in format like example
        date_str = start_dt.strftime('%Y%m%d')
        time_of_day = get_time_of_day(start_dt.hour)
        session_hash = f"{session_data['session_id']:04d}"
        session_id = f"{date_str}_{time_of_day}_{session_hash}"
        
        # Calculate aggregate values
        block_focus = get_most_common(session_data['block_focus_values'])
        iki_mean = round_average(session_data['iki_values'])
        burstiness = round_average(session_data['burstiness_values'])
        scroll_rate = round_average(session_data['scroll_rate_values'])
        idle_pct = round_average(session_data['idle_pct_values'])
        microEMA = round_average(session_data['ema_ratings'])
        
        # Random values for missing fields
        sleep_hours = round(random.uniform(4, 10), 1)
        action = get_time_of_day(start_dt.hour)
        reward = round(random.uniform(0.1, 0.9), 6)
        
        aggregated.append({
            'date': start_dt.strftime('%Y-%m-%d'),
            'starttime': start_dt.strftime('%H:%M'),
            'endtime': end_dt.strftime('%H:%M'),
            'session_id': session_id,
            'block_focus': block_focus,
            'keystroke_intervals_mean': iki_mean,
            'burstiness': burstiness,
            'scroll_rate': scroll_rate,
            'idle_time_percent': idle_pct,
            'microEMA': microEMA,
            'sleep_hours_prev_night': sleep_hours,
            'action': action,
            'reward': reward
        })
    
    return aggregated

def get_time_of_day(hour: int) -> str:
    """Determine time of day from hour"""
    if 6 <= hour < 12:
        return "morning"
    elif 12 <= hour < 17:
        return "afternoon"
    elif 17 <= hour < 21:
        return "evening"
    else:
        return "night"

def get_most_common(values: list) -> str:
    """Get most common value, or return first if none"""
    if not values:
        return "unknown"
    return max(set(values), key=values.count)

def round_average(values: list[float]) -> float:
    """Calculate average and round to appropriate precision"""
    if not values:
        return 0.0
    avg = sum(values) / len(values)
    return round(avg, 6)

def export_to_csv(data: list[dict], output_path: str):
    """Export aggregated data to CSV, overwriting existing file"""
    fieldnames = [
        'date', 'starttime', 'endtime', 'session_id', 'block_focus',
        'keystroke_intervals_mean', 'burstiness', 'scroll_rate', 
        'idle_time_percent', 'microEMA', 'sleep_hours_prev_night', 
        'action', 'reward'
    ]
    
    # Delete existing file if it exists
    if Path(output_path).exists():
        Path(output_path).unlink()
        print(f"Deleted existing {output_path}")
    
    with open(output_path, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)

def main():
    # Input and output paths
    db_path = "yuvindu_data.db"
    output_path = "session_data_export.csv"
    
    # Check if database exists
    if not Path(db_path).exists():
        print(f"Database {db_path} not found!")
        return
    
    # Extract and process data
    print("Extracting session data...")
    rows = get_session_data(db_path)
    
    if not rows:
        print("No data found in database!")
        return
    
    print(f"Found {len(rows)} windows across sessions")
    
    # Aggregate sessions
    print("Aggregating session data...")
    aggregated_data = aggregate_session_data(rows)
    
    # Export to CSV
    print(f"Exporting {len(aggregated_data)} sessions to {output_path}...")
    export_to_csv(aggregated_data, output_path)
    
    print("Export complete!")
    print(f"\nSample data:")
    for i, row in enumerate(aggregated_data[:3]):
        print(f"Session {i+1}: {row['session_id']}")
        print(f"  Time: {row['starttime']}-{row['endtime']}")
        print(f"  Focus: {row['block_focus']}")
        print(f"  IKI: {row['keystroke_intervals_mean']}")
        print(f"  Reward: {row['reward']}")
        print()

if __name__ == "__main__":
    main()
