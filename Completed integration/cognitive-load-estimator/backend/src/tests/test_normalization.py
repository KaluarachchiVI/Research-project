import numpy as np
import pytest
from backend.src.services.processing.normalization import RollingNormalizer, OutputScaler

@pytest.fixture
def normalizer():
    return RollingNormalizer(
        alpha=0.1,
        huber_delta=2.0,
        min_std=0.1,
        max_abs=5.0
    )

def test_initialization(normalizer):
    vector = np.array([1.0, 2.0, 3.0])
    normalized = normalizer.normalize(vector)
    
    # First update sets mean=vector.
    # Logic: normalize -> update(sets mean=vector) -> (vector - mean)/std
    # So (vector - vector) -> 0.
    # This differs from standard scalers but is how RollingNormalizer is implemented.
    expected = np.zeros_like(vector)
    np.testing.assert_array_equal(normalized, expected)
    np.testing.assert_array_equal(normalizer._mean, vector)

def test_clipping_logic(normalizer):
    # Initialize
    normalizer.update(np.zeros(3))
    
    # Update with massive outlier
    huge_vector = np.array([100.0, -100.0, 0.0])
    normalizer.update(huge_vector)
    
    # Mean should NOT move to ~10.0 because of huber_delta=2.0
    # Expected shift <= alpha * huber_delta = 0.1 * 2.0 = 0.2
    assert abs(normalizer._mean[0]) <= 0.21 

def test_output_scaler_classification():
    scaler = OutputScaler()
    scaler.update_scalar(0.5) # Initialize mean=0.5
    
    # Classification logic relies on z-score
    # With var=1.0 (default init), std=1.0.
    # z = (val - mean) / std
    
    # 0.5 (mean) -> z=0 -> medium
    assert scaler.classify(0.5) == "medium cognitive load"
    
    # 2.0 -> (2.0 - 0.5)/1 = 1.5 -> high
    assert scaler.classify(2.0) == "high cognitive load"
    
    # -1.0 -> (-1.0 - 0.5)/1 = -1.5 -> low
    assert scaler.classify(-1.0) == "low cognitive load"
