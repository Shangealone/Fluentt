"""Monitoring remains fail-closed without a real administrator session."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import Response
from starlette.requests import Request
from sqlalchemy.dialects import postgresql

from app.core.config import Settings
from app.modules.administration import monitoring, monitoring_router, service
from app.modules.administration.router import credential
from app.modules.identity.errors import IdentityError
from tests.admin_support import MemoryAdminRepository


def test_forged_demo_cookie_is_not_an_admin_credential():
    app = SimpleNamespace(state=SimpleNamespace(settings=Settings(_env_file=None, database_url=None)))
    request = Request({"type": "http", "method": "GET", "path": "/api/v1/admin/monitoring/overview",
                       "headers": [(b"cookie", b"fluentt_demo_admin=1")], "app": app})
    with pytest.raises(IdentityError) as error:
        credential(request)
    assert error.value.status == 401


def test_local_preview_requires_development_loopback_and_private_token():
    def request(environment="development", client="127.0.0.1", token="a" * 48):
        settings = Settings(_env_file=None, database_url=None, environment=environment,
                            admin_local_preview_token="a" * 48)
        return Request({"type": "http", "method": "GET", "path": "/api/v1/admin/monitoring/overview",
                        "scheme": "http", "server": ("127.0.0.1", 8000), "client": (client, 12000),
                        "headers": [(b"host", b"127.0.0.1:8000"),
                                    (b"x-fluentt-local-preview-token", token.encode())],
                        "app": SimpleNamespace(state=SimpleNamespace(settings=settings))})

    assert monitoring_router.local_preview_allowed(request())
    assert not monitoring_router.local_preview_allowed(request(environment="production"))
    assert not monitoring_router.local_preview_allowed(request(client="10.0.0.5"))
    assert not monitoring_router.local_preview_allowed(request(token="b" * 48))


def test_empty_scheduler_sections_do_not_invent_outcomes():
    class EmptyDb:
        def scalar(self, statement):
            return 0

    result = monitoring.fsrs(EmptyDb())
    assert result["status"] == "no_recorded_reviews"
    assert result["review_count"] == 0
    assert result["prediction_quality"] is None
    hybrid = monitoring.fifakt(EmptyDb())
    assert hybrid["status"] == "simulated_prototype"
    assert hybrid["simulation_trace_count"] == 0
    assert hybrid["real_review_count"] is None
    assert hybrid["prediction_quality"] is None


def test_scheduler_queries_separate_real_fsrs_from_simulated_fifakt_and_research():
    dialect = postgresql.dialect()
    for algorithm, simulated in (("fsrs6", False), ("fifakt", True)):
        statement = monitoring.scheduler_event_scope(algorithm, simulated)
        sql = str(statement.compile(dialect=dialect))
        assert "vocabulary_review_events" in sql
        assert "scheduler_configurations" in sql
        assert "research_private.classroom_bindings" in sql
        assert "class_memberships" in sql
        assert ("IS true" if simulated else "IS false") in sql


def test_dashboard_only_admin_cannot_read_monitoring():
    repo = MemoryAdminRepository()
    token = service.issue_session(repo, "https://id.example", "approved-subject")
    request = Request({"type": "http", "method": "GET", "path": "/api/v1/admin/monitoring/overview",
                       "headers": [], "app": SimpleNamespace(state=SimpleNamespace())})
    request.state.request_id = str(uuid4())
    with pytest.raises(IdentityError) as error:
        monitoring_router.overview(request, Response(), token, repo)
    assert error.value.status == 403


def test_wavlm_and_submission_queries_keep_classroom_boundaries():
    dialect = postgresql.dialect()
    wavlm = str(monitoring.wavlm_scope().compile(dialect=dialect))
    captures = str(monitoring.submitted_scope().compile(dialect=dialect))
    for statement in (wavlm, captures):
        assert "research_private.classroom_bindings" in statement
        assert "class_memberships" in statement
        assert "classes" in statement
    assert "pronunciation_activities" in wavlm
    assert "simulated" in wavlm
    assert "distribution-only-v1" not in captures  # Bound value, never interpolated into SQL.


def test_class_search_uses_current_join_code_without_returning_guesses():
    class EmptyRows:
        def all(self):
            return []

    class FakeDb:
        statement = None

        def execute(self, statement):
            self.statement = statement
            return EmptyRows()

    db = FakeDb()
    result = monitoring.classes(db, "123456", 20, 0)
    assert result["items"] == []
    statement = str(db.statement.compile(dialect=postgresql.dialect()))
    assert "class_join_codes" in statement
    assert "expires_at" in statement
    assert "research_private.classroom_bindings" in statement
