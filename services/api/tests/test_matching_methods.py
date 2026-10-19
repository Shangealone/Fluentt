"""Synthetic matching fixtures: existing V1 bijections, not grading."""

import pytest
from pydantic import TypeAdapter

from app.modules.questions.schemas import Definition, Preview, PUBLIC_MODELS, Response
from app.schemas.question_config import validate_response
from tests.test_question_bank import definition

ROWS = [{"id": "a", "text": "Repeated ñ😀 e\u0301"}, {"id": "b", "text": "Repeated ñ😀 e\u0301"}]
CONTENT = {"left": ROWS, "right": ROWS}
PAIRS = [{"left_id": "a", "right_id": "b"}, {"left_id": "b", "right_id": "a"}]


def payload():
    return definition(("matching_type", CONTENT, {"pairs": PAIRS}))


def test_complete_cross_mapping_and_private_key_projection():
    model = TypeAdapter(Definition).validate_python(payload())
    data = model.model_dump(mode="json")
    safe = TypeAdapter(Preview).validate_python({key: data[key] for key in PUBLIC_MODELS["matching_type"].model_fields})
    assert safe.content.left[0].text == ROWS[0]["text"]
    assert "pairs" not in str(safe.model_dump()) and "answer_key" not in str(safe.model_dump())
    assert model.answer_key.pairs[0].right_id == "b"


@pytest.mark.parametrize(
    "pairs",
    [
        [],
        PAIRS[:1],
        [PAIRS[0], PAIRS[0]],
        [PAIRS[0], {"left_id": "b", "right_id": "b"}],
        [PAIRS[0], {"left_id": "unknown", "right_id": "a"}],
        [PAIRS[0], {"left_id": "b", "right_id": "unknown"}],
    ],
)
def test_incomplete_unknown_duplicate_and_reused_targets_rejected(pairs):
    with pytest.raises(ValueError):
        TypeAdapter(Definition).validate_python(payload() | {"answer_key": {"pairs": pairs}})


@pytest.mark.parametrize("side", ["left", "right"])
@pytest.mark.parametrize(
    "rows",
    [
        [],
        ROWS[:1],
        [ROWS[0], ROWS[0]],
        [{"id": "a", "text": " "}, ROWS[1]],
        [{"id": "bad id", "text": "Fixture"}, ROWS[1]],
    ],
)
def test_invalid_sides(side, rows):
    with pytest.raises(ValueError):
        TypeAdapter(Definition).validate_python(payload() | {"content": CONTENT | {side: rows}})


def test_unequal_counts_and_many_to_one_not_silently_supported():
    with pytest.raises(ValueError):
        TypeAdapter(Definition).validate_python(
            payload() | {"content": CONTENT | {"right": ROWS + [{"id": "c", "text": "Extra"}]}}
        )
    for pairs in [[], PAIRS[:1], PAIRS, list(reversed(PAIRS))]:
        response = {"pairs": pairs}
        assert (
            TypeAdapter(Response).validate_python({"method": "matching_type", "answer": response}).answer.model_dump()
            == response
        )
        validate_response("matching_type", CONTENT, response)
    for pairs in [
        [PAIRS[0], PAIRS[0]],
        [{"left_id": "unknown", "right_id": "a"}],
        [{"left_id": "a", "right_id": "b"}, {"left_id": "b", "right_id": "b"}],
        [{"left_id": True, "right_id": "a"}],
        [{"left_id": "a"}],
    ]:
        with pytest.raises(ValueError):
            validate_response("matching_type", CONTENT, {"pairs": pairs})


def test_long_unicode_labels_and_no_extra_schema_policy():
    text = "Synthetic ñ😀 e\u0301 punctuation! " * 400
    data = payload() | {"content": CONTENT | {"left": [{"id": "a", "text": text}, ROWS[1]]}}
    assert TypeAdapter(Definition).validate_python(data).content.left[0].text == text.strip()
    for extra in [{"allow_reused_targets": True}, {"shuffle": True}]:
        with pytest.raises(ValueError):
            TypeAdapter(Definition).validate_python(data | {"content": CONTENT | extra})
