"""Focus reminder service: watches context and uses the classifier to send push notifications
when the user appears to be distracted for a sustained period.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from backend.src.core.events import utc_now
from typing import Any, Dict

from backend.src.services.context import ContextMonitor
from backend.src.services.classifier import ContextClassifier
from backend.src.services.notification import PushNotifier
from backend.src.services.distraction.distraction import DistractionTracker
from backend.src.data.storage import Storage

logger = logging.getLogger(__name__)

# Ensure focus reminder logs are written to a dedicated file so it can be
# tailed in a separate terminal started by the start scripts.
try:
    _log_dir = Path("data")
    _log_dir.mkdir(parents=True, exist_ok=True)
    _log_file = _log_dir / "focus_reminder.log"
    _log_file.touch(exist_ok=True)
    _fh = logging.FileHandler(_log_file, encoding="utf-8")
    _fh.setLevel(logging.INFO)
    _fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s - %(message)s"))
    logger.addHandler(_fh)
    logger.setLevel(logging.INFO)
except Exception:
    # If file logging can't be set up, fall back to root logger.
    logger.exception("Failed to set up focus_reminder file logger")


class FocusReminder:
    def __init__(
        self,
        classifier: ContextClassifier,
        notifier: PushNotifier,
        distraction_tracker: DistractionTracker,
        storage: Storage,
        interval_seconds: float = 2.0,
        distraction_threshold_seconds: float = 240.0,
    ) -> None:
        self.classifier = classifier
        self.notifier = notifier
        self.distraction_tracker = distraction_tracker
        self.storage = storage
        self.distraction_threshold = distraction_threshold_seconds
        self.monitor = ContextMonitor(self._on_context, interval_seconds=interval_seconds)
        self._lock = asyncio.Lock()
        self._last_classification_key: Optional[tuple[str, str, bool]] = None

    async def start(self) -> None:
        logger.info("Starting FocusReminder service")
        await self.monitor.start()

    async def stop(self) -> None:
        logger.info("Stopping FocusReminder service")
        await self.monitor.stop()
        self.notifier.reset()

    async def _on_context(self, payload: Dict[str, Any]) -> None:
        # Protect against concurrent classifier calls
        async with self._lock:
            try:
                focus_app = payload.get("focus_app") or payload.get("focus_process") or "unknown"
                window_title = payload.get("window_title") or ""
                is_study, _category = await self.classifier.classify(focus_app, window_title)
            except Exception:
                logger.exception("FocusReminder: classifier failed")
                # On classifier failure, be conservative and assume study
                is_study = True
                _category = "unknown"

            # Use timezone-aware UTC timestamp to match other services
            now = utc_now()

            classification_key = (str(focus_app), str(window_title), bool(is_study))
            if self._last_classification_key != classification_key:
                self._last_classification_key = classification_key
                logger.info(
                    "Context classified: is_study=%s category=%s app=%s title=%s",
                    is_study,
                    _category,
                    focus_app,
                    (window_title or "")[:160],
                )

            # Update tracker first so we can detect transitions.
            distraction_event = self.distraction_tracker.update(
                is_study, now, current_app=focus_app
            )

            # Persist distraction period when returning to study.
            if distraction_event is not None:
                try:
                    # Only record periods that meet the configured "significant" threshold.
                    # This keeps the DB from filling with extremely short context flickers.
                    if distraction_event.duration_seconds >= float(self.distraction_threshold):
                        await self.storage.record_distraction_period(
                            distraction_event.start_time,
                            distraction_event.end_time,
                            app_name=distraction_event.app_name,
                        )
                        logger.info(
                            "Recorded distraction period: %.1fs (App: %s)",
                            distraction_event.duration_seconds,
                            distraction_event.app_name,
                        )
                except Exception:
                    logger.exception("Failed to record distraction period")

            # Delegate timing/spacing logic to PushNotifier.
            current_distraction_time = self.distraction_tracker.current_duration(now)
            self.notifier.update(is_study, current_distraction_time, now)
