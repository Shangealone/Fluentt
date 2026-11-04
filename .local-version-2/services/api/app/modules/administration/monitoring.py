"""Read-only ordinary-classroom monitoring for explicitly granted administrators.

These projections never read research records, private answers, audio, or tutor text.
They do not turn submission counts or model predictions into academic grades.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import aliased

from app.models.ai import ConversationSession, PronunciationActivity, PronunciationAttempt
from app.models.assessments import Assignment, AssignmentAttempt, AssignmentVersion
from app.models.learning import LearningContext, VocabularyReviewEvent, VocabularyReviewState
from app.models.research import SchedulerConfiguration
from app.models.research_classrooms import ResearchClassroomBinding
from app.models.users import ClassJoinCode, ClassMembership, Classroom, User
from app.modules.identity.errors import IdentityError


def ordinary_class():
    return ~exists(select(ResearchClassroomBinding.id).where(ResearchClassroomBinding.class_id == Classroom.id))


def active_owner(owner):
    return and_(owner.role == "instructor", owner.profile_status == "active", owner.archived_at.is_(None))


def active_member(student):
    return and_(student.role == "school_student", student.profile_status == "active", student.archived_at.is_(None))


def current_student(student_id, class_id):
    student = aliased(User)
    membership = aliased(ClassMembership)
    return exists(select(membership.id).join(student, student.id == membership.student_id).where(
        membership.student_id == student_id, membership.class_id == class_id,
        membership.status == "active", membership.ended_at.is_(None), active_member(student)))


def class_scope():
    owner = aliased(User)
    return owner, and_(Classroom.status == "active", Classroom.archived_at.is_(None), ordinary_class(), active_owner(owner))


def count(session, statement):
    return int(session.scalar(statement) or 0)


def as_page(items, limit, offset):
    return {"items": items[:limit], "limit": limit, "offset": offset, "has_more": len(items) > limit}


def active_code():
    return select(ClassJoinCode.code).where(
        ClassJoinCode.class_id == Classroom.id, ClassJoinCode.status == "active",
        ClassJoinCode.revoked_at.is_(None),
        or_(ClassJoinCode.expires_at.is_(None), ClassJoinCode.expires_at > func.now()),
    ).correlate(Classroom).scalar_subquery()


def overview(db):
    owner, scope = class_scope()
    members = (
        select(func.count(ClassMembership.id))
        .join(Classroom, Classroom.id == ClassMembership.class_id)
        .join(owner, owner.id == Classroom.instructor_id)
        .join(User, User.id == ClassMembership.student_id)
        .where(scope, ClassMembership.status == "active", ClassMembership.ended_at.is_(None), active_member(User))
    )
    return {
        "as_of": datetime.now(timezone.utc),
        "scope": "active ordinary classrooms; research and personal learning excluded",
        "students": count(db, select(func.count(User.id)).where(User.role.in_(("school_student", "personal_student")), User.profile_status == "active", User.archived_at.is_(None))),
        "instructors": count(db, select(func.count(User.id)).where(User.role == "instructor", User.profile_status == "active", User.archived_at.is_(None))),
        "classes": count(db, select(func.count(Classroom.id)).join(owner, owner.id == Classroom.instructor_id).where(scope)),
        "enrollments": count(db, members),
        "submitted_captures": submitted_count(db),
        "wavlm_attempts": wavlm_count(db),
        "tutor_sessions": tutor_count(db),
        "personal_progress": None,
        "fsrs_live_metrics": None,
    }


def submitted_scope():
    owner, scope = class_scope()
    return (
        select(AssignmentAttempt.id)
        .join(AssignmentVersion, AssignmentVersion.id == AssignmentAttempt.assignment_version_id)
        .join(Assignment, Assignment.id == AssignmentVersion.assignment_id)
        .join(Classroom, Classroom.id == Assignment.class_id)
        .join(owner, owner.id == Classroom.instructor_id)
        .where(scope, AssignmentVersion.publication_contract == "distribution-only-v1",
               AssignmentAttempt.capture_contract == "unscored-capture-v1",
               AssignmentAttempt.submitted_at.is_not(None), AssignmentAttempt.status.in_(("submitted", "graded")),
               current_student(AssignmentAttempt.student_id, Classroom.id))
    )


def submitted_count(db, student_id=None, class_id=None):
    statement = submitted_scope()
    if student_id is not None:
        statement = statement.where(AssignmentAttempt.student_id == student_id)
    if class_id is not None:
        statement = statement.where(Classroom.id == class_id)
    return count(db, select(func.count()).select_from(statement.subquery()))


def model_scope(model):
    owner, scope = class_scope()
    return (
        select(model)
        .join(LearningContext, LearningContext.id == model.context_id)
        .join(Classroom, Classroom.id == LearningContext.class_id)
        .join(owner, owner.id == Classroom.instructor_id)
        .where(scope, LearningContext.kind == "classroom", model.simulated.is_(False),
               current_student(LearningContext.student_id, Classroom.id))
    )


def wavlm_scope():
    return model_scope(PronunciationAttempt).where(
        PronunciationAttempt.scoring_status == "scored",
        PronunciationAttempt.score.is_not(None),
        PronunciationAttempt.result.has_key("wavlm"),
        PronunciationAttempt.activity_id.in_(select(PronunciationActivity.id).where(
            PronunciationActivity.language == "english")),
    )


def wavlm_count(db, student_id=None, class_id=None):
    statement = wavlm_scope().with_only_columns(PronunciationAttempt.id)
    if student_id is not None:
        statement = statement.where(LearningContext.student_id == student_id)
    if class_id is not None:
        statement = statement.where(Classroom.id == class_id)
    return count(db, select(func.count()).select_from(statement.subquery()))


def tutor_scope():
    return model_scope(ConversationSession).where(ConversationSession.status.in_(("active", "ended")))


def tutor_count(db, student_id=None, class_id=None):
    statement = tutor_scope().with_only_columns(ConversationSession.id)
    if student_id is not None:
        statement = statement.where(LearningContext.student_id == student_id)
    if class_id is not None:
        statement = statement.where(Classroom.id == class_id)
    return count(db, select(func.count()).select_from(statement.subquery()))


def classes(db, search, limit, offset):
    owner, scope = class_scope()
    member_count = (
        select(func.count(ClassMembership.id))
        .join(User, User.id == ClassMembership.student_id)
        .where(ClassMembership.class_id == Classroom.id, ClassMembership.status == "active",
               ClassMembership.ended_at.is_(None), active_member(User))
        .correlate(Classroom).scalar_subquery()
    )
    statement = select(Classroom.id, Classroom.class_name, Classroom.language, Classroom.created_at,
                       active_code().label("join_code"),
                       owner.username.label("instructor"), member_count.label("enrollments"))\
        .join(owner, owner.id == Classroom.instructor_id).where(scope)
    if search:
        term = "%" + search.replace("%", "\\%").replace("_", "\\_") + "%"
        statement = statement.where(or_(Classroom.class_name.ilike(term, escape="\\"),
                                        owner.username.ilike(term, escape="\\"), active_code() == search))
    rows = db.execute(statement.order_by(Classroom.class_name, Classroom.id).offset(offset).limit(limit + 1)).all()
    return as_page([{"id": row.id, "name": row.class_name, "language": row.language,
                     "join_code": row.join_code,
                     "created_at": row.created_at, "instructor": row.instructor,
                     "enrollments": int(row.enrollments)} for row in rows], limit, offset)


def class_detail(db, class_id, limit, offset):
    owner, scope = class_scope()
    row = db.execute(select(Classroom, owner.username, active_code()).join(owner, owner.id == Classroom.instructor_id)
                     .where(scope, Classroom.id == class_id)).one_or_none()
    if row is None:
        raise IdentityError(404, "admin_class_unavailable", "Class unavailable.")
    classroom, instructor, join_code = row
    students = db.execute(
        select(User.id, User.username, ClassMembership.joined_at)
        .join(ClassMembership, ClassMembership.student_id == User.id)
        .where(ClassMembership.class_id == class_id, ClassMembership.status == "active",
               ClassMembership.ended_at.is_(None), active_member(User))
        .order_by(User.username, User.id).offset(offset).limit(limit + 1)
    ).all()
    return {"id": classroom.id, "name": classroom.class_name, "language": classroom.language,
            "join_code": join_code,
            "instructor": instructor, "created_at": classroom.created_at,
            "submitted_captures": submitted_count(db, class_id=class_id),
            "wavlm_attempts": wavlm_count(db, class_id=class_id),
            "tutor_sessions": tutor_count(db, class_id=class_id),
            "students": as_page([{"id": row.id, "username": row.username, "joined_at": row.joined_at}
                                 for row in students], limit, offset)}


def users(db, search, role, limit, offset):
    statement = select(User.id, User.username, User.role, User.profile_status, User.created_at).where(
        User.role.in_(("school_student", "personal_student", "instructor")), User.archived_at.is_(None))
    if role:
        statement = statement.where(User.role == role)
    if search:
        term = "%" + search.replace("%", "\\%").replace("_", "\\_") + "%"
        statement = statement.where(User.username.ilike(term, escape="\\"))
    rows = db.execute(statement.order_by(User.username, User.id).offset(offset).limit(limit + 1)).all()
    return as_page([{"id": row.id, "username": row.username, "role": row.role,
                     "status": row.profile_status, "created_at": row.created_at} for row in rows], limit, offset)


def student_detail(db, student_id):
    student = db.scalar(select(User).where(User.id == student_id, User.role.in_(("school_student", "personal_student")),
                                          User.archived_at.is_(None)))
    if student is None:
        raise IdentityError(404, "admin_student_unavailable", "Student unavailable.")
    owner, scope = class_scope()
    memberships = db.execute(
        select(Classroom.id, Classroom.class_name, owner.username)
        .join(owner, owner.id == Classroom.instructor_id)
        .join(ClassMembership, ClassMembership.class_id == Classroom.id)
        .where(scope, ClassMembership.student_id == student_id, ClassMembership.status == "active",
               ClassMembership.ended_at.is_(None))
        .order_by(Classroom.class_name, Classroom.id).limit(101)
    ).all()
    return {"id": student.id, "username": student.username, "role": student.role,
            "status": student.profile_status,
            "classes": [{"id": row.id, "name": row.class_name, "instructor": row.username} for row in memberships[:100]],
            "classes_truncated": len(memberships) > 100,
            "submitted_captures": submitted_count(db, student_id=student_id),
            "wavlm_attempts": wavlm_count(db, student_id=student_id),
            "tutor_sessions": tutor_count(db, student_id=student_id),
            "personal_tracking": "unavailable"}


def pronunciation(db, limit, offset):
    rows = db.execute(
        wavlm_scope().with_only_columns(PronunciationAttempt.id, PronunciationAttempt.attempted_at,
                                        PronunciationAttempt.score, LearningContext.student_id, Classroom.class_name)
        .order_by(PronunciationAttempt.attempted_at.desc(), PronunciationAttempt.id.desc())
        .offset(offset).limit(limit + 1)
    ).all()
    return {"count": wavlm_count(db), "model_status": "unvalidated_model_prediction",
            "attempts": as_page([{"id": row.id, "attempted_at": row.attempted_at, "score": str(row.score),
                                  "student_id": row.student_id, "class_name": row.class_name}
                                 for row in rows], limit, offset)}


def pronunciation_detail(db, attempt_id):
    row = db.execute(
        wavlm_scope().with_only_columns(PronunciationAttempt, LearningContext.student_id,
                                        Classroom.class_name, PronunciationActivity.target_text)
        .join(PronunciationActivity, PronunciationActivity.id == PronunciationAttempt.activity_id)
        .where(PronunciationAttempt.id == attempt_id)
    ).one_or_none()
    if row is None or not isinstance(row[0].result.get("wavlm"), dict):
        raise IdentityError(404, "admin_pronunciation_unavailable", "Assessment unavailable.")
    attempt, student_id, class_name, target_text = row
    result = attempt.result["wavlm"]
    words = result.get("words")
    return {"id": attempt.id, "attempted_at": attempt.attempted_at,
            "student_id": student_id, "class_name": class_name,
            "reference_text": target_text, "overall_score": result.get("overall_score"),
            "model_id": result.get("model_id"), "model_version": result.get("model_version"),
            "feedback": result.get("feedback"),
            "processing_duration_ms": result.get("processing_duration_ms"),
            "words": [
                {"word": word.get("word"), "score": word.get("score"),
                 "phonemes": [{"phone": phone.get("phone"), "score": phone.get("score"),
                               "error": phone.get("error"), "tip": phone.get("tip")}
                              for phone in word.get("phonemes", []) if isinstance(phone, dict)][:40]}
                for word in words if isinstance(word, dict)
            ][:100] if isinstance(words, list) else [],
            "validation_status": "unvalidated_model_prediction"}


def tutor(db, limit, offset):
    rows = db.execute(
        tutor_scope().with_only_columns(ConversationSession.id, ConversationSession.started_at,
                                        ConversationSession.status, LearningContext.student_id, Classroom.class_name)
        .order_by(ConversationSession.started_at.desc(), ConversationSession.id.desc())
        .offset(offset).limit(limit + 1)
    ).all()
    return {"count": tutor_count(db), "sessions": as_page([
        {"id": row.id, "started_at": row.started_at, "status": row.status,
         "student_id": row.student_id, "class_name": row.class_name} for row in rows
    ], limit, offset), "content_exposed": False}


def learn(db):
    return {"policy": "submission-counts-v1", "submitted_captures": submitted_count(db),
            "meaning": "Finalized ordinary classroom captures, including incomplete or review-required submissions.",
            "personal_tracking": "unavailable", "mastery_or_retention": None}


def scheduler_event_scope(algorithm, simulated):
    owner, scope = class_scope()
    return (
        select(VocabularyReviewEvent.id)
        .join(VocabularyReviewState, VocabularyReviewState.id == VocabularyReviewEvent.review_state_id)
        .join(SchedulerConfiguration, SchedulerConfiguration.id == VocabularyReviewEvent.scheduler_configuration_id)
        .join(LearningContext, LearningContext.id == VocabularyReviewState.context_id)
        .join(Classroom, Classroom.id == LearningContext.class_id)
        .join(owner, owner.id == Classroom.instructor_id)
        .where(scope, LearningContext.kind == "classroom",
               current_student(LearningContext.student_id, Classroom.id),
               SchedulerConfiguration.algorithm == algorithm,
               VocabularyReviewEvent.simulated.is_(simulated))
    )


def fsrs(db):
    events = count(db, select(func.count()).select_from(scheduler_event_scope("fsrs6", False).subquery()))
    return {"algorithm": "fsrs-6-reference-v1",
            "status": "recorded_reviews" if events else "no_recorded_reviews",
            "review_count": events, "prediction_quality": None,
            "reason": "Counts use eligible ordinary-classroom FSRS-6 review events only. Learn submissions are separate; prediction quality has not been validated."}


def fifakt(db):
    traces = count(db, select(func.count()).select_from(scheduler_event_scope("fifakt", True).subquery()))
    return {"algorithm": "fifakt-esr-v1", "status": "simulated_prototype",
            "simulation_trace_count": traces, "real_review_count": None,
            "prediction_quality": None,
            "reason": "The current FIFAKT adapter is simulated and untrained. Stored simulation traces, if any, are not learner-performance results."}


def status(db, settings):
    db.scalar(select(1))
    return {"backend": "connected", "database": "connected",
            "fsrs": "unavailable",
            "wavlm": "configured_not_probed" if settings.pronunciation_wavlm_enabled else "not_configured",
            "groq": "configured_not_probed" if settings.groq_tutor_enabled else "not_configured",
            "note": "Model and provider status do not trigger inference or provider calls."}
