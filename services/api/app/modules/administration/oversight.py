"""Explicitly granted administrator school oversight; no personal/research outcomes."""

import csv
import hashlib
import io
import json
import math
from datetime import datetime, timezone
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, StrictBool
from sqlalchemy import select, text, update
from sqlalchemy.exc import OperationalError

from app.models.operations import AuditLog
from app.models.users import User, UserSession
from app.modules.administration.repository import AdminRepository
from app.modules.administration.router import credential, origin_required
from app.modules.administration.service import resolve_session
from app.modules.curriculum.router import get_admin_repository
from app.modules.identity.dependencies import require_secure_transport
from app.modules.identity.errors import IdentityError
from app.modules.spaced_repetition.registry import registry

View = Literal["summary", "users", "classes", "classwork", "algorithms", "speech", "audit", "settings"]
PERMISSIONS = {
    "summary": "oversight.read",
    "users": "users.read",
    "classes": "classrooms.read",
    "classwork": "classrooms.read",
    "algorithms": "algorithms.read",
    "speech": "speech.read",
    "audit": "audit.read",
    "settings": "dashboard.view",
}

ELIGIBLE = """FROM class_memberships m JOIN users s ON s.id=m.student_id
 JOIN classes c ON c.id=m.class_id JOIN users t ON t.id=c.instructor_id
 WHERE m.status='active' AND m.ended_at IS NULL AND s.role='school_student'
 AND s.profile_status='active' AND s.archived_at IS NULL AND c.status='active'
 AND c.archived_at IS NULL AND t.role='instructor' AND t.profile_status='active' AND t.archived_at IS NULL"""
SUMMARY_SQL = text(
    """SELECT
 (SELECT count(*) FROM users WHERE role='school_student' AND profile_status='active' AND archived_at IS NULL) AS active_students,
 (SELECT count(*) FROM users WHERE role='instructor' AND profile_status='active' AND archived_at IS NULL) AS active_instructors,
 (SELECT count(*) FROM classes c JOIN users t ON t.id=c.instructor_id WHERE c.status='active' AND c.archived_at IS NULL AND t.role='instructor' AND t.profile_status='active' AND t.archived_at IS NULL) AS active_classes,
 (SELECT count(DISTINCT s.id) """
    + ELIGIBLE
    + """) AS enrolled_students,
 (SELECT count(*) """
    + ELIGIBLE
    + """) AS eligible_memberships"""
)


def fail(status, code, message):
    raise IdentityError(status, code, message)


def revision(user):
    return hashlib.sha256(
        json.dumps([str(user.id), user.role, user.profile_status, str(user.updated_at), str(user.archived_at)]).encode()
    ).hexdigest()


def user_dto(user):
    return {
        "id": str(user.id),
        "username": user.username,
        "role": user.role,
        "status": user.profile_status,
        "revision": revision(user),
    }


def public_parameters(values):
    """Explicit numeric scheduling metadata, never paths, tokens or arbitrary model configuration."""
    allowed = {
        "weights",
        "desired_retention",
        "maximum_interval_days",
        "max_interval_days",
        "fusion_sensitivity",
        "adjustment_min",
        "adjustment_max",
    }
    result = {}
    for key in allowed:
        value = values.get(key)
        if type(value) in (int, float) and math.isfinite(value):
            result[key] = value
        elif (
            key == "weights"
            and isinstance(value, list)
            and len(value) <= 100
            and all(type(item) in (int, float) and math.isfinite(item) for item in value)
        ):
            result[key] = value
    return result


class Page(BaseModel):
    view: View
    metric_version: str = "admin-school-oversight-v1"
    as_of: datetime
    items: list[dict[str, Any]]
    offset: int
    has_more: bool
    summary: dict[str, Any] = {}


def page(db, view, *, q="", role="", status="", class_id=None, offset=0, limit=20, settings=None):
    now = datetime.now(timezone.utc)
    params = {
        "q": "%" + q.strip().replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%",
        "role": role,
        "status": status,
        "class_id": class_id,
        "offset": offset,
        "limit": limit + 1,
    }
    summary = {}
    if view == "summary":
        summary = dict(db.execute(SUMMARY_SQL).mappings().one())
        rows = [{"metric": key, "count": value} for key, value in summary.items()]
    elif view == "users":
        users = db.scalars(
            select(User)
            .where(
                User.role.in_(["school_student", "instructor"]),
                User.archived_at.is_(None),
                User.username.ilike(params["q"], escape="!"),
                *([User.role == role] if role else []),
                *([User.profile_status == status] if status else []),
            )
            .order_by(User.canonical_username, User.id)
            .offset(offset)
            .limit(limit + 1)
        ).all()
        rows = [user_dto(user) for user in users]
    elif view == "classes":
        rows = [
            dict(row)
            for row in db.execute(
                text(
                    """SELECT c.id::text AS id, c.class_name AS name,
        t.username AS instructor, c.instructor_id::text AS instructor_id, c.status, c.language,
        g.number AS grade, s.name AS subject,
        (SELECT count(*) """
                    + ELIGIBLE
                    + " AND c.id=outer_class.id) AS eligible_memberships "
                    ""
                    + """
        FROM classes outer_class JOIN classes c ON c.id=outer_class.id JOIN users t ON t.id=c.instructor_id
        JOIN grade_levels g ON g.id=c.grade_level_id LEFT JOIN subjects s ON s.id=c.subject_id
        WHERE t.role='instructor' AND (c.class_name ILIKE :q ESCAPE '!' OR t.username ILIKE :q ESCAPE '!')
        ORDER BY c.class_name,c.id LIMIT :limit OFFSET :offset"""
                ),
                params,
            ).mappings()
        ]
    elif view == "classwork":
        if class_id is None:
            fail(422, "class_required", "Select a classroom first.")
        # Metadata only; no instructions, questions, keys, response bodies or grades.
        rows = [
            dict(row)
            for row in db.execute(
                text(
                    """SELECT a.id::text AS id, a.class_id::text AS class_id,
        v.id::text AS version_id, v.title, a.status, v.version,
        v.curriculum_snapshot->'context'->>'lesson_name' AS lesson,
        (SELECT count(*) FROM assignment_questions aq WHERE aq.assignment_version_id=v.id) AS question_count,
        (SELECT count(*) FROM assignment_attempts x
         WHERE x.assignment_version_id=v.id AND x.capture_contract='unscored-capture-v1' AND x.attempt_number=1
         AND x.submitted_at IS NOT NULL AND x.student_id IN (SELECT s.id """
                    + ELIGIBLE
                    + """ AND c.id=a.class_id)) AS submitted_captures
        FROM assignments a JOIN assignment_versions v ON v.assignment_id=a.id
        JOIN classes c ON c.id=a.class_id JOIN users t ON t.id=c.instructor_id
        WHERE a.class_id=:class_id AND t.role='instructor'
        ORDER BY v.created_at DESC,v.id LIMIT :limit OFFSET :offset"""
                ),
                params,
            ).mappings()
        ]
    elif view == "algorithms":
        rows = [
            dict(row)
            for row in db.execute(
                text("""SELECT s.id::text AS id, s.algorithm,
        s.implementation_version, s.configuration_version, s.parameters, s.model_configuration_id::text AS model_configuration_id,
        m.simulated AS model_simulated FROM scheduler_configurations s
        LEFT JOIN model_configurations c ON c.id=s.model_configuration_id
        LEFT JOIN model_versions m ON m.id=c.model_version_id
        ORDER BY s.algorithm,s.configuration_version DESC,s.id LIMIT :limit OFFSET :offset"""),
                params,
            ).mappings()
        ]
        for row in rows:
            row["parameters"] = public_parameters(row["parameters"])
            adapter = registry.get(row["algorithm"])
            row["registered"] = adapter is not None
            row["runtime_identity"] = adapter.identity.model_dump(mode="json") if adapter else None
            row["research_ready"] = False
        summary = {
            "registered": registry.list_available(),
            "fsrs6_runtime": registry.get("fsrs6").identity.model_dump(mode="json"),
            "hybrid": "SIMULATED — no trained FIFAKT treatment is ready",
            "research_binding": "Existing managed research uses sm2_control, not the proposed FSRS-6 control.",
            "configuration_editing": "Read-only; active/historical configurations are not overwritten.",
        }
    elif view == "speech":
        rows = [
            dict(row)
            for row in db.execute(
                text(
                    """SELECT p.scoring_status,
        p.simulated OR coalesce((p.result->'assessment'->>'simulated')='true',false) AS simulated,
        p.evaluator_configuration_id::text AS evaluator_configuration_id, count(*) AS attempt_count
        FROM pronunciation_attempts p JOIN learning_contexts lc ON lc.id=p.context_id
        WHERE lc.kind='classroom' AND lc.student_id IN (SELECT s.id """
                    + ELIGIBLE
                    + """ AND c.id=lc.class_id)
        GROUP BY p.scoring_status,2,p.evaluator_configuration_id
        ORDER BY p.scoring_status,2,p.evaluator_configuration_id NULLS FIRST LIMIT :limit OFFSET :offset"""
                ),
                params,
            ).mappings()
        ]
        summary = {
            "scope": "current eligible ordinary classroom contexts only",
            "verified_score_average": None,
            "reason": "Stored simulation flags are provenance, not validation. No verified acoustic aggregate is available.",
            "azure_configured": bool(
                settings
                and settings.pronunciation_azure_enabled
                and settings.pronunciation_azure_key
                and settings.pronunciation_azure_resource
            ),
        }
    elif view == "audit":
        records = db.scalars(
            select(AuditLog)
            .where(AuditLog.entity_type.in_(["admin_auth", "admin_oversight"]))
            .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
            .offset(offset)
            .limit(limit + 1)
        ).all()
        rows = [
            {
                "id": str(row.id),
                "action": row.action,
                "entity_type": row.entity_type,
                "occurred_at": row.occurred_at.isoformat(),
                "actor_id": str(row.actor_id) if row.actor_id else None,
                "entity_id": str(row.entity_id) if row.entity_id else None,
            }
            for row in records
        ]
        summary = {
            "scope": "administrator authentication, operator permission and oversight events; no private content metadata"
        }
    else:
        rows = [
            {"setting": "Administrator OIDC/MFA configured", "value": bool(settings and settings.admin_oidc_enabled)},
            {"setting": "Database read successful", "value": db.execute(text("SELECT 1")).scalar() == 1},
            {"setting": "Personal learning", "value": "Excluded from new school oversight/lifecycle operations"},
            {
                "setting": "ISO/IEC quality framework",
                "value": "2011 edition referenced by supplied thesis plan; no certification claimed",
            },
        ]
    return Page(view=view, as_of=now, items=rows[:limit], has_more=len(rows) > limit, offset=offset, summary=summary)


class StatusChange(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    status: Literal["active", "disabled"]
    confirm: StrictBool


def change_status(repo, actor, target_id, body, expected, key):
    if body.confirm is not True:
        fail(422, "confirmation_required", "Confirm the account status change.")
    fingerprint = hashlib.sha256(f"{target_id}:{body.status}".encode()).hexdigest()
    prior = repo.session.scalar(select(AuditLog).where(AuditLog.actor_id == actor.id, AuditLog.request_id == key))
    if prior:
        if prior.action != "admin.school_user_status_changed" or prior.safe_metadata.get("fingerprint") != fingerprint:
            fail(409, "retry_conflict", "This retry identity was already used for another operation.")
        return prior.safe_metadata["receipt"]
    try:
        user = repo.session.scalar(
            select(User)
            .where(User.id == target_id)
            .with_for_update(nowait=True)
            .execution_options(populate_existing=True)
        )
    except OperationalError:
        fail(409, "user_busy", "The account is busy. Retry after refreshing.")
    if not user or user.role not in {"school_student", "instructor"} or user.archived_at is not None:
        fail(404, "user_unavailable", "School account unavailable.")
    if expected is None:
        fail(428, "freshness_required", "Reload this account before making changes.")
    if expected != revision(user):
        fail(409, "stale_account", "Account changed. Reload before making changes.")
    if user.profile_status not in {"active", "disabled"}:
        fail(409, "onboarding_required", "Administrator activation cannot replace the normal onboarding process.")
    now = datetime.now(timezone.utc)
    user.profile_status = body.status
    if body.status == "disabled":
        repo.session.execute(
            update(UserSession)
            .where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
            .values(revoked_at=now)
        )
    repo.session.flush()
    repo.session.refresh(user)
    receipt = user_dto(user)
    repo.session.add(
        AuditLog(
            actor_id=actor.id,
            action="admin.school_user_status_changed",
            entity_type="admin_oversight",
            entity_id=user.id,
            occurred_at=now,
            request_id=key,
            safe_metadata={"fingerprint": fingerprint, "receipt": receipt},
        )
    )
    return receipt


router = APIRouter(
    prefix="/admin/oversight", tags=["administrator oversight"], dependencies=[Depends(require_secure_transport)]
)
Repo = Annotated[AdminRepository, Depends(get_admin_repository)]
Token = Annotated[str, Depends(credential)]


@router.get("/summary.csv")
def export_summary(repo: Repo, token: Token):
    def export(actor):
        values = page(repo.session, "summary")
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(["metric_version", "as_of_utc", "metric", "count"])
        for item in values.items:
            writer.writerow([values.metric_version, values.as_of.isoformat(), item["metric"], item["count"]])
        repo.session.add(
            AuditLog(
                actor_id=actor.id,
                action="admin.operational_summary_exported",
                entity_type="admin_oversight",
                occurred_at=values.as_of,
                safe_metadata={"dataset": "school-current-counts-v1"},
            )
        )
        return output.getvalue()

    data = resolve_session(
        repo,
        token,
        required_permission="oversight.export",
        additional_permissions=("oversight.read",),
        read_operation=export,
    )
    return Response(
        data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="fluentt-school-summary.csv"'},
    )


@router.get("/{view}", response_model=Page)
def overview(
    view: View,
    request: Request,
    repo: Repo,
    token: Token,
    q: str = Query("", max_length=100),
    role: Literal["", "school_student", "instructor"] = "",
    status: Literal["", "active", "disabled", "onboarding"] = "",
    class_id: UUID | None = None,
    offset: int = Query(0, ge=0, le=100000),
    limit: int = Query(20, ge=1, le=50),
):
    return resolve_session(
        repo,
        token,
        required_permission=PERMISSIONS[view],
        read_operation=lambda _: page(
            repo.session,
            view,
            q=q,
            role=role,
            status=status,
            class_id=class_id,
            offset=offset,
            limit=limit,
            settings=request.app.state.settings,
        ),
    )


@router.post("/users/{target_id}/status", dependencies=[Depends(origin_required)])
def user_status(
    target_id: UUID,
    body: StatusChange,
    repo: Repo,
    token: Token,
    key: Annotated[UUID, Header(alias="Idempotency-Key")],
    csrf: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
    expected: Annotated[str | None, Header(alias="If-Match")] = None,
):
    return resolve_session(
        repo,
        token,
        csrf=csrf,
        required_permission="users.write",
        additional_permissions=("users.read",),
        mutation_operation=lambda actor: change_status(repo, actor, target_id, body, expected, key),
    )
