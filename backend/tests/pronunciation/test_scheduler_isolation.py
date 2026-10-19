"""P02 §16 scheduler-isolation acceptance tests.

Every pronunciation success/unscorable/failure/retry/replay/conflict flow must
leave the full review-scheduling state (attempts, schedules, pointers, ledger,
research events, accepted events, profiles) byte-identical, leave learner
progress reporting unchanged, and never call any scheduling entry point.
"""

import json
import uuid
from datetime import UTC, datetime
from hashlib import sha256

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.analytics.service import get_learner_progress
from app.auth.models import User
from app.pronunciation import converter
from app.reviews import service as reviews_service
from app.scheduling.development import DevelopmentScheduler
from app.scheduling.fsrs6 import EnhancedFsrsScheduler
from app.scheduling.sm2 import BinarySm2Scheduler
from tests.pronunciation_helpers import (
    build_metadata,
    unscorable_payload,
    upload_attempt,
)

EXCLUDED_TABLE_PREFIXES = ("pronunciation_", "alembic_")


def _state_digest(db: Session) -> dict[str, str]:
    bind = db.get_bind()
    digest: dict[str, str] = {}
    with bind.connect() as conn:
        names = sorted(
            name
            for name in inspect(conn).get_table_names()
            if not name.startswith(EXCLUDED_TABLE_PREFIXES)
        )
        for name in names:
            rows = [
                dict(row)
                for row in conn.execute(text(f"SELECT * FROM {name}")).mappings()
            ]
            serialized = sorted(
                json.dumps(
                    {key: str(value) for key, value in row.items()}, sort_keys=True
                )
                for row in rows
            )
            digest[name] = sha256("\n".join(serialized).encode("utf-8")).hexdigest()
    return digest


@pytest.fixture
def scheduler_spies(monkeypatch: pytest.MonkeyPatch) -> dict[str, int]:
    counts = {
        "record_review_attempt": 0,
        "development_schedule": 0,
        "sm2_schedule": 0,
        "fsrs6_schedule": 0,
    }
    original_record = reviews_service.record_review_attempt

    def record_spy(*args, **kwargs):
        counts["record_review_attempt"] += 1
        return original_record(*args, **kwargs)

    monkeypatch.setattr(reviews_service, "record_review_attempt", record_spy)

    for scheduler_class, key in (
        (DevelopmentScheduler, "development_schedule"),
        (BinarySm2Scheduler, "sm2_schedule"),
        (EnhancedFsrsScheduler, "fsrs6_schedule"),
    ):
        original_schedule = scheduler_class.schedule

        def schedule_spy(self, context, _original=original_schedule, _key=key):
            counts[_key] += 1
            return _original(self, context)

        monkeypatch.setattr(scheduler_class, "schedule", schedule_spy)
    return counts


def test_pronunciation_flows_never_mutate_scheduler_or_research_state(
    client: TestClient,
    auth_headers: dict[str, str],
    refs: dict[str, dict[str, str]],
    learner: User,
    provider,
    fake_converter,
    db_session: Session,
    scheduler_spies: dict[str, int],
) -> None:
    # Pre-existing scheduler state: one real review attempt on the same content.
    review_response = client.post(
        "/reviews/attempts",
        json={
            "client_event_id": str(uuid.uuid4()),
            "client_session_id": str(uuid.uuid4()),
            "vocabulary_item_id": refs["good morning"]["vocabulary_item_id"],
            "content_revision_id": refs["good morning"]["content_revision_id"],
            "content_release_id": refs["good morning"]["content_release_id"],
            "correct": True,
            "response_time_ms": 1420,
            "client_interaction_at": datetime.now(UTC).isoformat(),
            "device_platform": "android",
            "application_version": "1.0.0",
            "submitted_answer": "good morning",
        },
        headers=auth_headers,
    )
    assert review_response.status_code == 200

    baseline = _state_digest(db_session)
    progress_before = get_learner_progress(db_session, learner).model_dump(mode="json")
    # The baseline review intentionally invoked the scheduler before pronunciation.
    for key in scheduler_spies:
        scheduler_spies[key] = 0

    # 1. scored success + same-id replay
    scored = build_metadata(refs["good morning"])
    assert upload_attempt(client, auth_headers, scored).status_code == 201
    assert upload_attempt(client, auth_headers, scored).status_code == 200

    # 2. unscorable
    provider.body = lambda reference_text: unscorable_payload("InitialSilenceTimeout")
    assert (
        upload_attempt(client, auth_headers, build_metadata(refs["water"])).status_code
        == 201
    )

    # 3. terminal failure + replay
    fake_converter.error = converter.ConverterUnavailable("fixture: not installed")
    failing = build_metadata(refs["library"])
    assert upload_attempt(client, auth_headers, failing).status_code == 503
    assert upload_attempt(client, auth_headers, failing).status_code == 200

    # 4. conflicting reuse of the failed attempt's identity
    conflicting = build_metadata(
        refs["weather"], client_id=uuid.UUID(failing["client_pronunciation_attempt_id"])
    )
    assert upload_attempt(client, auth_headers, conflicting).status_code == 409

    # 5. retry under fresh identities after the simulated service recovery
    fake_converter.error = None
    assert (
        upload_attempt(
            client, auth_headers, build_metadata(refs["weather"])
        ).status_code
        == 201
    )

    assert _state_digest(db_session) == baseline, (
        "pronunciation flows mutated non-pronunciation tables"
    )
    assert (
        get_learner_progress(db_session, learner).model_dump(mode="json")
        == progress_before
    ), "pronunciation changed learner progress/review accuracy reporting"
    assert scheduler_spies == {
        "record_review_attempt": 0,
        "development_schedule": 0,
        "sm2_schedule": 0,
        "fsrs6_schedule": 0,
    }, "pronunciation invoked a scheduling entry point"
