"""Live authorization, retained content, and transactional review finalization."""
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime, timezone
import hashlib
import json
import secrets
from uuid import UUID

from sqlalchemy import func, select, text

from app.models.learning import VocabularyItem
from app.models.curriculum import Lesson
from app.models.operations import AuditLog
from app.models.research import ResearchStudy, ResearchParticipant, ResearchIdentityLink, ResearchConsentRecord
from app.models.users import Classroom, User, ClassMembership
from app.models.vocabulary_review import (VocabularyPack, ESRProtocol, ESRApproval, ESRAllocation,
                                         ESRReviewState, ESRReview, ESRMutation)
from app.modules.administration.service import resolve_session
from app.modules.curriculum.repository import path_statement, visible
from app.modules.identity.errors import IdentityError
from app.modules.identity.session_service import authenticated_session
from .features import HistoryEntry, history_before
from .inference import prediction_for, provider_ready
from .policy import assigned_condition, check_answer, effective_rating, format_for, normalize_answer, public_card, RATING_VERSION
from .scheduler import schedule_review
from .schemas import CardDefinition, HybridConfiguration

CONTRACT = "esr-counterbalanced-v1"
APPROVALS = ("protocol", "ethics", "site", "instruments", "model")


def now():
    return datetime.now(timezone.utc)


def fail(message="Vocabulary review is unavailable.", status=409):
    return IdentityError(status, "vocabulary_review_unavailable", message)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str).encode()).hexdigest()


def revision(protocol):
    return f'"{protocol.id}:{protocol.revision}"'


def replay(db, actor, key, fingerprint):
    row = db.scalar(select(ESRMutation).where(ESRMutation.actor_id == actor.id, ESRMutation.request_id == key))
    if row:
        if row.fingerprint != fingerprint:
            raise fail("This retry identity belongs to different details.")
        return row.response
    return None


def retain(db, actor, key, fingerprint, result):
    # All mutation callers hold the authenticated actor lock for the transaction.
    db.add(ESRMutation(actor_id=actor.id, request_id=key, fingerprint=fingerprint, response=result))
    db.flush()
    return result


def cards(pack):
    return [CardDefinition.model_validate(row) for row in pack.content["cards"]]


def pack_view(pack, private=False):
    value = dict(id=str(pack.id), lesson_id=str(pack.lesson_id), title=pack.title, language=pack.language,
                 card_count=len(pack.content["cards"]), published_at=pack.published_at.isoformat() if pack.published_at else None,
                 fingerprint=pack.fingerprint)
    if private:
        value["cards"] = pack.content["cards"]
    return value


def approvals_current(db, protocol):
    fingerprint = digest(protocol.configuration)
    rows = db.scalars(select(ESRApproval).where(ESRApproval.protocol_id == protocol.id)
                      .order_by(ESRApproval.kind, ESRApproval.sequence.desc()).with_for_update(read=True))
    latest = {}
    for row in rows:
        latest.setdefault(row.kind, row)
    return [kind for kind in APPROVALS if kind not in latest or latest[kind].status != "verified"
            or latest[kind].configuration_sha256 != fingerprint or not latest[kind].evidence_reference.strip()]


def blockers(db, protocol, provider):
    missing = ["approval_" + value for value in approvals_current(db, protocol)]
    # No deployment flag may bypass the missing consent/withdrawal/assessment integration.
    # Remove this blocker only together with that workflow and its acceptance evidence.
    missing.append("study_workflow_unavailable")
    study = db.get(ResearchStudy, protocol.study_id, populate_existing=True)
    pinned = protocol.configuration
    if (not study or (study.conditions or {}).get("research_contract") != CONTRACT
            or study.protocol_version != pinned.get("protocol_version")
            or study.target_participants != pinned.get("target_participants")
            or study.code != pinned.get("code") or study.status in {"completed", "archived"}):
        missing.append("study_configuration_changed")
    if not provider_ready(provider) or provider.artifact_sha256 != protocol.configuration["model_artifact_sha256"]:
        missing.append("validated_model_unavailable")
    for pack_id in (protocol.pack_a_id, protocol.pack_b_id):
        pack = db.get(VocabularyPack, pack_id, populate_existing=True)
        if not pack or not pack.published_at:
            missing.append("published_pool_unavailable")
    classroom = db.get(Classroom, protocol.class_id, populate_existing=True)
    if not classroom or classroom.status != "active" or classroom.archived_at:
        missing.append("class_unavailable")
    return sorted(set(missing))


def protocol_view(db, protocol, provider):
    study = db.get(ResearchStudy, protocol.study_id)
    return dict(id=str(protocol.id), title=study.title, study_id=str(study.id), class_id=str(protocol.class_id),
                status=protocol.status, revision=revision(protocol), configuration_sha256=digest(protocol.configuration),
                pack_a_id=str(protocol.pack_a_id), pack_b_id=str(protocol.pack_b_id),
                configuration=protocol.configuration, blockers=blockers(db, protocol, provider))


def admin_read(repo, token, *, kind, provider=None):
    def operation(actor):
        db = repo.session
        if kind == "lessons":
            rows = db.execute(path_statement(5).where(*visible(5), Lesson.teacher_owned.is_(False))
                              .order_by(Lesson.name, Lesson.id).limit(500)).all()
            return dict(items=[dict(id=str(row[5].id), title=row[5].name, grade=row[6].number,
                                    subject=row[7].name) for row in rows])
        if kind == "choices":
            permissions = repo.permissions(actor.id)
            rows = db.scalars(select(Classroom).where(Classroom.status == "active", Classroom.archived_at.is_(None))
                              .order_by(Classroom.class_name, Classroom.id).limit(1000))
            return dict(classes=[dict(id=str(row.id), title=row.class_name, language=row.language) for row in rows
                         if f"research.classroom.{row.id}.manage" in permissions],
                        model_ready=provider_ready(provider),
                        artifact_sha256=provider.artifact_sha256 if provider_ready(provider) else None)
        if kind == "packs":
            return dict(items=[pack_view(row, True) for row in db.scalars(select(VocabularyPack)
                        .order_by(VocabularyPack.created_at.desc(), VocabularyPack.id).limit(200))])
        permissions = repo.permissions(actor.id)
        return dict(items=[protocol_view(db, row, provider) for row in db.scalars(select(ESRProtocol)
                    .where(ESRProtocol.manager_id == actor.id).order_by(ESRProtocol.created_at.desc()).limit(100))
                    if f"research.classroom.{row.class_id}.read" in permissions])
    return resolve_session(repo, token, required_permission="curriculum.read" if kind in {"packs", "lessons"} else "research.read", read_operation=operation)


def admin_write(repo, token, csrf, key, *, action, payload=None, target=None, expected=None, provider=None):
    research = action in {"protocol", "state", "allocate"}
    permission = "research.manage" if research else "curriculum.publish" if action == "publish" else "curriculum.write"
    fingerprint = digest([action, target, payload.model_dump(mode="json") if payload is not None else None, expected])

    def operation(actor):
        db = repo.session
        # Replay never bypasses current classroom-specific grants.
        if research:
            scoped = payload.class_id if action == "protocol" else db.scalar(
                select(ESRProtocol.class_id).where(ESRProtocol.id == target, ESRProtocol.manager_id == actor.id))
            if scoped is None or f"research.classroom.{scoped}.manage" not in repo.permissions(actor.id):
                raise fail("Explicit research management access to this classroom is required.", 403)
        previous = replay(db, actor, key, fingerprint)
        if previous is not None:
            return previous
        if action == "pack":
            # Same published official curriculum boundary as existing content authoring.
            db.execute(text("SELECT pg_advisory_xact_lock_shared(78090001)"))
            path = db.execute(path_statement(5).where(Lesson.id == payload.lesson_id, *visible(5),
                                                     Lesson.teacher_owned.is_(False))).first()
            if path is None:
                raise fail("Choose an available published curriculum lesson.", 422)
            for definition in payload.cards:
                row = db.get(VocabularyItem, definition.vocabulary_item_id)
                if row:
                    if (row.lesson_id, row.language, row.version, row.term, row.meaning) != (
                            payload.lesson_id, payload.language, definition.content_version, definition.term, definition.meaning):
                        raise fail("An existing vocabulary ID has different content. Use a new version and identity.", 422)
                else:
                    db.add(VocabularyItem(id=definition.vocabulary_item_id, lesson_id=payload.lesson_id,
                           language=payload.language, term=definition.term, meaning=definition.meaning,
                           version=definition.content_version))
            content = dict(cards=[row.model_dump(mode="json") for row in payload.cards])
            row = VocabularyPack(author_id=actor.id, lesson_id=payload.lesson_id, title=payload.title.strip(),
                                 language=payload.language, content=content, fingerprint=digest(content))
            db.add(row)
            db.flush()
            result = pack_view(row, True)
        elif action == "publish":
            row = db.scalar(select(VocabularyPack).where(VocabularyPack.id == target).with_for_update())
            if not row:
                raise fail("Vocabulary pool not found.", 404)
            row.published_at = row.published_at or now()
            result = pack_view(row, True)
        elif action == "protocol":
            if f"research.classroom.{payload.class_id}.manage" not in repo.permissions(actor.id):
                raise fail("Explicit research management access to this classroom is required.", 403)
            a, b = db.get(VocabularyPack, payload.pack_a_id), db.get(VocabularyPack, payload.pack_b_id)
            classroom = db.get(Classroom, payload.class_id)
            if not a or not b or not a.published_at or not b.published_at or a.language != b.language:
                raise fail("Choose two published pools with the same language.", 422)
            if not classroom or classroom.status != "active" or classroom.archived_at or classroom.language != a.language:
                raise fail("Choose an active class with the pool language.", 422)
            if {normalize_answer(row.term) for row in cards(a)} & {normalize_answer(row.term) for row in cards(b)}:
                raise fail("The vocabulary pools must not overlap.", 422)
            if a.id == b.id:
                raise fail("Choose two distinct pools.", 422)
            study = ResearchStudy(code=payload.code, title=payload.title, status="draft", target_language=a.language,
                                  protocol_version=payload.protocol_version, target_participants=payload.target_participants,
                                  conditions={"research_contract": CONTRACT})
            db.add(study)
            db.flush()
            row = ESRProtocol(study_id=study.id, manager_id=actor.id, class_id=payload.class_id,
                              pack_a_id=a.id, pack_b_id=b.id, configuration=payload.model_dump(mode="json") | {
                                  "implementation": "esr-counterbalanced-v1",
                                  "scheduler": "fsrs6-interval-fusion-v1",
                                  "checking": "vocabulary-nfc-trim-casefold-v1",
                                  "rating": RATING_VERSION,
                                  "format_order": "item-position-plus-revision-alternation-v1",
                                  "history": "own-pool-before-presentation-v1",
                              }, status="draft")
            db.add(row)
            db.flush()
            result = protocol_view(db, row, provider)
        else:
            row = db.scalar(select(ESRProtocol).where(ESRProtocol.id == target, ESRProtocol.manager_id == actor.id)
                            .with_for_update().execution_options(populate_existing=True))
            if row is None:
                raise fail("Study configuration not found.", 404)
            if f"research.classroom.{row.class_id}.manage" not in repo.permissions(actor.id):
                raise fail("Explicit research management access to this classroom is required.", 403)
            if expected != revision(row):
                raise fail("This study changed. Reload before continuing.", 412)
            if action == "state":
                edges = {"draft": {"active"}, "active": {"paused", "completed"}, "paused": {"active", "completed"}, "completed": set()}
                if payload.status not in edges[row.status]:
                    raise fail("This study state transition is unavailable.")
                if payload.status == "active" and blockers(db, row, provider):
                    raise fail("Study activation needs verified approvals, published pools and a validated model.")
                row.status, row.revision = payload.status, row.revision + 1
                result = protocol_view(db, row, provider)
            else:
                if row.status != "active" or blockers(db, row, provider):
                    raise fail("The study is not ready for participant allocation.")
                participant = eligible_participant(db, row, payload.participant_id)
                allocation = db.scalar(select(ESRAllocation).where(ESRAllocation.protocol_id == row.id,
                                                                   ESRAllocation.participant_id == participant.id))
                if not allocation:
                    count = db.scalar(select(func.count()).select_from(ESRAllocation).where(ESRAllocation.protocol_id == row.id))
                    study = db.get(ResearchStudy, row.study_id)
                    if count >= study.target_participants:
                        raise fail("The planned participant capacity is full.")
                    counts = dict(db.execute(select(ESRAllocation.mapping, func.count()).where(ESRAllocation.protocol_id == row.id)
                                             .group_by(ESRAllocation.mapping)).all())
                    mapping = secrets.choice([1, 2]) if counts.get(1, 0) == counts.get(2, 0) else 1 if counts.get(1, 0) < counts.get(2, 0) else 2
                    allocation = ESRAllocation(protocol_id=row.id, participant_id=participant.id, mapping=mapping)
                    db.add(allocation)
                    db.flush()
                    for pack_id in (row.pack_a_id, row.pack_b_id):
                        for definition in cards(db.get(VocabularyPack, pack_id)):
                            db.add(ESRReviewState(allocation_id=allocation.id, pack_id=pack_id,
                                   vocabulary_item_id=definition.vocabulary_item_id, memory={}, due_at=now(), revision=1))
                result = dict(id=str(allocation.id), participant_code=participant.participant_code, mapping=allocation.mapping)
        db.add(AuditLog(actor_id=actor.id, action="esr." + action, entity_type="vocabulary_review",
                       entity_id=UUID(result["id"]), occurred_at=now(), safe_metadata={}))
        return retain(db, actor, key, fingerprint, result)

    return resolve_session(repo, token, csrf=csrf, required_permission=permission,
                           additional_permissions=("research.read",) if research else ("curriculum.read",), mutation_operation=operation)


def eligible_participant(db, protocol, participant_id, user_id=None):
    participant = db.scalar(select(ResearchParticipant).where(ResearchParticipant.id == participant_id,
                     ResearchParticipant.study_id == protocol.study_id).with_for_update().execution_options(populate_existing=True))
    if not participant or participant.enrollment_status != "enrolled" or participant.eligibility_status != "eligible":
        raise fail("Participant eligibility or enrollment is unavailable.", 403)
    link = db.scalar(select(ResearchIdentityLink).where(ResearchIdentityLink.participant_id == participant.id,
                                                       ResearchIdentityLink.study_id == protocol.study_id))
    user = db.get(User, link.user_id, populate_existing=True) if link else None
    if not user or (user_id is not None and user.id != user_id) or user.role != "school_student" or user.profile_status != "active" or user.archived_at:
        raise fail("Current participant access is unavailable.", 403)
    if db.scalar(select(ClassMembership.id).where(ClassMembership.class_id == protocol.class_id,
                 ClassMembership.student_id == user.id, ClassMembership.status == "active", ClassMembership.ended_at.is_(None))) is None:
        raise fail("Current class membership is required.", 403)
    study = db.get(ResearchStudy, protocol.study_id)
    for kind in protocol.configuration["required_consent_kinds"]:
        consent = db.scalar(select(ResearchConsentRecord).where(ResearchConsentRecord.participant_id == participant.id,
                     ResearchConsentRecord.protocol_version == study.protocol_version, ResearchConsentRecord.kind == kind)
                     .order_by(ResearchConsentRecord.recorded_at.desc(), ResearchConsentRecord.id.desc()).limit(1).with_for_update(read=True))
        if not consent or consent.status != "granted" or not consent.evidence_reference.strip():
            raise fail("Current documented participation permissions are required.", 403)
    return participant


@contextmanager
def learner_context(repo, token, settings, protocol_id, provider):
    db = repo.session
    with authenticated_session(repo, token, settings) as (_, user):
        if user.role != "school_student" or user.profile_status != "active":
            raise fail(status=403)
        hint = db.get(ESRProtocol, protocol_id)
        if not hint:
            raise fail(status=404)
        owner_id = db.scalar(select(Classroom.instructor_id).where(Classroom.id == hint.class_id))
        owner = db.scalar(select(User).where(User.id == owner_id).with_for_update(read=True)
                          .execution_options(populate_existing=True))
        classroom = db.scalar(select(Classroom).where(Classroom.id == hint.class_id).with_for_update(read=True)
                              .execution_options(populate_existing=True))
        membership = db.scalar(select(ClassMembership).where(ClassMembership.class_id == hint.class_id,
                    ClassMembership.student_id == user.id, ClassMembership.status == "active",
                    ClassMembership.ended_at.is_(None)).with_for_update(read=True).execution_options(populate_existing=True))
        if (not owner or owner.role != "instructor" or owner.archived_at or owner.profile_status != "active"
                or not classroom or classroom.instructor_id != owner.id or classroom.status != "active"
                or classroom.archived_at or not membership):
            raise fail(status=403)
        protocol = db.scalar(select(ESRProtocol).where(ESRProtocol.id == protocol_id).with_for_update()
                             .execution_options(populate_existing=True))
        link = db.scalar(select(ResearchIdentityLink).where(ResearchIdentityLink.study_id == protocol.study_id,
                                                           ResearchIdentityLink.user_id == user.id))
        if not link:
            raise fail("This study is not available for your account.", 403)
        participant = eligible_participant(db, protocol, link.participant_id, user.id)
        allocation = db.scalar(select(ESRAllocation).where(ESRAllocation.protocol_id == protocol.id,
                                                           ESRAllocation.participant_id == participant.id))
        if protocol.status != "active" or blockers(db, protocol, provider) or not allocation:
            raise fail("Study activities are not currently available.")
        yield db, user, protocol, allocation


def learner_studies(repo, token, settings):
    with authenticated_session(repo, token, settings) as (_, user):
        if user.role != "school_student" or user.profile_status != "active":
            raise fail(status=403)
        rows = repo.session.execute(select(ESRProtocol, ResearchStudy).join(ResearchStudy)
                    .join(ResearchIdentityLink, ResearchIdentityLink.study_id == ResearchStudy.id)
                    .join(ResearchParticipant, ResearchParticipant.id == ResearchIdentityLink.participant_id)
                    .where(ResearchIdentityLink.user_id == user.id, ResearchParticipant.enrollment_status == "enrolled")
                    .order_by(ESRProtocol.created_at, ESRProtocol.id).limit(100)).all()
        return dict(items=[dict(id=str(row.id), title=study.title, status=row.status) for row, study in rows])


def question(db, review):
    state = db.get(ESRReviewState, review.state_id)
    pack = db.get(VocabularyPack, state.pack_id)
    definition = next((item for item in cards(pack) if item.vocabulary_item_id == state.vocabulary_item_id), None)
    if definition is None:
        raise fail("The pinned vocabulary item is unavailable.")
    return state, pack, definition


def review_view(db, review):
    _, _, definition = question(db, review)
    result = dict(id=str(review.id), question=public_card(definition, review.format),
                  phase="finished" if review.finalized_at else "rating" if review.answered_at else "answer")
    if review.answered_at:
        result["feedback"] = dict(response=review.response["raw_response"], correct=review.response["correct"],
                                  answer=review.response["display_answer"])
    if review.finalized_at:
        result["due_at"] = review.decision["due_at"]
    return result


def due_reviews(repo, token, settings, protocol_id, provider):
    with learner_context(repo, token, settings, protocol_id, provider) as (db, _, protocol, allocation):
        rows = list(db.scalars(select(ESRReviewState).where(ESRReviewState.allocation_id == allocation.id,
                            ESRReviewState.due_at <= now()).order_by(ESRReviewState.due_at, ESRReviewState.id).limit(50)))
        study = db.get(ResearchStudy, protocol.study_id)
        return dict(title=study.title, items=[dict(id=str(row.id), due_at=row.due_at.isoformat()) for row in rows])


def learner_mutation(repo, token, settings, protocol_id, key, action, target, payload, provider):
    with learner_context(repo, token, settings, protocol_id, provider) as (db, user, protocol, allocation):
        fingerprint = digest([str(protocol.id), action, str(target), payload.model_dump(mode="json") if payload else None])
        previous = replay(db, user, key, fingerprint)
        if previous is not None:
            return previous
        if action == "start":
            state = db.scalar(select(ESRReviewState).where(ESRReviewState.id == target,
                              ESRReviewState.allocation_id == allocation.id).with_for_update())
            if not state or state.due_at > now():
                raise fail("This vocabulary item is not currently due.")
            review = db.scalar(select(ESRReview).where(ESRReview.state_id == state.id, ESRReview.state_revision == state.revision))
            if review is None:
                pack = db.get(VocabularyPack, state.pack_id)
                position = next(i for i, item in enumerate(cards(pack)) if item.vocabulary_item_id == state.vocabulary_item_id)
                question_format = format_for(position, state.revision)
                review = ESRReview(state_id=state.id, state_revision=state.revision, format=question_format,
                                   presented_at=now(), response={}, decision={})
                db.add(review)
                db.flush()
        else:
            review = db.scalar(select(ESRReview).join(ESRReviewState).where(ESRReview.id == target,
                               ESRReviewState.allocation_id == allocation.id).with_for_update())
            if not review:
                raise fail(status=404)
            state, pack, definition = question(db, review)
            if action == "answer":
                if review.answered_at or review.finalized_at:
                    raise fail("This answer was already committed. Continue with its saved feedback.")
                try:
                    result = asdict(check_answer(definition, review.format, payload.response))
                except ValueError as error:
                    raise fail(str(error), 422) from error
                review.answered_at = now()
                result["response_elapsed_ms"] = max(0, int((review.answered_at - review.presented_at).total_seconds() * 1000))
                review.response = result
            else:
                if not review.answered_at or review.finalized_at or state.revision != review.state_revision:
                    raise fail("Reload the review before saving a recall rating.")
                settings_value = HybridConfiguration.model_validate(protocol.configuration["settings"])
                rating = effective_rating(review.response["correct"], payload.rating)
                pool = "A" if state.pack_id == protocol.pack_a_id else "B"
                condition = assigned_condition(allocation.mapping, pool)
                timestamp = now()
                baseline = schedule_review(state.memory, rating, timestamp, "fsrs6", settings_value, prediction=None)
                scope = (str(protocol.study_id), str(allocation.participant_id), str(pack.id), str(protocol.id))
                rows = db.execute(select(ESRReview, ESRReviewState).join(ESRReviewState)
                        .where(ESRReviewState.allocation_id == allocation.id, ESRReviewState.pack_id == pack.id,
                               ESRReview.finalized_at < review.presented_at).order_by(ESRReview.finalized_at, ESRReview.id)).all()
                history = history_before([HistoryEntry(scope=scope, item_id=str(s.vocabulary_item_id),
                             content_version=next(c.content_version for c in cards(pack) if c.vocabulary_item_id == s.vocabulary_item_id),
                             format=r.format, reviewed_at=r.finalized_at, correct=r.response["correct"], revision=r.state_revision)
                             for r, s in rows], scope, review.presented_at)
                position = next(i for i, item in enumerate(cards(pack)) if item.vocabulary_item_id == state.vocabulary_item_id)
                prediction_format = format_for(position, state.revision + 1)
                prediction = prediction_for(provider, history, definition, prediction_format, timestamp, settings_value,
                                            baseline.baseline_interval_days) if condition == "esr" else None
                decision = schedule_review(state.memory, rating, timestamp, condition, settings_value,
                             prediction=prediction.probability if prediction else None,
                             fallback_reason=prediction.reason if prediction else None)
                evidence = asdict(decision)
                evidence.update(raw_rating=payload.rating, effective_rating=rating, rating_version=RATING_VERSION,
                                condition=condition, pool=pool, configuration_sha256=digest(protocol.configuration),
                                history_cutoff=review.presented_at.isoformat(), history_count=len(history),
                                prediction_format=prediction_format,
                                model_version=prediction.model_version if prediction else None,
                                artifact_sha256=prediction.artifact_sha256 if prediction else None)
                review.finalized_at = timestamp
                review.decision = json.loads(json.dumps(evidence, default=str))
                state.memory, state.due_at, state.revision = decision.memory_state, decision.due_at, state.revision + 1
        db.flush()
        return retain(db, user, key, fingerprint, review_view(db, review))
