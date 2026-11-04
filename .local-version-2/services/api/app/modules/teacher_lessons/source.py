"""Source adapter: retain common lesson/question identities and honest provenance."""
from sqlalchemy import select, func
from app.models.teacher_lessons import TeacherLesson, TeacherLessonVersion, TeacherLessonShare
from app.models.curriculum import Lesson, GradeLevel, Subject


def active_shares():
    ranked = select(
        TeacherLessonShare,
        func.row_number().over(partition_by=(TeacherLessonShare.teacher_lesson_id, TeacherLessonShare.class_id), order_by=TeacherLessonShare.ordinal.desc()).label("rank"),
    ).subquery()
    return select(ranked).where(ranked.c.rank == 1, ranked.c.active.is_(True)).subquery()


def context_for_version(db, version, leaf=None):
    from app.modules.assignments.schemas import Context
    leaf = leaf or db.get(Lesson, version.lesson_id, populate_existing=True)
    return Context(lesson_id=leaf.id, lesson_name=leaf.name, curriculum_version_id=None, curriculum_name=None,
                   source="teacher", lesson_version=version.version, grade=db.get(GradeLevel, version.grade_level_id).number if version.grade_level_id else None,
                   proficiency_level=version.proficiency_level,
                   subject_id=version.subject_id, subject_name=db.get(Subject, version.subject_id).name)


def teacher_context(db, classroom, lesson_id, current=True):
    statement = select(TeacherLessonVersion).join(TeacherLesson).where(
        TeacherLessonVersion.lesson_id == lesson_id, TeacherLesson.instructor_id == classroom.instructor_id,
        TeacherLessonVersion.published_at.is_not(None))
    if current:
        shares = active_shares()
        statement = statement.join(shares, shares.c.version_id == TeacherLessonVersion.id).where(
            shares.c.class_id == classroom.id, TeacherLesson.archived_at.is_(None),
            TeacherLessonVersion.language == classroom.language)
        if classroom.subject_id is not None:
            statement = statement.where(TeacherLessonVersion.subject_id == classroom.subject_id)
    version = db.scalar(statement.execution_options(populate_existing=True))
    return context_for_version(db, version) if version else None


def lesson_catalog(db, classroom, query):
    """Union source IDs before paging, so pages never duplicate/skip either source."""
    from app.modules.curriculum.repository import path_statement, visible
    from app.models.curriculum import CurriculumSubject, CurriculumVersion
    from sqlalchemy import literal, union_all
    official = path_statement(5).with_only_columns(Lesson.id.label("id"), CurriculumVersion.created_at.label("created_at"), literal("curriculum").label("source")).where(
        *visible(5))
    shares = active_shares()
    teacher = select(Lesson.id.label("id"), Lesson.created_at.label("created_at"), literal("teacher").label("source")).join(
        TeacherLessonVersion, TeacherLessonVersion.lesson_id == Lesson.id).join(TeacherLesson).join(shares, shares.c.version_id == TeacherLessonVersion.id).where(
        shares.c.class_id == classroom.id, TeacherLesson.instructor_id == classroom.instructor_id,
        TeacherLesson.archived_at.is_(None), TeacherLessonVersion.published_at.is_not(None),
        TeacherLessonVersion.language == classroom.language)
    if classroom.subject_id:
        official = official.where(CurriculumSubject.subject_id == classroom.subject_id)
        teacher = teacher.where(TeacherLessonVersion.subject_id == classroom.subject_id)
    if query.q:
        official = official.where(Lesson.name.icontains(query.q, autoescape=True))
        teacher = teacher.where(Lesson.name.icontains(query.q, autoescape=True))
    catalog = union_all(official, teacher).subquery()
    return db.execute(select(catalog).order_by(catalog.c.created_at.desc(), catalog.c.id).offset(query.offset).limit(query.limit + 1)).all()
