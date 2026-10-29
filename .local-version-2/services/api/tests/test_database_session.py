from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.db.engine import build_engine
from app.db.session import get_session, session_factory


def test_engine_is_lazy_and_pool_is_bounded():
    engine = build_engine(
        Settings(_env_file=None, database_url="postgresql+psycopg://test:test@localhost:1/fluentt_test")
    )
    assert engine.pool.size() == 5
    assert engine.pool.checkedout() == 0
    session = session_factory(engine)()
    assert session.bind is engine
    session.close()
    engine.dispose()


def test_unconfigured_session_dependency():
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(session_factory=None)))
    with pytest.raises(HTTPException) as exc:
        next(get_session(request))
    assert exc.value.status_code == 503


def test_session_rolls_back_closes_and_redacts_connection_failure():
    session = MagicMock()
    factory = MagicMock()
    factory.return_value.__enter__.return_value = session
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(session_factory=factory)))
    dependency = get_session(request)
    assert next(dependency) is session
    with pytest.raises(HTTPException) as exc:
        dependency.throw(OperationalError("SELECT private", {}, Exception("private-password")))
    assert exc.value.status_code == 503
    assert "private" not in str(exc.value.detail)
    session.rollback.assert_called_once()
    factory.return_value.__exit__.assert_called_once()


@pytest.mark.parametrize(
    "values",
    [
        {"database_pool_size": 0},
        {"database_max_overflow": -1},
        {"database_connect_timeout": 0},
        {"database_url": "postgresql+psycopg://"},
    ],
)
def test_invalid_database_configuration(values):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)


def test_configuration_error_does_not_reveal_input_secret():
    with pytest.raises(ValidationError) as exc:
        Settings(_env_file=None, database_url="invalid://private-secret@localhost/db")
    assert "private-secret" not in str(exc.value)
