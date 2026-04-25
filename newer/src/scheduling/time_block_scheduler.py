"""
Time Block Scheduler - Creates initial schedules based on user-specified time blocks
and adapts future sessions based on metrics from previous sessions.
"""
from datetime import datetime, timedelta
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass

from config.config import WORK_INTERVALS, BREAK_DURATIONS
from src.bandit_engine.adaptive_scheduler import AdaptiveScheduler


@dataclass
class TimeBlock:
    """Represents a user-specified time block for study"""
    start_time: datetime
    end_time: datetime
    user_id: str
    task_type: str = "other"
    chronotype: str = "neutral"


@dataclass
class ScheduledInterval:
    """Represents a scheduled work or break interval"""
    start_time: datetime
    end_time: datetime
    interval_type: str  # 'work' or 'break'
    duration_minutes: int
    work_interval: Optional[int] = None  # Only for work intervals
    break_duration: Optional[int] = None  # Only for break intervals


@dataclass
class SessionSchedule:
    """Complete schedule for a time block"""
    time_block: TimeBlock
    intervals: List[ScheduledInterval]
    total_duration_minutes: float
    work_time_minutes: float
    break_time_minutes: float


class TimeBlockScheduler:
    """
    Creates schedules for time blocks and adapts based on metrics.
    
    Flow:
    1. User specifies time block (e.g., 2pm-4pm)
    2. Generate initial schedule with work/break intervals
    3. Session runs with adaptive scheduling during execution
    4. After session, compute metrics from real data
    5. Use metrics to adapt next session's initial schedule
    """
    
    def __init__(self, algorithm: str = "LinUCB"):
        """
        Initialize scheduler
        
        Args:
            algorithm: Bandit algorithm to use ('LinUCB' or 'ThompsonSampling')
        """
        self.algorithm = algorithm
        self.adaptive_scheduler = AdaptiveScheduler(algorithm=algorithm)
    
    def create_initial_schedule(
        self,
        time_block: TimeBlock,
        previous_metrics: Optional[Dict] = None
    ) -> SessionSchedule:
        """
        Create initial schedule for a time block.
        
        If previous_metrics is provided, adapts the schedule based on what worked well.
        Otherwise, uses default strategy.
        
        Args:
            time_block: User-specified time block
            previous_metrics: Metrics from previous sessions to inform adaptation
        
        Returns:
            SessionSchedule with work/break intervals
        """
        total_minutes = (time_block.end_time - time_block.start_time).total_seconds() / 60.0
        
        # Determine work/break intervals based on previous metrics or defaults
        if previous_metrics:
            # Adapt based on what worked well
            work_interval, break_duration = self._adapt_from_metrics(
                previous_metrics, 
                time_block
            )
        else:
            # Default: Start with balanced schedule
            # Use Pomodoro-like intervals (25/5) or middle of action space
            work_interval = 30  # minutes
            break_duration = 5  # minutes
        
        intervals = []
        current_time = time_block.start_time
        interval_index = 0
        
        while current_time < time_block.end_time:
            # Calculate remaining time
            remaining_minutes = (time_block.end_time - current_time).total_seconds() / 60.0
            
            # Work interval
            if remaining_minutes < work_interval:
                # Last interval - use remaining time
                work_minutes = remaining_minutes
                intervals.append(ScheduledInterval(
                    start_time=current_time,
                    end_time=time_block.end_time,
                    interval_type='work',
                    duration_minutes=int(work_minutes),
                    work_interval=int(work_minutes)
                ))
                break
            
            # Add work interval
            work_end = current_time + timedelta(minutes=work_interval)
            intervals.append(ScheduledInterval(
                start_time=current_time,
                end_time=work_end,
                interval_type='work',
                duration_minutes=work_interval,
                work_interval=work_interval
            ))
            current_time = work_end
            interval_index += 1
            
            # Check if we have time for a break
            remaining_after_work = (time_block.end_time - current_time).total_seconds() / 60.0
            if remaining_after_work <= 0:
                break
            
            # Add break interval
            if remaining_after_work < break_duration:
                # Last break - use remaining time
                break_minutes = remaining_after_work
                intervals.append(ScheduledInterval(
                    start_time=current_time,
                    end_time=time_block.end_time,
                    interval_type='break',
                    duration_minutes=int(break_minutes),
                    break_duration=int(break_minutes)
                ))
                break
            
            break_end = current_time + timedelta(minutes=break_duration)
            intervals.append(ScheduledInterval(
                start_time=current_time,
                end_time=break_end,
                interval_type='break',
                duration_minutes=break_duration,
                break_duration=break_duration
            ))
            current_time = break_end
            interval_index += 1
        
        # Calculate totals
        work_time = sum(i.duration_minutes for i in intervals if i.interval_type == 'work')
        break_time = sum(i.duration_minutes for i in intervals if i.interval_type == 'break')
        
        return SessionSchedule(
            time_block=time_block,
            intervals=intervals,
            total_duration_minutes=total_minutes,
            work_time_minutes=work_time,
            break_time_minutes=break_time
        )
    
    def _adapt_from_metrics(
        self,
        metrics: Dict,
        time_block: TimeBlock
    ) -> Tuple[int, int]:
        """
        Adapt work/break intervals based on previous session metrics.
        
        Args:
            metrics: Dictionary with computed metrics (PG, RPH, AHL, etc.)
            time_block: Current time block
        
        Returns:
            Tuple of (work_interval, break_duration) in minutes
        """
        # Start with default intervals
        work_interval = 30
        break_duration = 5
        
        # Adapt based on Personalization Gain
        pg = metrics.get('PG', 0.0)
        if pg > 0.15:
            # Good personalization - stick with what worked
            # Use average of successful actions from previous session
            # For now, keep defaults
            pass
        elif pg < 0:
            # Poor performance - try different intervals
            work_interval = 20  # Shorter work intervals
            break_duration = 8  # Longer breaks
        
        # Adapt based on Adaptation Half-Life
        ahl = metrics.get('AHL')
        if ahl and ahl != float('inf') and ahl < 5:
            # Fast adaptation - system learns quickly, can try more variety
            pass
        elif ahl and ahl != float('inf') and ahl > 10:
            # Slow adaptation - be more conservative
            work_interval = min(work_interval, 25)
        
        # Adapt based on Safety Violation Rate
        svr = metrics.get('SVR', 0.0)
        if svr > 0.1:
            # High safety override rate - intervals may be too aggressive
            work_interval = max(20, work_interval - 5)
            break_duration = min(12, break_duration + 2)
        
        # Ensure intervals are within allowed ranges
        work_interval = max(WORK_INTERVALS[0], min(WORK_INTERVALS[-1], work_interval))
        break_duration = max(BREAK_DURATIONS[0], min(BREAK_DURATIONS[-1], break_duration))
        
        # Round to nearest allowed interval
        work_interval = min(WORK_INTERVALS, key=lambda x: abs(x - work_interval))
        break_duration = min(BREAK_DURATIONS, key=lambda x: abs(x - break_duration))
        
        return work_interval, break_duration
    
    def get_next_interval(
        self,
        schedule: SessionSchedule,
        current_time: datetime
    ) -> Optional[ScheduledInterval]:
        """
        Get the next scheduled interval from a schedule.
        
        Args:
            schedule: Session schedule
            current_time: Current time
        
        Returns:
            Next ScheduledInterval or None if past end time
        """
        for interval in schedule.intervals:
            if interval.start_time > current_time:
                return interval
            elif interval.start_time <= current_time < interval.end_time:
                return interval
        
        return None
    
    def should_adapt_during_session(
        self,
        schedule: SessionSchedule,
        current_time: datetime,
        cognitive_load: float,
        elapsed_work_time: float
    ) -> bool:
        """
        Determine if schedule should be adapted during session based on real-time data.
        
        This is where the adaptive scheduler kicks in - it can override
        the initial schedule based on cognitive load signals.
        
        Args:
            schedule: Current session schedule
            current_time: Current time
            cognitive_load: Current cognitive load estimate
            elapsed_work_time: Minutes of continuous work
        
        Returns:
            True if schedule should be adapted
        """
        # High cognitive load - force break
        if cognitive_load > 0.8:
            return True
        
        # Long continuous work - force break
        if elapsed_work_time > 90:  # MAX_WORK_DURATION
            return True
        
        return False

