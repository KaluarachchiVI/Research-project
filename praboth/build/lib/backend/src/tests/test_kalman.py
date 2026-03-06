import pytest
import numpy as np
from datetime import datetime
from backend.src.services.kalman import KalmanEstimator, Estimate
from backend.src.core.config import EstimatorConfig

@pytest.fixture
def estimator():
    config = EstimatorConfig(
        process_noise=0.01,
        measurement_noise=0.1,
        learning_rate=0.1
    )
    return KalmanEstimator(config, feature_dim=5)

def test_initialization(estimator):
    assert estimator.mean == 0.0
    assert estimator.covariance == 4.0
    assert estimator.observation_weights.shape == (5,)

def test_predict_update(estimator):
    features = np.array([0.1, 0.2, 0.3, 0.4, 0.5])
    timestamp = datetime.now()
    
    # predict_update requires 'quality' argument
    estimate = estimator.predict_update(features, timestamp, quality=1.0)
    
    assert isinstance(estimate, Estimate)
    assert abs(estimate.load) <= estimator.config.state_clip
    assert estimate.timestamp == timestamp

def test_clipping(estimator):
    # Force extreme state
    estimator.mean = 20.0
    features = np.zeros(5)
    estimate = estimator.predict_update(features, datetime.now(), quality=1.0)
    assert estimate.load <= estimator.config.state_clip
    
    estimator.mean = -20.0
    estimate = estimator.predict_update(features, datetime.now(), quality=1.0)
    assert estimate.load >= -estimator.config.state_clip

def test_learning_from_label(estimator):
    features = np.ones(5) * 0.5
    label = 0.8
    timestamp = datetime.now()
    
    initial_weights = estimator.observation_weights.copy()
    estimate = estimator.learn_from_label(features, label, timestamp)
    
    # Weights should change
    assert not np.array_equal(estimator.observation_weights, initial_weights)
    # Estimate should be close to label after assimilation
    assert abs(estimate.load - label) < 1.0 
