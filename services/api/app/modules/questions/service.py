"""Question/key writes and live admin authorization share one PostgreSQL transaction."""

import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import select, text, func
from sqlalchemy.exc import DBAPIError

from app.models.assessments import Question, QuestionRevision, QuestionAnswerKey, QuestionCompetency
from app.models.curriculum import Lesson, LearningCompetency
from app.models.operations import AuditLog
from app.modules.administration.service import resolve_session
from app.modules.curriculum.repository import path_statement, visible
from app.modules.identity.errors import IdentityError
from app.modules.questions.schemas import ItemView, RevisionView, KeyView, Page, RevisionPage, PUBLIC_MODELS


def conflict(message="This item changed or is protected. Reload before trying again."):
    return IdentityError(409, "question_conflict", message)


def unavailable():
    return IdentityError(404, "question_unavailable", "Question or revision is unavailable.")


def key_for(db, row):
    return db.scalar(
        select(QuestionAnswerKey)
        .where(QuestionAnswerKey.question_revision_id == row.id)
        .execution_options(populate_existing=True)
    )


def links(db, row):
    return list(
        db.scalars(
            select(QuestionCompetency)
            .where(QuestionCompetency.question_revision_id == row.id)
            .order_by(QuestionCompetency.competency_id)
        )
    )


def fingerprint(db, item):
    # Do not hash low-entropy private keys. Row identities/timestamps cover key changes.
    state = [(item.__tablename__, str(item.id), str(item.updated_at))]
    for model in (QuestionRevision, QuestionAnswerKey, QuestionCompetency):
        statement = select(model.id, model.updated_at)
        if model is not QuestionRevision:
            statement = statement.join(QuestionRevision, model.question_revision_id == QuestionRevision.id)
        for row_id, updated_at in db.execute(
            statement.where(QuestionRevision.question_id == item.id).order_by(model.id)
        ):
            state.append((model.__tablename__, str(row_id), str(updated_at)))
    return hashlib.sha256(json.dumps(state).encode()).hexdigest()


def check(db, item, expected):
    if not expected:
        raise IdentityError(428, "question_revision_required", "Reload this item before saving changes.")
    if expected.strip('"') != fingerprint(db, item):
        raise conflict("A newer item change exists. Reload and review before saving.")


def describe(db, item, row, etag=None, private=False):
    data = {field: getattr(row, field) for field in PUBLIC_MODELS[row.method].model_fields}
    ids = [link.competency_id for link in links(db, row)]
    common = dict(id=row.id, question_id=item.id, version=row.version, revision=etag or fingerprint(db, item))
    if private:
        key = key_for(db, row)
        if key is None:
            raise conflict("This revision has no valid answer key; operator review is required.")
        return KeyView(
            **common,
            definition=data
            | dict(
                competency_ids=ids,
                answer_key=key.configuration,
                grading_version=key.grading_version,
                explanation=key.explanation,
            ),
        )
    return RevisionView(**common, status=item.status, locked_at=row.locked_at, competency_ids=ids, definition=data)


def summary(db, item):
    row = db.scalar(
        select(QuestionRevision)
        .where(QuestionRevision.question_id == item.id)
        .order_by(QuestionRevision.version.desc())
        .limit(1)
        .execution_options(populate_existing=True)
    )
    return ItemView(
        id=item.id,
        author_id=item.author_id,
        status=item.status,
        archived_at=item.archived_at,
        revision=fingerprint(db, item),
        latest_revision_id=row.id if row else None,
        latest_version=row.version if row else None,
        method=row.method if row else None,
        language=row.language if row else None,
        prompt=row.prompt if row else None,
    )


def validate_links(db, payload, *, publishing=False):
    lesson = db.get(Lesson, payload.lesson_id, populate_existing=True)
    if lesson is None:
        raise IdentityError(422, "invalid_question_relationship", "Choose an existing lesson.")
    found = set(
        db.scalars(
            select(LearningCompetency.id).where(
                LearningCompetency.id.in_(payload.competency_ids), LearningCompetency.lesson_id == lesson.id
            )
        )
    )
    if found != set(payload.competency_ids):
        raise IdentityError(422, "invalid_question_relationship", "Competencies must belong to the chosen lesson.")
    if publishing and db.execute(path_statement(5).where(Lesson.id == lesson.id, *visible(5))).first() is None:
        raise conflict("Publish only against a published, unretired curriculum lesson and ancestry.")


def replace_definition(db, row, payload):
    # Validate the complete replacement before any DML. Remove the old unlocked key
    # first so the existing ORM hook does not compare new content with its old key.
    key = key_for(db, row)
    if key:
        db.delete(key)
    for link in links(db, row):
        db.delete(link)
    db.flush()
    data = payload.model_dump(exclude={"competency_ids", "answer_key", "grading_version", "explanation"})
    data["content"] = payload.content.model_dump()
    for field, value in data.items():
        setattr(row, field, value)
    db.flush()
    db.add(
        QuestionAnswerKey(
            question_revision_id=row.id,
            configuration=payload.answer_key.model_dump(),
            grading_version=payload.grading_version,
            explanation=payload.explanation,
        )
    )
    for competency_id in payload.competency_ids:
        db.add(QuestionCompetency(question_revision_id=row.id, competency_id=competency_id))
    db.flush()


def execute(
    admin,
    token,
    *,
    action,
    question_id=None,
    revision_id=None,
    payload=None,
    query=None,
    expected=None,
    csrf=None,
    request_id=None,
):
    db = admin.session
    write = action in {"create", "new_revision", "replace", "publish", "retire"}

    def operation(user):
        # Same order as curriculum writers; materialize reads while holding shared lock.
        db.execute(
            text("SELECT pg_advisory_xact_lock(78090001)" if write else "SELECT pg_advisory_xact_lock_shared(78090001)")
        )
        if action == "list":
            latest = (
                select(QuestionRevision.question_id, func.max(QuestionRevision.version).label("version"))
                .group_by(QuestionRevision.question_id)
                .subquery()
            )
            statement = (
                select(Question)
                .outerjoin(latest, latest.c.question_id == Question.id)
                .outerjoin(
                    QuestionRevision,
                    (QuestionRevision.question_id == Question.id) & (QuestionRevision.version == latest.c.version),
                )
            )
            for field in ("method", "language", "lesson_id"):
                value = getattr(query, field)
                if value is not None:
                    statement = statement.where(getattr(QuestionRevision, field) == value)
            if query.status:
                statement = statement.where(Question.status == query.status)
            if query.q:
                statement = statement.where(QuestionRevision.prompt.icontains(query.q, autoescape=True))
            rows = list(
                db.scalars(
                    statement.order_by(Question.created_at.desc(), Question.id)
                    .offset(query.offset)
                    .limit(query.limit + 1)
                )
            )
            return Page(
                items=[summary(db, item) for item in rows[: query.limit]],
                offset=query.offset,
                limit=query.limit,
                has_more=len(rows) > query.limit,
            )
        if action == "create":
            validate_links(db, payload)
            item = Question(author_id=user.id)
            db.add(item)
            db.flush()
        else:
            item = db.scalar(
                select(Question)
                .where(Question.id == question_id)
                .with_for_update(read=not write)
                .execution_options(populate_existing=True)
            )
            if item is None:
                raise unavailable()
        revision_query = select(QuestionRevision).where(QuestionRevision.question_id == item.id)
        row = (
            db.scalar(
                revision_query.where(QuestionRevision.id == revision_id).execution_options(populate_existing=True)
            )
            if revision_id
            else None
        )
        if revision_id and row is None:
            raise unavailable()
        if not write:
            if action == "detail":
                return summary(db, item)
            if action == "history":
                selected = list(
                    db.scalars(
                        revision_query.order_by(QuestionRevision.version.desc())
                        .offset(query.offset)
                        .limit(query.limit + 1)
                    )
                )
                etag = fingerprint(db, item)
                return RevisionPage(
                    items=[describe(db, item, r, etag) for r in selected[: query.limit]],
                    offset=query.offset,
                    limit=query.limit,
                    has_more=len(selected) > query.limit,
                )
            return describe(db, item, row, private=action == "key")
        if action != "create":
            check(db, item, expected)
        if item.status == "archived" or item.archived_at is not None:
            raise conflict("Retired items retain history and cannot be restored or edited.")
        if action == "retire":
            item.status, item.archived_at = "archived", datetime.now(timezone.utc)
        elif action in {"create", "new_revision", "replace"}:
            validate_links(db, payload)
            if action != "replace":
                row = QuestionRevision(
                    question_id=item.id,
                    version=(
                        db.scalar(
                            select(func.max(QuestionRevision.version)).where(QuestionRevision.question_id == item.id)
                        )
                        or 0
                    )
                    + 1,
                    **payload.model_dump(exclude={"competency_ids", "answer_key", "grading_version", "explanation"}),
                )
                db.add(row)
                db.flush()
            elif row.locked_at is not None:
                raise conflict("Published revisions are immutable. Create a new revision for corrections.")
            replace_definition(db, row, payload)
        elif action == "publish":
            if row.locked_at is not None:
                raise conflict("This revision is already published.")
            # Revalidate stored content/keys before freezing, not caller correctness claims.
            definition = describe(db, item, row, private=True).definition
            validate_links(db, definition, publishing=True)
            row.locked_at = datetime.now(timezone.utc)
            item.status = "published"
        db.flush()
        db.refresh(item)
        if row:
            db.refresh(row)
        db.add(
            AuditLog(
                actor_id=user.id,
                action="questions." + action,
                entity_type="questions",
                entity_id=item.id,
                occurred_at=datetime.now(timezone.utc),
                request_id=request_id,
                safe_metadata={"revision_id": str(row.id), "version": row.version} if row else {},
            )
        )
        return summary(db, item) if action == "retire" else describe(db, item, row)

    try:
        return resolve_session(
            admin,
            token,
            required_permission="questions.write" if write or action == "key" else "questions.read",
            additional_permissions=("questions.read", "questions.publish")
            if action in {"publish", "retire"}
            else ("questions.read",)
            if write or action == "key"
            else (),
            csrf=csrf,
            request_id=request_id,
            mutation_operation=operation if write else None,
            read_operation=None if write else operation,
        )
    except DBAPIError as exc:
        if getattr(exc.orig, "sqlstate", "") in {"23505", "23503", "23514", "40001", "40P01"}:
            raise conflict("Invalid relationship, protected history or concurrent edit. Reload and review.") from None
        raise
