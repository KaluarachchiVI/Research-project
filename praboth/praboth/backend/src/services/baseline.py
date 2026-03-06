"""Orchestrates the baseline calibration process."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional

import numpy as np

from backend.src.services.processing.features import FeatureWindow
from backend.src.services.kalman import Estimate


@dataclass
class BaselineStatus:
    """Lightweight status object returned by the baseline calibrator."""

    active: bool
    prompt_ready: bool
    percent_complete: float
    onboarding_message: Optional[str]


class BaselineCalibrator:
    """Tracks baseline calibration progress and statistics."""

    def __init__(self, baseline_minutes: int, target_variance: float) -> None:
        self.target_duration = timedelta(minutes=baseline_minutes)
        self.target_variance = target_variance
        self._start: Optional[datetime] = None
        self._prompt_sent = False
        self._completed = False
        self._vectors: List[np.ndarray] = []
        self._count = 0
        self._residuals: List[float] = []

    def record_window(self, window: FeatureWindow, estimate: Estimate) -> BaselineStatus:
        """Ingests a new feature window and returns updated baseline status."""
        if self._completed:
            return BaselineStatus(
                active=False,
                prompt_ready=False,
                percent_complete=1.0,
                onboarding_message=None,
            )

        if self._start is None:
            self._start = window.window_start

        self._vectors.append(window.vector.astype(float))
        self._residuals.append(estimate.residual)
        self._count += 1

        elapsed = window.window_end - self._start
        percent = min(
            1.0,
            max(
                elapsed / self.target_duration,
                self._count / 10.0,
            ),
        )

        recent_std = self._recent_residual_std()
        prompt_ready = (
            not self._prompt_sent
            and elapsed >= self.target_duration
            and (recent_std is None or recent_std <= self.target_variance * 1.5)
        )

        if self._prompt_sent and estimate.variance <= self.target_variance:
            if recent_std is None or recent_std <= self.target_variance * 1.5:
                self._completed = True
                percent = 1.0

        message = "Calibrating baseline..." if not self._completed else "Baseline complete"
        return BaselineStatus(
            active=not self._completed,
            prompt_ready=prompt_ready,
            percent_complete=float(percent),
            onboarding_message=message,
        )

    def mark_prompt_sent(self) -> None:
        self._prompt_sent = True

    def completed(self) -> bool:
        return self._completed

    def force_complete(self) -> None:
        self._prompt_sent = True
        self._completed = True

    def feature_mean(self) -> Optional[np.ndarray]:
        if not self._vectors:
            return None
        return np.mean(np.stack(self._vectors), axis=0)

    def feature_covariance(self) -> Optional[np.ndarray]:
        if not self._vectors or len(self._vectors) < 2:
            return None
        return np.cov(np.stack(self._vectors), rowvar=False)

    def residuals(self) -> List[float]:
        return list(self._residuals)

    def _recent_residual_std(self, sample: int = 5) -> Optional[float]:
        if not self._residuals:
            return None
        recent = self._residuals[-sample:]
        return float(np.std(recent))
