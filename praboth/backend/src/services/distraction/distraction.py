"""Logic for tracking contiguous periods of non-study context."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional, List
import numpy as np

from backend.src.core.events import utc_now


@dataclass
class DistractionEvent:
    start_time: datetime
    end_time: datetime
    duration_seconds: float
    app_name: str = "unknown"


class DistractionTracker:
    def __init__(self, threshold_seconds: int = 180, min_history: int = 5) -> None:
        self.base_threshold = float(threshold_seconds)
        self.history: List[float] = []
        self.min_history = min_history
        self._start_time: Optional[datetime] = None
        self._distracted_app: Optional[str] = None
        self._last_context_study = True 

    @property
    def current_threshold(self) -> float:
        """Calculates adaptive threshold: Median + 2 * StdDev of non-study durations."""
        if len(self.history) < self.min_history:
            return self.base_threshold
        
        median = float(np.median(self.history))
        std = float(np.std(self.history))
        adaptive = median + (2 * std)
        # Clamp to reasonable bounds (e.g., never less than 30s, never more than 10 mins)
        return max(30.0, min(600.0, adaptive))

    def update(
        self, is_study: bool, timestamp: datetime, current_app: str = "unknown"
    ) -> Optional[DistractionEvent]:
        """
        Updates the tracker with the current context state.
        Returns a DistractionEvent if a non-study period exceeding the threshold just ended.
        """
        event = None

        if is_study:
            # Indicates currently active study context.
            if not self._last_context_study:
                # Detects transition from distraction to study.
                if self._start_time:
                    duration = (timestamp - self._start_time).total_seconds()
                    
                    # Store history of ALL non-study breaks to learn user patterns
                    self.history.append(duration)
                    if len(self.history) > 100:
                        self.history.pop(0)

                    # Check if it exceeded the ADAPTIVE threshold (calculated at the time of check)
                    threshold = self.current_threshold
                    if duration >= threshold:
                        event = DistractionEvent(
                            start_time=self._start_time,
                            end_time=timestamp,
                            duration_seconds=duration,
                            app_name=self._distracted_app or "unknown",
                        )
                
                # Reset
                self._start_time = None
                self._distracted_app = None
            
            self._last_context_study = True
        
        else:
            # We are NOT studying
            if self._last_context_study:
                # We just switched FROM study TO distraction
                self._start_time = timestamp
                self._distracted_app = current_app
                
            self._last_context_study = False

        return event

    def current_duration(self, now: datetime) -> float:
        """Return current distraction duration in seconds (0.0 if studying)."""
        if self._last_context_study or self._start_time is None:
            return 0.0
        return (now - self._start_time).total_seconds()
