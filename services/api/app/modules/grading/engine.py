"""Pure deterministic policy; no database, authentication, key release or response mutation."""

from dataclasses import dataclass
from decimal import Decimal, localcontext
import unicodedata
from app.schemas.question_config import CONFIG_MODELS, validate_content, validate_definition
from app.schemas.capture import validate_capture, complete

POLICY_VERSION = "objective-exact-v1"
ENGINE_VERSION = "objective-engine-v1-u" + unicodedata.unidata_version
POINT = Decimal("1.00")
ZERO = Decimal("0.00")
POLICY = {
    "version": POLICY_VERSION,
    "point_unit": "1.00",
    "partial_credit": False,
    "penalties": False,
    "choice": "exact_id",
    "boolean": "strict_boolean",
    "sets": "exact_unordered",
    "arrangement": "exact_id_sequence",
    "matching": "exact_complete_id_mapping",
    "identification": "authored_strings; casefold_only_when_case_sensitive_false",
    "blanks": "all_gaps_exact_case_sensitive",
    "text_normalization": "none_other_than_explicit_casefold",
    "unicode_version": unicodedata.unidata_version,
    "missing_or_incomplete": "zero",
    "flashcards": "not_applicable",
    "totals_with_unresolved_items": "unset",
    "context": "ordinary_classroom",
    "release": "none",
}


@dataclass(frozen=True)
class Outcome:
    state: str
    reason: str
    correct: bool | None = None
    awarded_points: Decimal | None = None
    max_points: Decimal | None = None


def automatic(correct, reason):
    return Outcome("AUTO_GRADABLE", reason, bool(correct), POINT if correct else ZERO, POINT)


def evaluate(
    method,
    content,
    key,
    answer,
    *,
    schema_version=1,
    revision_locked=True,
    key_locked=True,
    source_grading_version="ungraded-v1",
    policy_version=POLICY_VERSION,
):
    if (
        type(schema_version) is not int
        or schema_version != 1
        or not isinstance(method, str)
        or method not in CONFIG_MODELS
        or policy_version != POLICY_VERSION
    ):
        return Outcome("UNSUPPORTED", "unsupported_schema_method_or_policy")
    if not revision_locked:
        return Outcome("MANUAL_REVIEW_REQUIRED", "unlocked_revision")
    try:
        validate_content(method, content)
        if answer is not None:
            validate_capture(method, content, answer)
    except (ValueError, TypeError, KeyError, AttributeError):
        return Outcome("MANUAL_REVIEW_REQUIRED", "invalid_content_or_response")
    if key is None or not key_locked:
        return Outcome("MANUAL_REVIEW_REQUIRED", "missing_or_unlocked_key")
    if source_grading_version != "ungraded-v1":
        return Outcome("UNSUPPORTED", "unsupported_source_key_contract")
    try:
        validate_definition(method, content, key)
    except (ValueError, TypeError, KeyError, AttributeError):
        return Outcome("MANUAL_REVIEW_REQUIRED", "inconsistent_key")
    if method == "flashcards":
        return Outcome("NOT_APPLICABLE", "subjective_recall_not_objective")
    if answer is None:
        return automatic(False, "missing_response")
    if not complete(method, content, answer):
        return automatic(False, "incomplete_response")
    if method == "multiple_choice":
        correct = answer["option_id"] == key["correct_option_id"]
    elif method == "true_false":
        correct = answer["value"] is key["value"]
    elif method == "identification":
        raw = answer["text"]
        accepted = key["accepted_answers"]
        correct = (
            raw in accepted
            if key.get("case_sensitive", False)
            else raw.casefold() in [value.casefold() for value in accepted]
        )
    elif method == "fill_in_the_blank":
        values = {entry["blank_id"]: entry["text"] for entry in answer["blanks"]}
        correct = all(values[id] in key["accepted_answers"][id] for id in content["blank_ids"])
    elif method == "multiple_select":
        correct = set(answer["option_ids"]) == set(key["correct_option_ids"])
    elif method == "error_identification":
        correct = set(answer["selected_token_ids"]) == set(key["error_token_ids"])
    elif method in {"word_arrangement", "sentence_arrangement"}:
        field = "ordered_token_ids" if method == "word_arrangement" else "ordered_sentence_ids"
        correct = answer[field] == key["ordered_ids"]
    else:

        def pairs(entries):
            return {(entry["left_id"], entry["right_id"]) for entry in entries}

        correct = pairs(answer["pairs"]) == pairs(key["pairs"])
    return automatic(correct, "exact_match" if correct else "exact_mismatch")


def aggregate(outcomes):
    with localcontext() as arithmetic:
        arithmetic.prec = 28
        earned = sum((row.awarded_points for row in outcomes if row.state == "AUTO_GRADABLE"), ZERO)
        maximum = sum((row.max_points for row in outcomes if row.state == "AUTO_GRADABLE"), ZERO)
    unresolved = any(row.state in {"MANUAL_REVIEW_REQUIRED", "UNSUPPORTED"} for row in outcomes)
    status = "REVIEW_REQUIRED" if unresolved else "COMPLETE" if maximum else "NOT_APPLICABLE"
    return dict(
        status=status,
        automatic_earned_points=earned,
        automatic_possible_points=maximum,
        earned_points=earned if status == "COMPLETE" else None,
        possible_points=maximum if status == "COMPLETE" else None,
    )
