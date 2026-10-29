"""Opt-in classroom research configuration. Ordinary learning models remain unchanged.

Private schema prevents a public cohort -> classroom -> student identity bridge.
Existing studies, participants, consent, allocations and instruments are referenced,
never copied from ordinary learning or populated by these configuration APIs.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKeyConstraint, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, Entity, choice, json_object, reference

SCHEMA = "research_private"


class ResearchClassroomStudy(Entity, Base):
    __tablename__ = "classroom_studies"
    study_id: Mapped[UUID] = reference("research_studies.id", unique=True)
    manager_id: Mapped[UUID] = reference("users.id")
    status: Mapped[str] = mapped_column(
        choice("classroom_study_status", "DRAFT", "READY", "ACTIVE", "PAUSED", "COMPLETED"), default="DRAFT"
    )
    revision: Mapped[int] = mapped_column(Integer, default=1)
    current_protocol_id: Mapped[UUID | None] = mapped_column(nullable=True)
    __table_args__ = (
        UniqueConstraint("id", "study_id"),
        ForeignKeyConstraint(
            ["current_protocol_id", "id"],
            [f"{SCHEMA}.classroom_protocols.id", f"{SCHEMA}.classroom_protocols.scope_id"],
            name="fk_classroom_study_current_protocol",
            use_alter=True,
        ),
        CheckConstraint("revision > 0", name="revision_positive"),
        {"schema": SCHEMA},
    )


class ResearchClassroomProtocol(Entity, Base):
    __tablename__ = "classroom_protocols"
    scope_id: Mapped[UUID] = reference(f"{SCHEMA}.classroom_studies.id")
    study_id: Mapped[UUID] = reference("research_studies.id")
    version: Mapped[int] = mapped_column(Integer)
    protocol_version: Mapped[str] = mapped_column(String(80))
    fingerprint: Mapped[str] = mapped_column(String(64))
    configuration: Mapped[dict] = json_object()
    __table_args__ = (
        UniqueConstraint("scope_id", "version"),
        UniqueConstraint("id", "scope_id", name="uq_rc_protocol_scope"),
        UniqueConstraint("id", "study_id", name="uq_rc_protocol_study"),
        ForeignKeyConstraint(
            ["scope_id", "study_id"],
            [f"{SCHEMA}.classroom_studies.id", f"{SCHEMA}.classroom_studies.study_id"],
            name="fk_" + __tablename__ + "_scope_study",
        ),
        CheckConstraint("version > 0 AND fingerprint ~ '^[0-9a-f]{64}$'", name="valid_protocol"),
        CheckConstraint("jsonb_typeof(configuration) = 'object'", name="configuration_object"),
        {"schema": SCHEMA},
    )


class ResearchClassroomBinding(Entity, Base):
    __tablename__ = "classroom_bindings"
    scope_id: Mapped[UUID] = reference(f"{SCHEMA}.classroom_studies.id")
    study_id: Mapped[UUID] = reference("research_studies.id")
    class_id: Mapped[UUID] = reference("classes.id")
    __table_args__ = (
        UniqueConstraint("scope_id", "class_id"),
        UniqueConstraint("id", "study_id"),
        ForeignKeyConstraint(
            ["scope_id", "study_id"],
            [f"{SCHEMA}.classroom_studies.id", f"{SCHEMA}.classroom_studies.study_id"],
            name="fk_" + __tablename__ + "_scope_study",
        ),
        {"schema": SCHEMA},
    )


class ResearchClassroomEnrollment(Entity, Base):
    __tablename__ = "classroom_enrollments"
    study_id: Mapped[UUID] = reference("research_studies.id")
    binding_id: Mapped[UUID] = mapped_column(index=True)
    participant_id: Mapped[UUID] = mapped_column(index=True)
    protocol_id: Mapped[UUID] = mapped_column(index=True)
    group_assignment_id: Mapped[UUID | None] = mapped_column(nullable=True)
    authorization_state: Mapped[str] = mapped_column(
        choice("classroom_participation_authorization", "pending", "authorized", "withdrawn"), default="pending"
    )
    __table_args__ = (
        UniqueConstraint("binding_id", "participant_id"),
        UniqueConstraint("id", "study_id"),
        ForeignKeyConstraint(
            ["binding_id", "study_id"], [f"{SCHEMA}.classroom_bindings.id", f"{SCHEMA}.classroom_bindings.study_id"]
        ),
        ForeignKeyConstraint(
            ["participant_id", "study_id"], ["research_participants.id", "research_participants.study_id"]
        ),
        ForeignKeyConstraint(
            ["protocol_id", "study_id"], [f"{SCHEMA}.classroom_protocols.id", f"{SCHEMA}.classroom_protocols.study_id"]
        ),
        ForeignKeyConstraint(
            ["group_assignment_id", "participant_id"],
            ["research_group_assignments.id", "research_group_assignments.participant_id"],
        ),
        {"schema": SCHEMA},
    )


class ResearchClassroomAssessment(Entity, Base):
    __tablename__ = "classroom_assessment_references"
    study_id: Mapped[UUID] = reference("research_studies.id")
    protocol_id: Mapped[UUID] = mapped_column(index=True)
    assessment_id: Mapped[UUID] = mapped_column(index=True)
    instrument_version: Mapped[str] = mapped_column(String(80))
    opens_at: Mapped[datetime | None]
    closes_at: Mapped[datetime | None]
    timer_limit_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    __table_args__ = (
        UniqueConstraint("protocol_id", "assessment_id"),
        ForeignKeyConstraint(
            ["protocol_id", "study_id"], [f"{SCHEMA}.classroom_protocols.id", f"{SCHEMA}.classroom_protocols.study_id"]
        ),
        ForeignKeyConstraint(
            ["assessment_id", "study_id"], ["research_assessments.id", "research_assessments.study_id"]
        ),
        CheckConstraint("timer_limit_seconds IS NULL OR timer_limit_seconds > 0", name="positive_timer"),
        CheckConstraint("closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at", name="ordered_window"),
        {"schema": SCHEMA},
    )


class ResearchClassroomClearance(Entity, Base):
    """Operator evidence ledger. No HTTP endpoint may verify or insert a clearance.

    Runtime grants must be SELECT-only on this table. No real clearance is seeded.
    Verification/IRB authority is an external prerequisite, not a UI affirmation.
    """

    __tablename__ = "classroom_clearances"
    protocol_id: Mapped[UUID] = reference(f"{SCHEMA}.classroom_protocols.id")
    kind: Mapped[str] = mapped_column(
        choice("classroom_clearance_kind", "protocol", "ethics", "site_permission", "instruments", "conditions")
    )
    sequence: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(choice("classroom_clearance_status", "verified", "revoked"))
    evidence_reference: Mapped[str] = mapped_column(Text)
    evidence_sha256: Mapped[str] = mapped_column(String(64))
    verifier_reference: Mapped[str] = mapped_column(Text)
    recorded_at: Mapped[datetime]
    __table_args__ = (
        UniqueConstraint("protocol_id", "kind", "sequence"),
        CheckConstraint("sequence > 0 AND evidence_sha256 ~ '^[0-9a-f]{64}$'", name="clearance_evidence"),
        CheckConstraint(
            "length(btrim(evidence_reference)) > 0 AND length(btrim(verifier_reference)) > 0",
            name="clearance_references",
        ),
        {"schema": SCHEMA},
    )


class ResearchClassroomEvent(Entity, Base):
    __tablename__ = "classroom_events"
    scope_id: Mapped[UUID] = reference(f"{SCHEMA}.classroom_studies.id")
    study_id: Mapped[UUID] = reference("research_studies.id")
    protocol_id: Mapped[UUID | None] = mapped_column(nullable=True)
    binding_id: Mapped[UUID | None] = mapped_column(nullable=True)
    participant_id: Mapped[UUID | None] = mapped_column(nullable=True)
    group_assignment_id: Mapped[UUID | None] = mapped_column(nullable=True)
    condition: Mapped[str | None] = mapped_column(
        choice("classroom_event_condition", "sm2_control", "esr_experimental"), nullable=True
    )
    scheduler_configuration_id: Mapped[UUID | None] = reference("scheduler_configurations.id", nullable=True)
    actor_id: Mapped[UUID] = reference("users.id")
    request_id: Mapped[UUID] = mapped_column()
    operation: Mapped[str] = mapped_column(String(50))
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    response_snapshot: Mapped[dict] = json_object()
    __table_args__ = (
        UniqueConstraint("actor_id", "request_id"),
        ForeignKeyConstraint(
            ["scope_id", "study_id"],
            [f"{SCHEMA}.classroom_studies.id", f"{SCHEMA}.classroom_studies.study_id"],
            name="fk_" + __tablename__ + "_scope_study",
        ),
        ForeignKeyConstraint(
            ["protocol_id", "study_id"], [f"{SCHEMA}.classroom_protocols.id", f"{SCHEMA}.classroom_protocols.study_id"]
        ),
        ForeignKeyConstraint(
            ["binding_id", "study_id"], [f"{SCHEMA}.classroom_bindings.id", f"{SCHEMA}.classroom_bindings.study_id"]
        ),
        ForeignKeyConstraint(
            ["participant_id", "study_id"], ["research_participants.id", "research_participants.study_id"]
        ),
        ForeignKeyConstraint(
            ["group_assignment_id", "participant_id"],
            ["research_group_assignments.id", "research_group_assignments.participant_id"],
        ),
        CheckConstraint(
            "(group_assignment_id IS NULL AND condition IS NULL AND scheduler_configuration_id IS NULL) OR (group_assignment_id IS NOT NULL AND condition IS NOT NULL AND scheduler_configuration_id IS NOT NULL AND participant_id IS NOT NULL AND protocol_id IS NOT NULL AND binding_id IS NOT NULL)",
            name="event_allocation_context",
        ),
        CheckConstraint(
            "request_fingerprint ~ '^[0-9a-f]{64}$' AND jsonb_typeof(response_snapshot) = 'object'",
            name="event_contract",
        ),
        {"schema": SCHEMA},
    )
