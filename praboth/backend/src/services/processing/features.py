"""Feature fusion and quality scoring for interaction events."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import sqrt, log
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np

from backend.src.core.events import Event

FEATURE_VECTOR_DIM = 14

@dataclass
class FeatureWindow:
    hop_index: int
    window_start: datetime
    window_end: datetime
    raw_features: Dict[str, Any]
    vector: np.ndarray
    quality: float


class LogNormalPauseAnalysis:
    """
    Analyzes Inter-Key Intervals (IKI) using a log-normal distribution approach.
    Distinguishes between:
    - Flow typing (IKI < micro_threshold)
    - Micro-pauses (micro_threshold <= IKI < macro_threshold): Local planning.
    - Macro-pauses (IKI >= macro_threshold): Cognitive breaks or re-planning.
    """
    def __init__(self, micro_threshold: float = 2.0, macro_threshold: float = 15.0):
        self.micro_threshold = micro_threshold
        self.macro_threshold = macro_threshold

    def analyze(self, latencies: List[float]) -> Dict[str, float]:
        if not latencies:
            return {
                "iki_log_mean": 0.0,
                "iki_log_std": 0.0,
                "micro_pause_rate": 0.0,
                "macro_pause_rate": 0.0,
                "flow_adherence": 1.0
            }

        # Filter valid latencies (avoid log(0) or negative)
        valid_ikis = [max(l, 1e-3) / 1000.0 for l in latencies if l > 0] # Convert ms to seconds
        
        if not valid_ikis:
             return {
                "iki_log_mean": 0.0,
                "iki_log_std": 0.0,
                "micro_pause_rate": 0.0,
                "macro_pause_rate": 0.0,
                "flow_adherence": 1.0
            }

        log_ikis = np.log(valid_ikis)
        
        micro_pauses = sum(1 for iki in valid_ikis if self.micro_threshold <= iki < self.macro_threshold)
        macro_pauses = sum(1 for iki in valid_ikis if iki >= self.macro_threshold)
        total = len(valid_ikis)

        return {
            "iki_log_mean": float(np.mean(log_ikis)),
            "iki_log_std": float(np.std(log_ikis)),
            "micro_pause_rate": float(micro_pauses / total) if total > 0 else 0.0,
            "macro_pause_rate": float(macro_pauses / total) if total > 0 else 0.0,
            "flow_adherence": 1.0 # Placeholder: requires baseline for true Mahalanobis
        }

def _keystroke_features(events: Iterable[Event], pause_analyzer: LogNormalPauseAnalysis) -> Tuple[List[float], Dict[str, float]]:
    latencies = []
    errors = 0
    backspaces = 0
    count = 0
    
    for event in events:
        count += 1
        latency = event.payload.get("latency_ms")
        if latency is not None:
            latencies.append(latency)
        if event.payload.get("is_error"):
            errors += 1
        if event.payload.get("is_backspace"):
            backspaces += 1
            
    pause_stats = pause_analyzer.analyze(latencies)
    
    stats = {
        "keystrokes": float(count),
        "error_rate": float(errors / count) if count else 0.0,
        "backspace_rate": float(backspaces / count) if count else 0.0,
        **pause_stats
    }
    
    vector = [
        stats["keystrokes"],
        stats["iki_log_mean"],
        stats["iki_log_std"],
        stats["micro_pause_rate"],
        stats["macro_pause_rate"],
        stats["error_rate"],
        stats["backspace_rate"],
    ]
    vector = [float(x) for x in vector]
    return vector, stats


def _pointer_features(events: Iterable[Event]) -> Tuple[List[float], Dict[str, float]]:
    speeds = []
    accel = []
    prev_speed = None
    for event in events:
        dx = event.payload.get("dx", 0.0)
        dy = event.payload.get("dy", 0.0)
        dt_ms = event.payload.get("dt_ms", 1.0)
        speed = sqrt(dx * dx + dy * dy) / max(dt_ms, 1e-3)
        speeds.append(speed)
        if prev_speed is not None:
            accel.append(speed - prev_speed)
        prev_speed = speed
    speed_arr = np.array(speeds) if speeds else np.array([0.0])
    accel_arr = np.array(accel) if accel else np.array([0.0])
    stats = {
        "pointer_events": float(len(speeds)),
        "pointer_speed_mean": float(np.mean(speed_arr)),
        "pointer_speed_std": float(np.std(speed_arr)),
        "pointer_accel_mean": float(np.mean(accel_arr)),
    }
    vector = [
        stats["pointer_events"],
        stats["pointer_speed_mean"],
        stats["pointer_speed_std"],
        stats["pointer_accel_mean"],
    ]
    return vector, stats


def _classify_focus_app(label: Optional[str]) -> str:
    if not label:
        return "unknown"
    lowered = label.lower()
    if any(key in lowered for key in ["teams", "zoom", "meet", "slack"]):
        return "collaboration"
    if any(key in lowered for key in ["word", "docs", "notepad"]):
        return "writing"
    if any(key in lowered for key in ["excel", "sheets"]):
        return "analysis"
    if any(key in lowered for key in ["outlook", "mail"]):
        return "communication"
    return "other"


def _context_features(events: Iterable[Event]) -> Tuple[List[float], Dict[str, Any]]:
    events = list(events)
    total = max(len(events), 1)
    locked_count = sum(1 for e in events if e.payload.get("locked"))
    dnd_count = sum(1 for e in events if e.payload.get("dnd"))
    idle_values = [float(e.payload.get("idle_seconds", 0.0)) for e in events if "idle_seconds" in e.payload]
    focus_app = None
    if events:
        for event in reversed(events):
            focus_app = event.payload.get("focus_app")
            if focus_app:
                break
    category = _classify_focus_app(focus_app)
    avg_idle = float(np.mean(idle_values)) if idle_values else 0.0
    stats = {
        "focus_app": focus_app or "unknown",
        "focus_category": category,
        "locked_ratio": float(locked_count / total),
        "dnd_ratio": float(dnd_count / total),
        "avg_idle_seconds": avg_idle,
    }
    vector = [
        stats["locked_ratio"],
        stats["dnd_ratio"],
        stats["avg_idle_seconds"],
    ]
    return vector, stats


def fuse_features(
    events: List[Event],
    hop_index: int,
    window_start: datetime,
    window_end: datetime,
    last_vector: Optional[np.ndarray] = None,
    micro_threshold: float = 2.0,
    macro_threshold: float = 15.0,
) -> FeatureWindow:
    keyboard_events = [e for e in events if e.source == "keyboard"]
    pointer_events = [e for e in events if e.source == "pointer"]
    system_events = [e for e in events if e.source == "system"]
    
    pause_analyzer = LogNormalPauseAnalysis(micro_threshold, macro_threshold)
    
    key_vec, key_stats = _keystroke_features(keyboard_events, pause_analyzer)
    pointer_vec, pointer_stats = _pointer_features(pointer_events)
    context_vec, context_stats = _context_features(system_events)
    # idle = _idle_fraction(events, window_start, window_end, active_epsilon) # REMOVED

    imputed_keyboard = False
    imputed_pointer = False
    if not keyboard_events and last_vector is not None:
        key_vec = last_vector[: len(key_vec)].tolist()
        imputed_keyboard = True
    if not pointer_events and last_vector is not None:
        pointer_vec = last_vector[len(key_vec) : len(key_vec) + len(pointer_vec)].tolist()
        imputed_pointer = True

    raw = {
        **key_stats,
        **pointer_stats,
        **context_stats,
        "keyboard_imputed": imputed_keyboard,
        "pointer_imputed": imputed_pointer,
    }
    
    # Vector concatenation order must match expected DIM
    vector = np.array(
        key_vec         # 7 features
        + pointer_vec   # 4 features
        + context_vec,  # 3 features
        dtype=float,
    )
    
    # Quality approximated by event presence rather than linear idle time
    coverage = 1.0 if (keyboard_events or pointer_events) else 0.1
    quality = coverage 
    
    return FeatureWindow(
        hop_index=hop_index,
        window_start=window_start,
        window_end=window_end,
        raw_features=raw,
        vector=vector,
        quality=quality,
    )
