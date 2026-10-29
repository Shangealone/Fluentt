"""Synthetic V1 cards; recall is self-report, never objective correctness."""

import pytest
from pydantic import TypeAdapter

from app.modules.questions.schemas import Definition, Preview, PUBLIC_MODELS, Response
from app.schemas.question_config import validate_response
from tests.test_question_bank import definition


def payload():
    return definition(
        (
            "flashcards",
            {"cue": "Synthetic ñ😀 e\u0301 cue"},
            {"back": "PRIVATE synthetic back", "scoring_rubric_version": None},
        )
    )


def test_card_context_private_back_and_safe_front_projection():
    model = TypeAdapter(Definition).validate_python(payload())
    data = model.model_dump(mode="json")
    safe = (
        TypeAdapter(Preview)
        .validate_python({key: data[key] for key in PUBLIC_MODELS["flashcards"].model_fields})
        .model_dump()
    )
    assert safe["lesson_id"] == model.lesson_id
    assert safe["content"] == {"cue": "Synthetic ñ😀 e\u0301 cue"}
    assert not any(
        key in str(safe) for key in ["PRIVATE", "answer_key", "back", "scoring_rubric_version", "explanation"]
    )
    assert model.answer_key.back == "PRIVATE synthetic back"


@pytest.mark.parametrize(
    "content",
    [
        {},
        {"cue": ""},
        {"cue": " "},
        {"cue": 5},
        {"cue": "Fixture", "translation": "Unsupported"},
        {"cue": "Fixture", "vocabulary_item_id": "Unsupported"},
    ],
)
def test_invalid_or_unapproved_content_fields(content):
    with pytest.raises(ValueError):
        TypeAdapter(Definition).validate_python(payload() | {"content": content})


@pytest.mark.parametrize(
    "key",
    [
        {},
        {"back": " "},
        {"back": False},
        {"back": "Fixture", "correct": True},
        {"back": "Fixture", "scoring_rubric_version": " "},
    ],
)
def test_invalid_back_metadata(key):
    with pytest.raises(ValueError):
        TypeAdapter(Definition).validate_python(payload() | {"answer_key": key})


@pytest.mark.parametrize("rating", ["again", "hard", "good", "easy"])
def test_existing_recall_responses_have_no_score_or_scheduling_semantics(rating):
    answer = {"recall": rating}
    assert (
        TypeAdapter(Response).validate_python({"method": "flashcards", "answer": answer}).answer.model_dump() == answer
    )
    validate_response("flashcards", {"cue": "Fixture"}, answer)


@pytest.mark.parametrize(
    "answer",
    [
        {},
        {"recall": "unknown"},
        {"recall": True},
        {"recall": "Good"},
        {"recall": "good", "score": 1},
        {"recall": "good", "response_duration_ms": 10},
    ],
)
def test_invalid_ratings_and_unapproved_telemetry(answer):
    with pytest.raises(ValueError):
        TypeAdapter(Response).validate_python({"method": "flashcards", "answer": answer})


def test_repeated_text_is_allowed_no_undocumented_text_deduplication():
    raw = "Synthetic ñ😀 e\u0301 — long text! " * 100
    data = payload() | {
        "content": {"cue": raw},
        "answer_key": {"back": raw, "scoring_rubric_version": "preserved-reference"},
    }
    model = TypeAdapter(Definition).validate_python(data)
    assert model.content.cue == model.answer_key.back == raw.strip()
    assert model.answer_key.scoring_rubric_version == "preserved-reference"
