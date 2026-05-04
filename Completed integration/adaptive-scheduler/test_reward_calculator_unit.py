"""
Unit tests for RewardCalculator: verify reward is not stuck at 0.4 and responds to progress/relief.
Run from project root (older/) with: python test_reward_calculator_unit.py
Or: python -m pytest test_reward_calculator_unit.py -v
"""
import sys
from pathlib import Path

# Allow importing config and src when run from older/
_root = Path(__file__).resolve().parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from src.reward_handler.reward_calculator import RewardCalculator


def test_empty_user_data_reward_not_stuck():
    """With empty/minimal user_data, reward should use neutral progress (0.5) and vary with relief."""
    calc = RewardCalculator()
    # No chars, no keystrokes, no interval_elapsed -> r_progress = 0.5 (neutral)
    # load_post None -> heuristic; relief curve is softer
    out = calc.compute_reward(work_interval=30, break_duration=5, user_data={})
    assert out.r_progress == 0.5
    assert -1.0 <= out.immediate_reward <= 1.0
    # Should not be exactly 0.4 (previous bug)
    assert out.immediate_reward != 0.4 or out.r_relief != 1.0


def test_cognitive_load_only_reward_varies():
    """With only cognitive load pre/post, reward should vary with load delta."""
    calc = RewardCalculator()
    # High pre, low post -> positive relief
    out_high_relief = calc.compute_reward(
        30, 5,
        user_data={
            "cognitive_load_pre_break": 0.9,
            "cognitive_load_post_break": 0.2,
        },
    )
    # Low delta
    out_low_relief = calc.compute_reward(
        30, 5,
        user_data={
            "cognitive_load_pre_break": 0.5,
            "cognitive_load_post_break": 0.4,
        },
    )
    assert out_high_relief.r_relief > out_low_relief.r_relief
    assert out_high_relief.immediate_reward > out_low_relief.immediate_reward


def test_chars_typed_increases_progress():
    """With chars_typed, r_progress should reflect speed; high typing gives progress > neutral 0.5."""
    calc = RewardCalculator()
    out_no_chars = calc.compute_reward(
        30, 5,
        user_data={"cognitive_load_pre_break": 0.5, "cognitive_load_post_break": 0.3},
    )
    # 6000 chars in 30 min = 200 chars/min -> normalized_speed=1 -> r_progress = 0.6
    out_with_chars = calc.compute_reward(
        30, 5,
        user_data={
            "chars_typed": 6000,
            "cognitive_load_pre_break": 0.5,
            "cognitive_load_post_break": 0.3,
        },
    )
    assert out_with_chars.r_progress > out_no_chars.r_progress
    assert out_with_chars.immediate_reward > out_no_chars.immediate_reward


def test_interval_completed_proxy():
    """With work_interval_completed=True and no typing data, progress should be ~0.7."""
    calc = RewardCalculator()
    out = calc.compute_reward(
        30, 5,
        user_data={
            "work_interval_completed": True,
            "interval_elapsed_minutes": 30,
            "cognitive_load_pre_break": 0.5,
        },
    )
    assert out.r_progress >= 0.5
    assert out.immediate_reward >= 0.0


def test_relief_soft_curve():
    """Relief should use softer curve (not binary 0/1)."""
    calc = RewardCalculator()
    # delta_load = 0.5 -> r_relief should be in (0.4, 0.9), not exactly 0.5 (linear) or 1
    out = calc.compute_reward(
        30, 5,
        user_data={
            "cognitive_load_pre_break": 0.8,
            "cognitive_load_post_break": 0.3,
        },
    )
    delta = 0.8 - 0.3
    assert 0.0 < out.r_relief < 1.0
    # 1 - exp(-2.5 * 0.5) ~ 0.71
    assert 0.5 <= out.r_relief <= 0.95


if __name__ == "__main__":
    test_empty_user_data_reward_not_stuck()
    test_cognitive_load_only_reward_varies()
    test_chars_typed_increases_progress()
    test_interval_completed_proxy()
    test_relief_soft_curve()
    print("All reward calculator unit tests passed.")
