"""
Real-time monitor for praboth OS hooks events.
Shows keyboard and mouse events as they're being logged by praboth's OS hooks.
"""
import requests
import time
import json
from datetime import datetime
from typing import Optional
import threading
from queue import Queue
import sys


class RealTimeEventMonitor:
    """Monitor events in real-time by polling praboth database"""
    
    def __init__(self, db_path: str = "praboth/data/state.db", poll_interval: float = 0.1):
        """
        Initialize real-time event monitor
        
        Args:
            db_path: Path to praboth SQLite database
            poll_interval: Polling interval in seconds (lower = more real-time)
        """
        self.db_path = db_path
        self.poll_interval = poll_interval
        self.last_event_id = 0
        self.running = False
        self.event_queue = Queue()
        self.stats = {'keyboard': 0, 'pointer': 0, 'total': 0}
        
    def get_latest_events(self) -> list:
        """Get latest events from database"""
        try:
            import sqlite3
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get events newer than last seen
            cursor.execute("""
                SELECT 
                    event_id,
                    session_id,
                    source,
                    payload_json,
                    occurred_at
                FROM input_events
                WHERE event_id > ?
                ORDER BY event_id ASC
                LIMIT 100
            """, (self.last_event_id,))
            
            rows = cursor.fetchall()
            conn.close()
            
            events = []
            for row in rows:
                try:
                    payload = json.loads(row['payload_json']) if row['payload_json'] else {}
                    events.append({
                        'id': row['event_id'],
                        'source': row['source'],
                        'payload': payload,
                        'timestamp': row['occurred_at']
                    })
                    if row['event_id'] > self.last_event_id:
                        self.last_event_id = row['event_id']
                except:
                    pass
            
            return events
        except Exception as e:
            # Database might be locked or not ready yet
            return []
    
    def format_event(self, event: dict) -> str:
        """Format event for display"""
        source = event.get('source', 'unknown')
        payload = event.get('payload', {})
        timestamp = event.get('timestamp', '')
        
        # Parse timestamp
        try:
            if timestamp:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                time_str = dt.strftime('%H:%M:%S.%f')[:-3]
            else:
                time_str = datetime.now().strftime('%H:%M:%S.%f')[:-3]
        except:
            time_str = datetime.now().strftime('%H:%M:%S')
        
        # Format based on source
        if source == 'keyboard':
            latency = payload.get('latency_ms', 0)
            is_backspace = payload.get('is_backspace', False)
            is_error = payload.get('is_error', False)
            
            flags = []
            if is_backspace:
                flags.append('⌫ BACKSPACE')
            if is_error:
                flags.append('⚠ ERROR')
            
            flag_str = ' | ' + ', '.join(flags) if flags else ''
            
            return f"\033[36m[{time_str}]\033[0m \033[93m⌨️  KEYBOARD\033[0m | Latency: \033[92m{latency:.1f}ms\033[0m{flag_str}"
        
        elif source == 'pointer':
            dx = payload.get('dx', 0)
            dy = payload.get('dy', 0)
            dt_ms = payload.get('dt_ms', 0)
            distance = (dx**2 + dy**2)**0.5
            
            return f"\033[36m[{time_str}]\033[0m \033[94m🖱️  POINTER\033[0m  | Δx: {dx:6.1f}, Δy: {dy:6.1f}, Distance: \033[92m{distance:.1f}px\033[0m, Δt: {dt_ms:.1f}ms"
        
        else:
            return f"\033[36m[{time_str}]\033[0m \033[95m📦 {source.upper()}\033[0m | {json.dumps(payload)[:60]}"
    
    def display_stats(self):
        """Display current statistics"""
        print(f"\n\033[1m{'='*70}\033[0m")
        print(f"\033[1m📊 Statistics:\033[0m")
        print(f"   \033[93m⌨️  Keyboard:\033[0m {self.stats['keyboard']:>6} events")
        print(f"   \033[94m🖱️  Pointer:\033[0m  {self.stats['pointer']:>6} events")
        print(f"   \033[1mTotal:\033[0m      {self.stats['total']:>6} events")
        print(f"\033[1m{'='*70}\033[0m\n")
    
    def monitor_loop(self):
        """Main monitoring loop"""
        last_stats_time = time.time()
        
        while self.running:
            try:
                events = self.get_latest_events()
                
                for event in events:
                    source = event.get('source', 'unknown')
                    self.stats[source] = self.stats.get(source, 0) + 1
                    self.stats['total'] += 1
                    
                    formatted = self.format_event(event)
                    print(formatted)
                
                # Show stats every 10 seconds
                if time.time() - last_stats_time >= 10:
                    self.display_stats()
                    last_stats_time = time.time()
                
                time.sleep(self.poll_interval)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                # Silently handle errors (database might be locked)
                time.sleep(self.poll_interval)
    
    def start(self):
        """Start monitoring"""
        import sqlite3
        import os
        
        # Check if database exists
        if not os.path.exists(self.db_path):
            print(f"\033[91m✗ Error: Database not found at {self.db_path}\033[0m")
            print(f"   Make sure praboth is running and has created the database.")
            print(f"   Expected location: praboth/data/state.db")
            return False
        
        # Test database connection
        try:
            conn = sqlite3.connect(self.db_path)
            conn.close()
        except Exception as e:
            print(f"\033[91m✗ Error: Cannot connect to database: {e}\033[0m")
            return False
        
        print("\n" + "="*70)
        print("\033[1m🔍 Real-Time Event Monitor - Praboth OS Hooks\033[0m")
        print("="*70)
        print(f"\033[92m✓\033[0m Monitoring database: {self.db_path}")
        print(f"\033[92m✓\033[0m Polling interval: {self.poll_interval*1000:.0f}ms")
        print(f"\033[93m⚠\033[0m  Start typing or moving your mouse to see events!")
        print(f"\033[93m⚠\033[0m  Press Ctrl+C to stop\n")
        print("-"*70 + "\n")
        
        self.running = True
        
        try:
            self.monitor_loop()
        except KeyboardInterrupt:
            print("\n\n\033[93m⏹️  Monitoring stopped\033[0m")
        finally:
            self.running = False
            self.display_stats()
        
        return True


def main():
    """Main entry point"""
    import argparse
    from pathlib import Path
    
    parser = argparse.ArgumentParser(
        description='Real-time monitor for praboth OS hooks events',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python monitor_events_realtime.py
  python monitor_events_realtime.py --db-path praboth/data/state.db
  python monitor_events_realtime.py --poll-interval 0.05  # Faster updates
        """
    )
    parser.add_argument(
        '--db-path',
        type=str,
        default='praboth/data/state.db',
        help='Path to praboth database (default: praboth/data/state.db)'
    )
    parser.add_argument(
        '--poll-interval',
        type=float,
        default=0.1,
        help='Polling interval in seconds (default: 0.1 = 100ms, lower = more real-time)'
    )
    
    args = parser.parse_args()
    
    # Auto-detect database if default doesn't exist
    if not Path(args.db_path).exists():
        possible_paths = [
            Path("praboth/data/state.db"),
            Path("praboth/state.db"),
        ]
        for path in possible_paths:
            if path.exists():
                args.db_path = str(path)
                print(f"\033[93m⚠\033[0m  Auto-detected database: {args.db_path}")
                break
    
    monitor = RealTimeEventMonitor(
        db_path=args.db_path,
        poll_interval=args.poll_interval
    )
    
    monitor.start()


if __name__ == '__main__':
    main()


