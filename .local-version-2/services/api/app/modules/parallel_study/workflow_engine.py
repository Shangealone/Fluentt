"""Transactional Track 1 mechanics; every public operation rechecks disposable scope."""
from datetime import date, datetime, time, timedelta, timezone
import re
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import select, text

from app.models.parallel_study import ParallelClearance, ParallelAllocation, ParallelAssessment, ParallelOpportunity
from app.models.parallel_workflow import TestWorkflow, WorkflowEvent, WorkflowAttempt, WorkflowMemory
from app.models.research import ResearchStudy, ResearchParticipant, ResearchIdentityLink, ResearchConsentRecord
from app.models.users import User, ClassMembership
from app.models.vocabulary_review import VocabularyPack
from app.modules.vocabulary_review.schemas import CardDefinition
from app.modules.vocabulary_review.policy import public_card, check_answer, effective_rating, format_for, CHECKING_VERSION, RATING_VERSION
from app.modules.vocabulary_review.service import digest
from app.modules.spaced_repetition.fsrs6 import calculate_fsrs6, fsrs6_scheduler
from . import service
from .policy import CONTROL, EXPERIMENTAL


def now():
    return datetime.now(timezone.utc)


def isolated(db, settings):
    if settings.environment != "test" or not settings.parallel_test_workflows_enabled or not settings.parallel_research_enabled:
        raise service.fail("Development workflows are disabled", 404)
    assert_disposable_database(db)


def assert_disposable_database(db):
    name, address = db.execute(text("SELECT current_database(), host(inet_server_addr())")).one()
    if not re.fullmatch(r"fluentt_test_[0-9a-f]{32}", name) or address not in {"127.0.0.1", "::1"}:
        raise service.fail("Only a disposable local UUID test database may execute this workflow", 403)


def workflow(db, protocol):
    row = db.scalar(select(TestWorkflow).where(TestWorkflow.protocol_id == protocol.id))
    if not row or row.configuration.get("development_only") is not True:
        raise service.fail("Synthetic study policy has not been configured")
    return row.configuration


def event(db, protocol, actor, kind, target, participant=None, evidence=None):
    existing = db.scalar(select(WorkflowEvent).where(WorkflowEvent.protocol_id == protocol.id,
                WorkflowEvent.participant_id == participant, WorkflowEvent.kind == kind, WorkflowEvent.target_id == target))
    if not existing:
        db.add(WorkflowEvent(protocol_id=protocol.id, participant_id=participant, actor_id=actor, kind=kind,
                             target_id=target, evidence={"development_only": True, **(evidence or {})}))
        db.flush()


def configured_cards(config):
    return [CardDefinition.model_validate(row) for row in config["cards"]]


def configure(db, protocol, payload, actor):
    existing = db.scalar(select(TestWorkflow).where(TestWorkflow.protocol_id == protocol.id))
    identity = digest(payload.model_dump(mode="json"))
    if existing:
        if existing.configuration["request_fingerprint"] != identity:
            raise service.fail("Synthetic configuration is frozen; use a new study version")
        return {"status": "configured_development_only"}
    if payload.pretest_date >= date.fromisoformat(protocol.configuration["start_date"]):
        raise service.fail("Pretest must be scheduled before intervention starts", 422)
    pack = db.get(VocabularyPack, protocol.pack_id)
    cards = [CardDefinition.model_validate(row) for row in pack.content["cards"]]
    if not 1 <= len(cards) <= 200:
        raise service.fail("A nonempty bounded published pool is required", 422)
    config = payload.model_dump(mode="json") | dict(cards=[c.model_dump(mode="json") for c in cards],
              development_only=True, request_fingerprint=identity, retakes=0, all_items_required=True,
              score_policy="development-objective-complete-v1", checking_version=CHECKING_VERSION,
              rating_version=RATING_VERSION, fsrs_identity=fsrs6_scheduler.identity.model_dump(mode="json"),
              delayed_requires_posttest=False)
    db.add(TestWorkflow(protocol_id=protocol.id, configuration=config))
    latest = db.scalar(select(ParallelClearance.sequence).where(ParallelClearance.protocol_id == protocol.id)
                       .order_by(ParallelClearance.sequence.desc()).limit(1)) or 0
    db.add(ParallelClearance(protocol_id=protocol.id, sequence=latest+1, status="verified",
                            configuration_sha256=digest(protocol.configuration), evidence_reference="SYNTHETIC: Track 1 test policy "+identity))
    event(db, protocol, actor, "synthetic_policy", protocol.id, evidence={"policy_hash": identity})
    return {"status": "configured_development_only"}


def enroll(db, protocol, payload, actor):
    workflow(db, protocol)
    user = db.scalar(select(User).where(User.id == payload.user_id).with_for_update(nowait=True)
                     .execution_options(populate_existing=True))
    if not user or user.role != "school_student" or user.profile_status != "active" or user.archived_at:
        raise service.fail("An eligible active school account is required", 403)
    membership = db.scalar(select(ClassMembership).where(ClassMembership.class_id == protocol.class_id,
               ClassMembership.student_id == user.id, ClassMembership.status == "active", ClassMembership.ended_at.is_(None))
               .with_for_update(read=True))
    if not membership or set(payload.consent_evidence) != set(protocol.configuration["required_consent_kinds"]):
        raise service.fail("Membership and all configured participation permissions are required", 403)
    links = db.execute(select(ResearchIdentityLink, ResearchParticipant).join(ResearchParticipant,
               ResearchParticipant.id == ResearchIdentityLink.participant_id).where(ResearchIdentityLink.user_id == user.id)).all()
    existing = None
    for link, participant in links:
        if participant.study_id == protocol.study_id:
            existing = participant
        elif participant.enrollment_status == "enrolled":
            raise service.fail("Another active research enrollment conflicts with this study")
    if existing:
        if existing.enrollment_status != "enrolled":
            raise service.fail("Withdrawal/completion never permits silent re-enrollment")
        saved = db.scalar(select(WorkflowEvent).where(WorkflowEvent.protocol_id == protocol.id,
                WorkflowEvent.participant_id == existing.id, WorkflowEvent.kind == "enrolled"))
        if not saved or saved.evidence.get("request_fingerprint") != digest(payload.model_dump(mode="json")):
            raise service.fail("Enrollment retry details differ")
        return service.allocate(db, protocol, existing.id, actor)
    study = db.get(ResearchStudy, protocol.study_id)
    p = ResearchParticipant(study_id=study.id, participant_code="TEST_"+uuid4().hex,
              enrollment_status="enrolled", eligibility_status="eligible", enrolled_at=now())
    db.add(p)
    db.flush()
    db.add(ResearchIdentityLink(study_id=study.id, participant_id=p.id, user_id=user.id))
    for kind, reference in payload.consent_evidence.items():
        db.add(ResearchConsentRecord(participant_id=p.id, kind=kind, protocol_version=study.protocol_version,
                   status="granted", evidence_reference=reference, recorded_at=now()))
    db.flush()
    result = service.allocate(db, protocol, p.id, actor)
    allocation = db.get(ParallelAllocation, UUID(result["id"]))
    first_day = db.scalar(select(ParallelOpportunity.opens_at).where(ParallelOpportunity.protocol_id == protocol.id)
                          .order_by(ParallelOpportunity.opens_at).limit(1))
    for card in configured_cards(workflow(db, protocol)):
        db.add(WorkflowMemory(allocation_id=allocation.id, vocabulary_item_id=card.vocabulary_item_id,
                content_version=card.content_version, memory={}, due_at=first_day, revision=1))
    event(db, protocol, actor, "enrolled", p.id, p.id,
          {"request_fingerprint": digest(payload.model_dump(mode="json")), "allocation_id": str(allocation.id)})
    return result


def participant(db, protocol, user, allow_withdrawn=False):
    p = db.scalar(select(ResearchParticipant).join(ResearchIdentityLink,
                    ResearchIdentityLink.participant_id == ResearchParticipant.id).where(
                    ResearchIdentityLink.user_id == user.id, ResearchParticipant.study_id == protocol.study_id)
                    .with_for_update(of=ResearchParticipant).execution_options(populate_existing=True))
    if not p:
        raise service.fail("Study enrollment required", 403)
    if allow_withdrawn and p.enrollment_status == "withdrawn":
        return p, None
    if p.enrollment_status != "enrolled" or p.eligibility_status != "eligible":
        raise service.fail("Current research participation unavailable", 403)
    allocation = db.scalar(select(ParallelAllocation).where(ParallelAllocation.protocol_id == protocol.id,
                                                          ParallelAllocation.participant_id == p.id))
    if not allocation:
        raise service.fail("Authorized immutable allocation required")
    # Reuse the exact live consent/membership/clearance checks before every operation.
    service.allocate(db, protocol, p.id, protocol.actor_id)
    return p, allocation


def withdraw(db, protocol, user):
    p = db.scalar(select(ResearchParticipant).join(ResearchIdentityLink,
                 ResearchIdentityLink.participant_id == ResearchParticipant.id).where(
                 ResearchIdentityLink.user_id == user.id, ResearchParticipant.study_id == protocol.study_id)
                 .with_for_update(of=ResearchParticipant).execution_options(populate_existing=True))
    if not p:
        raise service.fail("Own study enrollment unavailable", 404)
    if p.enrollment_status != "withdrawn":
        p.enrollment_status, p.withdrawn_at = "withdrawn", now()
        study = db.get(ResearchStudy, protocol.study_id)
        for kind in protocol.configuration["required_consent_kinds"]:
            db.add(ResearchConsentRecord(participant_id=p.id, kind=kind, protocol_version=study.protocol_version,
                   status="withdrawn", evidence_reference="SYNTHETIC: participant withdrawal", recorded_at=now()))
        event(db, protocol, user.id, "withdrawn", p.id, p.id)
    return {"status": "withdrawn", "development_only": True}


def publish(db, protocol, actor):
    workflow(db, protocol)
    clearance = db.scalar(select(ParallelClearance).where(ParallelClearance.protocol_id == protocol.id)
                          .order_by(ParallelClearance.sequence.desc()).limit(1).with_for_update(read=True))
    if not clearance or clearance.status != "verified" or clearance.configuration_sha256 != digest(protocol.configuration):
        raise service.fail("Current development clearance is required before publishing activities")
    event(db, protocol, actor, "activities_published", protocol.id)
    return {"status": "published_development_only", "development_only": True}


def bounds(protocol, config, target):
    if isinstance(target, ParallelOpportunity):
        return target.opens_at, target.closes_at
    local = date.fromisoformat(config["pretest_date"]) if target.kind == "pretest" else target.designated_date
    tz = ZoneInfo(protocol.configuration["timezone"])
    return (datetime.combine(local, time.min, tzinfo=tz).astimezone(timezone.utc),
            datetime.combine(local+timedelta(days=1), time.min, tzinfo=tz).astimezone(timezone.utc))


def published(db, protocol):
    return db.scalar(select(WorkflowEvent.id).where(WorkflowEvent.protocol_id == protocol.id,
               WorkflowEvent.kind == "activities_published").limit(1)) is not None


def pretest_complete(db, allocation):
    return db.scalar(select(WorkflowAttempt.id).join(ParallelAssessment,
             ParallelAssessment.id == WorkflowAttempt.assessment_id).where(
             WorkflowAttempt.allocation_id == allocation.id, WorkflowAttempt.submitted_at.is_not(None),
             ParallelAssessment.kind == "pretest").limit(1)) is not None


def target_for(db, protocol, kind, target_id):
    model = ParallelAssessment if kind == "assessment" else ParallelOpportunity if kind == "activity" else None
    row = db.get(model, target_id) if model else None
    if not row or row.protocol_id != protocol.id:
        raise service.fail("Study task unavailable", 404)
    return row


def due_at_day(db, protocol, allocation, closes):
    # Reconstruct prior observed decisions rather than using today's memory for past missingness.
    initial = db.scalar(select(ParallelOpportunity.opens_at).where(ParallelOpportunity.protocol_id == protocol.id)
                        .order_by(ParallelOpportunity.opens_at).limit(1))
    due = {str(c.vocabulary_item_id): initial for c in configured_cards(workflow(db, protocol))}
    attempts = db.scalars(select(WorkflowAttempt).where(WorkflowAttempt.allocation_id == allocation.id,
               WorkflowAttempt.opportunity_id.is_not(None), WorkflowAttempt.submitted_at < closes)
               .order_by(WorkflowAttempt.submitted_at, WorkflowAttempt.id))
    for attempt in attempts:
        for item, decision in attempt.result.get("decisions", {}).items():
            due[item] = datetime.fromisoformat(decision["due_at"])
    return any(at < closes for at in due.values())


def status_for(db, protocol, allocation, config, target, p, actor):
    is_activity = isinstance(target, ParallelOpportunity)
    column = WorkflowAttempt.opportunity_id if is_activity else WorkflowAttempt.assessment_id
    attempt = db.scalar(select(WorkflowAttempt).where(WorkflowAttempt.allocation_id == allocation.id, column == target.id))
    if attempt and attempt.submitted_at:
        return "completed"
    if is_activity and allocation.condition == EXPERIMENTAL:
        return "blocked_model"
    opens, closes = bounds(protocol, config, target)
    at = now()
    if (is_activity or target.kind != "pretest") and not pretest_complete(db, allocation):
        if not is_activity and at >= closes:
            event(db, protocol, actor, "assessment_missed", target.id, p.id,
                  {"incomplete_attempt": bool(attempt), "prerequisite_incomplete": True})
            return "missed_incomplete" if attempt else "missed"
        return "blocked_pretest"
    if is_activity and not published(db, protocol):
        return "blocked_publication"
    if at < opens:
        return "locked"
    if is_activity and not due_at_day(db, protocol, allocation, closes):
        return "no_due_items"
    if at >= closes:
        label = "activity_missed" if is_activity else "assessment_missed"
        event(db, protocol, actor, label, target.id, p.id, {"incomplete_attempt": bool(attempt)})
        return "missed_incomplete" if attempt else "missed"
    if is_activity and not attempt and db.scalar(select(WorkflowMemory.id).where(
            WorkflowMemory.allocation_id == allocation.id, WorkflowMemory.due_at <= at).limit(1)) is None:
        return "not_due_yet"
    return "in_progress" if attempt else "available"


def directory(db, protocol, user):
    config = workflow(db, protocol)
    p, allocation = participant(db, protocol, user, allow_withdrawn=True)
    if p.enrollment_status == "withdrawn":
        return {"status": "withdrawn", "development_only": True, "tasks": []}
    assessments = list(db.scalars(select(ParallelAssessment).where(ParallelAssessment.protocol_id == protocol.id)
                                  .order_by(ParallelAssessment.kind)))
    days = list(db.scalars(select(ParallelOpportunity).where(ParallelOpportunity.protocol_id == protocol.id)
                          .order_by(ParallelOpportunity.local_date)))
    tasks = [dict(id=str(t.id), kind="activity" if isinstance(t, ParallelOpportunity) else "assessment",
                  title=t.local_date.isoformat() if isinstance(t, ParallelOpportunity) else t.kind,
                  status=status_for(db, protocol, allocation, config, t, p, user.id)) for t in [*assessments, *days]]
    finished = all(t["status"] == "completed" for t in tasks if t["title"] in {"pretest", "posttest", "delayed"})
    return dict(status="assessment_sequence_completed" if finished else "enrolled", tasks=tasks, development_only=True)


def attempt_view(attempt):
    if attempt.submitted_at:
        return dict(id=str(attempt.id), status="completed", revision=attempt.revision,
                    result={k: v for k, v in attempt.result.items() if k in {"points", "maximum", "development_only", "scheduler"}},
                    submitted_at=attempt.submitted_at.isoformat(), development_only=True)
    return dict(id=str(attempt.id), status="draft", revision=attempt.revision,
                responses=attempt.responses.get("answers", {}), ratings=attempt.responses.get("ratings", {}),
                cards=[dict(**public_card(CardDefinition.model_validate(row["card"]), row["format"]),
                            response_id=str(row["card"]["vocabulary_item_id"])) for row in attempt.snapshot["items"]],
                development_only=True)


def start(db, protocol, user, kind, target_id):
    config = workflow(db, protocol)
    p, allocation = participant(db, protocol, user)
    target = target_for(db, protocol, kind, target_id)
    state = status_for(db, protocol, allocation, config, target, p, user.id)
    if state not in {"available", "in_progress", "completed"}:
        raise service.fail("Study task is "+state)
    column = WorkflowAttempt.assessment_id if kind == "assessment" else WorkflowAttempt.opportunity_id
    old = db.scalar(select(WorkflowAttempt).where(WorkflowAttempt.allocation_id == allocation.id, column == target_id))
    if old:
        return attempt_view(old)
    items = []
    for position, card in enumerate(configured_cards(config)):
        if kind == "activity":
            memory = db.scalar(select(WorkflowMemory).where(WorkflowMemory.allocation_id == allocation.id,
                     WorkflowMemory.vocabulary_item_id == card.vocabulary_item_id,
                     WorkflowMemory.content_version == card.content_version))
            if not memory or memory.due_at > now():
                continue
            fmt = format_for(position, memory.revision)
        else:
            fmt = config["assessment_format"]
        items.append(dict(card=card.model_dump(mode="json"), format=fmt))
    if not items:
        raise service.fail("No vocabulary items are due in this activity")
    opens, closes = bounds(protocol, config, target)
    if not opens <= now() < closes:
        raise service.fail("The server task window closed before the attempt started")
    attempt = WorkflowAttempt(allocation_id=allocation.id, assessment_id=target_id if kind == "assessment" else None,
              opportunity_id=target_id if kind == "activity" else None, snapshot={"items": items, "policy": config["policy"],
              "version": config["assessment_version"], "development_only": True}, responses={}, revision=1, started_at=now(), result={})
    db.add(attempt)
    db.flush()
    event(db, protocol, user.id, "started", attempt.id, p.id, {"task_id": str(target_id), "task_kind": kind})
    return attempt_view(attempt)


def operate_attempt(db, protocol, user, attempt_id, action, payload=None):
    config = workflow(db, protocol)
    p, allocation = participant(db, protocol, user)
    attempt = db.scalar(select(WorkflowAttempt).where(WorkflowAttempt.id == attempt_id,
               WorkflowAttempt.allocation_id == allocation.id).with_for_update().execution_options(populate_existing=True))
    if not attempt:
        raise service.fail("Own study attempt unavailable", 404)
    if action == "read":
        return attempt_view(attempt)
    fingerprint = digest(payload.model_dump(mode="json"))
    if attempt.submitted_at:
        if action == "submit" and attempt.request_id == payload.request_id and attempt.fingerprint == fingerprint:
            return attempt_view(attempt)
        raise service.fail("Submitted attempt is immutable; reconcile its retained receipt")
    target = target_for(db, protocol, "assessment" if attempt.assessment_id else "activity",
                        attempt.assessment_id or attempt.opportunity_id)
    if status_for(db, protocol, allocation, config, target, p, user.id) != "in_progress":
        raise service.fail("This attempt is no longer available")
    if payload.expected_revision != attempt.revision:
        raise service.fail("Attempt changed; reload before another save")
    keys = {str(row["card"]["vocabulary_item_id"]) for row in attempt.snapshot["items"]}
    if not set(payload.responses) <= keys or not set(payload.ratings) <= keys:
        raise service.fail("Unknown response identity", 422)
    if attempt.assessment_id and payload.ratings:
        raise service.fail("Assessments do not accept practice ratings", 422)
    if action == "save":
        attempt.responses, attempt.revision = dict(answers=payload.responses, ratings=payload.ratings), attempt.revision+1
        db.flush()
        return attempt_view(attempt)
    if set(payload.responses) != keys or any(not value.strip() for value in payload.responses.values()):
        raise service.fail("Complete every configured item before final submission", 422)
    if attempt.opportunity_id and set(payload.ratings) != keys:
        raise service.fail("Every practice item needs a separate recall rating", 422)
    if attempt.assessment_id and payload.ratings:
        raise service.fail("Assessment scores never derive from subjective practice ratings", 422)
    decisions, outcomes, points = {}, {}, 0
    if attempt.opportunity_id and config["fsrs_identity"] != fsrs6_scheduler.identity.model_dump(mode="json"):
        raise service.fail("The frozen control scheduler identity has changed; use a reviewed study version")
    for row in attempt.snapshot["items"]:
        card = CardDefinition.model_validate(row["card"])
        key = str(card.vocabulary_item_id)
        try:
            check = check_answer(card, row["format"], payload.responses[key])
        except ValueError as error:
            raise service.fail(str(error), 422) from None
        points += int(check.correct)
        outcomes[key] = {"correct": check.correct, "content_version": card.content_version}
        if attempt.opportunity_id:
            if allocation.condition != CONTROL:
                raise service.fail("Validated FIFAKT unavailable; no hybrid outcome is recorded")
            memory = db.scalar(select(WorkflowMemory).where(WorkflowMemory.allocation_id == allocation.id,
                     WorkflowMemory.vocabulary_item_id == card.vocabulary_item_id, WorkflowMemory.content_version == card.content_version)
                     .with_for_update().execution_options(populate_existing=True))
            rating = effective_rating(check.correct, payload.ratings[key])
            decision = calculate_fsrs6(memory.memory, rating, now(), revision=memory.revision)
            memory.memory, memory.due_at, memory.revision = decision.resulting_state, decision.due_at, memory.revision+1
            decisions[key] = dict(due_at=decision.due_at.isoformat(), memory=decision.resulting_state,
                    interval_seconds=str(decision.resulting_interval_seconds), scheduler=decision.implementation_version,
                    previous_interval_seconds=str(decision.previous_interval_seconds), content_version=card.content_version,
                    configuration_version=decision.configuration_version,
                    fsrs_pre_review_retrievability=decision.resulting_state.get("retrievability"),
                    raw_rating=payload.ratings[key], effective_rating=rating, observed_correct=check.correct)
    final_at = now()
    opens, closes = bounds(protocol, config, target)
    if not opens <= final_at < closes:
        raise service.fail("The server assessment/activity window closed before finalization")
    attempt.responses = dict(answers=payload.responses, ratings=payload.ratings)
    attempt.submitted_at, attempt.request_id, attempt.fingerprint = final_at, payload.request_id, fingerprint
    attempt.result = dict(points=points, maximum=len(keys), decisions=decisions, observed_outcomes=outcomes, development_only=True,
              checking_version=CHECKING_VERSION, rating_version=RATING_VERSION if attempt.opportunity_id else None,
              scheduler_identity=config["fsrs_identity"] if attempt.opportunity_id else None,
              scheduler="fsrs-6-reference-v1" if attempt.opportunity_id else None,
              response_elapsed_ms=max(0, int((now()-attempt.started_at).total_seconds()*1000)))
    attempt.revision += 1
    db.flush()
    event(db, protocol, user.id, "submitted", attempt.id, p.id, {"task_kind": "activity" if attempt.opportunity_id else "assessment"})
    return attempt_view(attempt)
