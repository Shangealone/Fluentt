"""Spaced repetition service: ingestion of review events, state isolation, and due review lookups."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID
from sqlalchemy import select, and_, func, desc
from app.models.learning import (
    LearningContext,
    VocabularyItem,
    VocabularyReviewState,
    VocabularyReviewEvent,
)
from app.models.research import SchedulerConfiguration
from app.models.users import User, Classroom, ClassMembership
from app.modules.identity.errors import IdentityError
from app.modules.spaced_repetition.registry import registry
from app.modules.spaced_repetition.schemas import (
    ReviewEventInput,
    DueReviewBatch,
    DueReviewItem,
    ScheduleDecision,
)


def get_or_create_learning_context(db, user: User, context_type: str, class_id: UUID | None = None) -> LearningContext:
    if context_type == "personal" or (context_type == "self_study" and class_id is None):
        ctx = db.scalar(
            select(LearningContext).where(
                LearningContext.student_id == user.id,
                LearningContext.kind == "personal",
            )
        )
        if not ctx:
            ctx = LearningContext(
                student_id=user.id,
                kind="personal",
                class_id=None,
                participant_id=None,
            )
            db.add(ctx)
            db.flush()
        return ctx

    if context_type == "classroom" or class_id is not None:
        if not class_id:
            raise IdentityError(422, "missing_class_id", "Classroom context requires class_id.")
        # Verify active membership
        membership = db.scalar(
            select(ClassMembership).where(
                ClassMembership.class_id == class_id,
                ClassMembership.student_id == user.id,
                ClassMembership.status == "active",
                ClassMembership.ended_at.is_(None),
            )
        )
        if not membership and user.role != "instructor":
            raise IdentityError(403, "membership_ineligible", "Not an active member of this class.")

        ctx = db.scalar(
            select(LearningContext).where(
                LearningContext.student_id == user.id,
                LearningContext.class_id == class_id,
                LearningContext.kind == "classroom",
            )
        )
        if not ctx:
            ctx = LearningContext(
                student_id=user.id,
                kind="classroom",
                class_id=class_id,
                participant_id=None,
            )
            db.add(ctx)
            db.flush()
        return ctx

    if context_type == "research":
        from app.models.research import ResearchIdentityLink, ResearchParticipant
        link = db.scalar(
            select(ResearchIdentityLink).where(ResearchIdentityLink.user_id == user.id)
        )
        if not link:
            raise IdentityError(403, "not_research_participant", "User is not enrolled as a research participant.")
        participant = db.scalar(
            select(ResearchParticipant).where(
                ResearchParticipant.id == link.participant_id,
                ResearchParticipant.enrollment_status == "enrolled",
            )
        )
        if not participant:
            raise IdentityError(403, "participant_not_active", "Research participation is not currently active.")
        ctx = db.scalar(
            select(LearningContext).where(
                LearningContext.participant_id == participant.id,
                LearningContext.kind == "research",
            )
        )
        if not ctx:
            ctx = LearningContext(
                kind="research",
                participant_id=participant.id,
                student_id=None,
                class_id=None,
            )
            db.add(ctx)
            db.flush()
        return ctx

    raise IdentityError(422, "unsupported_context", "Unsupported learning context.")


def record_review_event(
    db,
    user: User,
    event_input: ReviewEventInput,
    algorithm_name: str = "sm2",
) -> dict:
    """Ingests a review event and updates state using the selected registered scheduler."""
    # In research context, enforce assigned scheduler condition automatically
    if event_input.context_type == "research":
        from app.models.research import ResearchIdentityLink, ResearchGroupAssignment, ResearchGroup
        link = db.scalar(select(ResearchIdentityLink).where(ResearchIdentityLink.user_id == user.id))
        if link:
            assignment = db.scalar(
                select(ResearchGroupAssignment)
                .where(ResearchGroupAssignment.participant_id == link.participant_id)
                .order_by(ResearchGroupAssignment.assignment_number.desc())
            )
            if assignment:
                group = db.scalar(select(ResearchGroup).where(ResearchGroup.id == assignment.group_id))
                if group:
                    algorithm_name = "sm2" if group.condition == "sm2_control" else "fifakt"

    scheduler = registry.get(algorithm_name)
    if scheduler is None:
        raise IdentityError(
            503,
            "algorithm_unavailable",
            f"Spaced repetition algorithm '{algorithm_name}' is not currently active.",
        )

    # Verify vocabulary item existence and lock state
    voc_item = db.scalar(select(VocabularyItem).where(VocabularyItem.id == event_input.vocabulary_item_id))
    if not voc_item:
        raise IdentityError(404, "vocabulary_item_not_found", "Vocabulary card not found.")

    # Resolve context
    context = get_or_create_learning_context(
        db, user, event_input.context_type, class_id=event_input.class_id
    )

    # Check for idempotent duplicate event submission
    existing_event = db.scalar(
        select(VocabularyReviewEvent).where(VocabularyReviewEvent.event_key == event_input.event_key)
    )
    if existing_event:
        return {
            "status": "replayed",
            "event_key": str(existing_event.event_key),
            "state_revision": existing_event.state_revision,
            "reviewed_at": existing_event.reviewed_at.isoformat(),
        }

    # Resolve or create scheduler configuration
    ident = scheduler.identity
    sched_config = db.scalar(
        select(SchedulerConfiguration).where(
            SchedulerConfiguration.algorithm == ident.algorithm,
            SchedulerConfiguration.implementation_version == ident.implementation_version,
            SchedulerConfiguration.configuration_version == ident.configuration_version,
        )
    )
    if not sched_config:
        model_config_id = None
        if getattr(scheduler, "is_simulated", False):
            from app.models.research import ModelVersion, ModelConfiguration

            model_name = ident.parameters.get("model_name", "fifakt")
            model_version = ident.parameters.get("model_version", "fifakt-simulated-v1")
            mv = db.scalar(
                select(ModelVersion).where(
                    ModelVersion.task == "knowledge_tracing",
                    ModelVersion.provider == "fluentt-internal",
                    ModelVersion.model_name == model_name,
                    ModelVersion.version == model_version,
                )
            )
            if not mv:
                mv = ModelVersion(
                    task="knowledge_tracing",
                    provider="fluentt-internal",
                    model_name=model_name,
                    version=model_version,
                    capabilities={"predict_retrievability": True, "mastery_state": True},
                    artifact_reference="simulated://internal/fifakt-v1-uncalibrated",
                    simulated=True,
                )
                db.add(mv)
                db.flush()

            mc = db.scalar(
                select(ModelConfiguration).where(
                    ModelConfiguration.model_version_id == mv.id,
                    ModelConfiguration.version == 1,
                )
            )
            if not mc:
                mc = ModelConfiguration(
                    model_version_id=mv.id,
                    version=1,
                    parameters=ident.parameters,
                )
                db.add(mc)
                db.flush()
            model_config_id = mc.id

        sched_config = SchedulerConfiguration(
            algorithm=ident.algorithm,
            implementation_version=ident.implementation_version,
            configuration_version=ident.configuration_version,
            parameters=ident.parameters,
            model_configuration_id=model_config_id,
        )
        db.add(sched_config)
        db.flush()

    # Resolve or initialize review state
    state_row = db.scalar(
        select(VocabularyReviewState).where(
            VocabularyReviewState.context_id == context.id,
            VocabularyReviewState.vocabulary_item_id == voc_item.id,
        ).with_for_update()
    )

    if state_row:
        # Prevent cross-algorithm contamination
        if state_row.scheduler_configuration_id != sched_config.id:
            raise IdentityError(
                409,
                "algorithm_conflict",
                "Card is managed under a different scheduler configuration. State cannot be overwritten.",
            )
        # Validate timestamp ordering (monotonic review history)
        if state_row.last_reviewed_at is not None and event_input.reviewed_at < state_row.last_reviewed_at:
            raise IdentityError(
                422,
                "out_of_order_review",
                f"Review timestamp {event_input.reviewed_at.isoformat()} cannot precede previous review timestamp {state_row.last_reviewed_at.isoformat()}.",
            )
    else:
        initial_state = scheduler.initial_state()
        state_row = VocabularyReviewState(
            context_id=context.id,
            vocabulary_item_id=voc_item.id,
            scheduler_configuration_id=sched_config.id,
            state=initial_state,
            due_at=event_input.reviewed_at,
            last_reviewed_at=None,
            revision=1,
        )
        db.add(state_row)
        db.flush()

    # Compute deterministic next review
    decision = scheduler.compute_next_review(
        current_state=state_row.state,
        rating=event_input.recall_rating,
        reviewed_at=event_input.reviewed_at,
        duration_ms=event_input.response_duration_ms,
        revision=state_row.revision,
    )

    # Record review event
    is_simulated = bool(getattr(scheduler, "is_simulated", False))
    review_event = VocabularyReviewEvent(
        review_state_id=state_row.id,
        scheduler_configuration_id=sched_config.id,
        event_key=event_input.event_key,
        reviewed_at=event_input.reviewed_at,
        recall_rating=event_input.recall_rating,
        answer_result={"rating": event_input.recall_rating},
        response_duration_ms=event_input.response_duration_ms,
        previous_interval_seconds=decision.previous_interval_seconds,
        resulting_interval_seconds=decision.resulting_interval_seconds,
        previous_state=decision.previous_state,
        resulting_state=decision.resulting_state,
        state_revision=state_row.revision,
        simulated=is_simulated,
    )
    db.add(review_event)

    # Advance state
    state_row.state = decision.resulting_state
    state_row.due_at = decision.due_at
    state_row.last_reviewed_at = event_input.reviewed_at
    state_row.revision += 1
    db.flush()

    return {
        "status": "committed",
        "event_key": str(event_input.event_key),
        "state_revision": state_row.revision,
        "due_at": state_row.due_at.isoformat(),
        "interval_seconds": float(decision.resulting_interval_seconds),
    }


def get_due_reviews(
    db,
    user: User,
    algorithm_name: str = "sm2",
    context_type: str = "self_study",
    class_id: UUID | None = None,
    limit: int = 50,
) -> DueReviewBatch:
    if context_type == "research":
        from app.models.research import ResearchIdentityLink, ResearchGroupAssignment, ResearchGroup
        link = db.scalar(select(ResearchIdentityLink).where(ResearchIdentityLink.user_id == user.id))
        if link:
            assignment = db.scalar(
                select(ResearchGroupAssignment)
                .where(ResearchGroupAssignment.participant_id == link.participant_id)
                .order_by(ResearchGroupAssignment.assignment_number.desc())
            )
            if assignment:
                group = db.scalar(select(ResearchGroup).where(ResearchGroup.id == assignment.group_id))
                if group:
                    algorithm_name = "sm2" if group.condition == "sm2_control" else "fifakt"

    now = datetime.now(timezone.utc)
    if not registry.is_available(algorithm_name):
        return DueReviewBatch(
            items=[],
            total_due=0,
            algorithm=algorithm_name,
            as_of=now,
        )

    context = get_or_create_learning_context(db, user, context_type, class_id=class_id)

    stmt = (
        select(VocabularyReviewState, VocabularyItem)
        .join(VocabularyItem, VocabularyItem.id == VocabularyReviewState.vocabulary_item_id)
        .join(SchedulerConfiguration, SchedulerConfiguration.id == VocabularyReviewState.scheduler_configuration_id)
        .where(
            VocabularyReviewState.context_id == context.id,
            SchedulerConfiguration.algorithm == algorithm_name.lower(),
            VocabularyReviewState.due_at <= now,
        )
        .order_by(VocabularyReviewState.due_at.asc())
        .limit(limit)
    )

    rows = db.execute(stmt).all()
    items = []
    for state, voc in rows:
        overdue = (now - state.due_at).total_seconds() if state.due_at < now else 0.0
        items.append(
            DueReviewItem(
                review_state_id=state.id,
                vocabulary_item_id=voc.id,
                term=voc.term,
                meaning=voc.meaning,
                language=voc.language,
                due_at=state.due_at,
                last_reviewed_at=state.last_reviewed_at,
                overdue_seconds=overdue,
            )
        )

    return DueReviewBatch(
        items=items,
        total_due=len(items),
        algorithm=algorithm_name,
        as_of=now,
    )
