"""Configuration settings for Adaptive Scheduler"""
import os
from pathlib import Path

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
MODELS_DIR = PROJECT_ROOT / "models"
LOGS_DIR = PROJECT_ROOT / "logs"

# Database
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{PROJECT_ROOT}/adaptive_scheduler.db")

# Bandit Configuration
WORK_INTERVALS = [20, 30, 45, 60]  # minutes
BREAK_DURATIONS = [3, 5, 8, 12]  # minutes

# Feature Extraction
IKI_MIN = 0.01  # seconds
IKI_MAX = 5.0  # seconds
FEATURE_WINDOW = 60  # seconds (1 minute)
SMOOTHING_WINDOW = 5  # samples

# Bandit Hyperparameters
LINUCB_ALPHA = 1.0
LINUCB_LAMBDA = 0.1
THOMPSON_PRIOR_VARIANCE = 1.0

# Reward Configuration
REWARD_W1 = 0.6  # Task progress weight
REWARD_W2 = 0.4  # Post-break relief weight
IMMEDIATE_REWARD_WEIGHT = 0.7
DELAYED_REWARD_WEIGHT = 0.3
DELAYED_REWARD_DELAY = 600  # seconds (10 minutes)

# Safety Constraints
MAX_WORK_DURATION = 90  # minutes
MIN_BREAK_FREQUENCY = 120  # minutes
HIGH_COGNITIVE_LOAD_THRESHOLD = 0.8
DEEP_WORK_DETECTION_THRESHOLD = 15  # minutes of sustained high productivity

# Micro-EMA
MICRO_EMA_INTERVAL = 20  # minutes (minimum)
MICRO_EMA_PROMPT_PROBABILITY = 0.3  # 30% chance per interval

# API Configuration
API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "5000"))
API_DEBUG = os.getenv("API_DEBUG", "False").lower() == "true"

# Privacy
ENCRYPTION_ENABLED = True
LOG_RETENTION_DAYS = 30

# Session Manager Configuration
PRABOTH_API_URL = os.getenv("PRABOTH_API_URL", "http://localhost:8000")
PRABOTH_POLL_INTERVAL = int(os.getenv("PRABOTH_POLL_INTERVAL", "15"))  # seconds
AUTO_SYNC_ENABLED = os.getenv("AUTO_SYNC_ENABLED", "True").lower() == "true"
AUTO_COMPUTE_METRICS = os.getenv("AUTO_COMPUTE_METRICS", "True").lower() == "true"
SUGGESTION_ENABLED = os.getenv("SUGGESTION_ENABLED", "True").lower() == "true"

# Praboth Integration Configuration
PRABOTH_DB_PATH = os.getenv("PRABOTH_DB_PATH", None)  # Auto-detected if None
PRABOTH_SYNC_RETRY_COUNT = int(os.getenv("PRABOTH_SYNC_RETRY_COUNT", "3"))
PRABOTH_SYNC_RETRY_DELAY = float(os.getenv("PRABOTH_SYNC_RETRY_DELAY", "1.0"))  # seconds

# Cognitive Load Thresholds (from praboth)
PRABOTH_LOW_LOAD_THRESHOLD = 0.3
PRABOTH_MEDIUM_LOAD_THRESHOLD = 0.65
PRABOTH_HIGH_LOAD_THRESHOLD = 0.8

# Feature Mapping Configuration
USE_PRABOTH_COGNITIVE_LOAD = os.getenv("USE_PRABOTH_COGNITIVE_LOAD", "True").lower() == "true"
USE_PRABOTH_QUALITY_SCORES = os.getenv("USE_PRABOTH_QUALITY_SCORES", "True").lower() == "true"
USE_PRABOTH_EMA_RESPONSES = os.getenv("USE_PRABOTH_EMA_RESPONSES", "True").lower() == "true"

