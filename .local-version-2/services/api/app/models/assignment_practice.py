from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, json_object


class AssignmentPracticeState(Base):
    __tablename__ = "assignment_practice_states"

    result_id: Mapped[UUID] = mapped_column(
        ForeignKey("grading_item_results.id", ondelete="RESTRICT"), primary_key=True
    )
    memory: Mapped[dict] = json_object()
    due_at: Mapped[datetime]
    revision: Mapped[int]
    request_id: Mapped[UUID]
    fingerprint: Mapped[str] = mapped_column(String(64))
    last_correct: Mapped[bool]
    __table_args__ = (CheckConstraint("revision > 0", name="positive_revision"),)
