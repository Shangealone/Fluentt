"""Offline decision comparison only. No repository, API registration or writes."""
from copy import deepcopy
from dataclasses import asdict
import math
from time import perf_counter

from .features import HistoryEntry, history_before
from .inference import Prediction, prediction_for, provider_ready
from .scheduler import schedule_review
from .schemas import CardDefinition


def compare_shadow(state, rating, reviewed_at, configuration, *, provider, expected_artifact_sha256,
                   history, scope, candidate, question_format):
    """Metadata compatibility is necessary, not proof of scientific validation.

    Callers must supply authorized, independently validated inputs. This helper
    deliberately has no connection to classroom records or treatment activation.
    """
    started = perf_counter()
    baseline = schedule_review(deepcopy(state), rating, reviewed_at, "fsrs6", configuration, prediction=None)
    prediction = Prediction(None, "model_unavailable")
    valid_history = (isinstance(history, (list, tuple))
                     and isinstance(scope, tuple) and len(scope) == 4 and all(isinstance(x, str) and x for x in scope)
                     and all(isinstance(row, HistoryEntry) and row.scope == scope
                             and row.reviewed_at.tzinfo is not None and row.reviewed_at < reviewed_at
                             and row.format in {"multiple_choice", "typed_recall"}
                             and type(row.correct) is bool and row.content_version > 0 and row.revision > 0
                             for row in history))
    try:
        ready = provider_ready(provider)
    except (TypeError, AttributeError):
        ready = False
    if question_format not in {"multiple_choice", "typed_recall"} or not isinstance(candidate, CardDefinition):
        prediction = Prediction(None, "candidate_features_invalid")
    elif not valid_history:
        prediction = Prediction(None, "history_invalid")
    elif ready:
        if provider.artifact_sha256 != expected_artifact_sha256:
            prediction = Prediction(None, "artifact_mismatch", provider.version, provider.artifact_sha256)
        else:
            prediction = prediction_for(provider, history_before(history, scope, reviewed_at), candidate,
                                        question_format, reviewed_at, configuration, baseline.interval_days)
    proposed = schedule_review(deepcopy(state), rating, reviewed_at, "esr", configuration,
                               prediction=prediction.probability, fallback_reason=prediction.reason)
    if proposed.memory_state != baseline.memory_state:
        raise RuntimeError("Shadow comparison changed baseline memory dynamics")
    retrievability = baseline.memory_state.get("retrievability")
    if not isinstance(retrievability, (int, float)) or not math.isfinite(retrievability):
        retrievability = None
    return dict(mode="offline_shadow_only", applied=False,
                baseline=asdict(baseline), proposed=asdict(proposed),
                fsrs_pre_review_retrievability=retrievability,
                model=asdict(prediction), inference_horizon_days=baseline.interval_days,
                interval_difference_days=proposed.interval_days-baseline.interval_days,
                elapsed_ms=(perf_counter()-started)*1000)
