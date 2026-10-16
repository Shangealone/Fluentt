import pytest

from app.models.assessments import ANSWER_METHODS
from app.schemas.question_config import (
    CONFIG_MODELS,
    RESPONSE_MODELS,
    validate_content,
    validate_definition,
    validate_response,
)

ITEMS = [{"id": "a", "text": "First"}, {"id": "b", "text": "Second"}]
EXAMPLES = [
    ("multiple_choice", {"options": ITEMS}, {"correct_option_id": "a"}),
    ("true_false", {}, {"value": True}),
    ("identification", {}, {"accepted_answers": ["example"]}),
    ("fill_in_the_blank", {"blank_ids": ["gap"]}, {"accepted_answers": {"gap": ["word"]}}),
    ("multiple_select", {"options": ITEMS}, {"correct_option_ids": ["a", "b"]}),
    ("flashcards", {"cue": "A synthetic cue"}, {"back": "A synthetic answer"}),
    ("error_identification", {"tokens": ITEMS}, {"error_token_ids": ["b"]}),
    ("word_arrangement", {"items": ITEMS}, {"ordered_ids": ["b", "a"]}),
    ("sentence_arrangement", {"items": ITEMS}, {"ordered_ids": ["a", "b"]}),
    (
        "matching_type",
        {"left": ITEMS, "right": ITEMS},
        {"pairs": [{"left_id": "a", "right_id": "b"}, {"left_id": "b", "right_id": "a"}]},
    ),
]


def test_exactly_ten_contracts():
    assert set(CONFIG_MODELS) == set(ANSWER_METHODS)
    assert set(RESPONSE_MODELS) == set(ANSWER_METHODS)
    assert len(CONFIG_MODELS) == 10


@pytest.mark.parametrize("method,content,key", EXAMPLES)
def test_valid_question_storage_contract(method, content, key):
    validate_definition(method, content, key)


@pytest.mark.parametrize(
    "method,content,key",
    [
        ("multiple_choice", {"options": ITEMS}, {"correct_option_id": "missing"}),
        ("multiple_select", {"options": ITEMS}, {"correct_option_ids": ["a", "a"]}),
        ("word_arrangement", {"items": ITEMS}, {"ordered_ids": ["a", "a"]}),
        ("fill_in_the_blank", {"blank_ids": ["gap"]}, {"accepted_answers": {"other": ["answer"]}}),
        ("true_false", {}, {"value": "true"}),
        (
            "matching_type",
            {"left": ITEMS, "right": ITEMS},
            {"pairs": [{"left_id": "a", "right_id": "b"}, {"left_id": "a", "right_id": "a"}]},
        ),
    ],
)
def test_invalid_configuration_is_rejected(method, content, key):
    with pytest.raises(ValueError):
        validate_definition(method, content, key)


def test_unsupported_method_and_duplicate_items():
    with pytest.raises(ValueError):
        validate_content("unsupported", {})
    with pytest.raises(ValueError):
        validate_content("multiple_choice", {"options": [ITEMS[0], ITEMS[0]]})


RESPONSES = [
    {"option_id": "a"},
    {"value": True},
    {"text": "synthetic"},
    {"blanks": [{"blank_id": "gap", "text": "word"}]},
    {"option_ids": ["a"]},
    {"recall": "good"},
    {"selected_token_ids": ["b"]},
    {"ordered_token_ids": ["b", "a"]},
    {"ordered_sentence_ids": ["a", "b"]},
    {"pairs": [{"left_id": "a", "right_id": "b"}]},
]


@pytest.mark.parametrize("example,answer", zip(EXAMPLES, RESPONSES))
def test_structural_student_answer_contract(example, answer):
    method, content, _ = example
    validate_response(method, content, answer)


def test_student_answer_rejects_unknown_and_duplicate_identifiers():
    with pytest.raises(ValueError):
        validate_response("multiple_choice", {"options": ITEMS}, {"option_id": "missing"})
    with pytest.raises(ValueError):
        validate_response("multiple_select", {"options": ITEMS}, {"option_ids": ["a", "a"]})
