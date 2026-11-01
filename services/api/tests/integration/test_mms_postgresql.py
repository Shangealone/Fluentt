"""Disposable PostgreSQL, synthetic audio/model double. Not real MMS inference."""
from datetime import datetime, timezone
from uuid import UUID, uuid4
import pytest
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models.ai import PronunciationActivity, PronunciationAttempt
from app.models.learning import VocabularyReviewEvent
from app.models.users import ClassMembership
from app.modules.identity.errors import IdentityError
from app.modules.pronunciation import mms_service
from app.modules.pronunciation.mms_contract import CONSENT
from tests.integration.test_wavlm_postgresql import case, pg_engine  # noqa: F401
from tests.integration.test_enrollment_postgresql import account, confirmation
from tests.test_mms import synthetic_prediction
from tests.test_whole_phrase import wav

pytestmark = pytest.mark.postgresql
BASE = "/api/v1/me/pronunciation"


@pytest.mark.parametrize("engine", [None, "legacy"])
def test_legacy_upload_refuses_without_audio_retention_or_new_attempt(tagalog_case, pg_engine, tmp_path, monkeypatch, engine):
    from app.modules.pronunciation import service
    monkeypatch.setattr(service, "PRIVATE_STORAGE_BASE", tmp_path)
    client, auth, activity_id, calls, _ = tagalog_case
    with Session(pg_engine) as db:
        before = db.scalar(select(func.count()).select_from(PronunciationAttempt))
    data = {"activity_id":activity_id, "duration_ms":"1000"}
    if engine is not None:
        data["assessment_engine"] = engine
    response = client.post(BASE + "/attempts", headers=auth, data=data,
        files={"audio_file":("recording.wav", wav(), "audio/wav")})
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "legacy_speech_unavailable"
    assert "no-store" in response.headers["cache-control"]
    assert not calls and not list(tmp_path.iterdir())
    with Session(pg_engine) as db:
        assert db.scalar(select(func.count()).select_from(PronunciationAttempt)) == before


def test_retained_legacy_reads_and_evaluation_mask_tagalog_ratings(tagalog_case, pg_engine):
    from decimal import Decimal
    from app.modules.speech.service import get_or_create_evaluator_configuration
    client, auth, activity_id, calls, _ = tagalog_case
    actual = submit(tagalog_case)
    assert actual.status_code == 200, actual.text
    with Session(pg_engine) as db, db.begin():
        original = db.get(PronunciationAttempt, UUID(actual.json()["assessment_id"]))
        legacy_id = uuid4()
        configuration_id = get_or_create_evaluator_configuration(db)
        db.add(PronunciationAttempt(id=legacy_id, context_id=original.context_id, activity_id=UUID(activity_id),
            attempted_at=datetime.now(timezone.utc), transcription="copied reference", simulated=True,
            scoring_status="scored", score=Decimal("91.5"), evaluator_configuration_id=configuration_id, feedback="91.5/100 mispronounced phone",
            result={"assessment":{"overall_score":91.5}, "duration_ms":1000}))
    for method, suffix in [(client.post, "/evaluate"), (client.get, "/assessment")]:
        response = method(BASE + f"/attempts/{legacy_id}" + suffix, headers=auth)
        assert response.status_code == 200, response.text
        assert response.json()["score"] is None and response.json()["assessment"] is None
        assert response.json()["pronunciation_scoring"] == "unavailable"
        assert response.json()["transcription"] is None
    for force in ["false", "true"]:
        response = client.post(BASE + f"/attempts/{legacy_id}/transcribe", headers=auth,
            params={"force_retranscribe":force})
        assert response.status_code == 409
    response = client.get(BASE + f"/attempts/{legacy_id}/transcription", headers=auth)
    assert response.json()["transcription"] is None and not response.json()["has_transcription"]
    page = client.get(BASE + "/attempts", headers=auth, params={"activity_id":activity_id})
    assert page.status_code == 200, page.text
    assert all(row["score"] is None and row["pronunciation_scoring"] == "unavailable" for row in page.json())
    assert all("91.5" not in row["feedback"] for row in page.json())
    assert len(calls) == 1  # No legacy operation triggers a model or synthetic recognizer.
    with Session(pg_engine) as db:
        row = db.get(PronunciationAttempt, legacy_id)
        assert row.score == Decimal("91.5") and row.scoring_status == "scored"
        assert row.result["assessment"]["overall_score"] == 91.5
    # Unknown/unowned attempts remain concealed, including the compatibility endpoints.
    for suffix in ["/evaluate", "/transcribe"]:
        assert client.post(BASE + f"/attempts/{uuid4()}" + suffix, headers=auth).status_code == 404


@pytest.fixture
def tagalog_case(case, pg_engine, monkeypatch):
    client, auth, _, _, user_id = case
    with Session(pg_engine) as db, db.begin():
        activity = PronunciationActivity(target_text="Magandang umaga!", language="tagalog", status="published",
            version=1, locked_at=datetime.now(timezone.utc))
        db.add(activity)
        db.flush()
        activity_id = str(activity.id)
    calls = []

    def infer(settings, audio, expected):
        calls.append((audio, expected))
        return synthetic_prediction()

    monkeypatch.setattr(mms_service.runtime, "assess", infer)
    return client, auth, activity_id, calls, user_id


def submit(case, key=None, headers=None, audio=None, **changes):
    client, auth, activity_id, *_ = case
    return client.post(BASE + "/attempts", headers=auth if headers is None else headers,
        data={"activity_id": activity_id, "activity_version": "1", "duration_ms": "1", "assessment_engine": "mms",
              "request_id": str(key or uuid4()), "consent_version": CONSENT} | changes,
        files={"audio_file": ("recording.wav", wav() if audio is None else audio, "audio/wav")})


def test_transcription_replay_history_null_scores_no_scheduler_mutations(tagalog_case, pg_engine):
    client, auth, activity_id, calls, _ = tagalog_case
    with Session(pg_engine) as db:
        before = db.scalar(select(func.count()).select_from(VocabularyReviewEvent))
    key = uuid4()
    response = submit(tagalog_case, key, score="100", expected_text="attacker reference")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "transcribed" and body["overall_score"] is None
    assert body["expected_text"] == "Magandang umaga!" and body["transcript"] == "Magandang umaga"
    assert body["comparison"]["exact_match"] and body["confidence"] is None
    assert body["pronunciation_scoring"] == "unavailable" and body["simulated"] is False
    assert "no-store" in response.headers["cache-control"]
    assert len(calls) == 1 and calls[0][1] == "Magandang umaga!"
    assert submit(tagalog_case, key).json() == body and len(calls) == 1
    assert submit(tagalog_case, key, audio=wav() + b"different").status_code == 409
    page = client.get(BASE + "/attempts", headers=auth, params={"assessment_engine": "mms", "activity_id": activity_id})
    assert page.status_code == 200 and page.json() == [body]
    assert client.get(BASE + "/attempts", headers=auth, params={"assessment_engine": "wavlm", "activity_id": activity_id}).json() == []
    assert submit(tagalog_case).json()["attempt_number"] == 2
    for action in ("transcribe", "evaluate", "assessment"):
        method = client.get if action == "assessment" else client.post
        assert method(BASE + f"/attempts/{key}/{action}", headers=auth).status_code == 409
    with Session(pg_engine) as db:
        row = db.get(PronunciationAttempt, key)
        assert row.score is None and row.evaluator_configuration_id is None and row.asr_configuration_id
        assert row.scoring_status == "unscored" and row.result["raw_audio_retained"] is False
        assert "storage_path" not in row.result
        assert db.scalar(select(func.count()).select_from(VocabularyReviewEvent)) == before


def test_invalid_routing_audio_consent_and_ownership(tagalog_case, case):
    client, auth, activity_id, calls, _ = tagalog_case
    assert submit(tagalog_case, headers={}).status_code == 401
    assert submit(tagalog_case, consent_version="wrong").status_code == 422
    assert submit(tagalog_case, activity_version="2").status_code == 409
    assert submit(tagalog_case, context_type="research").status_code == 422
    assert submit(tagalog_case, context_type="classroom").status_code == 422
    assert submit(tagalog_case, audio=b"invalid").status_code == 422
    assert submit(tagalog_case, activity_id=case[2]).status_code == 422
    assert submit(tagalog_case, assessment_engine="wavlm").status_code == 422
    teacher, _ = account(client, "instructor")
    assert submit(tagalog_case, headers=teacher).status_code == 403
    assert not calls
    assert submit(tagalog_case).status_code == 200
    other, _ = account(client, "personal_student")
    assert client.patch("/api/v1/users/me/preferences", headers=other,
        json={"language": "tagalog", "experience": "starting_fresh"}).status_code == 200
    assert client.get(BASE + "/attempts", headers=other, params={"assessment_engine": "mms", "activity_id": activity_id}).json() == []


def test_failed_model_never_persists_a_score_or_attempt(tagalog_case, pg_engine, monkeypatch):
    with Session(pg_engine) as db:
        before = db.scalar(select(func.count()).select_from(PronunciationAttempt))

    def fail(*args):
        raise IdentityError(503, "mms_unavailable", "Unavailable")

    monkeypatch.setattr(mms_service.runtime, "assess", fail)
    assert submit(tagalog_case).status_code == 503
    with Session(pg_engine) as db:
        assert db.scalar(select(func.count()).select_from(PronunciationAttempt)) == before


def test_class_context_membership_revalidated_after_inference(tagalog_case, pg_engine, monkeypatch):
    client, _, activity_id, _, _ = tagalog_case
    owner, _ = account(client, "instructor")
    room = client.post("/api/v1/classes", headers=owner | {"Idempotency-Key": str(uuid4())},
        json={"class_name": "Synthetic MMS", "grade_level": 5, "language": "tagalog"}).json()
    student, user_id = account(client, "school_student")
    assert client.post("/api/v1/class-memberships", headers=student, json=confirmation(client, student, room)).status_code == 200
    assert submit(tagalog_case, headers=student, class_id=room["id"], context_type="classroom").status_code == 200

    def revoked(*args):
        with Session(pg_engine) as db, db.begin():
            member = db.scalar(select(ClassMembership).where(ClassMembership.student_id == user_id,
                ClassMembership.class_id == UUID(room["id"]), ClassMembership.status == "active"))
            member.status = "removed"
        return synthetic_prediction()

    monkeypatch.setattr(mms_service.runtime, "assess", revoked)
    key = uuid4()
    assert submit(tagalog_case, key, headers=student, class_id=room["id"], context_type="classroom").status_code in {403, 404}
    with Session(pg_engine) as db:
        assert db.get(PronunciationAttempt, key) is None
