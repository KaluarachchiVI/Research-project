"""Rolling normalization with Huber clipping."""

from __future__ import annotations

import numpy as np


class RollingNormalizer:
    def __init__(
        self,
        alpha: float = 0.05,
        huber_delta: float = 1.5,
        min_std: float = 0.25,
        max_abs: float = 8.0,
    ) -> None:
        self.alpha = alpha
        self.huber_delta = huber_delta
        self.min_std = min_std
        self.max_abs = max_abs
        self._mean: np.ndarray | None = None
        self._var: np.ndarray | None = None

    def update(self, vector: np.ndarray) -> np.ndarray:
        if self._mean is None or self._var is None:
            self._mean = vector.astype(float)
            self._var = np.ones_like(vector, dtype=float)
            return vector

        delta = vector - self._mean
        clipped_delta = np.clip(delta, -self.huber_delta, self.huber_delta)
        self._mean = self._mean + self.alpha * clipped_delta
        self._var = (1 - self.alpha) * self._var + self.alpha * np.square(clipped_delta)
        return vector

    def normalize(self, vector: np.ndarray) -> np.ndarray:
        self.update(vector)
        assert self._mean is not None and self._var is not None
        std = np.sqrt(np.maximum(self._var, self.min_std ** 2) + 1e-6)
        normalized = (vector - self._mean) / std
        if self.max_abs is not None:
            normalized = np.clip(normalized, -self.max_abs, self.max_abs)
        return normalized

    def get_state(self) -> Dict[str, List[float]]:
        if self._mean is None or self._var is None:
            return {}
        return {
            "mean": self._mean.tolist(),
            "var": self._var.tolist(),
        }

    def set_state(self, state: Dict[str, List[float]]) -> None:
        if "mean" in state and "var" in state:
            self._mean = np.array(state["mean"], dtype=float)
            self._var = np.array(state["var"], dtype=float)


class OutputScaler(RollingNormalizer):
    """Adaptive scalar normalizer for load outputs."""

    def __init__(self, alpha: float = 0.05, min_std: float = 0.1) -> None:
        super().__init__(
            alpha=alpha,
            huber_delta=5.0,  # Less aggressive clipping for output
            min_std=min_std,
            max_abs=10.0,
        )

    def update_scalar(self, value: float) -> None:
        self.update(np.array([value]))

    def classify(self, value: float) -> str:
        if self._mean is None or self._var is None:
            # Fallback to absolute thresholds if not initialized
            if value >= 0.65:
                return "high cognitive load"
            if value >= 0.35:
                return "medium cognitive load"
            return "low cognitive load"

        std = np.sqrt(np.maximum(self._var, self.min_std ** 2) + 1e-6)[0]
        mean = self._mean[0]
        z_score = (value - mean) / std

        # Classification based on relative deviation from user's norm
        # High: > +1.0 std dev
        # Low:  < -1.0 std dev
        # Med:  within +/- 1.0 std dev
        if z_score >= 1.0:
            return "high cognitive load"
        if z_score <= -1.0:
            return "low cognitive load"
        return "medium cognitive load"

