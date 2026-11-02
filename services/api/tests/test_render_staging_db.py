from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.core.config import Settings
from scripts import init_render_staging_db as staging


def _settings(database: str) -> Settings:
    return Settings(_env_file=None, environment="production",
                    database_url=f"postgresql+psycopg://tester:dummy@localhost/{database}")


def _engine(monkeypatch, first_result, versions=None):
    connection = MagicMock()
    results = [SimpleNamespace(scalar_one=lambda: first_result)]
    if versions is not None:
        results.append(SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: versions)))
    connection.execute.side_effect = results
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = connection
    monkeypatch.setattr(staging, "create_engine", MagicMock(return_value=engine))
    return connection, engine


def test_staging_initializer_refuses_any_other_database(monkeypatch):
    monkeypatch.setattr(staging, "Settings", lambda: _settings("existing_students"))
    factory = MagicMock()
    monkeypatch.setattr(staging, "create_engine", factory)
    with pytest.raises(RuntimeError, match="outside synthetic staging"):
        staging.initialize()
    factory.assert_not_called()


def test_staging_initializer_rejects_unknown_revision(monkeypatch):
    monkeypatch.setattr(staging, "Settings", lambda: _settings(staging.STAGING_DATABASE))
    _, engine = _engine(monkeypatch, "alembic_version", ["unreviewed_revision"])
    upgrade = MagicMock()
    monkeypatch.setattr(staging.command, "upgrade", upgrade)
    with pytest.raises(RuntimeError, match="manual review required"):
        staging.initialize()
    upgrade.assert_not_called()
    engine.dispose.assert_called_once()


def test_staging_initializer_bootstraps_only_after_empty_guard(monkeypatch):
    monkeypatch.setattr(staging, "Settings", lambda: _settings(staging.STAGING_DATABASE))
    _, engine = _engine(monkeypatch, None)
    checked = MagicMock()
    upgraded = MagicMock()
    monkeypatch.setattr(staging, "require_empty", checked)
    monkeypatch.setattr(staging.command, "upgrade", upgraded)
    revision = staging.initialize()
    assert revision
    checked.assert_called_once()
    upgraded.assert_called_once()
    engine.dispose.assert_called_once()
