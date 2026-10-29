"""Research-classroom configuration, never a scheduler/progress/assessment writer."""

import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import select, text, func
from sqlalchemy.exc import OperationalError
from app.models.users import User, Classroom, ClassMembership
from app.models.research import (
    ResearchStudy,
    ResearchAssessment,
    SchedulerConfiguration,
    ModelConfiguration,
    ModelVersion,
)
from app.models.research_classrooms import (
    ResearchClassroomStudy as Scope,
    ResearchClassroomProtocol as Protocol,
    ResearchClassroomBinding as Binding,
    ResearchClassroomAssessment as AssessmentRef,
    ResearchClassroomClearance as Clearance,
    ResearchClassroomEvent as Event,
)
from app.modules.identity.errors import IdentityError
from app.modules.administration.service import resolve_session
from .classroom_schemas import (
    ProtocolConfiguration,
    CreateClassroomStudy,
    StudyOverview,
    StudyPage,
    BindingPage,
    BindingOverview,
    ClassMode,
)
from .assessment_draft_service import STAGE_KINDS, publication_status

CONTRACT = "research-classrooms-v1"
CLEARANCE_KINDS = ("protocol", "ethics", "site_permission", "instruments", "conditions")
EDGES = {
    "DRAFT": {"READY"},
    "READY": {"ACTIVE", "COMPLETED"},
    "ACTIVE": {"PAUSED", "COMPLETED"},
    "PAUSED": {"ACTIVE", "COMPLETED"},
    "COMPLETED": set(),
}


def fail(code, message, status=409):
    return IdentityError(status, code, message)


def fingerprint(operation, target, payload):
    value = json.dumps([operation, str(target), payload], sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def configuration_data(config):
    # Preserve Prompt 02 replay hashes: an absent optional UI proposal is not a change.
    data = config.model_dump(mode="json")
    for name in ("administrator_setup", "assessment_delivery_draft"):
        if data.get(name) is None:
            data.pop(name, None)
    return data


def class_permission(class_id, access):
    return f"research.classroom.{class_id}.{access}"


def etag(scope):
    return f'"{scope.id}:{scope.revision}"'


def _fresh(scope, revision):
    if revision is None:
        raise fail("revision_required", "If-Match is required.", 428)
    if revision != etag(scope):
        raise fail("revision_conflict", "Configuration changed. Refresh before editing.", 412)


def _scope(db, actor, scope_id, *, lock=False):
    query = select(Scope).where(Scope.id == scope_id, Scope.manager_id == actor.id)
    if lock:
        query = query.with_for_update()
    row = db.scalar(query.execution_options(populate_existing=True))
    if row is None:
        raise fail("research_study_not_found", "Research configuration not found.", 404)
    return row


def _replay(db, actor, request_id, digest):
    row = db.scalar(select(Event).where(Event.actor_id == actor.id, Event.request_id == request_id))
    if row:
        if row.request_fingerprint != digest:
            raise fail("idempotency_conflict", "This request identity was used for a different operation.")
        return row.response_snapshot


def _event(repo, actor, scope, request_id, operation, digest, response, binding_id=None):
    repo.session.add(
        Event(
            scope_id=scope.id,
            study_id=scope.study_id,
            protocol_id=scope.current_protocol_id,
            binding_id=binding_id,
            actor_id=actor.id,
            request_id=request_id,
            operation=operation,
            request_fingerprint=digest,
            response_snapshot=response,
        )
    )
    repo.audit(
        "research.classroom." + operation,
        datetime.now(timezone.utc),
        actor=actor.id,
        entity=scope.id,
        request_id=str(request_id),
    )
    repo.session.flush()
    return response


def _classes(db, class_ids):
    ids = sorted(set(class_ids))
    if not ids:
        return {}
    hints = dict(db.execute(select(Classroom.id, Classroom.instructor_id).where(Classroom.id.in_(ids))).all())
    if len(hints) != len(ids):
        raise fail("class_not_found", "Classroom not found.", 404)
    try:
        owners = {
            row.id: row
            for row in db.scalars(
                select(User)
                .where(User.id.in_(sorted(set(hints.values()))))
                .order_by(User.id)
                .with_for_update(read=True, nowait=True)
                .execution_options(populate_existing=True)
            ).all()
        }
    except OperationalError as error:
        if getattr(error.orig, "sqlstate", None) == "55P03":
            raise fail("research_context_busy", "Classroom authorization is busy. Retry.") from error
        raise
    classes = {
        row.id: row
        for row in db.scalars(
            select(Classroom)
            .where(Classroom.id.in_(ids))
            .order_by(Classroom.id)
            .with_for_update(read=True)
            .execution_options(populate_existing=True)
        ).all()
    }
    for class_id in ids:
        classroom = classes.get(class_id)
        owner = owners.get(hints[class_id])
        if (
            not classroom
            or classroom.instructor_id != hints[class_id]
            or classroom.status != "active"
            or classroom.archived_at is not None
            or not owner
            or owner.role != "instructor"
            or owner.profile_status != "active"
            or owner.archived_at is not None
        ):
            raise fail("class_not_found", "Classroom not found.", 404)
    return classes


def _class(db, class_id):
    return _classes(db, [class_id])[class_id]


def _references(db, scope, config):
    # Same shared content boundary as existing immutable instrument/configuration writers.
    db.execute(text("SELECT pg_advisory_xact_lock_shared(78090001)"))
    for item in config.conditions:
        scheduler = db.get(SchedulerConfiguration, item.scheduler_configuration_id)
        expected = "sm2" if item.condition == "sm2_control" else "fifakt"
        if scheduler is None or scheduler.algorithm != expected:
            raise fail(
                "condition_configuration_invalid", "Condition must reference its existing versioned scheduler.", 422
            )
    instruments = {}
    for item in config.assessments:
        instrument = db.scalar(
            select(ResearchAssessment).where(
                ResearchAssessment.id == item.assessment_id, ResearchAssessment.study_id == scope.study_id
            )
        )
        if instrument is None:
            raise fail("instrument_not_found", "Instrument does not belong to this study.", 404)
        if instrument.instrument_version != item.instrument_version or instrument.locked_at is None:
            raise fail("instrument_not_frozen", "Reference the exact locked instrument version.", 422)
        instruments[item.assessment_id] = instrument
    if config.assessment_delivery_draft:
        for stage, item in config.assessment_delivery_draft.stages.items():
            if item.assessment_id and instruments[item.assessment_id].kind != STAGE_KINDS[stage]:
                raise fail("assessment_stage_mismatch", "Stage must reference its matching frozen assessment type.", 422)


def _protocol(db, scope, config):
    _references(db, scope, config)
    previous = db.get(Protocol, scope.current_protocol_id) if scope.current_protocol_id else None
    study = db.get(ResearchStudy, scope.study_id)
    data = configuration_data(config)
    row = Protocol(
        id=uuid4(),
        scope_id=scope.id,
        study_id=scope.study_id,
        version=previous.version + 1 if previous else 1,
        protocol_version=study.protocol_version,
        configuration=data,
        fingerprint=fingerprint("protocol", study.id, data),
    )
    db.add(row)
    db.flush()
    for item in config.assessments:
        db.add(AssessmentRef(study_id=scope.study_id, protocol_id=row.id, **item.model_dump()))
    scope.current_protocol_id = row.id
    return row


def blockers(db, scope, protocol):
    config = ProtocolConfiguration.model_validate(protocol.configuration)
    missing = []
    for name in (
        "protocol_reference",
        "starts_at",
        "ends_at",
        "timezone",
        "active_weekdays",
        "due_date_policy",
        "consent_document_version",
        "consent_requirements",
        "allocation_unit",
        "allocation_policy",
        "conditions",
        "assessments",
    ):
        if not getattr(config, name):
            missing.append("configuration_missing:" + name)
    latest = {}
    for item in db.scalars(
        select(Clearance)
        .where(Clearance.protocol_id == protocol.id)
        .distinct(Clearance.kind)
        .order_by(Clearance.kind, Clearance.sequence.desc())
    ).all():
        latest.setdefault(item.kind, item.status)
    for kind in CLEARANCE_KINDS:
        if latest.get(kind) != "verified":
            missing.append("verified_authorization_missing:" + kind)
    for item in config.assessments:
        if item.opens_at is None or item.closes_at is None or item.timer_limit_seconds is None:
            missing.append("assessment_window_or_timer_missing:" + str(item.assessment_id))
    for item in config.conditions:
        scheduler = db.get(SchedulerConfiguration, item.scheduler_configuration_id)
        if not scheduler:
            missing.append("condition_configuration_missing")
        elif scheduler.algorithm == "sm2" and scheduler.implementation_version != "sm2-classic-v1":
            missing.append("condition_implementation_unavailable")
        elif scheduler.algorithm == "fifakt":
            # Installed ESR adapter still uses simulated inference, irrespective of DB labels.
            missing.append("condition_implementation_simulated")
            model = (
                db.get(ModelConfiguration, scheduler.model_configuration_id)
                if scheduler.model_configuration_id
                else None
            )
            version = db.get(ModelVersion, model.model_version_id) if model else None
            if not version or version.simulated or not version.artifact_reference:
                missing.append("condition_model_unvalidated")
    if not db.scalar(select(Binding.id).where(Binding.scope_id == scope.id).limit(1)):
        missing.append("designated_classroom_missing")
    return missing


def describe(db, scope):
    study = db.get(ResearchStudy, scope.study_id)
    protocol = db.get(Protocol, scope.current_protocol_id)
    return StudyOverview(
        id=scope.id,
        study_id=study.id,
        code=study.code,
        title=study.title,
        language=study.target_language,
        protocol_version=protocol.protocol_version,
        target_participants=study.target_participants,
        status=scope.status,
        revision=etag(scope),
        protocol_id=protocol.id,
        configuration_version=protocol.version,
        configuration_fingerprint=protocol.fingerprint,
        configuration=protocol.configuration,
        activation_blockers=blockers(db, scope, protocol),
        assessment_publication=publication_status(ProtocolConfiguration.model_validate(protocol.configuration)),
    ).model_dump(mode="json")


def create_study(repo, token, csrf, request_id, payload: CreateClassroomStudy):
    identity = payload.model_dump(mode="json")
    identity["configuration"] = configuration_data(payload.configuration)
    digest = fingerprint("create", "studies", identity)

    def operation(actor):
        replay = _replay(repo.session, actor, request_id, digest)
        if replay is not None:
            return replay
        db = repo.session
        if db.scalar(select(ResearchStudy.id).where(ResearchStudy.code == payload.code)):
            raise fail("study_code_conflict", "Study code is already retained.")
        study = ResearchStudy(
            id=uuid4(),
            code=payload.code,
            title=payload.title,
            target_language=payload.language,
            protocol_version=payload.protocol_version,
            target_participants=payload.target_participants,
            status="draft",
            conditions={"research_contract": CONTRACT},
        )
        db.add(study)
        db.flush()
        scope = Scope(id=uuid4(), study_id=study.id, manager_id=actor.id, status="DRAFT", revision=1)
        db.add(scope)
        db.flush()
        _protocol(db, scope, payload.configuration)
        return _event(repo, actor, scope, request_id, "created", digest, describe(db, scope))

    return resolve_session(
        repo,
        token,
        csrf=csrf,
        required_permission="research.manage",
        additional_permissions=("research.read",),
        mutation_operation=operation,
    )


def read_study(repo, token, scope_id):
    return resolve_session(
        repo,
        token,
        required_permission="research.read",
        read_operation=lambda actor: describe(repo.session, _scope(repo.session, actor, scope_id)),
    )


def list_studies(repo, token, limit, offset):
    def operation(actor):
        rows = list(
            repo.session.scalars(
                select(Scope)
                .where(Scope.manager_id == actor.id)
                .order_by(Scope.created_at, Scope.id)
                .limit(limit + 1)
                .offset(offset)
            ).all()
        )
        return StudyPage(
            items=[describe(repo.session, row) for row in rows[:limit]],
            limit=limit,
            offset=offset,
            has_more=len(rows) > limit,
        )

    return resolve_session(repo, token, required_permission="research.read", read_operation=operation)


def revise(repo, token, csrf, scope_id, revision, request_id, config):
    digest = fingerprint("revise", scope_id, configuration_data(config))

    def operation(actor):
        scope = _scope(repo.session, actor, scope_id, lock=True)
        replay = _replay(repo.session, actor, request_id, digest)
        if replay is not None:
            return replay
        _fresh(scope, revision)
        if scope.status != "DRAFT":
            raise fail(
                "protocol_frozen",
                "Only DRAFT configuration can receive a new revision. Create a new study for a changed active protocol.",
            )
        _protocol(repo.session, scope, config)
        scope.revision += 1
        return _event(repo, actor, scope, request_id, "revised", digest, describe(repo.session, scope))

    return resolve_session(
        repo,
        token,
        csrf=csrf,
        required_permission="research.manage",
        additional_permissions=("research.read",),
        mutation_operation=operation,
    )


def _class_grant(repo, actor, class_id, *, write=False):
    permissions = repo.permissions(actor.id)
    if class_permission(class_id, "manage") not in permissions and (
        write or class_permission(class_id, "read") not in permissions
    ):
        raise fail("class_not_found", "Classroom research permission is required.", 404)


def bind(repo, token, csrf, scope_id, revision, request_id, class_id):
    digest = fingerprint("bind", scope_id, str(class_id))

    def operation(actor):
        _class_grant(repo, actor, class_id, write=True)
        classroom = _class(repo.session, class_id)
        scope = _scope(repo.session, actor, scope_id, lock=True)
        replay = _replay(repo.session, actor, request_id, digest)
        if replay is not None:
            return replay
        _fresh(scope, revision)
        if scope.status != "DRAFT":
            raise fail("protocol_frozen", "Class designations are frozen outside DRAFT.")
        study = repo.session.get(ResearchStudy, scope.study_id)
        if classroom.language != study.target_language:
            raise fail("class_language_mismatch", "Study and designated classroom languages must match.", 422)
        existing = repo.session.scalar(
            select(Binding).where(Binding.scope_id == scope.id, Binding.class_id == class_id)
        )
        if existing:
            raise fail("class_already_designated", "Classroom is already designated for this study.")
        if repo.session.scalar(select(func.count()).select_from(Binding).where(Binding.scope_id == scope.id)) >= 100:
            raise fail(
                "binding_configuration_limit",
                "This configuration has reached its supported classroom-binding limit.",
                422,
            )
        binding = Binding(id=uuid4(), scope_id=scope.id, study_id=scope.study_id, class_id=class_id)
        repo.session.add(binding)
        scope.revision += 1
        repo.session.flush()
        response = BindingOverview(
            id=binding.id, scope_id=scope.id, study_id=scope.study_id, class_id=class_id
        ).model_dump(mode="json")
        return _event(repo, actor, scope, request_id, "designated", digest, response, binding.id)

    return resolve_session(
        repo,
        token,
        csrf=csrf,
        required_permission="research.manage",
        additional_permissions=("research.read",),
        mutation_operation=operation,
    )


def list_bindings(repo, token, scope_id, limit, offset):
    def operation(actor):
        scope = _scope(repo.session, actor, scope_id)
        permissions = repo.permissions(actor.id)
        rows = list(
            repo.session.scalars(
                select(Binding)
                .where(Binding.scope_id == scope.id)
                .order_by(Binding.created_at, Binding.id)
                .limit(limit + 1)
                .offset(offset)
            ).all()
        )
        # Page before ordinary class/owner lookups. No hidden class IDs are returned.
        visible = []
        for row in rows[:limit]:
            if (
                class_permission(row.class_id, "read") in permissions
                or class_permission(row.class_id, "manage") in permissions
            ):
                visible.append(row)
        _classes(repo.session, [row.class_id for row in visible])
        result = [
            BindingOverview(id=row.id, study_id=row.study_id, scope_id=row.scope_id, class_id=row.class_id)
            for row in visible
        ]
        return BindingPage(items=result, limit=limit, offset=offset, has_more=len(rows) > limit)

    return resolve_session(repo, token, required_permission="research.read", read_operation=operation)


def transition(repo, token, csrf, scope_id, revision, request_id, status):
    digest = fingerprint("transition", scope_id, status)

    def operation(actor):
        scope = _scope(repo.session, actor, scope_id, lock=True)
        replay = _replay(repo.session, actor, request_id, digest)
        if replay is not None:
            return replay
        _fresh(scope, revision)
        if status not in EDGES[scope.status]:
            raise fail("invalid_study_transition", "This study state transition is not allowed.")
        if status in ("READY", "ACTIVE"):
            protocol = repo.session.get(Protocol, scope.current_protocol_id)
            missing = blockers(repo.session, scope, protocol)
            if missing:
                raise IdentityError(
                    409,
                    "research_activation_blocked",
                    "Verified protocol, ethics, permission and configuration are required. See the authorized study overview for blockers.",
                )
            # Exact class-level grants, live owners/classes and frozen instruments are rechecked on activation.
            bindings = repo.session.scalars(
                select(Binding).where(Binding.scope_id == scope.id).order_by(Binding.class_id).limit(101)
            ).all()
            if len(bindings) > 100:
                raise fail("binding_configuration_limit", "Configuration needs operator review.")
            for row in bindings:
                _class_grant(repo, actor, row.class_id, write=True)
            _classes(repo.session, [row.class_id for row in bindings])
            _references(repo.session, scope, ProtocolConfiguration.model_validate(protocol.configuration))
        scope.status = status
        scope.revision += 1
        return _event(repo, actor, scope, request_id, "state_changed", digest, describe(repo.session, scope))

    return resolve_session(
        repo,
        token,
        csrf=csrf,
        required_permission="research.manage",
        additional_permissions=("research.read",),
        mutation_operation=operation,
    )


def protocol_history(repo, token, scope_id, limit, offset):
    def operation(actor):
        scope = _scope(repo.session, actor, scope_id)
        rows = repo.session.scalars(
            select(Protocol)
            .where(Protocol.scope_id == scope.id)
            .order_by(Protocol.version.desc())
            .limit(limit + 1)
            .offset(offset)
        ).all()
        return {
            "items": [
                {
                    "id": str(row.id),
                    "version": row.version,
                    "protocol_version": row.protocol_version,
                    "fingerprint": row.fingerprint,
                    "configuration": row.configuration,
                }
                for row in rows[:limit]
            ],
            "offset": offset,
            "limit": limit,
            "has_more": len(rows) > limit,
        }

    return resolve_session(repo, token, required_permission="research.read", read_operation=operation)


def class_mode(db, user, class_id, limit, offset):
    if user.role not in ("school_student", "instructor") or user.profile_status != "active":
        raise fail("classroom_role_required", "A current school classroom role is required.", 403)
    classroom = _class(db, class_id)
    if user.role == "instructor":
        if classroom.instructor_id != user.id:
            raise fail("class_not_found", "Classroom not found.", 404)
    else:
        membership = db.scalar(
            select(ClassMembership)
            .where(
                ClassMembership.class_id == class_id,
                ClassMembership.student_id == user.id,
                ClassMembership.status == "active",
                ClassMembership.ended_at.is_(None),
            )
            .with_for_update(read=True)
            .execution_options(populate_existing=True)
        )
        if membership is None:
            raise fail("class_not_found", "Classroom not found.", 404)
    rows = list(
        db.execute(
            select(Binding, Scope)
            .join(Scope, Scope.id == Binding.scope_id)
            .where(Binding.class_id == class_id)
            .order_by(Binding.created_at, Binding.id)
            .limit(limit + 1)
            .offset(offset)
        ).all()
    )
    designated = (
        bool(rows)
        if offset == 0
        else db.scalar(select(Binding.id).where(Binding.class_id == class_id).limit(1)) is not None
    )
    return ClassMode(
        class_id=class_id,
        mode="research" if designated else "normal",
        limit=limit,
        offset=offset,
        has_more=len(rows) > limit,
        studies=[
            {
                "research_classroom_id": str(binding.id),
                "study_id": str(scope.study_id),
                "status": scope.status,
                "participation_authorized": False,
                "assessment_publication_status": "BLOCKED",
            }
            for binding, scope in rows[:limit]
        ],
    )


def setup_choices(repo, token, scope_id, kind, limit, offset):
    """Bounded, key-free configuration selectors; never seed content/configuration."""

    def operation(actor):
        db = repo.session
        scope = _scope(db, actor, scope_id)
        study = db.get(ResearchStudy, scope.study_id)
        if kind == "classrooms":
            from uuid import UUID

            granted = []
            for code in repo.permissions(actor.id):
                parts = code.split(".")
                if len(parts) == 4 and parts[:2] == ["research", "classroom"] and parts[3] == "manage":
                    try:
                        granted.append(UUID(parts[2]))
                    except ValueError:
                        pass
            query = (
                select(Classroom)
                .join(User, User.id == Classroom.instructor_id)
                .where(
                    Classroom.id.in_(granted),
                    Classroom.language == study.target_language,
                    Classroom.status == "active",
                    Classroom.archived_at.is_(None),
                    User.role == "instructor",
                    User.profile_status == "active",
                    User.archived_at.is_(None),
                )
                .order_by(Classroom.class_name, Classroom.id)
                .limit(limit + 1)
                .offset(offset)
            )
            rows = list(db.scalars(query).all())
            locked = _classes(db, [r.id for r in rows[:limit]])
            items = [
                {"id": str(r.id), "label": r.class_name, "language": r.language} for r in rows[:limit] if r.id in locked
            ]
        elif kind == "instruments":
            db.execute(text("SELECT pg_advisory_xact_lock_shared(78090001)"))
            rows = list(
                db.scalars(
                    select(ResearchAssessment)
                    .where(ResearchAssessment.study_id == scope.study_id, ResearchAssessment.locked_at.is_not(None))
                    .order_by(ResearchAssessment.created_at, ResearchAssessment.id)
                    .limit(limit + 1)
                    .offset(offset)
                ).all()
            )
            items = [
                {"id": str(r.id), "label": r.kind, "instrument_version": r.instrument_version} for r in rows[:limit]
            ]
        else:
            rows = list(
                db.scalars(
                    select(SchedulerConfiguration)
                    .where(SchedulerConfiguration.algorithm.in_(["sm2", "fifakt"]))
                    .order_by(SchedulerConfiguration.algorithm, SchedulerConfiguration.id)
                    .limit(limit + 1)
                    .offset(offset)
                ).all()
            )
            items = [
                {
                    "id": str(r.id),
                    "label": r.algorithm,
                    "implementation_version": r.implementation_version,
                    "configuration_version": r.configuration_version,
                    "selectable": r.algorithm == "sm2" and r.implementation_version == "sm2-classic-v1",
                    "condition": "sm2_control" if r.algorithm == "sm2" else "esr_experimental",
                    "reason": "Implemented SM-2; protocol clearance still required"
                    if r.algorithm == "sm2" and r.implementation_version == "sm2-classic-v1"
                    else "Unavailable: simulated ESR or unrecognized implementation version",
                }
                for r in rows[:limit]
            ]
        return {"items": items, "limit": limit, "offset": offset, "has_more": len(rows) > limit}

    return resolve_session(repo, token, required_permission="research.read", read_operation=operation)
