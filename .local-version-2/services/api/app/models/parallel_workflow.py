"""Track 1 records are usable only in guarded disposable test databases."""
from datetime import datetime
from uuid import UUID
from sqlalchemy import CheckConstraint, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, Entity, reference, json_object

P = "research_private"


class TestWorkflow(Entity, Base):
    __tablename__ = "parallel_test_workflows"
    protocol_id: Mapped[UUID] = reference(f"{P}.parallel_protocols.id", unique=True)
    configuration: Mapped[dict] = json_object()
    __table_args__ = (CheckConstraint("configuration @> '{\"development_only\": true}'::jsonb", name="workflow_development"), {"schema": P})


class WorkflowEvent(Entity, Base):
    __tablename__ = "parallel_workflow_events"
    protocol_id: Mapped[UUID] = reference(f"{P}.parallel_protocols.id")
    participant_id: Mapped[UUID | None] = reference("research_participants.id", nullable=True)
    actor_id: Mapped[UUID] = reference("users.id")
    kind: Mapped[str] = mapped_column(String(30))
    target_id: Mapped[UUID]
    evidence: Mapped[dict] = json_object()
    __table_args__ = (UniqueConstraint("protocol_id", "participant_id", "kind", "target_id"), {"schema": P})


class WorkflowAttempt(Entity, Base):
    __tablename__ = "parallel_workflow_attempts"
    allocation_id: Mapped[UUID] = reference(f"{P}.parallel_allocations.id")
    assessment_id: Mapped[UUID | None] = reference(f"{P}.parallel_assessments.id", nullable=True)
    opportunity_id: Mapped[UUID | None] = reference(f"{P}.parallel_opportunities.id", nullable=True)
    snapshot: Mapped[dict] = json_object()
    responses: Mapped[dict] = json_object()
    revision: Mapped[int] = mapped_column(Integer, default=1)
    started_at: Mapped[datetime]
    submitted_at: Mapped[datetime | None]
    request_id: Mapped[UUID | None]
    fingerprint: Mapped[str | None] = mapped_column(String(64))
    result: Mapped[dict] = json_object()
    __table_args__ = (UniqueConstraint("allocation_id", "assessment_id"), UniqueConstraint("allocation_id", "opportunity_id"),
                      UniqueConstraint("allocation_id", "request_id"),
                      CheckConstraint("(assessment_id IS NULL) <> (opportunity_id IS NULL)", name="workflow_target"),
                      CheckConstraint("revision > 0", name="workflow_revision"), {"schema": P})


class WorkflowMemory(Entity, Base):
    __tablename__ = "parallel_workflow_memory"
    allocation_id: Mapped[UUID] = reference(f"{P}.parallel_allocations.id")
    vocabulary_item_id: Mapped[UUID] = reference("vocabulary_items.id")
    content_version: Mapped[int] = mapped_column(Integer)
    memory: Mapped[dict] = json_object()
    due_at: Mapped[datetime]
    revision: Mapped[int] = mapped_column(Integer, default=1)
    __table_args__ = (UniqueConstraint("allocation_id", "vocabulary_item_id", "content_version"), {"schema": P})
