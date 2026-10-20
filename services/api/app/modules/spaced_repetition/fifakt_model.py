"""FIFAKT Model Contract and Reference Simulation Adapter.

Defines the typed inference envelope and simulated adapter for the FIFAKT
(Feature-Informed / Factorized Interaction / Forgetting-Aware Knowledge Tracing) model.

Scientific Integrity Policy:
Per repository instructions (AGENTS.md, AI_INTEGRATION_PLAN.md, DECISIONS.md):
- No pre-trained weights or empirical training datasets currently exist in this repository.
- Therefore, the model adapter is explicitly designated as `simulated: True`.
- Outputs are bounded, deterministic, and reproduce reference cognitive decay dynamics
  without claiming empirical accuracy or DepEd verification.
"""

import math
from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel, ConfigDict, Field

from app.modules.spaced_repetition.fifakt_features import FIFAKTFeatureVector


class FIFAKTInferenceOutput(BaseModel):
    """Structured, typed inference result from FIFAKT knowledge tracing."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    predicted_retrievability: float = Field(
        ge=0.0, le=1.0, description="Predicted probability that the learner retains the vocabulary item."
    )
    mastery_level: float = Field(
        ge=0.0, le=1.0, description="Estimated latent knowledge mastery state of the skill/concept."
    )
    uncertainty: float = Field(
        ge=0.0, le=1.0, description="Predictive uncertainty indicator (higher for sparse histories)."
    )
    model_name: str
    model_version: str
    simulated: bool = Field(
        default=True, description="Strictly true when using an uncalibrated synthetic reference adapter."
    )
    fallback_to_base: bool = Field(
        default=False, description="True if an error or degradation caused fallback to base scheduler calculations."
    )
    metadata: dict[str, Any] = Field(default_factory=dict)


class FIFAKTModelInterface(ABC):
    """Abstract contract for FIFAKT knowledge tracing inference providers."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        pass

    @property
    @abstractmethod
    def model_version(self) -> str:
        pass

    @property
    @abstractmethod
    def is_simulated(self) -> bool:
        pass

    @abstractmethod
    def predict(self, features: FIFAKTFeatureVector) -> FIFAKTInferenceOutput:
        """Computes knowledge retention probability and latent mastery from the feature vector."""
        pass


class SimulatedFIFAKTModel(FIFAKTModelInterface):
    """Reference implementation of FIFAKT knowledge tracing.
    
    Provides bounded, deterministic predictions based on:
    1. Base mastery initialized from prior success rate and reinforced by consecutive successes.
    2. Power forgetting decay across elapsed time scaled by card stability.
    3. Latency indicators (response duration) penalizing hesitation and rewarding fluency.
    4. Explicit simulated flag and version metadata.
    """

    def __init__(
        self,
        model_name: str = "fifakt",
        model_version: str = "fifakt-simulated-v1",
    ):
        self._model_name = model_name
        self._model_version = model_version

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def model_version(self) -> str:
        return self._model_version

    @property
    def is_simulated(self) -> bool:
        return True

    def predict(self, features: FIFAKTFeatureVector) -> FIFAKTInferenceOutput:
        # 1. Base latent mastery estimation
        # Starts from 0.45 baseline, scales with prior success rate, consecutive successes, and lapses
        base_mastery = (
            0.45
            + 0.40 * features.prior_success_rate
            + 0.04 * min(5, features.consecutive_successes)
            - 0.07 * min(5, features.total_lapses)
        )
        mastery = max(0.10, min(0.95, base_mastery))

        # 2. Time decay factor
        t_days = features.elapsed_seconds / 86400.0
        if t_days > 0.0:
            eff_s = max(0.5, features.card_stability)
            # Power forgetting decay
            decay_factor = math.pow(1.0 + 0.15 * (t_days / eff_s), -0.5)
            p_decay = mastery * decay_factor
        else:
            p_decay = mastery

        # 3. Response duration latency effect
        # Normal latency: 1500ms - 4000ms. Extended latency (> 8000ms) indicates hesitation.
        latency_adj = 0.0
        if features.current_response_duration_ms > 8000:
            latency_adj = -0.06
        elif features.current_response_duration_ms < 2000 and features.current_rating in ("good", "easy"):
            latency_adj = 0.04

        # 4. Integrate current rating signal via smooth shift
        rating_shifts = {
            "again": -0.35,
            "hard": -0.10,
            "good": 0.05,
            "easy": 0.15,
        }
        shift = rating_shifts.get(features.current_rating, 0.0)
        raw_p = p_decay + shift + latency_adj

        # Clamp retrievability strictly between 0.01 and 0.99
        predicted_r = max(0.01, min(0.99, raw_p))

        # 5. Uncertainty estimation (higher when review count is low)
        uncertainty = max(0.05, min(1.0, 0.60 * math.exp(-0.30 * features.total_reviews)))

        return FIFAKTInferenceOutput(
            predicted_retrievability=round(predicted_r, 4),
            mastery_level=round(mastery, 4),
            uncertainty=round(uncertainty, 4),
            model_name=self._model_name,
            model_version=self._model_version,
            simulated=True,
            fallback_to_base=False,
            metadata={
                "uncalibrated": True,
                "reference_adapter": True,
                "feature_count": 13,
                "time_decay_applied": t_days > 0.0,
            },
        )
