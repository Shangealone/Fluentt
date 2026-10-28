"""Synthetic configuration checks only; no hosted services or database writes."""

import pytest
from sqlalchemy.engine import make_url

from scripts.start_render import prepare_environment


def environment(**changes):
    return {"RENDER": "true", "FLUENTT_ENVIRONMENT": "production",
            "DATABASE_URL": "postgresql://qa:synthetic%40only@db.invalid/demo?sslmode=require",
            "PORT": "10000", **changes}


def test_render_database_adapter_preserves_escaped_secret_and_tls():
    values = environment()
    assert prepare_environment(values) == 10000
    url = make_url(values["FLUENTT_DATABASE_URL"])
    assert url.drivername == "postgresql+psycopg"
    assert url.password == "synthetic@only"
    assert url.query["sslmode"] == "require"


def test_explicit_application_connection_wins_without_mutating_source():
    values = environment(FLUENTT_DATABASE_URL="postgresql+psycopg://qa:synthetic@other.invalid/explicit")
    original = values["DATABASE_URL"]
    prepare_environment(values)
    assert make_url(values["FLUENTT_DATABASE_URL"]).database == "explicit"
    assert values["DATABASE_URL"] == original


@pytest.mark.parametrize("changes", [{"RENDER": "false"}, {"FLUENTT_ENVIRONMENT": "development"},
                                    {"DATABASE_URL": "sqlite:///demo.db"}, {"DATABASE_URL": "bad-secret"},
                                    {"PORT": "0"}, {"PORT": "70000"}, {"PORT": "not-a-port"}])
def test_invalid_configuration_fails_without_exposing_input(changes):
    with pytest.raises(ValueError) as error:
        prepare_environment(environment(**changes))
    assert "bad-secret" not in str(error.value)
    assert "synthetic" not in str(error.value)
