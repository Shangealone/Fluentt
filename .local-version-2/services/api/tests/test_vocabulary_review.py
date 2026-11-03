"""Review evidence/interval contracts, independent of participant records."""
from datetime import datetime, timezone
from uuid import uuid4
import pytest
from app.modules.vocabulary_review.policy import check_answer, effective_rating, assigned_condition
from app.modules.vocabulary_review.schemas import CardDefinition, HybridConfiguration
from app.modules.vocabulary_review.scheduler import schedule_review
from app.modules.vocabulary_review.features import HistoryEntry, history_before
from app.modules.vocabulary_review.inference import prediction_for

NOW = datetime(2026, 11, 2, 9, tzinfo=timezone.utc)


def card(**changes):
    value = dict(vocabulary_item_id=uuid4(), content_version=1, term="café", meaning="coffee shop",
                 typed_prompt="Write the word for a coffee shop.", accepted_forms=["café"],
                 choice_prompt="Choose the word for a coffee shop.",
                 options=[dict(id="a", text="café"), dict(id="b", text="school")], correct_option_id="a")
    return CardDefinition(**(value | changes))


def config():
    return HybridConfiguration(reference_probability=.9, sensitivity=.5, minimum_factor=.8,
                               maximum_factor=1.2, maximum_interval_days=365, minimum_history=3,
                               timezone="Asia/Manila", allowed_weekdays=[0, 1, 2, 3, 4])


def test_typed_recall_preserves_accents_and_internal_spaces():
    assert check_answer(card(), "typed_recall", " CAFE\u0301 ").correct
    assert not check_answer(card(), "typed_recall", "cafe").correct
    assert not check_answer(card(accepted_forms=["good morning"]), "typed_recall", "good  morning").correct
    with pytest.raises(ValueError):
        check_answer(card(), "typed_recall", "  ")


def test_choice_ids_and_ratings_are_distinct_from_correctness():
    assert check_answer(card(), "multiple_choice", "a").correct
    assert not check_answer(card(), "multiple_choice", "b").correct
    with pytest.raises(ValueError):
        check_answer(card(), "multiple_choice", "café")
    assert effective_rating(False, "easy") == "again"
    assert effective_rating(True, "hard") == "hard"


def test_mapping_is_counterbalanced_without_unknown_fallback():
    assert assigned_condition(1, "A") == "fsrs6"
    assert assigned_condition(1, "B") == "esr"
    assert assigned_condition(2, "A") == "esr"
    assert assigned_condition(2, "B") == "fsrs6"
    with pytest.raises(ValueError):
        assigned_condition(3, "A")


def test_missing_prediction_preserves_exact_baseline():
    control = schedule_review(None, "good", NOW, "fsrs6", config(), prediction=None)
    hybrid = schedule_review(None, "good", NOW, "esr", config(), prediction=None)
    assert hybrid.memory_state == control.memory_state
    assert hybrid.interval_days == control.interval_days
    assert hybrid.due_at == control.due_at
    assert hybrid.fallback_reason == "prediction_unavailable"


def test_interval_fusion_does_not_rewrite_memory_stability():
    control = schedule_review(None, "easy", NOW, "fsrs6", config(), prediction=None)
    hybrid = schedule_review(None, "easy", NOW, "esr", config(), prediction=.3)
    assert hybrid.memory_state == control.memory_state
    assert hybrid.adjustment_factor == pytest.approx(.8)
    assert hybrid.interval_days <= control.interval_days
    assert hybrid.fallback_reason is None


def test_nonfinite_predictions_fall_back():
    row = schedule_review(None, "good", NOW, "esr", config(), prediction=float("nan"))
    assert row.fallback_reason == "prediction_invalid"
    assert row.adjustment_factor == 1


def test_invalid_choices_and_empty_calendar_are_rejected():
    with pytest.raises(ValueError):
        card(options=[dict(id="a", text="same"), dict(id="b", text="same")])
    with pytest.raises(ValueError):
        HybridConfiguration(**(config().model_dump() | {"allowed_weekdays": []}))


def test_history_is_condition_scoped_and_excludes_current_or_future_answers():
    from datetime import timedelta
    scope = tuple(str(uuid4()) for _ in range(4))
    row = HistoryEntry(scope=scope, item_id=str(uuid4()), content_version=1,
                       format="typed_recall", reviewed_at=NOW-timedelta(days=1), correct=True, revision=1)
    future = HistoryEntry(**(row.__dict__ | {"reviewed_at": NOW}))
    foreign = HistoryEntry(**(row.__dict__ | {"scope": ("foreign", *scope[1:])}))
    assert history_before([future, foreign, row], scope, NOW) == [row]


def test_prediction_gate_never_invokes_a_simulated_provider():
    class Simulated:
        simulated = True
        def predict(self, *args):
            raise AssertionError("Simulated inference must not be used.")
    result = prediction_for(Simulated(), [], card(), "typed_recall", NOW, config())
    assert result.probability is None
    assert result.reason == "model_unavailable"


def test_prediction_targets_the_format_of_the_next_encounter():
    from app.modules.vocabulary_review.policy import format_for
    assert format_for(0, 1) == "multiple_choice"
    assert format_for(0, 2) == "typed_recall"
    assert format_for(1, 1) == "typed_recall"
    with pytest.raises(ValueError):
        format_for(0, 0)
