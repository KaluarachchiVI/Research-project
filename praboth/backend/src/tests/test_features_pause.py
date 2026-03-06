import pytest
import numpy as np
from backend.src.services.processing.features import LogNormalPauseAnalysis

def test_pause_analysis_rates():
    # Micro threshold = 2.0s, Macro threshold = 15.0s
    analyzer = LogNormalPauseAnalysis(micro_threshold=2.0, macro_threshold=15.0)
    
    # Latencies in ms
    latencies = [
        100.0,   # 0.1s  (Flow)
        500.0,   # 0.5s  (Flow)
        2000.0,  # 2.0s  (Micro Pause - inclusive lower bound)
        2500.0,  # 2.5s  (Micro Pause)
        14900.0, # 14.9s (Micro Pause)
        15000.0, # 15.0s (Macro Pause - inclusive lower bound)
        30000.0  # 30.0s (Macro Pause)
    ]
    
    # Expected:
    # Total = 7
    # Flow = 2 (0.1, 0.5)
    # Micro = 3 (2.0, 2.5, 14.9)
    # Macro = 2 (15.0, 30.0)
    
    stats = analyzer.analyze(latencies)
    
    assert stats["micro_pause_rate"] == pytest.approx(3/7, abs=0.001)
    assert stats["macro_pause_rate"] == pytest.approx(2/7, abs=0.001)
    
    # Log Mean Check
    # Values in seconds: 0.1, 0.5, 2.0, 2.5, 14.9, 15.0, 30.0
    valid_secs = [0.1, 0.5, 2.0, 2.5, 14.9, 15.0, 30.0]
    expected_log_mean = float(np.mean(np.log(valid_secs)))
    expected_log_std = float(np.std(np.log(valid_secs)))
    
    assert stats["iki_log_mean"] == pytest.approx(expected_log_mean, abs=0.001)
    assert stats["iki_log_std"] == pytest.approx(expected_log_std, abs=0.001)

def test_pause_analysis_empty():
    analyzer = LogNormalPauseAnalysis()
    stats = analyzer.analyze([])
    assert stats["micro_pause_rate"] == 0.0
    assert stats["macro_pause_rate"] == 0.0
    assert stats["iki_log_mean"] == 0.0
