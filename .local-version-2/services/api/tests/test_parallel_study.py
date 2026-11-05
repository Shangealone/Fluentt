"""Synthetic foundation checks; no real enrollment or model inference."""
from datetime import date, datetime, timezone, timedelta
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest

from app.core.config import Settings
from app.main import create_app
from app.modules.parallel_study.policy import allocation_sequence, CONTROL, EXPERIMENTAL, windows, month_end, activity_status, select_schedule
from app.modules.parallel_study.schemas import Draft
from app.modules.research.execution_guard import assert_no_managed_execution
from app.modules.identity.errors import IdentityError
from app.modules.spaced_repetition.fsrs6 import calculate_fsrs6


@pytest.mark.parametrize("seed", [bytes(32), bytes(range(32)), b"a"*32])
def test_full_and_partial_allocation(seed):
    slots = allocation_sequence(seed)
    assert slots == allocation_sequence(seed)
    assert slots.count(CONTROL) == slots.count(EXPERIMENTAL) == 15
    for n in range(31):
        assert max(slots[:n].count(CONTROL), slots[:n].count(EXPERIMENTAL)) <= 15


@pytest.mark.parametrize("start,end", [(date(2028, 1, 31), date(2028, 2, 29)),
                                        (date(2026, 12, 5), date(2027, 1, 5)),
                                        (date(2026, 2, 1), date(2026, 3, 1))])
def test_month_and_weekday_windows(start, end):
    assert month_end(start) == end
    rows = windows(start, "Asia/Manila")
    assert all(day.weekday() < 5 and start <= day < end for day, _, _ in rows)
    assert len(rows) == sum((start+timedelta(days=i)).weekday() < 5 for i in range((end-start).days))
    assert all(closes-opens == timedelta(days=1) and opens.hour == 16 for _, opens, closes in rows)


def test_server_window_status_has_no_fake_completion():
    _, opens, closes = windows(date(2026, 11, 2), "Asia/Manila")[0]
    assert activity_status(opens-timedelta(microseconds=1), opens, closes, operational=True) == "upcoming"
    assert activity_status(opens, opens, closes, operational=True) == "available"
    assert activity_status(closes, opens, closes, operational=True) == "missed"
    assert activity_status(closes, opens, closes) == "blocked"
    assert activity_status(closes, opens, closes, completed_at=opens) == "completed"


def test_scheduling_is_offline_only_and_control_exact():
    at = datetime(2026, 11, 5, tzinfo=timezone.utc)
    result = select_schedule(CONTROL, None, "good", at, context="parallel_classroom")
    assert result["decision"] == calculate_fsrs6(None, "good", at)
    assert select_schedule(EXPERIMENTAL, None, "good", at, context="parallel_classroom")["status"] == "blocked"
    assert select_schedule(CONTROL, None, "good", at, context="parallel_classroom", live=True)["status"] == "blocked"
    with pytest.raises(ValueError):
        select_schedule(CONTROL, None, "good", at, context="personal")


def test_unapproved_assessments_and_bad_dates_are_not_invented():
    args = dict(class_id=uuid4(), pack_id=uuid4(), title="Synthetic", protocol_version="draft-v1",
                start_date=date(2026, 11, 5), posttest_date=date(2026, 12, 5), required_consent_kinds=["consent"])
    assert Draft(**args).assessment_configuration == {}
    with pytest.raises(ValueError):
        Draft(**(args | {"assessment_configuration": {"score": 100}}))
    with pytest.raises(ValueError):
        Draft(**(args | {"posttest_date": date(2026, 11, 10)}))


def test_default_off_and_legacy_execution_blocked():
    settings = Settings(_env_file=None, database_url=None)
    assert settings.parallel_research_enabled is False
    with TestClient(create_app(settings)) as client:
        for method, path in (("get", "/api/v1/admin/parallel-studies/"+str(uuid4())),
                             ("post", "/api/v1/admin/parallel-studies")):
            response = getattr(client, method)(path)
            assert response.status_code == 404
            assert response.headers["cache-control"] == "no-store"
    with pytest.raises(IdentityError):
        assert_no_managed_execution(SimpleNamespace(conditions={"research_contract": "esr-parallel-foundation-v1"}))


def test_enabled_admin_endpoint_still_requires_real_credentials():
    from app.modules.curriculum.router import get_admin_repository
    application = create_app(Settings(_env_file=None, database_url=None, parallel_research_enabled=True))
    application.app.dependency_overrides[get_admin_repository] = lambda: object()
    with TestClient(application) as client:
        # A mobile bearer credential or forged old demo cookie is not admin identity.
        response = client.get("/api/v1/admin/parallel-studies/"+str(uuid4()),
                              headers={"Authorization": "Bearer forged", "Cookie": "fluentt_demo_admin=1"})
        assert response.status_code == 401


def test_status_is_safe_for_school_accounts_and_excludes_personal_learning():
    from app.modules.identity.dependencies import get_current_mobile_user
    application = create_app(Settings(_env_file=None, database_url=None))
    user = SimpleNamespace(profile=SimpleNamespace(role="instructor"))
    application.app.dependency_overrides[get_current_mobile_user] = lambda: user
    with TestClient(application) as client:
        response = client.get("/api/v1/me/parallel-study/status")
        assert response.status_code == 200 and response.json()["participation_enabled"] is False
        assert response.headers["cache-control"] == "no-store"
        user.profile.role = "personal_student"
        assert client.get("/api/v1/me/parallel-study/status").status_code == 403
