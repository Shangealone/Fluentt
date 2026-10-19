"""Shared eligibility query used by enrollment reads and session restoration."""

from sqlalchemy import select
from sqlalchemy.orm import aliased

from app.models.users import Classroom, ClassMembership, User


def eligible_memberships(student_id):
    owner = aliased(User)
    return (
        select(ClassMembership)
        .join(Classroom, Classroom.id == ClassMembership.class_id)
        .join(owner, owner.id == Classroom.instructor_id)
        .where(
            ClassMembership.student_id == student_id,
            ClassMembership.status == "active",
            ClassMembership.ended_at.is_(None),
            Classroom.status == "active",
            Classroom.archived_at.is_(None),
            owner.role == "instructor",
            owner.profile_status.in_(["onboarding", "active"]),
            owner.archived_at.is_(None),
        )
    )
