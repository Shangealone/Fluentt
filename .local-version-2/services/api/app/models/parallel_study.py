"""New coded, inactive study records; no reinterpretation of old assignments."""
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, Integer, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Entity, reference, json_object

PRIVATE = "research_private"


class ParallelProtocol(Entity, Base):
    __tablename__ = "parallel_protocols"
    study_id: Mapped[UUID] = reference("research_studies.id", unique=True)
    class_id: Mapped[UUID] = reference("classes.id")
    pack_id: Mapped[UUID] = reference(f"{PRIVATE}.esr_vocabulary_packs.id")
    actor_id: Mapped[UUID] = reference("users.id")
    request_id: Mapped[UUID]
    fingerprint: Mapped[str] = mapped_column(String(64))
    configuration: Mapped[dict] = json_object()
    seed: Mapped[bytes] = mapped_column(LargeBinary)
    __table_args__ = (UniqueConstraint("actor_id", "request_id"), {"schema": PRIVATE})


class ParallelClearance(Entity, Base):
    __tablename__ = "parallel_clearances"
    protocol_id: Mapped[UUID] = reference(f"{PRIVATE}.parallel_protocols.id")
    configuration_sha256: Mapped[str] = mapped_column(String(64))
    evidence_reference: Mapped[str] = mapped_column(String(1000))
    sequence: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(10))
    __table_args__ = (UniqueConstraint("protocol_id", "sequence"),
                      CheckConstraint("sequence > 0 AND status IN ('verified','revoked')", name="parallel_clearance"), {"schema": PRIVATE})


class ParallelAllocation(Entity, Base):
    __tablename__ = "parallel_allocations"
    protocol_id: Mapped[UUID] = reference(f"{PRIVATE}.parallel_protocols.id")
    participant_id: Mapped[UUID] = reference("research_participants.id")
    actor_id: Mapped[UUID] = reference("users.id")
    slot: Mapped[int] = mapped_column(Integer)
    condition: Mapped[str] = mapped_column(String(40))
    assigned_at: Mapped[datetime]
    method: Mapped[str] = mapped_column(String(80))
    __table_args__ = (UniqueConstraint("protocol_id", "participant_id"), UniqueConstraint("protocol_id", "slot"),
                      CheckConstraint("slot BETWEEN 0 AND 29", name="parallel_slot"),
                      CheckConstraint("condition IN ('FSRS6_CONTROL','FSRS6_FIFAKT_EXPERIMENTAL')", name="parallel_condition"),
                      {"schema": PRIVATE})


class ParallelOpportunity(Entity, Base):
    __tablename__ = "parallel_opportunities"
    protocol_id: Mapped[UUID] = reference(f"{PRIVATE}.parallel_protocols.id")
    local_date: Mapped[date] = mapped_column(Date)
    opens_at: Mapped[datetime]
    closes_at: Mapped[datetime]
    __table_args__ = (UniqueConstraint("protocol_id", "local_date"),
                      CheckConstraint("closes_at > opens_at", name="parallel_window"), {"schema": PRIVATE})


class ParallelAssessment(Entity, Base):
    __tablename__ = "parallel_assessments"
    protocol_id: Mapped[UUID] = reference(f"{PRIVATE}.parallel_protocols.id")
    kind: Mapped[str] = mapped_column(String(20))
    designated_date: Mapped[date | None] = mapped_column(Date)
    __table_args__ = (UniqueConstraint("protocol_id", "kind"),
                      CheckConstraint("kind IN ('pretest','posttest','delayed')", name="parallel_assessment_kind"), {"schema": PRIVATE})
