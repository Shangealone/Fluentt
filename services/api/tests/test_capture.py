from copy import deepcopy
import pytest
from app.schemas.capture import validate_capture, complete
from app.modules.assignments.capture_schemas import SubmitInput
from tests.test_question_config import EXAMPLES
from tests.integration.test_response_capture_postgresql import ANSWERS


@pytest.mark.parametrize("method,content,key", EXAMPLES)
def test_ten_structural_contracts_preserve_raw_answers_without_grading(method, content, key):
    answer = deepcopy(ANSWERS[method])
    before = deepcopy(answer)
    validate_capture(method, content, answer)
    assert complete(method, content, answer) and answer == before


@pytest.mark.parametrize(
    "method,content,answer",
    [
        ("identification", {}, {"text": "  \t "}),
        ("fill_in_the_blank", {"blank_ids": ["a", "b"]}, {"blanks": [{"blank_id": "a", "text": "ñ"}]}),
        ("multiple_select", {"options": [{"id": "a", "text": "A"}, {"id": "b", "text": "B"}]}, {"option_ids": []}),
        (
            "word_arrangement",
            {"items": [{"id": "a", "text": "A"}, {"id": "b", "text": "B"}]},
            {"ordered_token_ids": ["a"]},
        ),
    ],
)
def test_partial_buffers_are_valid_and_incomplete(method, content, answer):
    validate_capture(method, content, answer)
    assert not complete(method, content, answer)


@pytest.mark.parametrize(
    "method,content,answer",
    [
        ("identification", {}, {"text": "\ud800"}),
        ("identification", {"input_max_length": 2}, {"text": "ñ😀a"}),
        ("identification", {}, {"text": 1}),
        ("identification", {}, {"text": "a", "correct": True}),
        ("fill_in_the_blank", {"blank_ids": ["a"]}, {"blanks": [{"blank_id": "missing", "text": ""}]}),
        ("fill_in_the_blank", {"blank_ids": ["a"]}, {"blanks": [{"blank_id": "a", "text": ""}] * 2}),
        ("true_false", {}, {"value": "false"}),
    ],
)
def test_invalid_capture_fields_and_unicode_are_rejected(method, content, answer):
    with pytest.raises(ValueError):
        validate_capture(method, content, answer)


@pytest.mark.parametrize("confirm", [False, 1, "true", None])
def test_explicit_submit_confirmation(confirm):
    with pytest.raises(ValueError):
        SubmitInput.model_validate({"position": 1, "responses": [], "confirm": confirm})
