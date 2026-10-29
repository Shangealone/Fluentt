import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select

from app.models.curriculum import GradeLevel
from app.models.operations import AuditLog
from app.models.users import Classroom, ClassJoinCode, ClassMembership, InstructorProfile, User
from app.modules.identity.repository import IdentityRepository
from app.modules.enrollment.queries import eligible_memberships
from app.modules.enrollment.schemas import StudentClass, MembershipDetails


class EnrollmentRepository(IdentityRepository):
    def lock_invitation(self, value):
        # Resolve only IDs first. Owner -> class -> code lock order matches instructor writes.
        reference = self.session.execute(
            select(ClassJoinCode.class_id, Classroom.instructor_id)
            .join(Classroom, Classroom.id == ClassJoinCode.class_id)
            .where(ClassJoinCode.code == value)
        ).one_or_none()
        if reference is None:
            return None
        owner = self.session.scalar(select(User).where(User.id == reference.instructor_id).with_for_update(read=True))
        classroom = self.session.scalar(select(Classroom).where(Classroom.id == reference.class_id).with_for_update())
        code = self.session.scalar(
            select(ClassJoinCode)
            .where(ClassJoinCode.code == value, ClassJoinCode.class_id == reference.class_id)
            .with_for_update()
        )
        if classroom is None or code is None or classroom.instructor_id != reference.instructor_id:
            return None
        return classroom, code, owner

    def history(self, student_id, class_id):
        return list(
            self.session.scalars(
                select(ClassMembership)
                .where(ClassMembership.student_id == student_id, ClassMembership.class_id == class_id)
                .order_by(ClassMembership.joined_at.desc(), ClassMembership.id.desc())
                .with_for_update()
            )
        )

    def describe_class(self, classroom):
        grade = self.session.get(GradeLevel, classroom.grade_level_id)
        display_name = self.session.scalar(
            select(InstructorProfile.display_name).where(InstructorProfile.user_id == classroom.instructor_id)
        )
        return StudentClass(
            class_name=classroom.class_name,
            grade_level=grade.number,
            language=classroom.language,
            instructor_display_name=display_name,
        )

    def describe_membership(self, row, classroom):
        return MembershipDetails(
            **self.describe_class(classroom).model_dump(), id=row.id, class_id=row.class_id, joined_at=row.joined_at
        )

    def mine(self, student_id, limit, offset):
        rows = self.session.scalars(
            eligible_memberships(student_id)
            .order_by(ClassMembership.joined_at.desc(), ClassMembership.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return [self.describe_membership(row, self.session.get(Classroom, row.class_id)) for row in rows]

    def enroll(self, student_id, classroom, now):
        row = ClassMembership(
            id=uuid4(),
            class_id=classroom.id,
            student_id=student_id,
            status="active",
            joined_at=now,
            created_at=now,
            updated_at=now,
        )
        self.session.add(row)
        self.session.flush()
        self.session.add(
            AuditLog(
                actor_id=student_id,
                action="class.enrolled",
                entity_type="class_membership",
                entity_id=row.id,
                occurred_at=now,
                safe_metadata={"class_id": str(classroom.id)},
            )
        )
        self.session.flush()
        return row


def preview_version(classroom, code, description, history):
    # Optimistic review marker, NOT a credential or proof of authorization. No secret/code in output.
    snapshot = [
        str(classroom.id),
        classroom.updated_at.isoformat(),
        str(code.id),
        code.updated_at.isoformat(),
        description.model_dump(),
        [(str(row.id), row.status, row.ended_at.isoformat() if row.ended_at else None) for row in history],
    ]
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()


def invitation_available(pair):
    if pair is None:
        return False
    classroom, code, owner = pair
    now = datetime.now(timezone.utc)
    return (
        owner is not None
        and owner.role == "instructor"
        and owner.profile_status in {"onboarding", "active"}
        and owner.archived_at is None
        and classroom.status == "active"
        and classroom.archived_at is None
        and code.status == "active"
        and code.revoked_at is None
        and (code.expires_at is None or code.expires_at > now)
    )
