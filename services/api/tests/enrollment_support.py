"""Test-only enrollment repository; no substitute for PostgreSQL locking/constraints."""

from contextlib import contextmanager
from copy import deepcopy
from uuid import uuid4

from app.models.users import ClassMembership
from app.modules.enrollment.schemas import StudentClass, MembershipDetails
from tests.classroom_support import MemoryClassroomRepository


class MemoryEnrollmentRepository(MemoryClassroomRepository):
    def __init__(self):
        super().__init__()
        self.memberships = {}
        self.audit = []
        self.fail_enroll = False

    @contextmanager
    def transaction(self):
        with self._lock:
            snapshot = deepcopy(
                (self.users, self.sessions, self.profiles, self.classes, self.codes, self.memberships, self.audit)
            )
            try:
                yield
            except Exception:
                (self.users, self.sessions, self.profiles, self.classes, self.codes, self.memberships, self.audit) = (
                    snapshot
                )
                raise

    def lock_invitation(self, value):
        code = self.codes.get(value)
        if code is None:
            return None
        classroom = self.classes[code.class_id]
        owner = next(user for user in self.users.values() if user.id == classroom.instructor_id)
        return classroom, code, owner

    def has_context(self, classroom):
        return super().has_context(classroom) or any(row.class_id == classroom.id for row in self.memberships.values())

    def history(self, student_id, class_id):
        return sorted(
            [row for row in self.memberships.values() if row.student_id == student_id and row.class_id == class_id],
            key=lambda row: (row.joined_at, row.id),
            reverse=True,
        )

    def describe_class(self, classroom):
        return StudentClass(
            class_name=classroom.class_name,
            grade_level=classroom.grade_level_id,
            language=classroom.language,
            instructor_display_name=None,
        )

    def describe_membership(self, row, classroom):
        return MembershipDetails(
            **self.describe_class(classroom).model_dump(), id=row.id, class_id=row.class_id, joined_at=row.joined_at
        )

    def mine(self, student_id, limit, offset):
        result = []
        for row in self.memberships.values():
            classroom = self.classes[row.class_id]
            owner = next(user for user in self.users.values() if user.id == classroom.instructor_id)
            if (
                row.student_id == student_id
                and row.status == "active"
                and row.ended_at is None
                and classroom.status == "active"
                and classroom.archived_at is None
                and owner.role == "instructor"
                and owner.profile_status in {"active", "onboarding"}
                and owner.archived_at is None
            ):
                result.append(self.describe_membership(row, classroom))
        return sorted(result, key=lambda row: (row.joined_at, row.id), reverse=True)[offset : offset + limit]

    def enroll(self, student_id, classroom, now):
        row = ClassMembership(
            id=uuid4(),
            student_id=student_id,
            class_id=classroom.id,
            joined_at=now,
            status="active",
            created_at=now,
            updated_at=now,
        )
        self.memberships[row.id] = row
        self.audit.append({"actor_id": student_id, "entity_id": row.id})
        if self.fail_enroll:
            raise RuntimeError("synthetic audit failure after membership write")
        return row

    def mobile_profile(self, user):
        result = super().mobile_profile(user)
        if user.role == "school_student":
            exists = bool(self.mine(user.id, 1, 0))
            result.profile_status = "active" if exists else "onboarding"
            result.onboarding_step = None if exists else "class_enrollment"
        return result
