"""Manages persistence for model states and training data profiles."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from backend.src.data.db import Database
from backend.src.services.kalman import Estimate


def _dt(dt_val: datetime) -> str:
    return dt_val.isoformat()


class ModelRepository:
    def __init__(self, db: Database) -> None:
        self.db = db
        self.session_id: Optional[int] = None

    def set_session_id(self, session_id: Optional[int]) -> None:
        self.session_id = session_id

    async def save_model_state(self, estimate: Estimate, weights: np.ndarray, forgetting: float) -> None:
        if self.session_id is None:
            return
        await self.db.execute(
            """
            INSERT INTO model_state (session_id, captured_at, latent_mean, latent_variance, weights_json, forgetting_factor)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                self.session_id,
                _dt(estimate.timestamp),
                estimate.load,
                estimate.variance,
                json.dumps(weights.tolist()),
                forgetting,
            ),
        )
        await self.db.commit()

    async def load_latest_model_state(self) -> Optional[Tuple[Estimate, np.ndarray, float]]:
        cursor = await self.db.execute(
            """
            SELECT captured_at, latent_mean, latent_variance, weights_json, forgetting_factor
            FROM model_state
            ORDER BY captured_at DESC
            LIMIT 1
            """
        )
        row = await cursor.fetchone()
        if not row:
            return None
        captured_at = datetime.fromisoformat(row[0])
        estimate = Estimate(
            timestamp=captured_at,
            load=row[1],
            variance=row[2],
            residual=0.0,
        )
        weights = np.array(json.loads(row[3]))
        forgetting = float(row[4]) if row[4] is not None else 1.0
        return estimate, weights, forgetting

    async def save_normalizer_state(
        self, normalizer_type: str, state: Dict[str, Any]
    ) -> None:
        if self.session_id is None:
            return
        await self.db.execute(
            """
            INSERT INTO normalizer_state (session_id, captured_at, normalizer_type, state_json)
            VALUES (?, ?, ?, ?)
            """,
            (
                self.session_id,
                _dt(datetime.utcnow()),
                normalizer_type,
                json.dumps(state),
            ),
        )
        await self.db.commit()

    async def load_latest_normalizer_state(
        self, normalizer_type: str
    ) -> Optional[Dict[str, Any]]:
        cursor = await self.db.execute(
            """
            SELECT state_json
            FROM normalizer_state
            WHERE normalizer_type = ?
            ORDER BY captured_at DESC
            LIMIT 1
            """,
            (normalizer_type,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        try:
            return json.loads(row[0])
        except json.JSONDecodeError:
            return None

    async def record_baseline_profile(
        self, feature_mean: np.ndarray, feature_covariance: Optional[np.ndarray], residuals: List[float]
    ) -> None:
        if self.session_id is None:
            return
        residual_array = np.array(residuals, dtype=float) if residuals else np.zeros(1)
        cov_json = json.dumps(feature_covariance.tolist()) if feature_covariance is not None else None
        
        await self.db.execute(
            """
            INSERT INTO baseline_profiles (session_id, captured_at, feature_mean_json, feature_covariance_json, residual_mean, residual_std)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                self.session_id,
                _dt(datetime.utcnow()),
                json.dumps(feature_mean.tolist()),
                cov_json,
                float(np.mean(residual_array)),
                float(np.std(residual_array)),
            ),
        )
        await self.db.commit()
