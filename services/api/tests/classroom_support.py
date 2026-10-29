"""Class repository double: proves service logic, never substitutes runtime PostgreSQL."""

from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace
from sqlalchemy.exc import IntegrityError
from tests.identity_support import MemoryIdentityRepository
from app.modules.classrooms.schemas import ClassDetails


def collision():
    cause = Exception("synthetic uniqueness failure")
    cause.sqlstate = "23505"
    cause.diag = SimpleNamespace(constraint_name="uq_class_join_codes_code")
    return IntegrityError("test-only", {}, cause)


class MemoryClassroomRepository(MemoryIdentityRepository):
    def __init__(self):
        super().__init__()
        self.classes = {}
        self.codes = {}
        self.contexts = set()
        self.fail_code = False

    @contextmanager
    def transaction(self):
        with self._lock:
            snapshot = deepcopy((self.users, self.sessions, self.profiles, self.classes, self.codes))
            try:
                yield
            except Exception:
                self.users, self.sessions, self.profiles, self.classes, self.codes = snapshot
                raise

    @contextmanager
    def savepoint(self):
        yield

    def ensure_grade(self, number):
        return number

    def add_class(self, classroom):
        self.classes[classroom.id] = classroom

    def add_code(self, code):
        if self.fail_code:
            raise RuntimeError("synthetic storage failure")
        if code.code in self.codes:
            raise collision()
        self.codes[code.code] = code

    def by_request(self, owner, request_id):
        return next(
            (
                row
                for row in self.classes.values()
                if row.instructor_id == owner and row.creation_request_id == request_id
            ),
            None,
        )

    def owned(self, owner, class_id):
        row = self.classes.get(class_id)
        return row if row is not None and row.instructor_id == owner else None

    def mine(self, owner, limit, offset):
        return sorted(
            [row for row in self.classes.values() if row.instructor_id == owner],
            key=lambda row: (row.created_at, row.id),
            reverse=True,
        )[offset : offset + limit]

    def has_context(self, classroom):
        return classroom.id in self.contexts

    def describe(self, row):
        code = next(
            (c for c in self.codes.values() if c.class_id == row.id and c.status == "active" and c.revoked_at is None),
            None,
        )
        now = datetime.now(timezone.utc)
        return ClassDetails(
            id=row.id,
            class_name=row.class_name,
            grade_level=row.grade_level_id,
            language=row.language,
            description=row.description,
            join_code=code.code
            if row.status == "active" and code and (code.expires_at is None or code.expires_at > now)
            else None,
            status=row.status,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def mobile_profile(self, user):
        result = super().mobile_profile(user)
        if user.role == "instructor":
            exists = any(row.instructor_id == user.id for row in self.classes.values())
            result.profile_status = "active" if exists else "onboarding"
            result.onboarding_step = None if exists else "first_class"
        return result
