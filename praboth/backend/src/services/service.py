"""Orchestrates the runtime execution of the Python cognitive load estimator."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
import logging
from typing import Any, Dict, List, Optional

import numpy as np

from backend.src.services.baseline import BaselineCalibrator
from backend.src.core.config import AppConfig
from backend.src.services.context import ContextMonitor
from backend.src.services.ema import EmaScheduler
from backend.src.services.ema_integrator import EMAIntegrator
from backend.src.core.events import Event, EventBuffer, PermissionGuard, utc_now
from backend.src.services.processing.features import FEATURE_VECTOR_DIM
from backend.src.services.classifier import ContextClassifier
from backend.src.services.distraction.distraction import DistractionTracker
from backend.src.services.kalman import Estimate, KalmanEstimator
from backend.src.services.processing.normalization import OutputScaler, RollingNormalizer
from backend.src.services.policy import ConsentLog, PolicyActor
from backend.src.data.storage import Storage
from backend.src.services.telemetry import TelemetryEmitter
from backend.src.services.window_manager import WindowManager
from backend.src.data.exporter import export_to_sqlite
from backend.src.services.notification import PushNotifier
from backend.src.services.focus_reminder import FocusReminder

logger = logging.getLogger(__name__)


@dataclass
class RuntimeEstimate:
    hop_index: int
    estimate: Optional[Estimate]
    quality: float
    baseline_active: bool
    pending_prompt: Optional[Dict[str, str]]
    context_flags: Dict[str, str] = field(default_factory=dict)
    onboarding_state: Optional[Dict[str, Any]] = None
    load_state: str = "unknown"


class EstimatorService:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self.consent_log = ConsentLog(config.permissions.consent_log_path)
        self.guard = PermissionGuard(
            config.permissions.allowed_sources,
            config.permissions.privacy_pause,
            consent_granted=True,
            context_blocklist=config.permissions.context_blocklist,
            idle_block_seconds=config.permissions.idle_block_seconds,
        )
        self._permissions_state_path = config.permissions.state_path
        self.buffer = EventBuffer(
            span=timedelta(seconds=config.window.window_seconds)
        )
        self.window_manager = WindowManager(config.window)
        self.normalizer = RollingNormalizer(
            alpha=config.normalization.alpha,
            huber_delta=config.normalization.huber_delta,
            min_std=config.normalization.min_std,
            max_abs=config.normalization.max_abs,
        )
        self.output_scaler = OutputScaler(alpha=config.normalization.alpha)
        self.estimator = KalmanEstimator(config.estimator, feature_dim=FEATURE_VECTOR_DIM)
        self.storage = Storage(config.storage.path)
        self.ema_scheduler = EmaScheduler(config.ema)
        self.policy_actor = PolicyActor(self.storage, self.guard)
        self.ema_integrator = EMAIntegrator()
        self.telemetry_emitter = TelemetryEmitter()
        self.hop_index = 0
        self._stop_event = asyncio.Event()
        self._window_task: Optional[asyncio.Task] = None
        self._state_event = asyncio.Event()
        self.latest_estimate: Optional[RuntimeEstimate] = None
        self._last_features: Optional[np.ndarray] = None
        self._last_fused_vector: Optional[np.ndarray] = None
        self._active_prompt_id: Optional[int] = None
        self.baseline_calibrator = BaselineCalibrator(
            config.estimator.baseline_minutes, config.estimator.baseline_target_variance
        )
        self.classifier = ContextClassifier(
            self.storage, 
            api_key=config.context.llm_api_key, 
            model=config.context.llm_model
        )
        logger.info(
            "Context classification via Ollama model=%s (url=http://localhost:11434)",
            self.classifier.model,
        )
        self.distraction_tracker = DistractionTracker(
            threshold_seconds=config.context.distraction_threshold_seconds
        )
        self.push_notifier = PushNotifier()
        self.focus_reminder = FocusReminder(
            classifier=self.classifier,
            notifier=self.push_notifier,
            distraction_tracker=self.distraction_tracker,
            storage=self.storage,
            interval_seconds=config.context.poll_interval_seconds,
            distraction_threshold_seconds=config.context.distraction_threshold_seconds,
        )
        self._baseline_complete = False
        self._baseline_profile_recorded = False
        self.context_monitor = ContextMonitor(
            self._handle_context_payload, interval_seconds=config.context.poll_interval_seconds
        )
        self._context_catalog: set[str] = set()
        self._restore_permissions_state()

    @staticmethod
    def _classify_load_state(load_value: float) -> str:
        if load_value >= 0.65:
            return "high cognitive load"
        if load_value >= 0.35:
            return "medium cognitive load"
        return "low cognitive load"

    async def start(self) -> None:
        logger.info("Starting EstimatorService session")
        await self.storage.initialize()
        await self.storage.start_session()
        if self.config.storage.enable_retention_prune:
            await self.storage.prune_retention(self.config.storage.retention_hours)
        restored = await self.storage.load_latest_model_state()
        if restored:
            logger.info("Restored previous model state")
            estimate, weights, forgetting = restored
            self.estimator.restore(estimate, weights, forgetting)
            
            # Restore normalizer states
            input_norm_state = await self.storage.load_latest_normalizer_state("input")
            if input_norm_state:
                self.normalizer.set_state(input_norm_state)
            
            output_norm_state = await self.storage.load_latest_normalizer_state("output")
            if output_norm_state:
                self.output_scaler.set_state(output_norm_state)

            self.latest_estimate = RuntimeEstimate(
                hop_index=self.hop_index,
                estimate=estimate,
                quality=1.0,
                baseline_active=False,
                pending_prompt=None,
                context_flags={},
                onboarding_state=None,
            )
            self._baseline_complete = True
            self.baseline_calibrator.force_complete()
        self._stop_event.clear()
        self._window_task = asyncio.create_task(self._window_loop())
        await self.context_monitor.start()
        # Start auxiliary focus reminder service (uses classifier + notifier)
        await self.focus_reminder.start()

    async def stop(self) -> None:
        logger.info("Stopping EstimatorService session")
        self._stop_event.set()
        if self._window_task:
            await self._window_task
        await self.context_monitor.stop()
        await self.focus_reminder.stop()
        await self.storage.end_session()
        await self.storage.close()
        try:
            output_db = self.config.export.shutdown_export_db_path
            await asyncio.to_thread(export_to_sqlite, self.config.storage.path, output_db)
        except Exception:
            logger.exception("Failed to auto-export data on shutdown")

    async def ingest_event(self, event: Event) -> bool:
        if not self.guard.allow(event):
            logger.debug("Event from %s blocked by permissions", event.source)
            return False
        self.buffer.append(event)
        await self.storage.record_event(event, hop_index=self.hop_index)
        logger.debug("Ingested event from %s", event.source)
        return True

    async def ingest_ema_response(
        self,
        prompt_id: int,
        rating: int,
        disposition: str,
        note: Optional[str] = None,
    ) -> None:
        await self.storage.record_ema_response(prompt_id, rating, disposition, note)
        await self.storage.update_ema_prompt_state(prompt_id, disposition.lower())
        logger.info("Recorded EMA response prompt_id=%s disposition=%s", prompt_id, disposition)
        now = utc_now()
        if disposition.lower() == "completed":
            self.ema_integrator.submit_response(prompt_id, self._likert_to_unit(rating))
        elif disposition.lower() == "snoozed":
            # Treats snooze as a soft dismissal; applies no label.
            pass
        self.ema_scheduler.record_response(disposition, now)
        if self._active_prompt_id == prompt_id:
            self._active_prompt_id = None
        self._state_event.set()

    async def _window_loop(self) -> None:
        hop = timedelta(seconds=self.config.window.hop_seconds)
        next_tick = utc_now() + hop
        while not self._stop_event.is_set():
            now = utc_now()
            if now < next_tick:
                wait_seconds = (next_tick - now).total_seconds()
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=wait_seconds)
                    continue
                except asyncio.TimeoutError:
                    # Expected timeout waiting for next window tick
                    logger.debug("Expected timeout waiting for next window tick")

            try:
                self.hop_index += 1
                window_end = next_tick
                events = self.buffer.window(window_end)
                fused, window_context = self.window_manager.build_window(
                    events, self.hop_index, window_end, last_vector=self._last_fused_vector
                )
                self._last_fused_vector = fused.vector.copy()
                normalized_vec = self.normalizer.normalize(fused.vector)
                self._last_features = normalized_vec

                estimate = self.estimator.predict_update(
                    normalized_vec,
                    timestamp=window_end,
                    quality=fused.quality,
                )

            except Exception:
                logger.exception("Unexpected error in window loop")
                # Wait a bit to avoid rapid loop on persistent error
                await asyncio.sleep(5.0)
                next_tick = utc_now() + hop
                continue

            baseline_status = self.baseline_calibrator.record_window(fused, estimate)
            onboarding_state: Optional[Dict[str, Any]] = None
            if not self._baseline_complete and baseline_status.onboarding_message:
                onboarding_state = {
                    "message": baseline_status.onboarding_message,
                    "percent": baseline_status.percent_complete,
                }
            
            # Update output scaler with the new estimate
            self.output_scaler.update_scalar(float(estimate.load))

            prompt_payload = None
            prompt_id_for_window: Optional[int] = None
            decision = None

            if not self._baseline_complete and baseline_status.prompt_ready:
                prompt_reason = "baseline"
                prompt_id = await self.storage.record_ema_prompt(reason=prompt_reason, state="delivered")
                if prompt_id is not None:
                    self.baseline_calibrator.mark_prompt_sent()
                    self.ema_scheduler.record_prompt(window_end)
                    self._active_prompt_id = prompt_id
                    prompt_payload = {"prompt_id": prompt_id, "reason": prompt_reason}
                    prompt_id_for_window = prompt_id
                    self.ema_integrator.register_prompt(prompt_id, normalized_vec.copy(), window_end)
            elif self._baseline_complete:
                blocked_reason = self.guard.context_blocked(window_context.context_flags)
                context_for_scheduler = (
                    window_context.context_flags if blocked_reason else {}
                )
                
                # Check for macro pauses in the current window's raw features
                macro_pause_rate = fused.raw_features.get("macro_pause_rate", 0.0)
                macro_pause_detected = macro_pause_rate > 0

                decision = self.ema_scheduler.evaluate(
                    estimate, 
                    window_end, 
                    context_for_scheduler,
                    macro_pause_detected=macro_pause_detected
                )
                
                decision = await self.policy_actor.enforce(decision, window_context)
                if decision.should_prompt:
                    prompt_id = await self.storage.record_ema_prompt(reason=decision.reason, state="delivered")
                    if prompt_id is not None:
                        self.ema_scheduler.record_prompt(window_end)
                        self._active_prompt_id = prompt_id
                        prompt_payload = {"prompt_id": prompt_id, "reason": decision.reason}
                        prompt_id_for_window = prompt_id
                        self.ema_integrator.register_prompt(prompt_id, normalized_vec.copy(), window_end)
                elif decision and decision.suppressed and decision.suppression_reason:
                    await self.storage.record_metric(
                        metric_type="ema_suppression",
                        metric_value=1.0,
                        metadata={"reason": decision.suppression_reason},
                    )

            if not self._baseline_complete and self.baseline_calibrator.completed():
                self._baseline_complete = True
                if not self._baseline_profile_recorded:
                    mean_vector = self.baseline_calibrator.feature_mean()
                    covariance_matrix = self.baseline_calibrator.feature_covariance()
                    if mean_vector is not None:
                        await self.storage.record_baseline_profile(
                            mean_vector, covariance_matrix, self.baseline_calibrator.residuals()
                        )
                    self._baseline_profile_recorded = True

            await self.storage.record_window(
                fused, session_id=self.storage.session_id, ema_prompt_id=prompt_id_for_window
            )
            await self.storage.save_model_state(
                estimate, self.estimator.observation_weights, self.config.estimator.rls_forgetting_factor
            )
            
            # Persists normalizer states to ensure continuity across sessions.
            await self.storage.save_normalizer_state("input", self.normalizer.get_state())
            await self.storage.save_normalizer_state("output", self.output_scaler.get_state())

            for pending in self.ema_integrator.ready_observations():
                if pending.label is None:
                    continue
                estimate = self.estimator.learn_from_label(
                    pending.features, pending.label, pending.timestamp
                )
                await self.storage.record_metric(
                    metric_type="ema_assimilation",
                    metric_value=estimate.load,
                    metadata={"prompt_id": pending.prompt_id},
                )

            load_state = self.output_scaler.classify(float(estimate.load))
            self.latest_estimate = RuntimeEstimate(
                hop_index=self.hop_index,
                estimate=estimate,
                quality=fused.quality,
                baseline_active=not self._baseline_complete,
                pending_prompt=prompt_payload,
                context_flags=window_context.context_flags,
                onboarding_state=onboarding_state,
                load_state=load_state,
            )
            scheduler_status = self.ema_scheduler.status(window_end)
            self.telemetry_emitter.update(
                hop_index=self.hop_index,
                residual=estimate.residual,
                variance=estimate.variance,
                baseline_active=not self._baseline_complete,
                pending_prompt_reason=(prompt_payload or {}).get("reason") if prompt_payload else None,
                scheduler_status=scheduler_status,
                context=window_context,
                onboarding_state=onboarding_state,
                policy_counters=self.policy_actor.counters(),
                load_state=load_state,
                active_prompt_id=self._active_prompt_id,
            )
            await self.storage.record_metric(
                metric_type="residual_rms",
                metric_value=abs(estimate.residual),
                metadata={"hop_index": self.hop_index},
            )
            self._state_event.set()
            next_tick = next_tick + hop

    def latest(self) -> Optional[RuntimeEstimate]:
        return self.latest_estimate

    def latest_payload(self) -> Optional[Dict[str, Any]]:
        state = self.latest()
        if not state or not state.estimate:
            return None
        est = state.estimate
        return {
            "hop_index": state.hop_index,
            "timestamp": est.timestamp,
            "load": est.load,
            "variance": est.variance,
            "ci95": est.ci95,
            "residual": est.residual,
            "quality": state.quality,
            "baseline_active": state.baseline_active,
            "load_state": state.load_state,
            "pending_prompt": state.pending_prompt,
            "context_flags": state.context_flags,
            "scheduler_state": self.ema_scheduler.status().state.value,
            "onboarding_state": state.onboarding_state,
            "active_prompt_id": self._active_prompt_id,
        }

    def active_prompt(self) -> Optional[int]:
        return self._active_prompt_id

    def set_privacy_pause(self, active: bool, persist: bool = True) -> None:
        self.guard.set_privacy_pause(active)
        self.ema_scheduler.set_privacy_pause(active)
        if persist:
            self._persist_permissions_state()
        self._state_event.set()

    def set_consent(self, granted: bool, persist: bool = True, log: bool = True) -> None:
        self.guard.set_consent(granted)
        self.ema_scheduler.set_consent(granted)
        if log:
            self.consent_log.append(granted)
            logger.info("Consent changed -> %s", granted)
        if persist:
            self._persist_permissions_state()
        self._state_event.set()

    def set_context_blocklist(self, entries: List[str], persist: bool = True) -> None:
        self.guard.set_context_blocklist(entries)
        logger.info("Context blocklist updated to %s", entries)
        if persist:
            self._persist_permissions_state()
        self._state_event.set()

    def set_idle_block_seconds(self, seconds: int, persist: bool = True) -> None:
        self.guard.set_idle_block_seconds(seconds)
        logger.info("Idle block seconds updated to %s", seconds)
        if persist:
            self._persist_permissions_state()
        self._state_event.set()

    def permissions_status(self) -> Dict[str, Any]:
        status = self.guard.status()
        status["context_catalog"] = sorted(self._context_catalog)
        return status

    def consent_history(self) -> List[Dict[str, Any]]:
        return [
            {
                "timestamp": entry.timestamp,
                "granted": entry.granted,
                "reason": entry.reason,
            }
            for entry in self.consent_log.list_recent()
        ]

    async def policy_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        return await self.storage.fetch_policy_events(limit)

    async def distraction_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        return await self.storage.fetch_distraction_periods(limit)

    def state_snapshot(self) -> Dict[str, Any]:
        return {
            "telemetry": self.telemetry(),
            "estimate": self.latest_payload(),
        }

    async def state_updates(self, heartbeat_seconds: float = 5.0):
        """Yields state snapshots upon changes or heartbeat intervals for SSE (Server-Sent Events)."""
        while True:
            try:
                await asyncio.wait_for(self._state_event.wait(), timeout=heartbeat_seconds)
            except asyncio.TimeoutError:
                pass
            self._state_event.clear()
            yield self.state_snapshot()

    def telemetry(self) -> Dict[str, Any]:
        snapshot = self.telemetry_emitter.snapshot()
        return {
            "hop_index": snapshot.hop_index,
            "residual": snapshot.residual,
            "variance": snapshot.variance,
            "baseline_active": snapshot.baseline_active,
            "load_state": snapshot.load_state,
            "pending_prompt_reason": snapshot.pending_prompt_reason,
            "suppression_reason": snapshot.suppression_reason,
            "scheduler_state": snapshot.scheduler_state.value,
            "cooldown_seconds": snapshot.cooldown_seconds,
            "snooze_seconds": snapshot.snooze_seconds,
            "context_flags": snapshot.context_flags,
            "running_apps": snapshot.running_apps,
            "inactivity_gap_seconds": snapshot.inactivity_gap_seconds,
            "consent_granted": snapshot.consent_granted,
            "privacy_pause": snapshot.privacy_pause,
            "next_prompt_seconds": snapshot.next_prompt_seconds,
            "onboarding_percent": snapshot.onboarding_percent,
            "onboarding_message": snapshot.onboarding_message,
            "policy_prompted": snapshot.policy_prompted,
            "policy_suppressed": snapshot.policy_suppressed,
            "active_prompt_id": snapshot.active_prompt_id,
        }

    @staticmethod
    def _likert_to_unit(rating: int) -> float:
        return max(0.0, min(1.0, (rating - 1) / 6))

    async def _handle_context_payload(self, payload: Dict[str, Any]) -> None:
        event_payload = dict(payload)
        self._update_context_catalog(
            event_payload.get("focus_app"),
            event_payload.get("running_apps"),
            event_payload.get("workspace"),
        )
        event = Event(timestamp=utc_now(), source="system", payload=event_payload)
        await self.ingest_event(event)

    def _update_context_catalog(
        self, focus_app: Any, running_apps: Any, workspace: Any = None
    ) -> None:
        if isinstance(focus_app, str) and focus_app:
            self._context_catalog.add(focus_app)
        if isinstance(workspace, str) and workspace:
            self._context_catalog.add(workspace)
        if isinstance(running_apps, list):
            for entry in running_apps:
                if isinstance(entry, str) and entry:
                    self._context_catalog.add(entry)

    async def request_export(self, reviewer: Optional[str] = None) -> Dict[str, Any]:
        if not self.config.export.enabled:
            raise RuntimeError("exports disabled in policy")
        summary = await self.storage.aggregated_summary()
        status = "pending" if self.config.export.require_review else "approved"
        file_path = None
        if status == "approved":
            file_path = self._write_export_file(summary)
        export_id = await self.storage.create_aggregated_export(
            summary, status=status, reviewer=reviewer, file_path=file_path
        )
        return {"export_id": export_id, "status": status, "summary": summary, "file_path": file_path}

    async def list_exports(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        return await self.storage.list_exports(status)

    async def approve_export(self, export_id: int, reviewer: str, token: Optional[str]) -> Dict[str, Any]:
        if not self.config.export.enabled:
            raise RuntimeError("exports disabled")
        if self.config.export.require_review:
            if not token or token != self.config.export.review_token:
                raise PermissionError("invalid review token")
        exports = await self.storage.list_exports(None)
        export = next((item for item in exports if item["export_id"] == export_id), None)
        if not export:
            raise FileNotFoundError("export not found")
        if export["status"] == "approved":
            return export
        file_path = self._write_export_file(export["summary"])
        await self.storage.update_export_status(export_id, "approved", reviewer=reviewer, file_path=file_path)
        export["status"] = "approved"
        export["reviewer"] = reviewer
        export["file_path"] = file_path
        return export

    async def get_export(self, export_id: int) -> Optional[Dict[str, Any]]:
        exports = await self.storage.list_exports(None)
        return next((item for item in exports if item["export_id"] == export_id), None)

    async def pending_prompt(self) -> Optional[Dict[str, Any]]:
        timeout_seconds = max(
            int(self.config.ema.min_seconds_between_prompts * 2),
            int(self.config.ema.cooldown_on_dismiss_seconds),
        )
        return await self.storage.fetch_latest_pending_prompt(timeout_seconds)

    def _write_export_file(self, summary: Dict[str, Any]) -> str:
        filename = f"cle-export-{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}.json"
        path = (self.config.export.output_dir / filename).resolve()
        path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        return path.as_posix()

    def _persist_permissions_state(self) -> None:
        if not self._permissions_state_path:
            return
        state = self.guard.status()
        path = self._permissions_state_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state, indent=2), encoding="utf-8")
        logger.debug("Persisted permissions state to %s", path)

    def _restore_permissions_state(self) -> None:
        path = getattr(self, "_permissions_state_path", None)
        if not path:
            return
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            logger.warning("Failed to decode permissions state file %s", path)
            return
        if "privacy_pause" in data:
            self.set_privacy_pause(bool(data["privacy_pause"]), persist=False)
        if "consent_granted" in data:
            self.set_consent(bool(data["consent_granted"]), persist=False, log=False)
        if "context_blocklist" in data and isinstance(data["context_blocklist"], list):
            self.guard.set_context_blocklist([str(entry) for entry in data["context_blocklist"]])
        if "idle_block_seconds" in data:
            try:
                seconds = int(data["idle_block_seconds"])
            except (TypeError, ValueError):
                seconds = self.config.permissions.idle_block_seconds
            self.guard.set_idle_block_seconds(seconds)
        logger.info("Restored permissions state from %s", path)
