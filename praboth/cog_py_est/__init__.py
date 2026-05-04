"""Compatibility package for legacy imports."""

from cog_py_est.app import create_app
from cog_py_est.config import AppConfig, EstimatorConfig
from cog_py_est.events import Event
from cog_py_est.features import FEATURE_VECTOR_DIM, FeatureWindow, fuse_features
from cog_py_est.kalman import Estimate, KalmanEstimator, RLSAdapter

__all__ = [
    "AppConfig",
    "EstimatorConfig",
    "Event",
    "Estimate",
    "KalmanEstimator",
    "RLSAdapter",
    "FeatureWindow",
    "FEATURE_VECTOR_DIM",
    "fuse_features",
    "create_app",
]
