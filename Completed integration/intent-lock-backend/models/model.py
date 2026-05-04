"""Intent model for predicting whether an attempted exit is impulsive or genuine.

This backend was missing its model module in the completed integration tree.
The frontend expects the `/predict-exit` endpoint to work reliably, so this
implementation is defensive:

- If a trained model artifact exists (`models/intent_model.joblib`), it is used.
- Else, if training data exists in SQLite (`synthetic_training_data`), a small
  LogisticRegression model is trained and saved.
- Else, we fall back to a simple heuristic rule.

The public surface area is intentionally tiny: `IntentModel.predict(...)`.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import numpy as np

try:
    import joblib  # type: ignore
except Exception:  # pragma: no cover
    joblib = None  # type: ignore


class IntentModel:
    def __init__(self, model_path: Optional[Path] = None) -> None:
        self.model_path = model_path or (Path(__file__).resolve().parent / "intent_model.joblib")
        self._model = None

        # Lazy load / train to keep startup fast.
        self._ensure_model()

    def _ensure_model(self) -> None:
        if self._model is not None:
            return

        if joblib is not None and self.model_path.exists():
            try:
                self._model = joblib.load(self.model_path)
                return
            except Exception:
                # Corrupt or incompatible artifact; fall back.
                self._model = None

        # Try training from DB if available.
        try:
            from data.database import get_training_data  # local import

            data = get_training_data()
            if len(data) >= 50:
                self._model = self._train_from_data(data)
                if joblib is not None:
                    try:
                        self.model_path.parent.mkdir(parents=True, exist_ok=True)
                        joblib.dump(self._model, self.model_path)
                    except Exception:
                        pass
                return
        except Exception:
            pass

        # Otherwise: heuristic-only.
        self._model = None

    @staticmethod
    def _train_from_data(training_data: list[tuple[float, float, int]]):
        # Import here to avoid hard dependency at import time.
        from sklearn.linear_model import LogisticRegression  # type: ignore

        X = np.array([[row[0], row[1]] for row in training_data], dtype=float)
        y = np.array([row[2] for row in training_data], dtype=int)

        clf = LogisticRegression(max_iter=500)
        clf.fit(X, y)
        return clf

    @staticmethod
    def _heuristic(session_minutes: float, latent_mean: float) -> int:
        # Conservative default: high load + shorter sessions => more likely impulsive.
        # This is only used when no model/training data exists.
        if latent_mean >= 0.75:
            return 1
        if session_minutes <= 10 and latent_mean >= 0.6:
            return 1
        return 0

    def predict(self, session_minutes: float, latent_mean: float) -> int:
        """Return 1 for impulsive, 0 for genuine."""
        self._ensure_model()

        if self._model is None:
            return self._heuristic(float(session_minutes), float(latent_mean))

        X = np.array([[float(session_minutes), float(latent_mean)]], dtype=float)
        try:
            pred = int(self._model.predict(X)[0])
        except Exception:
            return self._heuristic(float(session_minutes), float(latent_mean))
        return 1 if pred == 1 else 0
