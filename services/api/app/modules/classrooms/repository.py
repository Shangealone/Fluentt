from contextlib import contextmanager
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import select, or_
from sqlalchemy.dialects.postgresql import insert
from app.models.assessments import Assignment
from app.models.curriculum import GradeLevel
from app.models.learning import LearningContext
from app.models.operations import Message
from app.models.users import Classroom, ClassJoinCode, ClassMembership
from app.modules.identity.repository import IdentityRepository
from app.modules.classrooms.schemas import ClassDetails


class ClassroomRepository(IdentityRepository):
    @contextmanager
    def savepoint(self):
        with self.session.begin_nested():
            yield

    def ensure_grade(self, number: int) -> UUID:
        self.session.execute(
            insert(GradeLevel)
            .values(number=number, name=f"Grade {number}")
            .on_conflict_do_nothing(index_elements=[GradeLevel.number])
        )
        return self.session.scalar(select(GradeLevel.id).where(GradeLevel.number == number))

    def add_class(self, classroom: Classroom) -> None:
        self.session.add(classroom)
        self.session.flush()

    def add_code(self, code: ClassJoinCode) -> None:
        self.session.add(code)
        self.session.flush()

    def by_request(self, owner: UUID, request_id: UUID) -> Classroom | None:
        return self.session.scalar(
            select(Classroom).where(Classroom.instructor_id == owner, Classroom.creation_request_id == request_id)
        )

    def owned(self, owner: UUID, class_id: UUID) -> Classroom | None:
        return self.session.scalar(
            select(Classroom).where(Classroom.id == class_id, Classroom.instructor_id == owner).with_for_update()
        )

    def mine(self, owner: UUID, limit: int, offset: int):
        return self.session.scalars(
            select(Classroom)
            .where(Classroom.instructor_id == owner)
            .order_by(Classroom.created_at.desc(), Classroom.id.desc())
            .limit(limit)
            .offset(offset)
        ).all()

    def has_classes(self, owner: UUID) -> bool:
        return self.session.scalar(select(Classroom.id).where(Classroom.instructor_id == owner).limit(1)) is not None

    def has_context(self, classroom: Classroom) -> bool:
        if classroom.subject_id is not None:
            return True
        for model in (ClassMembership, Assignment, LearningContext, Message):
            if (
                self.session.scalar(
                    select(model.id)
                    .where(
                        or_(model.class_id == classroom.id, model.context_class_id == classroom.id)
                        if model is Message
                        else model.class_id == classroom.id
                    )
                    .limit(1)
                )
                is not None
            ):
                return True
        return False

    def describe(self, classroom: Classroom) -> ClassDetails:
        grade = self.session.get(GradeLevel, classroom.grade_level_id)
        code = self.session.scalar(
            select(ClassJoinCode).where(
                ClassJoinCode.class_id == classroom.id,
                ClassJoinCode.status == "active",
                ClassJoinCode.revoked_at.is_(None),
            )
        )
        now = datetime.now(timezone.utc)
        join_code = (
            code.code
            if classroom.status == "active" and code and (code.expires_at is None or code.expires_at > now)
            else None
        )
        return ClassDetails(
            id=classroom.id,
            class_name=classroom.class_name,
            grade_level=grade.number,
            language=classroom.language,
            description=classroom.description,
            join_code=join_code,
            status=classroom.status,
            created_at=classroom.created_at,
            updated_at=classroom.updated_at,
        )
