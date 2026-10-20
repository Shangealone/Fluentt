"""Spaced repetition engine package.

Includes the shared scheduler interfaces, SM-2 scheduling engine, review event ingestion,
and due review querying.
"""

from app.modules.spaced_repetition.registry import BaseScheduler, AlgorithmRegistry, registry
from app.modules.spaced_repetition.sm2 import SM2Scheduler, calculate_sm2, sm2_scheduler
from app.modules.spaced_repetition.fsrs6 import (
    FSRS6Scheduler,
    calculate_fsrs6,
    fsrs6_scheduler,
    FSRS6_DEFAULT_PARAMETERS,
)
from app.modules.spaced_repetition.fifakt_features import (
    FIFAKTFeatureVector,
    extract_features_from_state,
    extract_features_from_event_history,
)
from app.modules.spaced_repetition.fifakt_model import (
    FIFAKTInferenceOutput,
    FIFAKTModelInterface,
    SimulatedFIFAKTModel,
)
from app.modules.spaced_repetition.fifakt import (
    ESRScheduler,
    calculate_fifakt_esr,
    fifakt_esr_scheduler,
)

__all__ = [
    "BaseScheduler",
    "AlgorithmRegistry",
    "registry",
    "SM2Scheduler",
    "sm2_scheduler",
    "calculate_sm2",
    "FSRS6Scheduler",
    "fsrs6_scheduler",
    "calculate_fsrs6",
    "FSRS6_DEFAULT_PARAMETERS",
    "FIFAKTFeatureVector",
    "extract_features_from_state",
    "extract_features_from_event_history",
    "FIFAKTInferenceOutput",
    "FIFAKTModelInterface",
    "SimulatedFIFAKTModel",
    "ESRScheduler",
    "calculate_fifakt_esr",
    "fifakt_esr_scheduler",
]

