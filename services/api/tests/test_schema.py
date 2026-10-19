import importlib.util
from io import StringIO
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.dialects.postgresql import dialect
from sqlalchemy.orm import configure_mappers
from sqlalchemy.schema import CreateIndex, CreateTable

import app.models  # noqa: F401
from app.db.base import Base
from app.models.users import normalize_username
from scripts.bootstrap_names import repair_statement

ROOT = Path(__file__).resolve().parents[1]


def migration_module():
    spec = importlib.util.spec_from_file_location("initial", ROOT / "migrations/versions/0001_initial.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_mapper_configuration_and_unchanged_frozen_tables_match():
    configure_mappers()
    snapshot = {repair_statement(statement) for statement in migration_module().SCHEMA_SQL}
    assert len(Base.metadata.tables) == 63
    for table in Base.metadata.sorted_tables:
        if table.name in {
            "admin_browser_sessions",
            "admin_oidc_attempts",
            "grading_runs",
            "grading_item_results",
            "assessment_result_releases",
        }:
            continue  # Additive 0003; comparison applies only the explicit name-only bootstrap adapter.
        if table.name not in {
            "classes",
            "class_join_codes",
            "assignments",
            "assignment_versions",
            "assignment_questions",
            "assignment_attempts",
            "messages",
            "learner_profiles",
        }:
            assert str(CreateTable(table).compile(dialect=dialect())).strip() in snapshot
        for index in table.indexes:
            if index.name in {"ix_messages_context_class_id", "ix_messages_context_time"}:
                continue
            assert str(CreateIndex(index).compile(dialect=dialect())).strip() in snapshot
        assert table.c.id.primary_key
        assert table.c.created_at.type.timezone
        assert table.c.updated_at.type.timezone
        for foreign_key in table.foreign_keys:
            assert foreign_key.column is not None


def test_learning_focus_is_additive_and_retains_grade_history():
    table = Base.metadata.tables["learner_profiles"]
    assert table.c.learning_focus.nullable
    assert table.c.preferred_grade_id.nullable
    assert set(table.c.keys()) == {"id", "created_at", "updated_at", "user_id", "preferred_grade_id", "preferred_language", "learning_focus"}
    output = StringIO()
    config = Config(str(ROOT / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "0012_class_communication:0013_learning_focus", sql=True)
    sql = output.getvalue()
    assert "ADD COLUMN learning_focus JSONB" in sql
    assert "DROP" not in sql and "UPDATE learner_profiles" not in sql


def test_assignment_draft_additions_are_explicit_and_preserve_lock_requirements():
    attempts = Base.metadata.tables["assignment_attempts"]
    assert {"capture_contract", "capture_state", "submission_fingerprint"} <= set(attempts.c.keys())
    assert all(attempts.c[name].nullable for name in ("capture_contract", "capture_state", "submission_fingerprint"))
    assignments = Base.metadata.tables["assignments"]
    assert {"creation_request_id", "creation_fingerprint"} <= set(assignments.c.keys())
    assert assignments.c.creation_request_id.nullable
    assert Base.metadata.tables["assignment_versions"].c.max_attempts.nullable
    assert Base.metadata.tables["assignment_questions"].c.points.nullable
    output = StringIO()
    config = Config(str(ROOT / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "0006_question_associations:0009_response_capture", sql=True)
    sql = output.getvalue()
    assert "CREATE TABLE" not in sql and "DROP TABLE" not in sql
    assert "NEW.max_attempts IS NULL" in sql and "points IS NULL" in sql
    assert "CREATE TRIGGER require_assignment_configuration" in sql


def test_private_identity_boundary_and_no_plaintext_credentials():
    assert Base.metadata.tables["research_private.research_identity_links"].schema == "research_private"
    assert Base.metadata.tables["research_private.research_consent_records"].schema == "research_private"
    assert "user_id" not in Base.metadata.tables["research_participants"].c
    assert "credential_digest" in Base.metadata.tables["user_sessions"].c
    assert not {"token", "password", "credential"} & set(Base.metadata.tables["user_sessions"].c.keys())
    assert normalize_username("  Shan123 ") == normalize_username("shan123") == "shan123"


def test_offline_upgrade_and_downgrade_compile():
    output = StringIO()
    config = Config(str(ROOT / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "head", sql=True)
    upgrade = output.getvalue()
    assert upgrade.count("CREATE TABLE ") == len(Base.metadata.tables) + 1  # Alembic version table
    assert "CREATE SCHEMA research_private" in upgrade
    assert "uq_class_join_codes_active_code" in upgrade
    assert "ADD CONSTRAINT uq_class_join_codes_code UNIQUE (code)" in upgrade
    assert "ADD COLUMN creation_request_id UUID" in upgrade
    assert Base.metadata.tables["classes"].c.subject_id.nullable
    assert "uq_class_join_codes_code" in {c.name for c in Base.metadata.tables["class_join_codes"].constraints}
    output.seek(0)
    output.truncate()
    command.downgrade(config, "0001_initial:base", sql=True)
    assert output.getvalue().count("DROP TABLE ") == 59  # Frozen 0001: 58 domain tables + Alembic.


def test_admin_revision_compiles_and_keeps_occupied_tables_on_downgrade():
    output = StringIO()
    config = Config(str(ROOT / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "0002_class_creation:0003_admin_sessions", sql=True)
    sql = output.getvalue()
    assert sql.count("CREATE TABLE ") == 2
    assert "REVOKE ALL ON admin_browser_sessions, admin_oidc_attempts FROM PUBLIC" in sql
    assert "DROP TABLE" not in sql and "ALTER TABLE users" not in sql
    output.seek(0)
    output.truncate()
    command.downgrade(config, "0003_admin_sessions:0002_class_creation", sql=True)
    assert "Admin session tables are occupied" in output.getvalue()


def test_class_revision_downgrade_compiles_without_deleting_records():
    output = StringIO()
    config = Config(str(ROOT / "alembic.ini"), output_buffer=output)
    command.downgrade(config, "0002_class_creation:0001_initial", sql=True)
    sql = output.getvalue()
    assert "Cannot downgrade classes without subjects" in sql
    assert "DROP COLUMN creation_request_id" in sql
    assert "DELETE FROM classes" not in sql and "DELETE FROM class_join_codes" not in sql


def test_curriculum_revision_is_additive_and_preserves_frozen_history():
    output = StringIO()
    config = Config(str(ROOT / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "0003_admin_sessions:0004_curriculum_snapshots", sql=True)
    sql = output.getvalue()
    assert "CREATE FUNCTION fluentt_guard_curriculum_version()" in sql
    assert "CREATE TRIGGER guard_curriculum_child" in sql
    assert "pg_advisory_xact_lock(78090001)" in sql
    assert "CREATE TABLE" not in sql and "DROP TABLE" not in sql and "ALTER TABLE" not in sql
    assert "DELETE FROM" not in sql and "TRUNCATE" not in sql
    output.seek(0)
    output.truncate()
    command.downgrade(config, "0004_curriculum_snapshots:0003_admin_sessions", sql=True)
    assert "Preserve frozen curriculum protections" in output.getvalue()


def test_grading_addition_matches_its_frozen_ddl_and_preserves_occupied_history():
    spec = importlib.util.spec_from_file_location(
        "grading_revision", ROOT / "migrations/versions/0010_grading_results.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    snapshot = set(module.SCHEMA_SQL)
    for name in ("grading_runs", "grading_item_results"):
        table = Base.metadata.tables[name]
        assert str(CreateTable(table).compile(dialect=dialect())).strip() in snapshot
        for index in table.indexes:
            assert str(CreateIndex(index).compile(dialect=dialect())).strip() in snapshot
    output = StringIO()
    config = Config(str(ROOT / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "0009_response_capture:0010_grading_results", sql=True)
    assert output.getvalue().count("CREATE TABLE ") == 2
    assert "REVOKE ALL ON grading_runs, grading_item_results FROM PUBLIC" in output.getvalue()
    assert "ALTER TABLE assignment_attempts" not in output.getvalue()
    output.seek(0)
    output.truncate()
    command.downgrade(config, "0010_grading_results:0009_response_capture", sql=True)
    assert "Preserve grading history before downgrade" in output.getvalue()


def test_result_release_addition_is_append_only_and_matches_frozen_ddl():
    spec = importlib.util.spec_from_file_location(
        "release_revision", ROOT / "migrations/versions/0011_result_release.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    snapshot = set(module.SCHEMA_SQL)
    table = Base.metadata.tables["assessment_result_releases"]
    assert str(CreateTable(table).compile(dialect=dialect())).strip() in snapshot
    assert all(str(CreateIndex(index).compile(dialect=dialect())).strip() in snapshot for index in table.indexes)
    output = StringIO()
    config = Config(str(ROOT / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "0010_grading_results:0011_result_release", sql=True)
    sql = output.getvalue()
    assert sql.count("CREATE TABLE ") == 1 and "ALTER TABLE" not in sql
    assert "Result visibility history is immutable" in sql and "previous.run_id" in sql
    assert "REVOKE ALL ON assessment_result_releases FROM PUBLIC" in sql
    output.seek(0)
    output.truncate()
    command.downgrade(config, "0011_result_release:0010_grading_results", sql=True)
    assert "Result release history is occupied; downgrade refused" in output.getvalue()


def test_class_communication_additions_preserve_legacy_destinations():
    table = Base.metadata.tables["messages"]
    assert all(table.c[name].nullable for name in ("communication_contract", "context_class_id", "send_request_id"))
    assert "uq_messages_sender_request" in {c.name for c in table.constraints}
    assert "ck_messages_one_destination" in {c.name for c in table.constraints}
    assert {"ix_messages_context_class_id", "ix_messages_context_time"} <= {i.name for i in table.indexes}
    output = StringIO()
    command.upgrade(
        Config(str(ROOT / "alembic.ini"), output_buffer=output),
        "0011_result_release:0012_class_communication",
        sql=True,
    )
    sql = output.getvalue()
    assert "CREATE TABLE" not in sql and "DROP TABLE" not in sql
    assert "Class message history is immutable" in sql and "Read history is immutable" in sql
    assert "UNIQUE (sender_id, send_request_id)" in sql
    assert "REVOKE ALL ON messages,message_reads FROM PUBLIC" in sql
