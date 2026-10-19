from sqlalchemy import exists, false, select, text

from app.models.curriculum import (
    CurriculumVersion,
    CurriculumGrade,
    GradeLevel,
    CurriculumSubject,
    Subject,
    Quarter,
    CurriculumTopic,
    Lesson,
    LearningCompetency,
)
from app.models.users import Classroom, ClassMembership, User
from app.modules.curriculum.schemas import (
    ClassContext,
    VersionView,
    GradeView,
    SubjectView,
    QuarterView,
    TopicView,
    LessonView,
    CompetencyView,
)
from app.modules.identity.errors import IdentityError
from app.modules.identity.repository import IdentityRepository

MODELS = [CurriculumVersion, CurriculumGrade, CurriculumSubject, Quarter, CurriculumTopic, Lesson, LearningCompetency]
KINDS = ["versions", "grades", "subjects", "quarters", "topics", "lessons", "competencies"]
VIEWS = [VersionView, GradeView, SubjectView, QuarterView, TopicView, LessonView, CompetencyView]
PARENTS = [
    None,
    "curriculum_version_id",
    "curriculum_grade_id",
    "curriculum_subject_id",
    "quarter_id",
    "topic_id",
    "lesson_id",
]


def unavailable():
    return IdentityError(404, "curriculum_unavailable", "Curriculum structure is unavailable.")


def path_statement(depth):
    models = MODELS[: depth + 1]
    statement = select(*models).select_from(CurriculumVersion)
    for index in range(1, depth + 1):
        statement = statement.join(models[index], getattr(models[index], PARENTS[index]) == models[index - 1].id)
    if depth >= 1:
        statement = statement.add_columns(GradeLevel).join(GradeLevel, GradeLevel.id == CurriculumGrade.grade_level_id)
    if depth >= 2:
        statement = statement.add_columns(Subject).join(Subject, Subject.id == CurriculumSubject.subject_id)
    return statement


def visible(depth):
    conditions = [CurriculumVersion.status == "published", CurriculumVersion.archived_at.is_(None)]
    if depth >= 4:
        conditions.append(CurriculumTopic.status == "published")
    if depth >= 5:
        conditions.extend([Lesson.status == "published", Lesson.archived_at.is_(None)])
    return conditions


def filters(depth, query, context):
    conditions = []
    if context and context.requires_subject:
        return [false()]
    subject_ids = [value for value in [query.subject_id, context.subject_id if context else None] if value]
    if depth == 0:
        if query.grade is not None or context or subject_ids:
            branch = (
                select(CurriculumGrade.id)
                .join(GradeLevel, GradeLevel.id == CurriculumGrade.grade_level_id)
                .where(CurriculumGrade.curriculum_version_id == CurriculumVersion.id)
            )
            if query.grade is not None:
                branch = branch.where(GradeLevel.number == query.grade)
            if context:
                branch = branch.where(CurriculumGrade.grade_level_id == context.grade_level_id)
            if subject_ids:
                branch = branch.join(CurriculumSubject, CurriculumSubject.curriculum_grade_id == CurriculumGrade.id)
                for subject_id in subject_ids:
                    branch = branch.where(CurriculumSubject.subject_id == subject_id)
            conditions.append(exists(branch))
    else:
        if query.grade is not None:
            conditions.append(GradeLevel.number == query.grade)
        if context:
            conditions.append(CurriculumGrade.grade_level_id == context.grade_level_id)
        if depth == 1 and subject_ids:
            branch = select(CurriculumSubject.id).where(CurriculumSubject.curriculum_grade_id == CurriculumGrade.id)
            for subject_id in subject_ids:
                branch = branch.where(CurriculumSubject.subject_id == subject_id)
            conditions.append(exists(branch))
        elif depth >= 2:
            conditions.extend(CurriculumSubject.subject_id == value for value in subject_ids)
    return conditions


def project(kind, row):
    depth = KINDS.index(kind)
    model = row._mapping[MODELS[depth]]
    values = {field: getattr(model, field) for field in VIEWS[depth].model_fields if hasattr(model, field)}
    if depth == 1:
        grade = row._mapping[GradeLevel]
        values.update(number=grade.number, name=grade.name)
    if depth == 2:
        subject = row._mapping[Subject]
        values.update(code=subject.code, name=subject.name, description=subject.description)
    return VIEWS[depth](**values)


class CurriculumRepository(IdentityRepository):
    def structure_read_lock(self):
        # Paired with additive migration 0004 guards. Materialize every response before commit.
        self.session.execute(text("SELECT pg_advisory_xact_lock_shared(78090001)"))

    def class_context(self, user, class_id):
        if user.role not in {"school_student", "instructor"}:
            raise unavailable()
        owner_id = self.session.scalar(select(Classroom.instructor_id).where(Classroom.id == class_id))
        if owner_id is None or (user.role == "instructor" and owner_id != user.id):
            raise unavailable()
        owner = self.session.scalar(
            select(User).where(User.id == owner_id).with_for_update(read=True).execution_options(populate_existing=True)
        )
        classroom = self.session.scalar(
            select(Classroom)
            .where(Classroom.id == class_id)
            .with_for_update(read=True)
            .execution_options(populate_existing=True)
        )
        if (
            classroom is None
            or classroom.instructor_id != owner_id
            or classroom.status != "active"
            or classroom.archived_at is not None
            or owner is None
            or owner.role != "instructor"
            or owner.profile_status not in {"onboarding", "active"}
            or owner.archived_at is not None
        ):
            raise unavailable()
        if user.role == "school_student":
            membership = self.session.scalar(
                select(ClassMembership.id)
                .where(
                    ClassMembership.class_id == class_id,
                    ClassMembership.student_id == user.id,
                    ClassMembership.status == "active",
                    ClassMembership.ended_at.is_(None),
                )
                .with_for_update(read=True)
            )
            if membership is None:
                raise unavailable()
        return ClassContext(
            class_id=class_id,
            grade_level_id=classroom.grade_level_id,
            subject_id=classroom.subject_id,
            language=classroom.language,
            requires_subject=classroom.subject_id is None,
        )

    def statement(self, depth, query, context, admin):
        statement = path_statement(depth).where(*filters(depth, query, context))
        if not admin:
            statement = statement.where(*visible(depth))
        if query.status is not None:
            target = MODELS[depth] if depth in {0, 4, 5} else CurriculumVersion
            statement = statement.where(target.status == query.status)
        return statement.execution_options(populate_existing=True)

    def detail(self, kind, node_id, query, context, admin):
        depth = KINDS.index(kind)
        row = self.session.execute(
            self.statement(depth, query, context, admin).where(MODELS[depth].id == node_id)
        ).first()
        if row is None:
            raise unavailable()
        return project(kind, row)

    def rows(self, kind, parent_id, query, context, admin):
        depth = KINDS.index(kind)
        if depth:
            # A lifecycle filter selects returned children, not their parent node's status.
            self.detail(KINDS[depth - 1], parent_id, query.model_copy(update={"status": None}), context, admin)
        statement = self.statement(depth, query, context, admin)
        if depth:
            statement = statement.where(getattr(MODELS[depth], PARENTS[depth]) == parent_id)
        order = (
            [CurriculumVersion.created_at.desc()]
            if depth == 0
            else [
                GradeLevel.number
                if depth == 1
                else Subject.code
                if depth == 2
                else Quarter.number
                if depth == 3
                else MODELS[depth].position
            ]
        )
        statement = statement.order_by(*order, MODELS[depth].id).limit(query.limit + 1).offset(query.offset)
        rows = self.session.execute(statement).all()
        return [project(kind, row) for row in rows[: query.limit]], len(rows) > query.limit
