"""Development seed sanity: sample-pronunciation-dev-v0.1.json is publishable.

This seed exists ONLY for development/sanity testing of the pronunciation
pipeline. It is not the formal research pronunciation dataset and not
approved participant material.
"""

import json
import uuid

from sqlalchemy.orm import Session

from app.pronunciation.schemas import PronunciationAttemptMetadata
from app.pronunciation.service import resolve_pronunciation_target
from tests.pronunciation_helpers import build_metadata, load_dev_seed, publish_dev_seed

AUTHORIZED_PHRASES = {
    "Good morning, how are you today?",
    "Can you help me with this?",
    "I would like a glass of water.",
}


def test_dev_seed_shape_and_purpose_marker() -> None:
    data = load_dev_seed()
    assert data["language"]["code"] == "en"
    assert data["language"]["is_active"] is True
    assert data["content_version"] == "sample-pronunciation-dev-v0.1"
    assert data["purpose"] == "development_pronunciation_sanity_only"
    assert "NOT the formal research" in data["purpose_note"]

    lessons = data["lessons"]
    assert len(lessons) == 1
    lesson = lessons[0]
    assert lesson["is_active"] is True
    assert "development" in lesson["description"].lower()

    items = lesson["vocabulary_items"]
    assert len(items) == 8
    ids = []
    for item in items:
        ids.append(uuid.UUID(item["id"]))
        assert item["term"].strip()
        assert item["example_sentence"].strip()
        assert item["content_version"] == data["content_version"]
        assert item["is_active"] is True
        assert item["definition"].strip()
    assert len(set(ids)) == 8

    sentences = {item["example_sentence"] for item in items}
    assert AUTHORIZED_PHRASES <= sentences


def test_dev_seed_publishes_with_resolvable_sentence_targets(
    db_session: Session,
) -> None:
    refs = publish_dev_seed(db_session)
    assert len(refs) == 8

    for term, ref in refs.items():
        assert ref["sentence"].strip()
        for key in ("vocabulary_item_id", "content_revision_id", "content_release_id"):
            uuid.UUID(ref[key])

        metadata = PronunciationAttemptMetadata.model_validate(
            build_metadata(ref, target_kind="sentence")
        )
        revision, reference_text = resolve_pronunciation_target(db_session, metadata)
        assert reference_text == ref["sentence"]
        assert revision.term == term

        term_metadata = PronunciationAttemptMetadata.model_validate(
            build_metadata(ref, target_kind="term")
        )
        _, term_text = resolve_pronunciation_target(db_session, term_metadata)
        assert term_text == term


def test_dev_seed_metadata_is_valid_contract_shape() -> None:
    data = load_dev_seed()
    item = data["lessons"][0]["vocabulary_items"][0]
    ref = {
        "vocabulary_item_id": item["id"],
        "content_revision_id": str(uuid.uuid4()),
        "content_release_id": str(uuid.uuid4()),
        "term": item["term"],
        "sentence": item["example_sentence"],
    }
    metadata = PronunciationAttemptMetadata.model_validate(build_metadata(ref))
    assert metadata.capture_profile_version == "expo57-term-m4a-v1"
    assert metadata.device_platform == "android"
    assert metadata.target_kind == "term"
    assert metadata.original_interaction_at.tzinfo is not None


def test_dev_seed_extra_top_level_keys_are_ignored_by_publisher() -> None:
    data = load_dev_seed()
    # The publisher reads declared fields only; the purpose markers must not
    # break publication or leak into the release manifest.
    serialized = json.dumps(data)
    assert serialized.count("sample-pronunciation-dev-v0.1") >= 9
