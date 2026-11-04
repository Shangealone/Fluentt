"""Operator-only, content-only curriculum transfer. Never export account records."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.exc import SQLAlchemyError
import app.models  # noqa: F401 -- register metadata
from app.db.base import Base
from app.core.config import Settings
from app.db.engine import build_engine

TABLES = (
    "grade_levels", "subjects", "curriculum_versions", "curriculum_grades",
    "curriculum_subjects", "quarters", "curriculum_topics", "lessons",
    "learning_competencies", "questions", "question_revisions",
    "question_answer_keys", "question_competencies",
)
DEFAULT_BUNDLE = Path(__file__).resolve().parents[3] / "content" / "administrator-library.v1.json"


def serial(value):
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, (UUID, Decimal)):
        return str(value)
    raise TypeError("Unsupported content value")


def canonical(value):
    return json.loads(json.dumps(value, default=serial, ensure_ascii=False, sort_keys=True))


def seal_bundle(bundle):
    raw = json.dumps(bundle["tables"], sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    bundle["sha256"] = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return bundle


def export_bundle(connection):
    connection.execute(sa.text("SELECT pg_advisory_xact_lock_shared(78090001)"))
    tables = Base.metadata.tables
    version = tables["curriculum_versions"]
    grade = tables["curriculum_grades"]
    subject = tables["curriculum_subjects"]
    quarter = tables["quarters"]
    topic = tables["curriculum_topics"]
    lesson = tables["lessons"]
    question = tables["questions"]
    revision = tables["question_revisions"]
    lesson_ids = sa.select(lesson.c.id).where(lesson.c.teacher_owned.is_(False), lesson.c.topic_id.is_not(None))
    revisions = sa.select(revision.c.id).join(question, revision.c.question_id == question.c.id).where(
        revision.c.lesson_id.in_(lesson_ids), question.c.teacher_lesson_id.is_(None))
    filters = {
        "grade_levels": tables["grade_levels"].c.id.in_(sa.select(grade.c.grade_level_id)),
        "subjects": tables["subjects"].c.id.in_(sa.select(subject.c.subject_id)),
        "curriculum_versions": version.c.id.is_not(None),
        "curriculum_grades": grade.c.id.is_not(None),
        "curriculum_subjects": subject.c.id.is_not(None),
        "quarters": quarter.c.id.is_not(None),
        "curriculum_topics": topic.c.id.is_not(None),
        "lessons": lesson.c.id.in_(lesson_ids),
        "learning_competencies": tables["learning_competencies"].c.lesson_id.in_(lesson_ids),
        "questions": question.c.id.in_(sa.select(revision.c.question_id).where(revision.c.id.in_(revisions))),
        "question_revisions": revision.c.id.in_(revisions),
        "question_answer_keys": tables["question_answer_keys"].c.question_revision_id.in_(revisions),
        "question_competencies": tables["question_competencies"].c.question_revision_id.in_(revisions),
    }
    rows = {}
    for name in TABLES:
        table = tables[name]
        records = []
        for record in connection.execute(sa.select(table).where(filters[name]).order_by(table.c.id)).mappings():
            row = {key: value for key, value in record.items() if key != "updated_at"}
            if name == "questions":
                row["author_id"] = None  # Never export or recreate a real author's account identity.
            records.append(canonical(row))
        rows[name] = records
    return seal_bundle({"format": "fluentt-administrator-library-v1", "tables": rows})


def validate_bundle(bundle):
    if set(bundle) != {"format", "tables", "sha256"} or bundle["format"] != "fluentt-administrator-library-v1":
        raise ValueError("Unsupported lesson library format.")
    if set(bundle["tables"]) != set(TABLES):
        raise ValueError("The lesson library must contain only the approved content tables.")
    if seal_bundle({"tables": bundle["tables"]})["sha256"] != bundle["sha256"]:
        raise ValueError("Lesson library checksum mismatch.")
    for name, rows in bundle["tables"].items():
        if not isinstance(rows, list):
            raise ValueError("Invalid lesson library rows.")
        columns = set(Base.metadata.tables[name].columns.keys()) - {"updated_at"}
        seen = set()
        for row in rows:
            if set(row) != columns or row["id"] in seen:
                raise ValueError("Unsupported or duplicate lesson library fields.")
            seen.add(row["id"])
            UUID(row["id"])
            if name == "questions" and (row["author_id"] is not None or row["teacher_lesson_id"] is not None):
                raise ValueError("Account identities and teacher lessons cannot be imported in this library.")
            if name == "lessons" and (row["teacher_owned"] or row["topic_id"] is None):
                raise ValueError("Only administrator curriculum lessons belong in this library.")
    return bundle


def load_bundle(path):
    return validate_bundle(json.loads(Path(path).read_text(encoding="utf-8")))


def typed(table, row):
    result = dict(row)
    for column in table.columns:
        value = result.get(column.name)
        if value is None:
            continue
        if isinstance(column.type, sa.Uuid):
            result[column.name] = UUID(value)
        elif isinstance(column.type, sa.DateTime):
            result[column.name] = datetime.fromisoformat(value)
        elif isinstance(column.type, sa.Numeric):
            result[column.name] = Decimal(value)
    return result


def import_bundle(connection, bundle):
    """Caller owns one atomic transaction; existing content is never overwritten."""
    validate_bundle(bundle)
    connection.execute(sa.text("SELECT pg_advisory_xact_lock(78090001)"))
    inserted = updated = 0
    remap = {}
    finalize = []
    for name in TABLES:
        table = Base.metadata.tables[name]
        for raw in bundle["tables"][name]:
            row = typed(table, raw)
            for column in table.columns:
                if column.foreign_keys and row.get(column.name) in remap:
                    row[column.name] = remap[row[column.name]]
            natural = "number" if name == "grade_levels" else "code" if name == "subjects" else None
            existing = connection.execute(sa.select(table).where(
                table.c[natural] == row[natural] if natural else table.c.id == row["id"])).mappings().first()
            if existing and natural:
                remap[row["id"]] = existing["id"]
                row["id"] = existing["id"]
            lifecycle = {"status", "published_at", "archived_at"} if name == "curriculum_versions" else {"locked_at"} if name == "question_revisions" else {"status"} if name in {"curriculum_topics", "lessons", "questions"} else set()
            if existing:
                ignored = {"created_at", "updated_at", "author_id"} | lifecycle
                if any(canonical(existing[key]) != canonical(value) for key, value in row.items() if key not in ignored):
                    raise ValueError(f"Lesson library conflict in {name}; local content was preserved. Review before importing.")
                # A locally published/retired version must never be downgraded by the bundle.
                if "status" in lifecycle and existing["status"] != row["status"]:
                    if existing["status"] != "draft":
                        raise ValueError("Lesson library lifecycle conflict; local publication history was preserved.")
                if name == "question_revisions" and existing["locked_at"] and existing["locked_at"] != row["locked_at"]:
                    raise ValueError("Lesson library lock conflict; local question history was preserved.")
            else:
                initial = dict(row)
                if name == "curriculum_versions":
                    initial.update(status="draft", published_at=None, archived_at=None)
                elif name == "question_revisions":
                    initial["locked_at"] = None
                connection.execute(sa.insert(table).values(**initial))
                inserted += 1
            if lifecycle:
                finalize.append((table, row, existing))
    # Install keys and competency links before locking questions; freeze roots last.
    for table, row, existing in reversed(finalize):
        if table.name == "question_revisions":
            if row["locked_at"] and (not existing or existing["locked_at"] is None):
                connection.execute(sa.update(table).where(table.c.id == row["id"]).values(locked_at=row["locked_at"]))
                updated += 1
        elif table.name != "curriculum_versions":
            if existing and existing["status"] != row["status"]:
                connection.execute(sa.update(table).where(table.c.id == row["id"]).values(status=row["status"]))
                updated += 1
        elif not existing or existing["status"] != row["status"]:
            if row["status"] == "archived" and row["published_at"]:
                connection.execute(sa.update(table).where(table.c.id == row["id"]).values(status="published", published_at=row["published_at"]))
            if row["status"] != "draft":
                connection.execute(sa.update(table).where(table.c.id == row["id"]).values(
                    status=row["status"], published_at=row["published_at"], archived_at=row["archived_at"]))
                updated += 1
    return {"inserted": inserted, "updated": updated, "lessons": len(bundle["tables"]["lessons"]),
            "questions": len(bundle["tables"]["question_revisions"])}


def main():
    parser = argparse.ArgumentParser(description="Transfer administrator curriculum content without accounts or classroom records.")
    parser.add_argument("action", choices=["export", "import", "check"])
    parser.add_argument("--file", type=Path, default=DEFAULT_BUNDLE)
    args = parser.parse_args()
    engine = None
    try:
        settings = Settings()
        if settings.environment != "development":
            raise ValueError("Automatic/shared lesson loading is restricted to development databases.")
        engine = build_engine(settings)
        if engine is None:
            raise ValueError("Configure the local PostgreSQL connection first.")
        if args.action == "export":
            with engine.begin() as connection:
                bundle = export_bundle(connection)
            validate_bundle(bundle)
            args.file.parent.mkdir(parents=True, exist_ok=True)
            args.file.write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"Exported {len(bundle['tables']['lessons'])} administrator lessons; accounts and classroom data excluded.")
        else:
            bundle = load_bundle(args.file)
            with engine.connect() as connection:
                with connection.begin() as transaction:
                    result = import_bundle(connection, bundle)
                    if args.action == "check":
                        transaction.rollback()
            print("Lesson library " + ("check (rolled back): " if args.action == "check" else "loaded: ") + json.dumps(result))
    except (ValueError, OSError) as exc:
        print(str(exc))
        return 2
    except SQLAlchemyError:
        print("Lesson library loading failed and rolled back. Review database migrations and content conflicts; no partial import was retained.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
