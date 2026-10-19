"""Contracts, not scoring: synthetic payloads for all ten existing methods."""

from uuid import uuid4

import pytest
from pydantic import TypeAdapter, ValidationError

from app.models.assessments import ANSWER_METHODS
from app.modules.questions.schemas import Definition, Preview, Response, AUTHOR_MODELS, PUBLIC_MODELS, ANSWER_MODELS
from app.schemas.question_config import validate_response
from tests.test_question_config import EXAMPLES, RESPONSES


def definition(example=None, **changes):
    method, content, key = example or EXAMPLES[0]
    return dict(
        lesson_id=str(uuid4()),
        language="tagalog",
        prompt="Synthetic fixture prompt",
        method=method,
        content=content,
        answer_key=key,
        explanation="Private synthetic feedback",
        **changes,
    )


@pytest.mark.parametrize("example,answer", zip(EXAMPLES, RESPONSES))
def test_typed_definition_preview_and_response(example, answer):
    payload = TypeAdapter(Definition).validate_python(definition(example))
    values = payload.model_dump(mode="json")
    preview = {field: values[field] for field in PUBLIC_MODELS[payload.method].model_fields}
    safe = TypeAdapter(Preview).validate_python(preview).model_dump(mode="json")
    assert not {"answer_key", "explanation", "grading_version"} & safe.keys()
    response = TypeAdapter(Response).validate_python({"method": payload.method, "answer": answer})
    validate_response(payload.method, payload.content.model_dump(), response.answer.model_dump())
    assert "correct" not in type(response).model_fields


def test_exact_discriminated_contracts():
    assert set(AUTHOR_MODELS) == set(PUBLIC_MODELS) == set(ANSWER_MODELS) == set(ANSWER_METHODS)
    for contract in [Definition, Preview, Response]:
        schema = TypeAdapter(contract).json_schema()
        assert len(schema["oneOf"]) == 10
        assert set(schema["discriminator"]["mapping"]) == set(ANSWER_METHODS)


@pytest.mark.parametrize("example", EXAMPLES)
def test_every_method_rejects_private_key_or_content_injection(example):
    body = definition(example)
    for field in ("content", "answer_key"):
        with pytest.raises(ValidationError):
            TypeAdapter(Definition).validate_python(body | {field: body[field] | {"unknown_field": True}})


@pytest.mark.parametrize(
    "changes",
    [
        {"prompt": " "},
        {"schema_version": True},
        {"schema_version": 2},
        {"points": -1},
        {"points": "NaN"},
        {"points": "1.001"},
        {"correct": True},
        {"grading_version": "invented-grading"},
        {"media_url": "https://example.com"},
        {"answer_key": {"correct_option_id": "missing"}},
        {"content": {"options": [{"id": "a", "text": "A"}, {"id": "a", "text": "Duplicate"}]}},
        {"content": {"options": [{"id": "a", "text": " "}, {"id": "b", "text": "B"}]}},
    ],
)
def test_invalid_and_unspecified_fields_rejected(changes):
    with pytest.raises(ValidationError):
        TypeAdapter(Definition).validate_python(definition() | changes)


def test_duplicate_competencies_payload_budget_and_no_correctness_claims():
    id = str(uuid4())
    for changes in [
        {"competency_ids": [id, id]},
        {"content": {"options": [{"id": "a", "text": "x" * 65536}, {"id": "b", "text": "B"}]}},
    ]:
        with pytest.raises(ValidationError):
            TypeAdapter(Definition).validate_python(definition() | changes)
    with pytest.raises(ValidationError):
        TypeAdapter(Response).validate_python({"method": "true_false", "answer": {"value": True}, "correct": True})
