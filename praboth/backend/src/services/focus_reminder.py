"""Focus reminder service: watches context and uses the classifier to send push notifications
when the user appears to be distracted for a sustained period.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from datetime import datetime
from backend.src.core.events import utc_now
from typing import Any, Dict, Optional

from backend.src.services.context import ContextMonitor
from backend.src.services.classifier import ContextClassifier
from backend.src.services.notification import PushNotifier

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
        interval_seconds: float = 2.0,
        distraction_threshold_seconds: float = 240.0,
    ) -> None:
        self.classifier = classifier
        self.notifier = notifier
        self.distraction_threshold = distraction_threshold_seconds
        self.monitor = ContextMonitor(self._on_context, interval_seconds=interval_seconds)
        self._distraction_start: Optional[datetime] = None
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        logger.info("Starting FocusReminder service")
        await self.monitor.start()

    async def stop(self) -> None:
        logger.info("Stopping FocusReminder service")
        await self.monitor.stop()
        self._distraction_start = None
        self.notifier.reset()

    async def _on_context(self, payload: Dict[str, Any]) -> None:
        # Protect against concurrent classifier calls
        async with self._lock:
            try:
                focus_app = payload.get("focus_app") or payload.get("focus_process") or "unknown"
                window_hint = payload.get("context_label") or payload.get("workspace") or ""
                is_study, _category = await self.classifier.classify(focus_app, window_hint)
            except Exception:
                logger.exception("FocusReminder: classifier failed")
                # On classifier failure, be conservative and assume study
                is_study = True

            # Use timezone-aware UTC timestamp to match other services
            now = utc_now()

            if not is_study:
                if self._distraction_start is None:
                    self._distraction_start = now
                duration = (now - self._distraction_start).total_seconds()
                # Delegate timing/spacing logic to PushNotifier
                self.notifier.update(False, duration, now)
            else:
                # Reset when user returns to studying
                self._distraction_start = None
                self.notifier.reset()
