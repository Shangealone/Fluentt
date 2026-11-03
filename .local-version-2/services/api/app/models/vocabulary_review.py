"""ESR snapshots and coded histories live outside ordinary assignment records."""
from datetime import datetime
from uuid import UUID
from sqlalchemy import CheckConstraint, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, Entity, reference, json_object, choice

PRIVATE = "research_private"


class VocabularyPack(Entity, Base):
    __tablename__ = "esr_vocabulary_packs"
    author_id: Mapped[UUID] = reference("users.id")
    lesson_id: Mapped[UUID] = reference("lessons.id")
    title: Mapped[str] = mapped_column(String(200))
    language: Mapped[str] = mapped_column(choice("esr_pack_language", "english", "tagalog"))
    content: Mapped[dict] = json_object()
    fingerprint: Mapped[str] = mapped_column(String(64))
    published_at: Mapped[datetime | None]
    __table_args__ = ({"schema": PRIVATE},)


class ESRProtocol(Entity, Base):
    __tablename__ = "esr_protocols"
    study_id: Mapped[UUID] = reference("research_studies.id", unique=True)
    manager_id: Mapped[UUID] = reference("users.id")
    class_id: Mapped[UUID] = reference("classes.id")
    pack_a_id: Mapped[UUID] = reference(f"{PRIVATE}.esr_vocabulary_packs.id")
    pack_b_id: Mapped[UUID] = reference(f"{PRIVATE}.esr_vocabulary_packs.id")
    configuration: Mapped[dict] = json_object()
    status: Mapped[str] = mapped_column(choice("esr_protocol_status", "draft", "active", "paused", "completed"), default="draft")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    __table_args__ = (CheckConstraint("pack_a_id <> pack_b_id AND revision > 0", name="distinct_pools"), {"schema": PRIVATE})


class ESRApproval(Entity, Base):
    """Operator evidence only. No HTTP endpoint inserts or verifies approvals."""
    __tablename__ = "esr_approvals"
    protocol_id: Mapped[UUID] = reference(f"{PRIVATE}.esr_protocols.id")
    kind: Mapped[str] = mapped_column(choice("esr_approval_kind", "protocol", "ethics", "site", "instruments", "model"))
    sequence: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(choice("esr_approval_status", "verified", "revoked"))
    evidence_reference: Mapped[str] = mapped_column(String(1000))
    evidence_sha256: Mapped[str] = mapped_column(String(64))
    configuration_sha256: Mapped[str] = mapped_column(String(64))
    __table_args__ = (UniqueConstraint("protocol_id", "kind", "sequence"),
                      CheckConstraint("sequence > 0", name="positive_sequence"), {"schema": PRIVATE})


class ESRAllocation(Entity, Base):
    __tablename__ = "esr_allocations"
    protocol_id: Mapped[UUID] = reference(f"{PRIVATE}.esr_protocols.id")
    participant_id: Mapped[UUID] = reference("research_participants.id")
    mapping: Mapped[int] = mapped_column(Integer)
    __table_args__ = (UniqueConstraint("protocol_id", "participant_id"),
                      CheckConstraint("mapping IN (1,2)", name="mapping_choice"), {"schema": PRIVATE})


class ESRReviewState(Entity, Base):
    __tablename__ = "esr_review_states"
    allocation_id: Mapped[UUID] = reference(f"{PRIVATE}.esr_allocations.id")
    pack_id: Mapped[UUID] = reference(f"{PRIVATE}.esr_vocabulary_packs.id")
    vocabulary_item_id: Mapped[UUID] = reference("vocabulary_items.id")
    memory: Mapped[dict] = json_object()
    due_at: Mapped[datetime]
    revision: Mapped[int] = mapped_column(Integer, default=1)
    __table_args__ = (UniqueConstraint("allocation_id", "pack_id", "vocabulary_item_id"),
                      CheckConstraint("revision > 0", name="positive_revision"), {"schema": PRIVATE})


class ESRReview(Entity, Base):
    __tablename__ = "esr_reviews"
    state_id: Mapped[UUID] = reference(f"{PRIVATE}.esr_review_states.id")
    format: Mapped[str] = mapped_column(choice("esr_review_format", "multiple_choice", "typed_recall"))
    state_revision: Mapped[int] = mapped_column(Integer)
    presented_at: Mapped[datetime]
    answered_at: Mapped[datetime | None]
    finalized_at: Mapped[datetime | None]
    response: Mapped[dict] = json_object()
    decision: Mapped[dict] = json_object()
    __table_args__ = (UniqueConstraint("state_id", "state_revision"), {"schema": PRIVATE})


class ESRMutation(Entity, Base):
    __tablename__ = "esr_mutations"
    actor_id: Mapped[UUID] = reference("users.id")
    request_id: Mapped[UUID]
    fingerprint: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = json_object()
    __table_args__ = (UniqueConstraint("actor_id", "request_id"), {"schema": PRIVATE})
