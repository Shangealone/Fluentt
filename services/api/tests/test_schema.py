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

ROOT = Path(__file__).resolve().parents[1]


def migration_module():
    spec = importlib.util.spec_from_file_location("initial", ROOT / "migrations/versions/0001_initial.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_mapper_configuration_and_unchanged_frozen_tables_match():
    configure_mappers()
    snapshot = set(migration_module().SCHEMA_SQL)
    assert len(Base.metadata.tables) == 58
    for table in Base.metadata.sorted_tables:
        if table.name not in {"classes", "class_join_codes"}:
            assert str(CreateTable(table).compile(dialect=dialect())).strip() in snapshot
        for index in table.indexes:
            assert str(CreateIndex(index).compile(dialect=dialect())).strip() in snapshot
        assert table.c.id.primary_key
        assert table.c.created_at.type.timezone
        assert table.c.updated_at.type.timezone
        for foreign_key in table.foreign_keys:
            assert foreign_key.column is not None


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
    assert output.getvalue().count("DROP TABLE ") == len(Base.metadata.tables) + 1


def test_class_revision_downgrade_compiles_without_deleting_records():
    output = StringIO()
    config = Config(str(ROOT / "alembic.ini"), output_buffer=output)
    command.downgrade(config, "0002_class_creation:0001_initial", sql=True)
    sql = output.getvalue()
    assert "Cannot downgrade classes without subjects" in sql
    assert "DROP COLUMN creation_request_id" in sql
    assert "DELETE FROM classes" not in sql and "DELETE FROM class_join_codes" not in sql
