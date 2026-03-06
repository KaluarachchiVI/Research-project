"""
Session State - Persistent storage for active session information
"""
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import Column, String, Text, DateTime, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from config.config import DATABASE_URL

logger = logging.getLogger(__name__)

Base = declarative_base()


class ActiveSession(Base):
    """Database model for active session state"""
    __tablename__ = "active_sessions"
    
    session_id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    state_json = Column(Text, nullable=False)  # JSON serialized state
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SessionState:
    """
    Manages persistent session state storage
    """
    
    def __init__(self):
        """Initialize session state manager"""
        self.engine = create_engine(DATABASE_URL)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
    
    def save_session_state(self, session_id: str, user_id: str, state: Dict[str, Any]) -> bool:
        """
        Save active session state to database
        
        Args:
            session_id: Session identifier
            user_id: User identifier
            state: State dictionary to save
        
        Returns:
            True if saved successfully
        """
        try:
            db = self.SessionLocal()
            state_json = json.dumps(state, default=str)
            
            # Check if exists
            existing = db.query(ActiveSession).filter_by(session_id=session_id).first()
            
            if existing:
                existing.state_json = state_json
                existing.updated_at = datetime.utcnow()
            else:
                active_session = ActiveSession(
                    session_id=session_id,
                    user_id=user_id,
                    state_json=state_json
                )
                db.add(active_session)
            
            db.commit()
            db.close()
            logger.debug(f"Saved session state for {session_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to save session state: {e}")
            return False
    
    def load_session_state(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Load active session state from database
        
        Args:
            session_id: Session identifier
        
        Returns:
            State dictionary or None if not found
        """
        try:
            db = self.SessionLocal()
            active_session = db.query(ActiveSession).filter_by(session_id=session_id).first()
            db.close()
            
            if active_session:
                state = json.loads(active_session.state_json)
                logger.debug(f"Loaded session state for {session_id}")
                return state
            return None
        except Exception as e:
            logger.error(f"Failed to load session state: {e}")
            return None
    
    def delete_session_state(self, session_id: str) -> bool:
        """
        Delete active session state from database
        
        Args:
            session_id: Session identifier
        
        Returns:
            True if deleted successfully
        """
        try:
            db = self.SessionLocal()
            active_session = db.query(ActiveSession).filter_by(session_id=session_id).first()
            
            if active_session:
                db.delete(active_session)
                db.commit()
                logger.debug(f"Deleted session state for {session_id}")
            
            db.close()
            return True
        except Exception as e:
            logger.error(f"Failed to delete session state: {e}")
            return False
    
    def list_active_sessions(self, user_id: Optional[str] = None) -> list[Dict[str, Any]]:
        """
        List all active sessions
        
        Args:
            user_id: Optional filter by user ID
        
        Returns:
            List of session state dictionaries
        """
        try:
            db = self.SessionLocal()
            query = db.query(ActiveSession)
            
            if user_id:
                query = query.filter_by(user_id=user_id)
            
            active_sessions = query.all()
            db.close()
            
            sessions = []
            for active_session in active_sessions:
                try:
                    state = json.loads(active_session.state_json)
                    sessions.append({
                        'session_id': active_session.session_id,
                        'user_id': active_session.user_id,
                        'created_at': active_session.created_at.isoformat(),
                        'updated_at': active_session.updated_at.isoformat(),
                        'state': state
                    })
                except Exception as e:
                    logger.error(f"Failed to parse state for session {active_session.session_id}: {e}")
            
            return sessions
        except Exception as e:
            logger.error(f"Failed to list active sessions: {e}")
            return []
    
    def cleanup_old_sessions(self, days_old: int = 1) -> int:
        """
        Clean up old session states
        
        Args:
            days_old: Delete sessions older than this many days
        
        Returns:
            Number of sessions deleted
        """
        try:
            from datetime import timedelta
            cutoff = datetime.utcnow() - timedelta(days=days_old)
            
            db = self.SessionLocal()
            deleted = db.query(ActiveSession).filter(
                ActiveSession.updated_at < cutoff
            ).delete()
            db.commit()
            db.close()
            
            logger.info(f"Cleaned up {deleted} old session states")
            return deleted
        except Exception as e:
            logger.error(f"Failed to cleanup old sessions: {e}")
            return 0

