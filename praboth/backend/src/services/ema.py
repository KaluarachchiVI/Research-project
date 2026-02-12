"""EMA scheduling and response handling."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
import logging
import numpy as np
from typing import Dict, List, Optional

from backend.src.core.config import EmaConfig
from backend.src.services.kalman import Estimate

logger = logging.getLogger(__name__)


class SchedulerState(str, Enum):
    DORMANT = "dormant"
    HARD_SUPPRESSED = "hard_suppressed"
    CONTEXT_SUPPRESSED = "context_suppressed"
    SNOOZED = "snoozed"
    COOLDOWN = "cooldown"
    AWAITING_RESPONSE = "awaiting_response"
    ELIGIBLE = "eligible"


@dataclass
class PromptDecision:
    should_prompt: bool
    reason: str
    suppressed: bool = False
    suppression_reason: Optional[str] = None
    state: SchedulerState = SchedulerState.ELIGIBLE
    next_eligible_at: Optional[datetime] = None


@dataclass
class SchedulerStatus:
    state: SchedulerState
    suppression_reason: Optional[str]
    cooldown_until: Optional[datetime]
    snoozed_until: Optional[datetime]
    consent_granted: bool
    privacy_pause: bool
    next_prompt_candidate: Optional[datetime]


class UncertaintySampler:
    """
    Implements active learning by triggering prompts when model uncertainty is high
    relative to recent history (e.g., > 90th percentile).
    """
    def __init__(self, history_size: int = 100, percentile: float = 90.0):
        self.history_size = history_size
        self.percentile = percentile
        self.variance_history: List[float] = []

    def evaluate(self, variance: float) -> bool:
        self.variance_history.append(variance)
        if len(self.variance_history) > self.history_size:
            self.variance_history.pop(0)
        
        if len(self.variance_history) < 10:
            return False # Warm-up

        threshold = np.percentile(self.variance_history, self.percentile)
        return variance >= threshold


class BreakpointManager:
    """
    Queues prompts and releases them only during adequate breakpoints 
    (Context switching or Macro Pauses) to minimize interruption cost.
    """
    def __init__(self, max_pending_seconds: int = 600):
        self.max_pending_seconds = max_pending_seconds
        self.pending_since: Optional[datetime] = None
        self.pending_reason: Optional[str] = None

    def queue_prompt(self, reason: str, now: datetime) -> None:
        if not self.pending_since:
            self.pending_since = now
            self.pending_reason = reason

    def check_release(self, now: datetime, context_flags: Dict[str, str], macro_pause_detect: bool) -> Optional[str]:
        if not self.pending_since:
            return None

        # 1. Timeout Check (Force release if waiting too long)
        if (now - self.pending_since).total_seconds() > self.max_pending_seconds:
            self._clear()
            return "timeout_forced"

        # 2. Breakpoint Detection
        # A change in focus app or a detected macro pause indicates a breakpoint.
        # We rely on context_flags populating 'focus_app' change logic external to this or passed in.
        # For this implementation, we assume if 'focus_app' flag changes it's a switch, 
        # but here we simply check if a macro pause was detected.
        
        is_breakpoint = False
        
        # Heuristic: If we have a 'macro_pause' flag or similar in context
        if macro_pause_detect:
             is_breakpoint = True
        
        # Or if we just switched apps (inferred from context flags if tracked externally, 
        # but here we might rely on the window context passed in)
        # Simulating app switch detection if 'focus_switch' is in flags (assumed upstream logic)
        if "focus_switch" in context_flags:
            is_breakpoint = True

        if is_breakpoint:
            original_reason = self.pending_reason
            self._clear()
            return f"{original_reason}_breakpoint"

        return None

    def is_pending(self) -> bool:
        return self.pending_since is not None
        
    def _clear(self) -> None:
        self.pending_since = None
        self.pending_reason = None


class EmaScheduler:
    def __init__(self, config: EmaConfig) -> None:
        self.config = config
        self.last_prompt_at: Optional[datetime] = None
        self.cooldown_until: Optional[datetime] = None
        self.snoozed_until: Optional[datetime] = None
        self.awaiting_response = False
        self.context_blocked_until: Optional[datetime] = None
        self.context_reason: Optional[str] = None
        self.consent_granted = True
        self.privacy_pause = False
        self._next_prompt_candidate = None # No longer deterministic
        
        # New Components
        self.sampler = UncertaintySampler(
            history_size=config.min_variance_history * 2, 
            percentile=config.uncertainty_percentile
        )
        self.breakpoint_manager = BreakpointManager(max_pending_seconds=config.max_pending_seconds)

    def _expire_awaiting(self, now: datetime) -> None:
        """Clears stale awaiting-response states."""
        if not self.awaiting_response or not self.last_prompt_at:
            return
        elapsed = (now - self.last_prompt_at).total_seconds()
        timeout = max(
            float(self.config.min_seconds_between_prompts) * 2,
            float(self.config.cooldown_on_dismiss_seconds),
        )
        if elapsed > timeout:
            logger.info("EMA awaiting_response expired after %.1fs", elapsed)
            self.awaiting_response = False
            self.snoozed_until = None
            self.cooldown_until = now + timedelta(seconds=self.config.min_seconds_between_prompts)

    def evaluate(
        self,
        estimate: Estimate,
        now: datetime,
        context_flags: Optional[Dict[str, str]] = None,
        macro_pause_detected: bool = False,
    ) -> PromptDecision:
        context_flags = context_flags or {}
        self._update_context(context_flags, now)
        state = SchedulerState.ELIGIBLE
        self._expire_awaiting(now)

        # 1. Check Suppressions
        if not self.consent_granted:
            return self._suppressed_decision("no_consent", SchedulerState.DORMANT)
        if self.privacy_pause:
            return self._suppressed_decision("privacy_pause", SchedulerState.HARD_SUPPRESSED)
        if self.context_blocked_until and now < self.context_blocked_until:
            return self._suppressed_decision(
                self.context_reason or "context_blocked", 
                SchedulerState.CONTEXT_SUPPRESSED, 
                self.context_blocked_until
            )
        if self.awaiting_response:
            return self._suppressed_decision("awaiting_response", SchedulerState.AWAITING_RESPONSE)
        if self.snoozed_until and now < self.snoozed_until:
             return self._suppressed_decision("snoozed", SchedulerState.SNOOZED, self.snoozed_until)
        if self.cooldown_until and now < self.cooldown_until:
             return self._suppressed_decision("adaptive_cooldown", SchedulerState.COOLDOWN, self.cooldown_until)

        # 2. Check Cadence (Minimum Spacing)
        if self.last_prompt_at and (now - self.last_prompt_at).total_seconds() < self.config.min_seconds_between_prompts:
             spacing_target = self.last_prompt_at + timedelta(seconds=self.config.min_seconds_between_prompts)
             return self._suppressed_decision("minimum_spacing", SchedulerState.COOLDOWN, spacing_target)

        # 3. Active Learning Trigger (Uncertainty)
        # If not already pending a breakpoint, check if we SHOULD prompt
        if not self.breakpoint_manager.is_pending():
            if self.sampler.evaluate(estimate.variance):
                logger.debug("EMA uncertainty trigger: variance %.3f", estimate.variance)
                self.breakpoint_manager.queue_prompt("uncertainty_high", now)
        
        # 4. Breakpoint Release Check
        release_reason = self.breakpoint_manager.check_release(now, context_flags, macro_pause_detected)
        
        if release_reason:
            logger.info("EMA released due to breakpoint: %s", release_reason)
            return PromptDecision(True, release_reason, state=SchedulerState.ELIGIBLE)
        
        if self.breakpoint_manager.is_pending():
             # Eligible but waiting for breakpoint
             return PromptDecision(False, "waiting_for_breakpoint", state=SchedulerState.ELIGIBLE)

        return PromptDecision(False, "stable", state=SchedulerState.ELIGIBLE)

    def _suppressed_decision(self, reason_code: str, state: SchedulerState, until: Optional[datetime] = None) -> PromptDecision:
        return PromptDecision(False, reason_code.split("_")[0], True, reason_code, state, until)

    def record_prompt(self, now: datetime) -> None:
        self.last_prompt_at = now
        self.awaiting_response = True
        self.snoozed_until = None
        # We don't clear breakpoint manager here because it auto-clears on release, 
        # but just in case of race/external call:
        self.breakpoint_manager._clear()

    def record_response(self, disposition: str, now: datetime) -> None:
        self.awaiting_response = False
        disposition = disposition.lower()
        if disposition in {"dismissed", "snoozed"}:
            self.snoozed_until = now + timedelta(seconds=self.config.cooldown_on_dismiss_seconds)
            self.cooldown_until = None
        elif disposition == "timeout":
            self.cooldown_until = now + timedelta(seconds=self.config.min_seconds_between_prompts // 2)
            self.snoozed_until = None
        else:
            self.cooldown_until = now + timedelta(seconds=self.config.min_seconds_between_prompts)
            self.snoozed_until = None

    def set_privacy_pause(self, active: bool) -> None:
        self.privacy_pause = active
        if active:
            self.awaiting_response = False

    def set_consent(self, granted: bool) -> None:
        self.consent_granted = granted
        if not granted:
            self.awaiting_response = False
            self.last_prompt_at = None

    def _update_context(self, context_flags: Dict[str, str], now: datetime) -> None:
        if context_flags:
            self.context_reason = ", ".join(context_flags.values())
            block_seconds = max(0, int(self.config.context_block_seconds))
            self.context_blocked_until = now + timedelta(seconds=block_seconds)
        elif self.context_blocked_until and now >= self.context_blocked_until:
             self.context_blocked_until = None
             self.context_reason = None

    def status(self, now: Optional[datetime] = None) -> SchedulerStatus:
        now = now or datetime.now(timezone.utc)
        self._expire_awaiting(now)
        
        # Status reporting similarly to before, simplified
        state = SchedulerState.ELIGIBLE
        suppression_reason = None
        
        if not self.consent_granted:
             state = SchedulerState.DORMANT
             suppression_reason = "no_consent"
        elif self.privacy_pause:
             state = SchedulerState.HARD_SUPPRESSED
             suppression_reason = "privacy_pause"
        elif self.awaiting_response:
             state = SchedulerState.AWAITING_RESPONSE
        elif self.breakpoint_manager.is_pending():
             # We can define a new state or repurpose eligible? 
             # Let's say ELIGIBLE but with a note.
             # Or maybe we need a WAITING_BREAKPOINT state in Enum?
             # For now, stick to ELIGIBLE but imply it via internal state
             pass 

        return SchedulerStatus(
            state=state,
            suppression_reason=suppression_reason,
            cooldown_until=self.cooldown_until,
            snoozed_until=self.snoozed_until,
            consent_granted=self.consent_granted,
            privacy_pause=self.privacy_pause,
            next_prompt_candidate=None,
        )
