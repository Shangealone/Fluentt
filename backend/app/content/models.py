import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    DDL,
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    event,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.content.provenance_ddl import IMMUTABLE_CONTENT_DDL
from app.database.base import Base


class Language(Base):
    __tablename__ = "languages"

    code: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    current_content_release_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "content_releases.id",
            ondelete="RESTRICT",
            use_alter=True,
            name="fk_language_current_release",
        ),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    lessons: Mapped[list["Lesson"]] = relationship(
        "Lesson",
        back_populates="language",
        cascade="all, delete-orphan",
        order_by="Lesson.sort_order",
    )


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    language_code: Mapped[str] = mapped_column(
        String(10),
        ForeignKey("languages.code", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_version: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    language: Mapped[Language] = relationship("Language", back_populates="lessons")
    vocabulary_items: Mapped[list["VocabularyItem"]] = relationship(
        "VocabularyItem",
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="VocabularyItem.sort_order",
    )


class VocabularyItem(Base):
    __tablename__ = "vocabulary_items"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    term: Mapped[str] = mapped_column(String(255), nullable=False)
    definition: Mapped[str] = mapped_column(Text, nullable=False)
    example_sentence: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(
        String(32), default="beginner", nullable=False
    )
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    translation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_version: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    lesson: Mapped[Lesson] = relationship("Lesson", back_populates="vocabulary_items")


class VocabularyRevision(Base):
    """Immutable existing item semantics; one row can be reused by many releases/attempts."""

    __tablename__ = "vocabulary_revisions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    vocabulary_item_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("vocabulary_items.id", ondelete="RESTRICT"),
        index=True,
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("lessons.id", ondelete="RESTRICT"), index=True
    )
    term: Mapped[str] = mapped_column(String(255))
    definition: Mapped[str] = mapped_column(Text)
    example_sentence: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(32))
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    translation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_version: Mapped[str] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean)
    sort_order: Mapped[int] = mapped_column(Integer)
    semantic_digest: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    __table_args__ = (
        UniqueConstraint("id", "vocabulary_item_id", name="uq_revision_item"),
    )


class ContentRelease(Base):
    """Immutable language/lesson context and exact revision membership; no duplicated word text."""

    __tablename__ = "content_releases"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    language_code: Mapped[str] = mapped_column(
        String(10), ForeignKey("languages.code", ondelete="RESTRICT"), index=True
    )
    content_version: Mapped[str] = mapped_column(String(64), index=True)
    manifest: Mapped[dict[str, Any]] = mapped_column(JSON)
    semantic_digest: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


# The migration contains the same frozen D5 guard. create_all also installs it for
# PostgreSQL test schemas; no ORM-only immutability assumption is made.
for statement in IMMUTABLE_CONTENT_DDL:
    event.listen(
        Base.metadata, "after_create", DDL(statement).execute_if(dialect="postgresql")
    )
