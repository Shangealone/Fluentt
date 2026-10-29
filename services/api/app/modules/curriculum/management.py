"""Transactional structural authoring under live admin permissions and snapshot guards."""

import hashlib
import json
from datetime import datetime, timezone

from pydantic import ValidationError
from sqlalchemy import exists, select, text, or_
from sqlalchemy.exc import DBAPIError

from app.models.curriculum import CurriculumVersion, GradeLevel, Subject, CurriculumGrade, CurriculumSubject
from app.models.operations import AuditLog
from app.models.users import Classroom
from app.modules.administration.service import resolve_session
from app.modules.curriculum.repository import KINDS, MODELS, PARENTS, path_statement, unavailable
from app.modules.curriculum.management_schemas import FIELDS, NodeView, ManagePage
from app.modules.identity.errors import IdentityError
from app.modules.classrooms.repository import ClassroomRepository

MODELS_BY_KIND = dict(zip(KINDS, MODELS, strict=True)) | {"global-subjects": Subject}


def conflict(message="This structure changed or is protected. Reload before trying again."):
    return IdentityError(409, "curriculum_conflict", message)


def invalid(message):
    return IdentityError(422, "invalid_curriculum_change", message)


def model_for(kind):
    if kind not in MODELS_BY_KIND:
        raise unavailable()
    return MODELS_BY_KIND[kind]


def load(db, kind, node_id):
    row = db.get(model_for(kind), node_id, populate_existing=True)
    if row is None:
        raise unavailable()
    return row


def root_id(db, kind, row):
    if kind == "global-subjects":
        return None
    return db.execute(
        text("SELECT fluentt_curriculum_root(:kind,:id)"),
        {
            "kind": model_for(kind).__tablename__,
            "id": row.id,
        },
    ).scalar_one()


def tree(db, version_id):
    result = [[load(db, "versions", version_id)]]
    for depth in range(1, len(MODELS)):
        rows = db.execute(
            path_statement(depth).where(CurriculumVersion.id == version_id).execution_options(populate_existing=True)
        ).all()
        result.append([row._mapping[MODELS[depth]] for row in rows])
    return result


def frozen(db, version_id):
    return db.execute(text("SELECT fluentt_curriculum_frozen(:id)"), {"id": version_id}).scalar_one()


def subject_protected(db, subject_id):
    return bool(db.scalar(select(exists().where(Classroom.subject_id == subject_id)))) or bool(
        db.execute(
            text("""
        SELECT EXISTS(SELECT 1 FROM curriculum_subjects s JOIN curriculum_grades g ON g.id=s.curriculum_grade_id
          WHERE s.subject_id=:id AND fluentt_curriculum_frozen(g.curriculum_version_id))
    """),
            {"id": subject_id},
        ).scalar_one()
    )


def revision(db, kind, row):
    version_id = root_id(db, kind, row)
    rows = [row] if version_id is None else [item for level in tree(db, version_id) for item in level]
    # Include global labels: a shared-subject edit also invalidates an open draft form.
    if version_id:
        grade_ids = {r.grade_level_id for r in rows if isinstance(r, CurriculumGrade)}
        subject_ids = {r.subject_id for r in rows if isinstance(r, CurriculumSubject)}
        if grade_ids:
            rows += list(db.scalars(select(GradeLevel).where(GradeLevel.id.in_(grade_ids))))
        if subject_ids:
            rows += list(db.scalars(select(Subject).where(Subject.id.in_(subject_ids))))
    snapshot = sorted(
        [(r.__tablename__, str(r.id), {c.name: getattr(r, c.name) for c in r.__table__.columns}) for r in rows],
        key=lambda value: (value[0], value[1]),
    )
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True, default=str).encode()).hexdigest()


def describe(db, kind, row, cache=None):
    cache = {} if cache is None else cache
    version_id = root_id(db, kind, row)
    values = {key: getattr(row, key) for key in FIELDS[kind].model_fields if hasattr(row, key)}
    if kind == "grades":
        grade = db.get(GradeLevel, row.grade_level_id)
        values.update(number=grade.number, name=grade.name)
    if kind == "subjects":
        subject = db.get(Subject, row.subject_id)
        values.update(code=subject.code, name=subject.name, description=subject.description)
    if kind in {"versions", "topics", "lessons"}:
        values["status"] = row.status
    if kind == "versions":
        values.update(
            verification_status=row.verification_status, published_at=row.published_at, archived_at=row.archived_at
        )
    key = ("version", version_id) if version_id else ("subject", row.id)
    if key not in cache:
        cache[key] = (revision(db, kind, row), frozen(db, version_id) if version_id else subject_protected(db, row.id))
    etag, protected = cache[key]
    return NodeView(
        id=row.id,
        kind=kind,
        version_id=version_id,
        parent_id=getattr(row, PARENTS[KINDS.index(kind)]) if kind in KINDS[1:] else None,
        revision=etag,
        frozen=protected,
        values=values,
    )


def check_revision(db, kind, row, expected):
    if not expected:
        raise IdentityError(428, "curriculum_revision_required", "Reload this record before saving changes.")
    if expected.strip('"') != revision(db, kind, row):
        raise conflict("A newer change exists. Reload and review it before saving.")


def editable(db, kind, row):
    version_id = root_id(db, kind, row)
    if (version_id and frozen(db, version_id)) or (version_id is None and subject_protected(db, row.id)):
        raise conflict("Published or referenced structure is immutable. Create a new edition for corrections.")


def audit(db, user, action, kind, row, request_id):
    db.add(
        AuditLog(
            actor_id=user.id,
            action="curriculum." + action,
            entity_type=model_for(kind).__tablename__,
            entity_id=row.id,
            occurred_at=datetime.now(timezone.utc),
            request_id=request_id,
            safe_metadata={"kind": kind},
        )
    )


def values_for(kind, values, row=None):
    schema = FIELDS[kind]
    baseline = {field: getattr(row, field) for field in schema.model_fields if hasattr(row, field)} if row else {}
    if row and kind == "grades":
        # Changing an edition's grade uses a real grade number, never editable global labels.
        baseline = {}
    try:
        validated = schema.model_validate(baseline | values)
    except ValidationError:
        raise invalid(
            "Check required fields, lengths, valid codes, grade/quarter bounds and positive ordering."
        ) from None
    return validated.model_dump()


def execute(
    repo,
    admin_repo,
    token,
    *,
    action,
    kind,
    node_id=None,
    payload=None,
    expected=None,
    query=None,
    csrf=None,
    request_id=None,
):
    model_for(kind)
    db = repo.session

    def operation(user):
        write = action not in {"list", "detail"}
        db.execute(
            text("SELECT pg_advisory_xact_lock(78090001)" if write else "SELECT pg_advisory_xact_lock_shared(78090001)")
        )
        if not write:
            if action == "detail":
                return describe(db, kind, load(db, kind, node_id))
            model = model_for(kind)
            statement = select(model)
            if kind in KINDS[1:]:
                if query.parent_id is None:
                    raise invalid("Choose the parent structure first.")
                load(db, KINDS[KINDS.index(kind) - 1], query.parent_id)
                statement = statement.where(getattr(model, PARENTS[KINDS.index(kind)]) == query.parent_id)
            elif query.parent_id:
                raise invalid("This collection has no parent.")
            if query.status:
                if kind not in {"versions", "topics", "lessons"}:
                    raise invalid("This collection has no lifecycle filter.")
                statement = statement.where(model.status == query.status)
            if query.q:
                if kind == "subjects":
                    statement = statement.join(Subject).where(
                        or_(
                            Subject.name.icontains(query.q, autoescape=True),
                            Subject.code.icontains(query.q, autoescape=True),
                            Subject.description.icontains(query.q, autoescape=True),
                        )
                    )
                elif kind == "grades":
                    statement = statement.join(GradeLevel).where(GradeLevel.name.icontains(query.q, autoescape=True))
                else:
                    searchable = [
                        getattr(model, field) for field in ("name", "code", "description") if hasattr(model, field)
                    ]
                    statement = statement.where(
                        or_(*(field.icontains(query.q, autoescape=True) for field in searchable))
                    )
            order = (
                model.position
                if hasattr(model, "position")
                else model.number
                if hasattr(model, "number")
                else model.created_at
            )
            if kind == "grades":
                if not query.q:
                    statement = statement.join(GradeLevel)
                order = GradeLevel.number
            elif kind == "subjects":
                if not query.q:
                    statement = statement.join(Subject)
                order = Subject.code
            rows = list(db.scalars(statement.order_by(order, model.id).offset(query.offset).limit(query.limit + 1)))
            cache = {}  # Reuse one hierarchy fingerprint per edition within this authorized transaction.
            return ManagePage(
                items=[describe(db, kind, row, cache) for row in rows[: query.limit]],
                has_more=len(rows) > query.limit,
                limit=query.limit,
                offset=query.offset,
            )

        row = load(db, kind, node_id) if node_id else None
        if row is not None:
            check_revision(db, kind, row, expected)
        if action in {"publish", "retire"}:
            if kind != "versions":
                raise invalid("Publish and retire the whole curriculum version.")
            if action == "publish":
                editable(db, kind, row)
                if row.status != "draft":
                    raise conflict("Only drafts can be published.")
                levels = tree(db, row.id)
                for depth in range(len(levels) - 1):
                    children = {getattr(child, PARENTS[depth + 1]) for child in levels[depth + 1]}
                    if not levels[depth] or any(parent.id not in children for parent in levels[depth]):
                        raise conflict("Every included branch must reach a competency. Empty branches cannot publish.")
                for depth in (4, 5):
                    for child in levels[depth]:
                        if child.status == "archived" or getattr(child, "archived_at", None):
                            raise conflict("Retired child content cannot be republished.")
                        child.status = "published"
                db.flush()  # Freeze children only AFTER their prepared states persist.
                row.source_metadata = dict(row.source_metadata) | {
                    "administrative_review": payload.model_dump()
                    | {"reviewed_by": str(user.id), "reviewed_at": datetime.now(timezone.utc).isoformat()}
                }
                row.status = "published"
            else:
                if row.status not in {"draft", "published"}:
                    raise conflict("This curriculum version is already retired.")
                row.status = "archived"
        elif action == "delete":
            editable(db, kind, row)
            audit(db, user, "deleted", kind, row, request_id)
            db.delete(row)  # RESTRICT rejects children and all content/history references; no cascade.
            db.flush()
            return {"deleted": True}
        else:
            if row:
                editable(db, kind, row)
            data = values_for(kind, payload.values, row)
            if kind in KINDS[1:]:
                depth = KINDS.index(kind)
                parent_id = payload.parent_id or (getattr(row, PARENTS[depth]) if row else None)
                if parent_id is None:
                    raise invalid("A parent is required.")
                parent_kind = KINDS[depth - 1]
                parent = load(db, parent_kind, parent_id)
                editable(db, parent_kind, parent)
                if row is None:
                    check_revision(db, parent_kind, parent, expected)
                elif parent_id != getattr(row, PARENTS[depth]):
                    check_revision(db, parent_kind, parent, payload.target_revision)
                data[PARENTS[depth]] = parent_id
            elif payload.parent_id or payload.target_revision:
                raise invalid("This record has no parent.")
            if kind == "grades":
                data = {key: value for key, value in data.items() if key != "number"} | {
                    "grade_level_id": ClassroomRepository(db).ensure_grade(data["number"])
                }
            if kind == "subjects":
                load(db, "global-subjects", data["subject_id"])
            if row is None:
                row = model_for(kind)(**data)
                db.add(row)
            else:
                for field, value in data.items():
                    setattr(row, field, value)
        db.flush()
        db.refresh(row)  # Reflect server lifecycle timestamps, never fabricate publication evidence.
        audit(db, user, action, kind, row, request_id)
        return describe(db, kind, row)

    write = action not in {"list", "detail"}
    try:
        return resolve_session(
            admin_repo,
            token,
            required_permission="curriculum.write" if write else "curriculum.read",
            additional_permissions=("curriculum.read", "curriculum.publish")
            if action in {"publish", "retire"}
            else ("curriculum.read",)
            if write
            else (),
            csrf=csrf,
            request_id=request_id,
            mutation_operation=operation if write else None,
            read_operation=None if write else operation,
        )
    except DBAPIError as exc:
        state = getattr(exc.orig, "sqlstate", "")
        if state in {"23505", "23503", "23514", "40001", "40P01"}:
            raise conflict(
                "Duplicate order/code, protected reference or concurrent edit. Reload and review the structure."
            ) from None
        raise
