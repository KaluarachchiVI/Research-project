"""Defines configuration models for the Python cognitive load estimator."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Optional

try:  # Supports Python 3.11+.
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - Provides fallback for Python 3.10.
    import tomli as tomllib
from pydantic import BaseModel, Field, field_validator


class WindowConfig(BaseModel):
    window_seconds: float = 60.0
    hop_seconds: float = 15.0
    inactivity_gap_seconds: float = 5.0
    micro_pause_threshold: float = 2.0
    macro_pause_threshold: float = 15.0

    @field_validator("window_seconds", "hop_seconds", "inactivity_gap_seconds", "micro_pause_threshold", "macro_pause_threshold")
    @classmethod
    def _positive(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("window settings must be positive")
        return value


class EstimatorConfig(BaseModel):
    process_noise: float = 0.01
    measurement_noise: float = 0.05
    initial_variance: float = 1.0
    rls_forgetting_factor: float = 0.98
    rls_initial_covariance: float = 10.0
    state_clip: float = 10.0
    baseline_minutes: int = 5
    diffuse_mean: float = 0.0
    diffuse_variance: float = 4.0
    baseline_target_variance: float = 0.3

    @field_validator("process_noise", "measurement_noise", "initial_variance", "diffuse_variance", "baseline_target_variance", "rls_initial_covariance", "state_clip")
    @classmethod
    def _non_negative(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("noise and variance terms must be > 0")
        return value

    @field_validator("rls_forgetting_factor")
    @classmethod
    def _forgetting_range(cls, value: float) -> float:
        if not 0 < value <= 1:
            raise ValueError("forgetting factor must be in (0, 1]")
        return value


class PermissionsConfig(BaseModel):
    allowed_sources: List[str] = Field(
        default_factory=lambda: ["keyboard", "pointer", "system"]
    )
    privacy_pause: bool = False
    context_blocklist: List[str] = Field(default_factory=list)
    idle_block_seconds: int = 900
    consent_log_path: Path = Path("data/consent_log.jsonl")
    state_path: Path = Path("data/permissions_state.json")

    @field_validator("allowed_sources")
    @classmethod
    def _non_empty(cls, value: List[str]) -> List[str]:
        if not value:
            raise ValueError("at least one event source must be allowed")
        return value

    @field_validator("idle_block_seconds")
    @classmethod
    def _non_negative(cls, value: int) -> int:
        if value < 0:
            raise ValueError("idle block seconds must be >= 0")
        return value


class EmaConfig(BaseModel):
    min_seconds_between_prompts: int = 1800
    cooldown_on_dismiss_seconds: int = 3600
    context_block_seconds: int = 300
    trigger_uncertainty_threshold: float = 0.25
    trigger_residual_threshold: float = 0.2
    min_variance_history: int = 50
    uncertainty_percentile: float = 90.0
    max_pending_seconds: int = 600

    @field_validator("min_seconds_between_prompts", "cooldown_on_dismiss_seconds", "min_variance_history", "max_pending_seconds")
    @classmethod
    def _positive_int(cls, value: int) -> int:
        if value < 0:
             raise ValueError("must be non-negative")
        return value

    @field_validator("uncertainty_percentile")
    @classmethod
    def _percentile(cls, value: float) -> float:
        if not (0 <= value <= 100):
            raise ValueError("percentile must be between 0 and 100")
        return value

    @field_validator("context_block_seconds")
    @classmethod
    def _non_negative(cls, value: int) -> int:
        if value < 0:
            raise ValueError("context_block_seconds must be >= 0")
        return value

    @field_validator("trigger_uncertainty_threshold", "trigger_residual_threshold")
    @classmethod
    def _threshold_non_negative(cls, value: float) -> float:
        if value < 0:
            raise ValueError("trigger thresholds must be >= 0")
        return value


class StorageConfig(BaseModel):
    path: Path = Path("data/state.db")
    enable_retention_prune: bool = True
    retention_hours: int = 48

    @field_validator("retention_hours")
    @classmethod
    def _retention_positive(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("retention_hours must be positive")
        return value


class ServiceConfig(BaseModel):
    host: str = "127.0.0.1"
    port: int = 8000
    cors_allowed_origins: List[str] = Field(
        default_factory=lambda: ["http://127.0.0.1:3000", "http://localhost:3000"]
    )
    cors_allowed_methods: List[str] = Field(default_factory=lambda: ["GET", "POST", "OPTIONS"])
    cors_allowed_headers: List[str] = Field(
        default_factory=lambda: ["Content-Type", "Accept", "X-API-Key"]
    )


class SecurityConfig(BaseModel):
    require_api_key: bool = False
    api_key: Optional[str] = None


class ExportConfig(BaseModel):
    enabled: bool = True
    output_dir: Path = Path("data/exports")
    require_review: bool = True
    review_token: Optional[str] = "dev-review-token"
    shutdown_export_db_path: Path = Path("data/exports/session_export.db")


class ContextConfig(BaseModel):
    poll_interval_seconds: float = 2.0
    classifier_provider: str = "simple"  # Specifies the provider: "simple" or "llm".
    llm_api_key: Optional[str] = None
    llm_model: str = "llama3.2:3b"
    distraction_threshold_seconds: int = 180

    @field_validator("poll_interval_seconds")
    @classmethod
    def _positive(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("poll_interval_seconds must be positive")
        return value

    @field_validator("distraction_threshold_seconds")
    @classmethod
    def _positive_threshold(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("distraction_threshold_seconds must be positive")
        return value


class NormalizationConfig(BaseModel):
    alpha: float = 0.05
    huber_delta: float = 1.5
    min_std: float = 0.25
    max_abs: float = 8.0

    @field_validator("alpha", "huber_delta", "min_std")
    @classmethod
    def _positive(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("normalization parameters must be positive")
        return value

    @field_validator("max_abs")
    @classmethod
    def _non_negative(cls, value: float) -> float:
        if value is not None and value <= 0:
            raise ValueError("max_abs must be positive when provided")
        return value


class SensitivityProfile(BaseModel):
    residual_threshold: float
    uncertainty_threshold: float
    process_noise: float
    measurement_noise: float
    description: Optional[str] = None


class SensitivityConfig(BaseModel):
    current_profile: str = "balanced"
    profiles: Dict[str, SensitivityProfile] = Field(default_factory=dict)

    def apply(self, estimator: EstimatorConfig, ema: EmaConfig) -> None:
        if not self.profiles:
            return
        profile = self.profiles.get(self.current_profile)
        if not profile:
            raise ValueError(f"sensitivity profile '{self.current_profile}' not found")
        ema.trigger_residual_threshold = profile.residual_threshold
        ema.trigger_uncertainty_threshold = profile.uncertainty_threshold
        estimator.process_noise = profile.process_noise
        estimator.measurement_noise = profile.measurement_noise


class AppConfig(BaseModel):
    window: WindowConfig = WindowConfig()
    estimator: EstimatorConfig = EstimatorConfig()
    permissions: PermissionsConfig = PermissionsConfig()
    ema: EmaConfig = EmaConfig()
    storage: StorageConfig = StorageConfig()
    service: ServiceConfig = ServiceConfig()
    normalization: NormalizationConfig = NormalizationConfig()
    context: ContextConfig = ContextConfig()
    sensitivity: Optional[SensitivityConfig] = None
    export: ExportConfig = ExportConfig()
    security: SecurityConfig = SecurityConfig()

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "AppConfig":
        if path and path.exists():
            data = tomllib.loads(path.read_text())
            config = cls.model_validate(data)
        else:
            config = cls()
        config.apply_env_overrides()
        config.apply_sensitivity()
        config.validate_runtime()
        return config

    def ensure_storage_parent(self) -> None:
        self.storage.path.parent.mkdir(parents=True, exist_ok=True)
        self.export.output_dir.mkdir(parents=True, exist_ok=True)
        self.export.shutdown_export_db_path.parent.mkdir(parents=True, exist_ok=True)

    def apply_sensitivity(self) -> None:
        if self.sensitivity:
            self.sensitivity.apply(self.estimator, self.ema)

    def apply_env_overrides(self) -> None:
        review_token = os.getenv("EXPORT_REVIEW_TOKEN")
        if review_token:
            self.export.review_token = review_token

        shutdown_export_db_path = os.getenv("SHUTDOWN_EXPORT_DB_PATH")
        if shutdown_export_db_path:
            self.export.shutdown_export_db_path = Path(shutdown_export_db_path)

        require_api_key = os.getenv("REQUIRE_API_KEY")
        if require_api_key is not None:
            self.security.require_api_key = require_api_key.lower() in {"1", "true", "yes", "on"}

        api_key = os.getenv("API_KEY")
        if api_key:
            self.security.api_key = api_key

        cors_origins = os.getenv("CORS_ALLOWED_ORIGINS")
        if cors_origins:
            self.service.cors_allowed_origins = [item.strip() for item in cors_origins.split(",") if item.strip()]

    def validate_runtime(self) -> None:
        if self.export.require_review and not self.export.review_token:
            raise ValueError(
                "export.review_token is required when export.require_review=true. "
                "Set EXPORT_REVIEW_TOKEN or provide it in policy TOML."
            )
        if self.security.require_api_key and not self.security.api_key:
            raise ValueError(
                "security.api_key is required when security.require_api_key=true. "
                "Set API_KEY or provide it in policy TOML."
            )
