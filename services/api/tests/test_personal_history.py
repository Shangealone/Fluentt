"""Synthetic QA contracts; activity receipts are not grades or research observations."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.personal_history.router import EventInput, require_owner
from app.modules.identity.errors import IdentityError


def payload(**changes):
    return {
        "event_key": str(uuid4()),
        "kind": "learn_question",
        "source_id": "en-want-water",
        "title": "Build a sentence",
        "prompt": "I want water",
        "language": "english",
        **changes,
    }


def test_explicit_bounded_metadata_and_uuid_parse_without_response_or_audio():
    row = EventInput.model_validate(payload())
    assert row.prompt == "I want water" and row.event_key.version == 4
    assert EventInput.model_validate(payload(prompt="Kumusta po?", language="tagalog")).language == "tagalog"


@pytest.mark.parametrize(
    "extra",
    [
        "user_id",
        "class_id",
        "participant_id",
        "study_id",
        "answer",
        "answer_key",
        "score",
        "audio",
        "recorded_at",
        "transcript",
    ],
)
def test_unapproved_identity_outcomes_and_content_are_rejected(extra):
    with pytest.raises(ValidationError):
        EventInput.model_validate(payload(**{extra: "SYNTHETIC_FORBIDDEN"}))


@pytest.mark.parametrize(
    "changes",
    [
        {"title": " "},
        {"title": "a" * 201},
        {"prompt": "a" * 8001},
        {"content_version": 0},
        {"content_version": True},
        {"language": "other"},
        {"kind": "research"},
        {"source_id": "../unsafe"},
        {"title": "bad\x00text"},
        {"kind": "tutor_reply", "prompt": "Private synthetic dialogue"},
    ],
)
def test_invalid_or_private_display_is_refused(changes):
    with pytest.raises(ValidationError):
        EventInput.model_validate(payload(**changes))


def test_only_active_personal_owner_can_write_or_read():
    require_owner(SimpleNamespace(role="personal_student", profile_status="active"))
    for role, status in [("school_student", "active"), ("instructor", "active"), ("personal_student", "onboarding")]:
        with pytest.raises(IdentityError):
            require_owner(SimpleNamespace(role=role, profile_status=status))
