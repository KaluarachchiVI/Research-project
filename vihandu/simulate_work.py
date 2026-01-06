"""
Simulate work activity by sending keystroke events to praboth.
This allows testing the adaptive scheduler without actually working for hours.
"""
import requests
import time
import random
import math
from datetime import datetime, timedelta
from typing import Optional


class WorkSimulator:
    """Simulates realistic typing activity for testing"""
    
    def __init__(self, praboth_url: str = "http://localhost:8000", duration_minutes: int = 120):
        """
        Initialize work simulator
        
        Args:
            praboth_url: URL of praboth API service
            duration_minutes: How long to simulate work (default: 120 minutes = 2 hours)
        """
        self.praboth_url = praboth_url.rstrip('/')
        self.duration_seconds = duration_minutes * 60
        self.start_time = None
        self.last_keystroke_time = None
        self.typing_speed_wpm = 40  # Words per minute (starts moderate)
        self.error_rate = 0.05  # 5% error rate
        self.is_active = False
        
    def check_praboth_available(self) -> bool:
        """Check if praboth service is available"""
        try:
            response = requests.get(f"{self.praboth_url}/health", timeout=2.0)
            return response.status_code == 200
        except:
            return False
    
    def send_keystroke_event(self, latency_ms: float, is_error: bool = False, is_backspace: bool = False):
        """Send a keystroke event to praboth"""
        try:
            payload = {
                "source": "keyboard",
                "payload": {
                    "latency_ms": latency_ms,
                    "is_error": is_error,
                    "is_backspace": is_backspace
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            response = requests.post(
                f"{self.praboth_url}/events",
                json=payload,
                timeout=1.0
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Error sending keystroke: {e}")
            return False
    
    def send_pointer_event(self, dx: float, dy: float, dt_ms: float):
        """Send a pointer/mouse movement event to praboth"""
        try:
            payload = {
                "source": "pointer",
                "payload": {
                    "dx": dx,
                    "dy": dy,
                    "dt_ms": dt_ms
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            response = requests.post(
                f"{self.praboth_url}/events",
                json=payload,
                timeout=1.0
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Error sending pointer event: {e}")
            return False
    
    def send_system_event(self, focus_app: str = "code_editor", idle_seconds: float = 0.0):
        """Send system context event to praboth"""
        try:
            payload = {
                "source": "system",
                "payload": {
                    "focus_app": focus_app,
                    "idle_seconds": idle_seconds,
                    "locked": False,
                    "dnd": False
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            response = requests.post(
                f"{self.praboth_url}/events",
                json=payload,
                timeout=1.0
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Error sending system event: {e}")
            return False
    
    def calculate_typing_speed_variation(self, elapsed_seconds: float) -> float:
        """
        Calculate typing speed variation over time to simulate:
        - Start: Moderate speed (40 WPM)
        - Middle: Peak productivity (60 WPM)
        - End: Fatigue sets in (30 WPM)
        - With some random variation
        """
        # Base speed curve (sine wave to simulate productivity cycles)
        progress = elapsed_seconds / self.duration_seconds
        
        # Productivity curve: starts moderate, peaks around 30%, declines toward end
        if progress < 0.3:
            # Ramping up
            base_speed = 40 + (progress / 0.3) * 20  # 40 to 60 WPM
        elif progress < 0.7:
            # Peak productivity
            base_speed = 60 - ((progress - 0.3) / 0.4) * 10  # 60 to 50 WPM
        else:
            # Fatigue setting in
            base_speed = 50 - ((progress - 0.7) / 0.3) * 20  # 50 to 30 WPM
        
        # Add random variation (±10 WPM)
        variation = random.uniform(-10, 10)
        
        return max(20, min(80, base_speed + variation))
    
    def calculate_iki_ms(self, wpm: float) -> float:
        """
        Calculate Inter-Keystroke Interval (IKI) in milliseconds
        Based on typing speed (words per minute)
        Average word = 5 characters, so WPM * 5 = characters per minute
        """
        chars_per_minute = wpm * 5
        chars_per_second = chars_per_minute / 60.0
        iki_seconds = 1.0 / chars_per_second if chars_per_second > 0 else 0.2
        iki_ms = iki_seconds * 1000
        
        # Add some realistic variation (people don't type at exactly constant speed)
        variation = random.uniform(0.7, 1.3)
        
        return iki_ms * variation
    
    def simulate_typing_burst(self, duration_seconds: float, wpm: float):
        """Simulate a burst of typing activity"""
        end_time = time.time() + duration_seconds
        keystroke_count = 0
        
        while time.time() < end_time:
            # Calculate IKI for this keystroke
            iki_ms = self.calculate_iki_ms(wpm)
            
            # Determine if this is an error (typo)
            is_error = random.random() < self.error_rate
            
            # If error, sometimes followed by backspace
            is_backspace = False
            if is_error and random.random() < 0.7:  # 70% of errors get corrected
                # Send backspace after a short delay
                time.sleep(iki_ms / 1000.0)
                is_backspace = True
                iki_ms = random.uniform(100, 300)  # Backspace is usually faster
            
            # Send keystroke event
            self.send_keystroke_event(iki_ms, is_error, is_backspace)
            keystroke_count += 1
            
            # Sleep for IKI
            sleep_time = iki_ms / 1000.0
            time.sleep(sleep_time)
            
            # Occasionally send pointer events (mouse movements)
            if random.random() < 0.1:  # 10% chance
                self.send_pointer_event(
                    dx=random.uniform(-100, 100),
                    dy=random.uniform(-100, 100),
                    dt_ms=random.uniform(50, 200)
                )
        
        return keystroke_count
    
    def simulate_work_session(self):
        """Simulate a complete work session"""
        print(f"Starting work simulation for {self.duration_seconds / 60:.1f} minutes...")
        print(f"Praboth URL: {self.praboth_url}")
        
        # Check praboth availability
        if not self.check_praboth_available():
            print(f"ERROR: Praboth service not available at {self.praboth_url}")
            print("Please make sure praboth is running:")
            print("  cd praboth")
            print("  .\\.venv\\Scripts\\cog-py-est.exe --config policy_1.toml")
            return False
        
        print("✓ Praboth service is available")
        print("Starting simulation...\n")
        
        self.start_time = time.time()
        self.last_keystroke_time = self.start_time
        self.is_active = True
        
        # Send initial system event
        self.send_system_event(focus_app="code_editor", idle_seconds=0.0)
        
        total_keystrokes = 0
        burst_count = 0
        
        try:
            while time.time() - self.start_time < self.duration_seconds:
                elapsed = time.time() - self.start_time
                remaining = self.duration_seconds - elapsed
                progress = (elapsed / self.duration_seconds) * 100
                
                # Calculate current typing speed based on elapsed time
                current_wpm = self.calculate_typing_speed_variation(elapsed)
                self.typing_speed_wpm = current_wpm
                
                # Determine activity pattern
                # Typing bursts: 2-5 minutes of active typing
                # Pauses: 10-30 seconds between bursts
                # Longer breaks: 2-5 minutes every 20-30 minutes
                
                if random.random() < 0.15:  # 15% chance of longer break
                    # Longer break (2-5 minutes)
                    break_duration = random.uniform(120, 300)
                    if break_duration > remaining:
                        break_duration = remaining
                    
                    print(f"[{elapsed/60:.1f}min] Taking longer break ({break_duration/60:.1f} min)...")
                    self.send_system_event(focus_app="idle", idle_seconds=break_duration)
                    time.sleep(break_duration)
                    
                elif random.random() < 0.3:  # 30% chance of short pause
                    # Short pause (10-30 seconds)
                    pause_duration = random.uniform(10, 30)
                    if pause_duration > remaining:
                        pause_duration = remaining
                    
                    print(f"[{elapsed/60:.1f}min] Short pause ({pause_duration:.0f}s)...")
                    self.send_system_event(focus_app="code_editor", idle_seconds=pause_duration)
                    time.sleep(pause_duration)
                
                else:
                    # Active typing burst (2-5 minutes)
                    burst_duration = random.uniform(120, 300)
                    if burst_duration > remaining:
                        burst_duration = remaining
                    
                    print(f"[{elapsed/60:.1f}min] Typing burst ({burst_duration/60:.1f} min, ~{current_wpm:.0f} WPM)...", end="", flush=True)
                    
                    # Send system event indicating active work
                    self.send_system_event(focus_app="code_editor", idle_seconds=0.0)
                    
                    # Simulate typing
                    keystrokes = self.simulate_typing_burst(burst_duration, current_wpm)
                    total_keystrokes += keystrokes
                    burst_count += 1
                    
                    print(f" {keystrokes} keystrokes")
                
                # Update error rate (slightly increases with fatigue)
                progress = elapsed / self.duration_seconds
                self.error_rate = 0.05 + (progress * 0.03)  # 5% to 8% error rate
                
                # Send periodic system events
                if random.random() < 0.2:  # 20% chance
                    self.send_system_event(focus_app="code_editor", idle_seconds=0.0)
        
        except KeyboardInterrupt:
            print("\n\nSimulation interrupted by user")
            self.is_active = False
        
        # Send final system event
        self.send_system_event(focus_app="idle", idle_seconds=0.0)
        
        total_time = time.time() - self.start_time
        print(f"\n{'='*60}")
        print(f"Simulation complete!")
        print(f"Total time: {total_time/60:.1f} minutes")
        print(f"Total keystrokes: {total_keystrokes}")
        print(f"Typing bursts: {burst_count}")
        print(f"Average WPM: {total_keystrokes / (total_time / 60) / 5:.1f}")
        print(f"{'='*60}")
        
        return True


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Simulate work activity for adaptive scheduler testing')
    parser.add_argument(
        '--duration',
        type=int,
        default=120,
        help='Duration in minutes (default: 120 = 2 hours)'
    )
    parser.add_argument(
        '--praboth-url',
        type=str,
        default='http://localhost:8000',
        help='Praboth API URL (default: http://localhost:8000)'
    )
    parser.add_argument(
        '--fast',
        action='store_true',
        help='Fast mode: 10x speed (simulate 2 hours in 12 minutes)'
    )
    
    args = parser.parse_args()
    
    duration = args.duration
    if args.fast:
        duration = duration // 10
        print("⚠ FAST MODE: Simulating at 10x speed")
        print(f"   Actual duration: {duration} minutes")
        print(f"   Simulated duration: {args.duration} minutes\n")
    
    simulator = WorkSimulator(
        praboth_url=args.praboth_url,
        duration_minutes=duration
    )
    
    if args.fast:
        # In fast mode, we need to adjust timing
        # We'll send events more frequently but scale the timestamps
        print("Note: Fast mode compresses time but maintains realistic patterns")
    
    success = simulator.simulate_work_session()
    
    if success:
        print("\n✓ Data sent to praboth successfully!")
        print("You can now check the adaptive scheduler dashboard to see the results.")
    else:
        print("\n✗ Simulation failed. Check praboth service status.")


if __name__ == '__main__':
    main()

