"""
Session Timer - Manages countdown timers for work/break intervals
"""
import threading
import time
import logging
from datetime import datetime, timedelta
from typing import Optional, Callable
from enum import Enum

logger = logging.getLogger(__name__)


class TimerState(Enum):
    """Timer state"""
    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"
    FINISHED = "finished"


class SessionTimer:
    """
    Manages countdown timer for work/break intervals
    """
    
    def __init__(
        self,
        duration_minutes: int,
        on_finish: Optional[Callable[[], None]] = None,
        on_tick: Optional[Callable[[int], None]] = None
    ):
        """
        Initialize session timer
        
        Args:
            duration_minutes: Duration of the interval in minutes
            on_finish: Callback when timer finishes
            on_tick: Callback on each second (receives remaining seconds)
        """
        self.duration_minutes = duration_minutes
        self.duration_seconds = duration_minutes * 60
        self.remaining_seconds = self.duration_seconds
        self.on_finish = on_finish
        self.on_tick = on_tick
        
        self.state = TimerState.STOPPED
        self.timer_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._lock = threading.Lock()
    
    def start(self):
        """Start the timer"""
        with self._lock:
            if self.state == TimerState.RUNNING:
                logger.warning("Timer already running")
                return
            
            if self.state == TimerState.FINISHED:
                # Reset if finished
                self.remaining_seconds = self.duration_seconds
            
            self.state = TimerState.RUNNING
            self._stop_event.clear()
            self._pause_event.set()  # Not paused initially
            
            self.timer_thread = threading.Thread(target=self._timer_loop, daemon=True)
            self.timer_thread.start()
            logger.info(f"Timer started: {self.duration_minutes} minutes")
    
    def pause(self):
        """Pause the timer"""
        with self._lock:
            if self.state != TimerState.RUNNING:
                logger.warning("Timer not running, cannot pause")
                return
            
            self.state = TimerState.PAUSED
            self._pause_event.clear()
            logger.info("Timer paused")
    
    def resume(self):
        """Resume a paused timer"""
        with self._lock:
            if self.state != TimerState.PAUSED:
                logger.warning("Timer not paused, cannot resume")
                return
            
            self.state = TimerState.RUNNING
            self._pause_event.set()
            logger.info("Timer resumed")
    
    def stop(self):
        """Stop the timer"""
        with self._lock:
            if self.state == TimerState.STOPPED:
                return
            
            self.state = TimerState.STOPPED
            self._stop_event.set()
            self._pause_event.set()  # Unblock if paused
            
            if self.timer_thread:
                self.timer_thread.join(timeout=2.0)
            
            logger.info("Timer stopped")
    
    def reset(self, duration_minutes: Optional[int] = None):
        """
        Reset the timer
        
        Args:
            duration_minutes: New duration (uses current if None)
        """
        with self._lock:
            was_running = self.state == TimerState.RUNNING
            self.stop()
            
            if duration_minutes is not None:
                self.duration_minutes = duration_minutes
                self.duration_seconds = duration_minutes * 60
            
            self.remaining_seconds = self.duration_seconds
            self.state = TimerState.STOPPED
            
            if was_running:
                self.start()
            
            logger.info(f"Timer reset: {self.duration_minutes} minutes")
    
    def get_remaining_seconds(self) -> int:
        """Get remaining seconds"""
        with self._lock:
            return max(0, int(self.remaining_seconds))
    
    def get_remaining_minutes(self) -> float:
        """Get remaining minutes (as float)"""
        return self.get_remaining_seconds() / 60.0
    
    def get_state(self) -> TimerState:
        """Get current timer state"""
        with self._lock:
            return self.state
    
    def is_running(self) -> bool:
        """Check if timer is running"""
        return self.get_state() == TimerState.RUNNING
    
    def is_paused(self) -> bool:
        """Check if timer is paused"""
        return self.get_state() == TimerState.PAUSED
    
    def is_finished(self) -> bool:
        """Check if timer is finished"""
        return self.get_state() == TimerState.FINISHED
    
    def _timer_loop(self):
        """Main timer loop"""
        start_time = time.time()
        initial_remaining = self.remaining_seconds
        
        while not self._stop_event.is_set() and self.remaining_seconds > 0:
            # Wait for pause to be cleared
            self._pause_event.wait()
            
            if self._stop_event.is_set():
                break
            
            # Calculate elapsed time
            elapsed = time.time() - start_time
            self.remaining_seconds = max(0, initial_remaining - int(elapsed))
            
            # Call tick callback
            if self.on_tick:
                try:
                    self.on_tick(self.remaining_seconds)
                except Exception as e:
                    logger.error(f"Error in on_tick callback: {e}")
            
            # Check if finished
            if self.remaining_seconds <= 0:
                with self._lock:
                    self.state = TimerState.FINISHED
                
                # Call finish callback
                if self.on_finish:
                    try:
                        self.on_finish()
                    except Exception as e:
                        logger.error(f"Error in on_finish callback: {e}")
                
                logger.info("Timer finished")
                break
            
            # Sleep for 1 second
            time.sleep(1)
        
        with self._lock:
            if self.state != TimerState.FINISHED:
                self.state = TimerState.STOPPED
    
    def format_time(self) -> str:
        """
        Format remaining time as MM:SS string
        
        Returns:
            Formatted time string
        """
        remaining = self.get_remaining_seconds()
        minutes = remaining // 60
        seconds = remaining % 60
        return f"{minutes:02d}:{seconds:02d}"

