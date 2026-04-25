"""
Workflow Orchestrator - Manages the continuous loop of sessions, syncing, metrics, and suggestions
"""
import logging
from datetime import datetime
from typing import Optional, Callable, Dict, Any
from enum import Enum

from src.session_manager.unified_session_manager import UnifiedSessionManager
from src.scheduling.time_block_scheduler import TimeBlock, SessionSchedule

logger = logging.getLogger(__name__)


class WorkflowState(Enum):
    """Workflow state"""
    IDLE = "idle"
    SESSION_ACTIVE = "session_active"
    SYNCING = "syncing"
    COMPUTING_METRICS = "computing_metrics"
    GENERATING_SUGGESTION = "generating_suggestion"
    STOPPED = "stopped"


class WorkflowOrchestrator:
    """
    Orchestrates the continuous workflow:
    session → sync → metrics → suggestion → next session
    """
    
    def __init__(self, unified_manager: Optional[UnifiedSessionManager] = None):
        """
        Initialize workflow orchestrator
        
        Args:
            unified_manager: UnifiedSessionManager instance (creates new if None)
        """
        self.unified_manager = unified_manager or UnifiedSessionManager()
        self.state = WorkflowState.IDLE
        self.current_session_id: Optional[str] = None
        self.current_user_id: Optional[str] = None
        self.on_state_change: Optional[Callable[[WorkflowState, Dict], None]] = None
        self.on_suggestion_ready: Optional[Callable[[SessionSchedule, Dict], None]] = None
        self._stop_requested = False
    
    def start_session_workflow(
        self,
        time_block: TimeBlock,
        user_id: str,
        algorithm: str = "LinUCB",
        previous_metrics: Optional[Dict] = None
    ) -> str:
        """
        Start a new session workflow
        
        Args:
            time_block: User-specified time block
            user_id: User identifier
            algorithm: Bandit algorithm
            previous_metrics: Metrics from previous sessions
        
        Returns:
            Session ID
        """
        if self.state != WorkflowState.IDLE:
            raise RuntimeError(f"Cannot start session: workflow is in {self.state.value} state")
        
        logger.info(f"Starting session workflow for user {user_id}")
        self._set_state(WorkflowState.SESSION_ACTIVE)
        
        try:
            session_id, schedule = self.unified_manager.start_time_block_session(
                time_block=time_block,
                user_id=user_id,
                algorithm=algorithm,
                previous_metrics=previous_metrics
            )
            
            self.current_session_id = session_id
            self.current_user_id = user_id
            
            logger.info(f"Session {session_id} started with {len(schedule.intervals)} intervals")
            return session_id
        except Exception as e:
            self._set_state(WorkflowState.IDLE)
            logger.error(f"Failed to start session: {e}")
            raise
    
    def end_session_workflow(
        self,
        session_id: Optional[str] = None,
        auto_sync: bool = True,
        auto_compute_metrics: bool = True,
        auto_generate_suggestion: bool = True
    ) -> Dict[str, Any]:
        """
        End current session and proceed with sync → metrics → suggestion
        
        Args:
            session_id: Session ID (uses current if None)
            auto_sync: Whether to auto-sync praboth data
            auto_compute_metrics: Whether to auto-compute metrics
            auto_generate_suggestion: Whether to auto-generate next suggestion
        
        Returns:
            Dictionary with workflow results
        """
        if self.state != WorkflowState.SESSION_ACTIVE:
            raise RuntimeError(f"Cannot end session: workflow is in {self.state.value} state")
        
        session_id = session_id or self.current_session_id
        if not session_id:
            raise ValueError("No session ID provided or current")
        
        logger.info(f"Ending session workflow for session {session_id}")
        
        # End session (includes auto-sync and metrics if enabled)
        self._set_state(WorkflowState.SYNCING)
        result = self.unified_manager.end_session(
            session_id=session_id,
            auto_sync=auto_sync,
            auto_compute_metrics=auto_compute_metrics
        )
        
        if 'error' in result:
            self._set_state(WorkflowState.IDLE)
            return result
        
        # Compute metrics if not already done
        metrics = result.get('metrics')
        if auto_compute_metrics and not metrics:
            self._set_state(WorkflowState.COMPUTING_METRICS)
            try:
                from src.metrics.metrics_calculator import MetricsCalculator
                calculator = MetricsCalculator(user_id=self.current_user_id)
                metrics_obj = calculator.compute_all_metrics()
                if metrics_obj:
                    metrics = metrics_obj.__dict__
                    result['metrics'] = metrics
            except Exception as e:
                logger.error(f"Failed to compute metrics: {e}")
        
        # Generate suggestion if requested
        suggestion = None
        if auto_generate_suggestion and self.current_user_id:
            self._set_state(WorkflowState.GENERATING_SUGGESTION)
            try:
                # For suggestion, we need a next time block
                # This would typically come from user input
                # For now, we'll return the metrics and let the caller request suggestion separately
                pass
            except Exception as e:
                logger.error(f"Failed to generate suggestion: {e}")
        
        self.current_session_id = None
        self._set_state(WorkflowState.IDLE)
        
        return result
    
    def generate_next_suggestion(
        self,
        next_time_block: TimeBlock,
        user_id: Optional[str] = None
    ) -> SessionSchedule:
        """
        Generate next session suggestion based on previous metrics
        
        Args:
            next_time_block: Proposed next time block
            user_id: User ID (uses current if None)
        
        Returns:
            Suggested SessionSchedule
        """
        user_id = user_id or self.current_user_id
        if not user_id:
            raise ValueError("No user ID provided or current")
        
        logger.info(f"Generating next session suggestion for user {user_id}")
        
        self._set_state(WorkflowState.GENERATING_SUGGESTION)
        
        try:
            suggestion = self.unified_manager.get_next_session_suggestion(
                user_id=user_id,
                next_time_block=next_time_block
            )
            
            # Notify callback if set
            if self.on_suggestion_ready:
                try:
                    metrics = None
                    try:
                        from src.metrics.metrics_calculator import MetricsCalculator
                        calculator = MetricsCalculator(user_id=user_id)
                        metrics_obj = calculator.compute_all_metrics()
                        if metrics_obj:
                            metrics = metrics_obj.__dict__
                    except:
                        pass
                    
                    self.on_suggestion_ready(suggestion, metrics or {})
                except Exception as e:
                    logger.error(f"Error in suggestion callback: {e}")
            
            self._set_state(WorkflowState.IDLE)
            return suggestion
        except Exception as e:
            self._set_state(WorkflowState.IDLE)
            logger.error(f"Failed to generate suggestion: {e}")
            raise
    
    def get_current_status(self) -> Dict[str, Any]:
        """
        Get current workflow status
        
        Returns:
            Dictionary with workflow status
        """
        status = {
            'state': self.state.value,
            'current_session_id': self.current_session_id,
            'current_user_id': self.current_user_id,
            'stop_requested': self._stop_requested
        }
        
        # Add session status if active
        if self.current_session_id:
            session_status = self.unified_manager.get_session_status(self.current_session_id)
            if session_status:
                status['session_status'] = session_status
        
        return status
    
    def pause_current_session(self) -> bool:
        """Pause current session"""
        if not self.current_session_id:
            return False
        
        return self.unified_manager.pause_session(self.current_session_id)
    
    def resume_current_session(self) -> bool:
        """Resume current session"""
        if not self.current_session_id:
            return False
        
        return self.unified_manager.resume_session(self.current_session_id)
    
    def get_current_recommendation(self) -> Optional[Dict[str, Any]]:
        """Get real-time recommendation for current session"""
        if not self.current_session_id:
            return None
        
        return self.unified_manager.get_recommendation(self.current_session_id)
    
    def stop(self):
        """Stop the workflow"""
        self._stop_requested = True
        
        if self.current_session_id:
            try:
                self.unified_manager.end_session(self.current_session_id, auto_sync=False, auto_compute_metrics=False)
            except:
                pass
        
        self.current_session_id = None
        self.current_user_id = None
        self._set_state(WorkflowState.STOPPED)
        logger.info("Workflow stopped")
    
    def _set_state(self, new_state: WorkflowState):
        """Set workflow state and notify callback"""
        old_state = self.state
        self.state = new_state
        
        if old_state != new_state:
            logger.debug(f"Workflow state changed: {old_state.value} -> {new_state.value}")
            
            if self.on_state_change:
                try:
                    self.on_state_change(new_state, {
                        'old_state': old_state.value,
                        'new_state': new_state.value,
                        'session_id': self.current_session_id,
                        'user_id': self.current_user_id
                    })
                except Exception as e:
                    logger.error(f"Error in state change callback: {e}")

