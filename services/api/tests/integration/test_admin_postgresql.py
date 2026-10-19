"""Real PostgreSQL only; uses the shared isolated UUID-database fixture."""

from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.admin_sessions import AdminBrowserSession
from app.models.operations import AuditLog
from app.models.users import User
from app.modules.administration.cli import provision, revoke
from app.modules.administration.repository import AdminRepository
from app.modules.administration import service
from app.modules.administration.security import digest, secret
from app.modules.identity.errors import IdentityError

pytestmark = pytest.mark.postgresql


def setup(db):
    repo = AdminRepository(db)
    provision(repo, "SyntheticAdmin", "https://id.example", "approved-subject")
    return repo


def test_provision_login_restore_logout_and_audits(db):
    repo = setup(db)
    token = service.issue_session(repo, "https://id.example", "approved-subject")
    profile = service.resolve_session(repo, token)
    service.resolve_session(repo, token, logout=True, csrf=profile.csrf_token)
    with pytest.raises(IdentityError):
        service.resolve_session(repo, token)
    actions = set(db.scalars(select(AuditLog.action)))
    assert {"admin.provisioned", "admin.login_succeeded", "admin.logout"} <= actions
    assert token not in str(list(db.scalars(select(AuditLog.safe_metadata))))


@pytest.mark.parametrize("disable", [True, False])
def test_operator_revoke_all_multiple_sessions(db, disable):
    repo = setup(db)
    first = service.issue_session(repo, "https://id.example", "approved-subject")
    second = service.issue_session(repo, "https://id.example", "approved-subject")
    assert revoke(repo, "SyntheticAdmin", disable=disable) == 2
    for token in (first, second):
        with pytest.raises(IdentityError):
            service.resolve_session(repo, token)
    assert bool(service.issue_session(repo, "https://id.example", "approved-subject")) is not disable


def test_mobile_account_is_never_promoted(db):
    db.add(User(username="SyntheticLearner", role="school_student"))
    db.commit()
    repo = AdminRepository(db)
    with pytest.raises(ValueError):
        provision(repo, "syntheticlearner", "https://id.example", "approved-subject")
    with pytest.raises(ValueError):
        revoke(repo, "SyntheticLearner", disable=True)
    assert db.scalar(select(User.role).where(User.username == "SyntheticLearner")) == "school_student"


def test_duplicate_mapping_rolls_back_entire_provisioning(db):
    repo = setup(db)
    with pytest.raises(ValueError):
        provision(repo, "OtherAdmin", "https://id.example", "approved-subject")
    assert db.scalar(select(User.id).where(User.username == "OtherAdmin")) is None


def test_attempt_consumption_is_persisted(db):
    repo = setup(db)
    state, binding = service.begin_attempt(repo)
    assert service.consume_attempt(repo, state, binding)
    assert not service.consume_attempt(repo, state, binding)


def test_session_constraints_and_expiry(db):
    repo = setup(db)
    now = service.utcnow()
    token = service.issue_session(repo, "https://id.example", "approved-subject", now=now)
    with pytest.raises(IdentityError):
        service.resolve_session(repo, token, now=now + timedelta(minutes=30))
    user_id = db.scalar(select(User.id).where(User.username == "SyntheticAdmin"))
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.add(
                AdminBrowserSession(
                    user_id=user_id,
                    credential_digest=digest(secret()),
                    created_at=now,
                    expires_at=now - timedelta(seconds=1),
                    absolute_expires_at=now,
                )
            )
            db.flush()


def test_audit_failure_rolls_back_session_issuance(db, monkeypatch):
    repo = setup(db)

    def fail(*args, **kwargs):
        raise RuntimeError("synthetic audit failure")

    monkeypatch.setattr(repo, "audit", fail)
    with pytest.raises(RuntimeError):
        service.issue_session(repo, "https://id.example", "approved-subject")
    assert list(db.scalars(select(AdminBrowserSession))) == []
