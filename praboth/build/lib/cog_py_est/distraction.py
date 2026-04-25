"""Logic for tracking contiguous periods of non-study context."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from .events import utc_now


@dataclass
class DistractionEvent:
    start_time: datetime
    end_time: datetime
    duration_seconds: float


class DistractionTracker:
    def __init__(self, threshold_seconds: int = 180) -> None:
        self.threshold = timedelta(seconds=threshold_seconds)
        self._start_time: Optional[datetime] = None
        self._last_context_study = True  # Assume study at start to avoid instant trigger

    def update(self, is_study: bool, timestamp: datetime) -> Optional[DistractionEvent]:
        """
        Update the tracker with the current context state.
        Returns a DistractionEvent if a non-study period just ended and exceeded the threshold.
        """
        event = None

        if is_study:
            # We are currently studying
            if not self._last_context_study:
                # We just switched FROM distraction TO study
                # Check if the distraction was long enough
                if self._start_time:
                    duration = timestamp - self._start_time
                    if duration >= self.threshold:
                        event = DistractionEvent(
                            start_time=self._start_time,
                            end_time=timestamp,
                            duration_seconds=duration.total_seconds(),
                        )
                # Reset
                self._start_time = None
            
            self._last_context_study = True
        
        else:
            # We are NOT studying
            if self._last_context_study:
                # We just switched FROM study TO distraction
                self._start_time = timestamp
                
            self._last_context_study = False

        return event

    def current_duration(self, now: datetime) -> float:
        """Return current distraction duration in seconds (0.0 if studying)."""
        if self._last_context_study or self._start_time is None:
            return 0.0
        return (now - self._start_time).total_seconds()
