"""
Monitor keyboard and mouse events from praboth in real-time.
Displays events on the console so you can verify OS hooks are working.
"""
import requests
import time
import json
from datetime import datetime
from typing import Optional, Dict, Any
import sqlite3
from pathlib import Path


class EventMonitor:
    """Monitor and display keyboard/mouse events from praboth"""
    
    def __init__(self, praboth_db_path: Optional[str] = None, poll_interval: float = 0.5):
        """
        Initialize event monitor
        
        Args:
            praboth_db_path: Path to praboth database (auto-detected if None)
            poll_interval: How often to check for new events (seconds)
        """
        self.poll_interval = poll_interval
        self.last_event_id = 0
        self.event_count = {'keyboard': 0, 'pointer': 0, 'other': 0}
        
        # Auto-detect praboth database path
        if praboth_db_path is None:
            # Try common locations
            possible_paths = [
                Path("praboth/data/state.db"),
                Path("praboth/state.db"),
                Path.home() / ".praboth" / "state.db"
            ]
            for path in possible_paths:
                if path.exists():
                    praboth_db_path = str(path)
                    break
        
        if praboth_db_path and Path(praboth_db_path).exists():
            self.db_path = praboth_db_path
            print(f"✓ Found praboth database: {self.db_path}")
        else:
            self.db_path = None
            print("⚠ Could not find praboth database. Will try API polling instead.")
    
    def get_events_from_db(self, limit: int = 50) -> list:
        """Get recent events from praboth database"""
        if not self.db_path:
            return []
        
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Query input_events table (praboth stores events here)
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
                LIMIT ?
            """, (self.last_event_id, limit))
            
            rows = cursor.fetchall()
            conn.close()
            
            events = []
            for row in rows:
                try:
                    payload = json.loads(row['payload_json']) if row['payload_json'] else {}
                    events.append({
                        'id': row['event_id'],
                        'session_id': row['session_id'],
                        'source': row['source'],
                        'payload': payload,
                        'timestamp': row['occurred_at']
                    })
                    if row['event_id'] > self.last_event_id:
                        self.last_event_id = row['event_id']
                except json.JSONDecodeError:
                    continue
            
            return events
        except sqlite3.OperationalError as e:
            # Table might not exist or different schema
            if "no such table" in str(e).lower():
                return []
            raise
        except Exception as e:
            print(f"Error reading database: {e}")
            return []
    
    def get_events_from_api(self) -> list:
        """Try to get events from praboth API (if available)"""
        try:
            # Check if praboth has a recent events endpoint
            response = requests.get("http://localhost:8000/telemetry", timeout=1.0)
            if response.status_code == 200:
                data = response.json()
                # Return empty for now - telemetry doesn't have individual events
                return []
        except:
            pass
        return []
    
    def format_event(self, event: Dict[str, Any]) -> str:
        """Format an event for display"""
        source = event.get('source', 'unknown')
        timestamp = event.get('timestamp', '')
        payload = event.get('payload', {})
        
        # Format timestamp
        try:
            if timestamp:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                time_str = dt.strftime('%H:%M:%S.%f')[:-3]
            else:
                time_str = datetime.now().strftime('%H:%M:%S')
        except:
            time_str = datetime.now().strftime('%H:%M:%S')
        
        # Format based on event type
        if source == 'keyboard':
            latency = payload.get('latency_ms', 0)
            is_error = payload.get('is_error', False)
            is_backspace = payload.get('is_backspace', False)
            
            status = ""
            if is_backspace:
                status = " [BACKSPACE]"
            elif is_error:
                status = " [ERROR]"
            
            return f"[{time_str}] ⌨️  KEYBOARD | Latency: {latency:.1f}ms{status}"
        
        elif source == 'pointer':
            dx = payload.get('dx', 0)
            dy = payload.get('dy', 0)
            dt_ms = payload.get('dt_ms', 0)
            distance = (dx**2 + dy**2)**0.5
            
            return f"[{time_str}] 🖱️  POINTER  | Δx: {dx:.1f}, Δy: {dy:.1f}, Distance: {distance:.1f}px, Δt: {dt_ms:.1f}ms"
        
        else:
            return f"[{time_str}] 📦 {source.upper()} | {json.dumps(payload)[:50]}"
    
    def display_event(self, event: Dict[str, Any]):
        """Display a single event"""
        source = event.get('source', 'other')
        self.event_count[source] = self.event_count.get(source, 0) + 1
        
        formatted = self.format_event(event)
        print(formatted)
    
    def display_summary(self):
        """Display summary of events captured"""
        total = sum(self.event_count.values())
        print(f"\n{'='*60}")
        print(f"📊 Event Summary:")
        print(f"   Keyboard: {self.event_count['keyboard']} events")
        print(f"   Pointer:  {self.event_count['pointer']} events")
        print(f"   Other:    {self.event_count['other']} events")
        print(f"   Total:    {total} events")
        print(f"{'='*60}\n")
    
    def monitor(self, duration_minutes: Optional[float] = None):
        """
        Start monitoring events
        
        Args:
            duration_minutes: How long to monitor (None = forever)
        """
        print("\n" + "="*60)
        print("🔍 Event Monitor - Watching for keyboard/mouse events")
        print("="*60)
        print("Press Ctrl+C to stop\n")
        
        start_time = time.time()
        last_summary_time = time.time()
        
        try:
            while True:
                # Check duration
                if duration_minutes:
                    elapsed = (time.time() - start_time) / 60.0
                    if elapsed >= duration_minutes:
                        break
                
                # Get new events
                events = self.get_events_from_db()
                
                if not events:
                    # Try API as fallback
                    events = self.get_events_from_api()
                
                # Display events
                for event in events:
                    self.display_event(event)
                
                # Show summary every 30 seconds
                if time.time() - last_summary_time >= 30:
                    self.display_summary()
                    last_summary_time = time.time()
                
                # Wait before next poll
                time.sleep(self.poll_interval)
                
        except KeyboardInterrupt:
            print("\n\n⏹️  Monitoring stopped by user")
        finally:
            self.display_summary()


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Monitor keyboard and mouse events from praboth in real-time'
    )
    parser.add_argument(
        '--db-path',
        type=str,
        default=None,
        help='Path to praboth database (auto-detected if not specified)'
    )
    parser.add_argument(
        '--poll-interval',
        type=float,
        default=0.5,
        help='Polling interval in seconds (default: 0.5)'
    )
    parser.add_argument(
        '--duration',
        type=float,
        default=None,
        help='Monitor duration in minutes (default: forever)'
    )
    
    args = parser.parse_args()
    
    monitor = EventMonitor(
        praboth_db_path=args.db_path,
        poll_interval=args.poll_interval
    )
    
    monitor.monitor(duration_minutes=args.duration)


if __name__ == '__main__':
    main()

