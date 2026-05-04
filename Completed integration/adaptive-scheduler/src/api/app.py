"""Flask API application for Adaptive Scheduler"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import uuid
import json
import logging
from datetime import datetime
import math
from typing import Dict, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

from src.database.models import (
    init_db,
    get_db,
    Session,
    Action,
    Reward,
    ContextVector,
    IntentLockEvent,
    SessionLocal,
)
from src.context_logger.context_logger import ContextLogger
from src.feature_extractor.feature_extractor import FeatureExtractor
from src.bandit_engine.adaptive_scheduler import AdaptiveScheduler
from src.reward_handler.reward_calculator import RewardCalculator, DelayedRewardTracker
from src.api.metrics_endpoint import metrics_bp
from src.api.auth_routes import auth_bp
from src.session_manager.unified_session_manager import UnifiedSessionManager
from src.scheduling.time_block_scheduler import TimeBlock
from src.data_integration.praboth_reader import PrabothDataReader
from src.session_manager.praboth_realtime_client import PrabothRealtimeClient
from config.config import API_HOST, API_PORT, API_DEBUG, PRABOTH_API_URL

# Get project root for static files
PROJECT_ROOT = Path(__file__).parent.parent.parent
STATIC_DIR = PROJECT_ROOT / "static"

app = Flask(__name__, static_folder=str(STATIC_DIR))
CORS(app)

# Register blueprints
app.register_blueprint(metrics_bp)
app.register_blueprint(auth_bp)

# Initialize database
init_db()

# Global state (in production, use proper session management)
active_sessions: Dict[str, Dict] = {}
schedulers: Dict[str, AdaptiveScheduler] = {}
context_loggers: Dict[str, ContextLogger] = {}
feature_extractors: Dict[str, FeatureExtractor] = {}
reward_calculators: Dict[str, RewardCalculator] = {}
delayed_trackers: Dict[str, DelayedRewardTracker] = {}

# Unified session manager
unified_manager = UnifiedSessionManager()


@app.route('/', methods=['GET'])
def root():
    """Root endpoint - API information"""
    return jsonify({
        'name': 'Adaptive Scheduler API',
        'version': '1.0.0',
        'description': 'Contextual bandit-based adaptive study timer',
        'endpoints': {
            'root': '/',
            'api_base': '/api',
            'health': '/api/health',
            'start_session': '/api/start-session (POST)',
            'get_recommendation': '/api/get-recommendation (GET)',
            'end_interval': '/api/end-interval (POST)',
            'submit_feedback': '/api/submit-feedback (POST)',
            'end_session': '/api/end-session (POST)',
            'metrics': '/api/metrics (GET)'
        },
        'documentation': 'See README.md and GUIDE.md for detailed API documentation'
    }), 200


@app.route('/api', methods=['GET'])
def api_root():
    """API root endpoint - lists all available endpoints"""
    return jsonify({
        'message': 'Adaptive Scheduler API',
        'available_endpoints': [
            {
                'path': '/api/health',
                'method': 'GET',
                'description': 'Health check endpoint'
            },
            {
                'path': '/api/start-session',
                'method': 'POST',
                'description': 'Start a new study session',
                'required_params': ['user_id'],
                'optional_params': ['task_type', 'chronotype', 'algorithm']
            },
            {
                'path': '/api/get-recommendation',
                'method': 'GET',
                'description': 'Get work/break recommendation',
                'required_params': ['session_id']
            },
            {
                'path': '/api/end-interval',
                'method': 'POST',
                'description': 'End a work or break interval and compute reward',
                'required_params': ['session_id', 'interval_type'],
                'optional_params': ['metrics']
            },
            {
                'path': '/api/submit-feedback',
                'method': 'POST',
                'description': 'Submit micro-EMA feedback',
                'required_params': ['session_id', 'fatigue_level', 'focus_level', 'satisfaction']
            },
            {
                'path': '/api/end-session',
                'method': 'POST',
                'description': 'End a study session',
                'required_params': ['session_id']
            },
            {
                'path': '/api/metrics',
                'method': 'GET',
                'description': 'Get computed metrics (PG, RPH, AHL, etc.)',
                'required_params': ['user_id'],
                'optional_params': ['start_date', 'end_date']
            }
        ]
    }), 200


@app.route('/api/start-session', methods=['POST'])
def start_session():
    """Start a new study session"""
    data = request.json
    user_id = data.get('user_id')
    task_type = data.get('task_type', 'other')
    chronotype = data.get('chronotype', 'neutral')
    algorithm = data.get('algorithm', 'LinUCB')
    
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    
    # Initialize context logger
    context_logger = ContextLogger(user_id, chronotype, task_type)
    session_metadata = context_logger.start_session()
    session_id = session_metadata.session_id
    
    # Initialize feature extractor
    feature_extractor = FeatureExtractor(session_id)
    
    # Initialize scheduler
    scheduler = AdaptiveScheduler(algorithm=algorithm)
    
    # Initialize reward calculator
    reward_calculator = RewardCalculator()
    delayed_tracker = DelayedRewardTracker()
    
    # Store in global state
    active_sessions[session_id] = {
        'user_id': user_id,
        'start_time': session_metadata.start_time.isoformat(),
        'task_type': task_type,
        'chronotype': chronotype,
        'algorithm': algorithm,
        'epoch': 0
    }
    context_loggers[session_id] = context_logger
    feature_extractors[session_id] = feature_extractor
    schedulers[session_id] = scheduler
    reward_calculators[session_id] = reward_calculator
    delayed_trackers[session_id] = delayed_tracker
    
    # Get initial recommendation
    context_features = feature_extractor.extract_features()
    action, metadata = scheduler.get_recommendation(context_features)
    
    # Save initial action to database (epoch 0)
    db = next(get_db())
    initial_action = Action(
        session_id=session_id,
        epoch=0,
        work_interval=action[0],
        break_duration=action[1],
        context_vector_id=None,
        bandit_algorithm=metadata['algorithm'],
        safety_override=metadata['was_overridden'],
        override_reason=metadata.get('override_reason')
    )
    db.add(initial_action)
    db.commit()
    
    return jsonify({
        'session_id': session_id,
        'initial_action': {
            'work_interval': action[0],
            'break_duration': action[1]
        },
        'metadata': metadata
    }), 200


@app.route('/api/get-recommendation', methods=['GET'])
def get_recommendation():
    """Get work/break recommendation"""
    session_id = request.args.get('session_id')
    
    if not session_id or session_id not in active_sessions:
        return jsonify({'error': 'Invalid session_id'}), 400
    
    feature_extractor = feature_extractors[session_id]
    scheduler = schedulers[session_id]
    
    # Extract current context
    context_features = feature_extractor.extract_features()
    feature_extractor.save_features_to_db(context_features)
    
    # Get recommendation
    action, metadata = scheduler.get_recommendation(context_features)
    
    # Log recommendation for debugging
    print(f"[get-recommendation] Session {session_id[:8]}... | Load: {context_features.cognitive_load:.2f} | "
          f"Recommendation: {action[0]}min work, {action[1]}min break")
    
    return jsonify({
        'work_interval': action[0],
        'break_duration': action[1],
        'explanation': metadata.get('override_reason', 
            f'Recommended by {metadata["algorithm"]} based on cognitive load: {metadata["cognitive_load"]:.2f}'),
        'confidence': metadata['confidence'],
        'was_overridden': metadata['was_overridden'],
        'algorithm': metadata.get('algorithm', 'Unknown'),
        'cognitive_load': metadata.get('cognitive_load', 0.5)
    }), 200


@app.route('/api/end-interval', methods=['POST'])
def end_interval():
    """End a work or break interval and compute reward"""
    data = request.json
    session_id = data.get('session_id')
    interval_type = data.get('interval_type')  # 'work' or 'break'
    metrics = data.get('metrics', {})
    
    if not session_id:
        return jsonify({'error': 'session_id is required'}), 400
    
    if interval_type not in ['work', 'break']:
        return jsonify({'error': 'interval_type must be "work" or "break"'}), 400
    
    # Check if session is in unified session manager (new system)
    # If not in memory, try loading from database
    if session_id not in unified_manager.active_sessions:
        try:
            db = next(get_db())
            db_session = db.query(Session).filter_by(session_id=session_id, is_active=True).first()
            if db_session:
                # Reload active sessions from database
                unified_manager._load_active_sessions()
                # Check again after reload
                if session_id not in unified_manager.active_sessions:
                    return jsonify({
                        'error': f'Session {session_id} exists in database but could not be restored. Please start a new session.',
                        'session_id': session_id,
                        'available_sessions': list(unified_manager.active_sessions.keys())
                    }), 200  # Return 200 with error message so dashboard can handle it
        except Exception as e:
            import logging
            logging.error(f"Error loading session from database: {e}", exc_info=True)
            # Continue to check if session exists in old system
    
    if session_id in unified_manager.active_sessions:
        # Use unified session manager approach
        state = unified_manager.active_sessions[session_id]
        
        if not state.adaptive_scheduler or not state.feature_extractor:
            return jsonify({'error': 'Session components not initialized'}), 400
        
        # Get current recommendation which will compute reward internally
        recommendation = unified_manager.get_recommendation(session_id)
        if not recommendation:
            return jsonify({'error': 'Could not get recommendation'}), 500
        
        # Get current interval
        current_interval = unified_manager.get_current_interval(session_id)
        if not current_interval:
            return jsonify({'error': 'No current interval found'}), 400
        
        return jsonify({
            'status': 'interval_ended',
            'interval_type': interval_type,
            'next_recommendation': recommendation,
            'current_interval': {
                'type': current_interval.interval_type,
                'duration_minutes': current_interval.duration_minutes
            }
        }), 200
    
    # Fallback to old session management system
    if session_id not in active_sessions:
        return jsonify({'error': 'Invalid session_id. Session not found in active sessions.'}), 400
    
    session_info = active_sessions[session_id]
    scheduler = schedulers[session_id]
    reward_calculator = reward_calculators[session_id]
    feature_extractor = feature_extractors[session_id]
    delayed_tracker = delayed_trackers[session_id]
    
    # Get last action
    db = next(get_db())
    last_action = db.query(Action).filter_by(
        session_id=session_id
    ).order_by(Action.epoch.desc()).first()
    
    if not last_action:
        return jsonify({'error': 'No action found for session'}), 400
    
    # Extract current context
    context_features = feature_extractor.extract_features()
    
    # Override cognitive load with the one from metrics (more accurate for demo)
    if metrics.get('cognitive_load_post_break') is not None:
        context_features.cognitive_load = metrics['cognitive_load_post_break']
    elif metrics.get('cognitive_load_pre_break') is not None:
        context_features.cognitive_load = metrics['cognitive_load_pre_break']
    
    # Update session duration based on elapsed time
    session_info = active_sessions[session_id]
    from datetime import datetime, timedelta
    start_time = datetime.fromisoformat(session_info['start_time'])
    elapsed_minutes = (datetime.utcnow() - start_time).total_seconds() / 60.0
    context_features.session_duration = elapsed_minutes
    
    # Save updated context features to database (including cognitive load)
    feature_extractor.save_features_to_db(context_features)
    
    # Compute reward
    user_data = {
        'chars_typed': metrics.get('chars_typed', 0),
        'keystrokes': [],  # Would need to fetch from DB
        'cognitive_load_pre_break': metrics.get('cognitive_load_pre_break', 0.5),
        'cognitive_load_post_break': metrics.get('cognitive_load_post_break'),
        'user_reported_improved_focus': metrics.get('improved_focus', False),
        'deep_work_interrupted': metrics.get('deep_work_interrupted', False)
    }
    
    # Log cognitive load for debugging
    print(f"[end-interval] Session {session_id[:8]}... | Load: {context_features.cognitive_load:.2f} | "
          f"Work: {last_action.work_interval}min | Break: {last_action.break_duration}min")
    
    reward_components = reward_calculator.compute_reward(
        last_action.work_interval,
        last_action.break_duration,
        user_data
    )
    
    # Store immediate reward
    epoch_id = f"{session_id}_{session_info['epoch']}"
    delayed_tracker.add_immediate_reward(
        epoch_id,
        reward_components.immediate_reward,
        user_data
    )
    
    # Save reward to database
    reward = Reward(
        action_id=last_action.action_id,
        immediate_reward=reward_components.immediate_reward,
        r_progress=reward_components.r_progress,
        r_relief=reward_components.r_relief,
        final_reward=reward_components.immediate_reward  # Will update with delayed
    )
    db.add(reward)
    db.commit()
    
    # Update bandit (using immediate reward for now)
    scheduler.update(
        (last_action.work_interval, last_action.break_duration),
        context_features,
        reward_components.immediate_reward
    )
    
    # Get next recommendation (using updated context with new cognitive load)
    next_action, next_metadata = scheduler.get_recommendation(context_features)
    
    # Log next recommendation
    print(f"[end-interval] Next recommendation: {next_action[0]}min work, {next_action[1]}min break | "
          f"Load: {context_features.cognitive_load:.2f} | Reward: {reward_components.immediate_reward:.3f}")
    
    # Save next action
    session_info['epoch'] += 1
    next_db_action = Action(
        session_id=session_id,
        epoch=session_info['epoch'],
        work_interval=next_action[0],
        break_duration=next_action[1],
        context_vector_id=None,  # Would link to context vector
        bandit_algorithm=next_metadata['algorithm'],
        safety_override=next_metadata['was_overridden'],
        override_reason=next_metadata.get('override_reason')
    )
    db.add(next_db_action)
    db.commit()
    
    return jsonify({
        'next_action': {
            'work_interval': next_action[0],
            'break_duration': next_action[1]
        },
        'reward_computed': {
            'immediate_reward': reward_components.immediate_reward,
            'r_progress': reward_components.r_progress,
            'r_relief': reward_components.r_relief
        },
        'metadata': next_metadata
    }), 200


@app.route('/api/submit-feedback', methods=['POST'])
def submit_feedback():
    """Submit micro-EMA feedback"""
    data = request.json
    session_id = data.get('session_id')
    fatigue_level = data.get('fatigue_level')
    focus_level = data.get('focus_level')
    satisfaction = data.get('satisfaction')
    
    if not session_id or session_id not in active_sessions:
        return jsonify({'error': 'Invalid session_id'}), 400
    
    # Save to database
    db = next(get_db())
    from src.database.models import MicroEMA
    
    ema = MicroEMA(
        session_id=session_id,
        fatigue_level=fatigue_level,
        focus_level=focus_level,
        satisfaction=satisfaction
    )
    db.add(ema)
    db.commit()
    
    return jsonify({
        'acknowledged': True,
        'policy_updated': True  # Could trigger policy update here
    }), 200


@app.route('/api/end-session', methods=['POST'])
def end_session():
    """End a study session"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id or session_id not in active_sessions:
        return jsonify({'error': 'Invalid session_id'}), 400
    
    # End context logger
    context_logger = context_loggers[session_id]
    session_metadata = context_logger.end_session()
    
    # Update session in database
    db = next(get_db())
    db_session = db.query(Session).filter_by(session_id=session_id).first()
    if db_session:
        db_session.end_time = datetime.utcnow()
        db.commit()
    
    # Cleanup
    del active_sessions[session_id]
    del context_loggers[session_id]
    del feature_extractors[session_id]
    del schedulers[session_id]
    del reward_calculators[session_id]
    del delayed_trackers[session_id]
    
    return jsonify({
        'session_ended': True,
        'duration_minutes': session_metadata.duration_minutes if session_metadata else 0
    }), 200


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'active_sessions': len(active_sessions)}), 200


@app.route('/dashboard')
@app.route('/static/dashboard.html')
def dashboard():
    """Serve the dashboard HTML"""
    response = send_from_directory(str(STATIC_DIR), 'dashboard.html')
    # Allow iframe embedding from praboth UI (modern CSP approach)
    response.headers['Content-Security-Policy'] = "frame-ancestors 'self' http://localhost:3000 http://127.0.0.1:3000;"
    # Remove X-Frame-Options to allow CSP to take precedence
    response.headers.pop('X-Frame-Options', None)
    return response


# Time Block Session Management Endpoints

@app.route('/api/time-block/start', methods=['POST'])
def start_time_block_session():
    """Start a new time block session"""
    data = request.json
    
    # Required fields
    user_id = data.get('user_id')
    start_time_str = data.get('start_time')
    end_time_str = data.get('end_time')
    
    if not user_id or not start_time_str or not end_time_str:
        return jsonify({'error': 'user_id, start_time, and end_time are required'}), 400
    
    try:
        from datetime import datetime
        start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
    except ValueError as e:
        return jsonify({'error': f'Invalid datetime format: {e}'}), 400
    
    # Optional fields
    task_type = data.get('task_type', 'other')
    chronotype = data.get('chronotype', 'neutral')
    algorithm = data.get('algorithm', 'LinUCB')
    previous_metrics = data.get('previous_metrics')
    
    # Create time block
    time_block = TimeBlock(
        start_time=start_time,
        end_time=end_time,
        user_id=user_id,
        task_type=task_type,
        chronotype=chronotype
    )
    
    # Start session
    try:
        session_id, schedule = unified_manager.start_time_block_session(
            time_block=time_block,
            user_id=user_id,
            algorithm=algorithm,
            previous_metrics=previous_metrics
        )
        
        # Convert schedule to JSON-serializable format
        schedule_dict = {
            'total_duration_minutes': schedule.total_duration_minutes,
            'work_time_minutes': schedule.work_time_minutes,
            'break_time_minutes': schedule.break_time_minutes,
            'intervals': [
                {
                    'start_time': i.start_time.isoformat(),
                    'end_time': i.end_time.isoformat(),
                    'interval_type': i.interval_type,
                    'duration_minutes': i.duration_minutes,
                    'work_interval': i.work_interval,
                    'break_duration': i.break_duration
                }
                for i in schedule.intervals
            ]
        }
        
        return jsonify({
            'session_id': session_id,
            'schedule': schedule_dict
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/time-block/current', methods=['GET'])
def get_current_time_block_session():
    """Get current session status"""
    session_id = request.args.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'session_id is required'}), 400
    
    status = unified_manager.get_session_status(session_id)
    
    if not status:
        return jsonify({'error': 'Session not found'}), 404
    
    return jsonify(status), 200


@app.route('/api/time-block/end', methods=['POST'])
def end_time_block_session():
    """
    End a time block session (auto-sync + metrics).

    Request JSON (core fields):
      - session_id: string (required)
      - auto_sync: bool (optional, default true)
      - auto_compute_metrics: bool (optional, default true)

    Optional Intent-Lock metadata (Phase 1 integration):
      - intent_prediction: "impulsive" | "genuine"
      - friction_level: integer (0–2)
      - intent_exit_event_id: integer (ID from intentlock.db)
      - intent_reason: short categorical reason, e.g. "fatigue"
      - intent_reason_custom: optional free-text description
    """
    try:
        data = request.json or {}
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({'error': 'session_id is required'}), 400
        
        auto_sync = data.get('auto_sync', True)
        auto_compute_metrics = data.get('auto_compute_metrics', True)
        # Optional Intent-Lock overlay metadata (may be absent)
        intent_prediction = data.get('intent_prediction')
        friction_level = data.get('friction_level')
        intent_exit_event_id = data.get('intent_exit_event_id')
        intent_reason = data.get('intent_reason')
        intent_reason_custom = data.get('intent_reason_custom')
    
        # Try to load session from database if not in memory
        if session_id not in unified_manager.active_sessions:
            try:
                db = next(get_db())
                db_session = db.query(Session).filter_by(session_id=session_id, is_active=True).first()
                if db_session:
                    unified_manager._load_active_sessions()
            except Exception as e:
                import logging
                logging.error(f"Error loading session: {e}", exc_info=True)
        
        if session_id not in unified_manager.active_sessions:
            return jsonify({
                'error': 'Session not found',
                'session_id': session_id,
                'message': 'Session may have already ended or not been created properly.'
            }), 200  # Return 200 with error so dashboard can handle it
        
        # If any Intent-Lock metadata is present, persist a linked IntentLockEvent row.
        if any(
            value is not None
            for value in (
                intent_prediction,
                friction_level,
                intent_exit_event_id,
                intent_reason,
                intent_reason_custom,
            )
        ):
            try:
                db = next(get_db())
                event = IntentLockEvent(
                    session_id=session_id,
                    prediction=intent_prediction,
                    friction_level=friction_level,
                    intent_exit_event_id=intent_exit_event_id,
                    intent_reason=intent_reason,
                    intent_reason_custom=intent_reason_custom,
                )
                db.add(event)
                db.commit()
            except Exception as e:
                logger.error(f"Failed to save Intent-Lock metadata for session {session_id}: {e}", exc_info=True)
        
        result = unified_manager.end_session(
            session_id=session_id,
            auto_sync=auto_sync,
            auto_compute_metrics=auto_compute_metrics,
        )
        
        if 'error' in result:
            return jsonify(result), 200  # Return 200 with error message instead of 404
        
        return jsonify(result), 200
    except Exception as e:
        import logging
        logging.error(f"Error ending session: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/time-block/suggestion', methods=['GET'])
def get_next_session_suggestion():
    """Get next session suggestion based on previous metrics"""
    user_id = request.args.get('user_id')
    start_time_str = request.args.get('start_time')
    end_time_str = request.args.get('end_time')
    
    if not user_id or not start_time_str or not end_time_str:
        return jsonify({'error': 'user_id, start_time, and end_time are required'}), 400
    
    try:
        from datetime import datetime
        start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
    except ValueError as e:
        return jsonify({'error': f'Invalid datetime format: {e}'}), 400
    
    task_type = request.args.get('task_type', 'other')
    chronotype = request.args.get('chronotype', 'neutral')
    
    time_block = TimeBlock(
        start_time=start_time,
        end_time=end_time,
        user_id=user_id,
        task_type=task_type,
        chronotype=chronotype
    )
    
    try:
        suggestion = unified_manager.get_next_session_suggestion(
            user_id=user_id,
            next_time_block=time_block
        )
        
        suggestion_dict = {
            'total_duration_minutes': suggestion.total_duration_minutes,
            'work_time_minutes': suggestion.work_time_minutes,
            'break_time_minutes': suggestion.break_time_minutes,
            'intervals': [
                {
                    'start_time': i.start_time.isoformat(),
                    'end_time': i.end_time.isoformat(),
                    'interval_type': i.interval_type,
                    'duration_minutes': i.duration_minutes,
                    'work_interval': i.work_interval,
                    'break_duration': i.break_duration
                }
                for i in suggestion.intervals
            ]
        }
        
        return jsonify({'suggestion': suggestion_dict}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/time-block/pause', methods=['POST'])
def pause_time_block_session():
    """Pause a time block session"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'session_id is required'}), 400
    
    success = unified_manager.pause_session(session_id)
    
    if not success:
        return jsonify({'error': 'Failed to pause session'}), 400
    
    return jsonify({'paused': True}), 200


@app.route('/api/time-block/resume', methods=['POST'])
def resume_time_block_session():
    """Resume a paused time block session"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'session_id is required'}), 400
    
    success = unified_manager.resume_session(session_id)
    
    if not success:
        return jsonify({'error': 'Failed to resume session'}), 400
    
    return jsonify({'resumed': True}), 200


@app.route('/api/time-block/end-interval', methods=['POST'])
def end_time_block_interval():
    """End a work or break interval in a time-block session"""
    data = request.json
    session_id = data.get('session_id')
    interval_type = data.get('interval_type')  # Optional: 'work' or 'break' (auto-detected if not provided)
    metrics = data.get('metrics', {})
    
    if not session_id:
        return jsonify({'error': 'session_id is required'}), 400
    
    # interval_type is optional - we'll auto-detect it from the current interval
    # But if provided, validate it
    if interval_type and interval_type not in ['work', 'break']:
        return jsonify({'error': 'interval_type must be "work" or "break"'}), 400
    
    # Try to load session from database if not in memory
    if session_id not in unified_manager.active_sessions:
        try:
            db = next(get_db())
            db_session = db.query(Session).filter_by(session_id=session_id).first()
            
            if db_session:
                # Check if session is active
                if not db_session.is_active:
                    return jsonify({
                        'error': 'Session has ended',
                        'session_id': session_id,
                        'message': 'This session has already been ended. Please start a new session.'
                    }), 200
                
                # Try to reload all active sessions (might include this one)
                unified_manager._load_active_sessions()
                
                # If still not found, try to restore just this session
                if session_id not in unified_manager.active_sessions and db_session.schedule_json:
                    try:
                        import json
                        session_data = json.loads(db_session.schedule_json)
                        from src.session_manager.unified_session_manager import ActiveSessionState
                        state = ActiveSessionState.from_dict(session_data)
                        
                        # Recreate components
                        from src.bandit_engine.adaptive_scheduler import AdaptiveScheduler
                        from src.feature_extractor.feature_extractor import FeatureExtractor
                        state.adaptive_scheduler = AdaptiveScheduler(algorithm=db_session.algorithm or "LinUCB")
                        state.feature_extractor = FeatureExtractor(state.session_id)
                        
                        unified_manager.active_sessions[state.session_id] = state
                        import logging
                        logging.info(f"Restored session {session_id} directly from database")
                    except Exception as restore_error:
                        import logging
                        logging.error(f"Failed to restore session {session_id}: {restore_error}", exc_info=True)
            else:
                # Session doesn't exist in database at all
                return jsonify({
                    'error': 'Session not found',
                    'session_id': session_id,
                    'message': 'Session was never created or has been deleted. Please start a new session.',
                    'available_sessions': list(unified_manager.active_sessions.keys())[:5]  # Show first 5 for debugging
                }), 200
        except Exception as e:
            import logging
            logging.error(f"Error loading session: {e}", exc_info=True)
    
    if session_id not in unified_manager.active_sessions:
        return jsonify({
            'error': 'Session not found',
            'session_id': session_id,
            'message': 'Session may have ended or not been created properly. Please start a new session.',
            'available_sessions': list(unified_manager.active_sessions.keys())[:5]  # Show first 5 for debugging
        }), 200  # Return 200 with error so dashboard can handle it
    
    state = unified_manager.active_sessions[session_id]
    
    if not state.adaptive_scheduler or not state.feature_extractor:
        return jsonify({'error': 'Session components not initialized'}), 400
    
    # Get current interval - use it to determine the actual interval type
    current_interval = unified_manager.get_current_interval(session_id)
    if not current_interval:
        return jsonify({'error': 'No current interval found'}), 400
    
    # Auto-detect interval type from current interval (source of truth)
    actual_interval_type = current_interval.interval_type
    
    # If client sent a different type, log a warning but use the actual type
    # This prevents state desync issues between dashboard and server
    if interval_type and actual_interval_type != interval_type:
        logger.warning(
            f"Interval type mismatch for session {session_id}: "
            f"client specified '{interval_type}' but current interval is '{actual_interval_type}'. "
            f"Using actual interval type '{actual_interval_type}'."
        )
    
    # Use the actual interval type (auto-detected from current interval)
    interval_type = actual_interval_type
    
    # End interval and compute reward using metrics
    result = unified_manager.end_interval_and_compute_reward(session_id, metrics=metrics)
    if not result:
        return jsonify({'error': 'Could not end interval and compute reward'}), 500
    
    # Get next interval
    next_interval = unified_manager.get_current_interval(session_id)
    
    return jsonify({
        'status': 'interval_ended',
        'interval_type': interval_type,
        'next_action': {
            'work_interval': result['work_interval'],
            'break_duration': result['break_duration']
        },
        'next_interval': {
            'type': next_interval.interval_type if next_interval else None,
            'duration_minutes': next_interval.duration_minutes if next_interval else None
        },
        'reward_computed': {
            'immediate_reward': result.get('reward', 0.0),
            'r_progress': result.get('r_progress', 0.0),
            'r_relief': result.get('r_relief', 0.0)
        },
        'metadata': result.get('metadata', {})
    }), 200


@app.route('/api/time-block/recommendation', methods=['GET'])
def get_time_block_recommendation():
    """Get real-time recommendation for current session"""
    session_id = request.args.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'session_id is required'}), 400
    
    # Check if session exists in memory
    if session_id not in unified_manager.active_sessions:
        # Try to load from database
        try:
            db = next(get_db())
            db_session = db.query(Session).filter_by(session_id=session_id, is_active=True).first()
            if db_session:
                # Session exists in DB but not in memory - reload it
                unified_manager._load_active_sessions()
                # Check again after reload
                if session_id not in unified_manager.active_sessions:
                    return jsonify({
                        'error': 'Session not found',
                        'session_id': session_id,
                        'message': 'Session exists in database but could not be restored. Try starting a new session.'
                    }), 200
            else:
                # Return 200 with error message instead of 404 so dashboard can handle it
                available_sessions = list(unified_manager.active_sessions.keys())
                return jsonify({
                    'error': 'Session not found',
                    'session_id': session_id,
                    'available_sessions_count': len(available_sessions),
                    'message': 'Session may have ended or not been created properly. Try starting a new session.'
                }), 200
        except Exception as e:
            return jsonify({
                'error': 'Error checking session',
                'message': str(e)
            }), 200
    
    try:
        # First, try to answer directly from the current time‑block schedule so the
        # recommendation reflects the interval plan the user is actually in.
        state = unified_manager.active_sessions[session_id]
        current_interval = unified_manager.get_current_interval(session_id)

        if current_interval:
            # Derive work_interval / break_duration from the schedule.
            work_interval = current_interval.work_interval
            break_duration = current_interval.break_duration

            # If work_interval is missing, fall back to the interval duration for work blocks.
            if work_interval is None and current_interval.interval_type == 'work':
                work_interval = current_interval.duration_minutes

            # If break_duration is missing on a work interval, look ahead to the next break.
            if break_duration is None and current_interval.interval_type == 'work':
                try:
                    idx = state.current_interval_index
                    if (
                        idx + 1 < len(state.schedule.intervals)
                        and state.schedule.intervals[idx + 1].interval_type == 'break'
                    ):
                        next_int = state.schedule.intervals[idx + 1]
                        break_duration = next_int.break_duration or next_int.duration_minutes
                except Exception:
                    break_duration = None

            # If we're in a break interval, ensure we have a break_duration at least.
            if current_interval.interval_type == 'break' and break_duration is None:
                break_duration = current_interval.duration_minutes

            if isinstance(work_interval, (int, float)) and isinstance(
                break_duration, (int, float)
            ):
                return jsonify({
                    'work_interval': int(work_interval),
                    'break_duration': int(break_duration),
                    'explanation': f"From current time‑block schedule (interval type: {current_interval.interval_type}).",
                    'cognitive_load': state.current_cognitive_load,
                }), 200

        # Fallback: ask the adaptive scheduler directly (same as before).
        recommendation = unified_manager.get_recommendation(session_id)

        if not recommendation:
            # Session exists but recommendation unavailable - return helpful error
            has_scheduler = state.adaptive_scheduler is not None
            has_extractor = state.feature_extractor is not None

            return jsonify({
                'error': 'No recommendation available',
                'details': {
                    'has_scheduler': has_scheduler,
                    'has_extractor': has_extractor,
                    'cognitive_load': state.current_cognitive_load,
                    'message': 'Session components may not be fully initialized yet. Try again in a moment.'
                }
            }), 200

        return jsonify(recommendation), 200
    except Exception as e:
        import traceback
        logger.error(f"Error getting recommendation: {e}\n{traceback.format_exc()}")
        return jsonify({
            'error': 'Error getting recommendation',
            'details': str(e)
        }), 500


@app.route('/api/time-block/sessions', methods=['GET'])
def list_active_sessions():
    """List all active time block sessions (for debugging)"""
    sessions = []
    for session_id, state in unified_manager.active_sessions.items():
        sessions.append({
            'session_id': session_id,
            'user_id': state.user_id,
            'start_time': state.session_start_time.isoformat(),
            'has_scheduler': state.adaptive_scheduler is not None,
            'has_extractor': state.feature_extractor is not None,
            'has_praboth_client': state.praboth_client is not None,
            'cognitive_load': state.current_cognitive_load,
            'is_paused': state.is_paused
        })
    
    return jsonify({
        'active_sessions': sessions,
        'count': len(sessions)
    }), 200


@app.route('/api/time-block/user-sessions', methods=['GET'])
def list_user_sessions_with_reward():
    """List recent sessions for a user from DB with session-level reward (effectiveness)."""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400
    limit = min(int(request.args.get('limit', 10)), 50)
    db = SessionLocal()
    try:
        sessions = db.query(Session).filter_by(user_id=user_id).order_by(
            Session.start_time.desc()
        ).limit(limit).all()
        out = []
        for s in sessions:
            actions = db.query(Action).filter_by(session_id=s.session_id).all()
            rewards = []
            for a in actions:
                r = db.query(Reward).filter_by(action_id=a.action_id).first()
                if r and r.immediate_reward is not None:
                    rewards.append(r.immediate_reward)
            avg_reward = sum(rewards) / len(rewards) if rewards else None
            out.append({
                'session_id': s.session_id,
                'user_id': s.user_id,
                'start_time': s.start_time.isoformat() if s.start_time else None,
                'end_time': s.end_time.isoformat() if s.end_time else None,
                'effectiveness': round(avg_reward, 4) if avg_reward is not None else None,
                'interval_count': len(rewards),
            })
        return jsonify({'sessions': out, 'count': len(out)}), 200
    finally:
        db.close()


def _hour_to_bandit_action(start_time):
    """Map session start hour to bandit action: morning/afternoon/evening/night."""
    if start_time is None:
        return "afternoon"
    h = start_time.hour
    if 6 <= h < 12:
        return "morning"
    if 12 <= h < 18:
        return "afternoon"
    if 18 <= h < 21:
        return "evening"
    return "night"


@app.route('/api/bandit/training-data', methods=['GET'])
def get_bandit_training_data():
    """
    Return rows for Yuvidu bandit training: context features + time-of-day action + reward.
    Optional user_id to restrict to one user. Used as real data source instead of CSV.
    """
    user_id = request.args.get('user_id')
    limit = min(int(request.args.get('limit', 500)), 2000)
    db = SessionLocal()
    try:
        sessions_query = db.query(Session).filter(Session.end_time.isnot(None)).order_by(Session.start_time.desc())
        if user_id:
            sessions_query = sessions_query.filter_by(user_id=user_id)
        sessions = sessions_query.limit(limit * 2).all()
        rows = []
        for s in sessions:
            actions = db.query(Action).filter_by(session_id=s.session_id).order_by(Action.epoch).all()
            for a in actions:
                r = db.query(Reward).filter_by(action_id=a.action_id).first()
                if not r or (r.final_reward is None and r.immediate_reward is None):
                    continue
                reward_val = r.final_reward if r.final_reward is not None else r.immediate_reward
                ctx = db.query(ContextVector).filter_by(vector_id=a.context_vector_id).first() if a.context_vector_id else None
                start_time = s.start_time
                end_time = s.end_time
                date_str = start_time.strftime('%Y-%m-%d') if start_time else ''
                start_str = start_time.strftime('%H:%M') if start_time else ''
                end_str = end_time.strftime('%H:%M') if end_time else ''
                action_label = _hour_to_bandit_action(start_time)
                block_focus = float(ctx.cognitive_load) if ctx and ctx.cognitive_load is not None else 0.5
                mean_iki = float(ctx.mean_iki) if ctx and ctx.mean_iki is not None else 260.0
                burstiness = 0.5
                if ctx and ctx.pause_count is not None and ctx.session_duration and ctx.session_duration > 0:
                    burstiness = min(1.0, ctx.pause_count / (ctx.session_duration / 60.0) * 2)
                scroll_rate = 0.0
                idle_time_percent = 0.0
                microEMA = float(ctx.cognitive_load) if ctx and ctx.cognitive_load is not None else 0.5
                sleep_hours_prev_night = 7.0
                rows.append({
                    'date': date_str,
                    'starttime': start_str,
                    'endtime': end_str,
                    'session_id': s.session_id,
                    'block_focus': round(block_focus, 6),
                    'keystroke_intervals_mean': round(mean_iki, 6),
                    'burstiness': round(burstiness, 6),
                    'scroll_rate': round(scroll_rate, 6),
                    'idle_time_percent': round(idle_time_percent, 6),
                    'microEMA': round(microEMA, 6),
                    'sleep_hours_prev_night': round(sleep_hours_prev_night, 6),
                    'action': action_label,
                    'reward': round(float(reward_val), 6),
                })
                if len(rows) >= limit:
                    break
            if len(rows) >= limit:
                break
        return jsonify({'rows': rows, 'count': len(rows)}), 200
    finally:
        db.close()


@app.route('/api/cognitive-load', methods=['GET'])
def get_cognitive_load():
    """Get current cognitive load for active session from praboth"""
    session_id = request.args.get('session_id')
    
    if not session_id:
        return jsonify({'error': 'session_id is required'}), 400
    
    if session_id not in unified_manager.active_sessions:
        # Try to load from database
        try:
            db = next(get_db())
            db_session = db.query(Session).filter_by(session_id=session_id, is_active=True).first()
            if db_session:
                # Session exists in DB but not in memory - reload it
                unified_manager._load_active_sessions()
                # Check again after reload
                if session_id not in unified_manager.active_sessions:
                    return jsonify({
                        'cognitive_load': None,
                        'available': False,
                        'message': 'Session exists in database but could not be restored'
                    }), 200
            else:
                return jsonify({
                    'cognitive_load': None,
                    'available': False,
                    'message': 'Session not found'
                }), 200  # Return 200 with available=false instead of 404
        except Exception as e:
            return jsonify({
                'cognitive_load': None,
                'available': False,
                'message': f'Error checking session: {str(e)}'
            }), 200
    
    state = unified_manager.active_sessions[session_id]
    
    # Get cognitive load from session state (updated by praboth polling)
    cognitive_load = state.current_cognitive_load
    
    # If no cognitive load in state yet, try to get from praboth directly
    if cognitive_load is None:
        if state.praboth_client:
            cognitive_load = state.praboth_client.get_latest_cognitive_load()
    
    # Still None? Return None but don't error
    if cognitive_load is None:
        return jsonify({
            'cognitive_load': None,
            'available': False,
            'message': 'Cognitive load not available yet. Praboth may still be collecting data.'
        }), 200
    
    # Determine load state
    load_state = 'low'
    if cognitive_load > 0.7:
        load_state = 'high'
    elif cognitive_load > 0.4:
        load_state = 'medium'
    
    return jsonify({
        'cognitive_load': cognitive_load,
        'percentage': round(cognitive_load * 100, 1),
        'load_state': load_state,
        'available': True,
        'timestamp': datetime.utcnow().isoformat()
    }), 200


@app.route('/api/praboth/status', methods=['GET'])
def praboth_status():
    """Check praboth service status"""
    try:
        client = PrabothRealtimeClient(api_url=PRABOTH_API_URL)
        is_available = client.is_service_available()
        
        if is_available:
            try:
                estimate = client.get_latest_estimate()
            except Exception:
                estimate = None
            
            return jsonify({
                'status': 'available',
                'service_url': PRABOTH_API_URL,
                'latest_estimate': estimate
            }), 200
        else:
            return jsonify({
                'status': 'unavailable',
                'service_url': PRABOTH_API_URL,
                'message': 'Praboth service not reachable. Make sure praboth is running on port 8000.'
            }), 200  # Return 200 so dashboard can handle it gracefully
    except Exception as e:
        import logging
        logging.error(f"Error checking praboth status: {e}", exc_info=True)
        return jsonify({
            'status': 'error',
            'service_url': PRABOTH_API_URL,
            'error': str(e),
            'message': 'Error checking praboth service status'
        }), 200  # Return 200 so dashboard can handle it gracefully


@app.route('/api/praboth/sync', methods=['POST'])
def sync_praboth_session():
    """Manually trigger praboth session sync"""
    data = request.json or {}
    praboth_session_id = data.get('praboth_session_id')
    user_id = data.get('user_id', 'default_user')
    
    if not praboth_session_id:
        return jsonify({'error': 'praboth_session_id required'}), 400
    
    try:
        synced_id = unified_manager.praboth_adapter.sync_praboth_session(
            praboth_session_id=praboth_session_id,
            user_id=user_id,
            task_type=data.get('task_type', 'other'),
            chronotype=data.get('chronotype', 'neutral'),
            algorithm=data.get('algorithm', 'LinUCB')
        )
        return jsonify({
            'status': 'success',
            'praboth_session_id': praboth_session_id,
            'synced_session_id': synced_id
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


@app.route('/api/praboth/sessions', methods=['GET'])
def get_praboth_sessions():
    """Get list of praboth sessions"""
    try:
        limit = request.args.get('limit', 10, type=int)
        reader = PrabothDataReader()
        sessions = reader.get_sessions(limit=limit)
        
        return jsonify({
            'sessions': [
                {
                    'session_id': s.session_id,
                    'started_at': s.started_at.isoformat(),
                    'ended_at': s.ended_at.isoformat() if s.ended_at else None,
                    'device_label': s.device_label
                }
                for s in sessions
            ]
        }), 200
    except FileNotFoundError as e:
        return jsonify({
            'error': 'Praboth database not found',
            'message': str(e)
        }), 404
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500


@app.route('/api/praboth/session/<int:session_id>', methods=['GET'])
def get_praboth_session_info(session_id):
    """Get information about a specific praboth session"""
    try:
        reader = PrabothDataReader()
        windows = reader.get_feature_windows(session_id)
        model_states = reader.get_model_states(session_id)
        ema_responses = reader.get_ema_responses(session_id)
        
        return jsonify({
            'session_id': session_id,
            'feature_windows_count': len(windows),
            'model_states_count': len(model_states),
            'ema_responses_count': len(ema_responses),
            'has_cognitive_load_data': len(model_states) > 0
        }), 200
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500


@app.route('/api/praboth/diagnostics', methods=['GET'])
def get_praboth_diagnostics():
    """Get diagnostic information about praboth data availability"""
    try:
        from src.data_integration.praboth_reader import PrabothDataReader
        from pathlib import Path
        from config.config import PRABOTH_DB_PATH
        
        # Auto-detect database path
        if PRABOTH_DB_PATH:
            db_path = Path(PRABOTH_DB_PATH)
        else:
            possible_paths = [
                Path("praboth/data/state.db"),
                Path("praboth/cog_py_est/data/state.db"),
                PROJECT_ROOT / "praboth" / "data" / "state.db",
                PROJECT_ROOT / "praboth" / "cog_py_est" / "data" / "state.db",
            ]
            db_path = None
            for path in possible_paths:
                if path.exists():
                    db_path = path
                    break
        
        if not db_path or not db_path.exists():
            return jsonify({
                'database_found': False,
                'database_path': str(db_path) if db_path else None,
                'error': 'Praboth database not found'
            }), 200
        
        reader = PrabothDataReader(db_path)
        
        # Get active session
        active_session = reader.get_current_active_session()
        
        # Get recent events count
        try:
            recent_events = reader.get_recent_events(limit=100)
        except Exception as e:
            logger.warning(f"Could not get recent events: {e}")
            recent_events = []
        
        # Get feature windows if session exists
        windows_count = 0
        model_states_count = 0
        if active_session:
            windows = reader.get_feature_windows(active_session.session_id)
            windows_count = len(windows) if windows else 0
            
            model_states = reader.get_model_states(active_session.session_id)
            model_states_count = len(model_states) if model_states else 0
        
        return jsonify({
            'database_found': True,
            'database_path': str(db_path),
            'active_session': {
                'session_id': active_session.session_id if active_session else None,
                'started_at': active_session.started_at.isoformat() if active_session and active_session.started_at else None,
                'ended_at': active_session.ended_at.isoformat() if active_session and active_session.ended_at else None
            } if active_session else None,
            'data_counts': {
                'recent_events': len(recent_events),
                'feature_windows': windows_count,
                'model_states': model_states_count
            },
            'status': 'ok' if active_session and len(recent_events) > 0 else 'no_data'
        }), 200
    except Exception as e:
        logger.error(f"Error getting praboth diagnostics: {e}", exc_info=True)
        return jsonify({
            'error': str(e),
            'database_found': False
        }), 200

@app.route('/api/praboth/events/recent', methods=['GET'])
def get_recent_events():
    """Get recent input events from praboth database for console display"""
    try:
        import sqlite3
        from config.config import PRABOTH_DB_PATH
        from pathlib import Path
        
        limit = request.args.get('limit', 50, type=int)
        
        # Auto-detect database path if not configured
        if PRABOTH_DB_PATH:
            db_path = Path(PRABOTH_DB_PATH)
        else:
            # Try common locations
            possible_paths = [
                Path("praboth/data/state.db"),
                Path("praboth/cog_py_est/data/state.db"),
                PROJECT_ROOT / "praboth" / "data" / "state.db",
                PROJECT_ROOT / "praboth" / "cog_py_est" / "data" / "state.db",
            ]
            db_path = None
            for path in possible_paths:
                if path.exists():
                    db_path = path
                    break
        
        if not db_path or not db_path.exists():
            return jsonify({'events': [], 'error': 'Praboth database not found. Please ensure praboth service is running.'}), 200
        
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
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
        for row in reversed(rows):  # Reverse to show oldest first
            try:
                payload = json.loads(row['payload_json']) if row['payload_json'] else {}
                events.append({
                    'id': row['event_id'],
                    'session_id': row['session_id'],
                    'source': row['source'],
                    'payload': payload,
                    'timestamp': row['occurred_at']
                })
            except:
                pass
        
        return jsonify({'events': events}), 200
    except Exception as e:
        logger.error(f"Error fetching events: {e}", exc_info=True)
        return jsonify({'events': [], 'error': str(e)}), 200


def _sanitize_for_json(value):
    """Recursively replace non-finite floats (NaN/Infinity) with None so JSON is valid."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_sanitize_for_json(v) for v in value]
    return value


@app.route('/api/metrics/detailed', methods=['GET'])
def get_detailed_metrics():
    """Get detailed metric calculations with formulas for demo display"""
    from src.metrics.metrics_calculator import MetricsCalculator
    
    user_id = request.args.get('user_id', 'demo_user')
    session_id = request.args.get('session_id', None)
    include_diagnostics = request.args.get('diagnostics', 'false').lower() == 'true'
    
    try:
        calculator = MetricsCalculator(user_id=user_id)
        
        # Get time range if session_id provided
        time_range = None
        if session_id:
            from src.database.models import Session, SessionLocal
            db = SessionLocal()
            session = db.query(Session).filter_by(session_id=session_id).first()
            if session:
                time_range = (session.start_time, session.end_time or datetime.utcnow())
            db.close()
        
        # Get diagnostics if requested
        diagnostics = None
        if include_diagnostics:
            diagnostics = calculator.get_data_diagnostics(time_range)
        
        # Compute all metrics
        results = calculator.compute_all_metrics(time_range)
        
        # Get detailed calculation info
        detailed = {
            'PG': {
                'value': results.PG,
                'formula': 'PG = (μ_bandit - μ_baseline) / μ_baseline',
                'description': 'Personalization Gain: Improvement over Pomodoro baseline (25/5)',
                'components': calculator._get_pg_components(time_range) if hasattr(calculator, '_get_pg_components') else {}
            },
            'RPH': {
                'value': results.RPH,
                'formula': 'RPH = (1/H_total) * Σ(r* - r)',
                'description': 'Regret-per-Hour: Lost reward compared to optimal policy',
                'components': {}
            },
            'AHL': {
                'value': results.AHL,
                'formula': 'AHL = min {t : R(t) ≥ R_pre + 0.5 * (R_post - R_pre)}',
                'description': 'Adaptation Half-Life: Time to recover 50% performance after context shift',
                'components': {}
            },
            'EOI': {
                'value': results.EOI,
                'formula': 'EOI = (1/|E|) * Σ(R_exploit - R_explore)',
                'description': 'Exploration Overhead Index: Cost of exploring vs exploiting',
                'components': {}
            },
            'AUC_BUC': {
                'value': results.AUC_BUC,
                'formula': 'AUC_BUC = ∫ utility(break_duration) d(break_duration)',
                'description': 'Area Under Break Utility Curve: Effectiveness of break durations',
                'components': {}
            },
            'CTU': {
                'value': results.CTU,
                'formula': 'CTU = reward_with_targeting - reward_without_targeting',
                'description': 'Counterfactual Targeting Uplift: Improvement from targeting high-load periods',
                'components': {}
            },
            'SPF_variance': {
                'value': results.SPF_variance,
                'formula': 'SPF_variance = variance(work_interval, break_duration) pairs',
                'description': 'Stability-Productivity Frontier Variance: Consistency of recommendations',
                'components': {}
            },
            'SVR': {
                'value': results.SVR,
                'formula': 'SVR = violations / total_actions',
                'description': 'Safety-Violation Rate: Frequency of unsafe recommendations',
                'components': {}
            }
        }
        
        response = {
            'user_id': user_id,
            'session_id': session_id,
            'metrics': detailed,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        if diagnostics:
            response['diagnostics'] = diagnostics
        
        # Ensure JSON is standards-compliant (no Infinity/NaN literals)
        return jsonify(_sanitize_for_json(response)), 200
    except Exception as e:
        logger.error(f"Error computing detailed metrics: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host=API_HOST, port=API_PORT, debug=API_DEBUG)

