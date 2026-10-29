"""Draft input budgets; no attempt/scoring/publication fields are accepted."""

from uuid import uuid4
import pytest
from app.modules.assignments.schemas import DraftInput
from app.modules.assignments.schemas import PublishInput


def valid():
    return dict(lesson_id=str(uuid4()), title="Fixture", question_revision_ids=[])


def test_empty_draft_trim_and_exact_fields():
    data = DraftInput.model_validate(valid() | {"title": " Fixture ", "instructions": " Text "})
    assert data.title == "Fixture" and data.instructions == "Text" and data.question_revision_ids == []


@pytest.mark.parametrize(
    "change",
    [
        {"title": " "},
        {"title": "x" * 201},
        {"instructions": "x" * 8001},
        {"question_revision_ids": [str(uuid4())] * 2},
        {"question_revision_ids": [str(uuid4()) for _ in range(201)]},
        {"question_revision_ids": ["bad"]},
        {"points": 1},
        {"max_attempts": 1},
        {"status": "published"},
        {"class_id": str(uuid4())},
        {"due_at": "2026-10-20"},
    ],
)
def test_invalid_draft_fields(change):
    with pytest.raises(ValueError):
        DraftInput.model_validate(valid() | change)


@pytest.mark.parametrize("value", [False, 1, "true", None])
def test_publish_requires_deliberate_boolean_confirmation(value):
    with pytest.raises(ValueError):
        PublishInput.model_validate({"confirm": value})


def test_publish_rejects_future_policy_fields():
    assert PublishInput.model_validate({"confirm": True}).bind_subject_id is None
    with pytest.raises(ValueError):
        PublishInput.model_validate({"confirm": True, "due_at": "2026-10-20"})
