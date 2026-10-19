"""Shared pronunciation test helpers.

All provider payloads in this module are FIXTURES derived from the documented
Azure response shape. They are NOT captured live data and are only used in
unit/error tests; no test in this suite performs a live provider call.
"""

import json
import uuid
from pathlib import Path

SEED_PATH = (
    Path(__file__).resolve().parents[2]
    / "scripts"
    / "seed_content"
    / "sample-pronunciation-dev-v0.1.json"
)

FAKE_M4A_BYTES = b"\x00\x00\x00\x20ftypM4A  \x00\x00\x00\x00M4A " + bytes(64)


def load_dev_seed() -> dict:
    return json.loads(SEED_PATH.read_text(encoding="utf-8"))


def publish_dev_seed(db) -> dict[str, dict[str, str]]:
    """Publish the development seed and return term -> provenance refs."""
    from app.content.models import ContentRelease, Language, VocabularyRevision
    from app.content.service import import_content_data

    data = load_dev_seed()
    import_content_data(db, data)
    language = db.get(Language, data["language"]["code"])
    release = db.get(ContentRelease, language.current_content_release_id)
    refs: dict[str, dict[str, str]] = {}
    for lesson in release.manifest["lessons"]:
        for member in lesson["vocabulary_items"]:
            revision = db.get(VocabularyRevision, uuid.UUID(member["content_revision_id"]))
            refs[revision.term] = {
                "vocabulary_item_id": str(revision.vocabulary_item_id),
                "content_revision_id": str(revision.id),
                "content_release_id": str(release.id),
                "term": revision.term,
                "sentence": revision.example_sentence,
            }
    return refs


def build_metadata(
    ref: dict[str, str],
    *,
    target_kind: str = "term",
    client_id: uuid.UUID | None = None,
    **overrides,
) -> dict:
    metadata = {
        "client_pronunciation_attempt_id": str(client_id or uuid.uuid4()),
        "content_release_id": ref["content_release_id"],
        "vocabulary_item_id": ref["vocabulary_item_id"],
        "content_revision_id": ref["content_revision_id"],
        "original_interaction_at": "2026-10-18T12:00:00+00:00",
        "capture_profile_version": "expo57-term-m4a-v1",
        "device_platform": "android",
        "application_version": "0.1.0",
        "target_kind": target_kind,
    }
    metadata.update(overrides)
    return metadata


BOUNDARY = "----FLUENTTTestBoundary7MA4YWxk"


def build_multipart(
    *,
    metadata_json: str | None,
    audio: bytes | None,
    extra_fields: list[tuple[str, str]] | None = None,
    duplicate_metadata: bool = False,
) -> bytes:
    """Hand-built multipart body so tests control parts byte-for-byte."""
    chunks: list[bytes] = []

    def add_field(name: str, value: str) -> None:
        chunks.append(
            (
                f'--{BOUNDARY}\r\n'
                f'Content-Disposition: form-data; name="{name}"\r\n'
                f"\r\n{value}\r\n"
            ).encode()
        )

    if metadata_json is not None:
        if duplicate_metadata:
            add_field("metadata", metadata_json)
        add_field("metadata", metadata_json)
    for name, value in extra_fields or []:
        add_field(name, value)
    if audio is not None:
        chunks.append(
            (
                f'--{BOUNDARY}\r\n'
                f'Content-Disposition: form-data; name="audio"; filename="recording.m4a"\r\n'
                f"Content-Type: audio/mp4\r\n\r\n"
            ).encode()
        )
        chunks.append(audio)
        chunks.append(b"\r\n")
    chunks.append(f"--{BOUNDARY}--\r\n".encode())
    return b"".join(chunks)


def post_raw(client, headers: dict[str, str], body: bytes):
    return client.post(
        "/pronunciation/attempts",
        content=body,
        headers={**headers, "Content-Type": f"multipart/form-data; boundary={BOUNDARY}"},
    )


def upload_attempt(
    client,
    headers: dict[str, str],
    metadata: dict | str | None,
    audio: bytes | None = None,
    *,
    extra_fields: list[tuple[str, str]] | None = None,
    duplicate_metadata: bool = False,
):
    """POST the two-part multipart contract exactly as the mobile client will."""
    metadata_json = (
        metadata
        if isinstance(metadata, str) or metadata is None
        else json.dumps(metadata)
    )
    body = build_multipart(
        metadata_json=metadata_json,
        audio=FAKE_M4A_BYTES if audio is None else audio,
        extra_fields=extra_fields,
        duplicate_metadata=duplicate_metadata,
    )
    return post_raw(client, headers, body)


def scorable_payload(reference_text: str, *, primary: float | str = 89.995) -> dict:
    """FIXTURE: a Success detailed response whose words cover the reference tokens."""
    from app.pronunciation import scoring

    tokens = scoring.normalize_tokens(reference_text)
    words = []
    for index, token in enumerate(tokens):
        phonemes = [
            {"Phoneme": "ah", "AccuracyScore": 92.0},
            {"Phoneme": "m", "AccuracyScore": 58.0},
            {"Phoneme": "t", "AccuracyScore": 34.0},
            {"Phoneme": "s", "AccuracyScore": 71.0},
        ] if index == 0 else [
            {"Phoneme": "ah", "AccuracyScore": 95.0},
            {"Phoneme": "n", "AccuracyScore": 88.0},
        ]
        words.append(
            {
                "Word": token,
                "AccuracyScore": 91.0,
                "ErrorType": "None",
                "Offset": index * 1_000_000,
                "Duration": 900_000,
                "Phonemes": phonemes,
            }
        )
    return {
        "RecognitionStatus": "Success",
        "Offset": 0,
        "Duration": len(tokens) * 1_000_000,
        "NBest": [
            {
                "AccuracyScore": primary,
                "PronScore": 88.5,
                "CompletenessScore": 96.0,
                "FluencyScore": 90.0,
                "Words": words,
            }
        ],
    }


def unscorable_payload(status: str = "NoMatch") -> dict:
    return {"RecognitionStatus": status}
