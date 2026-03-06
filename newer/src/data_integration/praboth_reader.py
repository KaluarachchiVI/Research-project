"""
Data reader for integrating with praboth cognitive load estimation service.
Reads real session data from praboth SQLite database.
"""
import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import timedelta

import numpy as np


@dataclass
class PrabothSession:
    """Represents a session from praboth database"""
    session_id: int
    started_at: datetime
    ended_at: Optional[datetime]
    device_label: Optional[str]


@dataclass
class PrabothFeatureWindow:
    """Represents a feature window from praboth"""
    window_id: int
    session_id: int
    hop_index: int
    window_start: datetime
    window_end: datetime
    feature_vector: np.ndarray
    quality_score: Optional[float]
    cognitive_load: Optional[float]  # Extracted from model_state or estimated


@dataclass
class PrabothModelState:
    """Represents cognitive load estimate from praboth"""
    state_id: int
    session_id: int
    captured_at: datetime
    latent_mean: float  # Cognitive load estimate
    latent_variance: float
    weights: np.ndarray


class PrabothDataReader:
    """Reads real session data from praboth SQLite database"""
    
    def __init__(self, db_path: Optional[Path] = None):
        """
        Initialize reader with path to praboth database
        
        Args:
            db_path: Path to praboth state.db file. If None, searches common locations.
        """
        if db_path is None:
            # Try to find praboth database in common locations
            possible_paths = [
                Path("praboth/cog_py_est/data/state.db"),
                Path("praboth/data/state.db"),
                Path("../praboth/cog_py_est/data/state.db"),
                Path("../../praboth/cog_py_est/data/state.db"),
            ]
            db_path = None
            for path in possible_paths:
                if path.exists():
                    db_path = path
                    break
            
            if db_path is None:
                raise FileNotFoundError(
                    "Could not find praboth database. Please specify db_path. "
                    "Common locations: praboth/cog_py_est/data/state.db"
                )
        
        self.db_path = Path(db_path)
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found: {self.db_path}")
    
    def get_connection(self) -> sqlite3.Connection:
        """Get SQLite connection to praboth database"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row  # Enable column access by name
        return conn
    
    def get_sessions(
        self, 
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> List[PrabothSession]:
        """
        Get all sessions from praboth database
        
        Args:
            start_date: Filter sessions starting after this date
            end_date: Filter sessions starting before this date
            limit: Maximum number of sessions to return
        
        Returns:
            List of PrabothSession objects
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = "SELECT session_id, started_at, ended_at, device_label FROM sessions WHERE 1=1"
        params = []
        
        if start_date:
            query += " AND started_at >= ?"
            params.append(start_date.isoformat())
        
        if end_date:
            query += " AND started_at <= ?"
            params.append(end_date.isoformat())
        
        query += " ORDER BY started_at DESC"
        
        if limit:
            query += " LIMIT ?"
            params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        sessions = []
        for row in rows:
            sessions.append(PrabothSession(
                session_id=row['session_id'],
                started_at=datetime.fromisoformat(row['started_at']),
                ended_at=datetime.fromisoformat(row['ended_at']) if row['ended_at'] else None,
                device_label=row['device_label']
            ))
        
        return sessions
    
    def get_feature_windows(
        self, 
        session_id: int
    ) -> List[PrabothFeatureWindow]:
        """
        Get all feature windows for a session
        
        Args:
            session_id: Session ID from praboth database
        
        Returns:
            List of PrabothFeatureWindow objects
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Get feature windows
        cursor.execute("""
            SELECT window_id, session_id, hop_index, window_start, window_end,
                   feature_vector_json, quality_score
            FROM feature_windows
            WHERE session_id = ?
            ORDER BY hop_index ASC
        """, (session_id,))
        
        rows = cursor.fetchall()
        
        # Get cognitive load estimates from model_state
        cursor.execute("""
            SELECT captured_at, latent_mean, latent_variance
            FROM model_state
            WHERE session_id = ?
            ORDER BY captured_at ASC
        """, (session_id,))
        
        model_states = cursor.fetchall()
        conn.close()
        
        # Map model states to windows by timestamp
        windows = []
        for row in rows:
            window_start = datetime.fromisoformat(row['window_start'])
            window_end = datetime.fromisoformat(row['window_end'])
            
            # Find closest model state
            cognitive_load = None
            for state in model_states:
                state_time = datetime.fromisoformat(state['captured_at'])
                if window_start <= state_time <= window_end:
                    cognitive_load = state['latent_mean']
                    break
            
            # Parse feature vector
            try:
                feature_vector = np.array(json.loads(row['feature_vector_json']))
            except:
                feature_vector = np.array([])
            
            windows.append(PrabothFeatureWindow(
                window_id=row['window_id'],
                session_id=row['session_id'],
                hop_index=row['hop_index'],
                window_start=window_start,
                window_end=window_end,
                feature_vector=feature_vector,
                quality_score=row['quality_score'],
                cognitive_load=cognitive_load
            ))
        
        return windows
    
    def get_model_states(
        self, 
        session_id: int
    ) -> List[PrabothModelState]:
        """
        Get all model states (cognitive load estimates) for a session
        
        Args:
            session_id: Session ID from praboth database
        
        Returns:
            List of PrabothModelState objects
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT state_id, session_id, captured_at, latent_mean, latent_variance, weights_json
            FROM model_state
            WHERE session_id = ?
            ORDER BY captured_at ASC
        """, (session_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        states = []
        for row in rows:
            try:
                weights = np.array(json.loads(row['weights_json']))
            except:
                weights = np.array([])
            
            states.append(PrabothModelState(
                state_id=row['state_id'],
                session_id=row['session_id'],
                captured_at=datetime.fromisoformat(row['captured_at']),
                latent_mean=row['latent_mean'],
                latent_variance=row['latent_variance'],
                weights=weights
            ))
        
        return states
    
    def get_ema_responses(
        self, 
        session_id: int
    ) -> List[Dict]:
        """
        Get EMA (Ecological Momentary Assessment) responses for a session
        
        Args:
            session_id: Session ID from praboth database
        
        Returns:
            List of EMA response dictionaries
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT r.response_id, r.responded_at, r.rating, r.disposition, r.note,
                   p.issued_at, p.trigger_reason
            FROM ema_responses r
            JOIN ema_prompts p ON r.prompt_id = p.prompt_id
            WHERE p.session_id = ?
            ORDER BY r.responded_at ASC
        """, (session_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        responses = []
        for row in rows:
            responses.append({
                'response_id': row['response_id'],
                'responded_at': datetime.fromisoformat(row['responded_at']),
                'rating': row['rating'],
                'disposition': row['disposition'],
                'note': row['note'],
                'issued_at': datetime.fromisoformat(row['issued_at']),
                'trigger_reason': row['trigger_reason']
            })
        
        return responses
    
    def get_telemetry_metrics(
        self, 
        session_id: int,
        metric_type: Optional[str] = None
    ) -> List[Dict]:
        """
        Get telemetry metrics for a session
        
        Args:
            session_id: Session ID from praboth database
            metric_type: Optional filter for specific metric type
        
        Returns:
            List of telemetry metric dictionaries
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT metric_id, snapshot_at, metric_type, metric_value, metadata_json
            FROM telemetry_metrics
            WHERE session_id = ?
        """
        params = [session_id]
        
        if metric_type:
            query += " AND metric_type = ?"
            params.append(metric_type)
        
        query += " ORDER BY snapshot_at ASC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        metrics = []
        for row in rows:
            metadata = {}
            if row['metadata_json']:
                try:
                    metadata = json.loads(row['metadata_json'])
                except:
                    pass
            
            metrics.append({
                'metric_id': row['metric_id'],
                'snapshot_at': datetime.fromisoformat(row['snapshot_at']),
                'metric_type': row['metric_type'],
                'metric_value': row['metric_value'],
                'metadata': metadata
            })
        
        return metrics
    
    def map_to_adaptive_scheduler_data(
        self, 
        praboth_session_id: int,
        user_id: str
    ) -> Dict:
        """
        Map praboth session data to adaptive scheduler format
        
        This converts praboth data (feature windows, cognitive load estimates)
        into a format compatible with the adaptive scheduler metrics system.
        
        Args:
            praboth_session_id: Session ID from praboth
            user_id: User ID for adaptive scheduler
        
        Returns:
            Dictionary with mapped data ready for adaptive scheduler
        """
        session = None
        sessions = self.get_sessions()
        for s in sessions:
            if s.session_id == praboth_session_id:
                session = s
                break
        
        if not session:
            raise ValueError(f"Session {praboth_session_id} not found")
        
        windows = self.get_feature_windows(praboth_session_id)
        model_states = self.get_model_states(praboth_session_id)
        ema_responses = self.get_ema_responses(praboth_session_id)
        
        # Map feature windows to context vectors
        # Praboth feature vector format (10-dim): 
        # [keystrokes, iki_mean_ms, iki_std_ms, error_rate, backspace_rate,
        #  pointer_events, pointer_speed_mean, pointer_speed_std, pointer_accel_mean, idle_fraction]
        context_vectors = []
        for window in windows:
            # Extract features from feature vector
            if len(window.feature_vector) >= 10:
                # Full feature vector available
                context_vectors.append({
                    'timestamp': window.window_start,
                    'mean_iki': float(window.feature_vector[1]) / 1000.0 if len(window.feature_vector) > 1 else 0.2,  # Convert ms to seconds
                    'std_iki': float(window.feature_vector[2]) / 1000.0 if len(window.feature_vector) > 2 else 0.1,  # Convert ms to seconds
                    'typing_speed': float(window.feature_vector[0]) * 60.0 if len(window.feature_vector) > 0 else 0.0,  # keystrokes per minute
                    'correction_ratio': float(window.feature_vector[4]) if len(window.feature_vector) > 4 else 0.0,  # backspace_rate
                    'cognitive_load': window.cognitive_load if window.cognitive_load is not None else 0.5,
                    'quality_score': window.quality_score if window.quality_score is not None else 1.0,
                    'idle_fraction': float(window.feature_vector[9]) if len(window.feature_vector) > 9 else 0.0,
                    'error_rate': float(window.feature_vector[3]) if len(window.feature_vector) > 3 else 0.0,
                    'pause_count': 0,  # Will be estimated from idle_fraction
                })
            elif len(window.feature_vector) >= 4:
                # Partial feature vector (backward compatibility)
                context_vectors.append({
                    'timestamp': window.window_start,
                    'mean_iki': float(window.feature_vector[0]) if len(window.feature_vector) > 0 else 0.2,
                    'std_iki': float(window.feature_vector[1]) if len(window.feature_vector) > 1 else 0.1,
                    'typing_speed': float(window.feature_vector[2]) if len(window.feature_vector) > 2 else 0.0,
                    'correction_ratio': float(window.feature_vector[3]) if len(window.feature_vector) > 3 else 0.0,
                    'cognitive_load': window.cognitive_load if window.cognitive_load is not None else 0.5,
                    'quality_score': window.quality_score if window.quality_score is not None else 1.0,
                    'idle_fraction': 0.0,
                    'error_rate': 0.0,
                    'pause_count': 0,
                })
        
        return {
            'user_id': user_id,
            'praboth_session_id': praboth_session_id,
            'started_at': session.started_at,
            'ended_at': session.ended_at,
            'context_vectors': context_vectors,
            'model_states': [
                {
                    'timestamp': s.captured_at,
                    'cognitive_load': s.latent_mean,
                    'variance': s.latent_variance
                }
                for s in model_states
            ],
            'ema_responses': ema_responses
        }
    
    def get_current_active_session(self) -> Optional[PrabothSession]:
        """
        Get the current active praboth session (not ended)
        
        Returns:
            Active PrabothSession or None if no active session
        """
        sessions = self.get_sessions(limit=10)
        for session in sessions:
            if session.ended_at is None:
                return session
        return None
    
    def find_session_by_time_range(
        self,
        start_time: datetime,
        end_time: datetime,
        tolerance_minutes: int = 5
    ) -> Optional[PrabothSession]:
        """
        Find praboth session that overlaps with given time range
        
        Args:
            start_time: Start of time range
            end_time: End of time range
            tolerance_minutes: Tolerance for matching (minutes)
        
        Returns:
            Matching PrabothSession or None
        """
        tolerance = timedelta(minutes=tolerance_minutes)
        sessions = self.get_sessions(
            start_date=start_time - tolerance,
            end_date=end_time + tolerance
        )
        
        for session in sessions:
            # Check if sessions overlap
            session_start = session.started_at
            session_end = session.ended_at or datetime.utcnow()
            
            # Check overlap
            if (session_start <= end_time and session_end >= start_time):
                return session
        
        return None
    
    def session_overlaps_with_adaptive_scheduler(
        self,
        praboth_session_id: int,
        adaptive_start: datetime,
        adaptive_end: datetime
    ) -> bool:
        """
        Check if praboth session overlaps with adaptive scheduler session
        
        Args:
            praboth_session_id: Praboth session ID
            adaptive_start: Adaptive scheduler session start time
            adaptive_end: Adaptive scheduler session end time
        
        Returns:
            True if sessions overlap
        """
        sessions = self.get_sessions()
        for session in sessions:
            if session.session_id == praboth_session_id:
                session_start = session.started_at
                session_end = session.ended_at or datetime.utcnow()
                
                # Check overlap
                return (session_start <= adaptive_end and session_end >= adaptive_start)
        
        return False
    
    def get_recent_events(self, limit: int = 50) -> List[Dict]:
        """
        Get recent input events from praboth database
        
        Args:
            limit: Maximum number of events to return
        
        Returns:
            List of event dictionaries
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                event_id,
                session_id,
                source,
                payload_json,
                occurred_at
            FROM input_events
            ORDER BY event_id DESC
            LIMIT ?
        """, (limit,))
        
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
            except Exception as e:
                logger.debug(f"Error parsing event {row['event_id']}: {e}")
        
        return events

