"""Run the real D5 upgrade/downgrade on isolated PostgreSQL savepoints."""

import uuid
from datetime import UTC, datetime

import pytest
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.content.models import Language, Lesson, VocabularyItem
from app.content.service import import_content_data
from app.reviews.models import ReviewAttempt, ReviewSession
from tests.content.test_provenance import DATA


def migration():
    return (
        ScriptDirectory.from_config(Config("alembic.ini"))
        .get_revision("d5a1c0de0001")
        .module
    )


def legacy_attempt(db):
    from app.auth.models import User

    user = User(
        email="migration@example.test",
        password_hash="mock",
        participant_code="P_D5_MIGRATION",
        must_change_password=False,
        is_active=True,
    )
    db.add(user)
    language = Language(code="en", name="English")
    db.add(language)
    db.flush()
    lesson = Lesson(language_code="en", title="Legacy", content_version="legacy")
    db.add(lesson)
    db.flush()
    item = VocabularyItem(
        lesson_id=lesson.id,
        term="Legacy word",
        definition="Unproven original history",
        example_sentence="Legacy example",
        content_version="legacy",
    )
    session = ReviewSession(user_id=user.id, client_session_id=uuid.uuid4())
    db.add_all([item, session])
    db.flush()
    attempt = ReviewAttempt(
        user_id=user.id,
        session_id=session.id,
        vocabulary_item_id=item.id,
        client_event_id=uuid.uuid4(),
        correct=True,
        response_time_ms=1200,
        scheduler_type="development",
        algorithm_version="dev-0.1",
        client_interaction_at=datetime.now(UTC),
        device_platform="ios",
        application_version="1.0.0",
    )
    db.add(attempt)
    db.commit()
    return attempt


def test_real_upgrade_preserves_legacy_rows_and_creates_no_inferred_content(db_session):
    attempt = legacy_attempt(db_session)
    connection = db_session.connection()
    original = dict(
        connection.execute(
            text("SELECT * FROM review_attempts WHERE id = :id"), {"id": attempt.id}
        )
        .mappings()
        .one()
    )
    savepoint = connection.begin_nested()
    try:
        with Operations.context(MigrationContext.configure(connection)):
            # Remove the later additive authority FKs before exercising the D5 boundary.
            d11 = (
                ScriptDirectory.from_config(Config("alembic.ini"))
                .get_revision("d11b00000001")
                .module
            )
            d11.downgrade()
            migration().downgrade()  # No D5 evidence exists in this isolated test.
            migration().upgrade()
            d11.upgrade()
        after = dict(
            connection.execute(
                text("SELECT * FROM review_attempts WHERE id = :id"), {"id": attempt.id}
            )
            .mappings()
            .one()
        )
        assert after == original
        assert after["content_revision_id"] is None
        assert after["content_release_id"] is None
        assert connection.scalar(text("SELECT COUNT(*) FROM vocabulary_revisions")) == 0
        assert connection.scalar(text("SELECT COUNT(*) FROM content_releases")) == 0
        assert (
            connection.scalar(
                text(
                    "SELECT current_content_release_id FROM languages WHERE code = 'en'"
                )
            )
            is None
        )
    finally:
        savepoint.rollback()
        db_session.rollback()


def test_downgrade_refuses_to_erase_published_evidence(db_session):
    import_content_data(db_session, DATA)
    with (
        Operations.context(MigrationContext.configure(db_session.connection())),
        pytest.raises(RuntimeError, match="downgrade refused"),
    ):
        migration().downgrade()
    assert (
        db_session.execute(text("SELECT COUNT(*) FROM content_releases")).scalar_one()
        == 1
    )


def test_legacy_attempt_survives_content_delete_attempt(db_session):
    attempt = legacy_attempt(db_session)
    with pytest.raises(IntegrityError):
        db_session.execute(text("DELETE FROM vocabulary_items"))
        db_session.commit()
    db_session.rollback()
    assert db_session.get(ReviewAttempt, attempt.id) is not None
