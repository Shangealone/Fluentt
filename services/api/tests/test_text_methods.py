"""Section 13 synthetic contracts: no scoring and no learner submission endpoint."""

import pytest
from pydantic import TypeAdapter

from app.modules.questions.schemas import Definition, Response
from app.schemas.question_config import (
    RESPONSE_MODELS,
    template_blank_ids,
    validate_content,
    validate_definition,
    validate_prompt,
    validate_response,
)
from tests.test_question_bank import definition


def test_legacy_json_and_raw_unicode_are_preserved():
    assert validate_content("identification", {}).model_dump() == {}
    assert validate_content("fill_in_the_blank", {"blank_ids": ["a"]}).model_dump() == {"blank_ids": ["a"]}
    raw = "  Pag-ibig! e\u0301 ñ 😀\n"
    for method, answer in [
        ("identification", {"text": raw}),
        ("fill_in_the_blank", {"blanks": [{"blank_id": "a", "text": raw}]}),
    ]:
        parsed = TypeAdapter(Response).validate_python({"method": method, "answer": answer})
        assert parsed.answer.model_dump() == answer


@pytest.mark.parametrize("limit", [0, 2001, True, "500", 1.5])
def test_invalid_limits(limit):
    for method, content in [("identification", {}), ("fill_in_the_blank", {"blank_ids": ["a"]})]:
        with pytest.raises(ValueError):
            validate_content(method, content | {"input_max_length": limit})


def test_codepoint_limits_and_no_implicit_legacy_limit():
    validate_response("identification", {"input_max_length": 2}, {"text": "😀ñ"})
    validate_response("identification", {}, {"text": "x" * 2001})
    with pytest.raises(ValueError):
        validate_response("identification", {"input_max_length": 1}, {"text": "e\u0301"})
    for method, answer in [
        ("identification", {"text": "  "}),
        ("fill_in_the_blank", {"blanks": [{"blank_id": "a", "text": ""}]}),
    ]:
        with pytest.raises(ValueError):
            RESPONSE_MODELS[method].model_validate(answer)
    with pytest.raises(ValueError):
        validate_definition("identification", {"input_max_length": 2}, {"accepted_answers": ["long"]})
    with pytest.raises(ValueError):
        validate_definition(
            "fill_in_the_blank", {"blank_ids": ["a"], "input_max_length": 1}, {"accepted_answers": {"a": ["long"]}}
        )


@pytest.mark.parametrize(
    "prompt",
    [
        "{{a}} {{a}}",
        "{{b}} {{a}}",
        "{{a}}",
        "{{a}} {{unknown}}",
        "{{{a}}} {{b}}",
        "{a} {{b}}",
        "{{a}} {{ b }}",
        "{{a}} {{b}",
        "{{a{{b}}}}",
        "{{a}} {{b}} }",
    ],
)
def test_tagged_templates_reject_ambiguous_missing_unknown_or_unordered_gaps(prompt):
    with pytest.raises(ValueError):
        validate_prompt("fill_in_the_blank", {"blank_ids": ["a", "b"], "template_syntax": "double-brace-v1"}, prompt)


def test_template_opt_in_and_author_api_validation():
    content = {"blank_ids": ["a", "b"], "template_syntax": "double-brace-v1", "input_max_length": 500}
    prompt = "Synthetic {{a}} then {{b}}."
    validate_prompt("fill_in_the_blank", content, prompt)
    assert template_blank_ids(prompt) == ["a", "b"]
    validate_prompt("fill_in_the_blank", {"blank_ids": ["a"]}, "Legacy {text} {{unknown}} stays literal")
    payload = definition(("fill_in_the_blank", content, {"accepted_answers": {"a": ["ñ"], "b": ["fixture"]}})) | {
        "prompt": prompt
    }
    assert TypeAdapter(Definition).validate_python(payload).content.model_dump() == content
    with pytest.raises(ValueError):
        TypeAdapter(Definition).validate_python(payload | {"prompt": "missing gaps"})


def test_partial_drafts_and_explicit_exact_complete_mapping():
    content = {"blank_ids": ["a", "b"], "input_max_length": 2}
    validate_response("fill_in_the_blank", content, {"blanks": []})
    validate_response(
        "fill_in_the_blank",
        content,
        {"blanks": [{"blank_id": "b", "text": "ñ"}, {"blank_id": "a", "text": "😀"}]},
        require_complete=True,
    )
    for blanks in [
        [],
        [{"blank_id": "a", "text": "x"}],
        [{"blank_id": "a", "text": "x"}] * 2,
        [{"blank_id": "z", "text": "x"}],
        [{"blank_id": "a", "text": "long"}],
    ]:
        with pytest.raises(ValueError):
            validate_response("fill_in_the_blank", content, {"blanks": blanks}, require_complete=True)
