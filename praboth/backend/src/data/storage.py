"""Provides an asynchronous storage facade using SQLite (local-only, no network)."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from backend.src.core.events import Event
from backend.src.services.processing.features import FeatureWindow
from backend.src.services.kalman import Estimate

from backend.src.data.db import Database
from backend.src.data.repositories.events import EventRepository
from backend.src.data.repositories.features import FeatureRepository
from backend.src.data.repositories.ema import EmaRepository
from backend.src.data.repositories.telemetry import TelemetryRepository
from backend.src.data.repositories.policy import PolicyRepository
from backend.src.data.repositories.models import ModelRepository
from backend.src.data.repositories.distraction import DistractionRepository
from backend.src.data.repositories.context import ContextRepository
from backend.src.data.repositories.export import ExportRepository


class Storage:
    def __init__(self, path: Path) -> None:
        self.db = Database(path)
        
        # Initializes the Repositories.
        self.events = EventRepository(self.db)
        self.features = FeatureRepository(self.db)
        self.ema = EmaRepository(self.db)
        self.telemetry = TelemetryRepository(self.db)
        self.policy = PolicyRepository(self.db)
        self.models = ModelRepository(self.db)
        self.distraction = DistractionRepository(self.db)
        self.context = ContextRepository(self.db)
        self.export = ExportRepository(self.db)
        
        self.session_id: Optional[int] = None

    async def initialize(self) -> None:
        await self.db.initialize()

    async def close(self) -> None:
        if self.session_id is not None:
            await self.end_session()
        await self.db.close()

    async def start_session(
        self, consent_version: str = "v1", device_label: str = "workstation"
    ) -> int:
        self.session_id = await self.events.start_session(consent_version, device_label)
        
        # Propagates the session_id to stateful repositories.
        self.ema.set_session_id(self.session_id)
        self.telemetry.set_session_id(self.session_id)
        self.policy.set_session_id(self.session_id)
        self.models.set_session_id(self.session_id)
        self.distraction.set_session_id(self.session_id)
        
        return self.session_id

    async def end_session(self) -> None:
        await self.events.end_session()

    # --- Events ---
    async def record_event(self, event: Event, hop_index: int) -> None:
        await self.events.record_event(event, hop_index)

    # --- Features ---
    async def record_window(
        self, window: FeatureWindow, session_id: Optional[int], ema_prompt_id: Optional[int] = None
    ) -> None:
        await self.features.record_window(window, session_id, ema_prompt_id)

    # --- EMA ---
    async def record_ema_prompt(self, reason: str, state: str = "delivered") -> Optional[int]:
        return await self.ema.record_prompt(reason, state)

    async def update_ema_prompt_state(self, prompt_id: int, state: str) -> None:
        await self.ema.update_prompt_state(prompt_id, state)

    async def fetch_latest_pending_prompt(self, timeout_seconds: int) -> Optional[Dict[str, Any]]:
        return await self.ema.fetch_latest_pending_prompt(timeout_seconds)

    async def record_ema_response(
        self,
        prompt_id: int,
        rating: int,
        disposition: str,
        note: str | None = None,
    ) -> None:
        await self.ema.record_response(prompt_id, rating, disposition, note)

    # --- Models ---
    async def save_model_state(self, estimate: Estimate, weights: np.ndarray, forgetting: float) -> None:
        await self.models.save_model_state(estimate, weights, forgetting)

    async def load_latest_model_state(self) -> Optional[Tuple[Estimate, np.ndarray, float]]:
        return await self.models.load_latest_model_state()

    async def save_normalizer_state(
        self, normalizer_type: str, state: Dict[str, Any]
    ) -> None:
        await self.models.save_normalizer_state(normalizer_type, state)

    async def load_latest_normalizer_state(
        self, normalizer_type: str
    ) -> Optional[Dict[str, Any]]:
        return await self.models.load_latest_normalizer_state(normalizer_type)

    async def record_baseline_profile(
        self, feature_mean: np.ndarray, feature_covariance: Optional[np.ndarray], residuals: List[float]
    ) -> None:
        await self.models.record_baseline_profile(feature_mean, feature_covariance, residuals)

    # --- Distraction ---
    async def record_distraction_period(self, start_time: datetime, end_time: datetime, app_name: str = "unknown") -> None:
        await self.distraction.record_distraction_period(start_time, end_time, app_name)

    async def fetch_distraction_periods(self, limit: int = 50) -> List[Dict[str, Any]]:
        return await self.distraction.fetch_distraction_periods(limit)

    # --- Context Cache ---
    async def get_cached_classification(self, cache_key: str) -> Optional[Tuple[bool, str]]:
        return await self.context.get_cached_classification(cache_key)

    async def cache_classification(
        self, cache_key: str, is_study: bool, category: str
    ) -> None:
        await self.context.cache_classification(cache_key, is_study, category)

    # --- Telemetry ---
    async def record_metric(
        self, metric_type: str, metric_value: float, metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        await self.telemetry.record_metric(metric_type, metric_value, metadata)

    async def fetch_telemetry_metrics(self, limit: int = 200) -> List[Dict[str, Any]]:
        return await self.telemetry.fetch_metrics(limit)

    async def aggregated_summary(self) -> Dict[str, Any]:
        return await self.telemetry.aggregated_summary()

    # --- Policy ---
    async def record_policy_event(
        self,
        event_type: str,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        await self.policy.record_policy_event(event_type, reason, metadata)

    async def fetch_policy_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        return await self.policy.fetch_policy_events(limit)

    # --- Export ---
    async def create_aggregated_export(
        self, summary: Dict[str, Any], status: str = "pending", reviewer: Optional[str] = None, file_path: Optional[str] = None
    ) -> int:
        return await self.export.create_aggregated_export(summary, status, reviewer, file_path)

    async def list_exports(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        return await self.export.list_exports(status)

    async def update_export_status(
        self, export_id: int, status: str, reviewer: Optional[str] = None, file_path: Optional[str] = None
    ) -> None:
        await self.export.update_export_status(export_id, status, reviewer, file_path)

    # --- Pruning (Maintenance) ---
    async def prune_retention(self, retention_hours: int) -> None:
        # Pruning represents a cross-cutting maintenance task.
        # Delegating directly to the database execution ensures simplicity for this schema-wide operation.
        
        cutoff = datetime.utcnow() - timedelta(hours=retention_hours)

        cutoff_iso = cutoff.isoformat()
        prune_targets = [
            ("input_events", "occurred_at"),
            ("feature_windows", "window_end"),
            ("ema_prompts", "issued_at"),
            ("ema_responses", "responded_at"),
            ("model_state", "captured_at"),
            ("telemetry_metrics", "snapshot_at"),
            ("baseline_profiles", "captured_at"),
            ("policy_events", "occurred_at"),
            ("normalizer_state", "captured_at"),
            ("distraction_periods", "start_time"),
            ("context_classification_cache", "classified_at"),
        ]
        for table, column in prune_targets:
            await self.db.execute(
                f"DELETE FROM {table} WHERE {column} < ?",
                (cutoff_iso,),
            )
        await self.db.commit()
