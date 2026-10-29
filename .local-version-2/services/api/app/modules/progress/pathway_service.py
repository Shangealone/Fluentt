"""Authorized personal learning pathway execution.
Deterministic curriculum-driven progression respecting published versions, prerequisites,
enrolled classroom assignments, and strict separation from predictive/SM-2 schedulers.
"""

from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import select, and_, exists, func
from app.models.users import Classroom, ClassMembership
from app.models.curriculum import (
    CurriculumVersion,
    CurriculumGrade,
    GradeLevel,
    CurriculumSubject,
    Subject,
    Quarter,
    CurriculumTopic,
    Lesson,
)
from app.models.assessments import Assignment, AssignmentVersion, AssignmentAttempt
from app.modules.progress.service import authorized, base, unavailable
from app.modules.progress.pathway_schemas import (
    Pathway,
    CurrentPosition,
    EligibleActivity,
    CurrentMilestone,
    Recommendation,
    PrerequisiteStatus,
)


def compute_pathway(repo, token, settings, *, class_id: UUID | None = None) -> Pathway:
    with authorized(repo, token, settings, class_id=class_id) as (db, user, eligible_class_ids):
        now = datetime.now(timezone.utc)
        role = user.role

        if role == "personal_student":
            return _personal_pathway(db, user, now)

        return _classroom_pathway(db, user, eligible_class_ids, class_id, now)


def _personal_pathway(db, user, now: datetime) -> Pathway:
    # Personal student: based on language and learning_focus or grade
    grade = user.grade
    language = user.language

    # Look for active published curriculum version
    version = db.scalar(
        select(CurriculumVersion)
        .where(CurriculumVersion.status == "published", CurriculumVersion.archived_at.is_(None))
        .order_by(CurriculumVersion.created_at.desc())
    )

    if not version:
        return Pathway(
            availability="empty",
            as_of=now,
            student_role="personal_student",
            current_position=None,
            eligible_activities=[],
            completed_milestones=[],
            recommendations=[],
        )

    # Find curriculum grade matching student grade (default to first available if none)
    grade_stmt = (
        select(CurriculumGrade, GradeLevel)
        .join(GradeLevel, GradeLevel.id == CurriculumGrade.grade_level_id)
        .where(CurriculumGrade.curriculum_version_id == version.id)
    )
    if grade is not None:
        grade_stmt = grade_stmt.where(GradeLevel.number == grade)
    grade_stmt = grade_stmt.order_by(GradeLevel.number)
    grade_row = db.execute(grade_stmt).first()

    if not grade_row:
        return Pathway(
            availability="empty",
            as_of=now,
            student_role="personal_student",
            current_position=None,
            eligible_activities=[],
            completed_milestones=[],
            recommendations=[],
        )

    curr_grade, grade_level = grade_row

    # Find first subject in this grade
    subj_row = db.execute(
        select(CurriculumSubject, Subject)
        .join(Subject, Subject.id == CurriculumSubject.subject_id)
        .where(CurriculumSubject.curriculum_grade_id == curr_grade.id)
        .order_by(Subject.code)
    ).first()

    if not subj_row:
        return Pathway(
            availability="empty",
            as_of=now,
            student_role="personal_student",
            current_position=None,
            eligible_activities=[],
            completed_milestones=[],
            recommendations=[],
        )

    curr_subj, subject = subj_row

    # Find first quarter
    quarter = db.scalar(
        select(Quarter)
        .where(Quarter.curriculum_subject_id == curr_subj.id)
        .order_by(Quarter.number)
    )

    if not quarter:
        return Pathway(
            availability="empty",
            as_of=now,
            student_role="personal_student",
            current_position=None,
            eligible_activities=[],
            completed_milestones=[],
            recommendations=[],
        )

    # Find published topics in this quarter
    topics = list(
        db.scalars(
            select(CurriculumTopic)
            .where(
                CurriculumTopic.quarter_id == quarter.id,
                CurriculumTopic.status == "published",
            )
            .order_by(CurriculumTopic.position)
        )
    )

    if not topics:
        return Pathway(
            availability="empty",
            as_of=now,
            student_role="personal_student",
            current_position=None,
            eligible_activities=[],
            completed_milestones=[],
            recommendations=[],
        )

    first_topic = topics[0]

    # Find published lessons in first topic
    lessons = list(
        db.scalars(
            select(Lesson)
            .where(
                Lesson.topic_id == first_topic.id,
                Lesson.status == "published",
                Lesson.archived_at.is_(None),
            )
            .order_by(Lesson.position)
        )
    )

    if not lessons:
        return Pathway(
            availability="empty",
            as_of=now,
            student_role="personal_student",
            current_position=None,
            eligible_activities=[],
            completed_milestones=[],
            recommendations=[],
        )

    first_lesson = lessons[0]

    current_pos = CurrentPosition(
        curriculum_version_id=version.id,
        curriculum_version_name=version.name,
        grade_number=grade_level.number,
        subject_id=subject.id,
        subject_name=subject.name,
        topic_id=first_topic.id,
        topic_name=first_topic.name,
        lesson_id=first_lesson.id,
        lesson_name=first_lesson.name,
        position_index=first_lesson.position,
        total_lessons_in_topic=len(lessons),
    )

    # In personal pathway with no submissions, first lesson is available (0 prerequisites met / 0 required)
    # Subsequent lessons in the topic have prerequisites = prior position count
    eligible_activities = []
    for i, lsn in enumerate(lessons):
        prereqs_met = i == 0  # First is available, others sequential
        status = "available" if i == 0 else "locked"
        eligible_activities.append(
            EligibleActivity(
                activity_type="lesson",
                id=lsn.id,
                title=lsn.name,
                topic_name=first_topic.name,
                position=lsn.position,
                prerequisites=PrerequisiteStatus(
                    total_required=i,
                    fulfilled=1 if i == 0 else 0,
                    all_met=prereqs_met,
                ),
                is_required=False,
                status=status,
                class_id=None,
                lesson_id=lsn.id,
            )
        )

    recommendations = [
        Recommendation(
            id=f"rec-lesson-{first_lesson.id}",
            recommendation_type="next_lesson",
            title=f"Start lesson: {first_lesson.name}",
            reason="This is the first lesson in your curriculum pathway.",
            target_id=first_lesson.id,
            is_required=False,
            class_id=None,
        ),
        Recommendation(
            id=f"rec-flashcard-{first_lesson.id}",
            recommendation_type="self_study_practice",
            title=f"Self-study cards: {first_lesson.name}",
            reason="Practice foundational terms for this lesson.",
            target_id=first_lesson.id,
            is_required=False,
            class_id=None,
        ),
    ]

    return Pathway(
        availability="available",
        as_of=now,
        student_role="personal_student",
        class_id=None,
        class_name=None,
        current_position=current_pos,
        eligible_activities=eligible_activities,
        completed_milestones=[],
        recommendations=recommendations,
    )


def _classroom_pathway(db, user, eligible_class_ids: list[UUID], target_class_id: UUID | None, now: datetime) -> Pathway:
    if not eligible_class_ids:
        return Pathway(
            availability="empty",
            as_of=now,
            student_role="school_student",
            current_position=None,
            eligible_activities=[],
            completed_milestones=[],
            recommendations=[],
        )

    active_class_id = target_class_id or eligible_class_ids[0]
    classroom = db.scalar(select(Classroom).where(Classroom.id == active_class_id))
    if not classroom:
        raise unavailable()

    # Get available published assignments & attempts for this student in eligible class(es)
    assignment_rows = base(db, user, [active_class_id])
    assignments_data = db.execute(select(assignment_rows).order_by(assignment_rows.c.sort_at.asc())).mappings().all()

    # Completed milestones: assignments that have been submitted
    completed_milestones = []
    submitted_assignment_ids = set()
    for row in assignments_data:
        if row["submission_status"] == "submitted" and row["submitted_at"]:
            submitted_assignment_ids.add(row["id"])
            context_data = row["curriculum_snapshot"].get("context", {}) if row["curriculum_snapshot"] else {}
            completed_milestones.append(
                CurrentMilestone(
                    kind="assignment",
                    id=row["id"],
                    title=row["title"],
                    completed_at=row["submitted_at"],
                    class_id=row["class_id"],
                    topic_name=context_data.get("topic_name") or context_data.get("curriculum_name"),
                )
            )

    # Next activities: classroom published assignments ordered sequentially
    eligible_activities = []
    recommendations = []
    current_pos = None

    for i, row in enumerate(assignments_data):
        is_submitted = row["id"] in submitted_assignment_ids
        is_in_progress = row["submission_status"] == "in_progress"

        # Prerequisites: prior assignments in this class
        total_prereqs = i
        fulfilled_prereqs = sum(1 for prev in assignments_data[:i] if prev["id"] in submitted_assignment_ids)
        all_met = (total_prereqs == fulfilled_prereqs)

        if is_submitted:
            status = "completed"
        elif not all_met:
            status = "locked"
        elif is_in_progress:
            status = "in_progress"
        else:
            status = "available"

        context_data = row["curriculum_snapshot"].get("context", {}) if row["curriculum_snapshot"] else {}
        topic_name = context_data.get("topic_name") or context_data.get("curriculum_name")

        eligible_activities.append(
            EligibleActivity(
                activity_type="assignment",
                id=row["id"],
                title=row["title"],
                topic_name=topic_name,
                position=i + 1,
                prerequisites=PrerequisiteStatus(
                    total_required=total_prereqs,
                    fulfilled=fulfilled_prereqs,
                    all_met=all_met,
                ),
                is_required=True,
                status=status,
                class_id=row["class_id"],
                lesson_id=UUID(context_data["lesson_id"]) if context_data.get("lesson_id") else None,
            )
        )

        # First incomplete or in-progress assignment defines current position and recommendation
        if current_pos is None and status in ("available", "in_progress"):
            current_pos = CurrentPosition(
                curriculum_version_id=UUID(context_data["curriculum_version_id"]) if context_data.get("curriculum_version_id") else None,
                curriculum_version_name=context_data.get("curriculum_name"),
                grade_number=context_data.get("grade"),
                subject_id=UUID(context_data["subject_id"]) if context_data.get("subject_id") else None,
                subject_name=context_data.get("subject_name"),
                topic_id=None,
                topic_name=topic_name,
                lesson_id=UUID(context_data["lesson_id"]) if context_data.get("lesson_id") else None,
                lesson_name=context_data.get("lesson_name"),
                position_index=i + 1,
                total_lessons_in_topic=len(assignments_data),
            )
            recommendations.append(
                Recommendation(
                    id=f"rec-assign-{row['id']}",
                    recommendation_type="classroom_assignment",
                    title=f"Continue assignment: {row['title']}" if is_in_progress else f"Start assignment: {row['title']}",
                    reason="Required classroom assignment ready for your attention.",
                    target_id=row["id"],
                    is_required=True,
                    class_id=row["class_id"],
                )
            )

    # If all assignments completed or no assignments
    if not eligible_activities:
        # Check published curriculum for class grade/subject if available
        return Pathway(
            availability="empty",
            as_of=now,
            student_role="school_student",
            class_id=classroom.id,
            class_name=classroom.class_name,
            current_position=None,
            eligible_activities=[],
            completed_milestones=[],
            recommendations=[],
        )

    return Pathway(
        availability="available",
        as_of=now,
        student_role="school_student",
        class_id=classroom.id,
        class_name=classroom.class_name,
        current_position=current_pos,
        eligible_activities=eligible_activities,
        completed_milestones=completed_milestones,
        recommendations=recommendations,
    )
