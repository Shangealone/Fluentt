from types import SimpleNamespace
from datetime import date
import pytest
from fastapi.testclient import TestClient
from app.core.config import Settings
from app.main import create_app
from app.modules.parallel_study.workflow_engine import isolated
from app.modules.parallel_study.workflow_schemas import WorkflowSetup, Enrollment, Snapshot
from app.modules.identity.errors import IdentityError
from uuid import uuid4


@pytest.mark.parametrize("environment,flag", [("production", True), ("development", True), ("test", False)])
def test_flags_cannot_authorize_non_test_workflow(environment, flag):
    class NoDatabase:
        def execute(self, *args):
            raise AssertionError("Unsafe environment must stop before querying a database")
    with pytest.raises(IdentityError):
        isolated(NoDatabase(), Settings(_env_file=None, environment=environment, parallel_test_workflows_enabled=flag,
                                       parallel_research_enabled=True))


@pytest.mark.parametrize("name,address", [("fluentt", "127.0.0.1"), ("fluentt_test_"+"a"*32, "192.0.2.1"),
                                          ("fluentt_test_bad", "127.0.0.1")])
def test_actual_database_identity_is_required(name, address):
    db = SimpleNamespace(execute=lambda *args: SimpleNamespace(one=lambda: (name, address)))
    with pytest.raises(IdentityError):
        isolated(db, Settings(_env_file=None, environment="test", parallel_research_enabled=True, parallel_test_workflows_enabled=True))


def test_no_real_approval_can_be_injected_as_test_evidence():
    with pytest.raises(ValueError):
        WorkflowSetup(pretest_date=date(2026, 11, 1), assessment_version="test", assessment_format="typed_recall",
                      policy="development-objective-complete-v1", approvals={"protocol": "approved", "ethics": "approved", "site": "approved"})
    with pytest.raises(ValueError):
        Enrollment(user_id=uuid4(), eligibility_confirmed=True, consent_evidence={"consent": "real approval"})
    with pytest.raises(ValueError):
        Snapshot(responses={"bad": "\ud800"}, expected_revision=1, request_id=uuid4())


def test_routes_remain_unavailable_with_flags_in_production():
    app = create_app(Settings(_env_file=None, database_url=None, environment="production",
                             parallel_research_enabled=True, parallel_test_workflows_enabled=True))
    with TestClient(app, base_url="https://testserver") as client:
        response = client.get("/api/v1/me/parallel-test/studies")
        assert response.status_code == 404 and response.headers["Cache-Control"] == "no-store"
