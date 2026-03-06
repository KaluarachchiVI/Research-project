"""
Adapter to integrate praboth real session data with adaptive scheduler metrics.
Maps praboth data format to adaptive scheduler database format.
"""
from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session as SQLSession
import logging

from src.data_integration.praboth_reader import PrabothDataReader
from src.database.models import (
    Session, Action, Reward, ContextVector, MicroEMA,
    get_db, init_db
)
from config.config import WORK_INTERVALS, BREAK_DURATIONS

logger = logging.getLogger(__name__)


class PrabothMetricsAdapter:
    """
    Adapter to sync praboth session data into adaptive scheduler database
    for metrics computation.
    """
    
    def __init__(self, praboth_db_path: Optional[str] = None):
        """
        Initialize adapter
        
        Args:
            praboth_db_path: Path to praboth SQLite database
        """
        self.praboth_reader = PrabothDataReader(praboth_db_path)
        init_db()  # Ensure adaptive scheduler database is initialized
    
    def sync_praboth_session(
        self,
        praboth_session_id: int,
        user_id: str,
        task_type: str = "other",
        chronotype: str = "neutral",
        algorithm: str = "LinUCB"
    ) -> str:
        """
        Sync a praboth session into adaptive scheduler database.
        
        This maps praboth data (feature windows, cognitive load estimates)
        to adaptive scheduler format (sessions, actions, rewards, context vectors).
        
        Args:
            praboth_session_id: Session ID from praboth database
            user_id: User ID for adaptive scheduler
            task_type: Task type
            chronotype: User chronotype
            algorithm: Algorithm used
        
        Returns:
            Adaptive scheduler session_id
        """
        # Get praboth session data
        praboth_data = self.praboth_reader.map_to_adaptive_scheduler_data(
            praboth_session_id, user_id
        )
        
        db = next(get_db())
        
        try:
            # Create adaptive scheduler session
            session = Session(
                # Use praboth session id as string so we have a stable
                # identifier that links back to the CLE run.
                session_id=str(praboth_session_id),
                user_id=user_id,
                start_time=praboth_data['started_at'],
                end_time=praboth_data['ended_at'],
                task_type=task_type,
                chronotype=chronotype,
                algorithm=algorithm
            )
            db.add(session)
            db.flush()  # Get session_id
            
            session_id = session.session_id
            
            # Map feature windows to context vectors and actions
            context_vectors = praboth_data['context_vectors']
            model_states = praboth_data['model_states']
            
            # Create cognitive load lookup from model states
            cognitive_load_by_time = {}
            for state in model_states:
                timestamp_key = state['timestamp'].isoformat()
                cognitive_load_by_time[timestamp_key] = state['cognitive_load']
            
            epoch = 0
            current_work_interval = 30  # Default
            current_break_duration = 5  # Default
            
            # Get EMA responses for this session
            ema_responses = praboth_data.get('ema_responses', [])
            ema_by_time = {r['responded_at']: r for r in ema_responses}
            
            # Get telemetry metrics for quality scores
            telemetry_metrics = self.praboth_reader.get_telemetry_metrics(
                praboth_session_id, metric_type='residual_rms'
            )
            quality_by_time = {}
            for metric in telemetry_metrics:
                metric_time = metric['snapshot_at']
                if metric_time not in quality_by_time:
                    quality_by_time[metric_time] = []
                quality_by_time[metric_time].append(metric['metric_value'])
            
            for i, ctx_vector in enumerate(context_vectors):
                # Use praboth cognitive load directly (more accurate than estimation)
                cognitive_load = ctx_vector.get('cognitive_load', 0.5)
                
                # Find closest model state for more accurate cognitive load
                ctx_time = ctx_vector['timestamp']
                closest_state = None
                min_time_diff = float('inf')
                
                for state in model_states:
                    time_diff = abs((ctx_time - state['timestamp']).total_seconds())
                    if time_diff < min_time_diff and time_diff < 30:  # Within 30 seconds
                        min_time_diff = time_diff
                        closest_state = state
                
                if closest_state:
                    cognitive_load = closest_state['cognitive_load']
                
                # Get quality score from praboth feature window or telemetry
                quality_score = ctx_vector.get('quality_score', 1.0)
                if quality_score is None or quality_score == 0:
                    # Try to get from telemetry
                    for metric_time, values in quality_by_time.items():
                        if abs((metric_time - ctx_time).total_seconds()) < 15:
                            # Use inverse of residual as quality (lower residual = higher quality)
                            avg_residual = sum(values) / len(values) if values else 1.0
                            quality_score = max(0.1, 1.0 - min(avg_residual, 1.0))
                            break
                    if quality_score is None or quality_score == 0:
                        quality_score = 1.0  # Default
                
                # Extract pause count from praboth features if available
                # Praboth feature vector includes idle fraction which can indicate pauses
                pause_count = ctx_vector.get('pause_count', 0)
                if pause_count == 0:
                    # Estimate from idle fraction if available in raw features
                    idle_fraction = ctx_vector.get('idle_fraction', 0.0)
                    if idle_fraction > 0.1:  # Significant idle time
                        # Estimate pause count (rough approximation: idle fraction * window duration / avg pause length)
                        # Assuming 60s windows and ~2s average pause detection threshold
                        pause_count = int(idle_fraction * 30)  # More accurate estimate
                
                # Create context vector with praboth data
                # Normalize timestamps to timezone-naive before computing session duration
                ctx_ts = ctx_vector['timestamp']
                start_ts = praboth_data['started_at']
                if ctx_ts.tzinfo is not None:
                    ctx_ts = ctx_ts.replace(tzinfo=None)
                if start_ts.tzinfo is not None:
                    start_ts = start_ts.replace(tzinfo=None)

                context = ContextVector(
                    session_id=session_id,
                    timestamp=ctx_vector['timestamp'],
                    mean_iki=ctx_vector.get('mean_iki', 0.2),
                    std_iki=ctx_vector.get('std_iki', 0.1),
                    typing_speed=ctx_vector.get('typing_speed', 0.0),
                    correction_ratio=ctx_vector.get('correction_ratio', 0.0),
                    pause_count=pause_count,
                    session_duration=(ctx_ts - start_ts).total_seconds() / 60.0,
                    time_of_day=self._get_time_of_day(ctx_vector['timestamp']),
                    cognitive_load=cognitive_load
                )
                db.add(context)
                db.flush()
                
                # Map EMA responses to MicroEMA if available
                for ema_time, ema_response in ema_by_time.items():
                    if abs((ema_time - ctx_time).total_seconds()) < 60:  # Within 1 minute
                        # Convert praboth EMA rating (1-7) to [0, 1] scale
                        rating = ema_response.get('rating', 4)
                        normalized_rating = (rating - 1) / 6.0  # Convert 1-7 to 0-1
                        
                        micro_ema = MicroEMA(
                            session_id=session_id,
                            timestamp=ema_time,
                            rating=normalized_rating,
                            feedback_text=ema_response.get('note', ''),
                            context_vector_id=context.context_vector_id
                        )
                        db.add(micro_ema)
                        break  # Only map first EMA in this window
                
                # Create actions at work interval boundaries
                # Assume work/break alternation based on cognitive load patterns
                if i % 4 == 0:  # Every 4 windows (~4 minutes) create an action
                    # Determine work/break intervals (simplified - in real system would use bandit)
                    if cognitive_load > 0.7:
                        current_break_duration = min(BREAK_DURATIONS, key=lambda x: abs(x - 8))
                    elif cognitive_load < 0.4:
                        current_work_interval = min(WORK_INTERVALS, key=lambda x: abs(x - 45))
                    
                    action = Action(
                        session_id=session_id,
                        epoch=epoch,
                        work_interval=current_work_interval,
                        break_duration=current_break_duration,
                        context_vector_id=context.context_vector_id,
                        timestamp=ctx_vector['timestamp']
                    )
                    db.add(action)
                    db.flush()
                    
                    # Create reward based on praboth cognitive load and typing patterns
                    # Use praboth data directly for more accurate rewards
                    typing_speed = ctx_vector.get('typing_speed', 0.0)
                    
                    # Task progress component (normalized typing speed, weighted by quality)
                    r_progress = min(1.0, typing_speed / 200.0) if typing_speed > 0 else 0.0
                    r_progress *= quality_score  # Weight by feature quality
                    
                    # Load relief component (use praboth cognitive load directly)
                    # Lower cognitive load = higher relief reward
                    r_relief = max(0.0, 1.0 - cognitive_load)
                    
                    # Incorporate praboth variance/uncertainty if available
                    variance = None
                    if closest_state:
                        variance = closest_state.get('variance', 0.0)
                        # Higher variance = lower confidence, reduce reward slightly
                        confidence_factor = max(0.7, 1.0 - min(variance, 0.3))
                        r_relief *= confidence_factor
                    
                    # Use EMA response if available for reward shaping
                    ema_bonus = 0.0
                    for ema_time, ema_response in ema_by_time.items():
                        if abs((ema_time - ctx_time).total_seconds()) < 60:
                            if ema_response.get('disposition') == 'completed':
                                # Positive EMA response boosts reward
                                rating = ema_response.get('rating', 4)
                                ema_bonus = (rating - 4) / 12.0  # -0.25 to +0.25
                            break
                    
                    # Combined reward with EMA bonus
                    w1, w2 = 0.6, 0.4
                    immediate_reward = w1 * r_progress + w2 * r_relief + ema_bonus
                    immediate_reward = max(-1.0, min(1.0, immediate_reward))  # Clip to [-1, 1]
                    
                    reward = Reward(
                        action_id=action.action_id,
                        immediate_reward=immediate_reward,
                        r_progress=r_progress,
                        r_relief=r_relief,
                        final_reward=immediate_reward
                    )
                    db.add(reward)
                    
                    epoch += 1
            
            db.commit()
            return session_id
            
        except Exception as e:
            db.rollback()
            raise Exception(f"Failed to sync praboth session: {e}")
        finally:
            db.close()
    
    def _get_time_of_day(self, timestamp: datetime) -> int:
        """Get time of day code: 0=morning, 1=afternoon, 2=evening"""
        hour = timestamp.hour
        if hour < 12:
            return 0  # morning
        elif hour < 18:
            return 1  # afternoon
        else:
            return 2  # evening
    
    def sync_all_recent_sessions(
        self,
        user_id: str,
        days_back: int = 7
    ) -> List[str]:
        """
        Sync all recent praboth sessions for a user.
        
        Args:
            user_id: User ID
            days_back: Number of days to look back
        
        Returns:
            List of adaptive scheduler session_ids
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days_back)
        
        praboth_sessions = self.praboth_reader.get_sessions(
            start_date=start_date,
            end_date=end_date
        )
        
        session_ids = []
        for praboth_session in praboth_sessions:
            try:
                session_id = self.sync_praboth_session(
                    praboth_session.session_id,
                    user_id
                )
                session_ids.append(session_id)
            except Exception as e:
                print(f"Failed to sync session {praboth_session.session_id}: {e}")
                continue
        
        return session_ids

