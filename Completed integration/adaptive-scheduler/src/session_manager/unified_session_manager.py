"""
Unified Session Manager - Orchestrates time blocks, praboth integration, and adaptive scheduling
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
import json
import logging

from src.scheduling.time_block_scheduler import TimeBlockScheduler, TimeBlock, SessionSchedule, ScheduledInterval
from src.bandit_engine.adaptive_scheduler import AdaptiveScheduler
from src.feature_extractor.feature_extractor import FeatureExtractor, ContextFeatures
from src.data_integration.praboth_metrics_adapter import PrabothMetricsAdapter
from src.metrics.metrics_calculator import MetricsCalculator
from src.database.models import Session, SessionLocal, get_db, init_db
from src.session_manager.praboth_realtime_client import PrabothRealtimeClient
from config.config import (
    PRABOTH_API_URL,
    PRABOTH_DB_PATH,
    PRABOTH_POLL_INTERVAL,
    AUTO_SYNC_ENABLED,
    AUTO_COMPUTE_METRICS,
)

logger = logging.getLogger(__name__)


def sanitize_for_json(value: Any) -> Any:
    """
    Convert Infinity/NaN to None for JSON compatibility
    
    Args:
        value: Value to sanitize (can be any type)
    
    Returns:
        Sanitized value (Infinity/NaN become None)
    """
    if value is None:
        return None
    if isinstance(value, float):
        if value == float('inf') or value == float('-inf'):
            return None
        if value != value:  # NaN check (NaN != NaN is True)
            return None
    elif isinstance(value, dict):
        return {k: sanitize_for_json(v) for k, v in value.items()}
    elif isinstance(value, (list, tuple)):
        return [sanitize_for_json(item) for item in value]
    return value


@dataclass
class ActiveSessionState:
    """State of an active session"""
    session_id: str
    user_id: str
    time_block: TimeBlock
    schedule: SessionSchedule
    current_interval_index: int
    session_start_time: datetime
    praboth_session_id: Optional[int] = None
    adaptive_scheduler: Optional[Any] = None
    feature_extractor: Optional[Any] = None
    praboth_client: Optional[Any] = None
    is_paused: bool = False
    paused_at: Optional[datetime] = None
    current_cognitive_load: Optional[float] = None
    # Load at start of current interval (used as pre_break when ending a break)
    cognitive_load_at_interval_start: Optional[float] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary for storage"""
        return {
            'session_id': self.session_id,
            'user_id': self.user_id,
            'time_block': {
                'start_time': self.time_block.start_time.isoformat(),
                'end_time': self.time_block.end_time.isoformat(),
                'user_id': self.time_block.user_id,
                'task_type': self.time_block.task_type,
                'chronotype': self.time_block.chronotype
            },
            'schedule': {
                'total_duration_minutes': self.schedule.total_duration_minutes,
                'work_time_minutes': self.schedule.work_time_minutes,
                'break_time_minutes': self.schedule.break_time_minutes,
                'intervals': [
                    {
                        'start_time': i.start_time.isoformat(),
                        'end_time': i.end_time.isoformat(),
                        'interval_type': i.interval_type,
                        'duration_minutes': i.duration_minutes,
                        'work_interval': i.work_interval,
                        'break_duration': i.break_duration
                    }
                    for i in self.schedule.intervals
                ]
            },
            'current_interval_index': self.current_interval_index,
            'session_start_time': self.session_start_time.isoformat(),
            'praboth_session_id': self.praboth_session_id,
            'is_paused': self.is_paused,
            'paused_at': self.paused_at.isoformat() if self.paused_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ActiveSessionState':
        """Create from dictionary"""
        from datetime import datetime
        time_block_data = data['time_block']
        time_block = TimeBlock(
            start_time=datetime.fromisoformat(time_block_data['start_time']),
            end_time=datetime.fromisoformat(time_block_data['end_time']),
            user_id=time_block_data['user_id'],
            task_type=time_block_data.get('task_type', 'other'),
            chronotype=time_block_data.get('chronotype', 'neutral')
        )
        
        schedule_data = data['schedule']
        intervals = []
        for i_data in schedule_data['intervals']:
            intervals.append(ScheduledInterval(
                start_time=datetime.fromisoformat(i_data['start_time']),
                end_time=datetime.fromisoformat(i_data['end_time']),
                interval_type=i_data['interval_type'],
                duration_minutes=i_data['duration_minutes'],
                work_interval=i_data.get('work_interval'),
                break_duration=i_data.get('break_duration')
            ))
        
        schedule = SessionSchedule(
            time_block=time_block,
            intervals=intervals,
            total_duration_minutes=schedule_data['total_duration_minutes'],
            work_time_minutes=schedule_data['work_time_minutes'],
            break_time_minutes=schedule_data['break_time_minutes']
        )
        
        return cls(
            session_id=data['session_id'],
            user_id=data['user_id'],
            time_block=time_block,
            schedule=schedule,
            current_interval_index=data['current_interval_index'],
            session_start_time=datetime.fromisoformat(data['session_start_time']),
            praboth_session_id=data.get('praboth_session_id'),
            is_paused=data.get('is_paused', False),
            paused_at=datetime.fromisoformat(data['paused_at']) if data.get('paused_at') else None
        )


class UnifiedSessionManager:
    """
    Unified session manager that orchestrates:
    - Time block scheduling
    - Praboth data collection
    - Adaptive scheduling during sessions
    - Automatic data syncing
    - Metrics computation
    - Next session suggestions
    """
    
    def __init__(self, praboth_db_path: Optional[str] = None, praboth_api_url: str = PRABOTH_API_URL):
        """
        Initialize unified session manager
        
        Args:
            praboth_db_path: Path to praboth database (auto-detected if None)
            praboth_api_url: URL of praboth API service
        """
        self.praboth_db_path = praboth_db_path or PRABOTH_DB_PATH
        self.praboth_api_url = praboth_api_url
        self.active_sessions: Dict[str, ActiveSessionState] = {}
        self.praboth_adapter = PrabothMetricsAdapter(self.praboth_db_path)
        self.db_session = SessionLocal()
        
        # Initialize database and load active sessions
        init_db()
        self._load_active_sessions()
    
    def start_time_block_session(
        self,
        time_block: TimeBlock,
        user_id: str,
        algorithm: str = "LinUCB",
        previous_metrics: Optional[Dict] = None
    ) -> Tuple[str, SessionSchedule]:
        """
        Start a new time block session
        
        Args:
            time_block: User-specified time block
            user_id: User identifier
            algorithm: Bandit algorithm to use
            previous_metrics: Metrics from previous sessions for adaptation
        
        Returns:
            Tuple of (session_id, schedule)
        """
        logger.info(f"Starting time block session for user {user_id}: {time_block.start_time} - {time_block.end_time}")
        
        # Create initial schedule
        scheduler = TimeBlockScheduler(algorithm=algorithm)
        schedule = scheduler.create_initial_schedule(
            time_block=time_block,
            previous_metrics=previous_metrics
        )
        
        # Generate session ID per convention: user-{USER_ID}-{START_ISO8601}
        safe_uid = "".join(c if c.isalnum() or c in "._-" else "_" for c in str(user_id))
        start_iso = time_block.start_time.isoformat()
        session_id = f"user-{safe_uid}-{start_iso}"
        
        # Create adaptive scheduler
        adaptive_scheduler = AdaptiveScheduler(algorithm=algorithm)
        
        # Create feature extractor
        feature_extractor = FeatureExtractor(session_id)
        
        # Create praboth real-time client
        praboth_client = PrabothRealtimeClient(
            api_url=self.praboth_api_url,
            poll_interval=PRABOTH_POLL_INTERVAL
        )
        
        # Start polling praboth for real-time cognitive load
        def cognitive_load_callback(cognitive_load: float, estimate: Dict):
            """Callback when cognitive load is received from praboth"""
            if session_id in self.active_sessions:
                state = self.active_sessions[session_id]
                state.current_cognitive_load = cognitive_load
                
                # Update session in DB with new cognitive load
                self._update_session_in_db(session_id)
                
                # Extract additional praboth data for better scheduling decisions
                variance = estimate.get('variance', 0.0)
                load_state = estimate.get('load_state', 'unknown')
                context_flags = estimate.get('context_flags', {})
                
                # Update feature extractor's cognitive load with praboth data
                if state.feature_extractor:
                    # Extract current features and update cognitive load
                    try:
                        context_features = state.feature_extractor.extract_features()
                        # Use praboth cognitive load directly (more accurate)
                        context_features.cognitive_load = cognitive_load
                        state.feature_extractor.save_features_to_db(context_features)
                        
                        # Log cognitive load state for debugging
                        if load_state != 'unknown':
                            logger.debug(f"Praboth cognitive load: {cognitive_load:.2f} ({load_state}), variance: {variance:.4f}")
                    except Exception as e:
                        logger.error(f"Failed to update cognitive load: {e}")
                
                # Check if schedule should be adapted based on cognitive load
                should_adapt, reason = self.should_adapt_schedule(session_id, cognitive_load)
                if should_adapt:
                    logger.info(f"Schedule adaptation triggered: {reason} (cognitive_load={cognitive_load:.2f})")
        
        # Start polling if praboth service is available
        if praboth_client.is_service_available():
            praboth_client.start_polling(cognitive_load_callback)
            logger.info(f"Started real-time praboth polling for session {session_id}")
        else:
            logger.warning(f"Praboth service not available at {self.praboth_api_url}. Will use estimated cognitive load.")
            # Fallback: Use feature extractor's estimated cognitive load
            # This allows the system to work even when praboth is unavailable
        
        # Get current praboth session ID (if praboth is running)
        praboth_session_id = self._get_current_praboth_session_id()
        
        # Create database session record
        db_session = Session(
            session_id=session_id,
            user_id=user_id,
            start_time=datetime.utcnow(),
            chronotype=time_block.chronotype,
            task_type=time_block.task_type
        )
        self.db_session.add(db_session)
        self.db_session.commit()
        
        # Create active session state
        active_state = ActiveSessionState(
            session_id=session_id,
            user_id=user_id,
            time_block=time_block,
            schedule=schedule,
            current_interval_index=0,
            session_start_time=datetime.utcnow(),
            praboth_session_id=praboth_session_id,
            adaptive_scheduler=adaptive_scheduler,
            feature_extractor=feature_extractor,
            praboth_client=praboth_client
        )
        
        self.active_sessions[session_id] = active_state
        
        # Save session to database immediately
        self._save_session_to_db(active_state)
        
        logger.info(f"Session {session_id} started with {len(schedule.intervals)} intervals")
        
        return session_id, schedule
    
    def get_current_interval(self, session_id: str) -> Optional[ScheduledInterval]:
        """
        Get the current work/break interval for a session
        
        Args:
            session_id: Session identifier
        
        Returns:
            Current ScheduledInterval or None if session not found
        """
        if session_id not in self.active_sessions:
            return None
        
        state = self.active_sessions[session_id]
        current_time = datetime.utcnow()
        
        # Normalize current_time to naive datetime (remove timezone if present)
        if current_time.tzinfo is not None:
            current_time = current_time.replace(tzinfo=None)
        
        # Adjust for pause time
        if state.is_paused and state.paused_at:
            pause_duration = (current_time - state.paused_at).total_seconds() / 60.0
            current_time = current_time - timedelta(minutes=pause_duration)
        
        # Find current interval
        for i, interval in enumerate(state.schedule.intervals):
            # Normalize interval times to naive datetime for comparison
            start_time = interval.start_time
            end_time = interval.end_time
            if start_time.tzinfo is not None:
                start_time = start_time.replace(tzinfo=None)
            if end_time.tzinfo is not None:
                end_time = end_time.replace(tzinfo=None)
            
            if start_time <= current_time < end_time:
                state.current_interval_index = i
                # Update DB with current interval
                self._update_session_in_db(session_id)
                return interval
        
        # Check if we're past all intervals
        last_end_time = state.schedule.intervals[-1].end_time
        if last_end_time.tzinfo is not None:
            last_end_time = last_end_time.replace(tzinfo=None)
        if current_time >= last_end_time:
            return None
        
        return state.schedule.intervals[state.current_interval_index] if state.schedule.intervals else None
    
    def should_adapt_schedule(
        self,
        session_id: str,
        cognitive_load: Optional[float] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if schedule should be adapted during session based on real-time data
        
        Args:
            session_id: Session identifier
            cognitive_load: Current cognitive load estimate (from praboth, optional - will use state if None)
        
        Returns:
            Tuple of (should_adapt, reason)
        """
        if session_id not in self.active_sessions:
            return False, None
        
        state = self.active_sessions[session_id]
        current_interval = self.get_current_interval(session_id)
        
        if not current_interval:
            return False, None
        
        # Use cognitive load from state if not provided
        if cognitive_load is None:
            cognitive_load = state.current_cognitive_load
        
        # Use cognitive load if available
        if cognitive_load is not None:
            if cognitive_load > 0.8:
                return True, "High cognitive load detected"
            if cognitive_load < 0.3 and current_interval.interval_type == 'work':
                # Low load during work - could extend work interval
                return True, "Low cognitive load - can extend work"
        
        # Check elapsed work time
        if current_interval.interval_type == 'work':
            now = datetime.utcnow()
            if now.tzinfo is not None:
                now = now.replace(tzinfo=None)
            interval_start = current_interval.start_time
            if interval_start.tzinfo is not None:
                interval_start = interval_start.replace(tzinfo=None)
            elapsed = (now - interval_start).total_seconds() / 60.0
            if elapsed > 90:  # MAX_WORK_DURATION
                return True, "Maximum work duration exceeded"
        
        return False, None
    
    def end_interval_and_compute_reward(
        self,
        session_id: str,
        metrics: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        End current interval, compute reward, update bandit, and get next recommendation
        
        Args:
            session_id: Session identifier
            metrics: Optional metrics dictionary with:
                - chars_typed: Number of characters typed
                - cognitive_load_pre_break: Cognitive load before break
                - cognitive_load_post_break: Cognitive load after break
                - improved_focus: Boolean
                - deep_work_interrupted: Boolean
        
        Returns:
            Dictionary with reward, next action, and metadata or None if error
        """
        if session_id not in self.active_sessions:
            logger.warning(f"Session {session_id} not found in active_sessions")
            return None
        
        state = self.active_sessions[session_id]
        
        if not state.adaptive_scheduler or not state.feature_extractor:
            logger.warning(f"Session {session_id} missing required components")
            return None
        
        try:
            # Get current interval that just ended
            current_interval = self.get_current_interval(session_id)
            if not current_interval:
                logger.error(f"No current interval found for session {session_id}")
                return None
            
            # Extract context features
            context_features = state.feature_extractor.extract_features()
            
            # Use real-time cognitive load from praboth if available
            if state.current_cognitive_load is not None:
                context_features.cognitive_load = state.current_cognitive_load
            
            # Override cognitive load from metrics if provided (more accurate)
            # metrics "cognitive_load_post_break" = load at end of current interval (frontend sends current latent)
            if metrics:
                if metrics.get('cognitive_load_post_break') is not None:
                    context_features.cognitive_load = metrics['cognitive_load_post_break']
                elif metrics.get('cognitive_load_pre_break') is not None:
                    context_features.cognitive_load = metrics['cognitive_load_pre_break']

            # Interval elapsed for progress proxy
            from datetime import datetime as dt_utc
            now_utc = dt_utc.utcnow()
            if current_interval.start_time.tzinfo is not None:
                now_utc = (now_utc.replace(tzinfo=current_interval.start_time.tzinfo)
                           if current_interval.start_time.tzinfo else now_utc)
            interval_start_naive = current_interval.start_time.replace(tzinfo=None) if current_interval.start_time.tzinfo else current_interval.start_time
            now_naive = now_utc.replace(tzinfo=None) if now_utc.tzinfo else now_utc
            interval_elapsed_minutes = (now_naive - interval_start_naive).total_seconds() / 60.0

            # Get the action that was taken (from current interval)
            # For work intervals: work_interval is set, break_duration is the scheduled break after
            # For break intervals: break_duration is set, work_interval is the work that preceded it
            if current_interval.interval_type == 'work':
                work_interval = current_interval.work_interval or current_interval.duration_minutes or 30
                # Get the break_duration from the interval (scheduled break after this work)
                break_duration = current_interval.break_duration
                # If not set, try to get from next interval or use default
                if break_duration is None:
                    # Try to get from next interval in schedule
                    if state.current_interval_index + 1 < len(state.schedule.intervals):
                        next_interval = state.schedule.intervals[state.current_interval_index + 1]
                        if next_interval.interval_type == 'break':
                            break_duration = next_interval.break_duration or next_interval.duration_minutes or 5
                        else:
                            break_duration = 5  # Default
                    else:
                        break_duration = 5  # Default
            else:  # break interval
                break_duration = current_interval.break_duration or current_interval.duration_minutes or 5
                # Get work_interval from previous interval
                work_interval = current_interval.work_interval
                if work_interval is None:
                    # Try to get from previous interval in schedule
                    if state.current_interval_index > 0:
                        prev_interval = state.schedule.intervals[state.current_interval_index - 1]
                        if prev_interval.interval_type == 'work':
                            work_interval = prev_interval.work_interval or prev_interval.duration_minutes or 30
                        else:
                            work_interval = 30  # Default
                    else:
                        work_interval = 30  # Default
            
            # Ensure both are integers
            work_interval = int(work_interval)
            break_duration = int(break_duration)
            
            logger.debug(
                f"Action for reward: work={work_interval}min, break={break_duration}min "
                f"(interval_type={current_interval.interval_type})"
            )
            
            # Prepare user_data for reward calculation
            from src.reward_handler.reward_calculator import RewardCalculator
            reward_calculator = RewardCalculator()

            # Pre/post load semantics: metrics "cognitive_load_post_break" = load at end of current interval
            if current_interval.interval_type == 'work':
                # Ending work: end-of-work load is pre_break (for next break); no post_break yet
                load_pre = (metrics.get('cognitive_load_pre_break') or metrics.get('cognitive_load_post_break')) if metrics else context_features.cognitive_load
                load_post = metrics.get('cognitive_load_post_break') if metrics else None  # None until break ends
            else:
                # Ending break: pre_break = load at start of break (best available from state)
                load_pre = state.cognitive_load_at_interval_start if state.cognitive_load_at_interval_start is not None else context_features.cognitive_load
                load_post = (metrics.get('cognitive_load_post_break') if metrics else None) or context_features.cognitive_load

            work_interval_completed = (
                current_interval.interval_type == 'work'
                and interval_elapsed_minutes >= work_interval * 0.9
            ) if work_interval > 0 else False

            user_data = {
                'chars_typed': metrics.get('chars_typed', 0) if metrics else 0,
                'keystrokes': [],
                'cognitive_load_pre_break': load_pre,
                'cognitive_load_post_break': load_post if current_interval.interval_type == 'break' else None,
                'interval_elapsed_minutes': interval_elapsed_minutes,
                'work_interval_completed': work_interval_completed,
                'user_reported_improved_focus': metrics.get('improved_focus', False) if metrics else False,
                'deep_work_interrupted': metrics.get('deep_work_interrupted', False) if metrics else False
            }
            
            # Try to get praboth data for better metrics
            if state.praboth_session_id and self.praboth_adapter:
                try:
                    # Get recent feature windows to estimate chars_typed
                    windows = self.praboth_adapter.praboth_reader.get_feature_windows(
                        state.praboth_session_id
                    )
                    if windows:
                        logger.info(f"Found {len(windows)} feature windows from praboth for reward calculation")
                        
                        # Get windows from current interval time range
                        from datetime import datetime, timedelta
                        now = datetime.utcnow()
                        if now.tzinfo is not None:
                            now = now.replace(tzinfo=None)
                        
                        interval_start = current_interval.start_time
                        if interval_start.tzinfo is not None:
                            interval_start = interval_start.replace(tzinfo=None)
                        
                        # Filter windows to current interval
                        # Normalize window_start to timezone-naive for comparison
                        interval_windows = []
                        for w in windows:
                            window_start = w.window_start
                            if window_start.tzinfo is not None:
                                window_start = window_start.replace(tzinfo=None)
                            
                            if window_start >= interval_start and window_start <= now:
                                interval_windows.append(w)
                        
                        if interval_windows:
                            logger.info(f"Using {len(interval_windows)} windows from current interval")
                            # Estimate chars_typed from feature windows
                            # Feature vector[0] is keystrokes per window, estimate chars per keystroke
                            total_keystrokes = sum(
                                max(0, w.feature_vector[0]) if len(w.feature_vector) > 0 else 0
                                for w in interval_windows
                            )
                            # Rough estimate: 4-5 chars per keystroke (accounts for spaces, punctuation)
                            estimated_chars = int(total_keystrokes * 4.5)
                            if estimated_chars > 0:
                                user_data['chars_typed'] = max(user_data['chars_typed'], estimated_chars)
                                logger.info(f"Estimated {estimated_chars} chars typed from praboth windows")
                        
                        # Get cognitive load from praboth model states
                        model_states = self.praboth_adapter.praboth_reader.get_model_states(
                            state.praboth_session_id
                        )
                        if model_states:
                            # Get model state closest to interval end
                            latest_state = model_states[-1]
                            if latest_state.latent_mean is not None:
                                user_data['cognitive_load_pre_break'] = latest_state.latent_mean
                                user_data['cognitive_load_variance'] = latest_state.latent_variance
                                logger.info(
                                    f"Using praboth cognitive load: {latest_state.latent_mean:.4f} "
                                    f"(variance: {latest_state.latent_variance:.4f})"
                                )
                            
                            # If ending a break, try to get post-break cognitive load
                            if current_interval.interval_type == 'break' and len(model_states) > 1:
                                # Use the latest state as post-break load
                                user_data['cognitive_load_post_break'] = latest_state.latent_mean
                        
                        # Get EMA responses for reward shaping
                        ema_responses = self.praboth_adapter.praboth_reader.get_ema_responses(
                            state.praboth_session_id
                        )
                        if ema_responses:
                            # Use most recent EMA response
                            latest_ema = ema_responses[-1]
                            user_data['praboth_ema_rating'] = latest_ema.get('rating', 4)
                            logger.info(f"Using EMA rating: {latest_ema.get('rating', 4)}")
                except Exception as e:
                    logger.warning(f"Could not get praboth data for reward: {e}", exc_info=True)
            
            # Compute reward
            reward_components = reward_calculator.compute_reward(
                work_interval,
                break_duration,
                user_data
            )
            
            logger.info(
                f"Computed reward for session {session_id[:8]}... | "
                f"Work: {work_interval}min, Break: {break_duration}min | "
                f"Reward: {reward_components.immediate_reward:.4f} | "
                f"r_progress: {reward_components.r_progress:.4f}, r_relief: {reward_components.r_relief:.4f}"
            )
            
            # Update bandit with observed reward
            state.adaptive_scheduler.update(
                (work_interval, break_duration),
                context_features,
                reward_components.immediate_reward
            )
            
            # Save reward to database
            try:
                from src.database.models import Action, Reward
                db = self.db_session
                
                # Find or create action record
                action = db.query(Action).filter_by(
                    session_id=session_id,
                    work_interval=work_interval,
                    break_duration=break_duration
                ).order_by(Action.epoch.desc()).first()
                
                if not action:
                    # Create new action record
                    action = Action(
                        session_id=session_id,
                        epoch=state.current_interval_index,
                        work_interval=work_interval,
                        break_duration=break_duration,
                        context_vector_id=None,
                        bandit_algorithm=state.adaptive_scheduler.algorithm_name,
                        safety_override=False
                    )
                    db.add(action)
                    db.flush()
                
                # Create or update reward
                reward = db.query(Reward).filter_by(action_id=action.action_id).first()
                if not reward:
                    reward = Reward(
                        action_id=action.action_id,
                        immediate_reward=reward_components.immediate_reward,
                        r_progress=reward_components.r_progress,
                        r_relief=reward_components.r_relief,
                        final_reward=reward_components.immediate_reward
                    )
                    db.add(reward)
                else:
                    reward.immediate_reward = reward_components.immediate_reward
                    reward.r_progress = reward_components.r_progress
                    reward.r_relief = reward_components.r_relief
                    reward.final_reward = reward_components.immediate_reward
                
                db.commit()
            except Exception as e:
                logger.error(f"Failed to save reward to database: {e}", exc_info=True)
                self.db_session.rollback()
            
            # Advance to next interval
            state.current_interval_index += 1
            # Store load at end of (just-ended) interval as start load for next interval when next is break
            if current_interval.interval_type == 'work':
                state.cognitive_load_at_interval_start = context_features.cognitive_load
            if state.current_interval_index >= len(state.schedule.intervals):
                # Schedule complete, create adaptive next interval
                # For now, just get recommendation
                pass

            # Get next recommendation
            next_context = state.feature_extractor.extract_features()
            if state.current_cognitive_load is not None:
                next_context.cognitive_load = state.current_cognitive_load
            
            next_action, next_metadata = state.adaptive_scheduler.get_recommendation(next_context)
            
            # Update current interval if we have more intervals
            if state.current_interval_index < len(state.schedule.intervals):
                # Use scheduled interval
                next_interval = state.schedule.intervals[state.current_interval_index]
            else:
                # Create new interval from recommendation
                from datetime import datetime, timedelta
                now = datetime.utcnow()
                if now.tzinfo is not None:
                    now = now.replace(tzinfo=None)
                
                interval_type = 'break' if current_interval.interval_type == 'work' else 'work'
                duration = next_action[1] if interval_type == 'break' else next_action[0]
                
                next_interval = ScheduledInterval(
                    start_time=now,
                    end_time=now + timedelta(minutes=duration),
                    interval_type=interval_type,
                    duration_minutes=duration,
                    work_interval=next_action[0],
                    break_duration=next_action[1]
                )
                state.schedule.intervals.append(next_interval)
            
            # Save updated session state
            self._save_session_to_db(state)
            
            return {
                'work_interval': next_action[0],
                'break_duration': next_action[1],
                'reward': reward_components.immediate_reward,
                'r_progress': reward_components.r_progress,
                'r_relief': reward_components.r_relief,
                'metadata': next_metadata,
                'cognitive_load': next_context.cognitive_load
            }
        except Exception as e:
            logger.error(f"Failed to end interval and compute reward: {e}", exc_info=True)
            return None
    
    def get_recommendation(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get real-time recommendation from adaptive scheduler using current context
        
        Args:
            session_id: Session identifier
        
        Returns:
            Dictionary with recommendation or None if session not found
        """
        if session_id not in self.active_sessions:
            logger.warning(f"Session {session_id} not found in active_sessions")
            return None
        
        state = self.active_sessions[session_id]
        
        if not state.adaptive_scheduler:
            logger.warning(f"Session {session_id} has no adaptive_scheduler")
            return None
        
        if not state.feature_extractor:
            logger.warning(f"Session {session_id} has no feature_extractor")
            return None
        
        try:
            # Extract current context features
            context_features = state.feature_extractor.extract_features()
            
            # Use real-time cognitive load from praboth if available
            if state.current_cognitive_load is not None:
                context_features.cognitive_load = state.current_cognitive_load
            
            # Get recommendation from adaptive scheduler
            action, metadata = state.adaptive_scheduler.get_recommendation(context_features)
            
            return {
                'work_interval': action[0],
                'break_duration': action[1],
                'metadata': metadata,
                'cognitive_load': context_features.cognitive_load
            }
        except Exception as e:
            logger.error(f"Failed to get recommendation for session {session_id}: {e}", exc_info=True)
            return None
    
    def pause_session(self, session_id: str) -> bool:
        """
        Pause an active session
        
        Args:
            session_id: Session identifier
        
        Returns:
            True if paused successfully
        """
        if session_id not in self.active_sessions:
            return False
        
        state = self.active_sessions[session_id]
        if state.is_paused:
            return False
        
        state.is_paused = True
        paused_time = datetime.utcnow()
        # Normalize to naive datetime
        if paused_time.tzinfo is not None:
            paused_time = paused_time.replace(tzinfo=None)
        state.paused_at = paused_time
        self._update_session_in_db(session_id)
        logger.info(f"Session {session_id} paused")
        return True
    
    def resume_session(self, session_id: str) -> bool:
        """
        Resume a paused session
        
        Args:
            session_id: Session identifier
        
        Returns:
            True if resumed successfully
        """
        if session_id not in self.active_sessions:
            return False
        
        state = self.active_sessions[session_id]
        if not state.is_paused:
            return False
        
        # Adjust schedule times by pause duration
        now = datetime.utcnow()
        if now.tzinfo is not None:
            now = now.replace(tzinfo=None)
        pause_duration = now - state.paused_at
        for interval in state.schedule.intervals:
            interval_start = interval.start_time
            if interval_start.tzinfo is not None:
                interval_start = interval_start.replace(tzinfo=None)
            if interval_start >= state.paused_at:
                interval.start_time += pause_duration
                interval.end_time += pause_duration
        
        state.is_paused = False
        state.paused_at = None
        self._update_session_in_db(session_id)
        logger.info(f"Session {session_id} resumed")
        return True
    
    def end_session(
        self,
        session_id: str,
        auto_sync: bool = AUTO_SYNC_ENABLED,
        auto_compute_metrics: bool = AUTO_COMPUTE_METRICS
    ) -> Dict[str, Any]:
        """
        End a session, sync praboth data, and compute metrics
        
        Args:
            session_id: Session identifier
            auto_sync: Whether to automatically sync praboth data
            auto_compute_metrics: Whether to automatically compute metrics
        
        Returns:
            Dictionary with session end results
        """
        if session_id not in self.active_sessions:
            return {'error': 'Session not found'}
        
        state = self.active_sessions[session_id]
        logger.info(f"Ending session {session_id}")
        
        # Update database session
        db_session = self.db_session.query(Session).filter_by(session_id=session_id).first()
        if db_session:
            db_session.end_time = datetime.utcnow()
            db_session.is_active = False  # Mark as inactive
            self.db_session.commit()
        
        # Auto-sync praboth data if enabled
        synced_session_id = None
        sync_error = None
        
        if auto_sync:
            # Try to get praboth session ID if not already set
            praboth_session_id = state.praboth_session_id
            if not praboth_session_id:
                logger.info("Praboth session ID not set, attempting to detect...")
                praboth_session_id = self._get_current_praboth_session_id()
                if praboth_session_id:
                    logger.info(f"Detected praboth session ID: {praboth_session_id}")
            
            if praboth_session_id and self.praboth_adapter:
                try:
                    # Validate that praboth session exists before syncing
                    sessions = self.praboth_adapter.praboth_reader.get_sessions()
                    session_exists = any(s.session_id == praboth_session_id for s in sessions)
                    
                    if not session_exists:
                        logger.warning(f"Praboth session {praboth_session_id} not found in database")
                        sync_error = f"Praboth session {praboth_session_id} not found"
                    else:
                        logger.info(f"Starting sync of praboth session {praboth_session_id}...")
                        synced_session_id = self.praboth_adapter.sync_praboth_session(
                            praboth_session_id=praboth_session_id,
                            user_id=state.user_id,
                            task_type=state.time_block.task_type,
                            chronotype=state.time_block.chronotype,
                            algorithm="LinUCB"
                        )
                        logger.info(f"Successfully synced praboth session {praboth_session_id} -> {synced_session_id}")
                except FileNotFoundError as e:
                    logger.warning(f"Praboth database not found: {e}. Skipping sync.")
                    sync_error = "Praboth database not found"
                except Exception as e:
                    logger.error(f"Failed to sync praboth session: {e}", exc_info=True)
                    sync_error = str(e)
            elif not praboth_session_id:
                logger.warning("No praboth session ID available for syncing")
                sync_error = "No praboth session ID available"
            elif not self.praboth_adapter:
                logger.warning("Praboth adapter not initialized")
                sync_error = "Praboth adapter not initialized"
        
        # Auto-compute metrics if enabled
        metrics = None
        if auto_compute_metrics:
            try:
                calculator = MetricsCalculator(user_id=state.user_id)
                metrics = calculator.compute_all_metrics()
                logger.info(f"Computed metrics for user {state.user_id}")
            except Exception as e:
                logger.error(f"Failed to compute metrics: {e}")
        
        # Stop praboth polling
        if state.praboth_client:
            state.praboth_client.stop_polling()
        
        # Cleanup
        del self.active_sessions[session_id]
        
        # Sanitize metrics to remove Infinity/NaN values for JSON serialization
        metrics_dict = None
        if metrics:
            metrics_dict = sanitize_for_json(metrics.__dict__)
        
        result = {
            'session_id': session_id,
            'synced': synced_session_id is not None,
            'synced_session_id': synced_session_id,
            'metrics_computed': metrics is not None,
            'metrics': metrics_dict,
            'sync_error': sync_error if 'sync_error' in locals() else None
        }
        
        if sync_error:
            logger.warning(f"Session {session_id} ended with sync error: {sync_error}")
        
        return result
    
    def get_next_session_suggestion(
        self,
        user_id: str,
        next_time_block: TimeBlock,
        previous_metrics: Optional[Dict] = None
    ) -> SessionSchedule:
        """
        Generate next session suggestion based on previous metrics
        
        Args:
            user_id: User identifier
            next_time_block: Proposed next time block
            previous_metrics: Metrics from previous sessions
        
        Returns:
            Suggested SessionSchedule
        """
        logger.info(f"Generating next session suggestion for user {user_id}")
        
        # If no previous metrics provided, compute them
        if previous_metrics is None:
            try:
                calculator = MetricsCalculator(user_id=user_id)
                metrics = calculator.compute_all_metrics()
                if metrics:
                    previous_metrics = sanitize_for_json({
                        'PG': metrics.PG,
                        'RPH': metrics.RPH,
                        'AHL': metrics.AHL,
                        'EOI': metrics.EOI,
                        'AUC_BUC': metrics.AUC_BUC,
                        'CTU': metrics.CTU,
                        'SPF_variance': metrics.SPF_variance,
                        'SVR': metrics.SVR,
                    })
            except Exception as e:
                logger.warning(f"Could not compute metrics for suggestion: {e}")
        
        # Create scheduler and generate suggestion
        scheduler = TimeBlockScheduler(algorithm="LinUCB")
        suggestion = scheduler.create_initial_schedule(
            time_block=next_time_block,
            previous_metrics=previous_metrics
        )
        
        return suggestion
    
    def get_session_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current status of a session
        
        Args:
            session_id: Session identifier
        
        Returns:
            Dictionary with session status or None if not found
        """
        if session_id not in self.active_sessions:
            return None
        
        state = self.active_sessions[session_id]
        current_interval = self.get_current_interval(session_id)
        
        status = {
            'session_id': session_id,
            'user_id': state.user_id,
            'start_time': state.session_start_time.isoformat(),
            'current_interval': {
                'index': state.current_interval_index,
                'type': current_interval.interval_type if current_interval else None,
                'start_time': current_interval.start_time.isoformat() if current_interval else None,
                'end_time': current_interval.end_time.isoformat() if current_interval else None,
                'duration_minutes': current_interval.duration_minutes if current_interval else None
            },
            'is_paused': state.is_paused,
            'praboth_session_id': state.praboth_session_id,
            'total_intervals': len(state.schedule.intervals)
        }
        
        return status
    
    def _get_current_praboth_session_id(self) -> Optional[int]:
        """
        Get the current active praboth session ID by querying praboth database
        
        Returns:
            Praboth session ID or None if not available
        """
        try:
            # Try to get the most recent active session from praboth DB
            sessions = self.praboth_adapter.praboth_reader.get_sessions(limit=1)
            if sessions and sessions[0].ended_at is None:
                # Session is still active
                return sessions[0].session_id
            
            # If no active session, try to find session that overlaps with current time
            from datetime import datetime, timedelta
            now = datetime.utcnow()
            recent_sessions = self.praboth_adapter.praboth_reader.get_sessions(
                start_date=now - timedelta(hours=1),
                end_date=now,
                limit=1
            )
            if recent_sessions:
                return recent_sessions[0].session_id
        except Exception as e:
            logger.debug(f"Could not get current praboth session ID: {e}")
        
        return None
    
    def _save_session_to_db(self, state: ActiveSessionState):
        """Save active session state to database"""
        try:
            db_session = self.db_session.query(Session).filter_by(session_id=state.session_id).first()
            if not db_session:
                # Create new session record
                db_session = Session(
                    session_id=state.session_id,
                    user_id=state.user_id,
                    start_time=state.session_start_time,
                    chronotype=state.time_block.chronotype,
                    task_type=state.time_block.task_type,
                    algorithm="LinUCB",
                    is_active=True,
                    praboth_session_id=state.praboth_session_id,
                    current_interval_index=state.current_interval_index,
                    is_paused=state.is_paused,
                    paused_at=state.paused_at,
                    current_cognitive_load=state.current_cognitive_load,
                    schedule_json=json.dumps(state.to_dict(), default=str)
                )
                self.db_session.add(db_session)
            else:
                # Update existing session
                db_session.is_active = True
                db_session.praboth_session_id = state.praboth_session_id
                db_session.current_interval_index = state.current_interval_index
                db_session.is_paused = state.is_paused
                db_session.paused_at = state.paused_at
                db_session.current_cognitive_load = state.current_cognitive_load
                db_session.schedule_json = json.dumps(state.to_dict(), default=str)
                db_session.last_updated = datetime.utcnow()
            
            self.db_session.commit()
        except Exception as e:
            logger.error(f"Failed to save session to DB: {e}", exc_info=True)
            try:
                # Guard against illegal state changes if the transaction is already closed
                if getattr(self.db_session, "is_active", True):
                    self.db_session.rollback()
            except Exception:
                logger.exception("Failed to rollback DB session after error")
    
    def _load_active_sessions(self):
        """Load active sessions from database on startup"""
        try:
            active_db_sessions = self.db_session.query(Session).filter_by(is_active=True).all()
            logger.info(f"Found {len(active_db_sessions)} active sessions in database")
            
            for db_session in active_db_sessions:
                try:
                    # Reconstruct session state from database
                    if db_session.schedule_json:
                        session_data = json.loads(db_session.schedule_json)
                        state = ActiveSessionState.from_dict(session_data)
                        
                        # Recreate components that can't be serialized
                        state.adaptive_scheduler = AdaptiveScheduler(algorithm=db_session.algorithm or "LinUCB")
                        state.feature_extractor = FeatureExtractor(state.session_id)
                        
                        # Recreate praboth client if needed
                        if state.praboth_session_id:
                            state.praboth_client = PrabothRealtimeClient(
                                api_url=self.praboth_api_url,
                                poll_interval=PRABOTH_POLL_INTERVAL
                            )
                            
                            # Restart polling if praboth is available
                            if state.praboth_client.is_service_available():
                                def cognitive_load_callback(cognitive_load: float, estimate: Dict):
                                    if state.session_id in self.active_sessions:
                                        self.active_sessions[state.session_id].current_cognitive_load = cognitive_load
                                
                                state.praboth_client.start_polling(cognitive_load_callback)
                        
                        self.active_sessions[state.session_id] = state
                        logger.info(f"Restored active session {state.session_id}")
                    else:
                        # Session exists but no state data - mark as inactive
                        db_session.is_active = False
                        self.db_session.commit()
                        logger.warning(f"Session {db_session.session_id} has no state data, marking as inactive")
                except Exception as e:
                    logger.error(f"Failed to restore session {db_session.session_id}: {e}", exc_info=True)
                    # Mark as inactive if restoration fails
                    db_session.is_active = False
                    self.db_session.commit()
        except Exception as e:
            logger.error(f"Failed to load active sessions: {e}", exc_info=True)
    
    def _update_session_in_db(self, session_id: str):
        """Update session state in database"""
        if session_id in self.active_sessions:
            self._save_session_to_db(self.active_sessions[session_id])
    
    def __del__(self):
        """Cleanup"""
        if hasattr(self, 'db_session'):
            self.db_session.close()

