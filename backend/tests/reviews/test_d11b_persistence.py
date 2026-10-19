"""Real PostgreSQL persistence/authority checks; no research engine or cohort."""

import copy
import importlib
import json
import uuid
from datetime import UTC, datetime, timedelta
from hashlib import sha256

import pytest
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from alembic.util import CommandError
from sqlalchemy import BigInteger, inspect, text
from sqlalchemy.exc import DBAPIError

from app.auth.models import User
from app.content.service import import_content_data
from app.reviews.models import (
    CurrentReviewSchedule,
    ReviewAttempt,
    ReviewSchedule,
    ReviewSession,
)
from tests.content.test_provenance import DATA, attempt
from tests.reviews.test_due_review import make_review_context


def authority():
    try:
        return importlib.import_module("app.research_authority.models")
    except ModuleNotFoundError:
        pytest.fail("D11B research authority persistence is not implemented")


def migration():
    script = ScriptDirectory.from_config(Config("alembic.ini"))
    try:
        return script.get_revision("d11b00000001").module
    except CommandError:
        pytest.fail("D11B forward migration is not implemented")


def graph(
    db,
    client,
    memberships=True,
    with_conditions=True,
    mapping_group=1,
    *,
    mode="test",
    clock_policy_version=None,
    frozen_at=None,
    participant_code="P_D7",
    email="due@example.test",
):
    a = authority()
    user_id, _, detail = make_review_context(
        db, client, participant_code=participant_code, email=email
    )
    frozen_at = frozen_at or datetime.now(UTC)
    protocol = a.ResearchProtocol(
        version="test-protocol-v1",
        mode=mode,
        equivalence_approval_reference="test-only",
        allocation_procedure_version="test-fixed-v1",
        period_order_procedure_version="test-order-v1",
        assignment_freeze_policy_reference="test-freeze-v1",
        clock_policy_version=clock_policy_version,
        approved_at=frozen_at,
        frozen_at=frozen_at,
        conventional_config_version="sm2-binary-config-v1",
        conventional_config_sha256="3bd486d1183d84a869a2470f0a97a13ecabc44365eb9fe8e158014fd1ef2a0d9",
        enhanced_config_version="fsrs6-binary-r90-config-v1",
        enhanced_config_sha256="4e4c56a9f928cae5581e5d577de413b17c9d581185482db423a98551f6575e4f",
    )
    db.add(protocol)
    db.flush()
    sets = [
        a.ResearchSet(
            protocol_id=protocol.id, protocol_version=protocol.version, label=label
        )
        for label in ("A", "B")
    ]
    db.add_all(sets)
    db.flush()
    if memberships:
        for research_set, word in zip(sets, detail["vocabulary_items"], strict=True):
            db.add(
                a.ResearchSetMembership(
                    protocol_id=protocol.id,
                    protocol_version=protocol.version,
                    research_set_id=research_set.id,
                    vocabulary_item_id=uuid.UUID(word["id"]),
                    content_revision_id=uuid.UUID(word["content_revision_id"]),
                    content_release_id=uuid.UUID(word["content_release_id"]),
                )
            )
        db.flush()
    allocation = a.ParticipantAllocation(
        user_id=user_id,
        protocol_id=protocol.id,
        protocol_version=protocol.version,
        mapping_group=mapping_group,
        period_order=[str(s.id) for s in reversed(sets)],
        assignment_version="test-assignment-v1",
        eligibility_reference="test-approved",
        frozen_at=frozen_at,
    )
    db.add(allocation)
    db.flush()
    conditions = []
    config_names = ("fsrs6-binary-r90-config-v1", "sm2-binary-config-v1")
    for research_set, config_name in zip(
        sets if with_conditions else [],
        config_names if with_conditions else [],
        strict=True,
    ):
        if mapping_group == 2:
            config_name = next(name for name in config_names if name != config_name)
        config = db.get(a.SchedulerConfiguration, config_name)
        condition = a.ParticipantSetCondition(
            allocation_id=allocation.id,
            user_id=user_id,
            protocol_id=protocol.id,
            protocol_version=protocol.version,
            research_set_id=research_set.id,
            scheduler_type=config.scheduler_type,
            algorithm_version=config.algorithm_version,
            state_schema_version=config.state_schema_version,
            config_version=config.config_version,
            config_sha256=config.config_sha256,
        )
        db.add(condition)
        conditions.append(condition)
    db.commit()
    return user_id, detail, protocol, sets, allocation, conditions


def direct_attempt(db, user_id, word, condition=None):
    session = ReviewSession(user_id=user_id, client_session_id=uuid.uuid4())
    db.add(session)
    db.flush()
    record = ReviewAttempt(
        user_id=user_id,
        vocabulary_item_id=uuid.UUID(word["id"]),
        content_revision_id=uuid.UUID(word["content_revision_id"]),
        content_release_id=uuid.UUID(word["content_release_id"]),
        session_id=session.id,
        client_event_id=uuid.uuid4(),
        correct=True,
        response_time_ms=123,
        client_interaction_at=datetime.now(UTC),
        device_platform="test",
        application_version="test",
        scheduler_type=condition.scheduler_type if condition else "development",
        algorithm_version=condition.algorithm_version if condition else "dev-0.1",
        research_assignment_id=condition.id if condition else None,
    )
    db.add(record)
    db.flush()
    return record


def test_bigint_storage_preserves_legacy_chain_and_d9_guards(db_session, client):
    assert isinstance(
        next(
            c["type"]
            for c in inspect(db_session.bind).get_columns("review_schedules")
            if c["name"] == "interval_seconds"
        ),
        BigInteger,
    )
    user_id, headers, detail = make_review_context(db_session, client)
    response = client.post(
        "/reviews/attempts",
        headers=headers,
        json={**attempt(detail["vocabulary_items"][0]), "correct": False},
    )
    assert response.status_code == 200
    previous = [
        dict(r)
        for r in db_session.execute(text("SELECT * FROM review_schedules")).mappings()
    ]
    assert previous[0]["interval_seconds"] == 600
    pointer = db_session.query(CurrentReviewSchedule).one().schedule_id
    assert db_session.query(ReviewAttempt).one().research_assignment_id is None
    # Storage-only fixture, not a claimed development/research engine output.
    record = direct_attempt(db_session, user_id, detail["vocabulary_items"][1])
    db_session.add(
        ReviewSchedule(
            user_id=user_id,
            vocabulary_item_id=record.vocabulary_item_id,
            attempt_id=record.id,
            scheduler_type="development",
            algorithm_version="dev-0.1",
            interval_seconds=3153600000,
            due_at=datetime.now(UTC) + timedelta(days=36500),
            scheduler_state={"storage_probe": True},
        )
    )
    db_session.commit()
    assert (
        db_session.scalar(text("SELECT max(interval_seconds) FROM review_schedules"))
        == 3153600000
    )
    assert (
        dict(
            db_session.execute(
                text("SELECT * FROM review_schedules WHERE id=:id"),
                {"id": previous[0]["id"]},
            )
            .mappings()
            .one()
        )
        == previous[0]
    )
    assert db_session.query(CurrentReviewSchedule).one().schedule_id == pointer
    with pytest.raises(DBAPIError) as error, db_session.begin_nested():
        db_session.execute(text("UPDATE review_schedules SET interval_seconds=600"))
    assert error.value.orig.sqlstate == "55000"
    with (
        pytest.raises(RuntimeError, match="BIGINT|INTEGER|fit"),
        Operations.context(MigrationContext.configure(db_session.connection())),
    ):
        migration().downgrade()


def test_real_migration_round_trip_preserves_existing_rows_and_pointer(
    db_session, client
):
    _, headers, detail = make_review_context(db_session, client)
    assert (
        client.post(
            "/reviews/attempts",
            headers=headers,
            json=attempt(detail["vocabulary_items"][0]),
        ).status_code
        == 200
    )
    connection = db_session.connection()
    before = {
        table: [
            dict(r)
            for r in connection.execute(text(f"SELECT * FROM {table}")).mappings()
        ]
        for table in (
            "review_attempts",
            "review_schedules",
            "current_review_schedules",
            "accepted_client_events",
            "research_events",
        )
    }
    savepoint = connection.begin_nested()
    try:
        with Operations.context(MigrationContext.configure(connection)):
            migration().downgrade()
            migration().upgrade()
        for table, rows in before.items():
            assert [
                dict(r)
                for r in connection.execute(text(f"SELECT * FROM {table}")).mappings()
            ] == rows
        assert (
            connection.scalar(
                text("SELECT count(*) FROM pg_trigger WHERE tgname='d9_immutable_row'")
            )
            == 4
        )
    finally:
        savepoint.rollback()
        db_session.rollback()


def test_frozen_configuration_documents_independently_reproduce_locked_digests(
    db_session,
):
    rows = db_session.query(authority().SchedulerConfiguration).all()
    assert len(rows) == 2
    expected = {
        "sm2-binary-config-v1": "3bd486d1183d84a869a2470f0a97a13ecabc44365eb9fe8e158014fd1ef2a0d9",
        "fsrs6-binary-r90-config-v1": "4e4c56a9f928cae5581e5d577de413b17c9d581185482db423a98551f6575e4f",
    }
    for row in rows:
        canonical = json.dumps(
            json.loads(row.canonical_document),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
        )
        assert row.canonical_document == canonical
        assert (
            sha256(canonical.encode()).hexdigest()
            == expected[row.config_version]
            == row.config_sha256
        )
    sm2 = json.loads(
        next(r.canonical_document for r in rows if r.config_version.startswith("sm2"))
    )
    assert sm2["ease_update"]["apply_to"] == "every_response"
    fsrs = json.loads(
        next(r.canonical_document for r in rows if r.config_version.startswith("fsrs"))
    )
    assert fsrs["parameters"] == [
        "0.212",
        "1.2931",
        "2.3065",
        "8.2956",
        "6.4133",
        "0.8334",
        "3.0194",
        "0.001",
        "1.8722",
        "0.1666",
        "0.796",
        "1.4835",
        "0.0614",
        "0.2629",
        "1.6483",
        "0.6014",
        "1.8729",
        "0.5425",
        "0.0912",
        "0.0658",
        "0.1542",
    ]


@pytest.mark.parametrize(
    "table",
    [
        "scheduler_configurations",
        "research_protocols",
        "research_sets",
        "research_set_memberships",
        "participant_allocations",
        "participant_set_conditions",
    ],
)
@pytest.mark.parametrize("operation", ["update", "delete", "truncate"])
def test_frozen_authority_records_reject_mutation(db_session, client, table, operation):
    graph(db_session, client)
    column = (
        "config_version"
        if table == "scheduler_configurations"
        else ("protocol_id" if table == "research_set_memberships" else "id")
    )
    sql = {
        "update": f"UPDATE {table} SET {column}={column}",
        "delete": f"DELETE FROM {table}",
        "truncate": f"TRUNCATE {table} CASCADE",
    }[operation]
    with pytest.raises(DBAPIError) as error, db_session.begin_nested():
        db_session.execute(text(sql))
    assert error.value.orig.sqlstate == "55000"


def test_membership_is_disjoint_and_exact_release_revision_bound(db_session, client):
    _, detail, protocol, sets, _, _ = graph(db_session, client, memberships=False)
    a = authority()
    word = detail["vocabulary_items"][0]

    def member(which, release):
        return a.ResearchSetMembership(
            protocol_id=protocol.id,
            protocol_version=protocol.version,
            research_set_id=sets[which].id,
            vocabulary_item_id=uuid.UUID(word["id"]),
            content_revision_id=uuid.UUID(word["content_revision_id"]),
            content_release_id=uuid.UUID(release),
        )

    db_session.add(member(0, word["content_release_id"]))
    db_session.commit()
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.add(member(1, word["content_release_id"]))
        db_session.flush()
    changed = copy.deepcopy(DATA)
    changed["content_version"] = "different-release"
    changed["lessons"][0]["vocabulary_items"][1]["term"] = "new-word"
    import_content_data(db_session, changed)
    from app.content.models import ContentRelease

    new_release = (
        db_session.query(ContentRelease)
        .filter_by(content_version="different-release")
        .one()
    )
    second = detail["vocabulary_items"][1]
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.add(
            a.ResearchSetMembership(
                protocol_id=protocol.id,
                protocol_version=protocol.version,
                research_set_id=sets[1].id,
                vocabulary_item_id=uuid.UUID(second["id"]),
                content_revision_id=uuid.UUID(second["content_revision_id"]),
                content_release_id=new_release.id,
            )
        )
        db_session.flush()
    # An unrelated item/revision pairing fails even though both UUIDs exist.
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.add(
            a.ResearchSetMembership(
                protocol_id=protocol.id,
                protocol_version=protocol.version,
                research_set_id=sets[1].id,
                vocabulary_item_id=uuid.UUID(detail["vocabulary_items"][1]["id"]),
                content_revision_id=uuid.UUID(word["content_revision_id"]),
                content_release_id=uuid.UUID(word["content_release_id"]),
            )
        )
        db_session.flush()


def test_condition_and_attempt_owner_set_algorithm_bindings(db_session, client):
    user_id, detail, _protocol, sets, allocation, conditions = graph(db_session, client)
    a = authority()
    other = User(
        email="other-d11b@example.test",
        password_hash="test",
        participant_code="D11B_OTHER",
        is_active=True,
        must_change_password=False,
    )
    db_session.add(other)
    db_session.commit()
    values = {
        c.name: getattr(conditions[0], c.name)
        for c in a.ParticipantSetCondition.__table__.columns
    }
    for change in [
        {"user_id": other.id},
        {"research_set_id": sets[1].id},
        {"config_sha256": "0" * 64},
    ]:
        with pytest.raises(DBAPIError), db_session.begin_nested():
            db_session.add(
                a.ParticipantSetCondition(**{**values, "id": uuid.uuid4(), **change})
            )
            db_session.flush()
    with pytest.raises(DBAPIError), db_session.begin_nested():
        direct_attempt(
            db_session, other.id, detail["vocabulary_items"][0], conditions[0]
        )
    with pytest.raises(DBAPIError), db_session.begin_nested():
        direct_attempt(
            db_session, user_id, detail["vocabulary_items"][1], conditions[0]
        )
    valid = direct_attempt(
        db_session, user_id, detail["vocabulary_items"][0], conditions[0]
    )
    assert valid.research_assignment_id == conditions[0].id
    assert allocation.period_order == [str(s.id) for s in reversed(sets)]


@pytest.mark.parametrize("group", [1, 2])
def test_condition_mapping_enforced_without_hiding_behind_uniqueness(
    db_session, client, group
):
    user_id, _, protocol, sets, allocation, _ = graph(
        db_session, client, with_conditions=False, mapping_group=group
    )
    a = authority()
    correct_name = (
        "fsrs6-binary-r90-config-v1" if group == 1 else "sm2-binary-config-v1"
    )

    def condition(config_name):
        config = db_session.get(a.SchedulerConfiguration, config_name)
        return a.ParticipantSetCondition(
            allocation_id=allocation.id,
            user_id=user_id,
            protocol_id=protocol.id,
            protocol_version=protocol.version,
            research_set_id=sets[0].id,
            scheduler_type=config.scheduler_type,
            algorithm_version=config.algorithm_version,
            state_schema_version=1,
            config_version=config.config_version,
            config_sha256=config.config_sha256,
        )

    wrong = "sm2-binary-config-v1" if group == 1 else "fsrs6-binary-r90-config-v1"
    with pytest.raises(DBAPIError, match="mapping/config"), db_session.begin_nested():
        db_session.add(condition(wrong))
        db_session.flush()
    db_session.add(condition(correct_name))
    db_session.commit()
    assert db_session.query(a.ParticipantSetCondition).count() == 1
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.add(condition(correct_name))
        db_session.flush()
    with pytest.raises(DBAPIError), db_session.begin_nested():
        values = {
            c.name: getattr(allocation, c.name)
            for c in a.ParticipantAllocation.__table__.columns
        }
        db_session.add(a.ParticipantAllocation(**{**values, "id": uuid.uuid4()}))
        db_session.flush()
