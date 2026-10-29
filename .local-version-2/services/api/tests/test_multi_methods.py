"""Section 14 locks existing set/token semantics; synthetic fixtures, never scoring."""

import pytest
from pydantic import TypeAdapter

from app.modules.questions.schemas import Definition
from app.schemas.question_config import validate_definition, validate_response
from tests.test_question_bank import definition

ROWS = [{"id": "a", "text": "Synthetic ñ e\u0301 😀"}, {"id": "b", "text": "Fixture B"}]


def payload(method):
    return definition(
        (
            method,
            {"options": ROWS} if method == "multiple_select" else {"tokens": ROWS},
            {"correct_option_ids": ["a"]}
            if method == "multiple_select"
            else {"error_token_ids": ["a"], "accepted_corrections": {"b": [], "a": ["Private fixture"]}},
        )
    )


@pytest.mark.parametrize("method", ["multiple_select", "error_identification"])
def test_one_or_many_targets_and_empty_partial_responses_remain_compatible(method):
    data = payload(method)
    for ids in [["a"], ["b", "a"]]:
        key = data["answer_key"] | {"correct_option_ids" if method == "multiple_select" else "error_token_ids": ids}
        validate_definition(method, data["content"], key)
    TypeAdapter(Definition).validate_python(data)
    response_key = "option_ids" if method == "multiple_select" else "selected_token_ids"
    for ids in [[], ["a"], ["b", "a"]]:
        validate_response(method, data["content"], {response_key: ids})
    for ids in [["a", "a"], ["unknown"], [True]]:
        with pytest.raises(ValueError):
            validate_response(method, data["content"], {response_key: ids})


@pytest.mark.parametrize("method", ["multiple_select", "error_identification"])
@pytest.mark.parametrize("ids", [[], ["a", "a"], ["unknown"]])
def test_invalid_correct_target_sets(method, ids):
    data = payload(method)
    data["answer_key"]["correct_option_ids" if method == "multiple_select" else "error_token_ids"] = ids
    with pytest.raises(ValueError):
        TypeAdapter(Definition).validate_python(data)


@pytest.mark.parametrize(
    "changes",
    [
        {
            "tokens": [
                {"id": "a", "text": "Fixture", "start": 0, "end": 3},
                {"id": "b", "text": "Other", "start": 2, "end": 5},
            ]
        },
        {"tokens": [{"id": "a", "text": "😀", "span": [0, 1]}]},
        {"tokens": [{"id": "a", "text": "Fixture"}, {"id": "a", "text": "Repeated ID"}]},
        {"tokens": [{"id": "a", "text": " "}]},
        {"tokens": []},
        {"spans": [{"start": 0, "end": 3}, {"start": 2, "end": 5}]},
    ],
)
def test_invalid_or_overlapping_offset_representations_are_unsupported(changes):
    data = payload("error_identification") | {"content": changes}
    with pytest.raises(ValueError):
        TypeAdapter(Definition).validate_python(data)


def test_no_inferred_bounds_or_correction_rules_and_long_unicode_tokens():
    data = payload("multiple_select")
    for field in ["min_selections", "max_selections"]:
        with pytest.raises(ValueError):
            TypeAdapter(Definition).validate_python(data | {"content": data["content"] | {field: 2}})
    data = payload("error_identification")
    for corrections in [{}, {"b": []}, {"b": ["non-target fixture"]}]:
        validate_definition(
            "error_identification", data["content"], data["answer_key"] | {"accepted_corrections": corrections}
        )
    for corrections in [{"unknown": ["fixture"]}, {"a": [""]}, {"a": "bad"}]:
        with pytest.raises(ValueError):
            validate_definition(
                "error_identification", data["content"], data["answer_key"] | {"accepted_corrections": corrections}
            )
    raw = "ñ😀e\u0301!" * 1000
    data["content"]["tokens"][0]["text"] = raw
    assert TypeAdapter(Definition).validate_python(data).content.tokens[0].text == raw
