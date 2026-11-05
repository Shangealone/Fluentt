"""Synthetic shadow contracts, not real model or retention evidence."""
from copy import deepcopy
from dataclasses import replace
from datetime import timedelta
from types import SimpleNamespace

import pytest

from app.modules.vocabulary_review.features import HistoryEntry
from app.modules.vocabulary_review.shadow import compare_shadow
from tests.test_vocabulary_review import NOW, card, config

SCOPE = ("synthetic-study", "synthetic-participant", "pool", "configuration")


def provider(value=.3):
    def predict(*args):
        if isinstance(value, Exception):
            raise value
        return value
    return SimpleNamespace(ready=True, simulated=False, version="synthetic-test-only-v1",
                           artifact_sha256="a"*64, prediction_contract="future-recall-probability-v1", predict=predict)


def compare(model=None, history=None, state=None, rating="easy", **changes):
    past = [HistoryEntry(SCOPE, "item", 1, "typed_recall", NOW-timedelta(days=i+1), True, i+1) for i in range(3)]
    args = dict(provider=model, expected_artifact_sha256="a"*64, history=past if history is None else history,
                scope=SCOPE, candidate=card(), question_format="typed_recall")
    return compare_shadow(state, rating, NOW, config(), **(args | changes))


def test_shadow_preserves_input_and_baseline_memory():
    state = {"stability": 12., "difficulty": 5., "repetitions": 3, "last_reviewed_at": (NOW-timedelta(days=10)).isoformat()}
    before = deepcopy(state)
    result = compare(provider(), state=state)
    assert state == before
    assert result["baseline"]["memory_state"] == result["proposed"]["memory_state"]
    assert result["applied"] is False
    assert result["model"]["model_version"] == "synthetic-test-only-v1"
    assert result["model"]["artifact_sha256"] == "a"*64


@pytest.mark.parametrize("value", [None, float("nan"), float("inf"), -.1, 1.1, True, RuntimeError("private-path")])
def test_failed_predictions_preserve_exact_baseline(value):
    result = compare(provider(value))
    assert result["proposed"]["interval_days"] == result["baseline"]["interval_days"]
    assert result["proposed"]["due_at"] == result["baseline"]["due_at"]
    assert result["model"]["reason"] in {"prediction_invalid", "inference_failed"}
    assert "private-path" not in str(result)


@pytest.mark.parametrize("value", [0., .3, 1.])
def test_bounds_and_lapse_invariant(value):
    result = compare(provider(value), rating="again")
    assert config().minimum_factor <= result["proposed"]["adjustment_factor"] <= 1
    assert 1 <= result["proposed"]["interval_days"] <= result["baseline"]["interval_days"]


def test_missing_or_incompatible_model_never_infers():
    for model in (None, provider()):
        if model:
            model.prediction_contract = "observed-session-recall-proportion-v2"
            model.predict = lambda *args: pytest.fail("Incompatible model invoked")
        result = compare(model)
        assert result["model"]["reason"] == "model_unavailable"


def test_artifact_mismatch_never_infers():
    model = provider()
    model.predict = lambda *args: pytest.fail("Wrong model invoked")
    assert compare(model, expected_artifact_sha256="b"*64)["model"]["reason"] == "artifact_mismatch"


def test_sparse_and_invalid_inputs():
    assert compare(provider(), history=[])["model"]["reason"] == "insufficient_history"
    assert compare(provider(), question_format="guessed")["model"]["reason"] == "candidate_features_invalid"
    assert compare(provider(), candidate=None)["model"]["reason"] == "candidate_features_invalid"
    assert compare(provider(), candidate="unmapped")["model"]["reason"] == "candidate_features_invalid"
    assert compare(provider(), history="not-a-sequence")["model"]["reason"] == "history_invalid"
    malformed = provider()
    malformed.artifact_sha256 = 123
    assert compare(malformed)["model"]["reason"] == "model_unavailable"
    row = HistoryEntry(SCOPE, "item", 1, "typed_recall", NOW, True, 1)
    for bad in (row, replace(row, scope=("foreign", *SCOPE[1:])), replace(row, reviewed_at=NOW.replace(tzinfo=None))):
        assert compare(provider(), history=[bad])["model"]["reason"] == "history_invalid"
