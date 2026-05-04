"""Intent classifier: use a bundled joblib model if present, else a simple heuristic."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

_MODEL: Any = None


def _load_sklearn_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    try:
        import joblib  # type: ignore[import-untyped]
    except ImportError:
        _MODEL = False
        return None
    candidates = list(Path(__file__).resolve().parent.glob("*.pkl"))
    if not candidates:
        _MODEL = False
        return None
    try:
        _MODEL = joblib.load(candidates[0])
        return _MODEL
    except Exception:
        _MODEL = False
        return None


class IntentModel:
    """1 = impulsive exit, 0 = genuine."""

    def predict(self, session_minutes: float, latent_mean: float) -> int:
        m = _load_sklearn_model()
        if m is not False and m is not None:
            try:
                import numpy as np  # type: ignore[import-untyped]

                X = np.array([[session_minutes, latent_mean]], dtype=float)
                y = int(m.predict(X)[0])
                return 1 if y == 1 else 0
            except Exception:
                pass
        return self._heuristic(session_minutes, latent_mean)

    @staticmethod
    def _heuristic(session_minutes: float, latent_mean: float) -> int:
        if latent_mean >= 0.72 and session_minutes < 12:
            return 1
        if latent_mean >= 0.85:
            return 1
        return 0
