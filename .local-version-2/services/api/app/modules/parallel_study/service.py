"""Inactive preparation under existing admin/session boundaries; no live writer."""
from datetime import datetime, timedelta, timezone
import secrets
from uuid import uuid4

from sqlalchemy import select, func

from app.models.parallel_study import ParallelProtocol, ParallelAllocation, ParallelClearance, ParallelOpportunity, ParallelAssessment
from app.models.research import ResearchStudy, ResearchParticipant, ResearchIdentityLink, ResearchConsentRecord
from app.models.users import User, Classroom, ClassMembership
from app.models.vocabulary_review import VocabularyPack
from app.models.operations import AuditLog
from app.modules.administration.service import resolve_session
from app.modules.identity.errors import IdentityError
from app.modules.vocabulary_review.service import digest
from .policy import CONTRACT, METHOD, allocation_sequence, windows, month_end


def fail(message, status=409):
    return IdentityError(status, "parallel_unavailable", message)


def now():
    return datetime.now(timezone.utc)


def class_access(repo, actor, class_id, write=False):
    access = "manage" if write else "read"
    if f"research.classroom.{class_id}.{access}" not in repo.permissions(actor.id):
        raise fail("Explicit research access to this class is required", 403)
    hint = repo.session.get(Classroom, class_id)
    if not hint:
        raise fail("Class unavailable", 404)
    owner = repo.session.scalar(select(User).where(User.id == hint.instructor_id).with_for_update(read=True)
                               .execution_options(populate_existing=True))
    row = repo.session.scalar(select(Classroom).where(Classroom.id == class_id).with_for_update(read=True)
                             .execution_options(populate_existing=True))
    if (not owner or owner.role != "instructor" or owner.profile_status != "active" or owner.archived_at
            or not row or row.status != "active" or row.archived_at or row.instructor_id != owner.id):
        raise fail("Active owned class required", 403)
    return row


def view(db, protocol):
    counts = dict(db.execute(select(ParallelAllocation.condition, func.count())
                  .where(ParallelAllocation.protocol_id == protocol.id).group_by(ParallelAllocation.condition)).all())
    eligible = db.scalar(select(func.count()).select_from(ResearchParticipant).where(
        ResearchParticipant.study_id == protocol.study_id, ResearchParticipant.eligibility_status == "eligible"))
    enrolled = db.scalar(select(func.count()).select_from(ResearchParticipant).where(
        ResearchParticipant.study_id == protocol.study_id, ResearchParticipant.enrollment_status == "enrolled"))
    dates = list(db.scalars(select(ParallelOpportunity.local_date).where(ParallelOpportunity.protocol_id == protocol.id)
                           .order_by(ParallelOpportunity.local_date).limit(31)))
    return dict(id=str(protocol.id), study_id=str(protocol.study_id), class_id=str(protocol.class_id),
                experiment_type=CONTRACT, status="inactive", assigned_counts=counts,
                eligible_count=eligible, enrolled_count=enrolled,
                prepared_local_dates=[day.isoformat() for day in dates],
                activity_progress=None, assessment_completion=None,
                configuration=protocol.configuration,
                blockers=["parallel_participation_workflow_unavailable", "approved_assessment_policy_unavailable",
                          "validated_fifakt_unavailable"], live_scheduling_enabled=False)


def admin(repo, token, *, action, target=None, payload=None, key=None, csrf=None):
    def operation(actor):
        db = repo.session
        if action == "create":
            classroom = class_access(repo, actor, payload.class_id, True)
            fingerprint = digest(payload.model_dump(mode="json"))
            old = db.scalar(select(ParallelProtocol).where(ParallelProtocol.actor_id == actor.id, ParallelProtocol.request_id == key))
            if old:
                if old.fingerprint != fingerprint:
                    raise fail("Retry identity belongs to other details")
                return view(db, old)
            pack = db.scalar(select(VocabularyPack).where(VocabularyPack.id == payload.pack_id).with_for_update(read=True))
            if not pack or not pack.published_at or pack.language != classroom.language:
                raise fail("A published, language-matching vocabulary pool is required", 422)
            study = ResearchStudy(code="parallel-"+uuid4().hex, title=payload.title.strip(), target_language=pack.language,
                                  protocol_version=payload.protocol_version, status="draft", target_participants=30,
                                  conditions={"research_contract": CONTRACT})
            db.add(study)
            db.flush()
            configuration = payload.model_dump(mode="json") | dict(experiment_type=CONTRACT, target_per_arm=15,
                month_end_rule="clamp-next-month-exclusive-v1", end_date=month_end(payload.start_date).isoformat(),
                expected_minutes=[5, 10], weekdays=[0, 1, 2, 3, 4],
                control_scheduler="fsrs-6-reference-v1", proposed_hybrid_policy="fsrs6-interval-fusion-v1",
                model_status="validated_provider_unavailable", operational=False,
                delayed_date=(payload.posttest_date+timedelta(days=7)).isoformat(), pack_fingerprint=pack.fingerprint)
            row = ParallelProtocol(study_id=study.id, class_id=classroom.id, pack_id=pack.id, actor_id=actor.id,
                                   request_id=key, fingerprint=fingerprint, configuration=configuration, seed=secrets.token_bytes(32))
            db.add(row)
            db.flush()
            for day, opens, closes in windows(payload.start_date, payload.timezone):
                db.add(ParallelOpportunity(protocol_id=row.id, local_date=day, opens_at=opens, closes_at=closes))
            for kind, date in (("pretest", None), ("posttest", payload.posttest_date),
                               ("delayed", payload.posttest_date+timedelta(days=7))):
                db.add(ParallelAssessment(protocol_id=row.id, kind=kind, designated_date=date))
            db.add(AuditLog(actor_id=actor.id, action="parallel.draft_created", entity_type="parallel_protocol",
                            entity_id=row.id, occurred_at=now(), safe_metadata={"contract": CONTRACT}))
            db.flush()
            return view(db, row)
        hint = db.get(ParallelProtocol, target)
        if not hint:
            raise fail("Study unavailable", 404)
        class_access(repo, actor, hint.class_id, action == "allocate")
        row = db.scalar(select(ParallelProtocol).where(ParallelProtocol.id == target).with_for_update()
                        .execution_options(populate_existing=True))
        if action == "read":
            return view(db, row)
        return allocate(db, row, payload.participant_id, actor.id)
    return resolve_session(repo, token, csrf=csrf, required_permission="research.read" if action == "read" else "research.manage",
                           additional_permissions=() if action == "read" else ("research.read",),
                           **({"read_operation": operation} if action == "read" else {"mutation_operation": operation}))


def allocate(db, protocol, participant_id, actor_id):
    """Protocol lock must precede this call. Clearance has no HTTP writer."""
    clearance = db.scalar(select(ParallelClearance).where(ParallelClearance.protocol_id == protocol.id)
                          .order_by(ParallelClearance.sequence.desc()).limit(1).with_for_update(read=True))
    if (not clearance or clearance.status != "verified" or not clearance.evidence_reference.strip()
            or clearance.configuration_sha256 != digest(protocol.configuration)):
        raise fail("Verified external protocol/consent-operation clearance is required")
    if clearance.evidence_reference.startswith("SYNTHETIC"):
        # A copied test clearance must never authorize even preparatory real allocation.
        from .workflow_engine import assert_disposable_database
        assert_disposable_database(db)
    p = db.scalar(select(ResearchParticipant).where(ResearchParticipant.id == participant_id,
                  ResearchParticipant.study_id == protocol.study_id).with_for_update().execution_options(populate_existing=True))
    if not p or p.enrollment_status != "enrolled" or p.eligibility_status != "eligible":
        raise fail("Current eligible, consented research enrollment required", 403)
    link = db.scalar(select(ResearchIdentityLink).where(ResearchIdentityLink.participant_id == p.id,
                                                       ResearchIdentityLink.study_id == protocol.study_id))
    if not link:
        raise fail("Authorized coded identity required", 403)
    # Do not wait for a student while holding owner/protocol locks.
    user = db.scalar(select(User).where(User.id == link.user_id).with_for_update(read=True, nowait=True)
                     .execution_options(populate_existing=True))
    if not user or user.role != "school_student" or user.profile_status != "active" or user.archived_at:
        raise fail("Active school-student identity required", 403)
    membership = db.scalar(select(ClassMembership).where(ClassMembership.student_id == user.id,
                   ClassMembership.class_id == protocol.class_id, ClassMembership.status == "active",
                   ClassMembership.ended_at.is_(None)).with_for_update(read=True))
    if not membership:
        raise fail("Current class membership required", 403)
    conflict = db.scalar(select(ResearchParticipant.id).join(ResearchIdentityLink,
                          ResearchIdentityLink.participant_id == ResearchParticipant.id).where(
                          ResearchIdentityLink.user_id == user.id, ResearchParticipant.study_id != protocol.study_id,
                          ResearchParticipant.enrollment_status == "enrolled").limit(1))
    if conflict:
        raise fail("Conflicting study participation must be resolved without rewriting history")
    study = db.get(ResearchStudy, protocol.study_id)
    if not study or (study.conditions or {}).get("research_contract") != CONTRACT:
        raise fail("Study contract mismatch")
    for kind in protocol.configuration["required_consent_kinds"]:
        consent = db.scalar(select(ResearchConsentRecord).where(ResearchConsentRecord.participant_id == p.id,
                  ResearchConsentRecord.protocol_version == study.protocol_version, ResearchConsentRecord.kind == kind)
                  .order_by(ResearchConsentRecord.recorded_at.desc(), ResearchConsentRecord.id.desc()).limit(1).with_for_update(read=True))
        if not consent or consent.status != "granted" or not consent.evidence_reference.strip():
            raise fail("Current documented participation permission required", 403)
    old = db.scalar(select(ParallelAllocation).where(ParallelAllocation.protocol_id == protocol.id,
                                                    ParallelAllocation.participant_id == p.id))
    if old:
        return {"id": str(old.id), "status": "assigned_inactive"}
    count = db.scalar(select(func.count()).select_from(ParallelAllocation).where(ParallelAllocation.protocol_id == protocol.id))
    if count >= 30:
        raise fail("The 30 reserved allocation slots are full; withdrawals do not free slots")
    row = ParallelAllocation(protocol_id=protocol.id, participant_id=p.id, actor_id=actor_id, slot=count,
                             condition=allocation_sequence(protocol.seed)[count], assigned_at=now(), method=METHOD)
    db.add(row)
    db.flush()
    db.add(AuditLog(actor_id=actor_id, action="parallel.assigned_inactive", entity_type="parallel_allocation",
                    entity_id=row.id, occurred_at=now(), safe_metadata={"contract": CONTRACT}))
    return {"id": str(row.id), "status": "assigned_inactive"}
