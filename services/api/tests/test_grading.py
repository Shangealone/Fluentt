"""Synthetic policy fixtures: these demonstrate implementation, not academic validation."""

from copy import deepcopy
from decimal import Decimal, localcontext
from dataclasses import FrozenInstanceError
import pytest
from app.modules.grading.engine import evaluate, aggregate, automatic, Outcome, POLICY_VERSION, ENGINE_VERSION
from app.modules.grading.schemas import EvaluationInput
from tests.test_question_config import EXAMPLES

CORRECT = {
    "multiple_choice": {"option_id": "a"},
    "true_false": {"value": True},
    "identification": {"text": "example"},
    "fill_in_the_blank": {"blanks": [{"blank_id": "gap", "text": "word"}]},
    "multiple_select": {"option_ids": ["b", "a"]},
    "flashcards": {"recall": "again"},
    "error_identification": {"selected_token_ids": ["b"]},
    "word_arrangement": {"ordered_token_ids": ["b", "a"]},
    "sentence_arrangement": {"ordered_sentence_ids": ["a", "b"]},
    "matching_type": {"pairs": [{"left_id": "b", "right_id": "a"}, {"left_id": "a", "right_id": "b"}]},
}


@pytest.mark.parametrize("method,content,key", EXAMPLES)
def test_correct_policy_and_no_mutation(method, content, key):
    evidence = deepcopy((content, key, CORRECT[method]))
    before = deepcopy(evidence)
    result = evaluate(method, *evidence)
    assert evidence == before
    if method == "flashcards":
        assert result.state == "NOT_APPLICABLE" and result.awarded_points is None and result.max_points is None
    else:
        assert result.state == "AUTO_GRADABLE" and result.correct is True
        assert result.awarded_points == result.max_points == Decimal("1.00")
    with pytest.raises(FrozenInstanceError):
        result.reason = "changed"


@pytest.mark.parametrize("method,content,key", EXAMPLES)
def test_missing_answers_are_zero_only_for_objective_methods(method, content, key):
    result = evaluate(method, content, key, None)
    assert result.awarded_points == (None if method == "flashcards" else Decimal("0.00"))


@pytest.mark.parametrize(
    "sensitive,answer,accepted,correct",
    [
        (False, "TAGALOG", "Tagalog", True),
        (True, "TAGALOG", "Tagalog", False),
        (False, "Straße", "STRASSE", True),
        (False, "Ñ", "ñ", True),
        (False, " tagalog", "tagalog", False),
        (False, "tagalog!", "tagalog", False),
        (False, "n", "ñ", False),
        (False, "e\u0301", "é", False),
    ],
)
def test_only_explicit_casefold_no_other_normalization(sensitive, answer, accepted, correct):
    result = evaluate(
        "identification", {}, {"accepted_answers": [accepted], "case_sensitive": sensitive}, {"text": answer}
    )
    assert result.correct is correct


@pytest.mark.parametrize(
    "method,answer",
    [
        ("multiple_choice", {"option_id": "b"}),
        ("true_false", {"value": False}),
        ("fill_in_the_blank", {"blanks": [{"blank_id": "gap", "text": "Word"}]}),
        ("fill_in_the_blank", {"blanks": [{"blank_id": "gap", "text": " word"}]}),
        ("multiple_select", {"option_ids": ["a"]}),
        ("multiple_select", {"option_ids": []}),
        ("error_identification", {"selected_token_ids": ["a", "b"]}),
        ("word_arrangement", {"ordered_token_ids": ["a"]}),
        ("word_arrangement", {"ordered_token_ids": ["a", "b"]}),
        ("sentence_arrangement", {"ordered_sentence_ids": ["b", "a"]}),
        ("matching_type", {"pairs": [{"left_id": "a", "right_id": "a"}, {"left_id": "b", "right_id": "b"}]}),
    ],
)
def test_no_partial_credit_or_penalties(method, answer):
    _, content, key = next(row for row in EXAMPLES if row[0] == method)
    result = evaluate(method, content, key, answer)
    assert result.state == "AUTO_GRADABLE" and result.awarded_points == Decimal("0.00")


@pytest.mark.parametrize(
    "change,state",
    [
        ({"schema_version": 2}, "UNSUPPORTED"),
        ({"policy_version": "unknown"}, "UNSUPPORTED"),
        ({"revision_locked": False}, "MANUAL_REVIEW_REQUIRED"),
        ({"key_locked": False}, "MANUAL_REVIEW_REQUIRED"),
        ({"source_grading_version": "unknown-rubric"}, "UNSUPPORTED"),
    ],
)
def test_version_and_lock_failures_are_explicit(change, state):
    assert evaluate("true_false", {}, {"value": True}, {"value": True}, **change).state == state


def test_missing_inconsistent_and_malformed_evidence_requires_review():
    assert evaluate("true_false", {}, None, {"value": True}).state == "MANUAL_REVIEW_REQUIRED"
    assert evaluate("true_false", {}, {"value": "true"}, {"value": True}).reason == "inconsistent_key"
    assert evaluate("true_false", {}, {"value": True}, {"value": "true"}).reason == "invalid_content_or_response"
    assert evaluate("unknown", {}, {}, {}).state == "UNSUPPORTED"
    assert evaluate("flashcards", {"cue": "Synthetic"}, None, None).state == "MANUAL_REVIEW_REQUIRED"
    # A named rubric is not approval to score recall, including a missing recall.
    assert (
        evaluate(
            "flashcards", {"cue": "Synthetic"}, {"back": "Private", "scoring_rubric_version": "named-only"}, None
        ).state
        == "NOT_APPLICABLE"
    )


def test_multiblank_exact_mapping_and_authored_alternatives():
    content = {"blank_ids": ["a", "b"]}
    key = {"accepted_answers": {"a": ["Una", "First"], "b": ["Ikalawa"]}}
    answer = {"blanks": [{"blank_id": "b", "text": "Ikalawa"}, {"blank_id": "a", "text": "First"}]}
    assert evaluate("fill_in_the_blank", content, key, answer).correct
    assert not evaluate("fill_in_the_blank", content, key, {"blanks": answer["blanks"][:1]}).correct
    assert (
        evaluate("fill_in_the_blank", content, key, {"blanks": answer["blanks"] * 2}).state == "MANUAL_REVIEW_REQUIRED"
    )


def test_decimal_totals_unresolved_states_and_zero_denominator():
    assert ENGINE_VERSION.startswith("objective-engine-v1-u") and POLICY_VERSION == "objective-exact-v1"
    assert aggregate([automatic(True, "fixture")] * 200)["earned_points"] == Decimal("200.00")
    with localcontext() as hostile_context:
        hostile_context.prec = 1
        assert aggregate([automatic(True, "fixture")] * 200)["earned_points"] == Decimal("200.00")
    mixed = aggregate(
        [automatic(True, "fixture"), automatic(False, "fixture"), Outcome("MANUAL_REVIEW_REQUIRED", "fixture")]
    )
    assert mixed["status"] == "REVIEW_REQUIRED" and mixed["earned_points"] is None and mixed["possible_points"] is None
    assert mixed["automatic_earned_points"] == Decimal("1.00") and mixed["automatic_possible_points"] == Decimal("2.00")
    assert aggregate([Outcome("UNSUPPORTED", "fixture")])["status"] == "REVIEW_REQUIRED"
    empty = aggregate([Outcome("NOT_APPLICABLE", "fixture")])
    assert (
        empty["status"] == "NOT_APPLICABLE"
        and empty["earned_points"] is None
        and empty["automatic_possible_points"] == Decimal("0.00")
    )
    with pytest.raises(ValueError):
        EvaluationInput.model_validate({"policy_version": "other", "score": 100})
