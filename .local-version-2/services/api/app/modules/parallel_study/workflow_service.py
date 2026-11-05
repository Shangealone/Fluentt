"""Shared authorization/transaction boundary for test-only Track 1 execution."""
from sqlalchemy import select
from app.models.parallel_study import ParallelProtocol, ParallelAssessment, ParallelOpportunity, ParallelAllocation
from app.models.parallel_workflow import TestWorkflow
from app.models.research import ResearchIdentityLink, ResearchParticipant
from app.models.users import User, Classroom, ClassMembership
from app.modules.identity.session_service import authenticated_session
from app.modules.identity.errors import IdentityError
from app.modules.administration.service import resolve_session
from . import service, workflow_engine as engine


def admin(repo, token, settings, *, action, protocol_id, payload=None, csrf=None):
    def operation(actor):
        db = repo.session
        engine.isolated(db, settings)
        hint = db.get(ParallelProtocol, protocol_id)
        if not hint:
            raise service.fail("Study unavailable", 404)
        service.class_access(repo, actor, hint.class_id, action != "monitor")
        protocol = db.scalar(select(ParallelProtocol).where(ParallelProtocol.id == protocol_id).with_for_update()
                             .execution_options(populate_existing=True))
        if action == "configure":
            return engine.configure(db, protocol, payload, actor.id)
        if action == "enroll":
            return engine.enroll(db, protocol, payload, actor.id)
        return monitor(db, protocol, actor)
    return resolve_session(repo, token, csrf=csrf, required_permission="research.read" if action == "monitor" else "research.manage",
              additional_permissions=() if action == "monitor" else ("research.read",),
              **({"read_operation": operation} if action == "monitor" else {"mutation_operation": operation}))


def class_context(db, user, protocol, *, withdrawal=False):
    if withdrawal:
        return
    owner_id = db.scalar(select(Classroom.instructor_id).where(Classroom.id == protocol.class_id))
    owner = db.scalar(select(User).where(User.id == owner_id).with_for_update(read=True)
                      .execution_options(populate_existing=True))
    classroom = db.scalar(select(Classroom).where(Classroom.id == protocol.class_id).with_for_update(read=True)
                          .execution_options(populate_existing=True))
    if not owner or owner.role != "instructor" or owner.profile_status != "active" or owner.archived_at:
        raise service.fail("Active study class owner required", 403)
    if not classroom or classroom.status != "active" or classroom.archived_at or classroom.instructor_id != owner.id:
        raise service.fail("Active study class required", 403)
    if user.role == "instructor":
        if owner.id != user.id:
            raise service.fail("Only the owning instructor may access this study class", 403)
    elif user.role == "school_student":
        member = db.scalar(select(ClassMembership).where(ClassMembership.student_id == user.id,
                           ClassMembership.class_id == protocol.class_id, ClassMembership.status == "active",
                           ClassMembership.ended_at.is_(None)).with_for_update(read=True))
        if not member:
            raise service.fail("Current study class membership required", 403)
    else:
        raise service.fail("Personal Learning is not a parallel-study context", 403)


def mobile(repo, token, settings, *, action, protocol_id=None, target_id=None, kind=None, payload=None):
    with authenticated_session(repo, token, settings) as (_, user):
        db = repo.session
        engine.isolated(db, settings)
        if user.role not in {"school_student", "instructor"} or user.profile_status != "active":
            raise service.fail("Active school account required", 403)
        if action == "instructor_studies":
            if user.role != "instructor":
                raise service.fail("Owning instructor required", 403)
            rows = db.scalars(select(ParallelProtocol).join(TestWorkflow,
                   TestWorkflow.protocol_id == ParallelProtocol.id).join(Classroom,
                   Classroom.id == ParallelProtocol.class_id).where(Classroom.instructor_id == user.id,
                   Classroom.status == "active", Classroom.archived_at.is_(None)).limit(30))
            return dict(items=[dict(id=str(row.id), title=row.configuration["title"], status="development_only") for row in rows],
                        development_only=True)
        if action == "studies":
            rows = db.execute(select(ParallelProtocol, ResearchParticipant).join(TestWorkflow,
                    TestWorkflow.protocol_id == ParallelProtocol.id).join(ResearchIdentityLink,
                    ResearchIdentityLink.study_id == ParallelProtocol.study_id).join(ResearchParticipant,
                    ResearchParticipant.id == ResearchIdentityLink.participant_id).where(
                    ResearchIdentityLink.user_id == user.id).order_by(ParallelProtocol.created_at).limit(30)).all()
            result = []
            for protocol, p in rows:
                # Withdrawal status remains discoverable without exposing protected task data.
                if p.enrollment_status != "withdrawn":
                    class_context(db, user, protocol)
                result.append(dict(id=str(protocol.id), title=protocol.configuration["title"], status=p.enrollment_status))
            return dict(items=result, development_only=True)
        hint = db.get(ParallelProtocol, protocol_id)
        if not hint:
            raise service.fail("Study unavailable", 404)
        if action in {"publish", "monitor"} and user.role != "instructor":
            raise service.fail("Owning instructor required", 403)
        if action not in {"publish", "monitor"} and user.role != "school_student":
            raise service.fail("Own student participation required", 403)
        class_context(db, user, hint, withdrawal=action == "withdraw")
        protocol = db.scalar(select(ParallelProtocol).where(ParallelProtocol.id == protocol_id).with_for_update()
                             .execution_options(populate_existing=True))
        if action == "withdraw":
            return engine.withdraw(db, protocol, user)
        if action == "publish":
            return engine.publish(db, protocol, user.id)
        if action == "monitor":
            return monitor(db, protocol, user)
        if action == "directory":
            return engine.directory(db, protocol, user)
        if action == "start":
            return engine.start(db, protocol, user, kind, target_id)
        return engine.operate_attempt(db, protocol, user, target_id, action, payload)


def monitor(db, protocol, actor):
    config = engine.workflow(db, protocol)
    tasks = [*db.scalars(select(ParallelAssessment).where(ParallelAssessment.protocol_id == protocol.id)),
             *db.scalars(select(ParallelOpportunity).where(ParallelOpportunity.protocol_id == protocol.id))]
    rows = db.execute(select(ResearchParticipant, ParallelAllocation).join(ParallelAllocation,
               ParallelAllocation.participant_id == ResearchParticipant.id).where(ParallelAllocation.protocol_id == protocol.id)
               .order_by(ParallelAllocation.slot).limit(30)).all()
    participants = []
    for p, allocation in rows:
        # Current class eligibility is rechecked for monitoring, without exposing responses/keys.
        link = db.scalar(select(ResearchIdentityLink).where(ResearchIdentityLink.participant_id == p.id))
        user = db.scalar(select(User).where(User.id == link.user_id).with_for_update(read=True, nowait=True)) if link else None
        member = db.scalar(select(ClassMembership.id).where(ClassMembership.student_id == user.id,
                   ClassMembership.class_id == protocol.class_id, ClassMembership.status == "active",
                   ClassMembership.ended_at.is_(None))) if user else None
        if not user or user.profile_status != "active" or user.archived_at or not member:
            continue
        allowed = p.enrollment_status == "enrolled" and p.eligibility_status == "eligible"
        if allowed:
            try:
                service.allocate(db, protocol, p.id, protocol.actor_id)
            except IdentityError:
                allowed = False
        statuses = [] if not allowed else [dict(id=str(t.id),
                  title=t.kind if isinstance(t, ParallelAssessment) else t.local_date.isoformat(),
                  status=engine.status_for(db, protocol, allocation, config, t, p, actor.id)) for t in tasks]
        participants.append(dict(participant_code=p.participant_code, status=p.enrollment_status, tasks=statuses))
    return dict(development_only=True, configuration_status="configured_synthetic_only",
                participants=participants, fsrs_path="development_control_only", fifakt_path="blocked_unvalidated",
                counts=service.view(db, protocol)["assigned_counts"])
