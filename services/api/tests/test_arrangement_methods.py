"""Synthetic Section 15 unit permutations, not a scorer or alternative-order policy."""

import pytest
from pydantic import TypeAdapter

from app.modules.questions.schemas import Definition, Preview, Response, PUBLIC_MODELS
from app.schemas.question_config import validate_response
from tests.test_question_bank import definition

ROWS = [{"id": "a", "text": "Repeated ñ😀 e\u0301!"}, {"id": "b", "text": "Repeated ñ😀 e\u0301!"}]
METHODS = ["word_arrangement", "sentence_arrangement"]


def payload(method):
    return definition((method, {"items": ROWS}, {"ordered_ids": ["b", "a"]}))


@pytest.mark.parametrize("method", METHODS)
def test_repeated_units_private_permutation_and_safe_preview(method):
    model = TypeAdapter(Definition).validate_python(payload(method))
    assert model.content.items[0].text == ROWS[0]["text"]
    assert model.answer_key.ordered_ids == ["b", "a"]
    data = model.model_dump(mode="json")
    public = (
        TypeAdapter(Preview)
        .validate_python({key: data[key] for key in PUBLIC_MODELS[method].model_fields})
        .model_dump()
    )
    assert not {"answer_key", "ordered_ids", "explanation", "grading_version"} & public.keys()
    assert public["content"]["items"] == ROWS


@pytest.mark.parametrize("method", METHODS)
@pytest.mark.parametrize("order", [[], ["a"], ["a", "a"], ["a", "missing"], ["a", "b", "extra"]])
def test_expected_order_must_be_complete_permutation(method, order):
    with pytest.raises(ValueError):
        TypeAdapter(Definition).validate_python(payload(method) | {"answer_key": {"ordered_ids": order}})


@pytest.mark.parametrize("method", METHODS)
@pytest.mark.parametrize(
    "items",
    [
        [],
        [ROWS[0]],
        [ROWS[0], ROWS[0]],
        [{"id": "a", "text": " "}, ROWS[1]],
        [{"id": "bad id", "text": "Fixture"}, ROWS[1]],
    ],
)
def test_missing_malformed_or_duplicate_unit_ids(method, items):
    with pytest.raises(ValueError):
        TypeAdapter(Definition).validate_python(payload(method) | {"content": {"items": items}})


@pytest.mark.parametrize("method", METHODS)
def test_responses_keep_explicit_order_partial_drafts_and_reject_invalid_references(method):
    field = "ordered_token_ids" if method == "word_arrangement" else "ordered_sentence_ids"
    for ids in [[], ["a"], ["a", "b"], ["b", "a"]]:
        data = {field: ids}
        assert TypeAdapter(Response).validate_python({"method": method, "answer": data}).answer.model_dump() == data
        validate_response(method, {"items": ROWS}, data)
    for ids in [["a", "a"], ["missing"], [True]]:
        with pytest.raises(ValueError):
            validate_response(method, {"items": ROWS}, {field: ids})
    other = "ordered_sentence_ids" if method == "word_arrangement" else "ordered_token_ids"
    with pytest.raises(ValueError):
        TypeAdapter(Response).validate_python({"method": method, "answer": {other: ["a", "b"]}})


def test_long_unicode_sentence_no_auto_split_or_extra_order_policy():
    data = payload("sentence_arrangement")
    raw = "Synthetic ñ😀 — e\u0301. Multiple clauses! " * 500
    data["content"] = {"items": [{"id": "a", "text": raw}, ROWS[1]]}
    assert TypeAdapter(Definition).validate_python(data).content.items[0].text == raw.strip()
    for extra in [{"alternative_orders": [["a", "b"]]}, {"shuffle": True}]:
        with pytest.raises(ValueError):
            TypeAdapter(Definition).validate_python(data | {"content": data["content"] | extra})
