"""An actual calibrated provider must be installed explicitly; there is no simulation default."""
from dataclasses import dataclass
from datetime import datetime
import math
from typing import Protocol


class PredictionProvider(Protocol):
    simulated: bool
    ready: bool
    artifact_sha256: str
    version: str
    prediction_contract: str

    def predict(self, history, candidate, question_format: str, as_of: datetime, horizon_days: int) -> float: ...


@dataclass(frozen=True)
class Prediction:
    probability: float | None
    reason: str | None
    model_version: str | None = None
    artifact_sha256: str | None = None


def provider_ready(provider) -> bool:
    import re
    return bool(provider is not None and getattr(provider, "simulated", True) is False
                and getattr(provider, "ready", False) is True
                and getattr(provider, "prediction_contract", None) == "future-recall-probability-v1"
                and isinstance(getattr(provider, "version", None), str) and provider.version.strip()
                and re.fullmatch(r"[0-9a-f]{64}", getattr(provider, "artifact_sha256", "")))


def prediction_for(provider, history, candidate, question_format, as_of, configuration, horizon_days=1) -> Prediction:
    if not provider_ready(provider):
        return Prediction(None, "model_unavailable")
    if len(history) < configuration.minimum_history:
        return Prediction(None, "insufficient_history", provider.version, provider.artifact_sha256)
    try:
        value = provider.predict(history, candidate, question_format, as_of, horizon_days)
    except Exception:
        # Do not expose model paths, tensors, private data, or provider errors to clients.
        return Prediction(None, "inference_failed", provider.version, provider.artifact_sha256)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1:
        return Prediction(None, "prediction_invalid", provider.version, provider.artifact_sha256)
    return Prediction(float(value), None, provider.version, provider.artifact_sha256)
