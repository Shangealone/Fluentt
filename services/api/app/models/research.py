"""Coded research records; identifying links/consent evidence use a private schema."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Entity, choice, json_object, language, reference


class ModelVersion(Entity, Base):
    __tablename__ = "model_versions"
    task: Mapped[str] = mapped_column(String(60))
    provider: Mapped[str] = mapped_column(String(100))
    model_name: Mapped[str] = mapped_column(String(150))
    version: Mapped[str] = mapped_column(String(100))
    capabilities: Mapped[dict] = json_object()
    artifact_reference: Mapped[str | None] = mapped_column(Text)
    simulated: Mapped[bool] = mapped_column(default=False, server_default=text("false"))
    __table_args__ = (UniqueConstraint("task", "provider", "model_name", "version"),)


class ModelConfiguration(Entity, Base):
    __tablename__ = "model_configurations"
    model_version_id: Mapped[UUID] = reference("model_versions.id")
    version: Mapped[int] = mapped_column(Integer)
    parameters: Mapped[dict] = json_object()
    __table_args__ = (
        UniqueConstraint("model_version_id", "version"),
        CheckConstraint("version > 0", name="positive_version"),
    )


class SchedulerConfiguration(Entity, Base):
    __tablename__ = "scheduler_configurations"
    algorithm: Mapped[str] = mapped_column(String(80))
    implementation_version: Mapped[str] = mapped_column(String(100))
    configuration_version: Mapped[int] = mapped_column(Integer)
    parameters: Mapped[dict] = json_object()
    model_configuration_id: Mapped[UUID | None] = reference("model_configurations.id", nullable=True)
    __table_args__ = (
        UniqueConstraint("algorithm", "implementation_version", "configuration_version"),
        CheckConstraint("configuration_version > 0", name="positive_version"),
    )


class ResearchStudy(Entity, Base):
    __tablename__ = "research_studies"
    code: Mapped[str] = mapped_column(String(80), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(
        choice("study_status", "draft", "approved", "active", "completed", "archived"),
        default="draft",
        server_default="draft",
    )
    target_language: Mapped[str] = mapped_column(language())
    protocol_version: Mapped[str] = mapped_column(String(80))
    target_participants: Mapped[int] = mapped_column(Integer, default=30, server_default="30")
    starts_at: Mapped[datetime | None]
    ends_at: Mapped[datetime | None]
    conditions: Mapped[dict] = json_object()
    locked_at: Mapped[datetime | None]
    __table_args__ = (
        CheckConstraint("target_participants > 0", name="positive_target"),
        CheckConstraint("ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at", name="study_dates"),
    )


class ResearchParticipant(Entity, Base):
    __tablename__ = "research_participants"
    study_id: Mapped[UUID] = reference("research_studies.id")
    participant_code: Mapped[str] = mapped_column(String(80))
    enrollment_status: Mapped[str] = mapped_column(
        choice("enrollment", "pending", "enrolled", "withdrawn", "completed"),
        default="pending",
        server_default="pending",
    )
    eligibility_status: Mapped[str] = mapped_column(
        choice("eligibility", "pending", "eligible", "ineligible"), default="pending", server_default="pending"
    )
    enrolled_at: Mapped[datetime | None]
    withdrawn_at: Mapped[datetime | None]
    __table_args__ = (UniqueConstraint("study_id", "participant_code"), UniqueConstraint("id", "study_id"))


class ResearchIdentityLink(Entity, Base):
    __tablename__ = "research_identity_links"
    participant_id: Mapped[UUID] = mapped_column(unique=True, index=True)
    study_id: Mapped[UUID] = reference("research_studies.id")
    user_id: Mapped[UUID] = reference("users.id")
    __table_args__ = (
        ForeignKeyConstraint(
            ["participant_id", "study_id"],
            ["research_participants.id", "research_participants.study_id"],
            ondelete="RESTRICT",
        ),
        UniqueConstraint("study_id", "user_id"),
        {"schema": "research_private"},
    )


class ResearchConsentRecord(Entity, Base):
    __tablename__ = "research_consent_records"
    participant_id: Mapped[UUID] = reference("research_participants.id")
    kind: Mapped[str] = mapped_column(choice("consent_kind", "consent", "guardian_consent", "assent"))
    protocol_version: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(choice("consent_status", "granted", "withdrawn"))
    evidence_reference: Mapped[str] = mapped_column(Text)
    recorded_at: Mapped[datetime]
    __table_args__ = ({"schema": "research_private"},)


class ResearchGroup(Entity, Base):
    __tablename__ = "research_groups"
    study_id: Mapped[UUID] = reference("research_studies.id")
    condition: Mapped[str] = mapped_column(choice("condition", "sm2_control", "esr_experimental"))
    target_size: Mapped[int] = mapped_column(Integer, default=15, server_default="15")
    scheduler_configuration_id: Mapped[UUID] = reference("scheduler_configurations.id")
    __table_args__ = (
        UniqueConstraint("study_id", "condition"),
        UniqueConstraint("id", "study_id"),
        CheckConstraint("target_size > 0", name="positive_target"),
    )


class ResearchGroupAssignment(Entity, Base):
    __tablename__ = "research_group_assignments"
    participant_id: Mapped[UUID] = mapped_column(index=True)
    group_id: Mapped[UUID] = mapped_column(index=True)
    study_id: Mapped[UUID] = mapped_column(index=True)
    assignment_number: Mapped[int] = mapped_column(Integer)
    assigned_at: Mapped[datetime]
    allocation_metadata: Mapped[dict] = json_object()
    supersedes_id: Mapped[UUID | None] = mapped_column(unique=True, index=True)
    __table_args__ = (
        ForeignKeyConstraint(
            ["participant_id", "study_id"],
            ["research_participants.id", "research_participants.study_id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["group_id", "study_id"], ["research_groups.id", "research_groups.study_id"], ondelete="RESTRICT"
        ),
        UniqueConstraint("participant_id", "assignment_number"),
        UniqueConstraint("id", "participant_id"),
        ForeignKeyConstraint(
            ["supersedes_id", "participant_id"],
            ["research_group_assignments.id", "research_group_assignments.participant_id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("(assignment_number = 1) = (supersedes_id IS NULL)", name="history_root"),
        CheckConstraint("assignment_number > 0", name="positive_assignment"),
    )


class ResearchLevel(Entity, Base):
    __tablename__ = "research_levels"
    study_id: Mapped[UUID] = reference("research_studies.id")
    number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    content_snapshot: Mapped[dict] = json_object()
    locked_at: Mapped[datetime | None]
    __table_args__ = (
        UniqueConstraint("study_id", "number"),
        UniqueConstraint("id", "study_id"),
        CheckConstraint("number BETWEEN 1 AND 5", name="level_range"),
    )


class ResearchAssessment(Entity, Base):
    __tablename__ = "research_assessments"
    study_id: Mapped[UUID] = reference("research_studies.id")
    kind: Mapped[str] = mapped_column(
        choice("assessment_kind", "pre_test", "learning_level", "post_test", "delayed_retention", "pronunciation")
    )
    level_id: Mapped[UUID | None] = mapped_column(index=True)
    instrument_version: Mapped[str] = mapped_column(String(80))
    instrument_snapshot: Mapped[dict] = json_object()
    conditions: Mapped[dict] = json_object()
    opens_at: Mapped[datetime | None]
    closes_at: Mapped[datetime | None]
    locked_at: Mapped[datetime | None]
    __table_args__ = (
        UniqueConstraint("id", "study_id"),
        ForeignKeyConstraint(
            ["level_id", "study_id"], ["research_levels.id", "research_levels.study_id"], ondelete="RESTRICT"
        ),
        CheckConstraint("(kind = 'learning_level') = (level_id IS NOT NULL)", name="level_context"),
        CheckConstraint("closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at", name="assessment_window"),
        Index(
            "uq_research_assessment_instrument",
            "study_id",
            "kind",
            "instrument_version",
            unique=True,
            postgresql_where=text("level_id IS NULL"),
        ),
        Index(
            "uq_research_assessment_level",
            "study_id",
            "level_id",
            "instrument_version",
            unique=True,
            postgresql_where=text("level_id IS NOT NULL"),
        ),
    )


class ResearchAssessmentResult(Entity, Base):
    __tablename__ = "research_assessment_results"
    assessment_id: Mapped[UUID] = mapped_column(index=True)
    participant_id: Mapped[UUID] = mapped_column(index=True)
    study_id: Mapped[UUID] = mapped_column(index=True)
    attempt_number: Mapped[int] = mapped_column(Integer)
    started_at: Mapped[datetime]
    completed_at: Mapped[datetime | None]
    status: Mapped[str] = mapped_column(choice("result_status", "in_progress", "completed", "invalidated"))
    score: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    maximum_score: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    response_duration_ms: Mapped[int | None] = mapped_column(Integer)
    responses: Mapped[dict] = json_object()
    model_configuration_id: Mapped[UUID | None] = reference("model_configurations.id", nullable=True)
    __table_args__ = (
        ForeignKeyConstraint(
            ["assessment_id", "study_id"],
            ["research_assessments.id", "research_assessments.study_id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["participant_id", "study_id"],
            ["research_participants.id", "research_participants.study_id"],
            ondelete="RESTRICT",
        ),
        UniqueConstraint("assessment_id", "participant_id", "attempt_number"),
        CheckConstraint(
            "attempt_number > 0 AND (response_duration_ms IS NULL OR response_duration_ms >= 0)", name="valid_attempt"
        ),
        CheckConstraint(
            "(score IS NULL AND maximum_score IS NULL) OR (score IS NOT NULL AND maximum_score IS NOT NULL AND score >= 0 AND maximum_score >= score)",
            name="score_range",
        ),
        CheckConstraint("completed_at IS NULL OR completed_at >= started_at", name="completion_order"),
        CheckConstraint("status != 'completed' OR completed_at IS NOT NULL", name="completed_timestamp"),
    )


class ResearchEvent(Entity, Base):
    __tablename__ = "research_events"
    participant_id: Mapped[UUID] = reference("research_participants.id")
    event_type: Mapped[str] = mapped_column(String(80))
    event_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    occurred_at: Mapped[datetime]
    payload: Mapped[dict] = json_object()
    __table_args__ = (Index("ix_research_events_participant_time", "participant_id", "occurred_at"),)
